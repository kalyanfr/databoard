import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { webrader } from "@/api/webraderClient";
import { computeRange } from "@/lib/ranges";

const FiltersContext = createContext(null);
const STORAGE_KEY = "lume.filters";

/**
 * Shared dashboard filters (active project + date range). The range is
 * remembered between pages; the active project falls back to the newest one.
 */
export function FiltersProvider({ children }) {
  const [filters, setFiltersState] = useState({ projectId: null, range: "7d", from: null, to: null });

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      setFiltersState((previous) => ({
        ...previous,
        range: parsed.range ?? previous.range,
        from: parsed.from ?? null,
        to: parsed.to ?? null,
      }));
    } catch {
      /* unreadable stored filters — keep the defaults */
    }
  }, []);

  const setFilters = useCallback((patch) => {
    setFiltersState((previous) => {
      const next = typeof patch === "function" ? patch(previous) : { ...previous, ...patch };
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ range: next.range, from: next.from, to: next.to }),
        );
      } catch {
        /* storage unavailable — filters still apply for this session */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ filters, setFilters }), [filters, setFilters]);
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters() {
  const context = useContext(FiltersContext);
  if (!context) throw new Error("useFilters must be used inside FiltersProvider");
  return context;
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const page = await webrader.entities.Project.filter({ archived: { $ne: true } }, { sort: "-created_date", limit: 100 });
      return page.items ?? [];
    },
    staleTime: 30000,
  });
}

/** The project every analytics screen is scoped to. */
export function useActiveProject() {
  const { data, isLoading, error, refetch } = useProjects();
  const { filters, setFilters } = useFilters();
  const projects = data ?? [];
  const project = projects.find((item) => item.id === filters.projectId) ?? projects[0] ?? null;

  useEffect(() => {
    if (project && filters.projectId !== project.id) setFilters({ projectId: project.id });
  }, [project, filters.projectId, setFilters]);

  return {
    projects,
    project,
    projectId: project?.id ?? null,
    setProjectId: (id) => setFilters({ projectId: id }),
    isLoading,
    error,
    refetch,
  };
}

export function useRange() {
  const { filters } = useFilters();
  return computeRange(filters);
}