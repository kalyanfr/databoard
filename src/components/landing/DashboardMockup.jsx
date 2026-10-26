import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const STATS = [
  { label: "Visitors", value: "12,418", hint: "Unique people" },
  { label: "Pageviews", value: "31,207", hint: "2.5 per session" },
  { label: "Bounce rate", value: "39%", hint: "Left after one page" },
  { label: "Visit duration", value: "2m 6s", hint: "Avg. active time" },
  { label: "Revenue", value: "$18,240", hint: "From 212 customers" },
];

const SERIES = [
  { d: "10 Sep", v: 312 }, { d: "12 Sep", v: 358 }, { d: "14 Sep", v: 301 }, { d: "16 Sep", v: 388 },
  { d: "18 Sep", v: 421 }, { d: "20 Sep", v: 396 }, { d: "22 Sep", v: 472 }, { d: "24 Sep", v: 510 },
  { d: "26 Sep", v: 488 }, { d: "28 Sep", v: 561 }, { d: "30 Sep", v: 602 }, { d: "2 Oct", v: 589 },
  { d: "4 Oct", v: 671 }, { d: "6 Oct", v: 712 }, { d: "8 Oct", v: 758 },
];

const TABS = {
  Sources: {
    sub: "Channels · Referrers · Campaigns",
    rows: [["Google", "4,812", 39], ["Direct / None", "2,930", 24], ["X", "1,642", 13], ["Product Hunt", "1,118", 9], ["GitHub", "734", 6], ["Reddit", "402", 3]],
  },
  Pages: {
    sub: "Top pages · Entry · Exit",
    rows: [["/", "9,214", 74], ["/features", "4,861", 39], ["#about", "3,370", 27], ["/dashboard", "2,105", 17], ["#faq", "1,422", 11], ["/projects", "986", 8]],
  },
  Locations: {
    sub: "Countries · Cities",
    rows: [["United States", "4,207", 34], ["Germany", "1,982", 16], ["United Kingdom", "1,311", 11], ["Lithuania", "944", 8], ["Brazil", "731", 6], ["India", "612", 5]],
  },
  Devices: {
    sub: "Browser · OS · Screen",
    rows: [["Chrome", "7,201", 58], ["Safari", "3,105", 25], ["Firefox", "1,117", 9], ["Edge", "745", 6], ["Brave", "186", 1], ["Opera", "64", 1]],
  },
};

/** The product shot under the hero: a glossy, live-looking dashboard. */
export default function DashboardMockup() {
  const [tab, setTab] = useState("Sources");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  const active = TABS[tab];

  return (
    <div className="gloss-card sheen relative overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="font-heading text-sm font-semibold tracking-tight">databoard.in</span>
          <span className="text-xs text-muted-foreground">· Last 30 days</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground">
          <Filter className="h-3 w-3" /> Filter
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-border bg-border/60 sm:grid-cols-3 lg:grid-cols-5">
        {STATS.map((stat) => (
          <div key={stat.label} className="bg-card px-5 py-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</p>
            <p className="mt-1.5 font-heading text-xl font-semibold tracking-tight tabular-nums">{stat.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="px-5 pt-5">
        <div className="h-40">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={SERIES} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="mockupFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.42} />
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="d"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  interval={3}
                />
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill="url(#mockupFill)"
                  animationDuration={1400}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </div>

      <div className="px-5 pb-5 pt-2">
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(TABS).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-300",
                tab === name ? "bg-primary/12 text-primary shadow-[inset_0_1px_0_hsl(var(--glass-border)/0.5)]" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {name}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{active.sub}</p>

        <div className="mt-3 space-y-2.5">
          {active.rows.map((row, index) => (
            <div
              key={row[0]}
              className="animate-fade-up flex items-center justify-between gap-4 text-sm"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <span className="min-w-0 flex-1 truncate font-medium">{row[0]}</span>
              <span className="relative h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-muted sm:w-40">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-primary/70 transition-[width] duration-700"
                  style={{ width: `${row[2]}%` }}
                />
              </span>
              <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">{row[1]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}