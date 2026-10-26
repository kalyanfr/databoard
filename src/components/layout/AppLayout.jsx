import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import BrandMark from "@/components/layout/BrandMark";
import SidebarNav from "@/components/layout/SidebarNav";
import MaintenanceBanner from "@/components/layout/MaintenanceBanner";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { useTheme } from "@/hooks/useTheme";
import { FiltersProvider } from "@/lib/filters";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export default function AppLayout({ children }) {
  const [navOpen, setNavOpen] = useState(false);
  // Keeps the stored theme applied to <html> when the visitor arrives from the
  // public landing page, which always renders in the light palette.
  useTheme();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("lume.theme");
      if (stored === "dark") {
        document.documentElement.classList.add("dark");
      } else if (stored === "light") {
        document.documentElement.classList.remove("dark");
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  return (
    <FiltersProvider>
      <div className="min-h-screen bg-background">
        {/* Ambient gloss behind the whole app. */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/4 h-[420px] w-[420px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-chart-4/10 blur-[120px]" />
        </div>

        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-sidebar-border bg-sidebar lg:block">
          <SidebarNav />
        </aside>

        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent side="left" className="w-[280px] border-sidebar-border bg-sidebar p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarNav onNavigate={() => setNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="relative min-w-0 max-w-full overflow-x-clip lg:pl-[264px]">
          <header className="glass sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border px-4 py-3 lg:hidden">
            <Button variant="ghost" size="icon" onClick={() => setNavOpen(true)} aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </Button>
            <BrandMark className="h-8 w-8" />
            <ThemeToggle />
          </header>

          <main className="mx-auto w-full min-w-0 max-w-[1280px] px-3 pb-16 pt-2 sm:px-6 sm:pt-3 md:px-8 md:pt-3">
            <MaintenanceBanner />
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </FiltersProvider>
  );
}
