import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { webrader } from "@/api/webraderClient";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import AppLayout from "@/components/layout/AppLayout";
import LandingNav from "@/components/landing/LandingNav";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { LifeBuoy, Loader2, Send, Mail, Clock, CheckCircle2, ArrowRight, RefreshCw } from "lucide-react";

const STATUS_STYLES = {
  open: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  in_review: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  resolved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
};

const STATUS_LABELS = { open: "Open", in_review: "In review", resolved: "Resolved" };

export default function Support() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guestEmail, setGuestEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadTickets = async () => {
    if (!user?.id) {
      setTickets([]);
      setLoading(false);
      return;
    }
    try {
      const { items } = await webrader.entities.SupportTicket.filter(
        { created_by_id: user.id },
        { sort: "-created_date", limit: 50 }
      );
      setTickets(items || []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    const interval = setInterval(loadTickets, 20000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!subject.trim() || !message.trim()) {
      setError("Please fill in both the subject and the message.");
      return;
    }
    if (!user && !guestEmail.trim()) {
      setError("Please provide your email address so our team can follow up.");
      return;
    }

    setSubmitting(true);
    try {
      if (user) {
        await webrader.entities.SupportTicket.create({
          subject: subject.trim(),
          message: message.trim(),
        });
        toast({ title: "Ticket submitted", description: "Our team will review your ticket and reply shortly." });
        await loadTickets();
      } else {
        // Direct email dispatch for unauthenticated public visitors
        const mailUrl = `mailto:support@databoard.in?subject=${encodeURIComponent(
          subject.trim()
        )}&body=${encodeURIComponent(`From: ${guestEmail.trim()}\n\n${message.trim()}`)}`;
        window.location.href = mailUrl;
        toast({
          title: "Inquiry prepared",
          description: "Opening your mail client, or send directly to support@databoard.in",
        });
      }
      setSubject("");
      setMessage("");
      setGuestEmail("");
    } catch (err) {
      setError(err.message || "Could not submit the ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const supportBody = (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Support & Help Desk"
        description="Have a question, need assistance with installation, or want custom events? Our engineers typically reply within 2 hours."
      />

      {/* Quick Support Channels */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="gloss-card flex flex-col justify-between rounded-2xl p-4 sm:p-5">
          <div className="space-y-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mail className="h-4 w-4" />
            </div>
            <h4 className="font-heading text-sm font-semibold text-foreground">Direct Email Support</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Reach our founders and engineering team directly for technical inquiries or custom contracts.
            </p>
          </div>
          <a
            href="mailto:support@databoard.in"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            support@databoard.in <ArrowRight className="h-3 w-3" />
          </a>
        </div>

        <div className="gloss-card flex flex-col justify-between rounded-2xl p-4 sm:p-5">
          <div className="space-y-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Clock className="h-4 w-4" />
            </div>
            <h4 className="font-heading text-sm font-semibold text-foreground">Fast Turnaround</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tickets are handled directly by active engineers — not automated chatbots or tiered call centers.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Average response: ~2 hours</span>
          </div>
        </div>
      </div>

      {/* Ticket Submission Form */}
      <SectionCard
        title={user ? "Open a support ticket" : "Submit an inquiry"}
        description={
          user
            ? "Your ticket will be routed directly to the admin panel with your account context."
            : "Have questions before signing up? Send our team a message."
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!user ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="guestEmail">Your Email Address</Label>
                <Link to="/login" className="text-xs text-primary hover:underline">
                  Already have an account? Sign in
                </Link>
              </div>
              <Input
                id="guestEmail"
                type="email"
                required
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Question about tracking script or custom goals"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your question or issue in detail…"
            />
          </div>

          {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}

          <div className="flex items-center justify-between pt-2">
            <Button type="submit" disabled={submitting} className="sheen rounded-xl">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {user ? "Submit ticket" : "Send inquiry"}
            </Button>
            {!user ? (
              <span className="text-xs text-muted-foreground">
                Or email directly to{" "}
                <a href="mailto:support@databoard.in" className="font-medium text-foreground hover:underline">
                  support@databoard.in
                </a>
              </span>
            ) : null}
          </div>
        </form>
      </SectionCard>

      {/* Ticket History (Logged-in users) */}
      {user ? (
        <SectionCard
          title={`Your tickets (${tickets.length})`}
          description="Track replies and status from our team."
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={loadTickets}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          }
        >
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your tickets…
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <LifeBuoy className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">No tickets yet — submit one above and it will show up here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-heading text-sm font-semibold tracking-tight">{ticket.subject}</p>
                    <Badge variant="outline" className={STATUS_STYLES[ticket.status] || ""}>
                      {STATUS_LABELS[ticket.status] || ticket.status}
                    </Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{ticket.message}</p>
                  {ticket.reply ? (
                    <div className="mt-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Response from support</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{ticket.reply}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}
    </div>
  );

  // If visitor is unauthenticated (e.g. clicked from landing page), wrap with landing navigation & footer
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <LandingNav />
        <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">{supportBody}</main>
        <Footer />
      </div>
    );
  }

  return <AppLayout>{supportBody}</AppLayout>;
}
