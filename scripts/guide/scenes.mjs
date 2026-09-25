/**
 * Every screenshot the user guide needs, as data. scripts/guide/capture.mjs
 * runs them; the chapters in docs/guia/capitulos/ show them as
 * <img src="prints/<id>.png">.
 *
 * A scene:
 *   id         file name and the id the chapters use
 *   role       "client" or "admin": which side of the platform, and so which
 *              part of the guide
 *   session    who is signed in: "none", "admin" (the support admin, see
 *              session.mjs), "admin-password-only" (password, no second
 *              factor yet) or a fixture key below (a demo client)
 *   path       a URL path on the dev server, or (fx) => path when it needs
 *              an id from the demo data (fx.order("margaret"), fx.user(...),
 *              fx.service("nif-only"), fx.terminalLabel("nif-only")).
 *              before, ready, scroll and highlight may be (fx) => value too
 *   email      instead of a path: { template, input, to, attachment? }, an
 *              email of src/lib/email/templates.ts rendered with sample
 *              input inside a plain mail window (emails.mjs). Nothing is sent
 *   viewport   "desktop" (1440 x 900), "phone" (390 x 844, iPhone agent) or
 *              { width, height, deviceScaleFactor, mobile }
 *   storage    { session: { key: value } } written into sessionStorage
 *              before the page's own scripts run (the wizard's answers)
 *   before     steps run after the page loads, in order:
 *                { click: target, expect?: target }  click; retried until
 *                                                     `expect` shows (the page
 *                                                     may still be hydrating)
 *                { set: target, value }               type into a field
 *                { drag: target, to: target, expect? } drag and drop (the
 *                                                     orders board)
 *                { waitFor: target }                  wait until it shows
 *                { scroll: target, block? }           scroll it into view
 *                { wait: ms }
 *   ready      what must be on screen before anything else (default: the
 *              first highlight)
 *   scroll     what to scroll into view before the shot (default: the first
 *              highlight; false for none)
 *   highlight  [{ target, arrow?: "left"|"right"|"top"|"bottom", label? }]:
 *              red rectangle, arrow, numbered badge (annotate.mjs). The
 *              label is the number of the chapter's step the mark shows
 *              (docs/guia/capitulos/00: a circle matches the step with the
 *              same number), so it may skip numbers ("2", "4"); a mark
 *              with no step gets no label, only its rectangle
 *   mask       extra targets to blur. Email addresses are always blurred,
 *              except on the demo, example and firm domains (KEEP_DOMAINS)
 *   shot       "viewport" (default), "full", or { clip: target(s), pad }
 *   keepFocus  true to leave the focused field focused (default: blurred)
 *   pending    a note: the screen is being built. The capture checks for it
 *              and takes the print once it exists, else skips with the note
 *   caption    what the print shows, in Portuguese, for the chapter writers
 *   out        where the PNG goes (docs/guia/prints/<id>.png)
 *
 * Targets are the ones annotate.mjs resolves: a CSS selector, or
 * { css, text, label, within, closest, nth }. Screen labels are matched by
 * their English text, as the screens show them.
 *
 * Nothing here writes: capture.mjs blocks every request to the dev server
 * that is not a GET, so a stray click cannot approve, move or delete.
 */

import { DEMO_DOMAIN } from "./session.mjs";

/** Email domains left readable in the prints. Every other address is blurred. */
export const KEEP_DOMAINS = [DEMO_DOMAIN, "example.com", "alttavia-relocation.com", "vianaconsultancy.com", "adv.oa.pt"];

/**
 * The demo accounts of `npm run demo:history -- --apply` (scripts/seed-history.mjs),
 * the same names as the founder's checklist. `service` picks the order.
 */
export const PEOPLE = {
  margaret: { email: `margaret.hill@${DEMO_DOMAIN}`, service: "bundle", note: "NIF + Bank Account, documents stage, 7 files to review" },
  thomas: { email: `thomas.reed@${DEMO_DOMAIN}`, service: "bank-only", note: "Bank Account only, documents, 2 empty slots" },
  priya: { email: `priya.nair@${DEMO_DOMAIN}`, service: "nif-only", note: "NIF only, NIF ready, nothing returned yet" },
  daniel: { email: `daniel.okafor@${DEMO_DOMAIN}`, service: "couple", note: "Couple package, two applicants" },
  hannah: { email: `hannah.brooks@${DEMO_DOMAIN}`, service: "bundle", note: "NIF + Bank Account, completed with deliverables and report" },
  lucas: { email: `lucas.ferreira@${DEMO_DOMAIN}`, service: "nif-only", note: "NIF only, awaiting payment" },
  oliver: { email: `oliver.grant@${DEMO_DOMAIN}`, service: null, note: "an account with no order" },
  emma: { email: `emma.larsen@${DEMO_DOMAIN}`, service: "bank-only", note: "Bank Account only, with the bank" },
};

/**
 * Ids from the database, read with the service role client, so no scene
 * hardcodes one. Answers an object with order(key), user(key), service(slug)
 * that throw a plain message when the demo data is missing.
 */
export async function loadFixtures(admin) {
  const emails = Object.values(PEOPLE).map((p) => p.email);
  const { data: users, error: usersError } = await admin.from("users").select("id, email").in("email", emails);
  if (usersError) throw new Error(`users: ${usersError.message}`);
  const { data: services, error: servicesError } = await admin.from("services").select("id, slug");
  if (servicesError) throw new Error(`services: ${servicesError.message}`);
  const { data: stages, error: stagesError } = await admin.from("service_stages").select("service_id, key, label, is_terminal");
  if (stagesError) throw new Error(`service_stages: ${stagesError.message}`);
  const serviceSlug = new Map((services ?? []).map((s) => [s.id, s.slug]));
  const userIds = (users ?? []).map((u) => u.id);
  let orders = [];
  if (userIds.length) {
    const { data, error } = await admin
      .from("user_services")
      .select("id, user_id, service_id, stage_key, created_at")
      .in("user_id", userIds)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`user_services: ${error.message}`);
    orders = data ?? [];
  }

  const byKey = { users: {}, orders: {}, services: Object.fromEntries((services ?? []).map((s) => [s.slug, s.id])) };
  for (const [key, person] of Object.entries(PEOPLE)) {
    const user = (users ?? []).find((u) => u.email.toLowerCase() === person.email);
    if (!user) continue;
    byKey.users[key] = user.id;
    const own = orders.filter((o) => o.user_id === user.id);
    const match = person.service ? own.find((o) => serviceSlug.get(o.service_id) === person.service) : null;
    if (match ?? own[0]) byKey.orders[key] = (match ?? own[0]).id;
  }

  const missing = (what) => new Error(`${what} is not in the database. Run: npm run demo:history -- --apply`);
  return {
    ...byKey,
    order(key) {
      if (!byKey.orders[key]) throw missing(`The demo order of ${PEOPLE[key]?.email ?? key}`);
      return byKey.orders[key];
    },
    user(key) {
      if (!byKey.users[key]) throw missing(`The demo account ${PEOPLE[key]?.email ?? key}`);
      return byKey.users[key];
    },
    service(slug) {
      if (!byKey.services[slug]) throw new Error(`No service with the short code ${slug}`);
      return byKey.services[slug];
    },
    /** The label of a service's last stage, as the orders board titles its column. */
    terminalLabel(slug) {
      const stage = (stages ?? []).find((row) => row.service_id === byKey.services[slug] && row.is_terminal);
      if (!stage) throw new Error(`The service ${slug} has no final stage`);
      return stage.label;
    },
  };
}

// ---------------------------------------------------------------------------
// Targets used by several scenes
// ---------------------------------------------------------------------------

const DIALOG = "dialog[open]";
const inDialog = (spec) => ({ ...(typeof spec === "string" ? { css: spec } : spec), within: DIALOG });
const section = (id) => `section[aria-labelledby='${id}']`;

// Client order modal (src/components/dashboard/order-view.tsx)
const CLIENT_DOCS = inDialog(section("documents-heading"));
const clientSlot = (text) => ({ css: "li", text, within: CLIENT_DOCS });

// Admin order modal (src/components/admin/order-modal.tsx)
const ADMIN_DOCS = inDialog(section("order-documents-heading"));
const ADMIN_STAGE = inDialog(section("order-stage-heading"));
const ADMIN_AGREEMENT = inDialog(section("order-agreement-heading"));
const ADMIN_DELIVERABLES = inDialog(section("order-deliverables-heading"));
const ADMIN_REPORT = inDialog(section("order-report-heading"));
const ADMIN_HISTORY = inDialog(section("order-events-heading"));
const DEED_DETAILS = { css: "h4", text: "Details for the deeds", within: DIALOG, closest: "div" };

const IN_PROGRESS = "ul[aria-label='In progress']";
const KANBAN_CONFIRM = { css: "[role=alertdialog]", text: "This marks the order complete" };
/** The details dialog of the agreement: the innermost open dialog holding its button. */
const AGREEMENT_FORM = { css: "dialog[open]", text: "Confirm and open my agreement" };
const SUBMIT_CONTINUE = { css: "button[type=submit]", text: "Continue" };

/** The wizard's answers, as src/lib/apply/storage.ts keeps them. */
const ANSWERS_KEY = "alttavia_apply_v1";
const CHECKOUT_KEY = "alttavia_apply_checkout_v1";
const NIF_ONLY_ANSWERS = { residence: "US", applicants: "one", hasNif: [false], bank: "none", passport: ["US"] };

const ordersDemo = "/admin/orders?q=demo.alttavia.invalid";
const usersDemo = "/admin/users?q=demo.alttavia.invalid";

const out = (id) => `docs/guia/prints/${id}.png`;

// Sample values for the emails. The order reference is made up.
const SITE = "https://bank-nif-portugal.alttavia-relocation.com";
const SAMPLE_ORDER = "5f1c2a7e-8d34-4b6a-9e21-3c7d0b4a6f18";
const CLIENT_TO = `margaret.hill@${DEMO_DOMAIN}`;
const TEAM_TO = "info@alttavia-relocation.com";
const EMAIL_SHOT = { clip: "#email", pad: 24 };
/** Tall enough for the longest email, so the clip never meets the bottom of the window. */
const EMAIL_VIEWPORT = { width: 1000, height: 1700, deviceScaleFactor: 1, mobile: false };

// ---------------------------------------------------------------------------
// The scenes
// ---------------------------------------------------------------------------

const SCENES = [
  // --- The site and the application form (client, signed out) --------------
  {
    id: "landing",
    role: "client",
    session: "none",
    path: "/en",
    caption: "A página inicial do site, com os botões Start my application e Log in no topo.",
    highlight: [
      { target: { css: "header a", text: "Start my application" }, arrow: "bottom", label: "1" },
      { target: "header a[href*='login']", arrow: "bottom", label: "2" },
    ],
    scroll: false,
  },
  {
    id: "apply-residence",
    role: "client",
    session: "none",
    path: "/en/apply?step=1",
    storage: { session: { [ANSWERS_KEY]: { residence: "US" } } },
    caption: "Primeira pergunta do formulário: o país do comprovativo de morada.",
    highlight: [
      { target: "select", arrow: "right", label: "1" },
      { target: SUBMIT_CONTINUE, label: "2" },
    ],
    scroll: false,
  },
  {
    id: "apply-who",
    role: "client",
    session: "none",
    path: "/en/apply?step=2",
    storage: { session: { [ANSWERS_KEY]: { residence: "US", applicants: "one" } } },
    caption: "Segunda pergunta: quem se candidata. Cada resposta é um cartão.",
    highlight: [
      { target: { css: "label", text: "Just me" }, arrow: "left", label: "1" },
      { target: SUBMIT_CONTINUE, label: "2" },
    ],
    scroll: false,
  },
  {
    id: "apply-nif",
    role: "client",
    session: "none",
    path: "/en/apply?step=3",
    storage: { session: { [ANSWERS_KEY]: { residence: "US", applicants: "one", hasNif: [false] } } },
    caption: "Terceira pergunta: se a pessoa já tem NIF.",
    highlight: [
      { target: { css: "label", text: "Not yet" }, arrow: "left", label: "1" },
      { target: SUBMIT_CONTINUE, label: "2" },
    ],
    scroll: false,
  },
  {
    id: "apply-result",
    role: "client",
    session: "none",
    path: "/en/apply?step=6",
    storage: { session: { [ANSWERS_KEY]: NIF_ONLY_ANSWERS } },
    caption: "O resultado: o serviço recomendado, o preço e o botão para continuar.",
    highlight: [{ target: { css: "button, a", text: "Continue ·" }, arrow: "left", label: "1" }],
    scroll: false,
  },
  {
    id: "apply-email",
    role: "client",
    session: "none",
    path: "/en/apply?step=email",
    storage: { session: { [ANSWERS_KEY]: NIF_ONLY_ANSWERS, [CHECKOUT_KEY]: { product: "nif-only" } } },
    ready: "input[name=email]",
    before: [
      { set: "input[name=given-name]", value: "Ana" },
      { set: "input[name=email]", value: "ana@example.com" },
    ],
    caption: "Criar a conta: primeiro nome e e-mail. O código de 6 dígitos chega por e-mail.",
    highlight: [
      { target: "input[name=given-name]", arrow: "left", label: "1" },
      { target: "input[name=email]", arrow: "left", label: "2" },
      { target: "button[type=submit]", label: "3" },
    ],
  },
  {
    id: "client-login",
    role: "client",
    session: "none",
    path: "/en/login",
    caption: "Entrada do cliente: só o e-mail, e depois o código que chega por e-mail.",
    highlight: [
      { target: "input[name=email]", arrow: "left", label: "1" },
      { target: "button[type=submit]", label: "2" },
    ],
  },

  // --- The client area (client, signed in) -------------------------------
  {
    id: "dashboard-welcome",
    role: "client",
    session: "lucas",
    path: "/en/dashboard",
    caption: "A área do cliente antes do primeiro pagamento: Welcome. e o cartão do pedido com o botão de pagar.",
    highlight: [
      { target: { css: "article", within: IN_PROGRESS } },
      { target: { css: "button", text: "Pay", within: IN_PROGRESS }, arrow: "right", label: "1" },
    ],
  },
  {
    id: "dashboard-in-progress",
    role: "client",
    session: "margaret",
    path: "/en/dashboard",
    caption: "Um pedido pago em curso: a barra de etapas, os documentos recebidos e See more.",
    highlight: [
      { target: { css: "article", within: IN_PROGRESS }, label: "1" },
      { target: { css: "a", label: "See more about", within: IN_PROGRESS }, arrow: "right", label: "2" },
    ],
  },
  {
    id: "order-payment-received",
    role: "client",
    session: "margaret",
    path: (fx) => `/en/dashboard?order=${fx.order("margaret")}`,
    ready: DIALOG,
    scroll: { target: inDialog("li[aria-current='step']"), block: "start" },
    caption: "Os detalhes do pedido depois do pagamento: a etapa atual e a mensagem Payment received.",
    highlight: [
      { target: inDialog("li[aria-current='step']"), arrow: "left", label: "1" },
      { target: inDialog({ css: "[role=status]", text: "Payment received" }), arrow: "left", label: "2" },
    ],
  },
  {
    id: "order-agreement",
    role: "client",
    session: "margaret",
    path: (fx) => `/en/dashboard?order=${fx.order("margaret")}`,
    ready: DIALOG,
    caption: "O cartão Your service agreement, com View e Download.",
    highlight: [
      { target: inDialog({ css: "section", text: "Your service agreement" }), label: "1" },
      { target: { css: "a, button", text: "Download", within: inDialog({ css: "section", text: "Your service agreement" }) }, arrow: "right", label: "2" },
    ],
  },
  {
    id: "order-agreement-details",
    role: "client",
    session: "daniel",
    path: (fx) => `/en/dashboard?order=${fx.order("daniel")}`,
    ready: { css: "button", text: "Confirm my details", within: DIALOG },
    before: [{ click: { css: "button", text: "Confirm my details", within: DIALOG }, expect: AGREEMENT_FORM }],
    pending:
      "Needs a demo order that waits for its agreement: the Couple package (daniel.okafor@) once its contract is set on 2026-09-25. Every other demo order already has one.",
    caption: "Os dados do passaporte que entram no contrato e nas procurações (passos 1 e 2), e Confirm and open my agreement (passo 3).",
    highlight: [
      { target: AGREEMENT_FORM, label: "1" },
      { target: { css: "button", text: "Confirm and open my agreement" }, arrow: "left", label: "3" },
    ],
    scroll: false,
  },
  {
    id: "order-documents",
    role: "client",
    session: "margaret",
    path: (fx) => `/en/dashboard?order=${fx.order("margaret")}`,
    ready: CLIENT_DOCS,
    scroll: { target: inDialog("#documents-heading"), block: "start" },
    caption: "A lista de documentos a enviar, com o contador de recebidos.",
    highlight: [
      { target: inDialog("#documents-heading"), arrow: "left", label: "1" },
      { target: { css: "li", within: CLIENT_DOCS }, label: "2" },
    ],
  },
  {
    id: "order-deed-slot",
    role: "client",
    session: "margaret",
    path: (fx) => `/en/dashboard?order=${fx.order("margaret")}`,
    ready: CLIENT_DOCS,
    caption: "Uma procuração (o quadro, sem número): Download to sign (passo 1) abre o PDF já preenchido; a linha sobre a assinatura (passo 2).",
    highlight: [
      { target: clientSlot("Download to sign") },
      { target: { css: "button", text: "Download to sign", within: CLIENT_DOCS }, arrow: "right", label: "1" },
      { target: { css: "p", text: "Sign exactly as you signed your passport", within: CLIENT_DOCS }, label: "2" },
    ],
  },
  {
    id: "order-replace-remove",
    role: "client",
    session: "margaret",
    path: (fx) => `/en/dashboard?order=${fx.order("margaret")}`,
    ready: CLIENT_DOCS,
    caption: "Um arquivo enviado e ainda por rever: Replace file troca, Remove apaga.",
    highlight: [
      { target: { css: "button", text: "Replace file", within: CLIENT_DOCS }, arrow: "left", label: "1" },
      { target: { css: "button", text: "Remove", exact: true, within: clientSlot("Replace file") }, arrow: "right", label: "2" },
    ],
  },
  {
    id: "order-signed-agreement",
    role: "client",
    session: "margaret",
    path: (fx) => `/en/dashboard?order=${fx.order("margaret")}`,
    ready: CLIENT_DOCS,
    pending: "Being built on 2026-09-25: the Signed service agreement slot in the documents list.",
    caption: "O quadro Signed service agreement: o contrato assinado à mão é enviado aqui.",
    highlight: [{ target: clientSlot("Signed service agreement"), arrow: "left", label: "1" }],
  },
  {
    id: "order-pay-acceptance",
    role: "client",
    session: "lucas",
    path: (fx) => `/en/dashboard?order=${fx.order("lucas")}`,
    ready: DIALOG,
    pending: "Being built on 2026-09-25: the line under Pay, By paying you accept the service terms and your service agreement.",
    caption: "Antes de pagar: a frase sob o botão diz que pagar aceita os termos e o contrato.",
    highlight: [
      { target: inDialog({ css: "button", text: "Pay" }), label: "1" },
      { target: inDialog({ css: "p", text: "By paying you accept" }), arrow: "bottom", label: "2" },
    ],
  },
  {
    id: "order-completed",
    role: "client",
    session: "hannah",
    path: (fx) => `/en/dashboard?order=${fx.order("hannah")}`,
    ready: DIALOG,
    scroll: { target: inDialog(section("deliverables-heading")), block: "start" },
    caption: "Um pedido concluído: os documentos entregues pela equipa e o relatório final.",
    highlight: [
      { target: inDialog(section("deliverables-heading")), label: "1" },
      { target: inDialog("[aria-labelledby='report-heading']"), label: "2" },
    ],
  },
  {
    id: "services-gallery",
    role: "client",
    session: "margaret",
    path: "/en/dashboard/services",
    caption: "A página Services: cada serviço com See details e Buy.",
    highlight: [
      { target: { css: "a, button", label: "See details of" }, arrow: "bottom", label: "1" },
      { target: { css: "a, button", label: "Buy " }, arrow: "bottom", label: "2" },
    ],
  },
  {
    id: "purchase-drawer",
    role: "client",
    session: "margaret",
    path: "/en/dashboard/services",
    before: [{ click: { css: "a, button", label: "See details of" }, expect: DIALOG }],
    ready: DIALOG,
    caption: "O painel lateral de um serviço: Confirm purchase (passo 2) e, sem número, a frase dos termos por baixo.",
    highlight: [
      { target: inDialog({ css: "button", text: "Confirm purchase" }), arrow: "left", label: "2" },
      { target: inDialog({ css: "p", text: "you accept" }) },
    ],
  },
  {
    id: "my-purchases",
    role: "client",
    session: "margaret",
    path: "/en/dashboard/purchases",
    caption: "My purchases: todos os pedidos da conta, com Open para ver os detalhes.",
    highlight: [
      { target: "table", label: "1" },
      { target: { css: "a, button", label: "Open " }, arrow: "left", label: "2" },
    ],
  },

  // --- Admin: signing in ---------------------------------------------------
  {
    id: "admin-login",
    role: "admin",
    session: "none",
    path: "/admin/login",
    caption: "A entrada no painel: e-mail, senha e Sign in. Forgot your password? recupera a senha.",
    highlight: [
      { target: "input[type=email]", arrow: "left", label: "1" },
      { target: "input[type=password]", arrow: "left", label: "2" },
      { target: { css: "button[type=submit]", text: "Sign in" }, label: "3" },
      { target: { css: "button", text: "Forgot your password?" }, arrow: "right", label: "4" },
    ],
  },
  {
    id: "admin-forgot-password",
    role: "admin",
    session: "none",
    path: "/admin/login",
    before: [{ click: { css: "button", text: "Forgot your password?" }, expect: { css: "h2", text: "Reset your password" } }],
    caption: "Recuperar a senha: o e-mail e Send the code. Chega um código de 6 dígitos.",
    highlight: [
      { target: "input[type=email]", arrow: "left", label: "1" },
      { target: { css: "button[type=submit]", text: "Send the code" }, label: "2" },
    ],
  },
  {
    id: "admin-login-code",
    role: "admin",
    session: "admin-password-only",
    path: "/admin/login",
    pending:
      "Being built on 2026-09-25: the authenticator code asked after the password. Needs the support admin to have its own authenticator (node scripts/admin-totp.mjs) and ADMIN_SUPPORT_TOTP_SECRET in .env.local, so take it after admin-settings-second-factor, which needs the opposite.",
    caption: "O segundo passo da entrada: o código de 6 dígitos da aplicação autenticadora.",
    highlight: [
      { target: "input[autocomplete='one-time-code']", arrow: "left", label: "1" },
      { target: "button[type=submit]", label: "2" },
    ],
  },

  // --- Admin: Overview -----------------------------------------------------
  {
    id: "admin-overview",
    role: "admin",
    session: "admin",
    path: "/admin?range=year",
    caption: "Overview: os seis números do período e os gráficos.",
    highlight: [
      { target: section("kpi-heading"), label: "1" },
      { target: section("charts-heading"), label: "2" },
    ],
    scroll: false,
  },
  {
    id: "admin-overview-range",
    role: "admin",
    session: "admin",
    path: "/admin?range=year",
    caption: "Os períodos do Overview: os atalhos e as datas From e To.",
    highlight: [
      { target: "nav[aria-label='Range']", arrow: "bottom", label: "1" },
      { target: "form[aria-label='Custom dates']", arrow: "bottom", label: "2" },
    ],
    scroll: false,
  },
  {
    id: "admin-overview-review",
    role: "admin",
    session: "admin",
    path: "/admin?range=year",
    scroll: { target: section("progress-heading"), block: "start" },
    caption: "As tabelas In progress e Awaiting review: um clique na linha abre o pedido.",
    highlight: [
      { target: section("progress-heading"), label: "1" },
      { target: section("review-heading"), label: "2" },
    ],
  },

  // --- Admin: Orders -------------------------------------------------------
  {
    id: "admin-orders-kanban",
    role: "admin",
    session: "admin",
    path: ordersDemo,
    caption: "Orders em quadro Kanban: uma coluna por etapa, cada cartão é um pedido.",
    highlight: [
      { target: "nav[aria-label='Order views']", arrow: "left", label: "1" },
      { target: { css: "article", text: "margaret.hill@" }, arrow: "bottom", label: "2" },
    ],
    scroll: false,
  },
  {
    id: "admin-orders-kanban-confirm",
    role: "admin",
    session: "admin",
    path: ordersDemo,
    ready: { css: "article", text: "priya.nair@" },
    before: (fx) => [
      // Priya's NIF only order dropped on its last column: the board asks first, nothing moves.
      { drag: { css: "article", text: "priya.nair@" }, to: `section[aria-label^="${fx.terminalLabel("nif-only")},"]`, expect: KANBAN_CONFIRM },
      { scroll: `section[aria-label^="${fx.terminalLabel("nif-only")},"]`, block: "nearest" },
    ],
    scroll: false,
    shot: "full",
    caption: "Largar um cartão na última etapa (passo 2): o quadro pergunta antes de concluir (passo 3).",
    highlight: (fx) => [
      { target: `section[aria-label^="${fx.terminalLabel("nif-only")},"] header`, arrow: "top", label: "2" },
      { target: KANBAN_CONFIRM, arrow: "left", label: "3" },
    ],
  },
  {
    id: "admin-orders-table",
    role: "admin",
    session: "admin",
    path: `${ordersDemo}&view=table`,
    caption: "Orders em tabela, com os filtros Status, Service, Email e Range.",
    highlight: [
      { target: "form[aria-label='Filters']", label: "1" },
      { target: "nav[aria-label='Order views']", arrow: "left", label: "2" },
    ],
    scroll: false,
  },
  {
    id: "admin-order-documents",
    role: "admin",
    session: "admin",
    path: (fx) => `/admin/orders?order=${fx.order("margaret")}`,
    ready: ADMIN_DOCS,
    scroll: { target: ADMIN_DOCS, block: "start" },
    caption: "Os documentos de um pedido: View abre numa aba nova, Download guarda no computador.",
    highlight: [
      { target: { css: "a", label: "View ", within: ADMIN_DOCS }, arrow: "left", label: "1" },
      { target: { css: "a[aria-label^='Download ']:not([aria-label^='Download deed'])", within: ADMIN_DOCS }, arrow: "right", label: "2" },
    ],
  },
  {
    id: "admin-order-review",
    role: "admin",
    session: "admin",
    path: (fx) => `/admin/orders?order=${fx.order("margaret")}`,
    ready: ADMIN_DOCS,
    scroll: { target: ADMIN_DOCS, block: "start" },
    caption: "Rever um arquivo: Approve aceita, Reject pede um motivo.",
    highlight: [
      { target: { css: "button", text: "Approve", within: ADMIN_DOCS }, arrow: "left", label: "1" },
      { target: { css: "button", text: "Reject", within: ADMIN_DOCS }, arrow: "right", label: "2" },
    ],
  },
  {
    id: "admin-order-reject-reason",
    role: "admin",
    session: "admin",
    path: (fx) => `/admin/orders?order=${fx.order("margaret")}`,
    ready: ADMIN_DOCS,
    before: [
      { click: { css: "button", text: "Reject", within: ADMIN_DOCS }, expect: { css: "textarea", within: ADMIN_DOCS } },
      { set: { css: "textarea", within: ADMIN_DOCS }, value: "The scan is too dark to read. Upload a clear copy of the full page." },
    ],
    caption: "O motivo da rejeição: a cliente lê este texto tal como está, no painel e por e-mail.",
    highlight: [
      { target: { css: "textarea", within: ADMIN_DOCS }, arrow: "left", label: "1" },
      { target: { css: "button", text: "Reject and notify", within: ADMIN_DOCS }, arrow: "right", label: "2" },
    ],
  },
  {
    id: "admin-order-stage-held",
    role: "admin",
    session: "admin",
    path: (fx) => `/admin/orders?order=${fx.order("margaret")}`,
    ready: ADMIN_STAGE,
    caption: "As etapas: Forward (1) fica desativado enquanto houver documentos por aprovar, com a frase que diz porquê (sem número); Back (2); Jump to (3).",
    highlight: [
      { target: { css: "button", text: "Forward", within: ADMIN_STAGE }, arrow: "top", label: "1" },
      { target: { css: "p", text: "Approve every required document", within: ADMIN_STAGE } },
      { target: { css: "button", text: "Back", exact: true, within: ADMIN_STAGE }, arrow: "top", label: "2" },
      { target: { css: "label", text: "Jump to", within: ADMIN_STAGE }, label: "3" },
    ],
  },
  {
    id: "admin-order-signed-agreement",
    role: "admin",
    session: "admin",
    path: (fx) => `/admin/orders?order=${fx.order("margaret")}`,
    ready: ADMIN_DOCS,
    pending: "Being built on 2026-09-25: the Signed service agreement slot, reviewed like any other document.",
    caption: "O contrato assinado pelo cliente, revisto como qualquer outro documento.",
    highlight: [{ target: { css: "li", text: "Signed service agreement", within: ADMIN_DOCS }, arrow: "left", label: "1" }],
  },
  {
    id: "admin-order-deeds",
    role: "admin",
    session: "admin",
    path: (fx) => `/admin/orders?order=${fx.order("margaret")}`,
    ready: ADMIN_DOCS,
    caption: "As procurações: Download deed gera o PDF com os dados que a cliente confirmou.",
    highlight: [
      { target: { css: "a, button", text: "Download deed", within: ADMIN_DOCS }, arrow: "left", label: "1" },
      { target: DEED_DETAILS, label: "2" },
    ],
  },
  {
    id: "admin-order-agreement",
    role: "admin",
    session: "admin",
    path: (fx) => `/admin/orders?order=${fx.order("margaret")}`,
    ready: ADMIN_AGREEMENT,
    caption: "O contrato do pedido: a versão, Download e Regenerate and resend.",
    highlight: [
      { target: ADMIN_AGREEMENT, label: "1" },
      { target: { css: "button", text: "Regenerate and resend", within: ADMIN_AGREEMENT }, arrow: "right", label: "2" },
    ],
  },
  {
    id: "admin-order-deliverables",
    role: "admin",
    session: "admin",
    path: (fx) => `/admin/orders?order=${fx.order("priya")}`,
    ready: ADMIN_DELIVERABLES,
    caption: "Entregar um arquivo à cliente: a secção (sem número) e Upload, o passo 4.",
    highlight: [
      { target: ADMIN_DELIVERABLES },
      { target: { css: "button", text: "Upload", exact: true, within: ADMIN_DELIVERABLES }, arrow: "right", label: "4" },
    ],
  },
  {
    id: "admin-order-report",
    role: "admin",
    session: "admin",
    path: (fx) => `/admin/orders?order=${fx.order("priya")}`,
    ready: ADMIN_REPORT,
    caption: "O relatório para a cliente: escrever e Save report.",
    highlight: [
      { target: { css: "textarea", within: ADMIN_REPORT }, arrow: "left", label: "1" },
      { target: { css: "button", text: "Save report", within: ADMIN_REPORT }, arrow: "right", label: "2" },
    ],
  },
  {
    id: "admin-order-completion",
    role: "admin",
    session: "admin",
    path: (fx) => `/admin/orders?order=${fx.order("priya")}`,
    ready: ADMIN_STAGE,
    before: [
      // On NIF ready, Forward lands on the last stage, so it only asks; nothing moves.
      { click: { css: "button", text: "Forward", within: ADMIN_STAGE }, expect: { css: "[role=alertdialog]", within: ADMIN_STAGE } },
    ],
    caption: "Antes de concluir, o painel pergunta (passo 2). Se faltar algo, a pergunta diz o quê. Confirm é o passo 4.",
    highlight: [
      { target: { css: "[role=alertdialog]", within: ADMIN_STAGE }, label: "2" },
      { target: { css: "button", text: "Confirm", exact: true, within: ADMIN_STAGE }, arrow: "left", label: "4" },
    ],
  },
  {
    id: "admin-order-couple",
    role: "admin",
    session: "admin",
    path: (fx) => `/admin/orders?order=${fx.order("daniel")}`,
    ready: ADMIN_DOCS,
    caption: "Um pedido de casal: cada documento aparece uma vez por pessoa.",
    highlight: [
      { target: ADMIN_DOCS, label: "1" },
      { target: DEED_DETAILS, label: "2" },
    ],
  },
  {
    id: "admin-order-history",
    role: "admin",
    session: "admin",
    path: (fx) => `/admin/orders?order=${fx.order("hannah")}`,
    ready: ADMIN_HISTORY,
    caption: "History: cada mudança de etapa, com a data e a hora.",
    highlight: [{ target: ADMIN_HISTORY, label: "1" }],
  },

  // --- Admin: Users --------------------------------------------------------
  {
    id: "admin-users",
    role: "admin",
    session: "admin",
    path: usersDemo,
    caption: "Users: a lista de contas, New user e a coluna Actions.",
    highlight: [
      { target: { css: "button", text: "New user" }, arrow: "left", label: "1" },
      { target: { css: "th", text: "Actions" }, arrow: "top", label: "2" },
    ],
    scroll: false,
  },
  {
    id: "admin-user-details",
    role: "admin",
    session: "admin",
    path: (fx) => `/admin/users?user=${fx.user("margaret")}`,
    ready: DIALOG,
    caption: "Os detalhes de uma conta, com os pedidos e Assign a purchase.",
    highlight: [{ target: inDialog({ css: "button", text: "Assign a purchase" }), arrow: "left", label: "1" }],
  },
  {
    id: "admin-user-new",
    role: "admin",
    session: "admin",
    path: usersDemo,
    before: [
      { click: { css: "button", text: "New user" }, expect: DIALOG },
      { set: inDialog("input[type=email]"), value: "ana.exemplo@example.com" },
      { set: inDialog("input:not([type=email]):not([type=tel]):not([type=hidden]):not([type=checkbox])"), value: "Ana Exemplo" },
    ],
    ready: DIALOG,
    caption: "Criar uma conta à mão: e-mail, nome e telefone. Nenhum e-mail sai nesse momento.",
    highlight: [
      { target: inDialog("form"), label: "1" },
      { target: inDialog({ css: "button", text: "Create the account" }), arrow: "left", label: "2" },
    ],
    scroll: false,
  },
  {
    id: "admin-user-edit",
    role: "admin",
    session: "admin",
    path: "/admin/users?q=oliver.grant",
    before: [{ click: { css: "button[aria-label='Edit']", within: { css: "tr", text: "oliver.grant@" } }, expect: DIALOG }],
    ready: DIALOG,
    caption: "Corrigir o nome, o telefone ou o e-mail de um cliente.",
    highlight: [
      { target: inDialog("form"), label: "1" },
      { target: inDialog({ css: "button", text: "Save changes" }), arrow: "left", label: "2" },
    ],
    scroll: false,
  },
  {
    id: "admin-user-assign",
    role: "admin",
    session: "admin",
    path: "/admin/users?q=oliver.grant",
    before: [{ click: { css: "button[aria-label='Assign a purchase']", within: { css: "tr", text: "oliver.grant@" } }, expect: DIALOG }],
    ready: DIALOG,
    caption: "Atribuir uma compra: o serviço e, se já foi pago por fora, a opção Already paid outside the platform.",
    highlight: [
      { target: inDialog("select"), arrow: "left", label: "1" },
      { target: inDialog({ css: "label", text: "Already paid outside the platform" }), arrow: "left", label: "2" },
      { target: inDialog({ css: "button", text: "Assign", exact: true }), arrow: "left", label: "3" },
    ],
    scroll: false,
  },
  {
    id: "admin-user-delete",
    role: "admin",
    session: "admin",
    path: "/admin/users?q=oliver.grant",
    before: [{ click: { css: "button[aria-label='Delete']", within: { css: "tr", text: "oliver.grant@" } }, expect: DIALOG }],
    ready: DIALOG,
    caption: "Apagar uma conta: escrever o e-mail para confirmar. Não se desfaz.",
    highlight: [
      { target: inDialog("input[type=text]"), arrow: "left", label: "1" },
      { target: inDialog({ css: "button", text: "Delete this client" }), arrow: "left", label: "2" },
    ],
    scroll: false,
  },

  // --- Admin: Services, Feedback, Settings -------------------------------
  {
    id: "admin-services",
    role: "admin",
    session: "admin",
    path: "/admin/services",
    caption: "Services: o catálogo. Cada linha abre o editor do serviço.",
    highlight: [
      { target: "table", label: "1" },
      { target: { css: "a", label: "Edit " }, arrow: "left", label: "2" },
    ],
    scroll: false,
  },
  {
    id: "admin-service-editor",
    role: "admin",
    session: "admin",
    path: (fx) => `/admin/services/${fx.service("nif-only")}`,
    ready: { css: "label", text: "Service contract" },
    caption: "O editor de um serviço: o contrato associado e Save service.",
    highlight: [
      { target: { css: "label", text: "Service contract" }, arrow: "left", label: "1" },
      { target: { css: "button", text: "Save service" }, arrow: "left", label: "2" },
    ],
  },
  {
    id: "admin-service-editor-documents",
    role: "admin",
    session: "admin",
    path: (fx) => `/admin/services/${fx.service("nif-only")}`,
    ready: { css: "h2, h3", text: "Required documents" },
    scroll: { target: { css: "h2, h3", text: "Required documents" }, block: "start" },
    caption: "Os documentos de um serviço: a nota que o cliente lê e as caixas One per applicant e Required.",
    highlight: [
      { target: { css: "label", text: "One per applicant" }, arrow: "left", label: "1" },
      { target: { css: "label", text: "Required" }, arrow: "right", label: "2" },
      { target: { css: "label", text: "Document to sign" }, label: "3" },
    ],
  },
  {
    id: "admin-feedback-list",
    role: "admin",
    session: "admin",
    path: "/admin/feedback",
    caption: "As notas enviadas, com o filtro por estado.",
    highlight: [
      { target: "nav[aria-label='Filter by status']", arrow: "left", label: "1" },
      { target: "main article", label: "2" },
    ],
    scroll: false,
  },
  {
    id: "admin-feedback-button",
    role: "admin",
    session: "admin",
    path: `${ordersDemo}&view=table`,
    caption: "O botão Feedback, no canto de todas as páginas do painel.",
    highlight: [{ target: { css: "button", text: "Feedback", exact: true }, arrow: "left", label: "1" }],
    scroll: false,
  },
  {
    id: "admin-feedback-dialog",
    role: "admin",
    session: "admin",
    path: `${ordersDemo}&view=table`,
    before: [{ click: { css: "button", text: "Feedback", exact: true }, expect: DIALOG }],
    ready: DIALOG,
    caption: "A janela Send feedback: o que esperava, o que aconteceu e a prioridade.",
    highlight: [{ target: DIALOG, label: "1" }],
    scroll: false,
  },
  {
    id: "admin-settings-password",
    role: "admin",
    session: "admin",
    path: "/admin/settings",
    caption: "Settings: Change password pede a senha atual e a nova duas vezes.",
    highlight: [
      { target: section("password-heading"), label: "1" },
      { target: { css: "button[type=submit]", text: "Change password" }, arrow: "right", label: "2" },
    ],
  },
  {
    id: "admin-settings-second-factor",
    role: "admin",
    session: "admin",
    path: "/admin/settings",
    ready: { css: "h2", text: "Second factor" },
    pending:
      "Being built on 2026-09-25: the Second factor card in Settings (QR code, first code). Set up shows only while the support admin has no factor: take this one BEFORE node scripts/admin-totp.mjs enrols it (capture.mjs --only admin-settings-second-factor), then admin-login-code and admin-settings-second-factor-on.",
    caption: "O cartão Second factor: Set up mostra o código QR para a aplicação autenticadora.",
    highlight: [
      { target: section("mfa-heading"), label: "1" },
      { target: { css: "button", text: "Set up", within: section("mfa-heading") }, arrow: "right", label: "2" },
    ],
  },
  {
    id: "admin-settings-second-factor-on",
    role: "admin",
    session: "admin",
    path: "/admin/settings",
    ready: { css: "p", text: "On since", within: section("mfa-heading") },
    pending:
      "Being built on 2026-09-25: the Second factor card once a factor is on. Needs the support admin enrolled (node scripts/admin-totp.mjs) and ADMIN_SUPPORT_TOTP_SECRET in .env.local, so the session reaches the code; take it after admin-settings-second-factor.",
    caption: "O segundo fator ativo: On since com a data (1) e Turn off (2).",
    highlight: [
      { target: { css: "p", text: "On since", within: section("mfa-heading") }, arrow: "left", label: "1" },
      { target: { css: "button", text: "Turn off", within: section("mfa-heading") }, arrow: "right", label: "2" },
    ],
  },

  // --- Emails (rendered from src/lib/email/templates.ts, never sent) --------
  {
    id: "email-payment-received",
    role: "client",
    session: "none",
    email: {
      template: "paymentReceived",
      to: CLIENT_TO,
      input: { serviceName: "NIF + Bank Account", hasAgreement: true, dashboardUrl: `${SITE}/en/dashboard/orders/${SAMPLE_ORDER}` },
    },
    shot: EMAIL_SHOT,
    viewport: EMAIL_VIEWPORT,
    scroll: false,
    caption: "O e-mail Payment received, que o cliente recebe depois de pagar.",
    highlight: [{ target: { css: "a", text: "Open your order" }, arrow: "right", label: "1" }],
  },
  {
    id: "email-service-agreement",
    role: "client",
    session: "none",
    email: {
      template: "serviceAgreement",
      to: CLIENT_TO,
      attachment: "service-agreement-package-margaret-hill.pdf",
      input: { serviceName: "NIF + Bank Account", dashboardUrl: `${SITE}/en/dashboard/orders/${SAMPLE_ORDER}` },
    },
    shot: EMAIL_SHOT,
    viewport: EMAIL_VIEWPORT,
    scroll: false,
    caption: "O e-mail Your service agreement, com o contrato em PDF anexado.",
    highlight: [{ target: ".anexo", arrow: "right", label: "1" }],
  },
  {
    id: "email-document-rejected",
    role: "client",
    session: "none",
    email: {
      template: "documentRejected",
      to: CLIENT_TO,
      input: {
        docLabel: "Proof of address",
        reason: "The scan is too dark to read. Upload a clear copy of the full page.",
        dashboardUrl: `${SITE}/en/dashboard/orders/${SAMPLE_ORDER}`,
      },
    },
    shot: EMAIL_SHOT,
    viewport: EMAIL_VIEWPORT,
    scroll: false,
    caption: "O e-mail que o cliente recebe quando você rejeita um documento: o motivo vai tal como você o escreveu.",
    highlight: [
      { target: { css: "table", text: "The scan is too dark to read" }, arrow: "left", label: "1" },
      { target: { css: "a", text: "Upload a new file" }, arrow: "right", label: "2" },
    ],
  },
  {
    id: "email-order-completed",
    role: "client",
    session: "none",
    email: {
      template: "orderCompleted",
      to: CLIENT_TO,
      input: { serviceName: "NIF + Bank Account", dashboardUrl: `${SITE}/en/dashboard/orders/${SAMPLE_ORDER}` },
    },
    shot: EMAIL_SHOT,
    viewport: EMAIL_VIEWPORT,
    scroll: false,
    caption: "O e-mail de pedido concluído, enviado só da primeira vez que o pedido chega à última etapa.",
    highlight: [{ target: { css: "a", text: "See your documents" }, arrow: "right", label: "1" }],
  },
  {
    id: "email-team-new-paid-order",
    role: "admin",
    session: "none",
    email: {
      template: "newPaidOrder",
      to: TEAM_TO,
      input: {
        serviceName: "NIF + Bank Account",
        amount: "€497",
        clientEmail: CLIENT_TO,
        hasAgreement: true,
        orderId: SAMPLE_ORDER,
        adminUrl: `${SITE}/admin/orders?order=${SAMPLE_ORDER}`,
      },
    },
    shot: EMAIL_SHOT,
    viewport: EMAIL_VIEWPORT,
    scroll: false,
    caption: "O aviso à equipa de um novo pedido pago.",
    highlight: [
      { target: { css: "table", text: "Amount" }, label: "1" },
      { target: { css: "a", text: "Open the order" }, arrow: "right", label: "2" },
    ],
  },
  {
    id: "email-team-documents-ready",
    role: "admin",
    session: "none",
    email: {
      template: "documentsReady",
      to: TEAM_TO,
      input: {
        serviceName: "NIF + Bank Account",
        clientEmail: CLIENT_TO,
        filesToReview: 7,
        applicants: 1,
        orderId: SAMPLE_ORDER,
        adminUrl: `${SITE}/admin/orders?order=${SAMPLE_ORDER}`,
      },
    },
    shot: EMAIL_SHOT,
    viewport: EMAIL_VIEWPORT,
    scroll: false,
    caption: "O aviso à equipa de que todos os documentos de um pedido chegaram.",
    highlight: [
      { target: { css: "table", text: "To review" }, label: "1" },
      { target: { css: "a", text: "Review the documents" }, arrow: "right", label: "2" },
    ],
  },
  {
    id: "email-team-signed-agreement",
    role: "admin",
    session: "none",
    email: {
      template: "signedAgreement",
      to: TEAM_TO,
      attachment: "signed-service-agreement.pdf",
      input: {
        serviceName: "NIF + Bank Account",
        clientEmail: CLIENT_TO,
        orderId: SAMPLE_ORDER,
        fileName: "signed-service-agreement.pdf",
        delivery: "attached",
        attachmentLimit: "8 MB",
        adminUrl: `${SITE}/admin/orders?order=${SAMPLE_ORDER}`,
      },
    },
    shot: EMAIL_SHOT,
    viewport: EMAIL_VIEWPORT,
    scroll: false,
    caption: "O aviso de contrato assinado, com a cópia em anexo.",
    highlight: [
      { target: ".anexo", arrow: "right", label: "1" },
      { target: { css: "a", text: "Open the order" }, arrow: "right", label: "2" },
    ],
  },

  // --- Phone ---------------------------------------------------------------
  {
    id: "phone-landing",
    role: "client",
    session: "none",
    path: "/en",
    viewport: "phone",
    caption: "O site no telemóvel.",
    highlight: [{ target: { css: "#top a", text: "Start my application" }, label: "1" }],
  },
  {
    id: "phone-dashboard",
    role: "client",
    session: "margaret",
    path: "/en/dashboard",
    viewport: "phone",
    caption: "A área do cliente no telemóvel.",
    highlight: [
      { target: { css: "article", within: IN_PROGRESS }, label: "1" },
      { target: { css: "a", label: "See more about", within: IN_PROGRESS }, arrow: "top", label: "2" },
    ],
  },
  {
    id: "phone-order",
    role: "client",
    session: "margaret",
    path: (fx) => `/en/dashboard?order=${fx.order("margaret")}`,
    viewport: "phone",
    ready: CLIENT_DOCS,
    caption: "Os documentos de um pedido no telemóvel: enviar uma foto tirada na hora funciona.",
    highlight: [{ target: clientSlot("Replace file"), label: "1" }],
  },
];

export const scenes = SCENES.map((scene) => ({ viewport: "desktop", out: out(scene.id), ...scene }));

/** Scenes whose path or session needs the demo data. */
export function needsFixtures(scene) {
  const fields = [scene.path, scene.before, scene.ready, scene.scroll, scene.highlight];
  return fields.some((field) => typeof field === "function") || !["none", "admin", "admin-password-only"].includes(scene.session);
}
