import { useState, useEffect } from "react";
import { Database, X, RefreshCw, UserCheck, ShieldCheck, Search, Plus, Mail } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import SectionCard from "@/components/common/SectionCard";
import CloudflareStoragePanel from "@/components/settings/CloudflareStoragePanel";
import { formatDate } from "@/lib/format";

export default function ByocAccessPanel() {
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [granting, setGranting] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await webrader.functions.invoke("cloudflare", {
        action: "admin_get_byoc_requests",
      });

      if (res?.data?.ok) {
        setRequests(res.data.requests || []);
      }
    } catch (err) {
      toast({
        title: "Failed to load requests",
        description: err.message || "Could not retrieve BYOC requests.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetAccess = async (email, status) => {
    if (!email) return;
    setActionLoading(`${email}-${status}`);
    try {
      const res = await webrader.functions.invoke("cloudflare", {
        action: "admin_set_byoc_access",
        email: email.trim(),
        status,
      });

      if (res?.data?.ok) {
        toast({
          title: status === "approved" ? "Access granted" : "Access revoked",
          description: `Cloudflare BYOC access has been ${status} for ${email}.`,
        });
        await loadRequests();
      } else {
        throw new Error(res?.data?.error || "Failed to update access.");
      }
    } catch (err) {
      toast({
        title: "Action failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDirectGrant = async (e) => {
    e.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid user email address.",
        variant: "destructive",
      });
      return;
    }

    setGranting(true);
    try {
      const res = await webrader.functions.invoke("cloudflare", {
        action: "admin_set_byoc_access",
        email: cleanEmail,
        status: "approved",
      });

      if (res?.data?.ok) {
        toast({
          title: "Access granted",
          description: `BYOC access unlocked for ${cleanEmail}. They can now connect their Cloudflare D1 database.`,
        });
        setNewEmail("");
        await loadRequests();
      } else {
        throw new Error(res?.data?.error || "Failed to grant access.");
      }
    } catch (err) {
      toast({
        title: "Grant failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setGranting(false);
    }
  };

  const filteredRequests = requests.filter((r) =>
    r.email.toLowerCase().includes(search.toLowerCase().trim())
  );

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;

  return (
    <div className="space-y-6">
      {/* Information Header & Direct Access Tool */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <SectionCard
            title="Grant BYOC Access by Email"
            description="Authorize specific users to connect their own Cloudflare D1 database. Hostinger remains the default storage for all other users."
          >
            <form onSubmit={handleDirectGrant} className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Enter user email address (e.g. user@company.com)..."
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
              <Button
                type="submit"
                disabled={granting || !newEmail.trim()}
                className="w-full sm:w-auto h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 inline-flex items-center gap-1.5"
              >
                {granting ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                <span>Grant Access</span>
              </Button>
            </form>

            <div className="mt-4 rounded-lg bg-blue-500/5 border border-blue-500/20 p-3 text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Hostinger Default & BYOC Policy</span>
              </div>
              <p>
                All users default to high-performance managed Hostinger storage. When a user requests BYOC in their Settings, you will receive an instant Telegram notification and can approve them below in one click.
              </p>
            </div>
          </SectionCard>
        </div>

        {/* Quick Summary Counts */}
        <div className="space-y-4">
          <SectionCard title="Access Overview" description="Current BYOC authorization state">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card">
                <span className="text-xs text-muted-foreground">Pending Requests</span>
                <Badge variant={pendingCount > 0 ? "secondary" : "outline"} className={pendingCount > 0 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" : ""}>
                  {pendingCount}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card">
                <span className="text-xs text-muted-foreground">Approved Users</span>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                  {approvedCount}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card">
                <span className="text-xs text-muted-foreground">Founder Access</span>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  Unrestricted
                </Badge>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Requests Management Table */}
      <SectionCard
        title="Submitted Access Requests"
        description="Review incoming requests from users wanting to store tracking events in their personal Cloudflare accounts."
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadRequests}
            disabled={loading}
            className="h-8 text-xs inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-xs">Loading requests...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center p-6 border border-dashed border-border rounded-xl">
            <Database className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-foreground">No BYOC requests found</p>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              When users click &quot;Submit Request for BYOC Access&quot; in Settings, their request will appear here for 1-click approval.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                  <th className="py-2.5 px-3">User Email</th>
                  <th className="py-2.5 px-3">Requested At</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {filteredRequests.map((req) => {
                  const isApproved = req.status === "approved";
                  const isPending = req.status === "pending";
                  const isRevoked = req.status === "revoked";
                  const isActing = actionLoading?.startsWith(req.email);

                  return (
                    <tr key={req.email} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-3 font-medium text-foreground">
                        {req.email}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {formatDate(req.requested_at)}
                      </td>
                      <td className="py-3 px-3">
                        {isApproved && (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px]">
                            Approved
                          </Badge>
                        )}
                        {isPending && (
                          <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px]">
                            Pending Review
                          </Badge>
                        )}
                        {isRevoked && (
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-[10px]">
                            Revoked
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          {!isApproved ? (
                            <Button
                              size="sm"
                              disabled={isActing}
                              onClick={() => handleSetAccess(req.email, "approved")}
                              className="h-7 text-[11px] bg-blue-600 hover:bg-blue-700 text-white font-medium px-2.5 inline-flex items-center gap-1"
                            >
                              {isActing && actionLoading === `${req.email}-approved` ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <UserCheck className="h-3 w-3" />
                              )}
                              <span>Approve</span>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isActing}
                              onClick={() => handleSetAccess(req.email, "revoked")}
                              className="h-7 text-[11px] text-destructive hover:bg-destructive/10 border-border hover:border-destructive/30 px-2.5 inline-flex items-center gap-1"
                            >
                              {isActing && actionLoading === `${req.email}-revoked` ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                              <span>Revoke</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Admin Cloudflare D1 Storage Setup (Admin Only) */}
      <SectionCard
        title="Admin Cloudflare D1 Storage Setup"
        description="Configure and test your personal Cloudflare D1 database connection for the platform."
      >
        <CloudflareStoragePanel />
      </SectionCard>
    </div>
  );
}
