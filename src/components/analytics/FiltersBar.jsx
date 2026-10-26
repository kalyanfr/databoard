import { useState } from "react";
import { CalendarRange, RotateCw } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveProject, useFilters } from "@/lib/filters";
import { RANGE_PRESETS } from "@/lib/ranges";
import { cn } from "@/lib/utils";

const PRESET_LABELS = {
  today: { short: "Today", full: "Today" },
  "7d": { short: "7d", full: "7 days" },
  "30d": { short: "30d", full: "30 days" },
  "90d": { short: "90d", full: "90 days" },
};

/** Date range + project picker, shared by every analytics screen. */
export default function FiltersBar({ onRefresh, refreshing = false, showProject = true, className }) {
  const { filters, setFilters } = useFilters();
  const { projects, projectId, setProjectId } = useActiveProject();
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [open, setOpen] = useState(false);

  const applyCustom = () => {
    if (!custom.from || !custom.to) return;
    setFilters({ range: "custom", from: custom.from, to: custom.to });
    setOpen(false);
  };

  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto", className)}>
      {showProject && projects.length > 1 ? (
        <Select value={projectId ?? undefined} onValueChange={setProjectId}>
          <SelectTrigger className="h-9 w-full sm:w-[190px] rounded-xl text-xs sm:text-sm border-border bg-card">
            <SelectValue placeholder="Choose a project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial w-full sm:w-auto min-w-0">
        <div className="glass grid grid-cols-5 sm:flex sm:items-center rounded-xl border border-border p-1 flex-1 sm:flex-initial min-w-0">
          {RANGE_PRESETS.map((preset) => {
            const isSelected = filters.range === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setFilters({ range: preset.id, from: null, to: null })}
                className={cn(
                  "flex items-center justify-center rounded-lg py-1.5 text-xs font-medium transition-all duration-200 select-none text-center",
                  "px-1 sm:px-3",
                  isSelected
                    ? "bg-primary/12 text-primary font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="sm:hidden">{PRESET_LABELS[preset.id]?.short ?? preset.label}</span>
                <span className="hidden sm:inline">{PRESET_LABELS[preset.id]?.full ?? preset.label}</span>
              </button>
            );
          })}

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all duration-200 select-none text-center",
                  "px-1 sm:px-3",
                  filters.range === "custom"
                    ? "bg-primary/12 text-primary font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Custom date range"
              >
                <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Custom</span>
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>Custom date range</DialogTitle>
                <DialogDescription>All dates are interpreted in UTC.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="range-from">From</Label>
                  <Input
                    id="range-from"
                    type="date"
                    value={custom.from}
                    onChange={(event) => setCustom((previous) => ({ ...previous, from: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="range-to">To</Label>
                  <Input
                    id="range-to"
                    type="date"
                    value={custom.to}
                    onChange={(event) => setCustom((previous) => ({ ...previous, to: event.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={applyCustom} disabled={!custom.from || !custom.to} className="rounded-xl">
                  Apply range
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {onRefresh ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            aria-label="Refresh data"
            disabled={refreshing}
            className="h-9 w-9 shrink-0 rounded-xl"
          >
            <RotateCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
