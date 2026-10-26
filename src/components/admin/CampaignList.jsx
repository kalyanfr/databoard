import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import ConfirmDeleteButton from "@/components/common/ConfirmDeleteButton";
import { LoadingBlock } from "@/components/common/LoadingBlock";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { formatDate, formatNumber } from "@/lib/format";

/** Every campaign an admin has written, with re-send and delete. */
export default function CampaignList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState(null);

  const query = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const page = await webrader.entities.EmailCampaign.filter({}, { sort: "-created_date", limit: 30 });
      return page.items ?? [];
    },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const send = async (campaign) => {
    setBusyId(campaign.id);
    try {
      const response = await webrader.functions.invoke("sendCampaign", { campaign_id: campaign.id });
      const data = response.data ?? {};
      if (data.error) throw new Error(data.error);
      toast({
        title: `Sent to ${data.sent} recipient${data.sent === 1 ? "" : "s"}`,
        description: data.failed ? `${data.failed} could not be reached.` : "Delivery accepted by the mail service.",
      });
      await refresh();
    } catch (error) {
      toast({ title: "Could not send", description: error?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (campaign) => {
    setBusyId(campaign.id);
    try {
      await webrader.entities.EmailCampaign.delete(campaign.id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  if (query.isLoading) return <LoadingBlock rows={2} />;
  const campaigns = query.data ?? [];
  if (!campaigns.length) {
    return <p className="py-4 text-xs text-muted-foreground">No campaigns yet — compose one above.</p>;
  }

  return (
    <div className="space-y-3">
      {campaigns.map((campaign) => (
        <div key={campaign.id} className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-heading text-sm font-semibold text-foreground tracking-tight">{campaign.subject}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{campaign.body}</p>
            </div>
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] uppercase font-medium tracking-wider border ${
                campaign.status === "sent"
                  ? "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "border-border bg-muted text-muted-foreground"
              }`}
            >
              {campaign.status === "sent" ? "Sent" : "Draft"}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{campaign.audience === "admins" ? "Admins only" : "All users"}</span>
            {campaign.status === "sent" ? (
              <>
                <span>{formatNumber(campaign.recipient_count ?? 0)} delivered</span>
                <span>Sent {formatDate(campaign.sent_at)}</span>
              </>
            ) : null}
            {campaign.error ? <span className="text-destructive">{campaign.error}</span> : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {campaign.status === "draft" ? (
              <Button
                size="sm"
                className="h-8 rounded-lg px-3 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-xs"
                disabled={busyId === campaign.id}
                onClick={() => send(campaign)}
              >
                {busyId === campaign.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Send now
              </Button>
            ) : null}
            <ConfirmDeleteButton
              title={`Delete "${campaign.subject}"?`}
              description="The campaign record is removed. Emails already delivered stay in inboxes."
              pending={busyId === campaign.id}
              onConfirm={() => remove(campaign)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
