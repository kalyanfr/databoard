import { Megaphone } from "lucide-react";
import { useAppConfig } from "@/lib/appConfig";

/** App-wide notice an admin can publish from the admin panel. */
export default function MaintenanceBanner() {
  const { data: config } = useAppConfig();
  const message = config?.maintenance_banner?.trim();
  if (!message) return null;

  return (
    <div className="animate-fade-up mb-6 flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3">
      <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p className="text-sm text-foreground">{message}</p>
    </div>
  );
}