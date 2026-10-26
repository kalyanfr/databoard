import { cn } from "@/lib/utils";

/** One consistent glossy card frame for every dashboard section. */
export default function SectionCard({ title, description, action, children, className, contentClassName }) {
  return (
    <section className={cn("gloss-card animate-fade-up overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 w-full min-w-0 max-w-full", className)}>
      <header className="flex flex-row items-start justify-between gap-2 border-b border-border px-3.5 py-2.5 sm:px-5 sm:py-3.5 bg-muted/20 min-w-0">
        <div className="space-y-0.5 min-w-0 flex-1">
          <h2 className="font-heading text-xs sm:text-sm font-semibold tracking-tight text-foreground truncate">{title}</h2>
          {description ? <p className="text-[11px] sm:text-xs text-muted-foreground truncate sm:text-wrap">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={cn("p-3.5 sm:p-5 w-full min-w-0 max-w-full overflow-hidden", contentClassName)}>{children}</div>
    </section>
  );
}
