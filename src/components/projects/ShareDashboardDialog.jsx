import { useState, useEffect } from "react";
import { Share2, Copy, Check, ExternalLink, Globe, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getProjectShareSettings, saveProjectShareSettings } from "@/lib/shareSettings";

export default function ShareDashboardDialog({ project, trigger }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState(() => getProjectShareSettings(project?.id || project?.project_id));

  useEffect(() => {
    if (project?.id || project?.project_id) {
      setSettings(getProjectShareSettings(project.id || project.project_id));
    }
  }, [project?.id, project?.project_id, open]);

  const shareUrl = project ? `${window.location.origin}/share/${project.project_id || project.id}` : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    saveProjectShareSettings(project?.id || project?.project_id, settings);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs">
            <Share2 className="h-3.5 w-3.5" /> Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Share2 className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Shareable Dashboard</DialogTitle>
              <DialogDescription className="text-xs">
                Share read-only analytics with clients, investors, or your community.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Public Toggle */}
          <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-muted/30 p-3">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold text-foreground">Enable Public Link</Label>
              <p className="text-[11px] text-muted-foreground">
                Anyone with the link can view live traffic (read-only)
              </p>
            </div>
            <Switch
              checked={settings.isPublic}
              onCheckedChange={(checked) => setSettings({ ...settings, isPublic: checked })}
            />
          </div>

          {/* Share URL Box */}
          {settings.isPublic && (
            <div className="space-y-3 animate-fade-up">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Public Link</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={shareUrl}
                    className="h-9 text-xs rounded-xl bg-background/80"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 shrink-0 gap-1.5 rounded-xl text-xs px-3"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-xl"
                    asChild
                  >
                    <a href={shareUrl} target="_blank" rel="noreferrer" title="Open Public Dashboard">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              </div>

              {/* Password Protection Option */}
              <div className="rounded-2xl border border-border/70 p-3 space-y-2.5 bg-background/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">Password Protection</span>
                  </div>
                  <Switch
                    checked={!!settings.hasPassword}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, hasPassword: checked, password: checked ? settings.password : "" })
                    }
                  />
                </div>
                {settings.hasPassword && (
                  <Input
                    type="password"
                    placeholder="Enter a secret password"
                    value={settings.password || ""}
                    onChange={(e) => setSettings({ ...settings, password: e.target.value })}
                    className="h-8 text-xs rounded-xl"
                  />
                )}
              </div>

              {/* 3D Globe View in Public Link */}
              <div className="flex items-center justify-between rounded-2xl border border-border/70 p-3 bg-background/40">
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Include 3D Realtime Globe</p>
                    <p className="text-[10px] text-muted-foreground">Visitors can interact with the 3D globe</p>
                  </div>
                </div>
                <Switch
                  checked={settings.allowGlobe !== false}
                  onCheckedChange={(checked) => setSettings({ ...settings, allowGlobe: checked })}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" className="rounded-xl text-xs" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" className="rounded-xl text-xs font-semibold gap-1.5" onClick={handleSave}>
            <ShieldCheck className="h-3.5 w-3.5" /> Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
