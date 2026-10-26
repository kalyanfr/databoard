import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

export default function NotificationPrefs() {
  const { user, checkUserAuth } = useAuth();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const subscribed = user?.product_updates !== false;

  const toggle = async (next) => {
    setPending(true);
    try {
      await webrader.auth.updateMe({ product_updates: next });
      await checkUserAuth();
      toast({
        title: next ? "Product emails on" : "Product emails off",
        description: next ? "You will hear about new features." : "You will only get account and alert emails.",
      });
    } catch (error) {
      toast({ title: "Could not save", description: error?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-background/60 p-4">
        <div>
          <p className="text-sm font-semibold">Product & marketing emails</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Feature announcements and tips. Account, uptime and billing emails always arrive.
          </p>
        </div>
        {pending ? <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" /> : null}
        <Switch checked={subscribed} disabled={pending} onCheckedChange={toggle} aria-label="Product emails" />
      </div>

      <div className="rounded-2xl border border-border bg-background/60 p-4">
        <p className="text-sm font-semibold">Uptime alerts</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Down and recovery emails are sent to the address saved on each monitor — you can change it per site.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3 rounded-xl">
          <Link to="/uptime">Manage monitors</Link>
        </Button>
      </div>
    </div>
  );
}