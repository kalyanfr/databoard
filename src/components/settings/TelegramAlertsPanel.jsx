import { useState, useEffect } from "react";
import { Loader2, Send, Save, Eye, EyeOff } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useActiveProject } from "@/lib/filters";

export default function TelegramAlertsPanel() {
  const { project } = useActiveProject();
  const { toast } = useToast();
  const projectKey = project?.project_id || "default";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [config, setConfig] = useState({
    bot_token: "",
    chat_id: "",
    alert_conversions: true,
    alert_spikes: true,
    alert_ai_crawlers: true,
    alert_uptime: true,
    spike_threshold: 20,
    has_token: false,
  });

  useEffect(() => {
    loadSettings();
  }, [projectKey]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await webrader.functions.invoke("telegram", {
        action: "get_config",
        project_id: projectKey,
      });
      if (res?.data?.config) {
        const c = res.data.config;
        setConfig({
          bot_token: c.has_token ? "••••••••" : "",
          chat_id: c.chat_id || "",
          alert_conversions: c.alert_conversions !== false,
          alert_spikes: c.alert_spikes !== false,
          alert_ai_crawlers: c.alert_ai_crawlers !== false,
          alert_uptime: c.alert_uptime !== false,
          spike_threshold: Number(c.spike_threshold) || 20,
          has_token: Boolean(c.has_token),
        });
      }
    } catch (err) {
      console.warn("Failed to load Telegram config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await webrader.functions.invoke("telegram", {
        action: "save_config",
        project_id: projectKey,
        config: {
          bot_token: config.bot_token,
          chat_id: config.chat_id,
          alert_conversions: config.alert_conversions,
          alert_spikes: config.alert_spikes,
          alert_ai_crawlers: config.alert_ai_crawlers,
          alert_uptime: config.alert_uptime,
          spike_threshold: Number(config.spike_threshold),
        },
      });

      if (res?.data?.ok) {
        toast({
          title: "Telegram settings saved",
          description: "Your notification preferences are now active.",
        });
        if (config.bot_token && config.bot_token !== "••••••••") {
          setConfig((prev) => ({ ...prev, has_token: true, bot_token: "••••••••" }));
        }
      } else {
        throw new Error(res?.data?.error || "Save failed");
      }
    } catch (err) {
      toast({
        title: "Error saving settings",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await webrader.functions.invoke("telegram", {
        action: "test_message",
        project_id: projectKey,
        domain: project?.domain || "adstracker.in",
        bot_token: config.bot_token,
        chat_id: config.chat_id,
      });

      if (res?.data?.ok) {
        setTestResult({ success: true, message: res.data.message });
        toast({
          title: "Telegram Alert Delivered! 🚀",
          description: "Check your Telegram chat for the test notification.",
        });
      } else {
        const errMsg = res?.data?.error || "Could not reach Telegram bot. Verify token and chat ID.";
        setTestResult({ success: false, message: errMsg });
        toast({
          title: "Test Failed",
          description: errMsg,
          variant: "destructive",
        });
      }
    } catch (err) {
      const errMsg = err.message || "Failed to deliver test message";
      setTestResult({ success: false, message: errMsg });
      toast({
        title: "Telegram Error",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-36 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConnected = Boolean(config.has_token && config.chat_id);

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Send className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading text-sm font-semibold text-foreground">Real-Time Telegram Notifications</span>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium border ${
                isConnected
                  ? "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "border-border bg-muted text-muted-foreground"
              }`}>
                {isConnected ? "Active & Linked" : "Setup Required"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Receive instant alerts on your phone or desktop for conversion goals, traffic surges, and AI engine citations.
            </p>
          </div>
        </div>
      </div>

      {/* Credentials Grid */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4 shadow-2xs">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-foreground">Telegram Bot Token</Label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                placeholder={config.has_token ? "•••••••• (Saved. Type to change)" : "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"}
                value={config.bot_token}
                onChange={(e) => setConfig({ ...config, bot_token: e.target.value })}
                className="h-8 rounded-lg font-mono text-xs pr-8 bg-background border-input text-foreground focus-visible:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Create a free bot with @BotFather on Telegram in 10 seconds.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-foreground">Telegram Chat ID</Label>
            <Input
              placeholder="e.g. 123456789 or @yourchannel"
              value={config.chat_id}
              onChange={(e) => setConfig({ ...config, chat_id: e.target.value })}
              className="h-8 rounded-lg font-mono text-xs bg-background border-input text-foreground focus-visible:border-blue-500"
            />
            <p className="text-[11px] text-muted-foreground">
              Message @userinfobot to get your personal chat ID or use a channel ID.
            </p>
          </div>
        </div>

        {/* Trigger Toggles */}
        <div className="border-t border-border pt-3 space-y-3">
          <span className="text-xs font-semibold text-foreground block">Notification Triggers</span>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3">
              <div>
                <p className="text-xs font-medium text-foreground">Goal Conversions & Revenue</p>
                <p className="text-[11px] text-muted-foreground">Instant ping whenever a visitor completes a goal or purchase.</p>
              </div>
              <Switch
                checked={config.alert_conversions}
                onCheckedChange={(val) => setConfig({ ...config, alert_conversions: val })}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3">
              <div>
                <p className="text-xs font-medium text-foreground">AI Search & GEO Citations</p>
                <p className="text-[11px] text-muted-foreground">Alert when ChatGPT, Perplexity, Claude, or Gemini crawls your site.</p>
              </div>
              <Switch
                checked={config.alert_ai_crawlers}
                onCheckedChange={(val) => setConfig({ ...config, alert_ai_crawlers: val })}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3">
              <div>
                <p className="text-xs font-medium text-foreground">Traffic Spikes</p>
                <p className="text-[11px] text-muted-foreground">Notify when active visitors cross threshold.</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={config.spike_threshold}
                  onChange={(e) => setConfig({ ...config, spike_threshold: Number(e.target.value) })}
                  className="h-7 w-16 text-center font-mono text-xs bg-background border-input"
                />
                <Switch
                  checked={config.alert_spikes}
                  onCheckedChange={(val) => setConfig({ ...config, alert_spikes: val })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3">
              <div>
                <p className="text-xs font-medium text-foreground">Uptime Alerts</p>
                <p className="text-[11px] text-muted-foreground">Instant notification if your site goes down or recovers.</p>
              </div>
              <Switch
                checked={config.alert_uptime}
                onCheckedChange={(val) => setConfig({ ...config, alert_uptime: val })}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-border">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTest}
            disabled={testing}
            className="h-8 rounded-lg px-3.5 text-xs font-medium border-border bg-background text-foreground hover:bg-muted"
          >
            {testing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
            Send Test Alert
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-8 rounded-lg px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-xs"
          >
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Save Telegram Settings
          </Button>
        </div>

        {testResult?.message && (
          <p className={`text-[11px] font-mono ${testResult.success ? "text-blue-600 dark:text-blue-400" : "text-destructive"}`}>
            {testResult.message}
          </p>
        )}
      </div>
    </div>
  );
}
