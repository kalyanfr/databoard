import { ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AdminAccessBanner({
  featureName = "Feature",
  isPreviewingComingSoon = false,
  onTogglePreview,
}) {
  return (
    <div className="mb-4 sm:mb-6 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-3.5 sm:p-4 backdrop-blur-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-foreground">
                Admin Bypass Active
              </span>
              <Badge className="rounded-md border-amber-500/40 bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                Coming Soon for Standard Users
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isPreviewingComingSoon
                ? `You are previewing what regular users see when opening ${featureName}.`
                : `Regular users are temporarily blocked by a 'Coming Soon' screen. You have full administrative access to ${featureName}.`}
            </p>
          </div>
        </div>

        {onTogglePreview && (
          <Button
            variant="outline"
            size="sm"
            onClick={onTogglePreview}
            className="h-8 gap-1.5 rounded-xl border-amber-500/40 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 shrink-0"
          >
            {isPreviewingComingSoon ? (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                <span>Exit Preview (View Live Admin)</span>
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" />
                <span>Preview User 'Coming Soon' Screen</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
