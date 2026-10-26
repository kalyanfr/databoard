import { useState, useEffect } from "react";
import { EVENT_LABELS } from "@/lib/events";
import { formatNumber, relativeTime } from "@/lib/format";
import { countryName, flagUrl, normalizeCountryCode } from "@/lib/geo";

function countryToFlagEmoji(countryCode) {
  if (!countryCode || countryCode === "GL" || countryCode === "Unknown" || countryCode === "UNKNOWN") return "🌐";
  const code = countryCode.trim().toUpperCase();
  if (code.length !== 2) return "🌐";
  try {
    const codePoints = [...code].map((char) => 0x1f1a5 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return "🌐";
  }
}

function CountryFlagBadge({ code }) {
  const [imgError, setImgError] = useState(false);
  const normalized = normalizeCountryCode(code) || (code ? String(code).trim().toUpperCase() : "");
  const cleanCode = String(normalized || "").toUpperCase();
  const url = cleanCode && cleanCode !== "GL" && cleanCode !== "UNKNOWN" ? flagUrl(cleanCode, 40) : null;
  const name = countryName(cleanCode);

  if (!url || imgError) {
    return (
      <span
        title={name}
        className="inline-flex h-4 w-5 shrink-0 items-center justify-center text-sm leading-none select-none"
      >
        {countryToFlagEmoji(cleanCode)}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      title={name}
      width={20}
      height={14}
      onError={() => setImgError(true)}
      className="h-3.5 w-5 rounded-[3px] object-cover shadow-xs border border-border/40 shrink-0 inline-block"
      loading="lazy"
    />
  );
}

/** Newest pageviews and events, strictly column-aligned */
export default function ActivityFeed({ items = [], limit = 12 }) {
  const [nowMs, setNowMs] = useState(Date.now());

  // Keep relative timestamps ("just now", "12s ago") dynamically ticking in realtime
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 2000);
    return () => clearInterval(timer);
  }, []);

  const list = items.slice(0, limit);
  if (!list.length) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground">
        No activity recorded in this window yet.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {list.map((item, index) => {
        const isEvent = item.type === "event";
        const label = isEvent ? EVENT_LABELS[item.name] || item.name || "Event" : item.path || "/";
        return (
          <li
            key={item.id ?? `${label}-${index}`}
            className="animate-fade-up flex items-center justify-between gap-2.5 py-2 text-xs transition-colors hover:bg-muted/30 px-1 rounded-lg"
            style={{ animationDelay: `${index * 25}ms` }}
          >
            {/* Left: Flag + Path or Event Name */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <CountryFlagBadge code={item.country} />
              <span
                className="truncate font-semibold tracking-tight text-foreground text-xs"
                title={label}
              >
                {label}
              </span>
            </div>

            {/* Right: Badge & Fixed-Width Timestamp */}
            <div className="flex items-center gap-2 shrink-0">
              {isEvent && item.revenue ? (
                <span className="shrink-0 font-bold text-xs text-emerald-500 tabular-nums">
                  +${formatNumber(item.revenue)}
                </span>
              ) : null}

              {isEvent ? (
                <span className="shrink-0 rounded-md bg-muted/80 border border-border/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  EVENT
                </span>
              ) : (
                <span className="shrink-0 rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                  PAGE
                </span>
              )}

              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground w-12 text-right">
                {relativeTime(item.timestamp, nowMs)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
