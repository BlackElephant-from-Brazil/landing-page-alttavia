import { Fragment } from "react";

/**
 * Renders the tiny emphasis dialect used across `src/content/bank-nif.ts`:
 * `**bold**` and `*italic*`. Nothing else is parsed, on purpose. The copy is
 * written by the client, so the safest renderer is the one that can only ever
 * produce a <strong> or an <em>.
 */
const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

export function RichText({ text }: { text: string }) {
  const parts = text.split(TOKEN).filter(Boolean);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-inherit">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return (
            <em key={i} className="italic">
              {part.slice(1, -1)}
            </em>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
