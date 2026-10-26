import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, FolderKanban } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import ConfirmDeleteButton from "@/components/common/ConfirmDeleteButton";
import EmptyState from "@/components/common/EmptyState";
import { ErrorState, LoadingBlock } from "@/components/common/LoadingBlock";
import PageHeader from "@/components/common/PageHeader";
import ProjectFormDialog from "@/components/projects/ProjectFormDialog";
import ShareDashboardDialog from "@/components/projects/ShareDashboardDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { useProjects } from "@/lib/filters";

export default function Projects() {
  const { data, isLoading, error, refetch } = useProjects();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState(null);

  const remove = async (project) => {
    setPendingId(project.id);
    try {
      const scope = { project_id: project.project_id };
      await Promise.allSettled([
        webrader.entities.Event.deleteMany(scope),
        webrader.entities.Session.deleteMany(scope),
        webrader.entities.VisitorDay.deleteMany(scope),
      ]);

      // Auto-sync: automatically delete any corresponding Uptime monitors for this project/domain
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
        await queryClient.invalidateQueries({ queryKey: ["monitors"] });
      } catch (monDelErr) {
        console.warn("[Uptime auto-sync delete error]:", monDelErr);
      }

      await webrader.entities.Project.delete(project.id);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (err) {
      console.warn("Project delete error:", err);
    } finally {
      setPendingId(null);
    }
  };

  const projects = data ?? [];

  return (
    <>
      <PageHeader
        title="Projects"
        description="Each project has its own tracking key and isolated data."
        action={<ProjectFormDialog onCreated={(project) => navigate(`/projects/${project.id}`)} />}
      />

      {isLoading ? (
        <LoadingBlock rows={2} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project to get a tracking snippet you can install anywhere."
        >
          <ProjectFormDialog />
        </EmptyState>
      ) : (
        <div className="gloss-card animate-fade-up overflow-hidden rounded-3xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Tracking key</TableHead>
                <TableHead className="hidden md:table-cell">Retention</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-medium">{project.name}</p>
                      <p className="text-xs text-muted-foreground">{project.domain}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`rounded-lg text-[11px] ${
                        project.status === "verified"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {project.status === "verified" ? "Verified" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary" className="rounded-lg text-xs font-medium">
                      {project.project_id}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {project.retention_days} days
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {formatDate(project.created_date)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <ShareDashboardDialog project={project} />
                      <Button asChild variant="ghost" size="sm" className="gap-1.5 rounded-lg">
                        <Link to={`/projects/${project.id}`}>
                          Snippet <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <ConfirmDeleteButton
                        title={`Delete “${project.name}”?`}
                        description="Every pageview, session and visitor record for this project is removed immediately. This cannot be undone."
                        pending={pendingId === project.id}
                        onConfirm={() => remove(project)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}