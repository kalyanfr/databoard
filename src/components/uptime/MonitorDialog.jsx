import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import { useAuth } from "@/lib/AuthContext";
import { useProjects } from "@/lib/filters";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const normalizeUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    return url.href;
  } catch {
    return "";
  }
};

/** Add or edit one uptime monitor. */
export default function MonitorDialog({ monitor, trigger, onSaved }) {
  const { user } = useAuth();
  const { data: projects } = useProjects();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", alert_email: "", project_id: "none" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      name: monitor?.name ?? "",
      url: monitor?.url ?? "",
      alert_email: monitor?.alert_email ?? user?.alert_email ?? user?.email ?? "",
      project_id: monitor?.project_id ?? "none",
    });
  }, [open, monitor, user]);

  const submit = async (event) => {
    event.preventDefault();
    if (pending) return;
    const url = normalizeUrl(form.url);
    if (!url) {
      setError("Enter a valid link, e.g. https://yourwebsite.com");
      return;
    }
    const verifiedProjects = (projects || []).filter((p) => p.status === "verified");
    const cleanMonitorDomain = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].split(':')[0].toLowerCase();
    const isDomainVerified = verifiedProjects.some((p) => {
      const pDom = (p.domain || '').toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
      return cleanMonitorDomain === pDom || cleanMonitorDomain.endsWith('.' + pDom);
    });

    if (!isDomainVerified) {
      setError(`Domain "${cleanMonitorDomain}" is not verified. You must add and verify domain ownership in Projects or Dashboard before adding monitors.`);
      return;
    }

    setPending(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim().slice(0, 120),
        url,
        alert_email: form.alert_email.trim(),
        project_id: form.project_id === "none" ? null : form.project_id,
        owner_email: user?.email ?? null,
      };
      const saved = monitor
        ? await webrader.entities.Monitor.update(monitor.id, payload)
        : await webrader.entities.Monitor.create({ ...payload, status: "up", consecutive_failures: 0 });
      await queryClient.invalidateQueries({ queryKey: ["monitors"] });
      setOpen(false);
      onSaved?.(saved);
    } catch (submitError) {
      setError(submitError?.message ?? "Could not save the monitor.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="sheen gap-2 rounded-xl shadow-glow">Add monitor</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{monitor ? "Edit monitor" : "Watch a new URL"}</DialogTitle>
          <DialogDescription>
            We check it every few minutes and email this address the moment it stops answering.
          </DialogDescription>
        </DialogHeader>
        {!(projects || []).some((p) => p.status === "verified") && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Domain verification required: Uptime monitors can only be added for verified domains. Please verify domain ownership in Dashboard or Projects first.
            </p>
          </div>
        )}
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="monitor-name">Name</Label>
            <Input
              id="monitor-name"
              required
              value={form.name}
              onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
              placeholder="Acme homepage"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monitor-url">URL to check</Label>
            <Input
              id="monitor-url"
              required
              value={form.url}
              onChange={(event) => setForm((previous) => ({ ...previous, url: event.target.value }))}
              placeholder="https://acme.com"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monitor-email">Alert email</Label>
            <Input
              id="monitor-email"
              type="email"
              required
              value={form.alert_email}
              onChange={(event) => setForm((previous) => ({ ...previous, alert_email: event.target.value }))}
              placeholder="you@company.com"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Linked project</Label>
            <Select
              value={form.project_id}
              onValueChange={(value) => setForm((previous) => ({ ...previous, project_id: value }))}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not linked</SelectItem>
                {(projects ?? []).map((project) => (
                  <SelectItem key={project.id} value={project.project_id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending || !form.name || !form.url} className="rounded-xl">
              {pending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                </>
              ) : monitor ? (
                "Save monitor"
              ) : (
                "Start monitoring"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}