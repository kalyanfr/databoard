export const formatNumber = (value) => new Intl.NumberFormat("en-US").format(Math.round(Number(value) || 0));

export const formatPercent = (value, digits = 1) => `${((Number(value) || 0) * 100).toFixed(digits)}%`;

export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}m ${String(rest).padStart(2, "0")}s`;
}

export const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    Number(value) || 0,
  );

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

/** "just now", "4m ago" — used by the realtime feed. */
export function relativeTime(value, nowMs = 0) {
  const then = Date.parse(value);
  if (Number.isNaN(then)) return "—";
  const seconds = Math.max(0, Math.round(((nowMs || Date.now()) - then) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}