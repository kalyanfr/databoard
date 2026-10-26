import { cn } from "@/lib/utils";

export default function PageHeader({ title, description, action, children, className }) {
  return (
    <header className={cn("animate-fade-up mb-4 sm:mb-6 flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between w-full min-w-0", className)}>
      <div className="flex items-start justify-between gap-3 w-full sm:w-auto min-w-0 flex-1">
        <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
          <h1 className="text-balance font-heading text-lg font-bold tracking-tight sm:text-2xl text-foreground leading-tight">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-xs sm:text-[13px] text-muted-foreground leading-relaxed break-words">
              {description}
            </p>
          ) : null}
        </div>
        {action ? (
          <div className="shrink-0 sm:hidden pt-0.5">
            {action}
          </div>
        ) : null}
      </div>

      {children || action ? (
        <div className={cn("w-full sm:w-auto items-center gap-2 shrink-0 pt-0.5 sm:pt-0", children ? "flex flex-wrap" : "hidden sm:flex")}>
          {action ? (
            <div className="hidden sm:block shrink-0">
              {action}
            </div>
          ) : null}
          {children}
        </div>
      ) : null}
    </header>
  );
}
