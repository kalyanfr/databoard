/**
 * Server-side helpers shared by the tracking endpoints. Nothing here is
 * imported by frontend code.
 */
export const MAX_EVENTS_PER_REQUEST = 25;
export const MAX_BODY_BYTES = 64 * 1024;

const BOT_RE = /(bot|crawler|spider|crawl|curl|wget|python-requests|headless|lighthouse|monitor)/i;
const MOBILE_RE = /(iphone|ipod|android.*mobile|windows phone|blackberry|opera mini)/i;
const TABLET_RE = /(ipad|tablet|playbook|silk|android(?!.*mobile))/i;
const SEARCH_HOSTS = ["google.", "bing.", "duckduckgo.", "yahoo.", "baidu.", "ecosia.", "yandex.", "brave."];
const SOCIAL_HOSTS = ["facebook.", "instagram.", "t.co", "twitter.", "x.com", "linkedin.", "reddit.", "pinterest.", "youtube.", "tiktok.", "bsky.", "news.ycombinator"];
const EMAIL_HOSTS = ["mail.google.", "outlook.", "mail.yahoo", "superhuman", "hey.com"];
const PAID_MEDIUMS = ["cpc", "ppc", "paid", "paidsearch", "display", "ads", "retargeting"];

export function parseUserAgent(userAgent = "") {
  const agent = String(userAgent || "");
  if (!agent) return { device: "Unknown", browser: "Unknown", os: "Unknown" };

  let browser = "Other";
  if (BOT_RE.test(agent)) browser = "Bot";
  else if (/edg\//i.test(agent)) browser = "Edge";
  else if (/opr\/|opera/i.test(agent)) browser = "Opera";
  else if (/chrome|crios/i.test(agent)) browser = "Chrome";
  else if (/firefox|fxios/i.test(agent)) browser = "Firefox";
  else if (/safari/i.test(agent)) browser = "Safari";

  let os = "Other";
  if (/windows/i.test(agent)) os = "Windows";
  else if (/iphone|ipad|ipod/i.test(agent)) os = "iOS";
  else if (/android/i.test(agent)) os = "Android";
  else if (/mac os x|macintosh/i.test(agent)) os = "macOS";
  else if (/linux|x11/i.test(agent)) os = "Linux";

  const device = TABLET_RE.test(agent) ? "Tablet" : MOBILE_RE.test(agent) ? "Mobile" : "Desktop";
  return { device, browser, os };
}

export function referrerDomainOf(referrer) {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

/** Only the pathname is kept — query strings can carry personal data. */
export function normalizePath(pathValue, urlValue) {
  const source = pathValue || urlValue || "";
  try {
    const url = new URL(source, "https://placeholder.invalid");
    return url.pathname || "/";
  } catch {
    return String(source).split("?")[0].slice(0, 500) || "/";
  }
}

export function normalizeDomain(input = "") {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return "";
  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^www\./, "").replace(/\/.*$/, "").slice(0, 200);
  }
}

export function classifyChannel({ referrerDomain, utmMedium, utmSource, siteDomain }) {
  const medium = String(utmMedium || "").toLowerCase();
  const source = String(utmSource || "").toLowerCase();
  const referrer = String(referrerDomain || "");
  if (PAID_MEDIUMS.includes(medium) || /adwords|googleads|cpc/.test(source)) return "Paid Ads";
  if (medium === "email" || EMAIL_HOSTS.some((host) => referrer.includes(host))) return "Email";
  if (medium === "social" || SOCIAL_HOSTS.some((host) => referrer.includes(host))) return "Social";
  if (medium) return "Campaign";
  if (!referrer || (siteDomain && referrer.endsWith(siteDomain))) return "Direct";
  if (SEARCH_HOSTS.some((host) => referrer.includes(host))) return "Organic Search";
  return "Referral";
}

export function truncate(value, max) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.length > max ? text.slice(0, max) : text;
}

/** Timestamps are stored as UTC ISO strings; reject nonsense without dropping the hit. */
export function safeTimestamp(value) {
  const parsed = Date.parse(value);
  const now = Date.now();
  if (!Number.isFinite(parsed)) return new Date(now).toISOString();
  if (parsed > now + 60000) return new Date(now).toISOString();
  if (parsed < now - 86400000) return new Date(now).toISOString();
  return new Date(parsed).toISOString();
}

export function clientIp(headers) {
  return (
    headers.get("cf-connecting-ip") ||
    (headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    headers.get("x-real-ip") ||
    null
  );
}

/** Country only — an IP is never stored. */
export function geoOf(request) {
  const cf = request.cf ?? {};
  const header = request.headers.get("cf-ipcountry") || request.headers.get("x-vercel-ip-country");
  const country = header && header !== "XX" ? header : cf.country && cf.country !== "XX" ? cf.country : null;
  return { country, region: cf.region ?? cf.regionCode ?? request.headers.get("x-vercel-ip-country-region") ?? null };
}

/** Best-effort in-memory rate limiter: isolates recycle, so this bounds bursts. */
const buckets = new Map();

export function allowRequest(key, limit, windowMs) {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

export const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
  "cache-control": "no-store",
};

export const jsonWithCors = (body, status = 200) =>
  Response.json(body, { status, headers: corsHeaders });