export default function EmptyState({ icon: Icon, title, description, children = null }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
      {Icon ? (
        <span className="animate-float mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-inset ring-border">
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <h3 className="font-heading text-base font-semibold tracking-tight">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {children ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{children}</div> : null}
    </div>
  );
}