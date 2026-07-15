import React, { useEffect, useRef } from "react";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { AuthLayout } from "@/components/AuthLayout";
import { AdminLogin } from "@/components/AdminLogin";
import { SignInForm, SignUpForm } from "@/components/AuthForms";
import { isDevLoginEnabled } from "@/lib/devLogin";
import { Toaster } from "@/components/ui/sonner";

import LandingPage from "@/pages/landing";
import DashboardPage from "@/pages/dashboard";
import FirsatlarimPage from "@/pages/firsatlarim";
import IhaleDetayPage from "@/pages/ihale-detay";
import IhaleAramaPage from "@/pages/ihale-arama";
import BoruHattiPage from "@/pages/boru-hatti";
import RaporlarPage from "@/pages/raporlar";
import AyarlarPage from "@/pages/ayarlar";
import PazarlamaPage from "@/pages/pazarlama/index";
import ContentGeneratorPage from "@/pages/pazarlama/content-generator";
import ContentCalendarPage from "@/pages/pazarlama/content-calendar";
import BlogAdminPage from "@/pages/pazarlama/blog";
import SocialConnectionsPage from "@/pages/pazarlama/social-connections";
import FiyatlandirmaPage from "@/pages/fiyatlandirma";
import AdminPage from "@/pages/admin/index";
import BlogListPage from "@/pages/blog/index";
import BlogPostPage from "@/pages/blog/post";
import RakiplerPage from "@/pages/rakipler";
import NotFound from "@/pages/not-found";
import { RequirePro } from "@/components/PaywallOverlay";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === "true";

function SignInPage() {
  return (
    <AuthLayout>
      <SignInForm />
    </AuthLayout>
  );
}

function AdminLoginPage() {
  return (
    <AuthLayout>
      <AdminLogin />
    </AuthLayout>
  );
}

function SignUpPage() {
  return (
    <AuthLayout>
      <SignUpForm />
    </AuthLayout>
  );
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) {
    return <Redirect to="/ihale-arama" />;
  }

  return <LandingPage />;
}

/**
 * Production ProtectedRoute: enforces auth and redirects unauthenticated
 * users to /sign-in. Signed-in users without a company profile are nudged to
 * the wizard (unless they are already on it or explicitly skipped it this session).
 */
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  if (BYPASS_AUTH) {
    return (
      <AppShell>
        <Component />
      </AppShell>
    );
  }

  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect to="/sign-in" />;

  return (
    <AppShell>
      <Component />
    </AppShell>
  );
}

/**
 * Route guard for admin-only pages. Requires auth + admin status.
 * Non-admins see a 403 page; unauthenticated users are redirected to sign-in.
 */
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch(`${API_BASE}/marketing/admin-check`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.isAdmin ?? false))
      .catch(() => setIsAdmin(false));
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || (isSignedIn && isAdmin === null)) return null;

  if (!isSignedIn) return <Redirect to="/sign-in" />;

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
          <div className="text-5xl">🔒</div>
          <h1 className="text-2xl font-heading font-bold">Yetkisiz Erişim</h1>
          <p className="text-muted-foreground max-w-sm">
            Bu sayfaya erişim için yönetici yetkisi gereklidir.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Component />
    </AppShell>
  );
}

/**
 * Wrap a premium-only page in the Pro full-page gate. Free users see an upgrade
 * screen (inside the AppShell); Pro users see the real page.
 */
function proGate(
  Component: React.ComponentType,
  gate: { title: string; description: string },
): React.ComponentType {
  return function GatedPage() {
    return (
      <RequirePro title={gate.title} description={gate.description}>
        <Component />
      </RequirePro>
    );
  };
}

/**
 * Watches for a newly signed-in user with no company profile and redirects them
 * to the wizard — unless they have explicitly skipped it this browser session or
 * already have a profile. The skip flag is persisted in localStorage per user so
 * it survives page refreshes but resets if the user signs out and back in as a
 * different account.
 */
function FirstVisitRedirect() {
  const { isLoaded, isSignedIn, user } = useAuth();
  const [, navigate] = useLocation();
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id || hasCheckedRef.current) return;

    const currentPath = window.location.pathname.replace(basePath, "") || "/";
    if (currentPath === "/ayarlar" || currentPath.startsWith("/sign-")) return;

    const skipKey = `ihale_onboarding_skipped_${user.id}`;
    if (localStorage.getItem(skipKey)) return;

    hasCheckedRef.current = true;

    fetch(`${API_BASE}/company-profile`, { credentials: "include" })
      .then((res) => {
        if (res.status === 404) {
          navigate("/ayarlar?tab=sirket");
        }
      })
      .catch(() => {});
  }, [isLoaded, isSignedIn, user?.id, navigate]);

  return null;
}

function AppRoutes() {
  return (
    <QueryClientProvider client={queryClient}>
      <FirstVisitRedirect />
      <Switch>
        <Route path="/" component={HomeRedirect} />
        {isDevLoginEnabled() && <Route path="/admin-login" component={AdminLoginPage} />}
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />

        <Route path="/ihale-arama"><ProtectedRoute component={IhaleAramaPage} /></Route>
        <Route path="/ihale/:id"><ProtectedRoute component={IhaleDetayPage} /></Route>
        <Route path="/fiyatlandirma" component={FiyatlandirmaPage} />
        <Route path="/ayarlar"><ProtectedRoute component={AyarlarPage} /></Route>

        <Route path="/dashboard"><ProtectedRoute component={proGate(DashboardPage, { title: "Gösterge Paneli Pro'ya özeldir", description: "Eşleşmeleriniz, kazanma tahminleri ve performans özetiniz Pro planında." })} /></Route>
        <Route path="/firsatlarim"><ProtectedRoute component={proGate(FirsatlarimPage, { title: "Fırsatlarım Pro'ya özeldir", description: "Yapay zeka uygunluk skoruyla size en uygun ihaleleri görmek için Pro'ya geçin." })} /></Route>
        <Route path="/pipeline"><ProtectedRoute component={proGate(BoruHattiPage, { title: "Pipeline Pro'ya özeldir", description: "İhale sürecinizi aşamalara göre takip etmek için Pro'ya geçin." })} /></Route>
        <Route path="/raporlar"><ProtectedRoute component={proGate(RaporlarPage, { title: "Raporlar Pro'ya özeldir", description: "Başvuru performansı ve kategori raporlarınız için Pro planına geçin." })} /></Route>
        <Route path="/rakipler"><ProtectedRoute component={proGate(RakiplerPage, { title: "Rakip Analizi Pro'ya özeldir", description: "Rakiplerinizi, iskonto oranlarını ve ihale geçmişlerini görmek için Pro'ya geçin." })} /></Route>

        <Route path="/pazarlama"><AdminRoute component={PazarlamaPage} /></Route>
        <Route path="/pazarlama/icerik-uretici"><AdminRoute component={ContentGeneratorPage} /></Route>
        <Route path="/pazarlama/takvim"><AdminRoute component={ContentCalendarPage} /></Route>
        <Route path="/pazarlama/blog"><AdminRoute component={BlogAdminPage} /></Route>
        <Route path="/pazarlama/baglantilar"><AdminRoute component={SocialConnectionsPage} /></Route>

        <Route path="/admin"><AdminRoute component={AdminPage} /></Route>

        <Route path="/blog/:slug" component={BlogPostPage} />
        <Route path="/blog" component={BlogListPage} />

        <Route component={NotFound} />
      </Switch>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
      <Toaster richColors position="top-right" />
    </WouterRouter>
  );
}
