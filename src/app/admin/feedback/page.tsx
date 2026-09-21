import type { Metadata } from "next";
import Link from "next/link";

import { Pill, type PillTone } from "@/components/admin/data-table";
import { FeedbackStatusSelect } from "@/components/admin/feedback-dialog";
import { formatCount, formatDateTime } from "@/components/admin/lib/format";
import { firstParam, hrefWith, type SearchParams } from "@/components/admin/lib/params";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import {
  FEEDBACK_PRIORITY_LABELS,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
  isFeedbackStatus,
  isSitePath,
  type AdminFeedbackRow,
  type FeedbackPriority,
  type FeedbackStatus,
} from "@/lib/email/feedback";
import { requireAdminPage } from "@/lib/supabase/admin-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Feedback" };

/**
 * /admin/feedback: every note sent with the Feedback button, newest first,
 * with its priority, who sent it and when, a link back to the screen it is
 * about, both answers and a status select (PATCH /api/admin/feedback).
 * `?status=` narrows the list; the counts on the filter come from the same
 * read. Read with the user client; RLS `is_admin()` decides
 * (supabase/migrations/0010_admin_feedback.sql).
 *
 * The newest 500 notes are read, far more than a round of testing writes.
 */

const PATH = "/admin/feedback";
const LIMIT = 500;

const PRIORITY_TONE: Record<FeedbackPriority, PillTone> = {
  blocks: "clay",
  should_change: "amber",
  nice_to_have: "muted",
};

const STATUS_CHOICES = FEEDBACK_STATUSES.map((value) => ({ value, label: FEEDBACK_STATUS_LABELS[value] }));

type Note = AdminFeedbackRow & { users: { email: string } | null };

type Props = {
  searchParams: Promise<SearchParams>;
};

async function loadNotes(): Promise<Note[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_feedback")
    .select("id, user_id, page_url, expected, happened, priority, status, created_at, updated_at, users(email)")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error) {
    console.error(`admin feedback page: ${error.message}`);
    return null;
  }
  return (data ?? []) as unknown as Note[];
}

export default async function FeedbackPage({ searchParams }: Props) {
  await requireAdminPage();
  const params = await searchParams;
  const rawStatus = firstParam(params, "status");
  const status: FeedbackStatus | null = isFeedbackStatus(rawStatus) ? rawStatus : null;

  const notes = await loadNotes();
  const counts = new Map<FeedbackStatus, number>();
  for (const note of notes ?? []) counts.set(note.status, (counts.get(note.status) ?? 0) + 1);
  const shown = (notes ?? []).filter((note) => !status || note.status === status);

  return (
    <div className="space-y-8">
      <header>
        <EyebrowSolo>Alttavia · Admin</EyebrowSolo>
        <h1 className="mt-4 font-serif text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-navy">Feedback</h1>
        <p className="mt-2 text-[0.9rem] text-navy-muted">
          Notes sent with the Feedback button in the corner, newest first.
        </p>
      </header>

      {notes === null ? (
        <p role="alert" className="rounded-lg border border-clay/30 bg-white px-5 py-4 text-[0.9rem] text-clay">
          The notes could not be loaded. Try again in a moment.
        </p>
      ) : (
        <>
          <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
            <FilterLink href={hrefWith(PATH, params, { status: null })} active={status === null}>
              All <span className="tabular-nums">{formatCount(notes.length)}</span>
            </FilterLink>
            {STATUS_CHOICES.map((choice) => (
              <FilterLink
                key={choice.value}
                href={hrefWith(PATH, params, { status: choice.value })}
                active={status === choice.value}
              >
                {choice.label} <span className="tabular-nums">{formatCount(counts.get(choice.value) ?? 0)}</span>
              </FilterLink>
            ))}
          </nav>

          {shown.length === 0 ? (
            <p className="rounded-lg border border-navy/10 bg-white px-5 py-8 text-center text-[0.9rem] text-navy-muted shadow-[var(--shadow-soft)]">
              {status ? "No notes with this status." : "No notes yet. The Feedback button in the corner sends one."}
            </p>
          ) : (
            <ol className="space-y-4">
              {shown.map((note) => (
                <li key={note.id}>
                  <NoteCard note={note} />
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

function NoteCard({ note }: { note: Note }) {
  const sentAt = formatDateTime(note.created_at);
  const sender = note.users?.email ?? "A removed account";

  return (
    <article className="rounded-lg border border-navy/10 bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Pill tone={PRIORITY_TONE[note.priority]}>{FEEDBACK_PRIORITY_LABELS[note.priority]}</Pill>
            <span className="text-[0.82rem] text-navy-muted">
              {sentAt} · {sender}
            </span>
          </div>
          <p className="mt-2.5 break-all text-[0.85rem]">
            <span className="mr-2 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-navy-muted">Screen</span>
            {!note.page_url ? (
              <span className="text-navy-muted">Not given</span>
            ) : isSitePath(note.page_url) ? (
              <Link
                href={note.page_url}
                prefetch={false}
                className="font-mono text-[0.8rem] text-navy-soft underline underline-offset-4 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                {note.page_url}
              </Link>
            ) : (
              <span className="font-mono text-[0.8rem] text-navy-soft">{note.page_url}</span>
            )}
          </p>
        </div>
        <FeedbackStatusSelect
          key={`${note.id}-${note.status}`}
          noteId={note.id}
          status={note.status}
          options={STATUS_CHOICES}
          label={`Status of the note sent ${sentAt}`}
        />
      </div>

      <dl className="mt-5 grid gap-5 sm:grid-cols-2">
        <Answer label="Expected" text={note.expected} />
        <Answer label="What happened" text={note.happened} />
      </dl>
    </article>
  );
}

function Answer({ label, text }: { label: string; text: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-navy-muted">{label}</dt>
      <dd
        className={cn(
          "mt-1.5 whitespace-pre-wrap break-words text-[0.9rem] leading-relaxed",
          text ? "text-navy" : "text-navy-muted",
        )}
      >
        {text ?? "Left empty."}
      </dd>
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-[0.82rem] font-medium transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        active ? "border-navy bg-navy text-white" : "border-navy/20 bg-white text-navy hover:border-navy/50",
      )}
    >
      {children}
    </Link>
  );
}
