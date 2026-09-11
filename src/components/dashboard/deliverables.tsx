import { Download, FileText } from "lucide-react";

import { RichText } from "@/components/bank/rich-text";
import type { UserServiceDeliverableRow } from "@/lib/db/types";
import { formatBytes } from "@/lib/r2/keys";

import { formatDate, reportParagraphs } from "./order-status";

/**
 * "Your documents from us": the files the firm returned on this order, each
 * a link to /api/deliverables/[id] (a 302 to a two minute presigned URL),
 * and the final report once the order is completed.
 *
 * Only `ready` rows reach this component (client-queries.ts filters, and so
 * does RLS). The report is the order's `report` column, written by staff in
 * the emphasis dialect <RichText /> renders, split into paragraphs on blank
 * lines. Nothing renders when there is neither a file nor a report.
 */
export function Deliverables({
  files,
  report,
  completed,
}: {
  files: readonly UserServiceDeliverableRow[];
  report: string | null;
  completed: boolean;
}) {
  const paragraphs = completed ? reportParagraphs(report) : [];
  if (files.length === 0 && paragraphs.length === 0) return null;

  return (
    <section aria-labelledby="deliverables-heading">
      <h2 id="deliverables-heading" className="text-xs uppercase tracking-wider text-navy-muted">
        Your documents from us
      </h2>

      {files.length > 0 && (
        <ul className="mt-4 divide-y divide-navy/10 rounded-lg border border-navy/10 bg-white shadow-[var(--shadow-soft)]">
          {files.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
              <FileText className="size-4 shrink-0 text-gold-dark" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug text-navy">{file.label}</p>
                <p className="mt-0.5 truncate text-[0.8rem] text-navy-muted">
                  {[file.file_name, file.size_bytes ? formatBytes(file.size_bytes) : null, formatDate(file.updated_at)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <a
                href={`/api/deliverables/${file.id}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Download ${file.label}`}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-navy/20 px-4 text-sm font-medium text-navy transition-colors duration-200 hover:border-navy hover:bg-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                <Download className="size-4" aria-hidden />
                Download
              </a>
            </li>
          ))}
        </ul>
      )}

      {paragraphs.length > 0 && (
        <article
          aria-labelledby="report-heading"
          className="mt-6 rounded-lg border border-navy/10 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8"
        >
          <h3 id="report-heading" className="font-serif text-xl text-navy">
            Closing report
          </h3>
          <div className="mt-4 space-y-4 text-[0.95rem] leading-relaxed text-navy-soft">
            {paragraphs.map((paragraph, i) => (
              <p key={i} className="whitespace-pre-line">
                <RichText text={paragraph} />
              </p>
            ))}
          </div>
        </article>
      )}
    </section>
  );
}
