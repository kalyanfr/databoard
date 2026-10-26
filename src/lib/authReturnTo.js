// Shared by the auth pages (Login, Register, and any page that resumes a flow
// after sign-in). Keep the redirect validation in one place.

export function safeReturnTo(defaultPath = "/realtime") {
  const raw = new URLSearchParams(window.location.search).get("returnTo");
  if (!raw || raw === "/") return defaultPath;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return defaultPath;
    for (const p of ["access_token", "clear_access_token", "app_id", "app_base_url", "functions_version", "from_url"]) {
      url.searchParams.delete(p);
    }
    const path = url.pathname + url.search;
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path === "/") return defaultPath;
    return path;
  } catch {
    return defaultPath;
  }
}
