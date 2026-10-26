/** The Data Board mark: analytics chart & growth arrow mark with crisp rendering across light, dark, and colored backgrounds. */
export default function BrandMark({ className = "h-9 w-9", alt = "Data Board", variant = "default" }) {
  if (variant === "badge") {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-md shadow-black/10 ring-1 ring-white/40 select-none ${className}`}>
        <img
          src="/logo-128.png"
          alt={alt}
          className="h-full w-full object-contain"
          loading="eager"
          decoding="async"
        />
      </span>
    );
  }

  if (variant === "white") {
    return (
      <span className={`relative inline-flex shrink-0 items-center justify-center select-none ${className}`}>
        <img
          src="/logo-128.png"
          alt={alt}
          className="h-full w-full object-contain brightness-0 invert drop-shadow-sm"
          loading="eager"
          decoding="async"
        />
      </span>
    );
  }

  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center select-none ${className}`}>
      <img
        src="/logo-128.png"
        alt={alt}
        className="h-full w-full object-contain"
        loading="eager"
        decoding="async"
      />
    </span>
  );
}
