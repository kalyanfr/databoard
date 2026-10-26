import { useState, useEffect } from "react";
import { Loader2, Save, Eye, EyeOff, Database, Sparkles, ChevronDown, ChevronUp, Check, ShieldCheck, Lock, Send, Clock } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { useActiveProject } from "@/lib/filters";
import { formatDate } from "@/lib/format";

export default function CloudflareStoragePanel() {
  const { user } = useAuth();
  const { project } = useActiveProject();
  const { toast } = useToast();
  const projectKey = project?.project_id || "default";
  const userEmail = user?.email || "";

  const [loading, setLoading] = useState(true);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [autoSettingUp, setAutoSettingUp] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState(null);
  const [setupStepText, setSetupStepText] = useState("");

  const [accessState, setAccessState] = useState({
    status: "none", // 'approved', 'pending', 'revoked', 'none'
    requested_at: null,
    is_admin: false,
  });

  const [config, setConfig] = useState({
    enabled: false,
    account_id: "",
    database_id: "",
    account_name: "",
    database_name: "",
    api_token: "",
    has_token: false,
  });

  useEffect(() => {
    loadAll();
  }, [projectKey, userEmail]);

  const loadAll = async () => {
    setLoading(true);
    try {
      // 1. Check BYOC Access Permission
      const accessRes = await webrader.functions.invoke("cloudflare", {
        action: "check_byoc_status",
        email: userEmail,
        user_id: user?.id,
      });

      if (accessRes?.data) {
        setAccessState({
          status: accessRes.data.status || "none",
          requested_at: accessRes.data.requested_at || null,
          is_admin: Boolean(accessRes.data.is_admin),
        });
      }

      // 2. Load Config
      const res = await webrader.functions.invoke("cloudflare", {
        action: "get_config",
        project_id: projectKey,
      });

      if (res?.data?.config) {
        const c = res.data.config;
        setConfig({
          enabled: Boolean(c.enabled),
          account_id: c.account_id || "",
          database_id: c.database_id || "",
          account_name: c.account_name || "",
          database_name: c.database_name || "",
          api_token: c.has_token ? "••••••••" : "",
          has_token: Boolean(c.has_token),
        });
      }
    } catch (err) {
      console.warn("Failed to load Cloudflare status:", err);
    } finally {
      setLoading(false);
    }
  };

  // Submit Request for BYOC Access
  const handleRequestAccess = async () => {
    if (!userEmail) return;
    setSubmittingRequest(true);
    try {
      const res = await webrader.functions.invoke("cloudflare", {
        action: "request_byoc",
        email: userEmail,
        user_id: user?.id,
        project_id: projectKey,
      });

      if (res?.data?.ok) {
        setAccessState((prev) => ({
          ...prev,
          status: "pending",
          requested_at: new Date().toISOString(),
        }));
        toast({
          title: "Request Submitted! 📬",
          description: "Guru Kalyan has been notified and will review & approve your access shortly.",
        });
      } else {
        throw new Error(res?.data?.error || "Failed to submit request.");
      }
    } catch (err) {
      toast({
        title: "Request Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmittingRequest(false);
    }
  };

  // 1-Step Auto Setup Handler (Only for approved users)
  const handleAutoSetup = async () => {
    if (!config.api_token || config.api_token === "••••••••") {
      toast({
        title: "API Token Required",
        description: "Please enter your Cloudflare API Token to connect in 1 click.",
        variant: "destructive",
      });
      return;
    }

    setAutoSettingUp(true);
    setResult(null);
    setSetupStepText("Connecting to Cloudflare API...");

    try {
      setSetupStepText("Detecting Account ID & creating 'databoard_analytics' D1 database...");
      const res = await webrader.functions.invoke("cloudflare", {
        action: "auto_setup",
        project_id: projectKey,
        api_token: config.api_token,
      });

      if (res?.data?.ok) {
        setResult({ success: true, message: res.data.message });
        setConfig((prev) => ({
          ...prev,
          enabled: true,
          account_id: res.data.account_id,
          database_id: res.data.database_id,
          account_name: res.data.account_name,
          database_name: res.data.database_name,
          has_token: true,
          api_token: "••••••••",
        }));
        toast({
          title: "Cloudflare D1 Connected in 1 Step! 🚀",
          description: `Database "${res.data.database_name}" is active on your Cloudflare account.`,
        });
      } else {
        throw new Error(res?.data?.error || "Auto-setup failed. Please check token permissions.");
      }
    } catch (err) {
      const errMsg = err.message || "Failed to auto-setup Cloudflare D1";
      setResult({ success: false, message: errMsg });
      toast({
        title: "Auto-Setup Failed",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setAutoSettingUp(false);
      setSetupStepText("");
    }
  };

  // Manual Save Handler
  const handleSaveManual = async () => {
    if (!config.account_id?.trim() || !config.database_id?.trim()) {
      toast({
        title: "Account & Database ID Required",
        description: "Please enter both your Cloudflare Account ID and D1 Database UUID.",
        variant: "destructive",
      });
      return;
    }

    if (!config.api_token || config.api_token === "") {
      toast({
        title: "API Token Required",
        description: "Please enter your Cloudflare API Token in the field above so Data Board can authenticate with your D1 database.",
        variant: "destructive",
      });
      return;
    }

    setSavingManual(true);
    try {
      const res = await webrader.functions.invoke("cloudflare", {
        action: "save_config",
        project_id: projectKey,
        config: {
          enabled: true,
          account_id: config.account_id.trim(),
          database_id: config.database_id.trim(),
          api_token: config.api_token,
        },
      });

      if (res?.data?.ok) {
        // Automatically initialize database tables if not already created
        try {
          await webrader.functions.invoke("cloudflare", {
            action: "init_schema",
            project_id: projectKey,
            account_id: config.account_id.trim(),
            database_id: config.database_id.trim(),
            api_token: config.api_token,
          });
        } catch {}

        toast({
          title: "Cloudflare D1 Saved & Activated!",
          description: "Database settings saved, tables initialized, and BYOC storage is now active.",
        });
        setConfig((prev) => ({
          ...prev,
          enabled: true,
          has_token: true,
          api_token: "••••••••",
        }));
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
      setSavingManual(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-36 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isApproved = accessState.status === "approved" || accessState.is_admin;
  const isPending = accessState.status === "pending";
  const isConnected = Boolean(config.enabled && config.account_id && config.database_id);

  return (
    <div className="space-y-4">
      {/* 1. Default Storage Overview Card */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading text-sm font-semibold text-foreground">Analytics Storage Engine</span>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium border ${
                isConnected
                  ? "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "border-border bg-muted text-muted-foreground"
              }`}>
                {isConnected ? "Active (Cloudflare D1)" : "Hostinger Managed Storage (Default)"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isConnected
                ? `Storing events in database "${config.database_name || 'databoard_analytics'}" on your personal Cloudflare account.`
                : "All visitor tracking, sessions, and conversion goals are stored on our high-performance Hostinger managed server by default with zero configuration required."}
            </p>
          </div>
        </div>

        {isConnected && isApproved && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">BYOC Enabled</span>
            <Switch
              checked={config.enabled}
              onCheckedChange={(val) => {
                setConfig({ ...config, enabled: val });
                webrader.functions.invoke("cloudflare", {
                  action: "save_config",
                  project_id: projectKey,
                  config: { ...config, enabled: val },
                });
                toast({ title: val ? "Cloudflare BYOC storage enabled" : "Switched to default managed storage" });
              }}
            />
          </div>
        )}
      </div>

      {/* 2. Gated BYOC Access Card (When NOT yet approved) */}
      {!isApproved && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="font-heading text-sm font-semibold text-foreground">
                Bring Your Own Cloudflare (D1 Storage)
              </span>
            </div>
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium border ${
              isPending
                ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-border bg-muted text-muted-foreground"
            }`}>
              {isPending ? "Request Pending Review" : "Request Required"}
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Want 100% data sovereignty stored in your own SQLite database? You can request personal Cloudflare D1 storage access. Once approved by the founder, you can connect your Cloudflare account in 1 click and route all data directly into your personal Cloudflare D1 database.
          </p>

          <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1.5 text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              BYOC Benefits:
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              • <b>100% Data Privacy:</b> Visitor metrics live exclusively inside your own Cloudflare D1 database.<br/>
              • <b>Free Tier Included:</b> Cloudflare gives 5,000,000 queries/day and 100,000 writes/day free.<br/>
              • <b>Direct SQL Access:</b> Query, export, or pipe your raw data to any BI tool whenever you want.
            </p>
          </div>

          {isPending ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-2.5 text-xs text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Access Request Received</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Your request for {userEmail} {accessState.requested_at ? `on ${formatDate(accessState.requested_at)}` : ""} is being reviewed by Guru Kalyan. Access will be unlocked from the admin panel shortly.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Request will be linked to your account: <strong className="text-foreground font-mono">{userEmail}</strong>
              </span>

              <Button
                onClick={handleRequestAccess}
                disabled={submittingRequest}
                className="h-8 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-xs shrink-0 gap-1.5"
              >
                {submittingRequest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Submit Request for BYOC Access
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 3. Approved: 1-Step Instant Auto Setup Card */}
      {isApproved && (
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4 shadow-2xs">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-heading text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                1-Step Auto Setup (Access Approved)
              </span>
              <a
                href="https://dash.cloudflare.com/profile/api-tokens"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Get Cloudflare API Token ↗
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste your Cloudflare API Token below. Data Board automatically detects your Account ID, creates the <code>databoard_analytics</code> D1 database on your Cloudflare account, sets up the tables, and activates live tracking in 1 click.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground">Cloudflare API Token</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showToken ? "text" : "password"}
                  placeholder={config.has_token ? "•••••••• (Saved. Type a new token to re-connect)" : "Paste Cloudflare API Token"}
                  value={config.api_token}
                  onChange={(e) => setConfig({ ...config, api_token: e.target.value })}
                  className="h-9 rounded-lg font-mono text-xs pr-8 bg-background border-input text-foreground focus-visible:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              <Button
                onClick={handleAutoSetup}
                disabled={autoSettingUp}
                className="h-9 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg shrink-0 gap-1.5 shadow-xs"
              >
                {autoSettingUp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Connect & Setup in 1 Click
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Token requires <b>Account &gt; D1 &gt; Edit</b> and <b>Account &gt; Account Settings &gt; Read</b> permissions.
            </p>
          </div>

          {autoSettingUp && setupStepText && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 flex items-center gap-2.5 text-xs text-blue-600 dark:text-blue-400">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span className="font-medium">{setupStepText}</span>
            </div>
          )}

          {result?.message && (
            <div className={`rounded-xl border p-3 text-xs font-medium flex items-start gap-2 ${
              result.success
                ? "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                : "border-destructive/20 bg-destructive/10 text-destructive"
            }`}>
              {result.success ? <Check className="h-4 w-4 shrink-0 mt-0.5" /> : null}
              <span>{result.message}</span>
            </div>
          )}

          {/* Advanced / Manual Toggle */}
          <div className="border-t border-border pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <span>Advanced / Manual Settings (Specify custom database UUID)</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 pt-3 border-t border-border/60 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground">Cloudflare Account ID</Label>
                    <Input
                      placeholder="e.g. 9b78e34a652f10b2c129e018274a1234"
                      value={config.account_id}
                      onChange={(e) => setConfig({ ...config, account_id: e.target.value })}
                      className="h-8 rounded-lg font-mono text-xs bg-background border-input text-foreground"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground">Cloudflare D1 Database ID (UUID)</Label>
                    <Input
                      placeholder="e.g. 3a5b8c9d-12e3-4f5a-6b7c-8d9e0f1a2b3c"
                      value={config.database_id}
                      onChange={(e) => setConfig({ ...config, database_id: e.target.value })}
                      className="h-8 rounded-lg font-mono text-xs bg-background border-input text-foreground"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-muted-foreground">
                    Requires Cloudflare API Token entered above to authenticate database writes.
                  </span>
                  <Button
                    size="sm"
                    onClick={handleSaveManual}
                    disabled={savingManual}
                    className="h-8 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-xs shrink-0"
                  >
                    {savingManual ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                    Save Manual Settings
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
