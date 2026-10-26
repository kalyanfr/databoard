import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, FileText, Activity as ActivityIcon } from "lucide-react";
import { webrader, supabase } from "@/api/webraderClient";
import PageHeader from "@/components/common/PageHeader";
import LoadingBlock from "@/components/common/LoadingBlock";
import GettingStartedCard from "@/components/projects/GettingStartedCard";
import ActivityFeed from "@/components/realtime/ActivityFeed";
import MinuteBars from "@/components/realtime/MinuteBars";
import VisitorGlobe from "@/components/realtime/VisitorGlobe";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveProject } from "@/lib/filters";
import { normalizeCountryCode } from "@/lib/geo";
import { cn } from "@/lib/utils";

const WINDOWS = [5, 15, 30, 60];
const EVENT_LIMIT = 500;
const EMPTY = [];

const minuteKey = (value) => String(value ?? "").slice(0, 16);

async function loadRealtime(project, windowMinutes) {
  const cleanDomain = project?.domain
    ? String(project.domain).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
    : null;
  const projectIds = [project?.project_id, project?.id, cleanDomain].filter(Boolean);
  const queryFilter = projectIds.length > 1 ? { $in: [...new Set(projectIds)] } : (project?.project_id || project?.id);

  const now = Date.now();
  const since = new Date(now - windowMinutes * 60000).toISOString();
  const previousSince = new Date(now - 2 * windowMinutes * 60000).toISOString();

  const [page, previousPage] = await Promise.all([
    webrader.entities.Event.filter(
      { project_id: queryFilter, timestamp: { $gte: since } },
      { sort: "-timestamp", limit: EVENT_LIMIT, fields: ["id", "type", "name", "path", "timestamp", "country", "visitor_id", "session_id", "revenue"] },
    ),
    webrader.entities.Event.filter(
      { project_id: queryFilter, timestamp: { $gte: previousSince, $lt: since } },
      { sort: "-timestamp", limit: EVENT_LIMIT, fields: ["id", "visitor_id", "session_id"] },
    ),
  ]);

  const events = page.items ?? [];
  const minutes = Array.from({ length: windowMinutes }, (_, index) => ({
    minute: minuteKey(new Date(now - (windowMinutes - 1 - index) * 60000).toISOString()),
    pageviews: 0,
  }));
  const bucketIndex = new Map(minutes.map((bucket, index) => [bucket.minute, index]));
  const countries = new Map();
  const active = new Set();
  const pageMap = new Map();
  let pageviews = 0;

  for (const event of events) {
    const isPageview = event.type === "pageview" || !event.type;
    if (isPageview) {
      pageviews += 1;
      const index = bucketIndex.get(minuteKey(event.timestamp));
      if (index !== undefined) minutes[index].pageviews += 1;

      const p = event.path || "/";
      const visitorKey = event.visitor_id || event.session_id || event.id;
      if (!pageMap.has(p)) {
        pageMap.set(p, { visitors: new Set(), hits: 0 });
      }
      const item = pageMap.get(p);
      if (visitorKey) item.visitors.add(visitorKey);
      item.hits += 1;
    }
    const visitorKey = event.visitor_id || event.session_id || event.id;
    if (visitorKey) {
      active.add(visitorKey);
      const normalizedCode = normalizeCountryCode(event.country) || (event.country ? String(event.country).trim().toUpperCase() : null);
      const code = normalizedCode && normalizedCode !== "UNKNOWN" ? normalizedCode : "Unknown";
      const entry = countries.get(code) ?? { visitors: new Set(), events: 0 };
      entry.visitors.add(visitorKey);
      entry.events += 1;
      countries.set(code, entry);
    }
  }

  const activePages = Array.from(pageMap.entries())
    .map(([path, data]) => ({
      path,
      visitors: data.visitors.size || data.hits,
      hits: data.hits,
    }))
    .sort((a, b) => b.visitors - a.visitors || b.hits - a.hits);

  const previousSet = new Set(
    (previousPage.items ?? [])
      .map((event) => event.visitor_id || event.session_id || event.id)
      .filter(Boolean)
  );
  const activeList = [...active];
  const returningCount = activeList.filter((visitorId) => previousSet.has(visitorId)).length;

  return {
    windowMinutes,
    activeVisitors: active.size,
    newVisitors: Math.max(0, activeList.length - returningCount),
    returningVisitors: returningCount,
    previousVisitors: previousSet.size,
    pageviews,
    minutes,
    activePages,
    countries: [...countries.entries()]
      .map(([country, entry]) => ({ country, visitors: entry.visitors.size, events: entry.events }))
      .sort((a, b) => b.visitors - a.visitors || b.events - a.events),
    feed: events.slice(0, 30).map((event) => ({
      id: event.id,
      type: event.type,
      name: event.name ?? null,
      path: event.path ?? null,
      country: normalizeCountryCode(event.country) || event.country || null,
      timestamp: event.timestamp,
      revenue: event.revenue ?? null,
    })),
  };
}

export default function Realtime() {
  const { projects, project, projectId, setProjectId, isLoading } = useActiveProject();
  const [windowMinutes, setWindowMinutes] = useState(30);
  const [leftTab, setLeftTab] = useState("pages"); // "pages" | "hits"

  // Auto-refresh configured with 2-second heartbeat, always active even in background
  const query = useQuery({
    queryKey: ["realtime", project?.id, windowMinutes],
    enabled: !!project,
    queryFn: () => loadRealtime(project, windowMinutes),
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    staleTime: 0,
  });

  const refetchRef = useRef(query.refetch);
  useEffect(() => {
    refetchRef.current = query.refetch;
  });

  // Dedicated unstoppable heartbeat timer (guarantees auto-updates even if browser throttling is active)
  useEffect(() => {
    if (!project) return;
    const heartbeat = setInterval(() => {
      refetchRef.current?.();
    }, 2000);
    return () => clearInterval(heartbeat);
  }, [project?.id, windowMinutes]);

  // Realtime WebSocket channel for instant push on any new event insertion
  useEffect(() => {
    if (!project?.id) return;
    try {
      const channel = supabase
        .channel(`realtime-events-stream-${project.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "events",
          },
          () => {
            refetchRef.current?.();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      // Fallback cleanly to polling
    }
  }, [project?.id]);

  if (isLoading) return <LoadingBlock rows={3} />;

  if (!project) {
    return (
      <div className="space-y-6 pb-12">
        <PageHeaderish />
        <GettingStartedCard />
      </div>
    );
  }

  const data = query.data;

  return (
    <div className="h-auto lg:h-[calc(100vh-4.75rem)] flex flex-col justify-between overflow-hidden gap-2.5 sm:gap-3">
      {/* Top Header: Title, Live indicator, Project selector & Time window selector */}
      <PageHeader
        title={
          <div className="flex items-center gap-2.5">
            <span>Realtime visitors</span>
            <span className="glass inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-500" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Live · 2s auto-refresh
            </span>
          </div>
        }
        description="See where your website visitors are from, in real time."
        className="mb-1 sm:mb-2 shrink-0"
      >
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Quick Refresh Button with spinner feedback */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            className="h-8.5 gap-1.5 rounded-xl border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-muted"
            title="Refresh now"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-primary ${query.isFetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Sync</span>
          </Button>

          {projects && projects.length > 1 ? (
            <Select value={projectId ?? undefined} onValueChange={setProjectId}>
              <SelectTrigger className="w-full sm:w-[170px] h-8.5 rounded-xl font-medium text-xs border-border bg-card text-foreground">
                <SelectValue placeholder="Choose project" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-popover">
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="rounded-lg text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <Select value={String(windowMinutes)} onValueChange={(value) => setWindowMinutes(Number(value))}>
            <SelectTrigger className="w-full sm:w-[150px] h-8.5 rounded-xl font-medium text-xs border-border bg-card text-foreground">
              <SelectValue placeholder="Select window" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border bg-popover">
              {WINDOWS.map((minutes) => (
                <SelectItem key={minutes} value={String(minutes)} className="rounded-lg text-xs">
                  Last {minutes} minutes
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      {/* 2-Column Command Center:
          Mobile: Globe is #1 (at the TOP), followed by Live Activity (#2) and Page views (#3)
          Desktop: Left Column (Live Activity top, Page views bottom), Right Column (Standalone 3D Globe)
      */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] gap-2.5 sm:gap-3 items-stretch">
        
        {/* Globe Column (Mobile: order-1 at the TOP! Desktop: order-2 on the right) */}
        <div className="min-w-0 flex flex-col h-[380px] sm:h-[420px] lg:h-full overflow-hidden order-1 lg:order-2">
          <VisitorGlobe
            markers={data?.countries ?? EMPTY}
            activeVisitors={data?.activeVisitors ?? 0}
            previousVisitors={data?.previousVisitors ?? 0}
            windowMinutes={windowMinutes}
            activePages={data?.activePages ?? EMPTY}
            feed={data?.feed ?? EMPTY}
            pageviews={data?.pageviews ?? 0}
          />
        </div>

        {/* Left Column Stack (Mobile: order-2 below globe! Desktop: order-1 on the left) */}
        <div className="flex flex-col gap-2.5 sm:gap-3 min-w-0 h-full overflow-hidden order-2 lg:order-1">
          
          {/* Top: Live Pages & Hits Card */}
          <div className="gloss-card animate-fade-up rounded-2xl sm:rounded-3xl border border-border bg-card p-3 sm:p-3.5 shadow-xs flex flex-col flex-1 min-h-[260px] lg:min-h-0 overflow-hidden">
            <div className="flex items-center justify-between pb-2 border-b border-border/60 shrink-0">
              {/* Dual Tab Switcher */}
              <div className="flex items-center gap-1 p-0.5 rounded-xl border border-border bg-muted/40">
                <button
                  type="button"
                  onClick={() => setLeftTab("pages")}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                    leftTab === "pages"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileText className="h-3 w-3" />
                  <span>Live Pages ({data?.activePages?.length ?? 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLeftTab("hits")}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                    leftTab === "hits"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ActivityIcon className="h-3 w-3" />
                  <span>Live Hits ({data?.feed?.length ?? 0})</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider hidden sm:inline">
                  Live
                </span>
              </div>
            </div>

            {/* Tab 1: Live Active Pages */}
            {leftTab === "pages" && (
              <div className="mt-2 flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-thin space-y-1.5">
                  {!data?.activePages || data.activePages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground">Waiting for live pageviews...</p>
                      <p className="text-[11px] mt-1 text-muted-foreground/80">Active pages will display here live</p>
                    </div>
                  ) : (
                    data.activePages.map((pg, idx) => {
                      const total = data?.activeVisitors || 1;
                      const pct = Math.min(100, Math.round((pg.visitors / total) * 100));
                      return (
                        <div
                          key={pg.path || idx}
                          className="space-y-1 rounded-xl p-2 bg-muted/20 hover:bg-muted/40 transition-colors border border-border/40"
                        >
                          <div className="flex items-center justify-between text-xs gap-2">
                            <span className="font-mono text-foreground font-semibold truncate text-[11px] sm:text-xs" title={pg.path}>
                              {pg.path}
                            </span>
                            <span className="font-bold text-foreground shrink-0 tabular-nums text-xs">
                              {pg.visitors} {pg.visitors === 1 ? "visitor" : "visitors"}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500"
                              style={{ width: `${Math.max(6, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Live Activity Feed */}
            {leftTab === "hits" && (
              <div className="mt-2 flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-thin">
                {data?.feed && data.feed.length > 0 ? (
                  <ActivityFeed items={data.feed} limit={24} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-xs text-muted-foreground">
                    <p>Waiting for live hits...</p>
                    <p className="text-[11px] mt-1 text-muted-foreground/80">Pageviews will stream here live</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom: Page views (MinuteBars) Card */}
          <div className="gloss-card animate-fade-up rounded-2xl sm:rounded-3xl border border-border bg-card p-3 sm:p-3.5 shadow-xs shrink-0">
            <MinuteBars minutes={data?.minutes ?? []} pageviews={data?.pageviews ?? 0} windowMinutes={windowMinutes} />
          </div>
        </div>

      </div>
    </div>
  );
}

function PageHeaderish() {
  return (
    <div className="space-y-0.5 sm:space-y-1">
      <h1 className="font-heading text-lg font-bold tracking-tight sm:text-2xl">Realtime visitors</h1>
      <p className="text-xs text-muted-foreground sm:text-[13px]">
        See where your website visitors are from, in real time.
      </p>
    </div>
  );
}
