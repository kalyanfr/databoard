import { Activity, CheckCircle2, Gauge, ShieldAlert } from "lucide-react";
import StatCard from "@/components/common/StatCard";
import { formatNumber } from "@/lib/format";

/** Headline numbers for a set of monitors. */
export default function UptimeStats({ monitors }) {
  const up = monitors.filter((monitor) => monitor.status === "up").length;
  const down = monitors.filter((monitor) => monitor.status === "down").length;
  const paused = monitors.filter((monitor) => monitor.status === "paused").length;
  const responses = monitors
    .map((monitor) => Number(monitor.last_response_ms))
    .filter((value) => Number.isFinite(value) && value > 0);
  const average = responses.length
    ? `${Math.round(responses.reduce((total, value) => total + value, 0) / responses.length)} ms`
    : "—";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Monitors" value={formatNumber(monitors.length)} hint={`${paused} paused`} icon={Activity} tone="violet" />
      <StatCard label="Up right now" value={formatNumber(up)} hint="Answering normally" icon={CheckCircle2} tone="teal" />
      <StatCard label="Down right now" value={formatNumber(down)} hint="Alert already sent" icon={ShieldAlert} tone="pink" />
      <StatCard label="Avg response" value={average} hint="Latest check per monitor" icon={Gauge} tone="blue" delay={90} />
    </div>
  );
}