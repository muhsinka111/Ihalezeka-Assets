import React, { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useAuth, useClerk, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";

import LandingPage from "@/pages/landing";
import DashboardPage from "@/pages/dashboard";
import FirsatlarimPage from "@/pages/firsatlarim";
import IhaleDetayPage from "@/pages/ihale-detay";
import BasvuruSihirbazPage from "@/pages/basvuru-sihirbazi";
import TeklifOlusturucuPage from "@/pages/teklif-olusturucu";
import IhaleAramaPage from "@/pages/ihale-arama";
import BoruHattiPage from "@/pages/boru-hatti";
import RakipAnaliziPage from "@/pages/rakip-analizi";
import ParaAkisiPage from "@/pages/para-akisi";
import BelgelerimPage from "@/pages/belgelerim";
import RaporlarPage from "@/pages/raporlar";
import EntegrasyonlarPage from "@/pages/entegrasyonlar";
import PazarlamaPage from "@/pages/pazarlama/index";
import ContentGeneratorPage from "@/pages/pazarlama/content-generator";
import ContentCalendarPage from "@/pages/pazarlama/content-calendar";
import BlogAdminPage from "@/pages/pazarlama/blog";
import SocialConnectionsPage from "@/pages/pazarlama/social-connections";
import FiyatlandirmaPage from "@/pages/fiyatlandirma";
import NotFound from "@/pages/not-found";
import { RequirePro } from "@/components/PaywallOverlay";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  baseTheme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#2C46D8",
    colorForeground: "hsl(222 47% 11%)",
    colorMutedForeground: "hsl(215 16% 47%)",
    colorDanger: "hsl(0 72% 51%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(214 32% 91%)",
    colorInputForeground: "hsl(222 47% 11%)",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.875rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-card rounded-2xl w-[440px] max-w-full overflow-hidden border border-border shadow-md",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-heading",
    headerSubtitle: "text-muted-foreground",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90 rounded-md font-medium",
    formFieldInput: "border-input bg-background text-foreground rounded-md",
    footerActionLink: "text-primary hover:text-primary/90 font-medium",
    footerAction: "bg-secondary/30",
    alert: "bg-destructive/10 border-destructive/20 text-destructive",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();

  // Redirect signed-in users straight to tender search — the product's hero
  // experience — once Clerk confirms auth state. Until then (loading) or for
  // signed-out users, show the public landing page immediately so the page is
  // never blank in the preview pane.
  if (isLoaded && isSignedIn) {
    return <Redirect to="/ihale-arama" />;
  }

  return <LandingPage />;
}

// DEV BYPASS: auth check skipped until project is ready for production.
// To re-enable, replace the body with the commented-out block below.
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <AppShell>
      <Component />
    </AppShell>
  );
}
// PRODUCTION version (restore when ready):
// function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
//   return (
//     <>
//       <Show when="signed-in"><AppShell><Component /></AppShell></Show>
//       <Show when="signed-out"><Redirect to="/sign-in" /></Show>
//     </>
//   );
// }

// Wrap a premium-only page in the Pro full-page gate. Free users see an upgrade
// screen (inside the AppShell); Pro users see the real page.
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
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />

          <Route path="/ihale-arama"><ProtectedRoute component={IhaleAramaPage} /></Route>
          <Route path="/ihale/:id"><ProtectedRoute component={IhaleDetayPage} /></Route>
          <Route path="/fiyatlandirma"><ProtectedRoute component={FiyatlandirmaPage} /></Route>
          <Route path="/belgelerim"><ProtectedRoute component={BelgelerimPage} /></Route>
          <Route path="/entegrasyonlar"><ProtectedRoute component={EntegrasyonlarPage} /></Route>
          <Route path="/basvuru-sihirbazi"><ProtectedRoute component={BasvuruSihirbazPage} /></Route>

          <Route path="/dashboard"><ProtectedRoute component={proGate(DashboardPage, { title: "Gösterge Paneli Pro'ya özeldir", description: "Eşleşmeleriniz, kazanma tahminleri ve performans özetiniz Pro planında." })} /></Route>
          <Route path="/firsatlarim"><ProtectedRoute component={proGate(FirsatlarimPage, { title: "Fırsatlarım Pro'ya özeldir", description: "Yapay zeka uygunluk skoruyla size en uygun ihaleleri görmek için Pro'ya geçin." })} /></Route>
          <Route path="/teklif-olusturucu"><ProtectedRoute component={proGate(TeklifOlusturucuPage, { title: "Teklif Oluşturucu Pro'ya özeldir", description: "Yapay zeka destekli teklif taslakları oluşturmak için Pro planına geçin." })} /></Route>
          <Route path="/boru-hatti"><ProtectedRoute component={proGate(BoruHattiPage, { title: "Boru Hattı Pro'ya özeldir", description: "İhale sürecinizi aşamalara göre takip etmek için Pro'ya geçin." })} /></Route>
          <Route path="/rakip-analizi"><ProtectedRoute component={proGate(RakipAnaliziPage, { title: "Rakip Analizi Pro'ya özeldir", description: "Rakiplerinizin kazandığı ihaleleri ve stratejilerini görmek için Pro'ya geçin." })} /></Route>
          <Route path="/para-akisi"><ProtectedRoute component={proGate(ParaAkisiPage, { title: "Para Akışı Pro'ya özeldir", description: "Aylık nakit akışı, kategori ve idare bazlı analizler için Pro'ya geçin." })} /></Route>
          <Route path="/raporlar"><ProtectedRoute component={proGate(RaporlarPage, { title: "Raporlar Pro'ya özeldir", description: "Başvuru performansı ve kategori raporlarınız için Pro planına geçin." })} /></Route>

          <Route path="/pazarlama"><ProtectedRoute component={PazarlamaPage} /></Route>
          <Route path="/pazarlama/icerik-uretici"><ProtectedRoute component={ContentGeneratorPage} /></Route>
          <Route path="/pazarlama/takvim"><ProtectedRoute component={ContentCalendarPage} /></Route>
          <Route path="/pazarlama/blog"><ProtectedRoute component={BlogAdminPage} /></Route>
          <Route path="/pazarlama/baglantilar"><ProtectedRoute component={SocialConnectionsPage} /></Route>

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
