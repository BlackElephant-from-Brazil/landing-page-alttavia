import { ArrowLeft, MessageCircle } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { applyCopy, whatsappUrl } from "@/content/apply";
import type { ExitReason, NoteId } from "@/lib/apply/types";

/**
 * Shown in place of the next question when the answers describe a case this
 * page does not sell on its own. Honest, short, and it always leaves a door
 * open: a WhatsApp message with the situation already written out.
 */
export function ExitScreen({
  exit,
  notes,
  onBack,
}: {
  exit: ExitReason;
  notes: NoteId[];
  onBack: () => void;
}) {
  const copy = applyCopy.exits[exit];
  const message = notes.includes("childrenNifs")
    ? `${copy.message} We also need NIFs for children.`
    : copy.message;

  return (
    <div>
      <h2
        tabIndex={-1}
        className="font-serif text-[clamp(1.6rem,3.3vw,2.25rem)] leading-tight text-balance text-navy outline-none"
      >
        {copy.heading}
      </h2>
      <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-navy-soft">{copy.body}</p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink
          href={whatsappUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
          size="lg"
          className="w-full sm:w-auto"
        >
          <MessageCircle className="size-4" aria-hidden />
          {copy.cta}
        </ButtonLink>
        <Button type="button" variant="outline" size="lg" onClick={onBack} className="w-full sm:w-auto">
          <ArrowLeft className="size-4" aria-hidden />
          {applyCopy.nav.back}
        </Button>
      </div>
    </div>
  );
}
