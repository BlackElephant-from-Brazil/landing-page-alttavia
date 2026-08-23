import { useEffect, useRef } from "react";
import { RichText } from "@/components/bank/rich-text";

/**
 * One screen of the wizard: a fieldset whose legend is the question. The
 * heading takes focus when the screen mounts so screen readers announce the
 * new question and keyboard users start at the top, without an aria-live
 * region reading it a second time.
 */
export function StepFrame({
  heading,
  help,
  children,
}: {
  heading: string;
  help?: string;
  children: React.ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="contents">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-serif text-[clamp(1.6rem,3.3vw,2.25rem)] leading-tight text-balance text-navy outline-none"
        >
          {heading}
        </h2>
      </legend>
      {help && (
        <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-navy-soft">
          <RichText text={help} />
        </p>
      )}
      <div className="mt-8">{children}</div>
    </fieldset>
  );
}
