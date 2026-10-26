import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  violet: "text-primary",
  teal: "text-chart-2",
  amber: "text-chart-3",
  pink: "text-chart-4",
  blue: "text-blue-600 dark:text-blue-400",
};

/** Counts a numeric string up from zero the first time it renders. */
function useCountUp(value) {
  const text = String(value ?? "").trim();
  const numeric = /^[0-9][0-9.,]*$/.test(text) ? Number(text.replace(/,/g, "")) : null;
  const [display, setDisplay] = useState(value);
  const done = useRef(false);

  useEffect(() => {
    if (done.current || numeric === null) return;
    done.current = true;
    const duration = 900;
    const start = performance.now();
    let frame = 0;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = numeric * eased;
      setDisplay(String(value).replace(/[\d.,]+/, (match) => {
        const decimals = /\.\d/.test(match) ? 1 : 0;
        return current.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      }));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [numeric, value]);

  return numeric === null ? value : display;
}

export default function StatCard({ label, value, hint, icon: Icon, tone = "violet", delay = 0 }) {
  const shown = useCountUp(value);
  return (
    <div
      className="gloss-card sheen animate-fade-up rounded-2xl p-3 sm:p-5 flex flex-col justify-between w-full min-w-0 max-w-full overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-1 sm:gap-3 min-w-0">
        <p className="truncate text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.06em] sm:tracking-[0.1em] text-muted-foreground">
          {label}
        </p>
        {Icon ? (
          <span className="relative inline-flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-muted/70">
            <Icon className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", TONES[tone] ?? TONES.violet)} />
          </span>
        ) : null}
      </div>
      <div className="mt-2 sm:mt-3 min-w-0">
        <p className="font-heading text-lg sm:text-2xl font-semibold leading-none tracking-tight tabular-nums truncate">
          {shown}
        </p>
        {hint ? (
          <p className="mt-1 sm:mt-2 truncate text-[10px] sm:text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
