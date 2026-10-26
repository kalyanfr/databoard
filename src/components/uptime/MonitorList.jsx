import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BellRing, History, Loader2, Pause, Pencil, Play, RefreshCw } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import ConfirmDeleteButton from "@/components/common/ConfirmDeleteButton";
import MonitorDialog from "@/components/uptime/MonitorDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS = {
  up: { label: "Up", dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]", badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold" },
  down: { label: "Down", dot: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]", badge: "border-rose-500/30 bg-rose-500/10 text-rose-400 font-semibold" },
  paused: { label: "Paused", dot: "bg-muted-foreground/50", badge: "border-border text-muted-foreground" },
};

/** Monitor rows with the per-monitor actions. */
export default function MonitorList({ monitors, showOwner, onChanged, onSelect, selectedId }) {
  const [busyId, setBusyId] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["monitors"] });
    await queryClient.invalidateQueries({ queryKey: ["monitor-checks"] });
    onChanged?.();
  };

  const runCheck = async (monitor) => {
    setBusyId(monitor.id);
    try {
      const response = await webrader.functions.invoke("runUptimeChecks", { monitor_id: monitor.id });
      const data = response.data ?? {};
      const result = data.results?.find((r) => r.id === monitor.id) || data.results?.[0];
      const isUp = result ? result.ok : monitor.status === "up";
      toast({
        title: isUp ? `${monitor.name} is up` : `${monitor.name} is not answering`,
        description: result
          ? `${result.status ? `HTTP ${result.status} · ` : ""}${result.ms ? `${result.ms} ms` : ""}${isUp ? " · all checks passing" : (result.error ? ` · ${result.error}` : " · alert email on its way")}`
          : "Checked successfully.",
      });
      await refresh();
    } catch (error) {
      toast({ title: "Check failed", description: error?.message ?? "Try again in a moment.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const sendTest = async (monitor) => {
    setBusyId(monitor.id);
    try {
      const response = await webrader.functions.invoke("runUptimeChecks", { monitor_id: monitor.id, test: true });
      const data = response.data ?? {};
      toast({
        title: "Test alert sent",
        description: data.sent_to ? `Delivered to ${data.sent_to}.` : "Check the address on this monitor.",
      });
    } catch (error) {
      toast({ title: "Test alert failed", description: error?.message ?? "Try again in a moment.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const togglePause = async (monitor) => {
    setBusyId(monitor.id);
    try {
      await webrader.entities.Monitor.update(monitor.id, { status: monitor.status === "paused" ? "up" : "paused" });
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (monitor) => {
    setBusyId(monitor.id);
    try {
      await webrader.entities.MonitorCheck.deleteMany({ monitor_id: monitor.id });
      await webrader.entities.Monitor.delete(monitor.id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      {monitors.map((monitor) => {
        const status = STATUS[monitor.status] ?? STATUS.up;
        const busy = busyId === monitor.id;
        return (
          <div
            key={monitor.id}
            className={cn(
              "gloss-card rounded-2xl p-4 transition-shadow",
              selectedId === monitor.id && "ring-1 ring-inset ring-primary/30",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="relative mt-1.5 inline-flex h-2.5 w-2.5 shrink-0">
                  {monitor.status === "down" ? (
                    <span className="absolute inset-0 animate-pulse-ring rounded-full bg-destructive/70" />
                  ) : null}
                  <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", status.dot)} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-heading text-sm font-semibold tracking-tight">{monitor.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{monitor.url}</p>
                  {showOwner && monitor.owner_email ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">Owner · {monitor.owner_email}</p>
                  ) : null}
                </div>
              </div>
              <Badge variant="outline" className={cn("rounded-lg text-[10px] uppercase tracking-wider", status.badge)}>
                {status.label}
              </Badge>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Last check</dt>
                <dd className="mt-0.5 font-medium">{monitor.last_checked_at ? relativeTime(monitor.last_checked_at) : "Not checked yet"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Response</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {monitor.last_response_ms ? `${monitor.last_response_ms} ms` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">HTTP</dt>
                <dd className="mt-0.5 font-medium tabular-nums">{monitor.last_status_code || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Alerts to</dt>
                <dd className="mt-0.5 truncate font-medium">{monitor.alert_email || monitor.owner_email || "—"}</dd>
              </div>
            </dl>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-xs" disabled={busy} onClick={() => runCheck(monitor)}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Check now
              </Button>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg text-xs text-muted-foreground" disabled={busy} onClick={() => sendTest(monitor)}>
                <BellRing className="h-3.5 w-3.5" />
                Test alert
              </Button>
              {onSelect ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 rounded-lg text-xs text-muted-foreground"
                  onClick={() => onSelect(monitor)}
                >
                  <History className="h-3.5 w-3.5" />
                  History
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg text-xs text-muted-foreground" disabled={busy} onClick={() => togglePause(monitor)}>
                {monitor.status === "paused" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                {monitor.status === "paused" ? "Resume" : "Pause"}
              </Button>
              <MonitorDialog
                monitor={monitor}
                onSaved={refresh}
                trigger={
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg text-xs text-muted-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                }
              />
              <ConfirmDeleteButton
                title={`Delete ${monitor.name}?`}
                description="The monitor and its check history are removed. You can add it again later."
                pending={busy}
                onConfirm={() => remove(monitor)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}