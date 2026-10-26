/** Date-range helpers. Everything is computed and bucketed in UTC. */
const DAY_MS = 86400000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const RANGE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

export const MAX_BUCKETS = 120;

const startOfUtcDay = (date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/** Resolve the active filter state into an ISO `from`/`to` window. */
export function computeRange({ range = "7d", from, to } = {}) {
  if (range === "custom" && from && to) {
    const start = from <= to ? from : to;
    const end = from <= to ? to : from;
    return {
      from: `${start}T00:00:00.000Z`,
      to: `${end}T23:59:59.999Z`,
      label: `${prettyDay(start)} → ${prettyDay(end)}`,
    };
  }
  const now = new Date();
  const days = range === "today" ? 1 : range === "90d" ? 90 : range === "30d" ? 30 : 7;
  const fromMs = range === "today" ? startOfUtcDay(now) : startOfUtcDay(now) - (days - 1) * DAY_MS;
  // The window end is rounded up to the next 5-minute boundary: it still covers
  // the present and keeps the value stable enough for a short-lived cache.
  const windowMs = 5 * 60 * 1000;
  const toMs = Math.ceil(now.getTime() / windowMs) * windowMs;
  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    label: RANGE_PRESETS.find((preset) => preset.id === range)?.label ?? "7 days",
  };
}

export const utcDay = (iso) => new Date(iso).toISOString().slice(0, 10);

export function prettyDay(key) {
  if (!key) return "";
  const [year, month, day] = String(key).slice(0, 10).split("-");
  if (!month || !day) return String(key);
  return `${MONTHS[Number(month) - 1]} ${Number(day)}`;
}

/** Every UTC day key in the window, so charts render a continuous axis. */
export function dayKeysBetween(fromIso, toIso) {
  const keys = [];
  const end = Date.parse(`${utcDay(toIso)}T00:00:00.000Z`);
  for (let t = Date.parse(`${utcDay(fromIso)}T00:00:00.000Z`); t <= end; t += DAY_MS) {
    keys.push(new Date(t).toISOString().slice(0, 10));
    if (keys.length >= MAX_BUCKETS) break;
  }
  return keys;
}

/** Merge aggregate buckets onto the full day axis. */
export function buildSeries(buckets, fromIso, toIso, keys = ["visitors"]) {
  const index = new Map(dayKeysBetween(fromIso, toIso).map((date) => [date, { date }]));
  for (const bucket of buckets) {
    const row = index.get(bucket.date);
    if (!row) continue;
    for (const key of keys) row[key] = Number(bucket[key] ?? 0) || 0;
  }
  return [...index.values()];
}