import { useQuery } from "@tanstack/react-query";
import { Activity, FolderKanban, Mail, RefreshCw, Users, Settings2, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { webrader } from "@/api/webraderClient";
import { ErrorState, LoadingBlock } from "@/components/common/LoadingBlock";
import SectionCard from "@/components/common/SectionCard";
import StatCard from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { useToast } from "@/components/ui/use-toast";

const WEEK_MS = 7 * 86400000;

export default function AdminOverview() {
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const since = new Date(Date.now() - WEEK_MS).toISOString();
      const [users, projects, events, monitors, monitorsDown, campaigns] = await Promise.all([
        webrader.entities.User.list(),
        webrader.entities.Project.count({}),
        webrader.entities.Event.count({ timestamp: { $gte: since } }),
        webrader.entities.Monitor.count({}),
        webrader.entities.Monitor.count({ status: "down" }),
        webrader.entities.EmailCampaign.filter({}, { limit: 100 }),
      ]);
      const userCount = Array.isArray(users) ? users.length : users?.items?.length ?? 0;
      const list = campaigns.items ?? [];
      const sent = list.filter((campaign) => campaign.status === "sent");
      return {
        users: userCount,
        admins: (Array.isArray(users) ? users : users?.items ?? []).filter((record) => record.role === "admin").length,
        projects,
        events: projects === 0 ? 0 : events,
        monitors,
        monitorsDown,
        campaignsSent: sent.length,
        emailsDelivered: sent.reduce((total, campaign) => total + (campaign.recipient_count ?? 0), 0),
      };
    },
    refetchInterval: 60000,
  });

  const runChecks = async () => {
    try {
      const response = await webrader.functions.invoke("runUptimeChecks", {});
      const data = response.data ?? {};
      toast({
        title: data.checked ? `Checked ${data.checked} monitor${data.checked === 1 ? "" : "s"}` : "Nothing to check yet",
        description: data.alerts ? `${data.alerts} alert email(s) sent.` : "No alerts needed right now.",
      });
      query.refetch();
    } catch (error) {
      toast({ title: "Could not run the checks", description: error?.message ?? "Try again.", variant: "destructive" });
    }
  };

  if (query.isLoading) return <LoadingBlock rows={2} />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const data = query.data;
  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0 max-w-full">
      <div className="grid w-full min-w-0 max-w-full grid-cols-2 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
        <StatCard label="Users" value={formatNumber(data.users)} hint={`${data.admins} admin(s)`} icon={Users} tone="violet" />
        <StatCard label="Projects" value={formatNumber(data.projects)} hint="Tracked sites" icon={FolderKanban} tone="blue" delay={70} />
        <StatCard label="Events · 7d" value={formatNumber(data.events)} hint="Pageviews & hits" icon={Activity} tone="teal" delay={140} />
        <StatCard label="Monitors" value={formatNumber(data.monitors)} hint={`${data.monitorsDown} down now`} icon={Activity} tone="pink" delay={210} />
        <StatCard label="Administrators" value={formatNumber(data.admins)} hint="Root admin accounts" icon={ShieldCheck} tone="blue" delay={280} />
        <StatCard label="Campaigns" value={formatNumber(data.campaignsSent)} hint={`${formatNumber(data.emailsDelivered)} delivered`} icon={Mail} tone="violet" delay={350} />
      </div>

      <SectionCard title="Quick actions" description="Essential controls for your SaaS workspace">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 w-full min-w-0 max-w-full">
          <Button className="w-full h-10 gap-2 rounded-xl text-xs sm:text-sm font-medium" onClick={runChecks}>
            <RefreshCw className="h-4 w-4 shrink-0" />
            <span className="truncate">Run uptime checks</span>
          </Button>
          <Button asChild variant="outline" className="w-full h-10 gap-2 rounded-xl text-xs sm:text-sm font-medium">
            <Link to="/admin/marketing">
              <Mail className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">Email marketing</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full h-10 gap-2 rounded-xl text-xs sm:text-sm font-medium">
            <Link to="/admin/monitors">
              <Activity className="h-4 w-4 shrink-0" />
              <span className="truncate">Review uptime</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full h-10 gap-2 rounded-xl text-xs sm:text-sm font-medium">
            <Link to="/admin/settings">
              <Settings2 className="h-4 w-4 shrink-0" />
              <span className="truncate">App settings</span>
            </Link>
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
