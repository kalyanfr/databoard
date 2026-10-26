import { useState, useEffect } from "react";
import { Loader2, Server, Mail, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

const PRESETS = [
  { name: "Gmail", host: "smtp.gmail.com", port: 587, secure: false, hint: "Requires Google 16-character App Password" },
  { name: "Zoho Mail", host: "smtp.zoho.com", port: 465, secure: true, hint: "Requires Zoho app password or webmail password" },
  { name: "Hostinger", host: "smtp.hostinger.com", port: 465, secure: true, hint: "Use your domain email & webmail password" },
  { name: "AWS SES", host: "email-smtp.us-east-1.amazonaws.com", port: 587, secure: false, hint: "Requires AWS SES SMTP Credentials" },
];

export default function SmtpConfigPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState(null);

  const [smtp, setSmtp] = useState({
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: "",
    has_pass: false,
    from_name: "Guru Kalyan | Data Board",
    from_email: "support@databoard.in",
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await webrader.functions.invoke("email", { action: "get_settings" });
      if (res?.data?.smtp) {
        const s = res.data.smtp;
        setSmtp({
          host: s.host || "",
          port: s.port || 587,
          secure: Boolean(s.secure),
          user: s.user || "",
          pass: s.has_pass ? "••••••••" : "",
          has_pass: Boolean(s.has_pass),
          from_name: s.from_name || "Guru Kalyan | Data Board",
          from_email: s.from_email || "support@databoard.in",
        });
        setTestEmail(s.user || "gurukalyanreddyd@gmail.com");
      }
    } catch (err) {
      console.warn("Failed to load SMTP settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset) => {
    setSmtp((prev) => ({
      ...prev,
      host: preset.host,
      port: preset.port,
      secure: preset.secure,
    }));
    toast({
      title: `${preset.name} preset applied`,
      description: preset.hint,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await webrader.functions.invoke("email", {
        action: "save_settings",
        smtp: {
          host: smtp.host,
          port: Number(smtp.port),
          secure: Boolean(smtp.secure),
          user: smtp.user,
          pass: smtp.pass,
          from_name: smtp.from_name,
          from_email: smtp.from_email,
        },
      });

      if (res?.data?.ok) {
        toast({
          title: "SMTP settings saved",
          description: "Your custom email server settings are updated.",
        });
        if (smtp.pass && smtp.pass !== "••••••••") {
          setSmtp((prev) => ({ ...prev, has_pass: true, pass: "••••••••" }));
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
    if (!smtp.host || !smtp.user) {
      toast({
        title: "Missing fields",
        description: "Please specify SMTP host, username, and password before testing.",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await webrader.functions.invoke("email", {
        action: "test_smtp",
        to_email: testEmail || smtp.user,
        smtp: {
          host: smtp.host,
          port: Number(smtp.port),
          secure: Boolean(smtp.secure),
          user: smtp.user,
          pass: smtp.pass,
          from_name: smtp.from_name,
          from_email: smtp.from_email,
        },
      });

      if (res?.data?.ok) {
        setTestResult({ success: true, message: res.data.message });
        toast({
          title: "SMTP Connection Verified",
          description: res.data.message,
        });
      } else {
        const errMsg = res?.data?.error || "SMTP connection failed. Check host, port, or app password.";
        setTestResult({ success: false, message: errMsg });
        toast({
          title: "Connection failed",
          description: errMsg,
          variant: "destructive",
        });
      }
    } catch (err) {
      const errMsg = err.message || "Failed to reach SMTP server";
      setTestResult({ success: false, message: errMsg });
      toast({
        title: "SMTP error",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConfigured = Boolean(smtp.host && smtp.user && (smtp.has_pass || smtp.pass));

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <div className="gloss-card flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading text-sm font-semibold text-foreground">Custom SMTP Server</span>
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium border ${
                isConfigured
                  ? "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "border-border bg-muted text-muted-foreground"
              }`}>
                {isConfigured ? "Ready & Active" : "Pending Setup"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isConfigured
                ? `Delivering from ${smtp.from_email} via ${smtp.host}`
                : "Configure your outgoing mail server to send automated founder onboarding emails & broadcasts."}
            </p>
          </div>
        </div>

        {/* 1-Click Preset Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-center">
          <span className="text-[11px] font-medium text-muted-foreground mr-1">Presets:</span>
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(p)}
              className="rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-blue-500/40 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Form Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Connection Settings */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3.5 shadow-2xs">
          <div className="flex items-center gap-2 border-b border-border pb-2.5">
            <Server className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Server Connection</span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-foreground">SMTP Host</Label>
              <Input
                placeholder="smtp.gmail.com / smtp.zoho.com"
                value={smtp.host}
                onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                className="h-8 rounded-lg font-mono text-xs bg-background border-input text-foreground focus-visible:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground">Port</Label>
                <Input
                  type="number"
                  placeholder="587"
                  value={smtp.port}
                  onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })}
                  className="h-8 rounded-lg font-mono text-xs bg-background border-input text-foreground focus-visible:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground">SSL / TLS (Port 465)</Label>
                <div className="flex h-8 items-center justify-between rounded-lg border border-input bg-background px-3">
                  <span className="text-xs text-muted-foreground">{smtp.secure ? "SSL (465)" : "STARTTLS (587)"}</span>
                  <Switch
                    checked={smtp.secure}
                    onCheckedChange={(val) => setSmtp({ ...smtp, secure: val, port: val ? 465 : (smtp.port === 465 ? 587 : smtp.port) })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-foreground">Username / Login Email</Label>
              <Input
                placeholder="founder@adstracker.in or user@gmail.com"
                value={smtp.user}
                onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
                className="h-8 rounded-lg font-mono text-xs bg-background border-input text-foreground focus-visible:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-foreground">SMTP Password / App Password</Label>
                {smtp.has_pass && (
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Saved in database</span>
                )}
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={smtp.has_pass ? "•••••••• (Saved. Type to change)" : "Enter SMTP Password"}
                  value={smtp.pass}
                  onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })}
                  className="h-8 rounded-lg font-mono text-xs pr-8 bg-background border-input text-foreground focus-visible:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                For Gmail, generate a 16-character App Password at myaccount.google.com/apppasswords.
              </p>
            </div>
          </div>
        </div>

        {/* Sender Identity & Verification */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3.5 flex flex-col justify-between shadow-2xs">
          <div className="space-y-3.5">
            <div className="flex items-center gap-2 border-b border-border pb-2.5">
              <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sender Identity</span>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground">From Name</Label>
                <Input
                  placeholder="Guru Kalyan | Data Board"
                  value={smtp.from_name}
                  onChange={(e) => setSmtp({ ...smtp, from_name: e.target.value })}
                  className="h-8 rounded-lg text-xs bg-background border-input text-foreground focus-visible:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground">From / Reply-To Email</Label>
                <Input
                  placeholder="gurukalyanreddyd@gmail.com"
                  value={smtp.from_email}
                  onChange={(e) => setSmtp({ ...smtp, from_email: e.target.value })}
                  className="h-8 rounded-lg font-mono text-xs bg-background border-input text-foreground focus-visible:border-blue-500"
                />
                <p className="text-[11px] text-muted-foreground">
                  User replies route directly to this address.
                </p>
              </div>
            </div>

            {/* Test Connection Box */}
            <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2">
              <span className="text-xs font-medium text-foreground block">
                Connection test
              </span>
              <div className="flex gap-2">
                <Input
                  placeholder="Test recipient email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="h-8 rounded-lg font-mono text-xs bg-background border-input text-foreground"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing}
                  className="h-8 rounded-lg shrink-0 px-3 text-xs font-medium border-border bg-background text-foreground hover:bg-muted"
                >
                  {testing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Test send
                </Button>
              </div>
              {testResult?.message && (
                <p className={`text-[11px] font-mono ${testResult.success ? "text-blue-600 dark:text-blue-400" : "text-destructive"}`}>
                  {testResult.message}
                </p>
              )}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-8 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-xs"
            >
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Save SMTP settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
