import React, { useEffect, useState } from "react";
import { webrader, supabase } from "@/api/webraderClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, RefreshCw, User } from "lucide-react";
import moment from "moment";

const STATUS_STYLES = {
  open: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  in_review: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  resolved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
};

const STATUS_LABELS = { open: "Open", in_review: "In review", resolved: "Resolved" };

export default function TicketsPanel() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const { items = [] } = await webrader.entities.SupportTicket.filter({}, { sort: "-created_date", limit: 100 });
      let profileMap = new Map();
      try {
        const { data: profiles } = await supabase.from("profiles").select("id, email, full_name");
        if (profiles) {
          profileMap = new Map(profiles.map((p) => [p.id, p]));
        }
      } catch (err) {
        console.warn("Could not load user profiles:", err);
      }

      const enriched = (items || []).map((ticket) => {
        const profile = profileMap.get(ticket.created_by_id);
        return {
          ...ticket,
          user_email: profile?.email || ticket.created_by || ticket.owner_email || ticket.created_by_id || "User",
          user_name: profile?.full_name,
        };
      });

      setTickets(enriched);
    } catch (err) {
      console.warn("Could not load tickets:", err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const updateTicket = async (ticket, patch) => {
    setSavingId(ticket.id);
    try {
      await webrader.entities.SupportTicket.update(ticket.id, patch);
      toast({
        title: "Reply saved",
        description: "The user will now see this response in their support desk.",
      });
      await loadTickets();
    } catch (err) {
      toast({
        title: "Could not save reply",
        description: err.message || "Try again.",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-1">
        <p className="text-xs text-muted-foreground">
          {tickets.length} ticket{tickets.length === 1 ? "" : "s"} submitted by users
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={loadTickets}
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {loading && tickets.length === 0 ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading tickets…
        </div>
      ) : tickets.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">No support tickets submitted yet.</p>
      ) : (
        tickets.map((ticket) => (
          <TicketRow key={ticket.id} ticket={ticket} saving={savingId === ticket.id} onUpdate={updateTicket} />
        ))
      )}
    </div>
  );
}

function TicketRow({ ticket, saving, onUpdate }) {
  const [reply, setReply] = useState(ticket.reply || "");
  const [status, setStatus] = useState(ticket.status || "open");

  const save = () => onUpdate(ticket, { reply, status });

  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-heading text-sm font-semibold tracking-tight">{ticket.subject}</p>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={STATUS_STYLES[status] || ""}>
            {STATUS_LABELS[status] || status}
          </Badge>
          <span className="text-[11px] text-muted-foreground">{moment(ticket.created_date).fromNow()}</span>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-xs">
        <User className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium text-foreground">{ticket.user_email}</span>
        {ticket.user_name ? <span className="text-muted-foreground">({ticket.user_name})</span> : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{ticket.message}</p>
      <div className="mt-3 space-y-2 rounded-xl border border-border bg-muted/30 p-3">
        <Textarea
          rows={2}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Write a response to the user…"
          className="bg-background"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_review">In review</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="rounded-xl" disabled={saving} onClick={save}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Save Response
          </Button>
        </div>
      </div>
    </div>
  );
}