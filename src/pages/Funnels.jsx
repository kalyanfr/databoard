import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Filter,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  ArrowRight,
  Layers,
  Users,
  CheckCircle2,
  Sparkles,
  BookmarkPlus,
  Sliders,
  Info,
  Compass,
} from "lucide-react";
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
import { formatNumber } from "@/lib/format";
import { useActiveProject, useRange } from "@/lib/filters";
import { cn } from "@/lib/utils";

const STARTER_TEMPLATES = [
  {
    id: "saas-signup",
    name: "SaaS Sign-up Flow",
    description: "Template: Landing page, pricing tier inspection, registration, and dashboard arrival.",
    isTemplate: true,
    steps: [
      { name: "Landing Page", type: "pageview", match: "/" },
      { name: "Pricing Page", type: "pageview", match: "/pricing" },
      { name: "Register Page", type: "pageview", match: "/register" },
      { name: "Dashboard / App", type: "pageview", match: "/dashboard" },
    ],
  },
  {
    id: "ecommerce-checkout",
    name: "E-Commerce Checkout",
    description: "Template: Storefront browsing, product view, shopping cart, and final purchase.",
    isTemplate: true,
    steps: [
      { name: "Store Front", type: "pageview", match: "/" },
      { name: "Product Page", type: "pageview", match: "/products" },
      { name: "Cart / Checkout", type: "pageview", match: "/checkout" },
      { name: "Purchase Completed", type: "event", match: "purchase" },
    ],
  },
  {
    id: "lead-generation",
    name: "Lead & Contact Capture",
    description: "Template: Feature exploration, contact inquiry page, and form submission.",
    isTemplate: true,
    steps: [
      { name: "Features Overview", type: "pageview", match: "/features" },
      { name: "Contact Page", type: "pageview", match: "/contact" },
      { name: "Form Submitted", type: "event", match: "form_submit" },
    ],
  },
];

export default function Funnels() {
  const { project, isLoading: isProjectLoading } = useActiveProject();
  const range = useRange();

  // Custom funnels saved per project in localStorage
  const storageKey = `lume.funnels.${project?.id || "global"}`;
  const [customFunnels, setCustomFunnels] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Re-read stored funnels whenever project changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setCustomFunnels(stored ? JSON.parse(stored) : []);
    } catch {
      setCustomFunnels([]);
    }
  }, [storageKey]);

  // Fetch events for active project in current date range
  const {
    data: events = [],
    isLoading: isEventsLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["funnel-events", project?.project_id, range.from, range.to],
    enabled: !!project?.project_id,
    queryFn: async () => {
      const cleanDomain = project?.domain
        ? String(project.domain).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "")
        : null;
      const projectIds = [project?.project_id, project?.id, cleanDomain].filter(Boolean);
      const queryFilter = projectIds.length > 1 ? { $in: [...new Set(projectIds)] } : (project?.project_id || project?.id);

      const { items } = await webrader.entities.Event.filter(
        {
          project_id: queryFilter,
          timestamp: { $gte: range.from, $lt: range.to },
        },
        { limit: 8000 }
      );
      return items || [];
    },
    staleTime: 30000,
  });

  // 1. Auto-discover real visited paths from live traffic
  const detectedPaths = useMemo(() => {
    const counts = new Map();
    for (const e of events) {
      if (e.type === "pageview" || !e.type) {
        const p = (e.path || "/").trim();
        counts.set(p, (counts.get(p) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([path, count]) => ({ path, count }));
  }, [events]);

  // 2. Auto-discover custom event triggers
  const detectedEvents = useMemo(() => {
    const counts = new Map();
    for (const e of events) {
      if (e.type === "event" && e.name && !["scroll_depth", "engaged_time"].includes(e.name)) {
        counts.set(e.name, (counts.get(e.name) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [events]);

  // 3. Auto-suggested real funnel based on actual traffic paths
  const autoSuggestedFunnel = useMemo(() => {
    if (detectedPaths.length === 0) return null;
    const home = detectedPaths.find((p) => p.path === "/" || p.path === "") || detectedPaths[0];
    const otherPaths = detectedPaths.filter((p) => p.path !== home.path).slice(0, 3);

    const steps = [
      { name: "Landing Page", type: "pageview", match: home.path },
    ];

    otherPaths.forEach((p) => {
      const clean = p.path.replace(/^\//, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      steps.push({
        name: clean || p.path,
        type: "pageview",
        match: p.path,
      });
    });

    if (detectedEvents.length > 0) {
      const topEv = detectedEvents[0];
      steps.push({
        name: topEv.name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        type: "event",
        match: topEv.name,
      });
    }

    // Require at least 2 steps for a meaningful funnel
    if (steps.length < 2) return null;

    return {
      id: "auto-suggested",
      name: `${project?.name || project?.domain || "Website"} Live Journey`,
      description: `Auto-detected sequence from real visitor navigation paths on ${project?.domain || "your site"}.`,
      isAutoDetected: true,
      steps,
    };
  }, [detectedPaths, detectedEvents, project]);

  // Combine real funnels (custom + auto-suggested) and starter templates
  const allFunnels = useMemo(() => {
    const list = [...customFunnels];
    if (autoSuggestedFunnel && !customFunnels.some((f) => f.id === "auto-suggested")) {
      list.push(autoSuggestedFunnel);
    }
    return [...list, ...STARTER_TEMPLATES];
  }, [customFunnels, autoSuggestedFunnel]);

  // Default selected funnel: user's custom funnel first, or auto-suggested real funnel, or starter template
  const [selectedFunnelId, setSelectedFunnelId] = useState(() => {
    if (customFunnels.length > 0) return customFunnels[0].id;
    return autoSuggestedFunnel ? autoSuggestedFunnel.id : STARTER_TEMPLATES[0].id;
  });

  // Automatically switch to auto-suggested funnel if user has no custom funnels yet
  useEffect(() => {
    if (customFunnels.length === 0 && autoSuggestedFunnel && (!selectedFunnelId || selectedFunnelId.startsWith("saas-"))) {
      setSelectedFunnelId(autoSuggestedFunnel.id);
    }
  }, [autoSuggestedFunnel, customFunnels, selectedFunnelId]);

  const activeFunnel = useMemo(() => {
    return allFunnels.find((f) => f.id === selectedFunnelId) || allFunnels[0];
  }, [allFunnels, selectedFunnelId]);

  // Funnel calculations: Strict Sequential Visitor State Machine (Minilytics approach)
  // Step 2 is only counted if the visitor previously completed Step 1 chronologically.
  const stepStats = useMemo(() => {
    if (!activeFunnel || !activeFunnel.steps?.length) return [];

    // 1. Build step matcher predicates supporting exact match, prefixes, and wildcards (* e.g. /blog/*)
    const matchers = activeFunnel.steps.map((step) => {
      const pattern = (step.match || step.value || "/").trim();
      if (step.type === "pageview") {
        if (pattern === "/" || pattern === "") {
          return (e) => (e.type === "pageview" || !e.type) && (e.path === "/" || e.path === "" || !e.path);
        }
        if (pattern.includes("*")) {
          const parts = pattern.split("*").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
          const regex = new RegExp("^" + parts.join(".*") + "$");
          return (e) => (e.type === "pageview" || !e.type) && regex.test(e.path || "");
        }
        return (e) => (e.type === "pageview" || !e.type) && (e.path === pattern || (e.path && e.path.startsWith(pattern)));
      } else {
        return (e) => (e.type === "event" || e.name) && (e.name === pattern || e.type === pattern);
      }
    });

    // 2. Sort all events chronologically ascending
    const sorted = [...events].sort(
      (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
    );

    // 3. Sequential visitor evaluation: step N is only reached if step N-1 was achieved earlier
    const visitorProgress = new Map();
    for (const e of sorted) {
      const vid = e.visitor_id || e.session_id || "anon";
      const currentStep = visitorProgress.get(vid) ?? 0;
      if (currentStep < matchers.length && matchers[currentStep](e)) {
        visitorProgress.set(vid, currentStep + 1);
      }
    }

    // 4. Compute counts for each step (reaching step K means visitor completed steps 0..K-1)
    const counts = activeFunnel.steps.map(() => 0);
    for (const reached of visitorProgress.values()) {
      for (let i = 0; i < reached; i++) {
        counts[i]++;
      }
    }

    return activeFunnel.steps.map((step, index) => ({
      ...step,
      stepNumber: index + 1,
      count: counts[index],
    }));
  }, [activeFunnel, events]);

  const topVisitors = stepStats[0]?.count || 0;
  const finalConversions = stepStats[stepStats.length - 1]?.count || 0;
  const overallConversionRate = topVisitors > 0 ? (finalConversions / topVisitors) * 100 : 0;

  // Find biggest drop-off bottleneck
  const biggestDrop = useMemo(() => {
    let maxLost = -1;
    let worstStep = null;
    for (let i = 1; i < stepStats.length; i++) {
      const prev = stepStats[i - 1].count;
      const curr = stepStats[i].count;
      const lost = prev - curr;
      if (prev > 0 && lost > maxLost) {
        maxLost = lost;
        worstStep = {
          from: stepStats[i - 1].name,
          to: stepStats[i].name,
          lost,
          pct: ((lost / prev) * 100).toFixed(1),
        };
      }
    }
    return worstStep;
  }, [stepStats]);

  // Dialog state for adding or customizing a funnel
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFunnelName, setNewFunnelName] = useState("");
  const [newFunnelDesc, setNewFunnelDesc] = useState("");
  const [newSteps, setNewSteps] = useState([
    { name: "Landing Page", type: "pageview", match: "/" },
    { name: "Next Step", type: "pageview", match: "" },
  ]);

  const openCreateDialog = (prefill = null) => {
    if (prefill) {
      setNewFunnelName(prefill.name || "");
      setNewFunnelDesc(prefill.description || "");
      setNewSteps(
        prefill.steps?.map((s) => ({
          name: s.name,
          type: s.type || "pageview",
          match: s.match || "",
        })) || []
      );
    } else {
      setNewFunnelName("");
      setNewFunnelDesc("");
      setNewSteps([
        { name: "Landing Page", type: "pageview", match: "/" },
        { name: "Next Step", type: "pageview", match: detectedPaths[1]?.path || "" },
      ]);
    }
    setIsCreateOpen(true);
  };

  const handleAddStep = () => {
    setNewSteps((prev) => [
      ...prev,
      { name: `Step ${prev.length + 1}`, type: "pageview", match: "" },
    ]);
  };

  const handleRemoveStep = (index) => {
    if (newSteps.length <= 2) return;
    setNewSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveFunnel = (e) => {
    e.preventDefault();
    if (!newFunnelName.trim()) return;
    const newFunnel = {
      id: `custom_${Date.now()}`,
      name: newFunnelName.trim(),
      description: newFunnelDesc.trim() || "Custom multi-step conversion funnel.",
      steps: newSteps.filter((s) => s.match.trim() !== ""),
    };
    const updated = [...customFunnels, newFunnel];
    setCustomFunnels(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
    setSelectedFunnelId(newFunnel.id);
    setIsCreateOpen(false);
    setNewFunnelName("");
    setNewFunnelDesc("");
  };

  const handleDeleteCustomFunnel = (id) => {
    const updated = customFunnels.filter((f) => f.id !== id);
    setCustomFunnels(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
    if (selectedFunnelId === id) {
      setSelectedFunnelId(allFunnels[0]?.id || STARTER_TEMPLATES[0].id);
    }
  };

  const handleSaveAutoSuggestedAsCustom = () => {
    if (!autoSuggestedFunnel) return;
    const newFunnel = {
      id: `custom_${Date.now()}`,
      name: autoSuggestedFunnel.name,
      description: autoSuggestedFunnel.description,
      steps: autoSuggestedFunnel.steps,
    };
    const updated = [...customFunnels, newFunnel];
    setCustomFunnels(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
    setSelectedFunnelId(newFunnel.id);
  };

  if (isProjectLoading || isEventsLoading) return <LoadingBlock rows={3} />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  if (!project) {
    return (
      <EmptyState
        icon={Filter}
        title="No project selected"
        description="Select or create a project to inspect visitor journey funnels and drop-offs."
      />
    );
  }

  const isCurrentTemplate = activeFunnel?.isTemplate;
  const isCurrentAutoDetected = activeFunnel?.isAutoDetected;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversion Funnels"
        description="Pinpoint the exact step where visitors drop off, optimize low-performing pages, and maximize conversions."
      >
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button onClick={() => openCreateDialog()} className="sheen gap-2 rounded-xl shadow-glow text-xs font-semibold">
            <Plus className="h-4 w-4" />
            New Funnel
          </Button>

          {/* Create & Customize Modal */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogContent className="sm:max-w-[580px] max-h-[88vh] overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold">Create Conversion Funnel</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Define ordered steps using your website URLs (e.g. /, /extension-login) or custom events (e.g. signup, purchase).
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSaveFunnel} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="funnel-name" className="text-xs font-semibold">Funnel Name</Label>
                  <Input
                    id="funnel-name"
                    required
                    placeholder="e.g. Extension Login Flow or Checkout"
                    value={newFunnelName}
                    onChange={(e) => setNewFunnelName(e.target.value)}
                    className="rounded-xl text-xs h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="funnel-desc" className="text-xs font-semibold">Description (optional)</Label>
                  <Input
                    id="funnel-desc"
                    placeholder="Short summary of this user path"
                    value={newFunnelDesc}
                    onChange={(e) => setNewFunnelDesc(e.target.value)}
                    className="rounded-xl text-xs h-9"
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Funnel Steps (Sequential)
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAddStep}
                      className="h-7 text-xs text-primary gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add step
                    </Button>
                  </div>

                  {newSteps.map((step, idx) => (
                    <div key={idx} className="space-y-1.5 rounded-2xl border border-border/80 p-3 bg-muted/20">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                          {idx + 1}
                        </span>
                        <Input
                          required
                          placeholder="Step Name (e.g. Landing Page)"
                          value={step.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, name: val } : s)));
                          }}
                          className="h-8 text-xs rounded-lg flex-1"
                        />
                        <Select
                          value={step.type}
                          onValueChange={(val) => {
                            setNewSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, type: val } : s)));
                          }}
                        >
                          <SelectTrigger className="h-8 w-28 text-xs rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pageview">Pageview</SelectItem>
                            <SelectItem value="event">Event</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          required
                          placeholder={step.type === "pageview" ? "/path or /blog/*" : "event_name"}
                          value={step.match}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, match: val } : s)));
                          }}
                          className="h-8 text-xs rounded-lg flex-1 font-mono"
                        />
                        {newSteps.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveStep(idx)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      {/* Quick Pick chips from real site traffic */}
                      {step.type === "pageview" && detectedPaths.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pl-8 pt-0.5">
                          <span className="text-[10px] text-muted-foreground">Detected paths:</span>
                          {detectedPaths.slice(0, 5).map((p) => (
                            <button
                              key={p.path}
                              type="button"
                              onClick={() => {
                                setNewSteps((prev) =>
                                  prev.map((s, i) =>
                                    i === idx
                                      ? {
                                          ...s,
                                          match: p.path,
                                          name: s.name.startsWith("Step")
                                            ? p.path === "/"
                                              ? "Landing Page"
                                              : p.path.replace(/^\//, "").replace(/[-_]/g, " ")
                                            : s.name,
                                        }
                                      : s
                                  )
                                );
                              }}
                              className="rounded-md border border-border/80 bg-card px-1.5 py-0.5 text-[10px] font-mono text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
                            >
                              {p.path}
                            </button>
                          ))}
                        </div>
                      )}

                      {step.type === "event" && detectedEvents.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pl-8 pt-0.5">
                          <span className="text-[10px] text-muted-foreground">Detected events:</span>
                          {detectedEvents.slice(0, 5).map((ev) => (
                            <button
                              key={ev.name}
                              type="button"
                              onClick={() => {
                                setNewSteps((prev) =>
                                  prev.map((s, i) =>
                                    i === idx
                                      ? {
                                          ...s,
                                          match: ev.name,
                                          name: s.name.startsWith("Step") ? ev.name : s.name,
                                        }
                                      : s
                                  )
                                );
                              }}
                              className="rounded-md border border-border/80 bg-card px-1.5 py-0.5 text-[10px] font-mono text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
                            >
                              {ev.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <DialogFooter className="pt-3">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl text-xs">
                    Cancel
                  </Button>
                  <Button type="submit" className="rounded-xl text-xs font-semibold">
                    Save Funnel
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      <FiltersBar />

      {/* Funnel Selector Tabs with Clear Groups */}
      <div className="space-y-2 border-b border-border/60 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {allFunnels.map((funnel) => {
            const isSelected = funnel.id === activeFunnel?.id;
            const isCustom = funnel.id.startsWith("custom_");
            const isAuto = funnel.isAutoDetected;
            const isTpl = funnel.isTemplate;

            return (
              <div key={funnel.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedFunnelId(funnel.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all",
                    isSelected
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "glass border border-border text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  {isAuto ? (
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  ) : (
                    <Filter className="h-3.5 w-3.5" />
                  )}
                  <span>{funnel.name}</span>
                  {isCustom && (
                    <Badge variant="outline" className="border-primary/30 text-[9px] uppercase px-1 py-0">
                      Custom
                    </Badge>
                  )}
                  {isAuto && (
                    <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[9px] uppercase px-1 py-0 font-bold">
                      Auto-Detected
                    </Badge>
                  )}
                  {isTpl && (
                    <Badge variant="outline" className="border-border text-muted-foreground text-[9px] uppercase px-1 py-0">
                      Template
                    </Badge>
                  )}
                </button>
                {isCustom && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomFunnel(funnel.id)}
                    title="Delete custom funnel"
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Auto-Detected Funnel Callout (When viewing the auto-detected real flow) */}
      {isCurrentAutoDetected && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-foreground flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500 font-bold">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="font-semibold text-foreground text-xs sm:text-[13px]">
                Auto-Detected From Your Website Traffic
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                This journey was automatically constructed from actual pageviews on <span className="font-semibold text-foreground">{project?.domain || "your site"}</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openCreateDialog(autoSuggestedFunnel)}
              className="h-7 text-xs rounded-lg gap-1"
            >
              <Sliders className="h-3 w-3" /> Customize
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAutoSuggestedAsCustom}
              className="h-7 text-xs rounded-lg gap-1 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              <BookmarkPlus className="h-3 w-3" /> Save to My Funnels
            </Button>
          </div>
        </div>
      )}

      {/* Template Explanation Callout (When viewing a starter template) */}
      {isCurrentTemplate && (
        <div className="rounded-2xl border border-border/80 bg-muted/30 p-3.5 text-xs text-foreground flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
              <Info className="h-4 w-4" />
            </span>
            <div>
              <p className="font-semibold text-foreground text-xs sm:text-[13px]">
                Starter Template Preview ({activeFunnel.name})
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                This is a generic preset with example paths (e.g. /pricing, /register). Click below to adapt it to your site's actual URLs.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => openCreateDialog(activeFunnel)}
            className="h-7 text-xs rounded-lg gap-1 font-semibold ml-auto"
          >
            <Compass className="h-3 w-3" /> Customize for My Site
          </Button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Funnel Entrants"
          value={formatNumber(topVisitors)}
          hint="Visitors entering step 1"
          icon={Users}
          tone="blue"
        />
        <StatCard
          label="Total Completions"
          value={formatNumber(finalConversions)}
          hint="Completed all funnel steps"
          icon={CheckCircle2}
          tone="teal"
          delay={70}
        />
        <StatCard
          label="Conversion Rate"
          value={`${overallConversionRate.toFixed(1)}%`}
          hint="Step 1 to final step"
          icon={TrendingUp}
          tone="violet"
          delay={140}
        />
        <StatCard
          label="Funnel Steps"
          value={String(stepStats.length)}
          hint={activeFunnel?.name || "Active funnel"}
          icon={Layers}
          tone="pink"
          delay={210}
        />
      </div>

      {/* Bottleneck Alert */}
      {biggestDrop && topVisitors > 0 && (
        <div className="rounded-xl border border-border/80 bg-muted/30 px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-[10px]">
              !
            </span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-semibold text-foreground">
                Drop-off ({biggestDrop.pct}%):
              </span>
              <span className="text-muted-foreground">
                {biggestDrop.from} → {biggestDrop.to} ({formatNumber(biggestDrop.lost)} visitors dropped before completing this step).
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Visual Funnel Chart & Steps */}
      <SectionCard title={activeFunnel?.name} description={activeFunnel?.description}>
        <div className="space-y-3 pt-1">
          {stepStats.map((step, idx) => {
            const pctOfTotal = topVisitors > 0 ? (step.count / topVisitors) * 100 : idx === 0 ? 100 : 0;
            const prevStep = idx > 0 ? stepStats[idx - 1] : null;
            const dropFromPrev = prevStep && prevStep.count > 0 ? ((prevStep.count - step.count) / prevStep.count) * 100 : 0;
            const lostCount = prevStep ? Math.max(0, prevStep.count - step.count) : 0;

            return (
              <div key={step.name} className="space-y-1.5 rounded-xl p-2 transition-colors hover:bg-muted/20">
                {/* Step Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">
                      {step.stepNumber}
                    </span>
                    <span className="font-heading font-medium text-foreground text-xs sm:text-[13px] truncate">{step.name}</span>
                    <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0.5 text-muted-foreground border-border shrink-0 font-mono">
                      {step.type === "pageview" ? `URL: ${step.match}` : `Event: ${step.match}`}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold text-foreground text-xs sm:text-[13px] tabular-nums">
                      {formatNumber(step.count)} visitors
                    </span>
                    <span className="text-muted-foreground text-[11px] tabular-nums">({pctOfTotal.toFixed(1)}%)</span>
                  </div>
                </div>

                {/* Funnel Progress Bar */}
                <div className="h-2 sm:h-2.5 w-full overflow-hidden rounded-full bg-muted/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-chart-4 transition-all duration-700 ease-out shadow-xs"
                    style={{ width: `${Math.max(pctOfTotal, topVisitors > 0 ? 2 : 0)}%` }}
                  />
                </div>

                {/* Drop-off from Previous Step Indicator */}
                {idx > 0 && prevStep && (
                  <div className="flex items-center justify-between pl-7 pr-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
                      Retention:{" "}
                      <span className="font-medium text-foreground">
                        {prevStep.count > 0 ? ((step.count / prevStep.count) * 100).toFixed(1) : 0}%
                      </span>
                    </span>
                    {lostCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-rose-500 font-medium">
                        <TrendingDown className="h-3 w-3" />
                        -{dropFromPrev.toFixed(1)}% ({formatNumber(lostCount)} lost)
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
