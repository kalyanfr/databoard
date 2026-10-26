import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ExternalLink, Loader2 } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import ConfirmDeleteButton from "@/components/common/ConfirmDeleteButton";
import { ErrorState, LoadingBlock } from "@/components/common/LoadingBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

/** Every tracked site in the workspace, with admin-level controls and mobile support. */
export default function ProjectsTable() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState(null);

  const query = useQuery({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const page = await webrader.entities.Project.filter({}, { sort: "-created_date", limit: 200 });
      return page.items ?? [];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-projects"] });

  const toggleArchive = async (project) => {
    setBusyId(project.id);
    try {
      await webrader.entities.Project.update(project.id, { archived: !project.archived });
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (project) => {
    setBusyId(project.id);
    try {
      const scope = { project_id: project.project_id };
      await Promise.allSettled([
        webrader.entities.Event.deleteMany(scope),
        webrader.entities.Session.deleteMany(scope),
        webrader.entities.VisitorDay.deleteMany(scope),
      ]);
      // Clean up corresponding Uptime monitors for this project/domain
      try {
        const cleanDomain = (project.domain || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
        const { items: monitors } = await webrader.entities.Monitor.filter({});
        const toDelete = (monitors || []).filter((m) => {
          const mClean = (m.url || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
          return (
            m.project_id === project.project_id ||
            m.project_id === project.id ||
            (cleanDomain && mClean === cleanDomain)
          );
        });
        for (const m of toDelete) {
          await webrader.entities.Monitor.delete(m.id);
        }
      } catch (monDelErr) {
        console.warn("[Admin uptime delete sync error]:", monDelErr);
      }

      await webrader.entities.Project.delete(project.id);
      await refresh();
    } catch (err) {
      console.warn("Project delete error:", err);
    } finally {
      setBusyId(null);
    }
  };

  const removeAll = async () => {
    if (!window.confirm("Are you sure you want to delete ALL projects across the entire SaaS? This cannot be undone.")) return;
    setBusyId("all");
    try {
      for (const project of projects) {
        const scope = { project_id: project.project_id };
        await Promise.allSettled([
          webrader.entities.Event.deleteMany(scope),
          webrader.entities.Session.deleteMany(scope),
          webrader.entities.VisitorDay.deleteMany(scope),
        ]);
        await webrader.entities.Project.delete(project.id);
      }
      const { items: monitors } = await webrader.entities.Monitor.filter({});
      for (const m of monitors || []) {
        await webrader.entities.Monitor.delete(m.id);
      }
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["monitors"] });
    } catch (err) {
      console.warn("Failed to delete all projects:", err);
    } finally {
      setBusyId(null);
    }
  };

  if (query.isLoading) return <LoadingBlock rows={2} />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const projects = query.data ?? [];
  if (!projects.length) {
    return (
      <div className="py-8 text-center space-y-1.5 rounded-2xl border border-dashed border-border/70 p-6 bg-muted/10">
        <p className="font-heading font-semibold text-sm text-foreground">No projects found</p>
        <p className="text-xs text-muted-foreground">All projects have been removed from the platform. New projects created by users or admins will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-1">
        <p className="text-xs text-muted-foreground">{projects.length} project{projects.length === 1 ? "" : "s"} tracked</p>
        <Button
          variant="destructive"
          size="sm"
          className="rounded-xl text-xs h-8"
          disabled={busyId === "all"}
          onClick={removeAll}
        >
          {busyId === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
          Remove all projects
        </Button>
      </div>
      {/* Mobile Projects Cards View: easy to navigate and operate on phones */}
      <div className="space-y-3 sm:hidden">
        {projects.map((project) => (
          <div key={project.id} className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-heading font-semibold text-sm truncate">{project.name}</p>
                <p className="text-xs text-muted-foreground truncate">{project.domain}</p>
              </div>
              <div className="flex flex-wrap gap-1 shrink-0">
                <Badge
                  variant="outline"
                  className={`rounded-lg text-[10px] ${
                    project.status === "verified"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {project.status === "verified" ? "Verified" : "Pending"}
                </Badge>
                {project.archived ? (
                  <Badge variant="outline" className="rounded-lg border-border text-[10px] text-muted-foreground">
                    Archived
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2">
              <span>{project.created_by ? `Owner: ${project.created_by}` : "No owner"}</span>
              <span>{formatDate(project.created_date)}</span>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2.5">
              <Button asChild variant="outline" size="sm" className="h-8 flex-1 gap-1.5 rounded-xl text-xs font-medium">
                <Link to={`/projects/${project.id}`}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 flex-1 gap-1.5 rounded-xl text-xs font-medium"
                disabled={busyId === project.id}
                onClick={() => toggleArchive(project)}
              >
                {busyId === project.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : project.archived ? (
                  <ArchiveRestore className="h-3.5 w-3.5" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
                {project.archived ? "Restore" : "Archive"}
              </Button>
              <ConfirmDeleteButton
                title={`Delete ${project.name}?`}
                description="The project and all of its analytics history are removed. This cannot be undone."
                pending={busyId === project.id}
                onConfirm={() => remove(project)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop / Tablet Table View */}
      <div className="hidden sm:block overflow-x-auto rounded-2xl border border-border">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead className="hidden sm:table-cell">Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id} className="hover:bg-muted/20">
                <TableCell>
                  <p className="font-medium">{project.name}</p>
                  <p className="text-xs text-muted-foreground">{project.domain}</p>
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                  {project.created_by || "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className={`rounded-lg text-[10px] ${
                        project.status === "verified"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {project.status === "verified" ? "Verified" : "Pending"}
                    </Badge>
                    {project.archived ? (
                      <Badge variant="outline" className="rounded-lg border-border text-[10px] text-muted-foreground">
                        Archived
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                  {formatDate(project.created_date)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 rounded-lg text-xs text-muted-foreground"
                      disabled={busyId === project.id}
                      onClick={() => toggleArchive(project)}
                    >
                      {busyId === project.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : project.archived ? (
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      ) : (
                        <Archive className="h-3.5 w-3.5" />
                      )}
                      {project.archived ? "Restore" : "Archive"}
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg text-xs text-muted-foreground">
                      <Link to={`/projects/${project.id}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </Link>
                    </Button>
                    <ConfirmDeleteButton
                      title={`Delete ${project.name}?`}
                      description="The project and all of its analytics history are removed. This cannot be undone."
                      pending={busyId === project.id}
                      onConfirm={() => remove(project)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
