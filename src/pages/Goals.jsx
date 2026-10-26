import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Target,
  Plus,
  Trash2,
  TrendingUp,
  Compass,
  DollarSign,
  Users,
  Copy,
  Check,
  Activity,
  Download,
} from "lucide-react";
import { downloadCsv } from "@/lib/exportCsv";
import { webrader } from "@/api/webraderClient";
import EmptyState from "@/components/common/EmptyState";
import { ErrorState, LoadingBlock } from "@/components/common/LoadingBlock";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import StatCard from "@/components/common/StatCard";
import FiltersBar from "@/components/analytics/FiltersBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatNumber, relativeTime } from "@/lib/format";
import { countryMeta, flagEmoji, normalizeCountryCode } from "@/lib/geo";
import { useActiveProject, useRange } from "@/lib/filters";
import { cn } from "@/lib/utils";

const DEFAULT_GOALS = [
  {
    id: "user-signup",
    name: "User Signups & Registration",
    description: "Tracks visitors who successfully create an account or register.",
    type: "event",
    match: "signup",
    target: 5.0,
    estimatedValue: 25,
  },
  {
    id: "completed-purchase",
    name: "Purchases & Checkout Revenue",
    description: "Measures completed transactions, paid subscriptions, or upgrades.",
    type: "event",
    match: "purchase",
    target: 2.5,
    estimatedValue: 49,
  },
  {
    id: "pricing-page-views",
    name: "Pricing Page Discovery",
    description: "Tracks high-intent visitors exploring subscription tiers and features.",
    type: "pageview",
    match: "/pricing",
    target: 15.0,
    estimatedValue: 0,
  },
  {
    id: "contact-form-submissions",
    name: "Lead Inquiries & Demo Requests",
    description: "Captures visitors submitting a contact form, demo request, or inquiry.",
    type: "event",
    match: "form_submit",
    target: 3.5,
    estimatedValue: 50,
  },
];

export default function Goals() {
  const { project, isLoading: isProjectLoading } = useActiveProject();
  const range = useRange();

  // Storage key per active project
  const storageKey = `lume.goals.${project?.id || "global"}`;
  const [customGoals, setCustomGoals] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Re-read stored goals whenever project changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setCustomGoals(JSON.parse(stored));
      } else {
        setCustomGoals([]);
      }
    } catch {
      setCustomGoals([]);
    }
  }, [storageKey]);

  const allGoals = useMemo(() => [...DEFAULT_GOALS, ...customGoals], [customGoals]);
  const [selectedGoalId, setSelectedGoalId] = useState(DEFAULT_GOALS[0].id);

  // Maintain selected goal valid reference
  const activeGoal = useMemo(() => {
    return allGoals.find((g) => g.id === selectedGoalId) || allGoals[0];
  }, [allGoals, selectedGoalId]);

  // Compute previous time period for trend comparison
  const { from: prevFrom, to: prevTo } = useMemo(() => {
    const start = new Date(range.from).getTime();
    const end = new Date(range.to).getTime();
    const duration = Math.max(86400000, end - start);
    return {
      from: new Date(start - duration).toISOString(),
      to: range.from,
    };
  }, [range.from, range.to]);

  // Fetch events for current and previous period
  const {
    data: eventData = { current: [], previous: [] },
    isLoading: isEventsLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["goals-events", project?.id, project?.project_id, range.from, range.to],
    enabled: !!project,
    queryFn: async () => {
      const cleanDomain = project?.domain
        ? String(project.domain).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "")
        : null;
      const projectIds = [project?.project_id, project?.id, cleanDomain].filter(Boolean);
      const queryFilter = projectIds.length > 1 ? { $in: [...new Set(projectIds)] } : (project?.project_id || project?.id);

      const [currentRes, prevRes] = await Promise.all([
        webrader.entities.Event.filter(
          { project_id: queryFilter, timestamp: { $gte: range.from, $lt: range.to } },
          { limit: 5000, sort: "-timestamp" }
        ),
        webrader.entities.Event.filter(
          { project_id: queryFilter, timestamp: { $gte: prevFrom, $lt: prevTo } },
          { limit: 5000, fields: ["type", "name", "path", "session_id", "visitor_id", "revenue"] }
        ),
      ]);

      return {
        current: currentRes.items || [],
        previous: prevRes.items || [],
      };
    },
    staleTime: 30000,
  });

  const currentEvents = eventData.current;
  const previousEvents = eventData.previous;

  // Auto-detect existing custom event names in the project history for easy suggestion
  const detectedEventNames = useMemo(() => {
    const names = new Set();
    currentEvents.forEach((e) => {
      if (e.type === "event" && e.name) names.add(e.name);
    });
    return Array.from(names);
  }, [currentEvents]);

  // Total unique visitors across all events in period
  const totalProjectVisitors = useMemo(() => {
    return new Set(currentEvents.map((e) => e.visitor_id || e.session_id || e.id).filter(Boolean)).size;
  }, [currentEvents]);

  // Helper to match an event to a goal rule
  const matchEvent = (e, goal) => {
    if (!goal) return false;
    if (goal.type === "event") {
      return e.type === "event" && String(e.name).trim().toLowerCase() === String(goal.match).trim().toLowerCase();
    }
    // Pageview match
    if (e.type !== "pageview" && e.path === undefined) return false;
    const path = String(e.path || "/").toLowerCase();
    const target = String(goal.match || "/").toLowerCase();
    if (target === "/") return path === "/" || path === "";
    return path === target || path.startsWith(target.endsWith("/") ? target : target + "/");
  };

  // Compute stats for all goals
  const goalStats = useMemo(() => {
    return allGoals.map((goal) => {
      const currentMatching = currentEvents.filter((e) => matchEvent(e, goal));
      const previousMatching = previousEvents.filter((e) => matchEvent(e, goal));

      const conversions = currentMatching.length;
      const prevConversions = previousMatching.length;

      const uniqueVisitors = new Set(
        currentMatching.map((e) => e.visitor_id || e.session_id || e.id).filter(Boolean)
      ).size;

      const conversionRate = totalProjectVisitors > 0
        ? Number(((uniqueVisitors / totalProjectVisitors) * 100).toFixed(1))
        : 0;

      // Revenue: sum of explicitly recorded event.revenue, or fall back to estimatedValue * conversions
      const actualRevenue = currentMatching.reduce((acc, e) => acc + (Number(e.revenue) || 0), 0);
      const totalRevenue = actualRevenue > 0
        ? actualRevenue
        : (Number(goal.estimatedValue) || 0) * conversions;

      const target = Number(goal.target) || 5.0;
      const progressPercent = Math.min(100, Number(((conversionRate / target) * 100).toFixed(0)));

      // Trend vs previous period
      let trendPct = 0;
      if (prevConversions > 0) {
        trendPct = Math.round(((conversions - prevConversions) / prevConversions) * 100);
      } else if (conversions > 0) {
        trendPct = 100;
      }

      return {
        ...goal,
        conversions,
        prevConversions,
        uniqueVisitors,
        conversionRate,
        totalRevenue,
        target,
        progressPercent,
        trendPct,
        matchingEvents: currentMatching,
      };
    });
  }, [allGoals, currentEvents, previousEvents, totalProjectVisitors]);

  // Aggregate high-level totals
  const totalConversions = useMemo(
    () => goalStats.reduce((sum, g) => sum + g.conversions, 0),
    [goalStats]
  );

  const totalRevenueAll = useMemo(
    () => goalStats.reduce((sum, g) => sum + g.totalRevenue, 0),
    [goalStats]
  );

  const activeGoalStat = useMemo(() => {
    return goalStats.find((g) => g.id === activeGoal?.id) || goalStats[0];
  }, [goalStats, activeGoal]);

  // Breakdown of active goal: Top Referrers, UTM Campaigns, Countries & Recent Activity
  const activeBreakdown = useMemo(() => {
    if (!activeGoalStat) return { referrers: [], campaigns: [], countries: [], recent: [] };
    const hits = activeGoalStat.matchingEvents || [];

    // Referrers / Channels
    const refMap = new Map();
    hits.forEach((e) => {
      const channel = e.channel || e.referrer_domain || (e.referrer ? new URL(e.referrer, "http://localhost").hostname : null) || "Direct / Organic";
      refMap.set(channel, (refMap.get(channel) || 0) + 1);
    });
    const referrers = Array.from(refMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        percent: hits.length > 0 ? ((count / hits.length) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // UTM Campaigns
    const campMap = new Map();
    hits.forEach((e) => {
      const camp = e.utm_campaign || (e.utm_source ? `${e.utm_source} (auto)` : null);
      if (camp) {
        campMap.set(camp, (campMap.get(camp) || 0) + 1);
      }
    });
    const campaigns = Array.from(campMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        percent: hits.length > 0 ? ((count / hits.length) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Countries
    const countryMap = new Map();
    hits.forEach((e) => {
      const code = normalizeCountryCode(e.country);
      if (code && code !== "UNKNOWN") {
        countryMap.set(code, (countryMap.get(code) || 0) + 1);
      }
    });
    const countries = Array.from(countryMap.entries())
      .map(([code, count]) => {
        const meta = countryMeta(code);
        return {
          code,
          name: meta ? meta.name : code,
          flag: flagEmoji(code),
          count,
          percent: hits.length > 0 ? ((count / hits.length) * 100).toFixed(1) : 0,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Recent 12 conversions
    const recent = hits.slice(0, 12).map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      path: e.path || (e.type === "event" ? `event:${e.name}` : "/"),
      country: normalizeCountryCode(e.country),
      revenue: Number(e.revenue) || (Number(activeGoalStat.estimatedValue) || 0),
      session: String(e.session_id || e.visitor_id || e.id || "").slice(0, 8),
    }));

    return { referrers, campaigns, countries, recent };
  }, [activeGoalStat]);

  // Dialog state for creating a new goal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalType, setGoalType] = useState("event");
  const [goalMatch, setGoalMatch] = useState("");
  const [goalTarget, setGoalTarget] = useState("5.0");
  const [goalValue, setGoalValue] = useState("0");
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCreateGoal = (e) => {
    e.preventDefault();
    if (!goalName.trim() || !goalMatch.trim()) return;

    const newGoal = {
      id: `custom-goal-${Date.now()}`,
      name: goalName.trim(),
      description:
        goalType === "event"
          ? `Custom event goal matching data-goal="${goalMatch.trim()}" or analytics.goal("${goalMatch.trim()}")`
          : `Destination pageview goal matching "${goalMatch.trim()}"`,
      type: goalType,
      match: goalMatch.trim(),
      target: parseFloat(goalTarget) || 5.0,
      estimatedValue: parseFloat(goalValue) || 0,
      isCustom: true,
    };

    const updated = [...customGoals, newGoal];
    setCustomGoals(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}

    setSelectedGoalId(newGoal.id);
    setIsCreateOpen(false);
    setGoalName("");
    setGoalMatch("");
    setGoalTarget("5.0");
    setGoalValue("0");
  };

  const handleDeleteGoal = (id) => {
    const updated = customGoals.filter((g) => g.id !== id);
    setCustomGoals(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
    if (selectedGoalId === id) {
      setSelectedGoalId(DEFAULT_GOALS[0].id);
    }
  };

  const copySnippet = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleExportGoalsCsv = () => {
    if (!goalStats || goalStats.length === 0) return;
    const headers = ["Goal Name", "Type", "Matching Event/URL", "Conversions", "Unique Visitors", "Conversion Rate (%)", "Target (%)", "Total Revenue ($)"];
    const rows = goalStats.map((g) => [
      g.name,
      g.type,
      g.match,
      g.conversions,
      g.uniqueVisitors,
      g.conversionRate,
      g.target,
      g.totalRevenue,
    ]);
    const dateStr = new Date().toISOString().split("T")[0];
    downloadCsv(`conversion-goals-${dateStr}.csv`, headers, rows);
  };

  if (isProjectLoading) return <LoadingBlock rows={3} />;

  if (!project) {
    return (
      <EmptyState
        icon={Target}
        title="No project selected"
        description="Choose or create a project to start measuring conversion goals."
      />
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* PAGE HEADER & TIME RANGE FILTER */}
      <PageHeader
        title="Conversion Goals"
        description="Define and measure signup completions, key actions, lead submissions, and revenue generation."
        action={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="sheen gap-1.5 rounded-xl shadow-glow text-xs sm:text-sm h-9">
                <Plus className="h-4 w-4" />
                <span className="hidden xs:inline">Create Goal</span>
                <span className="xs:hidden">Goal</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <form onSubmit={handleCreateGoal}>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    <span>Create Conversion Goal</span>
                  </DialogTitle>
                  <DialogDescription>
                    Track critical user conversions, checkout flows, or high-value page discovery.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="goal-name">Goal Name</Label>
                    <Input
                      id="goal-name"
                      placeholder="e.g. Free Trial Signup"
                      value={goalName}
                      onChange={(e) => setGoalName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="goal-type">Goal Trigger Type</Label>
                    <Select value={goalType} onValueChange={setGoalType}>
                      <SelectTrigger id="goal-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="event">Custom Goal Event (e.g. data-goal="signup" or analytics.goal)</SelectItem>
                        <SelectItem value="pageview">Pageview / URL Destination</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="goal-match">
                      {goalType === "event" ? "Event Name to Match" : "Destination Page Path"}
                    </Label>
                    <Input
                      id="goal-match"
                      placeholder={goalType === "event" ? "e.g. signup, purchase, demo_request" : "e.g. /welcome, /thank-you, /pricing"}
                      value={goalMatch}
                      onChange={(e) => setGoalMatch(e.target.value)}
                      required
                    />
                    {goalType === "event" && detectedEventNames.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-muted-foreground">Detected in your site:</span>
                        {detectedEventNames.slice(0, 5).map((ev) => (
                          <button
                            key={ev}
                            type="button"
                            onClick={() => setGoalMatch(ev)}
                            className="inline-flex items-center rounded-lg border border-border/70 bg-muted/40 px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted hover:border-primary/40 transition-colors"
                          >
                            {ev}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="goal-target">Target Conv. Rate (%)</Label>
                      <Input
                        id="goal-target"
                        type="number"
                        step="0.1"
                        min="0.1"
                        placeholder="5.0"
                        value={goalTarget}
                        onChange={(e) => setGoalTarget(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="goal-value">Estimated Value ($)</Label>
                      <Input
                        id="goal-value"
                        type="number"
                        step="1"
                        min="0"
                        placeholder="25"
                        value={goalValue}
                        onChange={(e) => setGoalValue(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="rounded-xl">
                    Save Goal
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      >
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <FiltersBar onRefresh={refetch} refreshing={isEventsLoading} />

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl text-xs h-9 shrink-0"
            onClick={handleExportGoalsCsv}
            disabled={goalStats.length === 0}
            title="Export goals report as CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </PageHeader>

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}

      {/* TOP KPI STATS SUMMARY */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Conversions"
          value={formatNumber(totalConversions)}
          hint={`${goalStats.length} active goals`}
          icon={Target}
          tone="violet"
          delay={0}
        />
        <StatCard
          label="Converting Visitors"
          value={formatNumber(activeGoalStat?.uniqueVisitors || 0)}
          hint={`For ${activeGoalStat?.name || "selected"}`}
          icon={Users}
          tone="teal"
          delay={70}
        />
        <StatCard
          label="Top Conv. Rate"
          value={`${activeGoalStat?.conversionRate || 0}%`}
          hint={`Target: ${activeGoalStat?.target || 5}%`}
          icon={TrendingUp}
          tone="amber"
          delay={140}
        />
        <StatCard
          label="Goal Value / Revenue"
          value={formatCurrency(totalRevenueAll)}
          hint="Attributed business value"
          icon={DollarSign}
          tone="blue"
          delay={210}
        />
      </div>

      {/* GOALS PERFORMANCE MATRIX & SELECTOR */}
      <SectionCard
        title="Conversion Goals"
        description="Select a goal to inspect its acquisition sources, campaigns, and audience demographics."
      >
        <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {goalStats.map((goal) => {
            const isSelected = activeGoal?.id === goal.id;
            return (
              <div
                key={goal.id}
                onClick={() => setSelectedGoalId(goal.id)}
                className={cn(
                  "group relative flex flex-col justify-between rounded-2xl border p-4 cursor-pointer transition-all duration-200",
                  isSelected
                    ? "border-primary bg-primary/[0.04] shadow-md ring-1 ring-primary/40"
                    : "border-border bg-card/70 hover:border-border/90 hover:bg-muted/40"
                )}
              >
                <div>
                  {/* Goal Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs font-semibold",
                          goal.type === "event"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-chart-2/30 bg-chart-2/10 text-chart-2"
                        )}
                      >
                        {goal.type === "event" ? <Activity className="h-4 w-4" /> : <Compass className="h-4 w-4" />}
                      </span>
                      <Badge
                        variant="outline"
                        className="rounded-md px-1.5 py-0 text-[10px] uppercase font-medium tracking-wider"
                      >
                        {goal.type === "event" ? "Event" : "Pageview"}
                      </Badge>
                    </div>

                    {goal.isCustom && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGoal(goal.id);
                        }}
                        title="Delete custom goal"
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Goal Name & Target Rule */}
                  <h3 className="mt-3 font-heading text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {goal.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground truncate" title={goal.match}>
                    {goal.type === "event" ? `event: ${goal.match}` : `path: ${goal.match}`}
                  </p>
                </div>

                {/* Conversion Numbers & Progress Bar */}
                <div className="mt-4 pt-3 border-t border-border/60 space-y-2">
                  <div className="flex items-baseline justify-between text-xs">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-bold tabular-nums text-foreground">
                        {formatNumber(goal.conversions)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">conv.</span>
                    </div>
                    <span
                      className={cn(
                        "font-semibold tabular-nums text-xs",
                        goal.conversionRate >= goal.target ? "text-emerald-500 font-bold" : "text-foreground"
                      )}
                    >
                      {goal.conversionRate}%
                    </span>
                  </div>

                  {/* Progress bar towards target */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        goal.conversionRate >= goal.target
                          ? "bg-emerald-500"
                          : "bg-gradient-to-r from-primary/60 to-primary"
                      )}
                      style={{ width: `${Math.max(4, Math.min(100, goal.progressPercent))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Target: {goal.target}%</span>
                    {goal.totalRevenue > 0 && (
                      <span className="font-semibold text-foreground">
                        {formatCurrency(goal.totalRevenue)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* SELECTED GOAL DEEP-DIVE INSPECTOR */}
      {activeGoalStat && (
        <div className="space-y-6 animate-fade-up">
          {/* Active Goal Telemetry Banner */}
          <div className="gloss-card relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-border p-4 sm:p-5 bg-card shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
                <Target className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-heading text-base sm:text-lg font-bold text-foreground truncate">
                    {activeGoalStat.name}
                  </h2>
                  <Badge variant="outline" className="rounded-lg text-[10px] font-medium">
                    {activeGoalStat.type === "event" ? `event: ${activeGoalStat.match}` : `url: ${activeGoalStat.match}`}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {activeGoalStat.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Attributed Value</p>
                <p className="font-heading text-base sm:text-lg font-bold text-foreground tabular-nums">
                  {formatCurrency(activeGoalStat.totalRevenue)}
                </p>
              </div>
              <div className="h-8 w-px bg-border/70" />
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Conversion Rate</p>
                <p className="font-heading text-base sm:text-lg font-bold text-primary tabular-nums">
                  {activeGoalStat.conversionRate}%
                </p>
              </div>
            </div>
          </div>

          {/* 3-Column Goal Acquisition & Geography Breakdown */}
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-3">
            {/* 1. Top Referrers / Channels */}
            <SectionCard title="Top Acquisition Sources" description="Channels driving this specific goal.">
              {activeBreakdown.referrers.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">No conversion source data yet.</p>
              ) : (
                <div className="space-y-3">
                  {activeBreakdown.referrers.map((ref) => (
                    <div key={ref.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground truncate max-w-[180px]">{ref.name}</span>
                        <span className="tabular-nums font-semibold text-muted-foreground">{ref.count} ({ref.percent}%)</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${ref.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* 2. Top Converting Countries */}
            <SectionCard title="Converting Countries" description="Where converting users are located.">
              {activeBreakdown.countries.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">No geographic conversion data yet.</p>
              ) : (
                <div className="space-y-3">
                  {activeBreakdown.countries.map((c) => (
                    <div key={c.code} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          <span className="text-sm">{c.flag}</span>
                          <span className="truncate max-w-[160px]">{c.name}</span>
                        </span>
                        <span className="tabular-nums font-semibold text-muted-foreground">{c.count} ({c.percent}%)</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-chart-2"
                          style={{ width: `${c.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* 3. Implementation / Trigger Snippet */}
            <SectionCard title="Tracking Code" description="How to trigger this conversion from your site.">
              <div className="space-y-4">
                {activeGoalStat.type === "event" ? (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                          <span className="rounded bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.2 text-[9px] font-bold">
                            RECOMMENDED
                          </span>
                          <span>Declarative HTML Goal (No JavaScript Needed)</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground">Webflow · Framer · Shopify · HTML</span>
                      </div>
                      <div className="relative rounded-xl border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground">
                        <pre className="overflow-x-auto">
                          {`<button data-goal="${activeGoalStat.match}"${activeGoalStat.estimatedValue ? ` data-revenue="${activeGoalStat.estimatedValue}"` : ""}>\n  ${activeGoalStat.name || "Complete Action"}\n</button>`}
                        </pre>
                        <button
                          type="button"
                          onClick={() =>
                            copySnippet(
                              `<button data-goal="${activeGoalStat.match}"${activeGoalStat.estimatedValue ? ` data-revenue="${activeGoalStat.estimatedValue}"` : ""}>\n  ${activeGoalStat.name || "Complete Action"}\n</button>`
                            )
                          }
                          className="absolute top-2 right-2 p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition"
                          title="Copy HTML goal snippet"
                        >
                          {copiedCode ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-foreground">JavaScript SDK (<code>analytics.goal</code>)</p>
                        <span className="text-[10px] text-muted-foreground">React · Vue · Node · Next.js</span>
                      </div>
                      <div className="relative rounded-xl border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground">
                        <pre className="overflow-x-auto">
                          {`analytics.goal("${activeGoalStat.match}"${activeGoalStat.estimatedValue ? `, { revenue: ${activeGoalStat.estimatedValue} }` : ""});`}
                        </pre>
                        <button
                          type="button"
                          onClick={() =>
                            copySnippet(
                              `analytics.goal("${activeGoalStat.match}"${activeGoalStat.estimatedValue ? `, { revenue: ${activeGoalStat.estimatedValue} }` : ""});`
                            )
                          }
                          className="absolute top-2 right-2 p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition"
                          title="Copy JavaScript SDK snippet"
                        >
                          {copiedCode ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      This goal tracks automatically whenever a visitor navigates to:
                    </p>
                    <div className="relative rounded-xl border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground">
                      <pre className="overflow-x-auto">
                        {`URL path matches: ${activeGoalStat.match}`}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          {/* Recent Conversions Live Stream */}
          <SectionCard
            title="Recent Goal Conversions"
            description="Live stream of recent hits successfully completing this conversion goal."
          >
            {activeBreakdown.recent.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">
                No recent conversions recorded for this goal in the selected date range.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/70 text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Visitor Session</th>
                      <th className="py-2.5 px-3">Location</th>
                      <th className="py-2.5 px-3">Path / Event</th>
                      <th className="py-2.5 px-3 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {activeBreakdown.recent.map((hit) => {
                      const flag = flagEmoji(hit.country);
                      return (
                        <tr key={hit.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                            {relativeTime(hit.timestamp)}
                          </td>
                          <td className="py-2.5 px-3 text-xs font-medium text-foreground">
                            {hit.session}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <span>{flag}</span>
                              <span className="text-foreground">{hit.country || "Global"}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground truncate max-w-[220px]">
                            {hit.path}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-foreground">
                            {hit.revenue > 0 ? (
                              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                +{formatCurrency(hit.revenue)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
