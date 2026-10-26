import { NavLink } from "react-router-dom";
import { Activity, BarChart3, FolderKanban, LifeBuoy, Mail, Settings2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { to: "/admin", label: "Overview", icon: BarChart3, end: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/projects", label: "Projects", icon: FolderKanban },
  { to: "/admin/monitors", label: "Uptime", icon: Activity },
  { to: "/admin/support", label: "Support", icon: LifeBuoy },
  { to: "/admin/marketing", label: "Marketing", icon: Mail },
  { to: "/admin/settings", label: "Settings", icon: Settings2 },
];

/** Fully responsive Admin navigation: 3x2 grid on mobile (fits 100% of screen with 0 clipping), 6-cols on tablet, vertical sidebar on desktop */
export default function AdminNav() {
  return (
    <nav className="w-full min-w-0 max-w-full lg:sticky lg:top-6 lg:self-start">
      <div className="glass grid w-full min-w-0 max-w-full grid-cols-3 gap-1.5 rounded-2xl border border-border p-1.5 sm:grid-cols-6 lg:flex lg:flex-col lg:gap-1">
        {SECTIONS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-center text-xs font-semibold transition-all duration-200 lg:justify-start lg:px-3.5 lg:py-2.5",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 lg:bg-primary/10 lg:text-primary lg:shadow-none"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )
            }
          >
            <Icon className="h-3.5 w-3.5 shrink-0 stroke-[2.2]" />
            <span className="truncate text-[11px] sm:text-xs">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
