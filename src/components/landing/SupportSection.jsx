import { Link } from "react-router-dom";
import { LifeBuoy, Mail, Activity, ArrowRight, Clock, ShieldCheck } from "lucide-react";
import SectionShell from "@/components/landing/SectionShell";
import { Button } from "@/components/ui/button";

export default function SupportSection() {
  return (
    <SectionShell
      id="support"
      eyebrow="Help & Support"
      title="World-class support whenever you need it."
      description="Whether you have questions before getting started or need help with custom events, our team is here for you."
      tone="muted"
    >
      <div className="grid gap-6 md:grid-cols-3">
        {/* Card 1: Ticket Support */}
        <div className="gloss-card relative flex flex-col justify-between overflow-hidden rounded-3xl p-6 sm:p-8 transition-all duration-300 hover:shadow-glow">
          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LifeBuoy className="h-6 w-6 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground">
                In-App Support Desk
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Submit tickets directly to our engineering team. We help debug scripts, configure goals, and optimize your tracking.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Clock className="h-3.5 w-3.5" />
              <span>Average response under 2 hours</span>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-border/60">
            <Button asChild variant="outline" className="w-full justify-between rounded-xl group">
              <Link to="/support">
                <span>Open Support Desk</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Card 2: Email Support */}
        <div className="gloss-card relative flex flex-col justify-between overflow-hidden rounded-3xl p-6 sm:p-8 transition-all duration-300 hover:shadow-glow">
          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-chart-1/10 text-chart-1">
              <Mail className="h-6 w-6 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground">
                Direct Email Inquiries
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Have pre-sales questions, custom contract requirements, or feedback? Reach our founders and engineers directly.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span>Direct founder & engineer inbox</span>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-border/60">
            <Button asChild variant="outline" className="w-full justify-between rounded-xl group">
              <a href="mailto:support@databoard.in">
                <span>support@databoard.in</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
          </div>
        </div>

        {/* Card 3: Uptime & Live Status */}
        <div className="gloss-card relative flex flex-col justify-between overflow-hidden rounded-3xl p-6 sm:p-8 transition-all duration-300 hover:shadow-glow">
          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-chart-4/10 text-chart-4">
              <Activity className="h-6 w-6 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground">
                Live System Status
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Check our live infrastructure and global tracking ingestion health. 99.99% operational uptime across all edge locations.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>All systems fully operational</span>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-border/60">
            <Button asChild variant="outline" className="w-full justify-between rounded-xl group">
              <Link to="/uptime">
                <span>Check Live Status</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
