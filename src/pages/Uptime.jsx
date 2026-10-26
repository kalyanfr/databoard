import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import EmptyState from "@/components/common/EmptyState";
import { ErrorState, LoadingBlock } from "@/components/common/LoadingBlock";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import MonitorDialog from "@/components/uptime/MonitorDialog";
import MonitorHistory from "@/components/uptime/MonitorHistory";
import MonitorList from "@/components/uptime/MonitorList";
import UptimeStats from "@/components/uptime/UptimeStats";
import TrackingSnippet from "@/components/projects/TrackingSnippet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useActiveProject, useProjects } from "@/lib/filters";

export default function Uptime() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { project } = useActiveProject();
  const { data: userProjects = [] } = useProjects();
  const [selected, setSelected] = useState(null);
  const [running, setRunning] = useState(false);
  const [showInstall, setShowInstall] = useState(false);

  // Uptime monitoring configured to check every 10 seconds
  const query = useQuery({
    queryKey: ["monitors"],
    queryFn: async () => {
      const page = await webrader.entities.Monitor.filter({}, { sort: "-created_date", limit: 50 });
      return page.items ?? [];
    },
    refetchInterval: 10000,
  });

  const monitors = query.data ?? [];
  const selectedMonitor = monitors.find((monitor) => monitor.id === selected?.id) ?? null;
  const isDomainVerified = project?.status === "verified";

  // Automated 10-second check loop when monitors exist
  useEffect(() => {
    if (!monitors.length) return;
    const interval = setInterval(() => {
      webrader.functions.invoke("runUptimeChecks", {}).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [monitors.length]);

  // Auto-sync: ensure any user project has a corresponding Uptime monitor
  useEffect(() => {
    if (!userProjects || !userProjects.length) return;
    (async () => {
      let createdAny = false;
      for (const p of userProjects) {
        const pDom = (p.domain || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
        if (!pDom) continue;
        const exists = (monitors || []).some((m) => {
          const mDom = (m.url || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
          return mDom === pDom || m.project_id === p.project_id || m.project_id === p.id;
        });
        if (!exists) {
          try {
            await webrader.entities.Monitor.create({
              name: p.name || pDom,
              url: `https://${pDom}`,
              project_id: p.project_id || p.id,
              interval_seconds: 10,
              expected_status_code: 200,
              status: "up",
            });
            createdAny = true;
          } catch (e) {
            console.warn("[Uptime sync on load]:", e);
          }
        }
      }
      if (createdAny) {
        queryClient.invalidateQueries({ queryKey: ["monitors"] });
      }
    })();
  }, [userProjects, monitors.length]);

  const runAll = async () => {
    setRunning(true);
    try {
      const response = await webrader.functions.invoke("runUptimeChecks", {});
      const data = response.data ?? {};
      toast({
        title: data.checked ? `Checked ${data.checked} monitor${data.checked === 1 ? "" : "s"}` : "Nothing to check yet",
        description: data.checked
          ? data.alerts
            ? `${data.alerts} alert email${data.alerts === 1 ? "" : "s"} sent.`
            : "All endpoints responded normally (10s checks active)."
          : "Checks run automatically every 10 seconds.",
      });
      await queryClient.invalidateQueries({ queryKey: ["monitors"] });
      await queryClient.invalidateQueries({ queryKey: ["monitor-checks"] });
    } catch (error) {
      toast({ title: "Could not run the checks", description: error?.message ?? "Try again in a moment.", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Uptime"
        description="Every URL you watch, checked every 10 seconds around the clock — with an email the moment one goes down."
      >
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" className="gap-2 rounded-xl text-xs sm:text-sm h-9" onClick={runAll} disabled={running || !monitors.length}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Run checks now
          </Button>
          <MonitorDialog onSaved={runAll} />
        </div>
      </PageHeader>

      {/* Domain ownership verification required banner */}
      {project && !isDomainVerified ? (
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
                Uptime monitoring requires verified domain ownership on <span className="font-medium text-foreground">{project.domain}</span>. Verify ownership to activate 24/7 uptime monitoring.
              </p>
            </div>
            <Button size="sm" className="shrink-0 rounded-xl" onClick={() => setShowInstall((v) => !v)}>
              {showInstall ? "Hide instructions" : "Show install instructions"}
            </Button>
          </div>
          {showInstall ? <div className="mt-5"><TrackingSnippet project={project} /></div> : null}
        </div>
      ) : null}

      {query.isLoading ? (
        <LoadingBlock rows={3} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : !monitors.length ? (
        <EmptyState
          icon={!isDomainVerified ? ShieldAlert : Activity}
          title={!isDomainVerified ? "Domain verification required for Uptime" : "No monitors yet"}
          description={
            !isDomainVerified
              ? `Please verify domain ownership for ${project?.domain || "your website"} before adding uptime monitors.`
              : "Add the pages that must never go down. We check each one every 10 seconds and email you within seconds of a failure."
          }
        >
          {!isDomainVerified && project ? (
            <Button className="rounded-xl" onClick={() => setShowInstall(true)}>
              Install snippet & verify domain
            </Button>
          ) : (
            <MonitorDialog onSaved={runAll} />
          )}
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <UptimeStats monitors={monitors} />

          <SectionCard
            title="Monitors"
            description="Checked every 10 seconds · alerts are emailed instantly"
            className="animate-fade-up"
          >
            <MonitorList monitors={monitors} onSelect={setSelected} selectedId={selectedMonitor?.id} />
          </SectionCard>

          {selectedMonitor ? (
            <SectionCard title={`History · ${selectedMonitor.name}`} description={selectedMonitor.url}>
              <MonitorHistory monitor={selectedMonitor} />
            </SectionCard>
          ) : null}
        </div>
      )}
    </>
  );
}
