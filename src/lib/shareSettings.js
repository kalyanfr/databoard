/**
 * Public Shareable Dashboard Configuration & State
 * Manages public share links, permissions, and passwords for client/public access.
 */

const SHARE_STORAGE_PREFIX = "trafficlume_share_";

export function getProjectShareSettings(projectId) {
  if (!projectId) return { isPublic: false, password: "", allowGlobe: true };
  try {
    const raw = localStorage.getItem(`${SHARE_STORAGE_PREFIX}${projectId}`);
    if (!raw) {
      // Default to public on for demo/first project
      return { isPublic: true, password: "", allowGlobe: true };
    }
    return JSON.parse(raw);
  } catch {
    return { isPublic: true, password: "", allowGlobe: true };
  }
}

export function saveProjectShareSettings(projectId, settings) {
  if (!projectId) return;
  try {
    const current = getProjectShareSettings(projectId);
    const updated = { ...current, ...settings };
    localStorage.setItem(`${SHARE_STORAGE_PREFIX}${projectId}`, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("share-settings-changed", { detail: { projectId, settings: updated } }));
    return updated;
  } catch (err) {
    console.error("Failed to save share settings:", err);
  }
}
