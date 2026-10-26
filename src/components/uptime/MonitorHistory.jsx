import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import EmptyState from "@/components/common/EmptyState";
import { LoadingBlock } from "@/components/common/LoadingBlock";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { groupRows, rowCount } from "@/lib/aggregate";
import { relativeTime } from "@/lib/format";

/** Recent checks plus the uptime rate for one monitor. */
export default function MonitorHistory({ monitor }) {
  const query = useQuery({
    queryKey: ["monitor-checks", monitor?.id],
    enabled: !!monitor?.id,
    queryFn: async () => {
      const [page, buckets] = await Promise.all([
        webrader.entities.MonitorCheck.filter({ monitor_id: monitor.id }, { sort: "-checked_at", limit: 30 }),
        webrader.entities.MonitorCheck.aggregate({ query: { monitor_id: monitor.id }, groupBy: "ok" }),
      ]);
      return { items: page.items ?? [], buckets: groupRows(buckets) };
    },
    refetchInterval: 60000,
  });

  const items = query.data?.items ?? [];
  const up = query.data?.buckets?.find((row) => row.ok === true || row.status === "up" || row.key === true || row.key === "true");
  const down = query.data?.buckets?.find((row) => row.ok === false || row.status === "down" || row.key === false || row.key === "false");
  const upCount = up ? rowCount(up) : items.filter((check) => check.status === "up" || check.ok === true).length;
  const downCount = down ? rowCount(down) : items.filter((check) => check.status === "down" || check.ok === false).length;
  const total = upCount + downCount;
  const rate = total ? ((upCount / total) * 100).toFixed(1) : (items.length ? "100.0" : null);

  if (query.isLoading) return <LoadingBlock rows={2} />;
  if (!items.length) {
    return (
      <EmptyState
        icon={History}
        title="No checks recorded yet"
        description="Checks run automatically every few minutes, or press Check now on the monitor."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge
          variant="outline"
          className="rounded-lg border-emerald-500/30 bg-emerald-500/10 text-[11px] font-semibold text-emerald-400"
        >
          Uptime {rate}%
        </Badge>
        <span className="text-xs text-muted-foreground">
          {upCount} up · {downCount} down · last 30 checks
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Checked</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>HTTP</TableHead>
              <TableHead>Response</TableHead>
              <TableHead className="hidden sm:table-cell">Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((check) => {
              const isUp =
                String(check.status || "").toLowerCase() === "up" ||
                check.ok === true ||
                (Number(check.status_code) >= 200 && Number(check.status_code) < 400);

              return (
                <TableRow key={check.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {relativeTime(check.checked_at)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                        isUp ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isUp ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                        }`}
                      />
                      {isUp ? "Up" : "Down"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs font-medium tabular-nums">{check.status_code || "—"}</TableCell>
                  <TableCell className="text-xs font-medium tabular-nums">{check.response_ms ? `${check.response_ms} ms` : "—"}</TableCell>
                  <TableCell className="hidden max-w-[240px] truncate text-xs text-muted-foreground sm:table-cell">
                    {check.error || "OK"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}