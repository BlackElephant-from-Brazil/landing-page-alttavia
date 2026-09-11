/**
 * Row types for every table in supabase/migrations/0001_schema.sql, hand
 * written and kept in the database's own snake_case so a row read with
 * `select *` is the row, with no mapping layer in between.
 *
 * Nullable columns are `T | null`, never optional: a row always carries every
 * column. `jsonb` columns are typed to what the code writes into them; the
 * database does not enforce that shape, so treat them as data.
 *
 * Change the migration first, then this file.
 */

import type { Answers } from "@/lib/apply/types";

/** ISO 8601 timestamp as PostgREST returns a timestamptz. */
export type Timestamp = string;

/** public.users: the profile. auth.users is authentication only. */
export type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

/** The component a question row renders as. Contract section 6. */
export type QuestionKind =
  | "country"
  | "choice"
  | "per-person-yes-no"
  | "per-person-country"
  | "choice-by-household";

/** One radio card or select option. */
export type QuestionOption = {
  value: string;
  label: string;
  description?: string;
};

/** `options` for `choice-by-household`: one list per household size. */
export type HouseholdOptions = {
  one: QuestionOption[];
  two: QuestionOption[];
};

/** The rule grammar in `visible_when`. Contract section 6. */
export type Condition =
  | { field: keyof Answers; op: "eq" | "neq"; value: unknown }
  | { field: keyof Answers; op: "in" | "notIn"; value: unknown[] }
  | { pred: "anyNonEeaPassport" };

export type Rule = null | { all: Condition[] } | { any: Condition[] };

/** `extras` per kind. */
export type QuestionExtras = {
  childrenCheckbox?: { key: "childrenNifs"; label: string; help: string };
  personLabels?: string[];
};

/** public.questions: the initial form, in `position` order. */
export type QuestionRow = {
  id: string;
  key: string;
  answer_key: string;
  position: number;
  kind: QuestionKind;
  title: string;
  help: string | null;
  options: QuestionOption[] | HouseholdOptions;
  extras: QuestionExtras;
  visible_when: Rule;
  active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
};

/** public.user_answers: one row per question per submission, never updated. */
export type UserAnswerRow = {
  id: string;
  user_id: string;
  submission_id: string;
  question_key: string;
  answer: unknown;
  created_at: Timestamp;
};

/** public.services: what Alttavia sells. `slug` matches ProductId. */
export type ServiceRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  price_cents: number;
  currency: string;
  includes: string[];
  timeline: string | null;
  supports_quantity: boolean;
  stripe_price_id_test: string | null;
  stripe_price_id_live: string | null;
  stripe_payment_link_test: string | null;
  stripe_payment_link_live: string | null;
  position: number;
  active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
};

/** public.service_stages: a service's lifecycle, in `position` order. */
export type ServiceStageRow = {
  id: string;
  service_id: string;
  key: string;
  label: string;
  description: string | null;
  position: number;
  is_terminal: boolean;
};

/** public.service_docs: documents a service needs from the client. */
export type ServiceDocRow = {
  id: string;
  service_id: string;
  key: string;
  label: string;
  note: string | null;
  accepted_mime: string[];
  max_bytes: number;
  per_applicant: boolean;
  required: boolean;
  position: number;
};

export type DeliverableKind = "report" | "document";

/** public.service_deliverables: what the client gets back (template). */
export type ServiceDeliverableRow = {
  id: string;
  service_id: string;
  key: string;
  label: string;
  kind: DeliverableKind;
  position: number;
};

/** public.user_services: one row per service a user asked for. The order. */
export type UserServiceRow = {
  id: string;
  user_id: string;
  service_id: string;
  submission_id: string | null;
  answers_snapshot: Answers;
  quantity: number;
  joint: boolean;
  applicants: number;
  total_cents: number;
  currency: string;
  stage_key: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: Timestamp | null;
  completed_at: Timestamp | null;
  report: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

/** public.user_service_events: audit trail of stage changes. */
export type UserServiceEventRow = {
  id: string;
  user_service_id: string;
  from_stage: string | null;
  to_stage: string;
  note: string | null;
  actor_id: string | null;
  created_at: Timestamp;
};

export type DocumentStatus = "pending" | "uploaded" | "approved" | "rejected";

/** public.user_documents: one row per upload attempt. */
export type UserDocumentRow = {
  id: string;
  user_service_id: string;
  service_doc_id: string;
  applicant_index: 0 | 1;
  storage_key: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  status: DocumentStatus;
  rejection_reason: string | null;
  uploaded_at: Timestamp | null;
  reviewed_at: Timestamp | null;
  reviewed_by: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

/** public.user_service_deliverables: files and reports returned to the client. */
export type UserServiceDeliverableRow = {
  id: string;
  user_service_id: string;
  service_deliverable_id: string | null;
  label: string;
  storage_key: string | null;
  created_at: Timestamp;
};

/** public.schema_migrations: the migrate script's ledger. */
export type SchemaMigrationRow = {
  name: string;
  applied_at: Timestamp;
};
