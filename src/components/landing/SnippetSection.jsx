import SectionShell from "@/components/landing/SectionShell";

const CAPTURED = [
  ["Pageviews", "Every page, with the country and device behind it"],
  ["Traffic sources", "Referrer, channel, campaign and UTM tags"],
  ["Outbound links", "Which partner or ad a visitor clicked to leave"],
  ["File downloads", "Brochures, PDFs and press kits that got taken"],
  ["Form submissions", "Which form was sent, without storing the answers"],
  ["Scroll depth", "How far down the page people actually read"],
  ["Engaged time", "Time actively spent on the page, not just opened"],
  ["Money events", "Signups, checkouts and the revenue they brought"],
];

export default function SnippetSection() {
  return (
    <SectionShell
      id="data"
      eyebrow="One line of code"
      title="See exactly what the snippet collects."
      description="Nothing is hidden and nothing personal is stored. Add one line, and every item below starts arriving in your dashboard."
      tone="muted"
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <div className="grid gap-3 sm:grid-cols-2">
          {CAPTURED.map(([title, body], index) => (
            <div
              key={title}
              className="gloss-card animate-fade-up rounded-2xl p-4"
              style={{ animationDelay: `${(index % 4) * 70}ms` }}
            >
              <p className="font-heading text-sm font-semibold tracking-tight">{title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <div className="gloss-card animate-fade-up rounded-3xl p-6 [animation-delay:120ms]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Add your own data</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Send anything your product already knows — a plan name, an order value, the trial that started.
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
            <div>
              <span className="text-foreground">databoard</span>("signup", {"{"} plan: "pro" {"}"});
            </div>
            <div className="mt-1">
              <span className="text-foreground">databoard</span>("purchase", {"{"} revenue: 49 {"}"});
            </div>
            <div className="mt-3 text-muted-foreground/80">// one line each — no SDK, no build step</div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["Under 3 KB", "Never slows your site"],
              ["No cookies", "No consent banner needed"],
              ["Any platform", "Script tag is enough"],
            ].map(([value, label]) => (
              <div key={value} className="rounded-2xl border border-border bg-background/60 p-3">
                <p className="font-heading text-sm font-semibold tracking-tight">{value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}