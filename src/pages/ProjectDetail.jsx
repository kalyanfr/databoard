import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import EmptyState from "@/components/common/EmptyState";
import { LoadingBlock } from "@/components/common/LoadingBlock";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import TrackingSnippet from "@/components/projects/TrackingSnippet";
import ShareDashboardDialog from "@/components/projects/ShareDashboardDialog";
import { Button } from "@/components/ui/button";
import { formatDate, formatNumber } from "@/lib/format";
import { setupSteps } from "@/lib/snippet";

export default function ProjectDetail() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [missing, setMissing] = useState(false);

  const load = async () => {
    try {
      const record = await webrader.entities.Project.get(projectId);
      setProject(record);
      setMissing(!record);
    } catch {
      setMissing(true);
    }
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const health = useQuery({
    queryKey: ["project-health", project?.project_id],
    enabled: !!project?.project_id,
    queryFn: async () => {
      const scope = { project_id: project.project_id };
      const [events, sessions, visitors, latest] = await Promise.all([
        webrader.entities.Event.count(scope),
        webrader.entities.Session.count(scope),
        webrader.entities.VisitorDay.count(scope),
        webrader.entities.Event.filter(scope, { sort: "-timestamp", limit: 1, fields: ["timestamp"] }),
      ]);
      return { events, sessions, visitors, lastEventAt: latest.items?.[0]?.timestamp ?? null };
    },
    refetchInterval: 5000,
  });

  if (missing) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="Project not found"
        description="It may have been deleted. Pick another project to see its snippet."
      >
        <Button asChild className="rounded-xl">
          <Link to="/projects">Back to projects</Link>
        </Button>
      </EmptyState>
    );
  }

  if (!project) return <LoadingBlock rows={3} />;

  const stats = [
    { label: "Events", value: formatNumber(health.data?.events ?? 0) },
    { label: "Sessions", value: formatNumber(health.data?.sessions ?? 0) },
    { label: "Visitor days", value: formatNumber(health.data?.visitors ?? 0) },
    { label: "Last hit", value: health.data?.lastEventAt ? `${formatDate(health.data.lastEventAt)}` : "—" },
  ];

  return (
    <>
      <PageHeader
        title={project.name}
        description={`${project.domain} · tracking key ${project.project_id}`}
        action={<ShareDashboardDialog project={project} />}
      >
        <Button asChild variant="ghost" size="sm" className="gap-1.5 rounded-xl text-muted-foreground">
          <Link to="/projects">
            <ArrowLeft className="h-3.5 w-3.5" /> All projects
          </Link>
        </Button>
      </PageHeader>

      <div className="space-y-6 pb-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div key={stat.label} className="gloss-card animate-fade-up rounded-2xl p-5" style={{ animationDelay: `${index * 70}ms` }}>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</p>
              <p className="mt-2 font-heading text-xl font-semibold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>

        <SectionCard title="Install the snippet" description="One line, pasted once, on every page you want to track.">
          <TrackingSnippet project={project} />
        </SectionCard>

        <SectionCard title="How it works" description="From paste to your first data point.">
          <ol className="space-y-3">
            {setupSteps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </>
  );
}