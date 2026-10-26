import { Filter, LineChart, Plug, TrendingUp } from "lucide-react";
import SectionShell from "@/components/landing/SectionShell";

export default function Steps() {
  return (
    <SectionShell
      id="features"
      tone="muted"
      eyebrow="How it works"
      title="Connect, track, fix."
      description="See every visitor and sale, find the step where people drop off, and fix it."
    >
      <div className="grid gap-6 lg:grid-cols-3">
          <StepCard
            n="1"
            icon={Plug}
            title="Connect"
            body="Connect your site in a minute. Add your website and paste one line of code. Works on any platform."
            delay={0}
          >
            <CodeVisual />
          </StepCard>
          <StepCard
            n="2"
            icon={LineChart}
            title="Track"
            body="See every visit and sale. Where each visitor came from, what they read and whether they bought. Live, with no cookie banner."
            delay={110}
          >
            <PagesVisual />
          </StepCard>
          <StepCard
            n="3"
            icon={Filter}
            title="Fix"
            body="Fix what costs you customers. Funnels show the step where people drop off. Fix it and watch sales climb."
            delay={220}
          >
            <FunnelVisual />
          </StepCard>
      </div>
    </SectionShell>
  );
}

function StepCard({ n, icon: Icon, title, body, children, delay }) {
  return (
    <div className="gloss-card sheen animate-fade-up rounded-3xl p-6" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Step {n}</span>
      </div>
      <h3 className="mt-4 font-heading text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function CodeVisual() {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
      <span className="text-foreground">&lt;script</span> defer src="/t.js"<br />
      <span className="text-foreground">&nbsp;&nbsp;data-site</span>="yourwebsite.com"&gt;&lt;/script&gt;
    </div>
  );
}

function PagesVisual() {
  const rows = [["/", "9,214"], ["#features", "4,861"], ["/dashboard", "3,370"], ["#faq", "2,105"]];
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Top pages · yourwebsite.com
      </p>
      <div className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <div key={row[0]} className="flex items-center justify-between rounded-lg px-1 py-1 text-sm">
            <span className="font-medium">{row[0]}</span>
            <span className="tabular-nums text-muted-foreground">{row[1]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FunnelVisual() {
  const steps = [["Pricing", 100], ["Checkout", 46], ["Paid", 13]];
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step[0]} className="flex items-center gap-2">
            <div
              className="h-7 rounded-lg bg-gradient-to-r from-primary/25 to-primary/60 transition-[width] duration-700"
              style={{ width: `${step[1]}%` }}
            />
            <span className="text-xs font-medium">{step[0]}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-foreground">
        <TrendingUp className="h-3.5 w-3.5 text-primary" /> Fixed /pricing · Sales +41%
      </p>
    </div>
  );
}