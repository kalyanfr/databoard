import { Outlet } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import AdminNav from "@/components/admin/AdminNav";
import PageHeader from "@/components/common/PageHeader";
import { useAuth } from "@/lib/AuthContext";

/** Admin shell: its own navigation, separate from the user panel. */
export default function Admin() {
  const { user } = useAuth();

  if (!user) {
    return <div className="py-8 text-sm text-muted-foreground">Loading…</div>;
  }

  const isAdmin = user.role === "admin" || user.email?.toLowerCase() === "gurukalyanreddyd@gmail.com";

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <div className="gloss-card flex items-center gap-3 rounded-2xl sm:rounded-3xl p-4 sm:p-6">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shrink-0">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <p className="font-heading text-sm font-semibold">Admin access required</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Only admins can open the admin panel. Ask an admin to upgrade your role.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-clip">
      <PageHeader
        title="Admin panel"
        description="Every user, project, monitor, campaign and app-wide setting — the control room for the whole workspace."
      />
      <div className="flex flex-col w-full min-w-0 max-w-full gap-4 sm:gap-6 lg:grid lg:grid-cols-[210px_1fr]">
        <AdminNav />
        <div className="w-full min-w-0 max-w-full space-y-4 sm:space-y-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
