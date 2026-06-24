import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header 
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-background/80 backdrop-blur-lg border-b border-border shadow-sm py-3" : "bg-transparent py-5"
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="container mx-auto px-6 md:px-12 flex items-center justify-between">
        <div className="flex items-center">
          <img src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.svg?v=2`} alt="İhaleZeka" className="h-8 md:h-9 w-auto" />
        </div>
        
        <nav className="hidden md:flex items-center gap-8 font-medium text-sm text-muted-foreground">
          <a href="#moduller" className="hover:text-foreground transition-colors">Modüller</a>
          <a href="#fiyatlandirma" className="hover:text-foreground transition-colors">Fiyatlandırma</a>
        </nav>

        <div className="flex items-center gap-3 md:gap-4">
          <Link href="/sign-in">
            <Button variant="ghost" className="font-semibold hidden sm:inline-flex">Giriş Yap</Button>
          </Link>
          <Link href="/sign-up">
            <Button className="font-semibold shadow-md">Hemen Başla</Button>
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
