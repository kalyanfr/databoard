import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shimmering skeleton shown while a section loads. */
export function LoadingBlock({ rows = 3, className = "" }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="gloss-card rounded-3xl p-6" style={{ animationDelay: `${index * 90}ms` }}>
          <div
            className="h-3 w-24 rounded-full animate-shimmer"
            style={{
              backgroundImage:
                "linear-gradient(90deg, hsl(var(--muted)) 0%, hsl(var(--muted-foreground)/0.25) 50%, hsl(var(--muted)) 100%)",
              backgroundSize: "180% 100%",
            }}
          />
          <div
            className="mt-4 h-7 w-40 rounded-full animate-shimmer"
            style={{
              backgroundImage:
                "linear-gradient(90deg, hsl(var(--muted)) 0%, hsl(var(--muted-foreground)/0.25) 50%, hsl(var(--muted)) 100%)",
              backgroundSize: "180% 100%",
            }}
          />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", error, onRetry }) {
  return (
    <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <span className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <p className="font-heading text-sm font-semibold">{title}</p>
      {error?.message ? <p className="mt-1 text-xs text-muted-foreground">{error.message}</p> : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4 rounded-xl" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export default LoadingBlock;