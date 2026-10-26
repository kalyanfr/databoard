import { useEffect } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Sparkles, ArrowRight, Bot, Globe, ShieldCheck, Mail } from "lucide-react";
import BrandMark from "@/components/layout/BrandMark";
import { Button } from "@/components/ui/button";

export default function PaymentSuccess() {
  useEffect(() => {
    document.title = "Payment Successful — Lifetime Pro Activated | Data Board";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased selection:bg-primary/20">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 sm:h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark className="h-7 w-7 sm:h-8 sm:w-8" />
            <span className="font-heading text-base sm:text-lg font-bold tracking-tight text-foreground">
              Data Board
            </span>
          </Link>
          <Button asChild size="sm" className="sheen rounded-xl shadow-glow text-xs font-semibold px-4">
            <Link to="/login">Sign in &rarr;</Link>
          </Button>
        </div>
      </header>

      {/* Main Success Container */}
      <main className="relative flex-1 overflow-x-hidden flex items-center justify-center py-12 px-4 sm:px-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-aurora absolute -top-32 left-[20%] h-[320px] w-[320px] rounded-full bg-emerald-500/10 blur-[100px]" />
          <div className="animate-aurora absolute -top-10 right-[15%] h-[280px] w-[280px] rounded-full bg-blue-500/10 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-lg w-full text-center space-y-6">
          {/* Success Icon */}
          <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-emerald-500/15 animate-ping opacity-75" />
            <div className="relative rounded-full bg-emerald-500/20 border border-emerald-500/30 p-3 sm:p-4 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12" />
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Lifetime Pro Deal Confirmed</span>
            </div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Welcome to Data Board Pro!
            </h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Your $5 one-time payment was successful. Your account has been permanently upgraded to <strong>Lifetime Pro</strong> with no monthly subscriptions.
            </p>
          </div>

          {/* Benefits Card */}
          <div className="rounded-2xl border border-border bg-card p-5 text-left space-y-3.5 shadow-sm">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider block">
              Unlocked with your Lifetime Pro:
            </span>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2 text-foreground font-medium">
                <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>100% Real-time visitor tracking &amp; 3D globe telemetry</span>
              </li>
              <li className="flex items-center gap-2 text-foreground font-medium">
                <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Claude Desktop, Cursor &amp; ChatGPT MCP Integration</span>
              </li>
              <li className="flex items-center gap-2 text-foreground font-medium">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Zero-cookie, privacy-first GDPR/CCPA compliant tracking</span>
              </li>
              <li className="flex items-center gap-2 text-foreground font-medium">
                <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Login credentials &amp; welcome details sent to your email</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button asChild size="lg" className="w-full sm:w-auto h-11 text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl px-6 gap-2">
              <Link to="/login">
                <span>Go to Login / Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto h-11 text-xs sm:text-sm rounded-xl px-5">
              <Link to="/">Back to Homepage</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
