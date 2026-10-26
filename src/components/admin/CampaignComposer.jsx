import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

const TAGS = ["{{name}}", "{{email}}", "{{domain}}", "{{app_name}}"];

/** Compose an email-marketing broadcast campaign and deliver via SMTP. */
export default function CampaignComposer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ subject: "", body: "", audience: "all" });
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);

  const insertTag = (tag) => {
    setForm((prev) => ({ ...prev, body: `${prev.body} ${tag}` }));
  };

  const save = async (sendNow) => {
    setError(null);
    if (!form.subject.trim() || !form.body.trim()) {
      setError("A subject and a message are both required.");
      return;
    }
    setPending(sendNow ? "send" : "draft");
    try {
      if (sendNow) {
        // Direct broadcast delivery via custom SMTP backend
        const response = await webrader.functions.invoke("email", {
          action: "send_broadcast",
          subject: form.subject.trim(),
          body: form.body.trim(),
          audience: form.audience,
        });

        const data = response?.data ?? {};
        if (data.error) throw new Error(data.error);

        toast({
          title: "Broadcast delivered",
          description: `Sent to ${data.sent} user${data.sent === 1 ? "" : "s"}. ${data.failed ? `${data.failed} failed.` : "All delivered successfully."}`,
        });
      } else {
        // Save draft to email_campaigns
        await webrader.entities.EmailCampaign.create({
          subject: form.subject.trim(),
          body: form.body.trim(),
          audience: form.audience,
          status: "draft",
        }).catch(() => {});

        toast({ title: "Draft saved", description: "You can find and send your draft anytime." });
      }

      setForm({ subject: "", body: "", audience: form.audience });
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-email-logs"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (submitError) {
      setError(submitError?.message ?? "Could not send broadcast.");
    } finally {
      setPending(null);
    }
  };

  return (
    <form className="space-y-3.5" onSubmit={(event) => event.preventDefault()}>
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <div className="space-y-1">
          <Label htmlFor="campaign-subject" className="text-xs font-medium text-foreground">
            Subject line
          </Label>
          <Input
            id="campaign-subject"
            value={form.subject}
            onChange={(event) => setForm((previous) => ({ ...previous, subject: event.target.value }))}
            placeholder="Product update or announcement"
            className="h-8 rounded-lg text-xs bg-background border-input text-foreground focus-visible:border-blue-500"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-foreground">Audience</Label>
          <Select
            value={form.audience}
            onValueChange={(value) => setForm((previous) => ({ ...previous, audience: value }))}
          >
            <SelectTrigger className="h-8 rounded-lg text-xs bg-background border-input text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All registered users</SelectItem>
              <SelectItem value="admins">Admins only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="campaign-body" className="text-xs font-medium text-foreground">
            Message content
          </Label>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground mr-1">Insert tag:</span>
            {TAGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => insertTag(t)}
                className="rounded px-1.5 py-0.5 text-[10px] font-mono border border-border bg-background text-muted-foreground hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <Textarea
          id="campaign-body"
          rows={7}
          value={form.body}
          onChange={(event) => setForm((previous) => ({ ...previous, body: event.target.value }))}
          placeholder={"Hi {{name}},\n\nHere is a quick update on your analytics and new features available on your dashboard.\n\nBest,\nGuru"}
          className="rounded-lg font-mono text-xs leading-relaxed bg-background border-input text-foreground focus-visible:border-blue-500"
        />
        <p className="text-[11px] text-muted-foreground">
          Delivered through your configured SMTP server in a clean founder letter layout.
        </p>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="h-8 rounded-lg px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-xs"
          disabled={!!pending}
          onClick={() => save(true)}
        >
          {pending === "send" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Send broadcast now
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 rounded-lg px-4 text-xs font-medium border-border bg-background text-foreground hover:bg-muted"
          disabled={!!pending}
          onClick={() => save(false)}
        >
          {pending === "draft" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Save as draft
        </Button>
      </div>
    </form>
  );
}
