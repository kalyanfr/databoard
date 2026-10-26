import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/format";
import { prettyDay } from "@/lib/ranges";

const TRAFFIC_SERIES = [
  { id: "visitors", key: "visitors", label: "Visitors", color: "hsl(var(--chart-1))" },
  { id: "pageviews", key: "pageviews", label: "Pageviews", color: "hsl(var(--chart-2))" },
];

export const trafficSeries = TRAFFIC_SERIES;

export default function TrendChart({ data = [], series = TRAFFIC_SERIES }) {
  return (
    <div className="h-[260px] w-full sm:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <defs>
            {series.map((item) => (
              <linearGradient key={item.id} id={`fill-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={item.color} stopOpacity={0.38} />
                <stop offset="100%" stopColor={item.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tickFormatter={prettyDay}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={24}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            width={44}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          />
          <Tooltip cursor={{ stroke: "hsl(var(--border))" }} content={<ChartTooltip series={series} />} />
          {series.map((item) => (
            <Area
              key={item.id}
              type="monotone"
              dataKey={item.key}
              stroke={item.color}
              strokeWidth={2}
              fill={`url(#fill-${item.id})`}
              dot={false}
              activeDot={{ r: 3 }}
              animationDuration={1100}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({ active, payload, label, series }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl border border-border px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-medium">{prettyDay(label)}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="flex items-center justify-between gap-6 text-xs text-muted-foreground">
          <span>{series.find((entry) => entry.key === item.dataKey)?.label ?? item.dataKey}</span>
          <span className="font-medium tabular-nums text-foreground">{formatNumber(item.value)}</span>
        </p>
      ))}
    </div>
  );
}