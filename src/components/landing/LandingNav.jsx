import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import BrandMark from "@/components/layout/BrandMark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#about", label: "What it is" },
  { href: "#data", label: "What we track" },
  { href: "#pricing", label: "Lifetime Deal ($5)" },
  { href: "#faq", label: "FAQ" },
  { href: "/support", label: "Support" },
];

export default function LandingNav() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <BrandMark className="h-8 w-8" />
          <span className="whitespace-nowrap font-heading text-lg font-semibold tracking-tight">Data Board</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground lg:flex">
          {LINKS.map((link) =>
            link.href.startsWith("/") ? (
              <Link
                key={link.href}
                to={link.href}
                className="relative transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-[2px] after:w-0 after:rounded-full after:bg-primary after:transition-all after:duration-300 hover:text-foreground hover:after:w-full"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.href}
                href={link.href}
                className="relative transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-[2px] after:w-0 after:rounded-full after:bg-primary after:transition-all after:duration-300 hover:text-foreground hover:after:w-full"
              >
                {link.label}
              </a>
            )
          )}
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <Button asChild size="sm" className="sheen rounded-xl shadow-glow">
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden min-[360px]:inline-flex rounded-xl text-xs sm:text-sm font-medium">
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild size="sm" className="sheen rounded-xl shadow-glow">
                <a href="#pricing">Get Lifetime Deal</a>
              </Button>
            </>
          )}

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label="Toggle navigation menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground lg:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="animate-fade-up border-t border-border bg-background/95 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((link) =>
              link.href.startsWith("/") ? (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </a>
              )
            )}

            {isAuthenticated ? (
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="mt-2 flex items-center justify-center rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Open dashboard
              </Link>
            ) : (
              <div className="mt-2 flex gap-2">
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="flex-1 text-center rounded-xl border border-border px-3 py-2.5 text-sm font-medium"
                >
                  Log in
                </Link>
                <a
                  href="#pricing"
                  onClick={() => setOpen(false)}
                  className="flex-1 text-center rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  Lifetime Deal ($5)
                </a>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
