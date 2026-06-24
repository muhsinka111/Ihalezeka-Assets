import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { ValueProps } from "@/components/landing/ValueProps";
import { Modules } from "@/components/landing/Modules";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { International } from "@/components/landing/International";
import { PricingSection } from "@/components/landing/PricingSection";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <ValueProps />
        <HowItWorks />
        <Modules />
        <International />
        <PricingSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
