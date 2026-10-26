import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardMockup from "@/components/landing/DashboardMockup";

const PLATFORMS = ["WordPress", "Shopify", "Webflow", "Framer", "Wix", "Squarespace", "Next.js", "Any site"];

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Ambient gloss: two drifting gradient blooms plus a dotted grid. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora absolute -top-32 left-[8%] h-[420px] w-[420px] rounded-full bg-primary/25 blur-[110px]" />
        <div className="animate-aurora absolute -top-10 right-[4%] h-[380px] w-[380px] rounded-full bg-chart-4/20 blur-[110px] [animation-delay:2.5s]" />
        <div className="animate-aurora absolute top-40 left-1/3 h-[300px] w-[300px] rounded-full bg-chart-3/15 blur-[100px] [animation-delay:5s]" />
        <div className="bg-dot-grid-subtle mask-radial absolute inset-x-0 top-0 h-[440px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 pb-10 pt-16 text-center sm:pt-24">
        <span className="glass animate-fade-up inline-flex items-center gap-2 rounded-full border border-primary/20 px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> No cookies. No consent banner.
        </span>

        <h1 className="animate-fade-up mx-auto mt-6 max-w-3xl text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl [animation-delay:80ms]">
          Turn more visitors into <span className="text-gradient">customers</span>.
        </h1>

        <p className="animate-fade-up mx-auto mt-5 max-w-2xl text-balance text-base sm:text-lg text-muted-foreground [animation-delay:160ms]">
          User-friendly analytics that show which traffic pays, where visitors drop off and what to fix to get more
          customers.
        </p>

        <div className="animate-fade-up mx-auto mt-8 flex max-w-md items-center gap-2 rounded-2xl border border-primary/15 bg-card/80 p-1.5 shadow-gloss backdrop-blur [animation-delay:240ms]">
          <div className="flex-1 px-3 text-left text-sm text-muted-foreground">
            <span className="font-medium text-foreground">yourwebsite.com</span>
          </div>
          <Button asChild className="sheen rounded-xl shadow-glow">
            <a href="#pricing">
              <span className="min-[360px]:hidden">Get started</span><span className="hidden min-[360px]:inline">Get Lifetime Deal ($5)</span> <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">Works on any platform</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground/80">
          {PLATFORMS.map((platform) => (
            <span key={platform} className="transition-colors hover:text-foreground">
              {platform}
            </span>
          ))}
        </div>
      </div>

      <div className="animate-fade-up relative mx-auto max-w-5xl px-5 pb-20 [animation-delay:320ms]">
        <DashboardMockup />
      </div>
    </section>
  );
}