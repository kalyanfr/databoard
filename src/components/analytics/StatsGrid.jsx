import { DollarSign, Eye, Gauge, MousePointerClick, Repeat, Sparkles, Target, Timer, Users, Zap } from "lucide-react";
import StatCard from "@/components/common/StatCard";
import { formatCurrency, formatDuration, formatNumber, formatPercent } from "@/lib/format";

export default function StatsGrid({ totals = {} }) {
  const cards = [
    { label: "Visitors", value: formatNumber(totals.visitors), hint: "Unique visitors", icon: Users, tone: "violet" },
    { label: "Pageviews", value: formatNumber(totals.pageviews), hint: "Pages viewed", icon: Eye, tone: "teal" },
    { label: "Sessions", value: formatNumber(totals.sessions), hint: "Visits (30 min window)", icon: Repeat, tone: "blue" },
    {
      label: "Bounce rate",
      value: formatPercent(totals.bounceRate, 0),
      hint: "Single-page sessions",
      icon: MousePointerClick,
      tone: "amber",
    },
    {
      label: "Avg. session",
      value: formatDuration(totals.avgDuration),
      hint: "Time on site",
      icon: Timer,
      tone: "pink",
    },
    { label: "Conversions", value: formatNumber(totals.conversions), hint: "Tracked events", icon: Target, tone: "violet" },
    { label: "Revenue", value: formatCurrency(totals.revenue), hint: "From event properties", icon: DollarSign, tone: "teal" },
    {
      label: "Pages / visit",
      value: totals.sessions ? (totals.pageviews / totals.sessions).toFixed(1) : "0.0",
      hint: "Depth of visit",
      icon: Sparkles,
      tone: "blue",
    },
    {
      label: "Scroll depth",
      value: totals.avgScrollDepth == null ? "—" : formatPercent(totals.avgScrollDepth / 100, 0),
      hint: "Average reading depth",
      icon: Gauge,
      tone: "violet",
    },
    {
      label: "Engaged time",
      value: totals.avgEngaged == null ? "—" : formatDuration(Math.round(totals.avgEngaged)),
      hint: "Active time on page",
      icon: Zap,
      tone: "amber",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <StatCard key={card.label} {...card} delay={index * 70} />
      ))}
    </div>
  );
}