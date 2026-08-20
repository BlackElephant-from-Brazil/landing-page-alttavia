import { ScaleIcon } from "lucide-react";
import { bankNif } from "@/content/bank-nif";

/**
 * Section 1. The credential lands before any promise does, which is the first
 * filter against being compared to the volume NIF sites.
 */
export function AnnouncementBar() {
  const { announcement } = bankNif;

  return (
    <div className="relative z-50 bg-navy text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2.5 px-5 py-2.5 text-center sm:px-8">
        <ScaleIcon className="hidden size-3.5 shrink-0 text-gold-light sm:block" aria-hidden />
        <p className="text-[0.66rem] font-medium uppercase leading-relaxed tracking-[0.16em] text-white/85 sm:text-[0.72rem] sm:tracking-[0.2em]">
          {announcement.lead}
          <span className="mx-2 hidden text-gold-light sm:inline" aria-hidden>
            ·
          </span>
          <span className="block sm:inline">{announcement.press}</span>
        </p>
      </div>
    </div>
  );
}
