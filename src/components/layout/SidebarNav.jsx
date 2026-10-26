import { NavLink } from "react-router-dom";
import { Activity, BarChart3, Filter, FolderKanban, LayoutDashboard, LifeBuoy, LogOut, Radio, Settings2, ShieldCheck, Target, Users } from "lucide-react";
import BrandMark from "@/components/layout/BrandMark";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/realtime", label: "Realtime", icon: Radio },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/funnels", label: "Funnels", icon: Filter },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/users", label: "Users", icon: Users },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/uptime", label: "Uptime", icon: Activity },
  { to: "/support", label: "Support", icon: LifeBuoy },
  { to: "/settings", label: "Settings", icon: Settings2 },
];

export default function SidebarNav({ onNavigate }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin" || user?.email?.toLowerCase() === "gurukalyanreddyd@gmail.com";

  const items = [
    ...NAV,
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: ShieldCheck }] : []),
  ];

  const handleLogout = async () => {
    try {
      onNavigate?.();
      await logout(true);
    } catch {
      window.location.href = "/";
    }
  };

  return (
    <div className="flex h-full w-full flex-col justify-between p-4">
      <div className="space-y-6">
        <NavLink to="/" onClick={onNavigate} className="flex items-center gap-3 px-2 pt-2">
          <BrandMark className="h-9 w-9" />
          <div className="min-w-0">
            <p className="font-heading text-sm font-bold tracking-tight text-foreground">Data Board</p>
            <p className="truncate text-[11px] text-muted-foreground">Realtime analytics</p>
          </div>
        </NavLink>

        <nav className="flex flex-col gap-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-500">
                  {item.badge}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="space-y-3 pt-4 border-t border-border/60">
        {/* Lifetime SaaS License Status */}
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs space-y-1">
          <div className="flex items-center justify-between font-medium">
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold">
              <ShieldCheck className="h-4 w-4" /> Lifetime Pro
            </span>
            <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.2 text-[10px] font-mono uppercase font-bold text-blue-600 dark:text-blue-400">
              Active
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Unlimited tracking · Zero credit limits
          </p>
        </div>

        {/* User Profile & Theme Toggle */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">{user?.name || "Member"}</p>
            <p className="truncate text-[10px] text-muted-foreground">{user?.email}</p>
          </div>
          <ThemeToggle />
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/80 bg-card py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}
