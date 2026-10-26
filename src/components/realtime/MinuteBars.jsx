import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One slim bar per minute over the live window (Monochrome Black, Grey, White). */
export default function MinuteBars({ minutes = [], pageviews = 0, windowMinutes = 30 }) {
  const max = Math.max(1, ...minutes.map((bucket) => Number(bucket.pageviews) || 0));

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Last {windowMinutes} minutes
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="font-bold tabular-nums text-foreground">{formatNumber(pageviews)}</span>{" "}
          {pageviews === 1 ? "pageview" : "pageviews"}
        </p>
      </div>

      <div className="flex h-14 sm:h-16 items-end gap-[3px]">
        {minutes.map((bucket, index) => {
          const height = Math.max(4, ((Number(bucket.pageviews) || 0) / max) * 100);
          return (
            <div
              key={bucket.minute}
              className={cn(
                "flex-1 rounded-sm bg-primary/20 hover:bg-primary/40 transition-[height,background-color] duration-500",
                index === minutes.length - 1 && "bg-primary",
              )}
              style={{ height: `${height}%` }}
              title={`${String(bucket.minute).replace("T", " ")} UTC · ${formatNumber(bucket.pageviews)} pageview${
                bucket.pageviews === 1 ? "" : "s"
              }`}
            />
          );
        })}
      </div>

      <div className="flex justify-between pt-1.5 text-[10px] text-muted-foreground">
        <span>{windowMinutes} min ago</span>
        <span>now</span>
      </div>
    </div>
  );
}
