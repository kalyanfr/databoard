import { useState, useEffect } from "react";
import LandingNav from "@/components/landing/LandingNav";
import Hero from "@/components/landing/Hero";
import Steps from "@/components/landing/Steps";
import FeatureGrid from "@/components/landing/FeatureGrid";
import SnippetSection from "@/components/landing/SnippetSection";
import Faq from "@/components/landing/Faq";
import SupportSection from "@/components/landing/SupportSection";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, Loader2, ShieldCheck, Bot, Globe, Zap } from "lucide-react";

export default function Home() {
  const [checkingOut, setCheckingOut] = useState(false);

  // The public page always renders light, whatever the dashboard preference is.
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  const handleBuyLifetime = async () => {
    setCheckingOut(true);
    try {
      const res = await fetch("/api/dodoCheckout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error(data.error || "Failed to initialize checkout.");
      }
    } catch (err) {
      alert(err.message || "Failed to launch Dodo Payments checkout. Please try again.");
      setCheckingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main>
        <Hero />
        <Steps />
        <FeatureGrid />
        <SnippetSection />
        <div aria-hidden="true" className="bg-dot-grid-subtle mask-fade-y h-10" />
        <Faq />
        <SupportSection />

        {/* $5 Lifetime Deal Pricing Section */}
        <section id="pricing" className="relative overflow-hidden bg-primary text-primary-foreground py-20 sm:py-24">
          <div aria-hidden="true" className="bg-dot-grid pointer-events-none absolute inset-0" />
          <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
            <div className="text-center space-y-4 mb-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>Special Lifetime Deal · No Monthly Subscriptions</span>
              </div>
              <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-5xl text-white">
                Pay once. Track forever.
              </h2>
              <p className="mx-auto max-w-xl text-primary-foreground/80 text-sm sm:text-base leading-relaxed">
                Get full access to real-time analytics, uptime monitors, and AI MCP integration for Claude &amp; Cursor with a single $5 payment.
              </p>
            </div>

            {/* Pricing Card */}
            <div className="mx-auto max-w-lg rounded-3xl border border-white/20 bg-card p-6 sm:p-8 text-card-foreground shadow-2xl space-y-6">
              <div className="flex items-baseline justify-between border-b border-border/80 pb-5">
                <div>
                  <h3 className="font-heading text-xl font-bold text-foreground">Lifetime Pro</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Everything indie founders need</p>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline gap-1">
                    <span className="font-heading text-4xl font-extrabold text-foreground">$5</span>
                    <span className="text-xs text-muted-foreground uppercase font-semibold">one-time</span>
                  </div>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium block">Lifetime access</span>
                </div>
              </div>

              {/* Feature Checklist */}
              <ul className="space-y-3 text-xs sm:text-sm">
                <li className="flex items-start gap-2.5">
                  <div className="rounded-full bg-blue-500/10 p-0.5 text-blue-600 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <span><strong>100% Real-Time Tracking</strong> with interactive 3D Globe telemetry</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="rounded-full bg-blue-500/10 p-0.5 text-blue-600 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <span><strong>Claude Desktop, Cursor &amp; ChatGPT MCP Server</strong> access included</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="rounded-full bg-blue-500/10 p-0.5 text-blue-600 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <span>Up to <strong>2 Websites &amp; 25,000 monthly pageviews</strong></span>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="rounded-full bg-blue-500/10 p-0.5 text-blue-600 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <span><strong>60-day rolling data retention</strong> &amp; custom conversion goals</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="rounded-full bg-blue-500/10 p-0.5 text-blue-600 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <span><strong>Uptime &amp; Incident Monitoring</strong> with instant response check</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="rounded-full bg-blue-500/10 p-0.5 text-blue-600 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <span>Zero-cookie, lightweight script (&lt; 1KB), 100% GDPR compliant</span>
                </li>
              </ul>

              {/* Purchase Button */}
              <div className="pt-2">
                <Button
                  onClick={handleBuyLifetime}
                  disabled={checkingOut}
                  size="lg"
                  className="w-full h-12 text-sm sm:text-base font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-glow gap-2"
                >
                  {checkingOut ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Redirecting to Dodo Payments...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 fill-current" />
                      <span>Get Lifetime Access — $5 Only</span>
                    </>
                  )}
                </Button>
                <p className="text-center text-[11px] text-muted-foreground mt-2.5 flex items-center justify-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Secure checkout powered by Dodo Payments. Instant account activation.</span>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
