import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { webrader } from "@/api/webraderClient";
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

const normalizeDomain = (input = "") => {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return "";
  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^www\./, "").replace(/\/.*$/, "").slice(0, 200);
  }
};

const newKey = () =>
  `pk_${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 16)}`;

export default function ProjectFormDialog({ trigger, onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", domain: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const submit = async (event) => {
    event.preventDefault();
    if (pending) return;
    const domain = normalizeDomain(form.domain);
    if (!domain) {
      setError("Please enter a valid domain (e.g. yourwebsite.com)");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const existing = await webrader.entities.Project.filter({ domain }, { limit: 1 });
      let project;
      if (existing.items?.length > 0) {
        const old = existing.items[0];
        // If domain already exists or was previously deleted/archived, restore and update it cleanly
        project = await webrader.entities.Project.update(old.id, {
          name: form.name.trim(),
          domain,
          archived: false,
          status: "pending",
        });
      } else {
        try {
          project = await webrader.entities.Project.create({
            name: form.name.trim(),
            domain,
            project_id: newKey(),
            status: "pending",
            verified_at: null,
            retention_days: 90,
            archived: false,
          });
        } catch (createErr) {
          // If unique constraint error in database, find and restore the existing record
          const fallback = await webrader.entities.Project.filter({ domain }, { limit: 1 });
          if (fallback.items?.[0]) {
            project = await webrader.entities.Project.update(fallback.items[0].id, {
              name: form.name.trim(),
              domain,
              archived: false,
            });
          } else {
            throw createErr;
          }
        }
      }
      // Auto-sync: automatically create a corresponding Uptime monitor for the project
      try {
        const monitorUrl = `https://${domain}`;
        const { items: existingMonitors } = await webrader.entities.Monitor.filter({});
        const alreadyHasMonitor = (existingMonitors || []).some((m) => {
          const mClean = (m.url || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
          return mClean === domain || m.project_id === project?.project_id || m.project_id === project?.id;
        });

        if (!alreadyHasMonitor) {
          await webrader.entities.Monitor.create({
            name: form.name.trim() || domain,
            url: monitorUrl,
            project_id: project?.project_id || project?.id,
            interval_seconds: 10,
            expected_status_code: 200,
            status: "up",
          });
          await queryClient.invalidateQueries({ queryKey: ["monitors"] });
        }
      } catch (monErr) {
        console.warn("[Uptime auto-sync create error]:", monErr);
      }

      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setForm({ name: "", domain: "" });
      setOpen(false);
      onCreated?.(project);
    } catch (submitError) {
      setError(submitError?.message ?? "Could not create the project.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="sheen gap-2 rounded-xl shadow-glow">
            <Plus className="h-4 w-4" />
            New project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Create a project</DialogTitle>
          <DialogDescription>
            Each project gets its own tracking key and keeps its data isolated from your other sites.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="project-name">Website name</Label>
            <Input
              id="project-name"
              required
              value={form.name}
              onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
              placeholder="Acme marketing site"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-domain">Website URL</Label>
            <Input
              id="project-domain"
              required
              value={form.domain}
              onChange={(event) => setForm((previous) => ({ ...previous, domain: event.target.value }))}
              placeholder="acme.com"
              className="rounded-xl"
            />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending || !form.name || !form.domain} className="rounded-xl">
              {pending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…
                </>
              ) : (
                "Create project"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}