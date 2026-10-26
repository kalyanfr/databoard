import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import { trackingSnippet } from "@/lib/snippet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function TrackingSnippet({ project }) {
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(null);
  const [verifiedProject, setVerifiedProject] = useState(project);
  const [localVerified, setLocalVerified] = useState(false);
  const [origin, setOrigin] = useState("https://databoard.in");
  const queryClient = useQueryClient();

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    setVerifiedProject(project);
    if (project?.status !== "verified") {
      setLocalVerified(false);
    }
  }, [project]);

  const isVerified = (verifiedProject?.status === "verified" || localVerified) && verifiedProject?.status !== "pending";
  const snippet = trackingSnippet(origin, verifiedProject?.domain, verifiedProject?.project_id);
  const allInOneSnippet = `<!-- Data Board All-in-One Privacy Analytics -->\n${snippet}\n\n<!-- Note: That's all! Pageviews, sessions, durations, and AI traffic are auto-tracked.\n     Declarative HTML Goals (No JavaScript required):\n     <button data-goal="signup" data-revenue="49">Sign Up</button>\n\n     Optional JavaScript SDK triggers:\n     window.analytics?.goal("signup", { revenue: 49, plan: "pro" });\n     window.analytics?.identify("user_123", { email: "user@example.com", name: "User Name" });\n-->`;

  const verify = async () => {
    setPending(true);
    setMessage(null);
    try {
      const response = await webrader.functions.invoke("verifyDomain", {
        id: verifiedProject.id,
        project_id: verifiedProject.project_id,
        domain: verifiedProject.domain,
      });
      const data = response.data ?? {};
      if (data.verified) {
        setLocalVerified(true);
        setVerifiedProject((previous) => ({ ...previous, status: "verified" }));
        setMessage({ ok: true, text: data.message ?? "Domain ownership verified." });
        await queryClient.invalidateQueries({ queryKey: ["projects"] });
        await queryClient.invalidateQueries({ queryKey: ["project-health"] });
      } else {
        setLocalVerified(false);
        setVerifiedProject((previous) => ({ ...previous, status: "pending" }));
        setMessage({ ok: false, text: data.error ?? "The snippet was not found on your site yet." });
        await queryClient.invalidateQueries({ queryKey: ["projects"] });
        await queryClient.invalidateQueries({ queryKey: ["project-health"] });
      }
    } catch (error) {
      setLocalVerified(false);
      setVerifiedProject((previous) => ({ ...previous, status: "pending" }));
      setMessage({ ok: false, text: error?.message ?? "The verification request failed." });
    } finally {
      setPending(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(allInOneSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard write disallowed
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border p-4 transition-colors ${
          isVerified ? "border-primary/30 bg-primary/5" : "border-border bg-muted/40"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:items-center">
            <span
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                isVerified ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"
              }`}
            >
              {isVerified ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4 text-amber-500" />}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">
                  {isVerified ? "Domain ownership verified" : "Ownership verification pending"}
                </p>
                <Badge
                  variant="outline"
                  className={`rounded-lg text-[10px] ${
                    isVerified ? "border-primary/30 bg-primary/10 text-primary" : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {isVerified ? "Active" : "Pending"}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isVerified
                  ? "Analytics are live for this domain."
                  : `Install the snippet on ${verifiedProject?.domain || "your site"} with key ${verifiedProject?.project_id} and click below to verify.`}
              </p>
            </div>
          </div>

          {isVerified ? (
            <Button
              size="sm"
              variant="outline"
              onClick={verify}
              disabled={pending}
              className="shrink-0 gap-1.5 rounded-xl border-border text-xs"
              title="Re-check that your tracking key is still installed on the domain"
            >
              {pending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Re-check ownership
                </>
              )}
            </Button>
          ) : (
            <Button size="sm" onClick={verify} disabled={pending} className="sheen shrink-0 gap-2 rounded-xl shadow-glow">
              {pending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" /> Verify ownership now
                </>
              )}
            </Button>
          )}
        </div>

        {message ? (
          <div
            className={`mt-3 rounded-xl border p-3 text-xs leading-relaxed ${
              message.ok
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-destructive/20 bg-destructive/10 text-destructive"
            }`}
          >
            {message.text}
          </div>
        ) : null}
      </div>

      {/* Domain Shield Origin Protection Note */}
      <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs">
        <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
        <p className="text-muted-foreground leading-relaxed">
          <strong className="text-foreground font-semibold">Origin Protection Active:</strong> Events sent with this key are restricted to <code className="font-semibold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px]">{verifiedProject?.domain || "your domain"}</code> and its subdomains. Unauthorized origins cannot pollute your stats or consume your quota.
        </p>
      </div>

      {/* Single All-in-One Snippet Block */}
      <div className="relative rounded-2xl border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between pb-2 border-b border-border/60">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            All-in-One Tracking Code (Copy & paste once into &lt;head&gt; or &lt;body&gt;)
          </span>
          <Button variant="ghost" size="sm" onClick={copy} className="h-7 gap-1.5 rounded-lg px-2 text-xs">
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-primary" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-card p-3 font-mono text-xs leading-relaxed text-foreground border border-border/60">
          <code>{allInOneSnippet}</code>
        </pre>
      </div>

      <p className="text-xs text-muted-foreground">
        ✓ Single installation step: pasting this one snippet into your site automatically activates real-time telemetry, session analysis, and LLM crawler detection. No multiple scripts needed.
      </p>
    </div>
  );
}
