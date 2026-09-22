/**
 * The one stage on which a client may still change the files they sent.
 *
 * Its own module because both sides need it: the routes in
 * src/lib/documents/confirm.ts, which decide what a slot accepts, and the
 * slot component in the browser, which decides whether to offer "Replace
 * file" and "Remove". Nothing else lives here, so the browser does not pull
 * the admin client and the bucket in with it.
 *
 * It is `service_stages.key`, seeded by supabase/migrations/0002_seed_services.sql
 * and the same on every service.
 */
export const DOCUMENTS_STAGE = "documents";
