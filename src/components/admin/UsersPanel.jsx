import React, { useEffect, useState } from "react";
import { webrader } from "@/api/webraderClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus, Shield, User } from "lucide-react";

export default function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState(null);

  const loadUsers = async () => {
    const res = await webrader.entities.User.list({ limit: 100 });
    const items = Array.isArray(res) ? res : res?.items ?? [];
    setUsers(items);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const changeRole = async (id, role) => {
    await webrader.entities.User.update(id, { role });
    await loadUsers();
  };

  const sendInvite = async (e) => {
    e.preventDefault();
    setInviteMessage(null);
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await webrader.users.inviteUser(inviteEmail.trim(), inviteRole);
      setInviteMessage({ type: "success", text: `Invitation sent to ${inviteEmail.trim()}.` });
      setInviteEmail("");
      await loadUsers();
    } catch (err) {
      setInviteMessage({ type: "error", text: err.message || "Could not send the invitation." });
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-background/60 p-4">
        <p className="font-heading text-sm font-semibold tracking-tight">Invite a user</p>
        <form onSubmit={sendInvite} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5 sm:w-40">
            <Label>Role</Label>
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={inviting} className="w-full rounded-xl sm:w-auto">
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Invite
          </Button>
        </form>
        {inviteMessage ? (
          <p className={`mt-2 text-xs font-medium ${inviteMessage.type === "success" ? "text-emerald-600" : "text-destructive"}`}>
            {inviteMessage.text}
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
        </div>
      ) : !users.length ? (
        <p className="py-6 text-sm text-muted-foreground">No users found.</p>
      ) : (
        <>
          {/* Mobile User Cards: compact, touch-friendly, responsive */}
          <div className="space-y-2.5 sm:hidden">
            {users.map((u) => (
              <div key={u.id} className="rounded-2xl border border-border bg-card/60 p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{u.email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{u.full_name || "—"}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {u.role === "admin" ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Shield className="h-3 w-3" />
                      </span>
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <User className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs">
                  <span className="text-muted-foreground">Role</span>
                  <Select value={u.role || "user"} onValueChange={(role) => changeRole(u.id, role)}>
                    <SelectTrigger className="h-8 w-28 text-xs font-medium rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 text-xs font-medium text-foreground">{u.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.full_name || "—"}</td>
                    <td className="w-32 px-4 py-3">
                      <Select value={u.role || "user"} onValueChange={(role) => changeRole(u.id, role)}>
                        <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
