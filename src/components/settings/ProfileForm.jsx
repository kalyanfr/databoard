import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export default function ProfileForm() {
  const { user, checkUserAuth } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ full_name: "", alert_email: "" });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setForm({ full_name: user?.full_name ?? "", alert_email: user?.alert_email ?? user?.email ?? "" });
  }, [user]);

  const submit = async (event) => {
    event.preventDefault();
    setPending(true);
    try {
      await webrader.auth.updateMe({ full_name: form.full_name.trim(), alert_email: form.alert_email.trim() });
      await checkUserAuth();
      toast({ title: "Profile saved", description: "Uptime alerts use this address by default." });
    } catch (error) {
      toast({ title: "Could not save", description: error?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-2">
        <Label htmlFor="profile-name">Full name</Label>
        <Input
          id="profile-name"
          value={form.full_name}
          onChange={(event) => setForm((previous) => ({ ...previous, full_name: event.target.value }))}
          placeholder="Your name"
          className="rounded-xl"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-email">Alert email</Label>
        <Input
          id="profile-email"
          type="email"
          value={form.alert_email}
          onChange={(event) => setForm((previous) => ({ ...previous, alert_email: event.target.value }))}
          placeholder="you@company.com"
          className="rounded-xl"
        />
        <p className="text-xs text-muted-foreground">
          Used as the default inbox when you add a new uptime monitor. Each monitor can use its own address.
        </p>
      </div>
      <Button type="submit" disabled={pending} className="rounded-xl">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save profile
      </Button>
    </form>
  );
}