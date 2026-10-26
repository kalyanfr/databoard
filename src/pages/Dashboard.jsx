import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, ShieldAlert } from "lucide-react";
import { webrader, supabase } from "@/api/webraderClient";
import EmptyState from "@/components/common/EmptyState";
import { ErrorState, LoadingBlock } from "@/components/common/LoadingBlock";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import BreakdownTable from "@/components/analytics/BreakdownTable";
import FiltersBar from "@/components/analytics/FiltersBar";
import StatsGrid from "@/components/analytics/StatsGrid";
import TrendChart from "@/components/analytics/TrendChart";
import GettingStartedCard from "@/components/projects/GettingStartedCard";
import TrackingSnippet from "@/components/projects/TrackingSnippet";
import ShareDashboardDialog from "@/components/projects/ShareDashboardDialog";
import { Button } from "@/components/ui/button";
import { bucketDay, groupRows, rowAvg, rowCount, rowSum } from "@/lib/aggregate";
import { useActiveProject, useRange } from "@/lib/filters";
import { AUTO_EVENT_NAMES } from "@/lib/events";
import { buildSeries } from "@/lib/ranges";
import { utcDay } from "@/lib/ranges";

const VISITOR_SERIES = [{ id: "visitors", key: "visitors", label: "Visitors", color: "hsl(var(--chart-1))" }];

async function loadDashboard(projectKey, range) {
  const eventQuery = { project_id: projectKey, timestamp: { $gte: range.from, $lt: range.to } };
  const sessionQuery = { project_id: projectKey, started_at: { $gte: range.from, $lt: range.to } };
  const visitorQuery = { project_id: projectKey, date: { $gte: utcDay(range.from), $lte: utcDay(range.to) } };

  const [
    byType,
    sessionRows,
    visitorBuckets,
    visitors,
    pages,
    scrollRows,
    engagedRows,
    conversionCount,
  ] = await Promise.all([
    webrader.entities.Event.aggregate({ query: eventQuery, groupBy: "type", sum: ["revenue"] }),
    webrader.entities.Session.aggregate({ query: sessionQuery, groupBy: "is_bounce", avg: ["duration_seconds"] }),
    webrader.entities.VisitorDay.aggregate({ query: visitorQuery, dateBucket: { field: "date", unit: "day" } }),
    webrader.entities.VisitorDay.count(visitorQuery),
    webrader.entities.Event.aggregate({
      query: { ...eventQuery, type: "pageview" },
      groupBy: "path",
      sort: "-count",
      limit: 8,
    }),
    webrader.entities.Event.aggregate({
      query: { ...eventQuery, type: "event", name: "scroll_depth" },
      groupBy: "project_id",
      avg: ["scroll_depth"],
    }),
    webrader.entities.Event.aggregate({
      query: { ...eventQuery, type: "event", name: "engaged_time" },
      groupBy: "project_id",
      avg: ["engaged_seconds"],
    }),
    webrader.entities.Event.count({ ...eventQuery, type: "event", name: { $nin: AUTO_EVENT_NAMES } }),
  ]);

  const typeRows = groupRows(byType);
  const bounceRows = groupRows(sessionRows);
  const sessions = bounceRows.reduce((total, row) => total + rowCount(row), 0);
  const bounces = bounceRows.filter((row) => row.is_bounce === true).reduce((total, row) => total + rowCount(row), 0);
  const duration = bounceRows.reduce(
    (acc, row) => {
      const average = rowAvg(row, "duration_seconds");
      const count = rowCount(row);
      if (average === null || !count) return acc;
      return { total: acc.total + average * count, count: acc.count + count };
    },
    { total: 0, count: 0 },
  );

  const visitorByDay = new Map(groupRows(visitorBuckets).map((row) => [bucketDay(row), rowCount(row)]));

  return {
    totals: {
      visitors,
      pageviews: rowCount(typeRows.find((row) => row.type === "pageview")),
      conversions: conversionCount,
      revenue: typeRows.reduce((total, row) => total + rowSum(row, "revenue"), 0),
      sessions,
      bounceRate: sessions ? bounces / sessions : 0,
      avgDuration: duration.count ? Math.round(duration.total / duration.count) : 0,
      avgScrollDepth: rowAvg(groupRows(scrollRows)[0] ?? {}, "scroll_depth"),
      avgEngaged: rowAvg(groupRows(engagedRows)[0] ?? {}, "engaged_seconds"),
    },
    series: buildSeries(
      [...visitorByDay.entries()].map(([date, visitors]) => ({ date, visitors })),
      range.from,
      range.to,
    ),
    pages: groupRows(pages).map((row) => ({ label: row.path || "/", value: rowCount(row) })),
  };
}

export default function Dashboard() {
  const { project, projects, isLoading, error, refetch } = useActiveProject();
  const range = useRange();
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    setShowInstall(false);
  }, [project?.id]);

  const query = useQuery({
    queryKey: ["dashboard", project?.id, range.from, range.to],
    enabled: !!project,
    queryFn: () => loadDashboard(project.project_id, range),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    staleTime: 0,
  });

  const refetchRef = useRef(query.refetch);
  useEffect(() => {
    refetchRef.current = query.refetch;
  });

  useEffect(() => {
    if (!project) return;
    const heartbeat = setInterval(() => {
      refetchRef.current?.();
    }, 5000);
    return () => clearInterval(heartbeat);
  }, [project?.id, range.from, range.to]);

  useEffect(() => {
    if (!project?.project_id) return;
    try {
      const channel = supabase
        .channel(`dashboard-events-stream-${project.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "events",
            filter: `project_id=eq.${project.project_id}`,
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
  }, [project?.id, project?.project_id]);

  if (isLoading) return <LoadingBlock rows={3} />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  if (!project) {
    return (
      <>
        <PageHeader title="Dashboard" description="Privacy-first website analytics for your projects." />
        <GettingStartedCard />
      </>
    );
  }

  const totals = query.data?.totals;
  const empty = totals ? totals.pageviews === 0 && totals.sessions === 0 : false;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${project.name} · ${range.label}`}
        action={<ShareDashboardDialog project={project} />}
      >
        <FiltersBar onRefresh={query.refetch} refreshing={query.isFetching} />
      </PageHeader>

      {project.status !== "verified" ? (
        <div className="gloss-card animate-fade-up mb-6 rounded-3xl p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-primary" />
                <h3 className="text-sm font-semibold">Domain ownership verification required</h3>
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Pending
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Install the snippet on <span className="font-medium text-foreground">{project.domain}</span> and verify
                ownership to start collecting analytics.
              </p>
            </div>
            <Button size="sm" className="shrink-0 rounded-xl" onClick={() => setShowInstall((value) => !value)}>
              {showInstall ? "Hide instructions" : "Show install instructions"}
            </Button>
          </div>
          {showInstall ? <div className="mt-5">{<TrackingSnippet project={project} />}</div> : null}
        </div>
      ) : null}

      {query.isLoading ? (
        <LoadingBlock rows={2} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : empty ? (
        <EmptyState
          icon={project.status === "verified" ? Activity : ShieldAlert}
          title={project.status === "verified" ? "Waiting for the first visit" : "No traffic recorded yet"}
          description={`Load a page on ${project.domain} with the snippet installed — your first pageview usually arrives within seconds.`}
        >
          <Button asChild className="rounded-xl">
            <Link to={`/projects/${project.id}`}>Get the snippet</Link>
          </Button>
        </EmptyState>
      ) : totals ? (
        <div className="space-y-6">
          <StatsGrid totals={totals} />

          <SectionCard title="Visitors" description={`Unique visitors per day · ${range.label}`}>
            <TrendChart data={query.data.series} series={VISITOR_SERIES} />
          </SectionCard>

          <SectionCard
            title="Top pages"
            description="Most viewed pages in this period"
            action={
              <Button asChild variant="ghost" size="sm" className="gap-1.5 rounded-lg text-muted-foreground">
                <Link to="/analytics">All breakdowns</Link>
              </Button>
            }
          >
            <BreakdownTable rows={query.data.pages} metric="Pageviews" limit={6} title="Top Pages" />
          </SectionCard>

          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            {projects.length} project{projects.length === 1 ? "" : "s"} · data kept for {project.retention_days} days
          </p>
        </div>
      ) : null}
    </>
  );
}