import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users as UsersIcon,
  Search,
  DollarSign,
  ChevronRight,
  Copy,
  Check,
  Layers,
  ShoppingBag,
  UserCheck,
  RefreshCw,
  Compass,
  Sparkles,
} from "lucide-react";
import { supabase, webrader } from "@/api/webraderClient";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import StatCard from "@/components/common/StatCard";
import FiltersBar from "@/components/analytics/FiltersBar";
import EmptyState from "@/components/common/EmptyState";
import { LoadingBlock, ErrorState } from "@/components/common/LoadingBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { countryMeta, flagEmoji } from "@/lib/geo";
import { formatCurrency, formatNumber, formatDuration, relativeTime } from "@/lib/format";
import { useActiveProject, useRange } from "@/lib/filters";
import { cn } from "@/lib/utils";

// Deterministic pastel avatar background
function getAvatarGradient(id = "") {
  const gradients = [
    "from-blue-600 to-indigo-600 text-white",
    "from-emerald-600 to-teal-600 text-white",
    "from-purple-600 to-pink-600 text-white",
    "from-amber-600 to-orange-600 text-white",
    "from-cyan-600 to-blue-600 text-white",
    "from-rose-600 to-red-600 text-white",
    "from-violet-600 to-purple-600 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
  return gradients[Math.abs(hash) % gradients.length];
}

function shortId(id = "") {
  if (!id) return "anon";
  return id.length > 8 ? id.slice(0, 8) : id;
}

function formatElapsed(ms) {
  if (!ms || ms <= 0) return "< 1m";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = (hours / 24).toFixed(1);
  return `${days}d`;
}

export default function Users() {
  const { project, isLoading: isProjectLoading, error: projectError } = useActiveProject();
  const range = useRange();

  const [activeTab, setActiveTab] = useState("journey"); // "journey" | "visitors"
  const [searchQuery, setSearchQuery] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("all"); // "all" | "customers" | "identified"
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Fetch events for active project in current date range (up to 6000 events)
  const {
    data: rawEvents = [],
    isLoading: isEventsLoading,
    error: eventsError,
    refetch,
  } = useQuery({
    queryKey: ["users-all-events", project?.id, project?.project_id, range.from, range.to],
    enabled: !!project,
    queryFn: async () => {
      const cleanDomain = project?.domain
        ? String(project.domain).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "")
        : null;
      const rawProjectIds = [project?.project_id, project?.id, cleanDomain].filter(Boolean);
      const projectIds = Array.from(new Set(rawProjectIds));
      if (!projectIds.length) return [];

      try {
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .in("project_id", projectIds)
          .gte("timestamp", range.from)
          .lt("timestamp", range.to)
          .order("timestamp", { ascending: false })
          .limit(6000);

        if (error) {
          console.warn("[Users query supabase error, falling back to webrader]:", error.message);
          const res = await webrader.entities.Event.filter(
            { project_id: { $in: projectIds }, timestamp: { $gte: range.from, $lt: range.to } },
            { limit: 6000, sort: "-timestamp" }
          );
          return res.items || [];
        }
        return data || [];
      } catch (err) {
        console.warn("[Users query failed]:", err);
        return [];
      }
    },
    staleTime: 15000,
  });

  // Aggregate raw events into multi-session visitor profiles & customer journeys (Minilytics architecture)
  const { allVisitors, payingJourneys } = useMemo(() => {
    if (!rawEvents.length) return { allVisitors: [], payingJourneys: [] };

    // 1. Group events by visitor_id (or fallback to session_id / anon)
    const visitorMap = new Map();

    for (const evt of rawEvents) {
      const vid = evt.visitor_id || evt.session_id || "anon";
      if (!visitorMap.has(vid)) {
        visitorMap.set(vid, []);
      }
      visitorMap.get(vid).push(evt);
    }

    const visitorsList = [];
    const journeysList = [];

    for (const [vid, evts] of visitorMap.entries()) {
      // Sort visitor events chronologically ascending
      const sorted = [...evts].sort(
        (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
      );

      const firstEvt = sorted[0];
      const lastEvt = sorted[sorted.length - 1];

      // Extract identified traits if window.analytics.identify() was triggered
      let identifiedUserId = null;
      let identifiedEmail = null;
      let identifiedName = null;
      let identifiedPlan = null;
      let aggregatedTraits = {};

      for (const e of sorted) {
        const props = e.properties || {};
        if (props.user_id) identifiedUserId = props.user_id;
        if (props.email) identifiedEmail = props.email;
        if (props.name) identifiedName = props.name;
        if (props.plan) identifiedPlan = props.plan;
        if (e.name === "identify" && props) {
          aggregatedTraits = { ...aggregatedTraits, ...props };
        }
      }

      // Group into multi-session visit timelines
      const sessionMap = new Map();
      let totalRevenue = 0;
      let totalPageviews = 0;
      let firstPaymentEvt = null;

      for (const e of sorted) {
        const sid = e.session_id || `s_${new Date(e.timestamp).toISOString().slice(0, 10)}`;
        if (!sessionMap.has(sid)) {
          sessionMap.set(sid, {
            id: sid,
            started_at: e.timestamp,
            last_seen_at: e.timestamp,
            source: e.channel || e.referrer_domain || (e.referrer ? "Referral" : "Direct"),
            referrer: e.referrer || null,
            referrer_domain: e.referrer_domain || null,
            utm_campaign: e.utm_campaign || null,
            utm_source: e.utm_source || null,
            country: e.country || null,
            device: e.device || null,
            os: e.os || null,
            browser: e.browser || null,
            events: [],
          });
        }

        const sess = sessionMap.get(sid);
        sess.events.push(e);
        if (new Date(e.timestamp) > new Date(sess.last_seen_at)) sess.last_seen_at = e.timestamp;
        if (new Date(e.timestamp) < new Date(sess.started_at)) sess.started_at = e.timestamp;

        if (e.type === "pageview" || !e.type) totalPageviews++;

        const rev = Number(e.revenue) || (e.name === "purchase" || e.name === "Subscription Purchased" ? 49 : 0);
        if (rev > 0) {
          totalRevenue += rev;
          if (!firstPaymentEvt) firstPaymentEvt = e;
        }
      }

      const sessionsList = Array.from(sessionMap.values()).map((s) => {
        const dur = Math.max(
          0,
          Math.round((new Date(s.last_seen_at).getTime() - new Date(s.started_at).getTime()) / 1000)
        );
        return {
          ...s,
          duration: dur,
          events: s.events.reverse(), // newest event first inside session
        };
      }).reverse(); // newest session first

      const firstSession = sessionsList[sessionsList.length - 1];
      const isCustomer = totalRevenue > 0 || !!firstPaymentEvt;
      const isIdentified = !!(identifiedUserId || identifiedEmail || identifiedName);

      const profile = {
        visitor_id: vid,
        name: identifiedName,
        email: identifiedEmail,
        user_id: identifiedUserId,
        plan: identifiedPlan || (isCustomer ? "Customer" : isIdentified ? "Identified" : "Visitor"),
        country: lastEvt?.country || firstEvt?.country || null,
        device: lastEvt?.device || firstEvt?.device || "Desktop",
        os: lastEvt?.os || firstEvt?.os || "Windows",
        browser: lastEvt?.browser || firstEvt?.browser || "Chrome",
        firstSeenAt: firstEvt.timestamp,
        lastSeenAt: lastEvt.timestamp,
        totalEvents: sorted.length,
        totalPageviews,
        totalSessions: sessionsList.length,
        totalRevenue,
        isCustomer,
        isIdentified,
        firstSource: firstSession?.source || firstEvt?.referrer_domain || firstEvt?.channel || "Direct",
        firstReferrer: firstSession?.referrer || firstEvt?.referrer,
        firstCampaign: firstSession?.utm_campaign || firstEvt?.utm_campaign,
        sessions: sessionsList,
        traits: aggregatedTraits,
        rawEventsCount: sorted.length,
      };

      visitorsList.push(profile);

      // If customer made a payment/conversion, construct their Customer Journey attribution record
      if (isCustomer) {
        const firstSeenMs = new Date(firstEvt.timestamp).getTime();
        const paymentMs = new Date(firstPaymentEvt?.timestamp || lastEvt.timestamp).getTime();
        const timeToConvertMs = Math.max(0, paymentMs - firstSeenMs);

        // Count how many visits prior to or during the conversion session
        const visitsToConvert = sessionsList.length;

        journeysList.push({
          id: `conv_${vid}`,
          visitor_id: vid,
          profile,
          amount: totalRevenue,
          source: profile.firstSource,
          referrer: profile.firstReferrer,
          campaign: profile.firstCampaign,
          timeToConvertMs,
          visitsToConvert,
          completedAt: firstPaymentEvt?.timestamp || lastEvt.timestamp,
        });
      }
    }

    // Sort journeys newest completed first
    journeysList.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

    // Sort visitors newest active first
    visitorsList.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

    return { allVisitors: visitorsList, payingJourneys: journeysList };
  }, [rawEvents]);

  // Filter lists based on search and segment
  const filteredVisitors = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allVisitors.filter((v) => {
      const matchesSearch =
        !q ||
        v.visitor_id.toLowerCase().includes(q) ||
        (v.email && v.email.toLowerCase().includes(q)) ||
        (v.name && v.name.toLowerCase().includes(q)) ||
        (v.country && v.country.toLowerCase().includes(q)) ||
        (v.firstSource && v.firstSource.toLowerCase().includes(q));

      const matchesSegment =
        segmentFilter === "all" ||
        (segmentFilter === "customers" && v.isCustomer) ||
        (segmentFilter === "identified" && v.isIdentified);

      return matchesSearch && matchesSegment;
    });
  }, [allVisitors, searchQuery, segmentFilter]);

  const filteredJourneys = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return payingJourneys.filter((j) => {
      const v = j.profile;
      return (
        !q ||
        j.visitor_id.toLowerCase().includes(q) ||
        (v.email && v.email.toLowerCase().includes(q)) ||
        (v.name && v.name.toLowerCase().includes(q)) ||
        (j.source && j.source.toLowerCase().includes(q)) ||
        (j.campaign && j.campaign.toLowerCase().includes(q))
      );
    });
  }, [payingJourneys, searchQuery]);

  // High-level statistics
  const stats = useMemo(() => {
    const totalVisitorsCount = allVisitors.length;
    const payingCustomersCount = payingJourneys.length;
    const totalRevenueAttributed = payingJourneys.reduce((sum, j) => sum + j.amount, 0);
    const identifiedUsersCount = allVisitors.filter((v) => v.isIdentified).length;
    const avgConversionRate =
      totalVisitorsCount > 0 ? ((payingCustomersCount / totalVisitorsCount) * 100).toFixed(1) : "0.0";

    return {
      totalVisitorsCount,
      payingCustomersCount,
      totalRevenueAttributed,
      identifiedUsersCount,
      avgConversionRate,
    };
  }, [allVisitors, payingJourneys]);

  // Automatically select the Visitors directory if there are active visitors but no paying customers yet
  useEffect(() => {
    if (allVisitors.length > 0 && payingJourneys.length === 0) {
      setActiveTab("visitors");
    }
  }, [allVisitors.length, payingJourneys.length]);

  const copySnippet = () => {
    const code = `// 1. Identify user on login or registration:
window.analytics.identify("user_12345", {
  email: "alex@example.com",
  name: "Alex Rivera",
  plan: "Pro"
});

// 2. Track revenue or conversion event:
window.analytics.track("purchase", {
  revenue: 49.00,
  currency: "USD",
  plan: "Pro Annual"
});`;
    navigator.clipboard.writeText(code);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  if (isProjectLoading || isEventsLoading) return <LoadingBlock rows={4} />;
  if (projectError || eventsError) return <ErrorState error={projectError || eventsError} onRetry={refetch} />;

  if (!project) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="No project selected"
        description="Select or create a project to inspect visitor journeys and customer lifecycle profiles."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Customer Journeys"
        description="Pinpoint exact acquisition sources, multi-session touchpoints, and timeline-to-purchase for every visitor."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copySnippet}
            className="sheen gap-2 rounded-xl text-xs font-semibold"
          >
            {copiedSnippet ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedSnippet ? "Snippet Copied" : "Copy identify() Snippet"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="h-8 w-8 rounded-xl shrink-0"
            title="Refresh visitors"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isEventsLoading && "animate-spin")} />
          </Button>
        </div>
      </PageHeader>

      <FiltersBar onRefresh={refetch} refreshing={isEventsLoading} />

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Visitors"
          value={formatNumber(stats.totalVisitorsCount)}
          hint="Tracked in selected period"
          icon={UsersIcon}
          tone="blue"
        />
        <StatCard
          label="Paying Customers"
          value={formatNumber(stats.payingCustomersCount)}
          hint={`${stats.avgConversionRate}% visitor conversion`}
          icon={ShoppingBag}
          tone="teal"
          delay={70}
        />
        <StatCard
          label="Attributed Revenue"
          value={formatCurrency(stats.totalRevenueAttributed)}
          hint="Direct from visitor journeys"
          icon={DollarSign}
          tone="emerald"
          delay={140}
        />
        <StatCard
          label="Identified Accounts"
          value={formatNumber(stats.identifiedUsersCount)}
          hint="Linked via identify() SDK"
          icon={UserCheck}
          tone="violet"
          delay={210}
        />
      </div>

      {/* Main Dual Tab Container: Customer Journey vs All Visitors (Minilytics approach) */}
      <SectionCard
        title={activeTab === "journey" ? "Customer Conversion Journeys" : "All Visitors & Identified Users"}
        description={
          activeTab === "journey"
            ? "Full acquisition attribution for paying customers: first touch source, time to convert, visits, and spend."
            : "Live directory of all visitors, sessions, pageviews, location, and device details."
        }
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Switcher Tabs */}
            <div className="flex items-center rounded-xl border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("journey")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  activeTab === "journey"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Customer Journey ({payingJourneys.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("visitors")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  activeTab === "visitors"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <UsersIcon className="h-3.5 w-3.5" />
                <span>All Visitors ({allVisitors.length})</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-48 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search visitor ID, email, source..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs rounded-xl"
              />
            </div>

            {/* Segment Filter (Only shown on All Visitors tab) */}
            {activeTab === "visitors" && (
              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger className="h-8 w-32 rounded-xl text-xs">
                  <SelectValue placeholder="All Segments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Visitors</SelectItem>
                  <SelectItem value="customers">Customers Only</SelectItem>
                  <SelectItem value="identified">Identified Only</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        }
      >
        {/* Tab 1: Customer Journey View */}
        {activeTab === "journey" && (
          <div>
            {filteredJourneys.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title="No customer conversions yet"
                description="When visitors complete a purchase or checkout, their full acquisition journey, first referrer, time-to-convert, and multi-session timeline will appear here."
              >
                {allVisitors.length > 0 && (
                  <Button
                    onClick={() => setActiveTab("visitors")}
                    size="sm"
                    className="mt-3 gap-2 rounded-xl text-xs font-semibold shadow-xs"
                  >
                    <UsersIcon className="h-3.5 w-3.5" />
                    <span>View All {allVisitors.length} Active Visitors</span>
                  </Button>
                )}
              </EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Visitor / Customer</th>
                      <th className="py-2.5 px-3">First Touch Source</th>
                      <th className="py-2.5 px-3 text-right">Spent</th>
                      <th className="py-2.5 px-3 text-center">Time to Convert</th>
                      <th className="py-2.5 px-3 text-right">Completed At</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredJourneys.map((j) => {
                      const v = j.profile;
                      const country = v.country ? countryMeta(v.country) : null;
                      return (
                        <tr
                          key={j.id}
                          onClick={() => setSelectedVisitor(v)}
                          className="group cursor-pointer hover:bg-muted/40 transition-colors"
                        >
                          {/* Visitor Cell */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-bold text-xs ring-1 ring-border shadow-xs",
                                  getAvatarGradient(v.visitor_id)
                                )}
                              >
                                {(v.name || v.email || v.visitor_id).slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors text-xs sm:text-[13px]">
                                    {v.name || v.email || `Visitor ${shortId(v.visitor_id)}`}
                                  </p>
                                  <Badge
                                    variant="outline"
                                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold px-1.5 py-0"
                                  >
                                    Customer
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                  {v.country && (
                                    <span className="flex items-center gap-1">
                                      <span className="select-none">{flagEmoji(v.country)}</span>
                                      <span>{country?.name || v.country}</span>
                                    </span>
                                  )}
                                  <span>•</span>
                                  <span>{v.device} · {v.os}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Source */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Compass className="h-3 w-3" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground text-xs">{j.source}</p>
                                {j.campaign && (
                                  <p className="text-[10px] text-muted-foreground font-mono">
                                    campaign: {j.campaign}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Spent */}
                          <td className="py-3 px-3 text-right tabular-nums font-bold text-emerald-500 text-xs sm:text-sm">
                            {formatCurrency(j.amount)}
                          </td>

                          {/* Time to Convert */}
                          <td className="py-3 px-3 text-center">
                            <span className="font-semibold text-foreground text-xs tabular-nums">
                              {formatElapsed(j.timeToConvertMs)}
                            </span>
                            <p className="text-[10px] text-muted-foreground">
                              {j.visitsToConvert} {j.visitsToConvert === 1 ? "visit" : "visits"}
                            </p>
                          </td>

                          {/* Completed At */}
                          <td className="py-3 px-3 text-right text-muted-foreground whitespace-nowrap text-xs">
                            {new Date(j.completedAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>

                          {/* Action */}
                          <td className="py-3 px-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2.5 rounded-lg text-xs font-semibold gap-1 text-primary hover:bg-primary/10"
                            >
                              <span>Timeline</span>
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: All Visitors Directory */}
        {activeTab === "visitors" && (
          <div>
            {filteredVisitors.length === 0 ? (
              <EmptyState
                icon={UsersIcon}
                title="No visitors recorded in this range"
                description="Make sure the tracking snippet is active on your site. Once visitors land, their sessions will stream into this directory live."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Visitor</th>
                      <th className="py-2.5 px-3">Acquisition Source</th>
                      <th className="py-2.5 px-3 text-center">Visits</th>
                      <th className="py-2.5 px-3 text-center">Pageviews</th>
                      <th className="py-2.5 px-3 text-right">Total Spent</th>
                      <th className="py-2.5 px-3 text-right">Last Active</th>
                      <th className="py-2.5 px-3 text-right">Profile</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredVisitors.map((v) => {
                      const country = v.country ? countryMeta(v.country) : null;
                      return (
                        <tr
                          key={v.visitor_id}
                          onClick={() => setSelectedVisitor(v)}
                          className="group cursor-pointer hover:bg-muted/40 transition-colors"
                        >
                          {/* Visitor Cell */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-bold text-xs ring-1 ring-border shadow-xs",
                                  getAvatarGradient(v.visitor_id)
                                )}
                              >
                                {(v.name || v.email || v.visitor_id).slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors text-xs sm:text-[13px]">
                                    {v.name || v.email || `Visitor ${shortId(v.visitor_id)}`}
                                  </p>
                                  {v.isCustomer && (
                                    <Badge
                                      variant="outline"
                                      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold px-1.5 py-0"
                                    >
                                      Customer
                                    </Badge>
                                  )}
                                  {v.isIdentified && !v.isCustomer && (
                                    <Badge
                                      variant="outline"
                                      className="border-primary/30 bg-primary/10 text-primary text-[10px] font-semibold px-1.5 py-0"
                                    >
                                      Identified
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                  {v.country && (
                                    <span className="flex items-center gap-1">
                                      <span className="select-none">{flagEmoji(v.country)}</span>
                                      <span>{country?.name || v.country}</span>
                                    </span>
                                  )}
                                  <span>•</span>
                                  <span>{v.device} · {v.os} · {v.browser}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Acquisition Source */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                <Compass className="h-3 w-3" />
                              </span>
                              <div className="truncate max-w-[160px]">
                                <p className="font-medium text-foreground text-xs truncate">{v.firstSource}</p>
                                {v.firstCampaign && (
                                  <p className="text-[10px] text-muted-foreground font-mono truncate">
                                    {v.firstCampaign}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Visits */}
                          <td className="py-3 px-3 text-center tabular-nums font-semibold text-foreground">
                            {v.totalSessions}
                          </td>

                          {/* Pageviews */}
                          <td className="py-3 px-3 text-center tabular-nums text-muted-foreground">
                            {v.totalPageviews}
                          </td>

                          {/* Spent */}
                          <td className="py-3 px-3 text-right tabular-nums font-bold">
                            {v.totalRevenue > 0 ? (
                              <span className="text-emerald-500">{formatCurrency(v.totalRevenue)}</span>
                            ) : (
                              <span className="text-muted-foreground/60">—</span>
                            )}
                          </td>

                          {/* Last Active */}
                          <td className="py-3 px-3 text-right text-muted-foreground whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>{relativeTime(v.lastSeenAt)}</span>
                            </div>
                          </td>

                          {/* Profile Action */}
                          <td className="py-3 px-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2.5 rounded-lg text-xs font-semibold gap-1 text-primary hover:bg-primary/10"
                            >
                              <span>Inspect</span>
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* Multi-Session Visitor Profile Modal (Minilytics VisitorModal Architecture) */}
      {selectedVisitor && (
        <Dialog open={!!selectedVisitor} onOpenChange={(open) => !open && setSelectedVisitor(null)}>
          <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            {/* Header Hero */}
            <div className="border-b border-border/70 p-5 bg-muted/20 shrink-0">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br font-extrabold text-base ring-2 ring-border shadow-sm",
                      getAvatarGradient(selectedVisitor.visitor_id)
                    )}
                  >
                    {(selectedVisitor.name || selectedVisitor.email || selectedVisitor.visitor_id)
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                        {selectedVisitor.name || selectedVisitor.email || `Visitor ${shortId(selectedVisitor.visitor_id)}`}
                      </DialogTitle>
                      {selectedVisitor.isCustomer && (
                        <Badge variant="outline" className="rounded-lg text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                          Customer
                        </Badge>
                      )}
                      {selectedVisitor.isIdentified && !selectedVisitor.isCustomer && (
                        <Badge variant="outline" className="rounded-lg text-[10px] border-primary/30 bg-primary/10 text-primary font-semibold">
                          Identified
                        </Badge>
                      )}
                    </div>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>ID: <code className="font-mono text-foreground">{selectedVisitor.visitor_id}</code></span>
                      {selectedVisitor.country && (
                        <span>• {flagEmoji(selectedVisitor.country)} {countryMeta(selectedVisitor.country)?.name || selectedVisitor.country}</span>
                      )}
                      <span>• {selectedVisitor.device} · {selectedVisitor.os} · {selectedVisitor.browser}</span>
                    </DialogDescription>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Total Revenue</p>
                  <p className="text-lg sm:text-xl font-extrabold text-emerald-500 tabular-nums">
                    {formatCurrency(selectedVisitor.totalRevenue || 0)}
                  </p>
                </div>
              </div>

              {/* 4 Quick Stat Metric Cards (Minilytics style) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-border/50 text-xs">
                <div className="rounded-xl border border-border/70 bg-card p-2.5">
                  <p className="text-[11px] text-muted-foreground font-medium">First Source</p>
                  <p className="font-semibold text-foreground truncate mt-0.5">{selectedVisitor.firstSource}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card p-2.5">
                  <p className="text-[11px] text-muted-foreground font-medium">Total Visits</p>
                  <p className="font-semibold text-foreground tabular-nums mt-0.5">{selectedVisitor.totalSessions} sessions</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card p-2.5">
                  <p className="text-[11px] text-muted-foreground font-medium">Total Events</p>
                  <p className="font-semibold text-foreground tabular-nums mt-0.5">{selectedVisitor.totalEvents} actions</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card p-2.5">
                  <p className="text-[11px] text-muted-foreground font-medium">Customer Since</p>
                  <p className="font-semibold text-foreground mt-0.5">
                    {new Date(selectedVisitor.firstSeenAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body: Multi-session Journey Timelines */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <div className="space-y-6">
                {selectedVisitor.sessions.map((session, sIdx) => {
                  return (
                    <div key={session.id} className="relative pl-6 border-l-2 border-border/80 space-y-3">
                      {/* Visit Milestone Pin */}
                      <div className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-card" />

                      {/* Session Header Details */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-bold text-foreground">
                          Visit #{selectedVisitor.sessions.length - sIdx} · {new Date(session.started_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-muted-foreground font-medium">
                          <Compass className="h-3 w-3" />
                          {session.source}
                        </span>
                        {session.utm_campaign && (
                          <span className="rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 font-mono text-[10px]">
                            campaign: {session.utm_campaign}
                          </span>
                        )}
                        <span className="text-muted-foreground ml-auto tabular-nums">
                          Duration: {formatDuration(session.duration)}
                        </span>
                      </div>

                      {/* Chronological Events under this visit */}
                      <div className="space-y-1.5 rounded-2xl border border-border/70 bg-muted/20 p-2.5">
                        {session.events.map((evt, eIdx) => {
                          const isConversion = evt.revenue || evt.name === "purchase";
                          const isGoal = evt.type === "event" && !isConversion;
                          const isIdentify = evt.name === "identify";

                          return (
                            <div key={eIdx} className="flex items-start gap-2.5 text-xs py-1 px-1 rounded-lg hover:bg-muted/40 transition-colors">
                              <span className="w-14 shrink-0 text-[11px] leading-5 text-muted-foreground tabular-nums">
                                {new Date(evt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>

                              {isConversion ? (
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="text-emerald-500 font-bold">💰 Paid {formatCurrency(evt.revenue || 49)}</span>
                                  <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                                    Purchase Confirmed
                                  </Badge>
                                </div>
                              ) : isIdentify ? (
                                <div className="flex items-center gap-2 flex-1 min-w-0 text-primary font-medium">
                                  <UserCheck className="h-3.5 w-3.5 shrink-0" />
                                  <span>User Identified via SDK: {evt.properties?.email || evt.properties?.user_id}</span>
                                </div>
                              ) : isGoal ? (
                                <div className="flex items-center gap-2 flex-1 min-w-0 text-foreground font-medium">
                                  <span className="text-violet-500">🎯</span>
                                  <span>Event: <code className="text-primary font-semibold">{evt.name}</code></span>
                                  {evt.path && <span className="text-muted-foreground text-[11px]">on {evt.path}</span>}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 flex-1 min-w-0 text-muted-foreground">
                                  <span>📄</span>
                                  <span className="text-foreground font-medium truncate">{evt.path || "/"}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Identified User Traits (if available) */}
              {Object.keys(selectedVisitor.traits || {}).length > 0 && (
                <div className="rounded-2xl border border-border bg-muted/30 p-4 text-xs">
                  <p className="font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    Identified Account Traits
                  </p>
                  <pre className="font-mono text-[11px] text-muted-foreground overflow-x-auto p-2 bg-card rounded-xl border border-border/60">
                    {JSON.stringify(selectedVisitor.traits, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
