import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyCopy } from "@/content/apply";

/**
 * Back and Continue. Continue is a submit button so Enter advances the form.
 *
 * On phones the pair is pinned to the bottom of the screen, reusing the shell
 * of the landing's sticky CTA (border, blur, safe area inset). The page wrapper
 * reserves space for it with bottom padding, so nothing is ever covered.
 */
export function WizardNav({
  canGoBack,
  canContinue,
  continueLabel = applyCopy.nav.next,
  onBack,
}: {
  canGoBack: boolean;
  canContinue: boolean;
  continueLabel?: string;
  onBack: () => void;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/10 bg-white/95 backdrop-blur-xl lg:static lg:mt-10 lg:border-0 lg:bg-transparent lg:backdrop-blur-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 lg:px-0 lg:py-0">
        {canGoBack ? (
          <Button type="button" variant="outline" size="lg" onClick={onBack} className="shrink-0">
            <ArrowLeft className="size-4" aria-hidden />
            {applyCopy.nav.back}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg" disabled={!canContinue} className="min-w-[11rem] flex-1 sm:flex-none">
          {continueLabel}
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
