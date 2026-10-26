import { useState, useEffect } from "react";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

const MERGE_TAGS = [
  { tag: "{{name}}", label: "User name" },
  { tag: "{{email}}", label: "User email" },
  { tag: "{{domain}}", label: "Project domain" },
  { tag: "{{app_name}}", label: "App name" },
];

export default function FounderDripPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [testingStepId, setTestingStepId] = useState(null);
  const [expandedStep, setExpandedStep] = useState(null);
  const [steps, setSteps] = useState([]);
  const [testEmail, setTestEmail] = useState("gurukalyanreddyd@gmail.com");

  useEffect(() => {
    loadDripConfig();
  }, []);

  const loadDripConfig = async () => {
    setLoading(true);
    try {
      const res = await webrader.functions.invoke("email", { action: "get_settings" });
      if (res?.data?.steps) {
        setSteps(res.data.steps);
        if (res.data.steps.length > 0) {
          setExpandedStep(res.data.steps[0].id);
        }
      }
      if (res?.data?.smtp?.user) {
        setTestEmail(res.data.smtp.user);
      }
    } catch (err) {
      console.warn("Failed to load drip config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await webrader.functions.invoke("email", {
        action: "save_settings",
        steps,
      });

      if (res?.data?.ok) {
        toast({
          title: "Sequence changes saved",
          description: "All automated onboarding steps and timings have been updated.",
        });
      } else {
        throw new Error(res?.data?.error || "Save failed");
      }
    } catch (err) {
      toast({
        title: "Error saving drip steps",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRunAutomation = async () => {
    setRunning(true);
    try {
      const res = await webrader.functions.invoke("email", {
        action: "run_automation",
      });

      if (res?.data?.ok) {
        toast({
          title: "Automation completed",
          description: res.data.message,
        });
      } else {
        throw new Error(res?.data?.error || "Automation run failed");
      }
    } catch (err) {
      toast({
        title: "Automation error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const handleSendTest = async (stepId) => {
    setTestingStepId(stepId);
    try {
      const res = await webrader.functions.invoke("email", {
        action: "send_test_drip",
        step_id: stepId,
        to_email: testEmail,
      });

      if (res?.data?.ok) {
        toast({
          title: "Preview delivered",
          description: `Test email sent to ${testEmail}. Check your inbox.`,
        });
      } else {
        throw new Error(res?.data?.error || "Failed to deliver test email");
      }
    } catch (err) {
      toast({
        title: "Delivery failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setTestingStepId(null);
    }
  };

  const updateStep = (index, field, value) => {
    setSteps((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const insertTag = (index, tag) => {
    setSteps((prev) => {
      const next = [...prev];
      const current = next[index].body || "";
      next[index] = { ...next[index], body: `${current} ${tag}` };
      return next;
    });
    toast({ title: "Tag inserted", description: tag });
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeCount = steps.filter((s) => s.enabled).length;

  return (
    <div className="space-y-4">
      {/* Top Header Card - Semantic White & Blue Design */}
      <div className="gloss-card flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-heading text-sm font-semibold text-foreground">
              Founder Onboarding Automation
            </span>
            <span className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
              {activeCount} active steps
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Personal, plain-text emails delivered on a scheduled timeline after signup.
          </p>
        </div>

        {/* Buttons Aligned Horizontally with Unified Sizing */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunAutomation}
            disabled={running}
            className="h-8 text-xs font-medium px-3.5 rounded-lg border-border bg-background text-foreground hover:bg-muted"
          >
            {running ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Run automation now
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-8 text-xs font-medium px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-xs"
          >
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Save sequence changes
          </Button>
        </div>
      </div>

      {/* Available Merge Tags Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/40 px-3.5 py-2">
        <span className="text-xs font-medium text-foreground">Available tags:</span>
        <div className="flex flex-wrap gap-1.5">
          {MERGE_TAGS.map((t) => (
            <span
              key={t.tag}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-mono text-muted-foreground"
            >
              <strong className="text-blue-600 dark:text-blue-400 font-semibold">{t.tag}</strong>
              <span className="text-muted-foreground/80">({t.label})</span>
            </span>
          ))}
        </div>
      </div>

      {/* Drip Steps List */}
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const isExpanded = expandedStep === step.id;
          return (
            <div
              key={step.id}
              className={`rounded-2xl border transition-all ${
                isExpanded
                  ? "border-blue-500/50 bg-card shadow-xs"
                  : "border-border bg-card/60 hover:border-border"
              }`}
            >
              {/* Step Summary Header */}
              <div className="flex items-center justify-between p-3.5 sm:p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-xs font-semibold font-mono text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    0{idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading text-sm font-semibold text-foreground truncate">
                        {step.title}
                      </span>
                      <span className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] text-muted-foreground font-normal">
                        {step.delay_label}
                      </span>
                      {!step.enabled && (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Paused
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate max-w-lg mt-0.5 font-normal">
                      Subject: {step.subject}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 mr-1">
                    <span className="text-xs text-muted-foreground hidden sm:inline">Active</span>
                    <Switch
                      checked={step.enabled}
                      onCheckedChange={(val) => updateStep(idx, "enabled", val)}
                    />
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                    className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Step Expanded Content */}
              {isExpanded && (
                <div className="border-t border-border p-4 sm:p-5 space-y-4 bg-muted/20 rounded-b-2xl">
                  {/* Subject Line */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">Email subject line</Label>
                    <Input
                      value={step.subject}
                      onChange={(e) => updateStep(idx, "subject", e.target.value)}
                      className="h-8 rounded-lg text-xs font-medium bg-background border-input text-foreground focus-visible:border-blue-500"
                    />
                  </div>

                  {/* Body Text */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-foreground">Message content</Label>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-muted-foreground mr-1">Insert tag:</span>
                        {MERGE_TAGS.map((t) => (
                          <button
                            key={t.tag}
                            type="button"
                            onClick={() => insertTag(idx, t.tag)}
                            className="rounded px-1.5 py-0.5 text-[10px] font-mono border border-border bg-background text-muted-foreground hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            {t.tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Textarea
                      rows={8}
                      value={step.body}
                      onChange={(e) => updateStep(idx, "body", e.target.value)}
                      className="rounded-lg font-mono text-xs leading-relaxed bg-background border-input text-foreground focus-visible:border-blue-500"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Delivered in founder letter layout with auto-linked URLs and direct reply routing.
                    </p>
                  </div>

                  {/* Actions for this Step */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-border">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Test email recipient"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        className="h-8 w-56 rounded-lg font-mono text-xs bg-background border-input text-foreground"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSendTest(step.id)}
                        disabled={testingStepId === step.id}
                        className="h-8 rounded-lg px-3 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shrink-0"
                      >
                        {testingStepId === step.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Send preview
                      </Button>
                    </div>

                    <span className="text-[11px] text-muted-foreground self-end sm:self-center font-normal">
                      {step.delay_hours === 0 ? "Triggers immediately upon signup" : `Triggers ${step.delay_hours} hours after signup`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
