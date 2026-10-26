import { cn } from "@/lib/utils";

/**
 * One shell for every landing section: same container width, same vertical
 * rhythm and the same eyebrow → heading → description scale, so the whole page
 * reads as one continuous design instead of stacked blocks.
 */
export default function SectionShell({ id, eyebrow, title, description, tone = "plain", className, containerClassName, children }) {
  return (
    <section
      id={id}
      className={cn(
        "relative overflow-hidden",
        tone === "muted" && "border-y border-border bg-card/40",
        tone === "soft" && "bg-muted/30",
        className,
      )}
    >
      <div className={cn("mx-auto max-w-6xl px-5 py-20", containerClassName)}>
        {title ? (
          <div className="mx-auto max-w-2xl text-center">
            {eyebrow ? (
              <span className="glass inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
                {eyebrow}
              </span>
            ) : null}
            <h2
              className={cn(
                "text-balance font-heading text-2xl font-semibold tracking-tight sm:text-3xl",
                eyebrow ? "mt-5" : "",
              )}
            >
              {title}
            </h2>
            {description ? <p className="mt-4 text-balance text-muted-foreground">{description}</p> : null}
          </div>
        ) : null}
        <div className={cn(title ? "mt-12" : "")}>{children}</div>
      </div>
    </section>
  );
}