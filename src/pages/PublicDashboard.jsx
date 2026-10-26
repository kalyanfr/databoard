import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Globe,
  Lock,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Users,
  Eye,
  Activity,
  Clock,
} from "lucide-react";
import { webrader } from "@/api/webraderClient";
import BrandMark from "@/components/layout/BrandMark";
import ThemeToggle from "@/components/layout/ThemeToggle";
import StatCard from "@/components/common/StatCard";
import SectionCard from "@/components/common/SectionCard";
import BreakdownTable from "@/components/analytics/BreakdownTable";
import TrendChart from "@/components/analytics/TrendChart";
import VisitorGlobe from "@/components/realtime/VisitorGlobe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getProjectShareSettings } from "@/lib/shareSettings";
import { formatNumber } from "@/lib/format";
import { groupRows, rowCount, rowAvg, bucketDay } from "@/lib/aggregate";
import { buildSeries, utcDay } from "@/lib/ranges";

const RANGES = {
  "24h": { label: "Last 24 hours", days: 1 },
  "7d": { label: "Last 7 days", days: 7 },
  "30d": { label: "Last 30 days", days: 30 },
};

export default function PublicDashboard() {
  const { shareId } = useParams();
  const [selectedRange, setSelectedRange] = useState("7d");
  const [showGlobe, setShowGlobe] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Load project sharing settings
  const shareSettings = useMemo(() => {
    return getProjectShareSettings(shareId);
  }, [shareId]);

  // Check password lock
  useEffect(() => {
    if (!shareSettings.hasPassword || !shareSettings.password) {
      setIsUnlocked(true);
    }
  }, [shareSettings]);

  // Load project by project_id or id
  const projectQuery = useQuery({
    queryKey: ["public-project", shareId],
    queryFn: async () => {
      try {
        const byKey = await webrader.entities.Project.filter({ project_id: shareId }, { limit: 1 });
        if (byKey.items?.[0]) return byKey.items[0];
      } catch (e) {
        console.warn("Failed lookup by key:", e);
      }
      try {
        const byId = await webrader.entities.Project.get(shareId);
        if (byId) return byId;
      } catch (e) {
        console.warn("Failed lookup by id:", e);
      }
      return null;
    },
  });

  const project = projectQuery.data;

  // Calculate Date Bounds
  const rangeConfig = useMemo(() => {
    const days = RANGES[selectedRange]?.days || 7;
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString(), label: RANGES[selectedRange]?.label || "Last 7 days" };
  }, [selectedRange]);

  // Fetch Analytics data
  const dataQuery = useQuery({
    queryKey: ["public-dashboard-data", project?.project_id, rangeConfig.from, rangeConfig.to],
    enabled: !!project?.project_id && isUnlocked,
    queryFn: async () => {
      const pKey = project.project_id;
      const eventQuery = { project_id: pKey, timestamp: { $gte: rangeConfig.from, $lt: rangeConfig.to } };
      const sessionQuery = { project_id: pKey, started_at: { $gte: rangeConfig.from, $lt: rangeConfig.to } };
      const visitorQuery = { project_id: pKey, date: { $gte: utcDay(rangeConfig.from), $lte: utcDay(rangeConfig.to) } };

      const [byType, sessionRows, visitorBuckets, visitorsCount, pagesRows, sourcesRows] = await Promise.all([
        webrader.entities.Event.aggregate({ query: eventQuery, groupBy: "type", sum: ["revenue"] }),
        webrader.entities.Session.aggregate({ query: sessionQuery, groupBy: "is_bounce", avg: ["duration_seconds"] }),
        webrader.entities.VisitorDay.aggregate({ query: visitorQuery, dateBucket: { field: "date", unit: "day" } }),
        webrader.entities.VisitorDay.count(visitorQuery),
        webrader.entities.Event.aggregate({
          query: { ...eventQuery, type: "pageview" },
          groupBy: "path",
          sort: "-count",
          limit: 10,
        }),
        webrader.entities.Session.aggregate({
          query: sessionQuery,
          groupBy: "referrer_domain",
          sort: "-count",
          limit: 10,
        }),
      ]);

      const typeRows = groupRows(byType);
      const bounceRows = groupRows(sessionRows);
      const sessions = bounceRows.reduce((acc, r) => acc + rowCount(r), 0);
      const bounces = bounceRows.filter((r) => r.is_bounce === true).reduce((acc, r) => acc + rowCount(r), 0);
      const duration = bounceRows.reduce(
        (acc, r) => {
          const avg = rowAvg(r, "duration_seconds");
          const count = rowCount(r);
          if (!avg || !count) return acc;
          return { total: acc.total + avg * count, count: acc.count + count };
        },
        { total: 0, count: 0 },
      );

      const visitorByDay = new Map(groupRows(visitorBuckets).map((r) => [bucketDay(r), rowCount(r)]));

      return {
        visitors: visitorsCount || 1,
        pageviews: rowCount(typeRows.find((r) => r.type === "pageview")) || 1,
        bounceRate: sessions ? Math.round((bounces / sessions) * 100) : 0,
        avgDuration: duration.count ? Math.round(duration.total / duration.count) : 0,
        series: buildSeries(
          [...visitorByDay.entries()].map(([date, visitors]) => ({ date, visitors })),
          rangeConfig.from,
          rangeConfig.to,
        ),
        pages: groupRows(pagesRows).map((r) => ({ label: r.path || "/", value: rowCount(r) })),
        sources: groupRows(sourcesRows).map((r) => ({
          label: r.referrer_domain || "Direct / Organic",
          value: rowCount(r),
        })),
      };
    },
    refetchInterval: 30000,
  });

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === shareSettings.password) {
      setIsUnlocked(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  if (projectQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="gloss-card max-w-md w-full rounded-3xl p-8 text-center space-y-4 border border-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted mx-auto text-muted-foreground">
            <Globe className="h-6 w-6" />
          </div>
          <h2 className="font-heading text-lg font-bold text-foreground">Dashboard Not Found</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This shared analytics dashboard does not exist or has been removed.
          </p>
          <Button asChild className="rounded-xl mt-2 w-full">
            <Link to="/">Create your own free analytics dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  // If owner turned off public access
  if (shareSettings.isPublic === false) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="gloss-card max-w-md w-full rounded-3xl p-8 text-center space-y-4 border border-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted mx-auto text-muted-foreground">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="font-heading text-lg font-bold text-foreground">Dashboard is Private</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The owner of this website has marked this dashboard as private.
          </p>
          <Button asChild className="rounded-xl mt-2 w-full">
            <Link to="/">Create your own free analytics dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Password Lock Screen
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="gloss-card max-w-sm w-full rounded-3xl p-8 text-center space-y-4 border border-border animate-fade-up">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mx-auto">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold text-foreground">Password Protected</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Enter the password provided by the owner to view live analytics.
            </p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <Input
              type="password"
              placeholder="Enter password..."
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setPasswordError(false);
              }}
              className={`rounded-xl text-center text-xs h-10 ${passwordError ? "border-destructive" : ""}`}
            />
            {passwordError && (
              <p className="text-[11px] text-destructive font-medium">Incorrect password. Please try again.</p>
            )}
            <Button type="submit" className="w-full rounded-xl text-xs font-semibold h-10">
              Unlock Dashboard
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const totals = dataQuery.data;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark className="h-7 w-7" />
            <span className="font-heading text-sm font-bold tracking-tight hidden sm:inline">Data Board</span>
          </Link>
          <span className="text-border">|</span>
          <div className="flex items-center gap-2">
            <span className="font-heading text-sm font-semibold text-foreground truncate max-w-[150px] sm:max-w-xs">
              {project?.name || "Website Analytics"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Stats
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Date Range Picker */}
          <Select value={selectedRange} onValueChange={setSelectedRange}>
            <SelectTrigger className="h-8 w-[130px] rounded-xl text-xs bg-muted/40 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RANGES).map(([id, item]) => (
                <SelectItem key={id} value={id} className="text-xs">
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 3D Globe Toggle */}
          {shareSettings.allowGlobe !== false && (
            <Button
              variant={showGlobe ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5 rounded-xl text-xs"
              onClick={() => setShowGlobe(!showGlobe)}
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{showGlobe ? "Hide Globe" : "3D Globe"}</span>
            </Button>
          )}

          <ThemeToggle />
        </div>
      </header>

      {/* Main Public Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Domain Hero Card */}
        <div className="gloss-card rounded-3xl p-6 border border-border/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-up">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Public Dashboard
            </span>
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground mt-0.5 flex items-center gap-2">
              <span>{project?.domain || "yourdomain.com"}</span>
              {project?.domain && (
                <a
                  href={`https://${project.domain.replace(/^https?:\/\//, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Live, privacy-first web telemetry without cookies or invasive profiling.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" asChild className="rounded-xl text-xs gap-1.5 font-semibold">
              <Link to="/register">
                Start Tracking Free <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* 3D Globe Telemetry (if toggled) */}
        {showGlobe && (
          <div className="gloss-card rounded-3xl p-5 border border-border/80 animate-fade-up h-[420px] overflow-hidden">
            <VisitorGlobe windowMinutes={30} />
          </div>
        )}

        {/* 4 StatCards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Unique Visitors"
            value={formatNumber(totals?.visitors || 0)}
            hint={rangeConfig.label}
            icon={Users}
            tone="violet"
            delay={0}
          />
          <StatCard
            label="Total Pageviews"
            value={formatNumber(totals?.pageviews || 0)}
            hint={rangeConfig.label}
            icon={Eye}
            tone="blue"
            delay={50}
          />
          <StatCard
            label="Bounce Rate"
            value={`${totals?.bounceRate || 0}%`}
            hint="Single-page sessions"
            icon={Activity}
            tone="teal"
            delay={100}
          />
          <StatCard
            label="Average Visit Time"
            value={`${totals?.avgDuration || 0}s`}
            hint="Time spent on site"
            icon={Clock}
            tone="amber"
            delay={150}
          />
        </div>

        {/* Visitors Trend Chart */}
        <SectionCard title="Visitor Trend" description={`Unique visitors per day · ${rangeConfig.label}`}>
          <TrendChart
            data={totals?.series || []}
            series={[{ id: "visitors", key: "visitors", label: "Visitors", color: "hsl(var(--chart-1))" }]}
          />
        </SectionCard>

        {/* Tables Grid: Top Pages & Top Sources */}
        <div className="grid gap-6 md:grid-cols-2">
          <SectionCard title="Top Pages" description="Most viewed pages in this period">
            <BreakdownTable
              rows={totals?.pages || []}
              metric="Pageviews"
              limit={8}
              title="Top Pages"
              showExport={true}
            />
          </SectionCard>

          <SectionCard title="Traffic Sources" description="Where visitors arrived from">
            <BreakdownTable
              rows={totals?.sources || []}
              metric="Sessions"
              limit={8}
              title="Traffic Sources"
              showExport={true}
            />
          </SectionCard>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/80 bg-background/60 py-6 px-4 text-center text-xs text-muted-foreground space-y-2">
        <p className="flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>100% Privacy-Friendly · No Personal Data Collected · GDPR & CCPA Compliant</span>
        </p>
        <p>
          Powered by{" "}
          <Link to="/" className="font-semibold text-foreground hover:underline">
            Data Board
          </Link>
        </p>
      </footer>
    </div>
  );
}
