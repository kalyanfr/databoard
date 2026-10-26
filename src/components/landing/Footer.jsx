import { Link } from "react-router-dom";
import BrandMark from "@/components/layout/BrandMark";

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/15 bg-primary text-primary-foreground">
      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
          <div className="space-y-3.5">
            <Link to="/" className="inline-flex items-center gap-3 transition-opacity hover:opacity-90">
              <BrandMark variant="badge" className="h-9 w-9" />
              <span className="font-heading text-xl font-bold tracking-tight text-white">Data Board</span>
            </Link>
            <p className="max-w-sm text-xs leading-relaxed text-primary-foreground/80 sm:text-sm">
              Clear website analytics without the clutter. Track live visitors, conversion goals and user journeys
              without cookies or complex setup.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white">Product</h4>
            <ul className="space-y-2.5 text-xs text-primary-foreground/80 sm:text-sm">
              <li>
                <a href="#features" className="transition-colors hover:text-white">
                  Features &amp; Live stream
                </a>
              </li>
              <li>
                <Link to="/realtime" className="transition-colors hover:text-white">
                  Realtime view
                </Link>
              </li>
              <li>
                <Link to="/analytics" className="transition-colors hover:text-white">
                  Analytics breakdowns
                </Link>
              </li>
              <li>
                <Link to="/uptime" className="transition-colors hover:text-white">
                  Uptime monitoring
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white">Company</h4>
            <ul className="space-y-2.5 text-xs text-primary-foreground/80 sm:text-sm">
              <li>
                <a href="#about" className="transition-colors hover:text-white">
                  About us
                </a>
              </li>
              <li>
                <a href="#pricing" className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
                  <span>Lifetime Deal</span>
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-white">$5 ONLY</span>
                </a>
              </li>
              <li>
                <a href="#faq" className="transition-colors hover:text-white">
                  FAQ
                </a>
              </li>
              <li>
                <Link to="/support" className="transition-colors hover:text-white">
                  Support &amp; Help Desk
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-primary-foreground/15 pt-6 text-center text-xs text-primary-foreground/75 sm:flex-row sm:justify-between sm:text-left">
          <p>© {new Date().getFullYear()} Data Board. Built for the modern web.</p>
          <p className="text-primary-foreground/80">100% GDPR, CCPA &amp; PECR compliant</p>
        </div>
      </div>
    </footer>
  );
}