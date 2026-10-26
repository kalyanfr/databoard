import SaasSettingsForm from "@/components/admin/SaasSettingsForm";
import SectionCard from "@/components/common/SectionCard";
import { Info } from "lucide-react";

export default function AdminSettings() {
  return (
    <>
      <SectionCard title="App settings" description="These apply to every user in the workspace">
        <SaasSettingsForm />
      </SectionCard>

      <SectionCard title="Automation" description="What runs on its own">
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/60 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Uptime checks every 5 minutes</p>
            <p className="text-xs text-muted-foreground">
              Every active monitor is checked automatically and alerts are emailed on the first failure and again on
              recovery. The schedule lives in the dashboard under Automations, where you can pause or change it.
            </p>
          </div>
        </div>
      </SectionCard>
    </>
  );
}