import { Suspense, lazy, useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import ActivityFeed from "@/components/realtime/ActivityFeed";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Minus,
  TrendingUp,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  Activity,
} from "lucide-react";

const GlobeMap = lazy(() => import("@/components/realtime/GlobeMap"));

const SKELETON = (
  <div className="flex h-full w-full items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      <span className="text-xs font-medium text-muted-foreground">Loading 3D Globe...</span>
    </div>
  </div>
);

/**
 * Standalone 3D Telemetry Globe Card (Right Column)
 * - Above and below the globe: NO CARDS
 * - Top Header: Active visitors counter, trend, zoom, reset & full screen controls
 * - Full Height 3D interactive globe with authentic country flags
 * - One-click Full Screen mode portaled directly to <body> showing globe & live telemetry
 * - Full Screen mode includes floating Live Pages & Activity tab overlay on the left
 */
export default function VisitorGlobe({
  markers = [],
  activeVisitors: propActiveVisitors = 0,
  previousVisitors: propPreviousVisitors = 0,
  windowMinutes = 30,
  activePages = [],
  feed = [],
  pageviews = 0,
}) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [mounted, setMounted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen Left-Side Overlay Panel State (Open by default)
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [panelTab, setPanelTab] = useState("pages"); // "pages" | "activity"

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveMarkers = useMemo(() => {
    return Array.isArray(markers) ? markers : [];
  }, [markers]);

  const totalVisitors = useMemo(() => {
    if (typeof propActiveVisitors === "number") {
      return Math.max(0, propActiveVisitors);
    }
    return 0;
  }, [propActiveVisitors]);

  const trendPercent = useMemo(() => {
    if (typeof propPreviousVisitors === "number" && propPreviousVisitors > 0) {
      return Math.round(((totalVisitors - propPreviousVisitors) / propPreviousVisitors) * 100);
    }
    return 0;
  }, [totalVisitors, propPreviousVisitors]);

  const handleReset = useCallback(() => {
    setSelectedCountry(null);
    setZoomLevel(1.0);
    setAutoRotate(true);
  }, []);

  const enterFullscreen = useCallback(() => {
    setIsFullscreen(true);
    setIsLeftPanelOpen(true);
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {
      /* fullscreen unavailable or blocked */
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      /* exit fullscreen unavailable */
    }
  }, []);

  // Sync with native fullscreen changes (e.g. user presses Esc in browser)
  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, [isFullscreen]);

  // Listen for Escape key on window
  useEffect(() => {
    if (!isFullscreen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        exitFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, exitFullscreen]);

  // Fallback active pages computed from feed if activePages is empty
  const displayPages = useMemo(() => {
    if (activePages && activePages.length > 0) return activePages;
    const map = new Map();
    for (const item of feed) {
      if (item.type === "pageview" || !item.type) {
        const p = item.path || "/";
        map.set(p, (map.get(p) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([path, visitors]) => ({ path, visitors }))
      .sort((a, b) => b.visitors - a.visitors);
  }, [activePages, feed]);

  return (
    <>
      {/* 1. STANDARD CARD VIEW (In Dashboard Column) */}
      <div className="gloss-card relative flex flex-col justify-between w-full h-full min-h-0 rounded-2xl sm:rounded-3xl border border-border bg-card p-3 sm:p-3.5 shadow-xs space-y-2 overflow-hidden">
        {/* TOP HEADER: Active Visitors Counter, Trend & Controls */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 border-b border-border/60 pb-2 shrink-0">
          {/* Left: Active visitors counter & trend */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-baseline gap-1.5 sm:gap-2 shrink-0">
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground tabular-nums">
                {totalVisitors.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Active <span className="hidden sm:inline">visitors</span>
              </span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/60 px-2 py-0.5 text-[11px] font-semibold text-foreground shrink-0">
              <TrendingUp className="h-3 w-3 stroke-[2.5]" />
              {trendPercent >= 0 ? `+${trendPercent}%` : `${trendPercent}%`}
              <span className="text-[10px] text-muted-foreground font-normal hidden sm:inline">
                vs prev {windowMinutes}m
              </span>
            </span>
          </div>

          {/* Right: Rotate, Zoom, Reset & Full Screen Trigger */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setAutoRotate((prev) => !prev)}
              title={autoRotate ? "Pause rotation" : "Resume rotation"}
              aria-label={autoRotate ? "Pause rotation" : "Resume rotation"}
              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition active:scale-95 ${
                autoRotate
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/80 bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {autoRotate ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))))}
              title="Zoom In"
              aria-label="Zoom In"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/80 bg-card text-foreground transition hover:bg-muted active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
              title="Zoom Out"
              aria-label="Zoom Out"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/80 bg-card text-foreground transition hover:bg-muted active:scale-95"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleReset}
              title="Reset View"
              aria-label="Reset View"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/80 bg-card text-foreground transition hover:bg-muted active:scale-95"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={enterFullscreen}
              title="Full Screen Mode"
              aria-label="Full Screen Mode"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/80 bg-card text-foreground transition hover:bg-muted active:scale-95"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* 3D GLOBE CANVAS (Standard View) */}
        <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center w-full rounded-xl sm:rounded-2xl border border-border/60 bg-muted/15 overflow-hidden">
          <div className="relative h-full w-full">
            {mounted && !isFullscreen ? (
              <Suspense fallback={SKELETON}>
                <GlobeMap
                  markers={effectiveMarkers}
                  autoRotate={autoRotate}
                  selectedCountry={selectedCountry}
                  onSelectCountry={(c) => setSelectedCountry((prev) => (prev === c ? null : c))}
                  zoomLevel={zoomLevel}
                />
              </Suspense>
            ) : mounted && isFullscreen ? (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground font-medium">
                Viewing in full screen mode
              </div>
            ) : (
              SKELETON
            )}
          </div>
        </div>
      </div>

      {/* 2. TRUE FULL SCREEN PORTAL (With Left Live Pages Tab) */}
      {isFullscreen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex flex-col justify-between w-screen h-screen bg-[#060911] p-3 sm:p-5 overflow-hidden select-none animate-in fade-in duration-200">
            {/* Top Fullscreen Bar */}
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3 shrink-0 z-30">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white tabular-nums">
                    {totalVisitors.toLocaleString()}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white/70 uppercase tracking-wider">
                    Active visitors
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 sm:px-3 sm:py-1 text-xs font-semibold text-white">
                  <TrendingUp className="h-3.5 w-3.5 stroke-[2.5]" />
                  {trendPercent >= 0 ? `+${trendPercent}%` : `${trendPercent}%`}
                  <span className="text-[10px] text-white/60 font-normal hidden sm:inline">
                    vs prev {windowMinutes}m
                  </span>
                </span>
              </div>

              {/* Controls Right */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Toggle Live Pages Panel Button */}
                <button
                  type="button"
                  onClick={() => setIsLeftPanelOpen((prev) => !prev)}
                  title={isLeftPanelOpen ? "Hide Live Pages & Activity" : "Show Live Pages & Activity"}
                  className={`flex h-8 items-center gap-1.5 px-2.5 sm:px-3 rounded-xl border text-xs font-semibold transition active:scale-95 ${
                    isLeftPanelOpen
                      ? "border-primary/50 bg-primary/20 text-primary"
                      : "border-white/15 bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {isLeftPanelOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">Live Pages</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAutoRotate((prev) => !prev)}
                  title={autoRotate ? "Pause rotation" : "Resume rotation"}
                  aria-label={autoRotate ? "Pause rotation" : "Resume rotation"}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl border transition active:scale-95 ${
                    autoRotate
                      ? "border-primary/50 bg-primary/20 text-primary"
                      : "border-white/15 bg-white/10 text-white/80 hover:bg-white/20"
                  }`}
                >
                  {autoRotate ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))))}
                  title="Zoom In"
                  aria-label="Zoom In"
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
                  title="Zoom Out"
                  aria-label="Zoom Out"
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  title="Reset View"
                  aria-label="Reset View"
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={exitFullscreen}
                  title="Exit Fullscreen (Esc)"
                  aria-label="Exit Fullscreen"
                  className="flex h-8 items-center gap-1.5 sm:gap-2 px-3 rounded-xl border border-primary/50 bg-primary/20 text-primary font-semibold text-xs transition hover:bg-primary/30 active:scale-95"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span>Exit Fullscreen</span>
                </button>
              </div>
            </div>

            {/* Main Stage: 3D Globe + Floating Left Live Pages Tab */}
            <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center w-full my-2 overflow-hidden">
              {/* Fullscreen 3D Globe */}
              <div className="absolute inset-0 h-full w-full">
                <Suspense fallback={SKELETON}>
                  <GlobeMap
                    markers={effectiveMarkers}
                    autoRotate={autoRotate}
                    selectedCountry={selectedCountry}
                    onSelectCountry={(c) => setSelectedCountry((prev) => (prev === c ? null : c))}
                    zoomLevel={zoomLevel}
                  />
                </Suspense>
              </div>

              {/* Floating Left-Side Live Pages & Activity Tab Overlay */}
              <div
                className={cn(
                  "absolute left-3 sm:left-6 top-3 sm:top-5 bottom-3 sm:bottom-5 z-30 flex flex-col rounded-2xl sm:rounded-3xl border border-white/15 bg-black/80 backdrop-blur-2xl shadow-2xl transition-all duration-300 overflow-hidden",
                  isLeftPanelOpen
                    ? "w-[270px] sm:w-[320px] p-3 sm:p-3.5"
                    : "w-10 h-10 p-0 items-center justify-center bg-black/85 border-white/20"
                )}
              >
                {!isLeftPanelOpen ? (
                  <button
                    type="button"
                    onClick={() => setIsLeftPanelOpen(true)}
                    title="Open Live Pages & Activity"
                    className="flex h-full w-full items-center justify-center rounded-xl text-white hover:bg-white/20 transition"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                ) : (
                  <>
                    {/* Header: Tabs + Collapse Icon */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-white/10 shrink-0">
                      <div className="flex items-center gap-1 p-0.5 rounded-xl border border-white/10 bg-white/5">
                        <button
                          type="button"
                          onClick={() => setPanelTab("pages")}
                          className={cn(
                            "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                            panelTab === "pages"
                              ? "bg-primary text-white shadow-xs"
                              : "text-white/60 hover:text-white"
                          )}
                        >
                          <FileText className="h-3 w-3" />
                          <span>Live Pages ({displayPages.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPanelTab("activity")}
                          className={cn(
                            "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                            panelTab === "activity"
                              ? "bg-primary text-white shadow-xs"
                              : "text-white/60 hover:text-white"
                          )}
                        >
                          <Activity className="h-3 w-3" />
                          <span>Activity ({feed.length})</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsLeftPanelOpen(false)}
                        title="Collapse Panel"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition"
                      >
                        <PanelLeftClose className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Tab 1: Live Pages View */}
                    {panelTab === "pages" && (
                      <div className="flex-1 min-h-0 flex flex-col justify-between mt-2.5 overflow-hidden">
                        <div className="flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-thin space-y-1.5">
                          {displayPages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center text-xs text-white/60">
                              <p className="font-semibold text-white">Waiting for live pageviews...</p>
                              <p className="text-[11px] mt-1 text-white/50">Active pages will display here live</p>
                            </div>
                          ) : (
                            displayPages.map((pg, idx) => {
                              const pct =
                                totalVisitors > 0
                                  ? Math.min(100, Math.round((pg.visitors / totalVisitors) * 100))
                                  : 100;
                              return (
                                <div
                                  key={pg.path || idx}
                                  className="space-y-1 rounded-xl p-2 bg-white/[0.04] hover:bg-white/[0.08] transition-colors border border-white/5"
                                >
                                  <div className="flex items-center justify-between text-xs gap-2">
                                    <span
                                      className="font-mono text-white font-semibold truncate text-[11px] sm:text-xs"
                                      title={pg.path}
                                    >
                                      {pg.path}
                                    </span>
                                    <span className="font-bold text-white shrink-0 tabular-nums text-xs">
                                      {pg.visitors} {pg.visitors === 1 ? "visitor" : "visitors"}
                                    </span>
                                  </div>
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500"
                                      style={{ width: `${Math.max(6, pct)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Bottom Total Pageviews */}
                        <div className="pt-2 border-t border-white/10 mt-2 flex items-center justify-between text-[11px] text-white/60 shrink-0">
                          <span>Total Pageviews:</span>
                          <span className="font-bold text-white tabular-nums text-xs">
                            {formatNumber(pageviews)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Live Activity Feed */}
                    {panelTab === "activity" && (
                      <div className="flex-1 min-h-0 mt-2.5 overflow-y-auto pr-1 scrollbar-thin text-white">
                        <ActivityFeed items={feed} limit={24} />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Bottom Esc Pill */}
              <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                <span className="hidden sm:inline-flex items-center rounded-full border border-white/15 bg-black/80 px-3 py-1.5 text-xs font-medium text-white/70 shadow-sm backdrop-blur-md">
                  Press Esc to exit
                </span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
