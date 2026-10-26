import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw, ShieldAlert } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import EmptyState from "@/components/common/EmptyState";
import { ErrorState, LoadingBlock } from "@/components/common/LoadingBlock";
import SectionCard from "@/components/common/SectionCard";
import MonitorList from "@/components/uptime/MonitorList";
import UptimeStats from "@/components/uptime/UptimeStats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { relativeTime } from "@/lib/format";

export default function AdminMonitors() {
  const { toast } = useToast();

  const monitors = useQuery({
    queryKey: ["monitors"],
    queryFn: async () => {
      const page = await webrader.entities.Monitor.filter({}, { sort: "-created_date", limit: 100 });
      return page.items ?? [];
    },
    refetchInterval: 60000,
  });

  const incidents = useQuery({
    queryKey: ["admin-incidents"],
    queryFn: async () => {
      const page = await webrader.entities.MonitorCheck.filter({ status: "down" }, { sort: "-checked_at", limit: 15 });
      return page.items ?? [];
    },
    refetchInterval: 60000,
  });

  const runAll = async () => {
    try {
      const response = await webrader.functions.invoke("runUptimeChecks", {});
      const data = response.data ?? {};
      toast({
        title: data.checked ? `Checked ${data.checked} monitor${data.checked === 1 ? "" : "s"}` : "Nothing to check yet",
        description: data.alerts ? `${data.alerts} alert email(s) sent.` : "No alerts needed right now.",
      });
      monitors.refetch();
      incidents.refetch();
    } catch (error) {
      toast({ title: "Could not run the checks", description: error?.message ?? "Try again.", variant: "destructive" });
    }
  };

  const list = monitors.data ?? [];

  return (
    <>
      <div className="flex justify-end">
        <Button variant="outline" className="w-full sm:w-auto gap-2 rounded-xl" onClick={runAll}>
          <RefreshCw className="h-4 w-4" />
          Run all checks now
        </Button>
      </div>

      {monitors.isLoading ? (
        <LoadingBlock rows={2} />
      ) : monitors.error ? (
        <ErrorState error={monitors.error} onRetry={monitors.refetch} />
      ) : !list.length ? (
        <EmptyState
          icon={Activity}
          title="No monitors in the workspace"
          description="Users add monitors from their Uptime page — they show up here with the owner and current state."
        />
      ) : (
        <>
          <UptimeStats monitors={list} />
          <SectionCard title="All monitors" description="Every site watched by this workspace, with the owner">
            <MonitorList monitors={list} showOwner onChanged={() => monitors.refetch()} />
          </SectionCard>
        </>
      )}

      <SectionCard title="Recent incidents" description="Failed checks across the workspace">
        {incidents.isLoading ? (
          <LoadingBlock rows={1} />
        ) : (incidents.data ?? []).length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No failed checks — everything answered normally.</p>
        ) : (
          <>
            {/* Mobile Incident Cards View */}
            <div className="space-y-2.5 sm:hidden">
              {(incidents.data ?? []).map((check) => (
                <div key={check.id} className="rounded-2xl border border-border bg-card/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground truncate">{check.monitor_id}</span>
                    <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-[10px]">
                      HTTP {check.status_code || "FAIL"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{relativeTime(check.checked_at)}</span>
                    <span className="truncate max-w-[180px] text-right">{check.error || "Connection error"}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto rounded-2xl border border-border">
              <Table className="min-w-[460px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Monitor</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead className="hidden sm:table-cell">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(incidents.data ?? []).map((check) => (
                    <TableRow key={check.id} className="hover:bg-muted/20">
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {relativeTime(check.checked_at)}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{check.monitor_id}</TableCell>
                      <TableCell className="text-xs tabular-nums">{check.status_code || "—"}</TableCell>
                      <TableCell className="hidden max-w-[260px] truncate text-xs text-muted-foreground sm:table-cell">
                        {check.error || <ShieldAlert className="h-3.5 w-3.5" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </SectionCard>
    </>
  );
}
