import { useState } from "react";
import {
  Download,
  Sparkles,
  Bot,
  Search,
  Share2,
  Compass,
  Mail,
  DollarSign,
  ExternalLink,
  Globe,
  Target,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "@/lib/format";
import { exportBreakdownCsv } from "@/lib/exportCsv";
import { flagEmoji, countryName } from "@/lib/geo";

function SourceFavicon({ domain }) {
  const [failed, setFailed] = useState(false);
  const clean = String(domain || "").toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  const isDirect = clean === "direct" || clean === "direct/none" || clean === "unknown" || !clean;

  if (isDirect) {
    return <Compass className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }

  if (failed) {
    return <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(clean)}&sz=32`}
      alt=""
      className="h-3.5 w-3.5 shrink-0 rounded-xs object-contain"
      onError={() => setFailed(true)}
    />
  );
}

function renderRowLabel(label, title) {
  const str = String(label || "").trim();
  const lower = str.toLowerCase();
  const t = String(title || "").toLowerCase();

  // 1. Channel classification styling
  if (t === "channels" || ["ai", "ai search / geo", "organic search", "social", "social media", "direct", "email", "email newsletter", "paid ads", "paid search", "referral"].includes(lower)) {
    if (lower === "ai" || lower.includes("ai traffic") || lower.includes("ai referral")) {
      return (
        <span className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-purple-500/15 text-purple-400 border border-purple-500/25">
            <Sparkles className="h-3 w-3" />
          </span>
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            {str}
            <span className="rounded bg-purple-500/15 text-purple-400 border border-purple-500/30 px-1 py-0.2 text-[9px] font-bold tracking-wide">
              AI TRAFFIC
            </span>
          </span>
        </span>
      );
    }
    if (lower.includes("ai search / geo") || lower.includes("geo")) {
      return (
        <span className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
            <Bot className="h-3 w-3" />
          </span>
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            {str}
            <span className="rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 px-1 py-0.2 text-[9px] font-bold tracking-wide">
              CRAWLER
            </span>
          </span>
        </span>
      );
    }
    if (lower.includes("search") || lower.includes("organic search")) {
      return (
        <span className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
            <Search className="h-3 w-3" />
          </span>
          <span>{str}</span>
        </span>
      );
    }
    if (lower.includes("social")) {
      return (
        <span className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/25">
            <Share2 className="h-3 w-3" />
          </span>
          <span>{str}</span>
        </span>
      );
    }
    if (lower.includes("direct")) {
      return (
        <span className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground border border-border">
            <Compass className="h-3 w-3" />
          </span>
          <span>{str}</span>
        </span>
      );
    }
    if (lower.includes("email")) {
      return (
        <span className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/25">
            <Mail className="h-3 w-3" />
          </span>
          <span>{str}</span>
        </span>
      );
    }
    if (lower.includes("paid")) {
      return (
        <span className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/25">
            <DollarSign className="h-3 w-3" />
          </span>
          <span>{str}</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground border border-border">
          <ExternalLink className="h-3 w-3" />
        </span>
        <span>{str}</span>
      </span>
    );
  }

  // 2. Traffic sources: show favicon and AI tag if from AI chatbot
  if (t.includes("source") || lower.includes(".com") || lower.includes(".ai") || lower.includes(".org") || lower.includes(".net") || lower.includes(".io")) {
    const isAiSource = /chatgpt|openai|claude|perplexity|gemini|deepseek|grok|meta\.ai|phind/.test(lower);
    return (
      <span className="flex items-center gap-2">
        <SourceFavicon domain={str} />
        <span className="truncate">{str}</span>
        {isAiSource && (
          <span className="rounded bg-purple-500/15 text-purple-400 border border-purple-500/30 px-1 py-0.2 text-[8px] font-bold tracking-wide">
            AI
          </span>
        )}
      </span>
    );
  }

  // 3. Countries: flag emoji and country name
  if (t.includes("countr") || (str.length === 2 && /^[A-Z]{2}$/.test(str))) {
    const emoji = flagEmoji(str);
    const cName = countryName(str);
    return (
      <span className="flex items-center gap-2">
        {emoji ? <span className="text-base leading-none">{emoji}</span> : null}
        <span>{cName !== str ? `${cName} (${str})` : str}</span>
      </span>
    );
  }

  // 4. Conversion events
  if (t.includes("conversion") || t.includes("event") || t.includes("goal")) {
    return (
      <span className="flex items-center gap-2">
        <Target className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="font-mono text-xs">{str}</span>
      </span>
    );
  }

  // 5. Downloads
  if (t.includes("download")) {
    return (
      <span className="flex items-center gap-2">
        <FileDown className="h-3.5 w-3.5 text-sky-400 shrink-0" />
        <span className="truncate">{str}</span>
      </span>
    );
  }

  // 6. Outbound links
  if (t.includes("outbound")) {
    return (
      <span className="flex items-center gap-2">
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="truncate">{str}</span>
      </span>
    );
  }

  // Default: plain label
  return <span className="truncate">{str}</span>;
}

/** A ranked list with an animated share bar per row and CSV export. */
export default function BreakdownTable({
  rows,
  metric = "Sessions",
  money = false,
  limit = 8,
  title = "Analytics",
  showExport = true,
}) {
  const list = (rows ?? []).slice(0, limit);
  if (!list.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No {String(metric).toLowerCase()} recorded in this period.
      </p>
    );
  }
  const max = Math.max(1, ...list.map((row) => Number(row.value) || 0));

  return (
    <div>
      <div className="flex items-center justify-between pb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        <span>{metric === "Pageviews" ? "Page" : (title && title !== "Analytics" ? title : metric)}</span>
        <div className="flex items-center gap-2">
          <span>{metric}</span>
          {showExport && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px] font-normal text-muted-foreground hover:text-foreground hover:bg-muted/80 gap-1 rounded-md"
              title="Export this table as CSV"
              onClick={() => exportBreakdownCsv(title, metric, rows, money)}
            >
              <Download className="h-2.5 w-2.5" />
              <span>CSV</span>
            </Button>
          )}
        </div>
      </div>
      <ul className="divide-y divide-border">
        {list.map((row, index) => (
          <li key={row.label + index} className="animate-fade-up py-3" style={{ animationDelay: `${index * 45}ms` }}>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="truncate font-medium flex items-center min-w-0" title={row.label}>
                {renderRowLabel(row.label, title)}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {money && row.revenue ? `${formatCurrency(row.revenue)} · ` : ""}
                {formatNumber(row.value)}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/50 to-primary transition-[width] duration-700"
                style={{ width: `${Math.max(2, ((Number(row.value) || 0) / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
