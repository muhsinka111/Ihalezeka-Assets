import React, { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useAuth, useClerk, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AppShell } from "@/components/AppShell";
import { AuthLayout } from "@/components/AuthLayout";
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
import NotFound from "@/pages/not-found";
import { RequirePro } from "@/components/PaywallOverlay";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  baseTheme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "none" as const,
    logoLinkUrl: basePath || "/",
  },
  variables: {
    colorPrimary: "#2D5BFF",
    colorForeground: "hsl(222 47% 11%)",
    colorMutedForeground: "hsl(215 16% 47%)",
    colorDanger: "hsl(0 72% 51%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(214 32% 91%)",
    colorInputForeground: "hsl(222 47% 11%)",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none border-0 bg-transparent rounded-none p-0",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none !p-0",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-slate-900 font-heading text-2xl font-bold",
    headerSubtitle: "text-slate-500 text-sm",
    formButtonPrimary:
      "bg-[#2D5BFF] text-white hover:bg-[#1E45D6] rounded-lg font-semibold h-11 text-sm shadow-sm",
    formFieldInput:
      "border-[#e2e8f0] bg-[#f8fafc] text-slate-900 rounded-lg h-10 text-sm placeholder:text-slate-300",
    formFieldLabel: "text-sm font-medium text-slate-700",
    footerActionLink: "text-[#2D5BFF] hover:text-[#1E45D6] font-semibold",
    footerAction: "bg-transparent",
    dividerText: "text-slate-400 text-xs",
    dividerLine: "bg-slate-200",
    socialButtonsBlockButton:
      "border-[#e2e8f0] bg-[#f8fafc] text-slate-700 hover:bg-slate-100 rounded-lg h-10 text-sm font-medium",
    alert: "bg-destructive/10 border-destructive/20 text-destructive",
    identityPreviewText: "text-slate-700",
    identityPreviewEditButton: "text-[#2D5BFF]",
  },
};

function SignInPage() {
  return (
    <AuthLayout>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </AuthLayout>
  );
}

function SignUpPage() {
  return (
    <AuthLayout>
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        forceRedirectUrl={`${basePath}/ayarlar?tab=sirket`}
      />
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
 * Production ProtectedRoute: enforces Clerk auth and redirects unauthenticated
 * users to /sign-in. Signed-in users without a company profile are nudged to
 * the wizard (unless they are already on it or explicitly skipped it this session).
 */
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <AppShell>
          <Component />
        </AppShell>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

/**
 * Route guard for admin-only pages. Requires Clerk auth + admin status.
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

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

/**
 * Watches for a newly signed-in user with no company profile and redirects them
 * to the wizard — unless they have explicitly skipped it this browser session or
 * already have a profile. The skip flag is persisted in localStorage per user so
 * it survives page refreshes but resets if the user signs out and back in as a
 * different account.
 */
function FirstVisitRedirect() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [, navigate] = useLocation();
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || hasCheckedRef.current) return;

    const currentPath = window.location.pathname.replace(basePath, "") || "/";
    if (currentPath === "/ayarlar" || currentPath.startsWith("/sign-")) return;

    const skipKey = `ihale_onboarding_skipped_${userId}`;
    if (localStorage.getItem(skipKey)) return;

    hasCheckedRef.current = true;

    fetch(`${API_BASE}/company-profile`, { credentials: "include" })
      .then((res) => {
        if (res.status === 404) {
          navigate("/ayarlar?tab=sirket");
        }
      })
      .catch(() => {});
  }, [isLoaded, isSignedIn, userId, navigate]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey!}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Hoş Geldiniz", subtitle: "Hesabınıza giriş yapın" } },
        signUp: { start: { title: "Hesap Oluşturun", subtitle: "Hemen kullanmaya başlayın" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <FirstVisitRedirect />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />

          <Route path="/ihale-arama"><ProtectedRoute component={IhaleAramaPage} /></Route>
          <Route path="/ihale/:id"><ProtectedRoute component={IhaleDetayPage} /></Route>
          <Route path="/fiyatlandirma"><ProtectedRoute component={FiyatlandirmaPage} /></Route>
          <Route path="/ayarlar"><ProtectedRoute component={AyarlarPage} /></Route>

          <Route path="/dashboard"><ProtectedRoute component={proGate(DashboardPage, { title: "Gösterge Paneli Pro'ya özeldir", description: "Eşleşmeleriniz, kazanma tahminleri ve performans özetiniz Pro planında." })} /></Route>
          <Route path="/firsatlarim"><ProtectedRoute component={proGate(FirsatlarimPage, { title: "Fırsatlarım Pro'ya özeldir", description: "Yapay zeka uygunluk skoruyla size en uygun ihaleleri görmek için Pro'ya geçin." })} /></Route>
          <Route path="/boru-hatti"><ProtectedRoute component={proGate(BoruHattiPage, { title: "Boru Hattı Pro'ya özeldir", description: "İhale sürecinizi aşamalara göre takip etmek için Pro'ya geçin." })} /></Route>
          <Route path="/raporlar"><ProtectedRoute component={proGate(RaporlarPage, { title: "Raporlar Pro'ya özeldir", description: "Başvuru performansı ve kategori raporlarınız için Pro planına geçin." })} /></Route>

          <Route path="/pazarlama"><AdminRoute component={PazarlamaPage} /></Route>
          <Route path="/pazarlama/icerik-uretici"><AdminRoute component={ContentGeneratorPage} /></Route>
          <Route path="/pazarlama/takvim"><AdminRoute component={ContentCalendarPage} /></Route>
          <Route path="/pazarlama/blog"><AdminRoute component={BlogAdminPage} /></Route>
          <Route path="/pazarlama/baglantilar"><AdminRoute component={SocialConnectionsPage} /></Route>

          <Route path="/admin"><AdminRoute component={AdminPage} /></Route>

          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
      <Toaster richColors position="top-right" />
    </WouterRouter>
  );
}
