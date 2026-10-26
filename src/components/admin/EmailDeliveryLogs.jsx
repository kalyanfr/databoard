import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Check, RefreshCw, Search, Loader2 } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";

export default function EmailDeliveryLogs() {
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-email-logs"],
    queryFn: async () => {
      const res = await webrader.functions.invoke("email", { action: "get_logs" });
      return res?.data?.logs || [];
    },
    staleTime: 15000,
  });

  const filteredLogs = logs.filter((log) => {
    if (filterType !== "all") {
      if (filterType === "drip" && log.type !== "Automated Drip") return false;
      if (filterType === "broadcast" && log.type !== "Broadcast") return false;
      if (filterType === "test" && log.type !== "Test") return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchRecipient = (log.recipient || "").toLowerCase().includes(q);
      const matchSubject = (log.subject || "").toLowerCase().includes(q);
      return matchRecipient || matchSubject;
    }
    return true;
  });

  return (
    <div className="space-y-3.5">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by email or subject..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 rounded-lg font-mono text-xs bg-background border-input text-foreground focus-visible:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1">
            {[
              { id: "all", label: "All" },
              { id: "drip", label: "Founder Drips" },
              { id: "broadcast", label: "Broadcasts" },
              { id: "test", label: "Tests" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  filterType === f.id
                    ? "bg-blue-600 text-white shadow-xs"
                    : "border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-8 rounded-lg px-3 gap-1.5 text-xs font-medium border-border bg-background text-foreground hover:bg-muted self-start sm:self-auto"
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Logs Table / Cards */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="flex h-36 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Mail className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="font-heading text-sm font-semibold text-foreground">No email logs found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Delivered onboarding drips, broadcasts, and SMTP test sends will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Recipient</th>
                  <th className="py-2.5 px-4">Subject / Step</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Delivered at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredLogs.map((log) => {
                  let badgeClass = "border-border bg-muted text-muted-foreground";

                  if (log.type === "Automated Drip") {
                    badgeClass = "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400";
                  } else if (log.type === "Broadcast") {
                    badgeClass = "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";
                  }

                  return (
                    <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-4">
                        <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-medium border ${badgeClass}`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-foreground">
                        {log.recipient}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-muted-foreground">
                        {log.subject}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                          <Check className="h-3 w-3" />
                          Delivered
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[11px] text-muted-foreground">
                        {formatDate(log.sent_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
