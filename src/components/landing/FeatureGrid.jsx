import { BellRing, Filter, Globe2, LineChart, Lock, Search, Share2, Target } from "lucide-react";
import SectionShell from "@/components/landing/SectionShell";

const FEATURES = [
  {
    icon: Globe2,
    title: "Country-level traffic",
    body: "Every visit is tagged with the country it came from, plotted on the live globe and listed with the page that country read most.",
  },
  {
    icon: BellRing,
    title: "Uptime monitoring",
    body: "Watch any URL and get an email within seconds of it going down — and again the moment it recovers.",
  },
  {
    icon: Filter,
    title: "Funnels",
    body: "See the exact step where visitors drop off, fix that page, and watch the conversions that follow.",
  },
  {
    icon: Target,
    title: "Goals & revenue",
    body: "Count signups, checkouts and purchases, with the revenue each one brought in.",
  },
  {
    icon: LineChart,
    title: "Realtime view",
    body: "A live visitor counter, a 30-minute chart and a feed of visits as they happen.",
  },
  {
    icon: Search,
    title: "Google Search Console",
    body: "Connect your Google account to see the exact keywords people search, plus clicks, impressions, CTR and your average Google rank, right beside your traffic.",
  },
  {
    icon: Share2,
    title: "Shareable dashboards",
    body: "Send clients or teammates a read-only link to your live dashboard, with no account needed.",
  },
  {
    icon: Lock,
    title: "Privacy-first",
    body: "No cookies and no personal data by default, so your site stays free of consent banners.",
  },
];

const POINTS = [
  ["1 line of code", "Paste the snippet and traffic starts flowing"],
  ["60 seconds", "From signup to your first live visit"],
  ["No cookie banner", "Anonymous data means no consent pop-up"],
];

export default function FeatureGrid() {
  return (
    <SectionShell
      id="about"
      title="What Data Board is"
      description="Data Board is lightweight, privacy-first website analytics. It shows which traffic pays, where visitors drop off and which countries they come from — all from one snippet of code, with no cookies and no personal data."
    >
      <div className="grid gap-6 sm:grid-cols-3">
          {POINTS.map(([value, label], index) => (
            <div key={value} className="gloss-card animate-fade-up rounded-2xl p-5 text-center" style={{ animationDelay: `${index * 90}ms` }}>
              <p className="font-heading text-xl font-semibold tracking-tight">{value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body, badge }, index) => (
            <div
              key={title}
              className="gloss-card sheen animate-fade-up rounded-2xl p-6"
              style={{ animationDelay: `${(index % 3) * 90}ms` }}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="font-heading text-base font-semibold tracking-tight">{title}</h3>
                {badge ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
      </div>
    </SectionShell>
  );
}