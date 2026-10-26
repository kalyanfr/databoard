import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Sparkles,
  Cpu,
  FileText,
  Search,
  ShieldCheck,
  Copy,
  Check,
  RefreshCw,
  Globe,
  Terminal,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/api/webraderClient";
import SectionCard from "@/components/common/SectionCard";
import StatCard from "@/components/common/StatCard";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { flagEmoji } from "@/lib/geo";
import { formatNumber, relativeTime } from "@/lib/format";
import { useActiveProject, useRange } from "@/lib/filters";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

const VENDOR_COLORS = {
  "OpenAI": "#10A37F",
  "Perplexity AI": "#20808D",
  "Anthropic": "#CC785C",
  "Google AI": "#4285F4",
  "Meta": "#0668E1",
  "Apple": "#8E8E93",
  "ByteDance": "#00F2FE",
  "Cohere": "#39594C",
  "Mistral": "#FF7000",
  "Common Crawl": "#E67E22",
  "Amazon": "#FF9900",
  "Other": "#A1A1AA",
};

export default function AiCrawlersTab() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.email?.toLowerCase() === "gurukalyanreddyd@gmail.com";
  const { project, isLoading: isProjectLoading, error: projectError } = useActiveProject();
  const range = useRange();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [purposeFilter, setPurposeFilter] = useState("all");
  const [copiedRobots, setCopiedRobots] = useState(false);
  const [copiedPixel, setCopiedPixel] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [robotsPreset, setRobotsPreset] = useState("citations"); // 'citations' | 'allow_all' | 'block_training'
  const [robotsModalOpen, setRobotsModalOpen] = useState(false);

  // Query events table for ai_crawler type hits
  const {
    data: rawEvents = [],
    isLoading: isEventsLoading,
    refetch,
  } = useQuery({
    queryKey: ["ai-crawler-events", project?.id, project?.project_id, range.from, range.to],
    enabled: !!project,
    queryFn: async () => {
      const cleanDomain = project?.domain
        ? String(project.domain).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "")
        : null;
      const projectIds = [project?.project_id, project?.id, cleanDomain].filter(Boolean);

      try {
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .in("project_id", projectIds)
          .or("name.eq.ai_crawler,type.eq.ai_crawler,channel.eq.AI Search / GEO")
          .order("timestamp", { ascending: false })
          .limit(2000);

        if (error) {
          console.warn("[AI Crawler query error]:", error.message);
          return [];
        }
        return data || [];
      } catch (err) {
        console.warn("[AI Crawler query failed]:", err);
        return [];
      }
    },
    staleTime: 15000,
  });

  const displayEvents = rawEvents;

  // Filter events by search query, vendor, and purpose
  const filteredEvents = useMemo(() => {
    return displayEvents.filter((item) => {
      const props = item.properties || {};
      const vendor = props.vendor || "Other";
      const purpose = props.purpose || "Other";
      const name = item.name || props.bot_name || "Bot";
      const path = item.path || "/";

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        path.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        vendor.toLowerCase().includes(q);

      const matchesVendor =
        vendorFilter === "all" || vendor.toLowerCase().includes(vendorFilter.toLowerCase());

      const matchesPurpose =
        purposeFilter === "all" ||
        (purposeFilter === "citations" && purpose.toLowerCase().includes("citation")) ||
        (purposeFilter === "training" && purpose.toLowerCase().includes("training"));

      return matchesSearch && matchesVendor && matchesPurpose;
    });
  }, [displayEvents, searchQuery, vendorFilter, purposeFilter]);

  // Aggregate high-level stats
  const stats = useMemo(() => {
    const total = displayEvents.length;
    const uniqueBots = new Set(displayEvents.map((e) => e.name || e.properties?.bot_name).filter(Boolean)).size;

    const citationCount = displayEvents.filter((e) =>
      String(e.properties?.purpose || "").toLowerCase().includes("citation")
    ).length;

    const citationPct = total > 0 ? Math.round((citationCount / total) * 100) : 0;

    // Vendor counts
    const vendorMap = {};
    for (const e of displayEvents) {
      const v = e.properties?.vendor || "Other";
      vendorMap[v] = (vendorMap[v] || 0) + 1;
    }
    const topVendor = Object.entries(vendorMap).sort((a, b) => b[1] - a[1])[0] || ["None", 0];

    // Page counts
    const pageMap = {};
    for (const e of displayEvents) {
      const p = e.path || "/";
      pageMap[p] = (pageMap[p] || 0) + 1;
    }
    const topPage = Object.entries(pageMap).sort((a, b) => b[1] - a[1])[0] || [null, 0];

    return {
      total,
      uniqueBots: uniqueBots || (total > 0 ? 1 : 0),
      citationCount,
      citationPct,
      topVendorName: topVendor[0],
      topVendorCount: topVendor[1],
      topPagePath: topPage[0] || (total > 0 ? "/" : "None"),
      topPageCount: topPage[1] || 0,
    };
  }, [displayEvents]);

  // Page rankings data
  const pageRankings = useMemo(() => {
    const map = new Map();

    for (const e of filteredEvents) {
      const p = e.path || "/";
      const bot = e.properties?.bot_name || e.name || "AI Crawler";
      const vendor = e.properties?.vendor || "Other";
      const isCitation = String(e.properties?.purpose || "").toLowerCase().includes("citation");

      if (!map.has(p)) {
        map.set(p, {
          path: p,
          count: 1,
          citationCount: isCitation ? 1 : 0,
          trainingCount: isCitation ? 0 : 1,
          botsMap: { [bot]: 1 },
          lastVisited: e.timestamp,
          primaryVendor: vendor,
        });
      } else {
        const item = map.get(p);
        item.count += 1;
        if (isCitation) item.citationCount += 1;
        else item.trainingCount += 1;
        item.botsMap[bot] = (item.botsMap[bot] || 0) + 1;
        if (new Date(e.timestamp) > new Date(item.lastVisited)) {
          item.lastVisited = e.timestamp;
          item.primaryVendor = vendor;
        }
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 50)
      .map((item) => {
        const topBot = Object.entries(item.botsMap).sort((a, b) => b[1] - a[1])[0][0];
        return {
          ...item,
          topBot,
        };
      });
  }, [filteredEvents]);

  // Vendor distribution data for visual progress bars
  const vendorBreakdown = useMemo(() => {
    const map = {};
    for (const e of displayEvents) {
      const v = e.properties?.vendor || "Other";
      map[v] = (map[v] || 0) + 1;
    }
    const total = displayEvents.length || 1;
    return Object.entries(map)
      .map(([vendor, count]) => ({
        vendor,
        count,
        pct: Math.round((count / total) * 100),
        color: VENDOR_COLORS[vendor] || VENDOR_COLORS["Other"],
      }))
      .sort((a, b) => b.count - a.count);
  }, [displayEvents]);

  // Daily Crawl Trend for chart
  const timelineData = useMemo(() => {
    const dateMap = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(5, 10);
      dateMap[d] = { date: d, crawls: 0, citations: 0, training: 0 };
    }

    for (const e of displayEvents) {
      const d = (e.timestamp || "").slice(5, 10);
      if (dateMap[d]) {
        dateMap[d].crawls += 1;
        const isCitation = String(e.properties?.purpose || "").toLowerCase().includes("citation");
        if (isCitation) dateMap[d].citations += 1;
        else dateMap[d].training += 1;
      }
    }

    return Object.values(dateMap);
  }, [displayEvents]);

  // Action: Simulate a live AI crawler hit
  const handleSimulateAiHit = async (selectedBot = "perplexity") => {
    if (!project) return;
    setIsSimulating(true);

    const bots = {
      perplexity: {
        name: "PerplexityBot",
        ua: "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
        path: "/pricing",
      },
      chatgpt: {
        name: "ChatGPT Search",
        ua: "Mozilla/5.0 AppleWebKit/537.36 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)",
        path: "/docs/quickstart",
      },
      claude: {
        name: "ClaudeBot",
        ua: "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
        path: "/",
      },
    };

    const choice = bots[selectedBot] || bots.perplexity;

    try {
      const pid = project.project_id || project.id;
      const res = await fetch("/api/track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-simulated-ua": choice.ua,
        },
        body: JSON.stringify({
          pid,
          events: [
            {
              t: "pageview",
              p: choice.path,
              u: `https://${project?.domain || "yourdomain.com"}${choice.path}`,
            },
          ],
        }),
      });

      if (!res.ok) {
        await supabase.from("events").insert({
          project_id: pid,
          type: "event",
          name: "ai_crawler",
          path: choice.path,
          channel: "AI Search / GEO",
          timestamp: new Date().toISOString(),
          country: "US",
          visitor_id: "bot_" + Math.random().toString(36).slice(2, 9),
          session_id: "bot_sess_" + Math.random().toString(36).slice(2, 9),
          properties: {
            is_ai: true,
            vendor: selectedBot === "claude" ? "Anthropic" : selectedBot === "chatgpt" ? "OpenAI" : "Perplexity AI",
            purpose: selectedBot === "claude" ? "Model Training & Citations" : "Live Search Citations",
            bot_name: choice.name,
            user_agent: choice.ua,
          },
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["ai-crawler-events"] });
      refetch();
    } catch (err) {
      console.error("[Simulate AI hit error]:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Generate robots.txt content based on selected preset
  const robotsTxtContent = useMemo(() => {
    if (robotsPreset === "citations") {
      return `# ==============================================================
# GEO (Generative Engine Optimization) - Max Citations & Traffic
# Allows Perplexity & ChatGPT Search to cite and drive traffic to you,
# while restricting mass foundation model training scrapers.
# ==============================================================

# 1. Allow Real-time AI Search Engines (Drives live users to your site)
User-agent: PerplexityBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: Meta-ExternalAgent
Allow: /

# 2. Block Bulk AI Model Training Scrapers (Protects proprietary content)
User-agent: GPTBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

# 3. Standard Search Engines
User-agent: *
Allow: /
Sitemap: https://${project?.domain || "yourdomain.com"}/sitemap.xml`;
    }

    if (robotsPreset === "allow_all") {
      return `# ==============================================================
# Open Access - Allow All AI Search & Training Bots
# ==============================================================
User-agent: *
Allow: /
Sitemap: https://${project?.domain || "yourdomain.com"}/sitemap.xml`;
    }

    return `# ==============================================================
# Strict Privacy - Block All AI Crawlers & LLM Scrapers
# ==============================================================
User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: Meta-ExternalAgent
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: *
Allow: /`;
  }, [robotsPreset, project]);

  const copyRobots = () => {
    navigator.clipboard.writeText(robotsTxtContent);
    setCopiedRobots(true);
    setTimeout(() => setCopiedRobots(false), 2000);
  };

  const copyPixel = () => {
    const pid = project?.project_id || project?.id || "YOUR_PROJECT_ID";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const snippet = `<!-- Zero-JS AI Crawler Tracking Pixel (Embed in HTML <head> or footer) -->\n<img src="${origin}/api/track?pid=${pid}&p=/" width="1" height="1" alt="" style="display:none;" />`;
    navigator.clipboard.writeText(snippet);
    setCopiedPixel(true);
    setTimeout(() => setCopiedPixel(false), 2000);
  };

  if (isProjectLoading) return <LoadingBlock rows={4} />;
  if (projectError) return <ErrorState error={projectError} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-primary/20 bg-primary/5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <span>Generative Engine Optimization (GEO) & AI Bot Indexing</span>
              <span className="rounded bg-primary/15 text-primary border border-primary/30 px-1.5 py-0.2 text-[9px] font-bold">
                ACTIVE
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Monitor when ChatGPT, Perplexity, Claude & Gemini crawl your pages to recommend you in live AI prompts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRobotsModalOpen(true)}
            className="sheen gap-2 rounded-xl text-xs font-semibold"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>robots.txt Advisor</span>
          </Button>

          {isAdmin && (
            <Button
              size="sm"
              onClick={() => handleSimulateAiHit("perplexity")}
              disabled={isSimulating}
              className="sheen gap-2 rounded-xl text-xs font-semibold shadow-glow bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Bot className={cn("h-3.5 w-3.5", isSimulating && "animate-spin")} />
              <span>{isSimulating ? "Simulating AI..." : "Test AI Bot (Admin)"}</span>
            </Button>
          )}
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total AI Crawls"
          value={formatNumber(stats.total)}
          icon={Bot}
          description="Requests from LLMs & AI search bots"
        />
        <StatCard
          label="Live Search Citations"
          value={`${stats.citationPct}%`}
          icon={Sparkles}
          description={`${formatNumber(stats.citationCount)} live user queries via AI`}
        />
        <StatCard
          label="Active AI Engines"
          value={formatNumber(stats.uniqueBots)}
          icon={Cpu}
          description="OpenAI, Perplexity, Anthropic, Google..."
        />
        <StatCard
          label="Top Crawled Page"
          value={stats.topPagePath}
          icon={FileText}
          description={stats.total > 0 ? `${formatNumber(stats.topPageCount)} crawls recorded` : "No crawls recorded yet"}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Crawl Volume Over Time */}
        <div className="lg:col-span-2">
          <SectionCard
            title="AI Crawling Volume Trend"
            description="Daily frequency of AI web searches and model training scrapers"
          >
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="colorCitations" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#20808D" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#20808D" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorTraining" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10A37F" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10A37F" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" stroke="#888" fontSize={11} tickLine={false} />
                  <YAxis stroke="#888" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="citations"
                    name="Search Citations"
                    stroke="#20808D"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCitations)"
                  />
                  <Area
                    type="monotone"
                    dataKey="training"
                    name="Model Training"
                    stroke="#10A37F"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTraining)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        {/* Right 1 Col: AI Engine Market Share */}
        <div>
          <SectionCard
            title="AI Engine Market Share"
            description="Distribution across AI platforms"
          >
            {vendorBreakdown.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <Bot className="h-7 w-7 mx-auto mb-2 text-muted-foreground/50" />
                <p className="font-semibold text-foreground">No AI engines detected yet</p>
                <p className="text-[11px] mt-1 max-w-xs mx-auto">
                  When Perplexity, ChatGPT, Claude, and Gemini crawl your site, their market share breakdown will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5 pt-1">
                {vendorBreakdown.map((item) => (
                  <div key={item.vendor} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.vendor}
                      </span>
                      <span className="text-muted-foreground font-mono tabular-nums">
                        {item.count} ({item.pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${item.pct}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Most Crawled Pages Table */}
      <SectionCard
        title="Most Crawled Pages & Documentation"
        description={`${pageRankings.length} distinct paths indexed by AI agents`}
        action={
          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search page path..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs rounded-xl"
              />
            </div>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger className="h-8 w-32 rounded-xl text-xs">
                <SelectValue placeholder="All Vendors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="perplexity">Perplexity</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="google">Google AI</SelectItem>
                <SelectItem value="meta">Meta AI</SelectItem>
              </SelectContent>
            </Select>
            <Select value={purposeFilter} onValueChange={setPurposeFilter}>
              <SelectTrigger className="h-8 w-28 rounded-xl text-xs">
                <SelectValue placeholder="All Intent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Intent</SelectItem>
                <SelectItem value="citations">Citations</SelectItem>
                <SelectItem value="training">Training</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              className="h-8 w-8 rounded-xl shrink-0"
              title="Refresh"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isEventsLoading && "animate-spin")} />
            </Button>
          </div>
        }
      >
        {pageRankings.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No AI Bot Crawls Yet"
            description="When ChatGPT, Claude, Perplexity, or Gemini crawl your site, their paths will appear here automatically."
          >
            <Button
              variant="outline"
              size="sm"
              onClick={copyPixel}
              className="gap-2 rounded-xl text-xs mt-2"
            >
              {copiedPixel ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedPixel ? "Copied Pixel" : "Copy Zero-JS Tracking Pixel"}</span>
            </Button>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/70 text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3">Indexed Page Path</th>
                  <th className="py-2.5 px-3">Top AI Engine</th>
                  <th className="py-2.5 px-3">Citations vs Training</th>
                  <th className="py-2.5 px-3 text-right">Total Crawls</th>
                  <th className="py-2.5 px-3 text-right">Last Visited</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {pageRankings.map((row) => (
                  <tr key={row.path} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3 font-mono font-medium text-foreground max-w-[260px] truncate" title={row.path}>
                      {row.path}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: VENDOR_COLORS[row.primaryVendor] || "#A1A1AA" }}
                        />
                        <span className="font-semibold text-foreground">{row.topBot}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        {row.citationCount > 0 && (
                          <Badge variant="outline" className="border-teal-500/30 bg-teal-500/10 text-teal-400 text-[10px] px-1.5 py-0">
                            {row.citationCount} Citations
                          </Badge>
                        )}
                        {row.trainingCount > 0 && (
                          <Badge variant="outline" className="border-muted bg-muted/50 text-muted-foreground text-[10px] px-1.5 py-0">
                            {row.trainingCount} Training
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-foreground tabular-nums">
                      {formatNumber(row.count)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted-foreground whitespace-nowrap">
                      {relativeTime(row.lastVisited)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Live AI Crawler Hit Stream */}
      <SectionCard
        title="Live AI Bot Crawl Activity Stream"
        description="Real-time chronological events from LLM web agents and citation search bots"
      >
        {displayEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">
            No live bot hits recorded in the selected period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/70 text-muted-foreground font-semibold">
                  <th className="py-2 px-3">Time</th>
                  <th className="py-2 px-3">AI Engine / Agent</th>
                  <th className="py-2 px-3">Vendor</th>
                  <th className="py-2 px-3">Path</th>
                  <th className="py-2 px-3">Intent</th>
                  <th className="py-2 px-3 text-right">Origin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {displayEvents.slice(0, 15).map((evt) => {
                  const props = evt.properties || {};
                  const botName = props.bot_name || evt.name || "AI Crawler";
                  const vendor = props.vendor || "AI Engine";
                  const purpose = props.purpose || "Live Search Citations";
                  const isCitation = purpose.toLowerCase().includes("citation");

                  return (
                    <tr key={evt.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                        {relativeTime(evt.timestamp)}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-1.5">
                        <Bot className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{botName}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: VENDOR_COLORS[vendor] || "#888" }}
                          />
                          {vendor}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-foreground max-w-[200px] truncate" title={evt.path}>
                        {evt.path || "/"}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0 font-medium",
                            isCitation
                              ? "border-teal-500/30 bg-teal-500/10 text-teal-400"
                              : "border-muted bg-muted/40 text-muted-foreground"
                          )}
                        >
                          {purpose}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                        {evt.country ? `${flagEmoji(evt.country)} ${evt.country}` : "Server Cloud"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Robots.txt Advisor Modal */}
      <Dialog open={robotsModalOpen} onOpenChange={setRobotsModalOpen}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span>Generative Engine Optimization (GEO) robots.txt Generator</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure which AI models are permitted to scrape your website for live search citations versus bulk LLM training.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRobotsPreset("citations")}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all",
                  robotsPreset === "citations"
                    ? "border-primary bg-primary/10 shadow-xs"
                    : "border-border bg-muted/40 hover:bg-muted"
                )}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>Max Citations</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Allow live search bots (Perplexity, ChatGPT-User). Block training scrapers.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRobotsPreset("allow_all")}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all",
                  robotsPreset === "allow_all"
                    ? "border-primary bg-primary/10 shadow-xs"
                    : "border-border bg-muted/40 hover:bg-muted"
                )}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                  <Globe className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Allow All</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Open access for all AI indexing, search, and training models.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRobotsPreset("block_all")}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all",
                  robotsPreset === "block_all"
                    ? "border-primary bg-primary/10 shadow-xs"
                    : "border-border bg-muted/40 hover:bg-muted"
                )}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                  <Terminal className="h-3.5 w-3.5 text-rose-400" />
                  <span>Strict Privacy</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Block all known AI web agents and LLM training spiders.
                </p>
              </button>
            </div>

            <div className="relative rounded-xl border border-border bg-muted/50 p-3.5 font-mono text-[11px] leading-relaxed text-foreground">
              <pre className="overflow-x-auto max-h-56">{robotsTxtContent}</pre>
              <button
                type="button"
                onClick={copyRobots}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition"
                title="Copy robots.txt"
              >
                {copiedRobots ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-muted-foreground">
                Save as <code className="text-foreground font-semibold">robots.txt</code> in the root of your web server.
              </p>
              <Button size="sm" onClick={copyRobots} className="gap-2 rounded-xl text-xs">
                {copiedRobots ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedRobots ? "Copied" : "Copy robots.txt"}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
