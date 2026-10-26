import { Link } from "react-router-dom";
import { ArrowRight, FolderKanban, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProjectFormDialog from "@/components/projects/ProjectFormDialog";

const STEPS = [
  { icon: FolderKanban, title: "Create a project", body: "Add the website domain you want to monitor." },
  { icon: Sparkles, title: "Install the 1-line script", body: "Paste the single-line snippet in your site's <head>." },
  { icon: ShieldCheck, title: "Verify & watch traffic", body: "1-click verification unlocks live analytics." },
];

export default function GettingStartedCard() {
  return (
    <div className="gloss-card animate-fade-up relative overflow-hidden rounded-3xl p-6 sm:p-10">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-[90px]" />
      <p className="relative text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Getting started</p>
      <h2 className="relative mt-3 text-balance font-heading text-2xl font-semibold tracking-tight">
        Your first dashboard is three steps away
      </h2>
      <p className="relative mt-2 max-w-xl text-sm text-muted-foreground">
        Create a project for your website, paste one script tag, and analytics start flowing immediately — no cookies,
        no fingerprinting, no personal data.
      </p>

      <ol className="relative mt-8 grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="animate-fade-up rounded-2xl border border-border bg-background/60 p-5"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
              <step.icon className="h-4 w-4" />
            </span>
            <p className="mt-4 font-heading text-sm font-semibold tracking-tight">{step.title}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="relative mt-8 flex flex-wrap gap-2">
        <ProjectFormDialog />
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/projects">
            View projects <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}