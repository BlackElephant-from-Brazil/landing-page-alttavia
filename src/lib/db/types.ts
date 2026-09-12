/**
 * Row types for every table in supabase/migrations/0001_schema.sql and the
 * additions of 0005_admin.sql, hand written and kept in the database's own
 * snake_case so a row read with `select *` is the row, with no mapping layer
 * in between.
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

/**
 * Who a profile is. `admin` gets past /admin/* and reads every row through
 * the `is_admin()` RLS policies (0005_admin.sql); `client` is everyone else.
 * Changed only by scripts/create-admin.mjs or by hand in SQL.
 */
export type UserRole = "client" | "admin";

/** public.users: the profile. auth.users is authentication only. */
export type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
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

export type DeliverableStatus = "pending" | "ready";

/**
 * public.user_service_deliverables: files and reports returned to the client.
 * A row is inserted `pending` when the admin asks for an upload URL and
 * flipped to `ready` once the object is confirmed in storage; the client's
 * RLS policy only shows `ready` rows.
 */
export type UserServiceDeliverableRow = {
  id: string;
  user_service_id: string;
  service_deliverable_id: string | null;
  label: string;
  storage_key: string | null;
  status: DeliverableStatus;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type NoteAudience = "client" | "internal";

/**
 * public.user_service_notes: pendencies and messages on an order. `client`
 * rows are what the dashboard shows as "Pending from you" until
 * `resolved_at` is set; `internal` rows are the firm's own notes.
 */
export type UserServiceNoteRow = {
  id: string;
  user_service_id: string;
  author_id: string | null;
  audience: NoteAudience;
  body: string;
  resolved_at: Timestamp | null;
  created_at: Timestamp;
};

/** public.schema_migrations: the migrate script's ledger. */
export type SchemaMigrationRow = {
  name: string;
  applied_at: Timestamp;
};

// ---------------------------------------------------------------------------
// Admin shapes (docs/admin-contract.md section 5), returned by
// src/lib/db/admin-queries.ts. Not tables: joins and aggregates over them.
// ---------------------------------------------------------------------------

/**
 * What an order is, from the firm's side: `open` is unpaid, `paid` is paid
 * and in progress, `completed` has `completed_at`. `all` skips the filter.
 */
export type OrderStatusFilter = "open" | "paid" | "completed" | "all";

/**
 * Filters for listOrders. `from` and `to` are ISO dates or timestamps and
 * apply to `created_at` for open orders (and for `all`) and to `paid_at` for
 * paid and completed ones. `q` matches the client's email, case
 * insensitively. `page` starts at 1; `pageSize` defaults to 25.
 */
export type OrderFilters = {
  status?: OrderStatusFilter;
  serviceSlug?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

/**
 * One row of the admin orders table: the order plus the joined counts the
 * view `admin_order_summary` (0005_admin.sql) computes in one query.
 */
export type AdminOrderRow = UserServiceRow & {
  user_email: string;
  service_name: string;
  service_slug: string;
  /** Slots the service asks for: required docs, one per applicant when per_applicant. */
  docs_required: number;
  docs_approved: number;
  /** Waiting for review. */
  docs_uploaded: number;
  /** Slots whose newest upload was rejected and not replaced yet. */
  docs_rejected: number;
  last_event_at: Timestamp | null;
  /** Client facing notes without `resolved_at`. */
  open_pendencies: number;
};

/** One answer of the wizard, already in plain English. Same shape as SummaryItem. */
export type AdminAnswerRow = {
  label: string;
  value: string;
};

/** Everything the order modal shows. */
export type AdminOrderDetail = {
  order: UserServiceRow;
  user: Pick<UserRow, "id" | "email" | "full_name" | "phone">;
  service: ServiceRow;
  stages: ServiceStageRow[];
  /** The service's document slots. */
  docs: ServiceDocRow[];
  /** Every upload attempt on the order, oldest first. */
  documents: UserDocumentRow[];
  /** Stage history, oldest first. */
  events: UserServiceEventRow[];
  /** Every note, both audiences, oldest first. */
  notes: UserServiceNoteRow[];
  deliverables: {
    /** The service's template. */
    templates: ServiceDeliverableRow[];
    /** What has been returned so far, any status. */
    files: UserServiceDeliverableRow[];
  };
  /** Empty when the order was bought from the gallery (`answers_snapshot = {}`). */
  answers: AdminAnswerRow[];
};

/**
 * A stage change with the order and client it belongs to. The overview no
 * longer lists recent events; the shape stays for anything that joins one.
 */
export type AdminEventRow = UserServiceEventRow & {
  user_email: string;
  service_name: string;
  service_slug: string;
};

/** The overview page. Ranges follow the same date columns as OrderFilters. */
export type Overview = {
  kpis: {
    /** Unpaid orders created in the range. */
    openOrders: number;
    /** Orders paid in the range, any stage. */
    paidOrders: number;
    /** Orders paid and not yet complete, whatever their date: the queue. */
    inProgressOrders: number;
    /** Orders paid in the range that are complete. */
    completedOrders: number;
    /** Sum of `total_cents` over orders paid in the range. */
    revenueCents: number;
    /** Documents with status `uploaded`, whatever their date. */
    documentsAwaitingReview: number;
    /** Client facing notes without `resolved_at`, whatever their date. */
    openPendencies: number;
  };
  /**
   * The last 6 months including the current one, oldest first, zero filled.
   * `paid` and `revenueCents` count by `paid_at`; `open` is orders created
   * in the month with `paid_at` still null.
   */
  ordersByMonth: { month: string; paid: number; open: number; revenueCents: number }[];
  /** Orders not yet complete, by their current stage, in stage order. */
  ordersByStage: { stageKey: string; label: string; count: number }[];
  /** Orders paid in the range, by service, in service order. */
  ordersByService: { slug: string; name: string; count: number; revenueCents: number }[];
};

/** Filters for listUsers. `q` matches the email, case insensitively; `page` starts at 1. */
export type UserFilters = {
  q?: string;
  page?: number;
  pageSize?: number;
};

/**
 * One row of the admin users table: the profile plus what its orders add
 * up to. `last_activity_at` is the newest of the profile's creation, the
 * orders' creation and their payments, and is the sort key.
 */
export type AdminUserRow = UserRow & {
  orders_count: number;
  paid_count: number;
  /** `created_at` of the newest order, null with none. */
  last_order_at: Timestamp | null;
  last_activity_at: Timestamp;
};

/** Everything the user modal shows. */
export type AdminUserDetail = {
  user: UserRow;
  /** The user's orders with the joined counts, newest first. */
  orders: AdminOrderRow[];
  /** Stage labels for the services those orders are on. */
  stages: Pick<ServiceStageRow, "service_id" | "key" | "label">[];
};

/** An uploaded document with the order and client it belongs to. */
export type AdminDocumentRow = UserDocumentRow & {
  user_email: string;
  service_name: string;
  service_slug: string;
  doc_key: string;
  doc_label: string;
};

/** A service with its lifecycle, documents and deliverables, for the editor. */
export type ServiceWithConfig = ServiceRow & {
  stages: ServiceStageRow[];
  docs: ServiceDocRow[];
  deliverables: ServiceDeliverableRow[];
  /** Orders ever placed on the service, any status. */
  orders_count: number;
};
