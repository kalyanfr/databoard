import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Bot } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import EmptyState from "@/components/common/EmptyState";
import { ErrorState, LoadingBlock } from "@/components/common/LoadingBlock";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import BreakdownTable from "@/components/analytics/BreakdownTable";
import FiltersBar from "@/components/analytics/FiltersBar";
import GettingStartedCard from "@/components/projects/GettingStartedCard";
import AiCrawlersTab from "@/components/analytics/AiCrawlersTab";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUTO_EVENT_NAMES } from "@/lib/events";
import { groupRows, rowCount, rowSum } from "@/lib/aggregate";
import { useActiveProject, useRange } from "@/lib/filters";
import { cn } from "@/lib/utils";

const DIMENSIONS = {
  pages: { label: "Pages", entity: "Event", timeField: "timestamp", groupBy: "path", metric: "Pageviews", query: { type: "pageview" } },
  sources: { label: "Traffic sources", entity: "Session", timeField: "started_at", groupBy: "referrer_domain", metric: "Sessions" },
  channels: { label: "Channels", entity: "Session", timeField: "started_at", groupBy: "channel", metric: "Sessions" },
  campaigns: { label: "UTM campaigns", entity: "Session", timeField: "started_at", groupBy: "utm_campaign", metric: "Sessions" },
  countries: { label: "Countries", entity: "Session", timeField: "started_at", groupBy: "country", metric: "Sessions" },
  devices: { label: "Devices", entity: "Session", timeField: "started_at", groupBy: "device", metric: "Sessions" },
  browsers: { label: "Browsers", entity: "Session", timeField: "started_at", groupBy: "browser", metric: "Sessions" },
  os: { label: "Operating systems", entity: "Session", timeField: "started_at", groupBy: "os", metric: "Sessions" },
  events: { label: "Conversion events", entity: "Event", timeField: "timestamp", groupBy: "name", metric: "Events", query: { type: "event", name: { $nin: AUTO_EVENT_NAMES } }, money: true },
  outbound: { label: "Outbound links", entity: "Event", timeField: "timestamp", groupBy: "target", metric: "Clicks", query: { type: "event", name: "outbound_link" } },
  downloads: { label: "File downloads", entity: "Event", timeField: "timestamp", groupBy: "target", metric: "Downloads", query: { type: "event", name: "file_download" } },
  forms: { label: "Form submissions", entity: "Event", timeField: "timestamp", groupBy: "target", metric: "Submissions", query: { type: "event", name: "form_submit" } },
};

export default function Analytics() {
  const { project, isLoading, error, refetch } = useActiveProject();
  const range = useRange();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "crawlers" ? "crawlers" : "traffic";
  const [dimension, setDimension] = useState("pages");
  const config = DIMENSIONS[dimension];

  const setTab = (tab) => {
    if (tab === "crawlers") {
      setSearchParams({ tab: "crawlers" });
    } else {
      setSearchParams({});
    }
  };

  const query = useQuery({
    queryKey: ["breakdown", project?.id, dimension, range.from, range.to],
    enabled: !!project && activeTab === "traffic",
    queryFn: async () => {
      const result = await webrader.entities[config.entity].aggregate({
        query: {
          project_id: project.project_id,
          [config.timeField]: { $gte: range.from, $lt: range.to },
          ...(config.query ?? {}),
        },
        groupBy: config.groupBy,
        sum: config.money ? ["revenue"] : undefined,
        sort: "-count",
        limit: 50,
      });
      return groupRows(result)
        .map((row) => ({
          label: row[config.groupBy] || "Unknown",
          value: rowCount(row),
          revenue: config.money ? rowSum(row, "revenue") : undefined,
        }))
        .filter((row) => row.value > 0);
    },
    refetchInterval: 30000,
  });

  if (isLoading) return <LoadingBlock rows={3} />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  if (!project) {
    return (
      <>
        <PageHeader title="Analytics" description="Every breakdown, one filter set." />
        <GettingStartedCard />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`${project.name} · ${activeTab === "crawlers" ? "Generative Engine Optimization (GEO)" : range.label}`}
      >
        <FiltersBar onRefresh={query.refetch} refreshing={query.isFetching} />
      </PageHeader>

      {/* Segment Switcher Tabs: Web Traffic vs AI Crawlers */}
      <div className="flex items-center gap-2 mb-6">
        <div className="inline-flex items-center p-1 rounded-2xl bg-muted/60 border border-border">
          <button
            type="button"
            onClick={() => setTab("traffic")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all",
              activeTab === "traffic"
                ? "bg-background text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            <span>Web Traffic & Breakdowns</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("crawlers")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all",
              activeTab === "crawlers"
                ? "bg-background text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bot className="h-3.5 w-3.5 text-purple-400" />
            <span>AI Crawlers & GEO</span>
            <span className="rounded bg-purple-500/15 text-purple-400 border border-purple-500/30 px-1 py-0.2 text-[9px] font-bold">
              BOT TELEMETRY
            </span>
          </button>
        </div>
      </div>

      {activeTab === "crawlers" ? (
        <AiCrawlersTab />
      ) : (
        <SectionCard
          title="Breakdown"
          description={`${config.label} · ${range.label}`}
          action={
            <Select value={dimension} onValueChange={setDimension}>
              <SelectTrigger className="h-9 w-[190px] rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DIMENSIONS).map(([id, item]) => (
                  <SelectItem key={id} value={id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        >
          {query.isLoading ? (
            <LoadingBlock rows={2} />
          ) : query.error ? (
            <ErrorState error={query.error} onRetry={query.refetch} />
          ) : (query.data ?? []).length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title={`No ${config.label.toLowerCase()} yet`}
              description="Once visitors arrive, this table fills up automatically."
            />
          ) : (
            <BreakdownTable rows={query.data} metric={config.metric} money={config.money} limit={25} title={config.label} />
          )}
        </SectionCard>
      )}
    </>
  );
}
