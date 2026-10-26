/**
 * Google Search Console (GSC) Integration Service
 * Manages Google OAuth 2.0 GIS Token Client, verified sites, and search query analytics.
 */

const GSC_STORAGE_KEY = "trafficlume_gsc_auth";
export const GSC_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "1065549716741-ksfkk7f010h9m119dtk1dgcsv8pen3a9.apps.googleusercontent.com";
export const GSC_SCOPES = "https://www.googleapis.com/auth/webmasters.readonly";

/**
 * Retrieve saved GSC authentication state
 */
export function getGscAuth() {
  try {
    const raw = localStorage.getItem(GSC_STORAGE_KEY);
    if (!raw) return null;
    const auth = JSON.parse(raw);
    if (!auth || !auth.access_token) return null;
    const isExpired = Boolean(auth.expires_at && Date.now() > auth.expires_at);
    return { ...auth, isExpired };
  } catch {
    return null;
  }
}

/**
 * Save GSC authentication state and notify listeners
 */
export function saveGscAuth(authData) {
  try {
    const raw = localStorage.getItem(GSC_STORAGE_KEY);
    let current = {};
    if (raw) {
      try {
        current = JSON.parse(raw) || {};
      } catch {}
    }
    const updated = { ...current, ...authData };
    if (updated.expires_at) {
      updated.isExpired = Date.now() > updated.expires_at;
    } else {
      updated.isExpired = false;
    }
    localStorage.setItem(GSC_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("gsc-auth-changed", { detail: updated }));
    return updated;
  } catch (err) {
    console.error("Failed to save GSC auth state:", err);
    return null;
  }
}

/**
 * Clear GSC authentication
 */
export function clearGscAuth() {
  try {
    localStorage.removeItem(GSC_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("gsc-auth-changed", { detail: null }));
  } catch (err) {
    console.error("Failed to clear GSC auth state:", err);
  }
}

// Cross-tab/window synchronization
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === GSC_STORAGE_KEY) {
      const updated = getGscAuth();
      window.dispatchEvent(new CustomEvent("gsc-auth-changed", { detail: updated }));
    }
  });
}

/**
 * Ensure Google Identity Services script is available
 */
export function ensureGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      return resolve(window.google);
    }
    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google));
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Google Identity Services")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
}

/**
 * Prompt Google OAuth 2.0 popup and acquire access token for GSC
 */
export async function requestGscToken() {
  await ensureGoogleScript();

  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google Identity Services not initialized.");
  }

  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GSC_CLIENT_ID,
        scope: GSC_SCOPES,
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error_description || tokenResponse.error));
            return;
          }

          const expiresIn = Number(tokenResponse.expires_in) || 3600;
          const authData = {
            access_token: tokenResponse.access_token,
            expires_at: Date.now() + (expiresIn - 60) * 1000,
            connected_at: new Date().toISOString(),
            is_demo: false,
            isExpired: false,
          };

          // Try fetching verified sites right away to see available properties
          try {
            const sites = await fetchGscSites(authData.access_token);
            authData.sites = sites;
            if (sites.length > 0) {
              authData.selected_site = sites[0].siteUrl;
            }
          } catch (e) {
            console.warn("Could not pre-fetch sites during auth:", e);
          }

          saveGscAuth(authData);
          resolve(authData);
        },
      });

      client.requestAccessToken({ prompt: "consent" });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Fetch verified sites from Google Search Console
 */
export async function fetchGscSites(accessToken) {
  if (!accessToken) return [];
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Google access token expired. Please reconnect.");
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to fetch sites (${res.status})`);
  }

  const data = await res.json();
  return (data.siteEntry || []).map((entry) => ({
    siteUrl: entry.siteUrl,
    permissionLevel: entry.permissionLevel,
  }));
}

/**
 * Query search analytics for a given site from Google Search Console
 */
export async function fetchGscSearchAnalytics({ accessToken, siteUrl, startDate, endDate, rowLimit = 50 }) {
  if (!accessToken || !siteUrl) return [];

  // Google expects dates in YYYY-MM-DD
  const formatGscDate = (d) => {
    if (!d) return new Date().toISOString().split("T")[0];
    if (typeof d === "string") return d.split("T")[0];
    return d.toISOString().split("T")[0];
  };

  const start = formatGscDate(startDate);
  const end = formatGscDate(endDate);

  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: start,
        endDate: end,
        dimensions: ["query"],
        rowLimit,
      }),
    },
  );

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Google access token expired. Please reconnect.");
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Search Console API error (${res.status})`);
  }

  const data = await res.json();
  const rows = data.rows || [];

  return rows.map((row) => ({
    query: row.keys?.[0] || "Unknown query",
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: Number(((row.ctr || 0) * 100).toFixed(2)), // as percentage e.g. 4.25%
    position: Number((row.position || 0).toFixed(1)), // e.g. 2.4
  }));
}

/**
 * Realistic sample Google Search Console data for preview & demo mode
 */
export function getSampleGscData(domain = "yourdomain.com") {
  return [
    { query: "privacy friendly website analytics", clicks: 384, impressions: 8420, ctr: 4.56, position: 2.1 },
    { query: "realtime 3d globe traffic tracker", clicks: 279, impressions: 5120, ctr: 5.45, position: 1.8 },
    { query: "best plausible alternative", clicks: 215, impressions: 4680, ctr: 4.59, position: 3.4 },
    { query: "cookie free analytics without banner", clicks: 184, impressions: 3950, ctr: 4.66, position: 2.9 },
    { query: `${domain} review`, clicks: 142, impressions: 1890, ctr: 7.51, position: 1.2 },
    { query: "lightweight analytics under 2kb", clicks: 128, impressions: 3200, ctr: 4.0, position: 4.1 },
    { query: "self host vs cloud web analytics", clicks: 96, impressions: 2750, ctr: 3.49, position: 6.3 },
    { query: "gdpr compliant visitor tracking", clicks: 88, impressions: 2410, ctr: 3.65, position: 5.2 },
    { query: "track website traffic with 3d earth", clicks: 76, impressions: 1650, ctr: 4.61, position: 1.5 },
    { query: "google analytics 4 alternative simple", clicks: 64, impressions: 2190, ctr: 2.92, position: 7.8 },
  ];
}
