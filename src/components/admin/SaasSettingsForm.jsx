import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { DEFAULT_CONFIG, useAppConfig, writeAppConfig } from "@/lib/appConfig";

/** SaaS-wide settings every user feels: sender name, support address, alerts, banner. */
export default function SaasSettingsForm() {
  const { data: config, isLoading } = useAppConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(DEFAULT_CONFIG);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setForm({ ...DEFAULT_CONFIG, ...(config ?? {}) });
  }, [config]);

  const submit = async (event) => {
    event.preventDefault();
    setPending(true);
    try {
      await writeAppConfig(config, {
        from_name: form.from_name.trim() || DEFAULT_CONFIG.from_name,
        support_email: form.support_email.trim(),
        uptime_alerts_enabled: !!form.uptime_alerts_enabled,
        maintenance_banner: form.maintenance_banner.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ["app-config"] });
      toast({ title: "Settings saved", description: "They apply to every user immediately." });
    } catch (error) {
      toast({ title: "Could not save", description: error?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setPending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="config-from">Sender name on emails</Label>
          <Input
            id="config-from"
            value={form.from_name ?? ""}
            onChange={(event) => setForm((previous) => ({ ...previous, from_name: event.target.value }))}
            placeholder="Data Board"
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="config-support">Support email</Label>
          <Input
            id="config-support"
            type="email"
            value={form.support_email ?? ""}
            onChange={(event) => setForm((previous) => ({ ...previous, support_email: event.target.value }))}
            placeholder="support@databoard.in"
            className="rounded-xl"
          />
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-background/60 p-4">
        <div>
          <p className="text-sm font-semibold">Uptime alert emails</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Master switch. Turn it off to stop every down/recovery email while checks keep running.
          </p>
        </div>
        <Switch
          checked={form.uptime_alerts_enabled !== false}
          onCheckedChange={(value) => setForm((previous) => ({ ...previous, uptime_alerts_enabled: value }))}
          aria-label="Uptime alert emails"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="config-banner">Notice banner</Label>
        <Textarea
          id="config-banner"
          rows={3}
          value={form.maintenance_banner ?? ""}
          onChange={(event) => setForm((previous) => ({ ...previous, maintenance_banner: event.target.value }))}
          placeholder="Leave empty for no banner. Anything here appears at the top of the app for every user."
          className="rounded-2xl"
        />
      </div>

      <Button type="submit" disabled={pending} className="rounded-xl">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save settings
      </Button>
    </form>
  );
}