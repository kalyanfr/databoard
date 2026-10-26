/** Light/dark theme, synchronized globally across all components and stored locally. */
import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "lume.theme";
const OPTIONS = ["dark", "light"];

// Global set of subscriber listeners
const listeners = new Set();

function emitChange() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore subscriber error */
    }
  });
}

function getStoredTheme() {
  if (typeof window === "undefined") return null;
  try {
    const val = window.localStorage.getItem(STORAGE_KEY);
    if (OPTIONS.includes(val)) return val;
  } catch {
    /* storage unavailable */
  }
  return null;
}

function getSnapshot() {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot() {
  return "dark";
}

function apply(theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

// Global initialization in browser
if (typeof window !== "undefined" && typeof document !== "undefined") {
  // Apply initial theme from storage if present
  const stored = getStoredTheme();
  if (stored) {
    apply(stored);
  } else if (!document.documentElement.classList.contains("dark")) {
    // Default to dark mode for SaaS dashboard if nothing stored
    document.documentElement.classList.add("dark");
  }

  // Observe classList changes on <html> to notify all subscribers immediately
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes" && m.attributeName === "class") {
        emitChange();
        break;
      }
    }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  // Cross-tab synchronization
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY && OPTIONS.includes(e.newValue)) {
      apply(e.newValue);
      emitChange();
    }
  });
}

function subscribe(callback) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next) => {
    if (!OPTIONS.includes(next)) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
    apply(next);
    emitChange();
  }, []);

  const toggle = useCallback(() => {
    const current = getSnapshot();
    const next = current === "dark" ? "light" : "dark";
    setTheme(next);
  }, [setTheme]);

  return { theme, toggle, setTheme };
}
