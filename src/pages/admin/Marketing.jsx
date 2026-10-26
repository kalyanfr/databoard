import { useQuery } from "@tanstack/react-query";
import { Mail, Users, Send, Server, FileText, Layers, Database, Shield } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import CampaignComposer from "@/components/admin/CampaignComposer";
import CampaignList from "@/components/admin/CampaignList";
import FounderDripPanel from "@/components/admin/FounderDripPanel";
import SmtpConfigPanel from "@/components/admin/SmtpConfigPanel";
import EmailDeliveryLogs from "@/components/admin/EmailDeliveryLogs";
import ByocAccessPanel from "@/components/admin/ByocAccessPanel";
import SectionCard from "@/components/common/SectionCard";
import StatCard from "@/components/common/StatCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/format";

export default function AdminMarketing() {
  const audience = useQuery({
    queryKey: ["admin-audience"],
    queryFn: async () => {
      const [users, logsRes] = await Promise.all([
        webrader.entities.User.list(),
        webrader.functions.invoke("email", { action: "get_logs" }),
      ]);
      const list = Array.isArray(users) ? users : users?.items ?? [];
      const subscribed = list.filter((record) => record.product_updates !== false);
      const logsCount = logsRes?.data?.logs?.length ?? 0;

      return {
        total: list.length,
        subscribed: subscribed.length,
        admins: list.filter((r) => r.role === "admin").length,
        deliveredEmails: logsCount,
      };
    },
    staleTime: 30000,
  });

  const data = audience.data;

  return (
    <div className="space-y-6">
      {/* Top Metric Cards - Light & Dark adaptive White & Blue */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Registered users"
          value={formatNumber(data?.total ?? 0)}
          hint="Active platform users"
          icon={Users}
          tone="blue"
        />
        <StatCard
          label="Marketing reach"
          value={formatNumber(data?.subscribed ?? 0)}
          hint="Subscribed to updates"
          icon={Mail}
          tone="blue"
          delay={70}
        />
        <StatCard
          label="Delivered emails"
          value={formatNumber(data?.deliveredEmails ?? 0)}
          hint="Drips, tests & broadcasts"
          icon={Send}
          tone="blue"
          delay={140}
        />
        <StatCard
          label="Platform admins"
          value={formatNumber(data?.admins ?? 1)}
          hint="Privileged administrators"
          icon={Shield}
          tone="blue"
          delay={210}
        />
      </div>

      {/* Tabs Bar - Clean White & Blue Theme, No Emojis */}
      <Tabs defaultValue="drips" className="space-y-5">
        <div className="border-b border-border/80 pb-2">
          <TabsList className="inline-flex h-10 items-center justify-start gap-1 rounded-xl bg-muted/60 border border-border p-1 text-muted-foreground">
            <TabsTrigger
              value="drips"
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Founder Drips</span>
            </TabsTrigger>
            <TabsTrigger
              value="broadcasts"
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Broadcasts</span>
            </TabsTrigger>
            <TabsTrigger
              value="smtp"
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <Server className="h-3.5 w-3.5" />
              <span>SMTP Settings</span>
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Delivery Logs</span>
            </TabsTrigger>
            <TabsTrigger
              value="byoc"
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <Database className="h-3.5 w-3.5" />
              <span>BYOC Requests</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Founder Drips */}
        <TabsContent value="drips" className="space-y-4">
          <FounderDripPanel />
        </TabsContent>

        {/* Tab 2: Broadcasts */}
        <TabsContent value="broadcasts" className="space-y-4">
          <SectionCard title="New broadcast" description="Write it once, send live to all users via your SMTP server">
            <CampaignComposer />
          </SectionCard>

          <SectionCard title="Campaign history" description="Drafts and previously delivered broadcasts">
            <CampaignList />
          </SectionCard>
        </TabsContent>

        {/* Tab 3: Custom SMTP Settings */}
        <TabsContent value="smtp" className="space-y-4">
          <SmtpConfigPanel />
        </TabsContent>

        {/* Tab 4: Delivery Logs */}
        <TabsContent value="logs" className="space-y-4">
          <SectionCard title="Email Delivery Audit Logs" description="Real-time log of all automated founder drips, broadcasts, and test sends">
            <EmailDeliveryLogs />
          </SectionCard>
        </TabsContent>

        {/* Tab 5: BYOC Requests */}
        <TabsContent value="byoc" className="space-y-4">
          <ByocAccessPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
