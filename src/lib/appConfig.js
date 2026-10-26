import { useQuery } from "@tanstack/react-query";
import { webrader } from "@/api/webraderClient";

/** SaaS-wide settings (brand sender, support address, alert switch, banner). */
export function useAppConfig() {
  return useQuery({
    queryKey: ["app-config"],
    queryFn: async () => {
      const page = await webrader.entities.AppConfig.list({ sort: "-created_date", limit: 1 });
      const item = page.items?.[0] ?? null;
      if (item) {
        if (!item.support_email || item.support_email.includes("edualgo") || item.support_email.includes("datopin")) {
          item.support_email = "support@databoard.in";
        }
        if (!item.from_name || item.from_name === "Kr" || item.from_name === "Datopin") {
          item.from_name = "Data Board";
        }
      }
      return item;
    },
    staleTime: 60000,
  });
}

export const DEFAULT_CONFIG = {
  from_name: "Data Board",
  support_email: "support@databoard.in",
  uptime_alerts_enabled: true,
  maintenance_banner: "",
};

/** Creates the settings record the first time an admin saves. */
export async function writeAppConfig(existing, values) {
  if (existing?.id) return webrader.entities.AppConfig.update(existing.id, values);
  return webrader.entities.AppConfig.create(values);
}
