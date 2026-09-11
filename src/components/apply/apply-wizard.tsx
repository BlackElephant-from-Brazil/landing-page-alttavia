"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";

import { AccountCodeScreen, AccountEmailScreen, SavingScreen } from "@/components/apply/account-screens";
import {
  clearCheckout,
  loadCheckout,
  saveCheckout,
  type CheckoutState,
} from "@/components/apply/checkout-storage";
import { ExitScreen } from "@/components/apply/exit-screen";
import { ResultCard } from "@/components/apply/result-card";
import { ChoiceStep } from "@/components/apply/steps/choice-step";
import { CountryStep } from "@/components/apply/steps/country-step";
import { HouseholdChoiceStep } from "@/components/apply/steps/household-choice-step";
import { PerPersonCountryStep } from "@/components/apply/steps/per-person-country-step";
import { PerPersonYesNoStep } from "@/components/apply/steps/per-person-yes-no-step";
import type { StepProps } from "@/components/apply/steps/types";
import { Progress } from "@/components/apply/ui/progress";
import { StepFrame } from "@/components/apply/ui/step-frame";
import { WizardNav } from "@/components/apply/ui/wizard-nav";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { alternativeFor, applyCopy, orderName, orderTotal, serviceFor } from "@/content/apply";
import { trackCheckoutClick, trackExit, trackRecommendation, trackStep } from "@/lib/analytics";
import { buildSteps } from "@/lib/apply/questions";
import { recommend } from "@/lib/apply/recommend";
import { clearAnswers, loadAnswers, saveAnswers } from "@/lib/apply/storage";
import { maxReachable, pruneAnswers, visibleSteps, type Step } from "@/lib/apply/steps";
import { isProductId, type Answers, type ProductId } from "@/lib/apply/types";
import type { QuestionKind, QuestionRow, ServiceRow } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/client";

const STEP_COMPONENTS: Record<QuestionKind, (props: StepProps) => React.JSX.Element> = {
  country: CountryStep,
  choice: ChoiceStep,
  "per-person-yes-no": PerPersonYesNoStep,
  "per-person-country": PerPersonCountryStep,
  "choice-by-household": HouseholdChoiceStep,
};

/** A kind this build does not render: the question is shown, nothing is asked, Continue works. */
function UnknownKindStep({ question }: StepProps) {
  return <StepFrame heading={question.title} help={question.help ?? undefined}>{null}</StepFrame>;
}

const DASHBOARD_PATH = "/en/dashboard";
const SUBMIT_PATH = "/api/apply/submit";

/** The screens after the questions and the result, addressed by `?step=`. */
type AuthPhase = "email" | "code";
type Target = number | AuthPhase;

type Action =
  | { type: "patch"; patch: Partial<Answers> }
  | { type: "replace"; answers: Answers }
  | { type: "reset" };

type SubmitState = { status: "idle" } | { status: "saving" } | { status: "error"; message: string };

const smooth = [0.22, 0.61, 0.36, 1] as const;

const noop = () => () => {};
/** False while the server HTML is being hydrated, true afterwards. */
function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}

/**
 * The /en/apply wizard.
 *
 * The URL owns the screen (`?step=`), so the browser's Back button is the
 * wizard's Back button. Answers live in a reducer mirrored to sessionStorage,
 * so a refresh keeps them. A `?step=` beyond what the answers allow is
 * clamped to the first unanswered screen, which also covers a shared link
 * opened on a device that never answered anything.
 *
 * Questions and services come from the page (database rows, or the seeds
 * when it could not read them); the screens are built from the rows here.
 *
 * After the result, `?step=email` and `?step=code` create the account, then
 * the order is posted to /api/apply/submit and the visitor lands on the
 * dashboard. A visitor who already has a session skips both screens. Those
 * two are not counted in the progress bar and are only reachable once the
 * result is, with a product chosen; anything else is clamped back.
 *
 * `?product=` is the landing's preselection. It is folded into the answers on
 * first load and travels on every URL the wizard writes.
 */
export function ApplyWizard({
  questions,
  services,
}: {
  questions: readonly QuestionRow[];
  services: readonly ServiceRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();

  const hydrated = useHydrated();
  const visited = useRef(0);

  const allSteps = useMemo<readonly Step[]>(() => buildSteps(questions), [questions]);

  const reducer = useCallback(
    (state: Answers, action: Action): Answers => {
      switch (action.type) {
        case "patch":
          return pruneAnswers({ ...state, ...action.patch }, allSteps);
        case "replace":
          return pruneAnswers(action.answers, allSteps);
        case "reset":
          return {};
      }
    },
    [allSteps],
  );

  // The stored answers are read once, on the client, when the component first
  // renders, and the preselection from the landing is folded in at the same
  // time. The server renders a skeleton, so reading the browser here cannot
  // produce a hydration mismatch.
  const [answers, dispatch] = useReducer(reducer, null, () => {
    if (typeof window === "undefined") return {};
    const product = searchParams.get("product");
    const stored = loadAnswers();
    return pruneAnswers(isProductId(product) ? { ...stored, preselected: product } : stored, allSteps);
  });

  // The product chosen on the result screen and the email the code went to,
  // both kept in sessionStorage so a refresh on the code screen loses neither.
  const [checkout, setCheckoutState] = useState<CheckoutState>(() =>
    typeof window === "undefined" ? {} : loadCheckout(),
  );
  const setCheckout = (next: CheckoutState) => {
    setCheckoutState(next);
    saveCheckout(next);
  };

  // Whether the visitor already has a session, asked once on mount. The CTA
  // awaits the same promise, so a click before the answer arrives waits for
  // it instead of guessing.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const sessionCheck = useRef<Promise<boolean> | null>(null);
  useEffect(() => {
    let alive = true;
    sessionCheck.current = (async () => {
      try {
        const { data } = await createClient().auth.getUser();
        return Boolean(data.user);
      } catch {
        return false;
      }
    })();
    void sessionCheck.current.then((value) => {
      if (alive) setSignedIn(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });

  useEffect(() => {
    if (hydrated) saveAnswers(answers);
  }, [answers, hydrated]);

  const steps = visibleSteps(answers, allSteps);
  const reachable = maxReachable(answers, allSteps);
  const stepParam = searchParams.get("step");
  const requestedPhase: AuthPhase | null = stepParam === "email" || stepParam === "code" ? stepParam : null;
  const requested = requestedPhase
    ? steps.length
    : Math.max(0, (Number.parseInt(stepParam ?? "1", 10) || 1) - 1);
  const index = Math.min(requested, reachable);
  const done = index >= steps.length;
  const rec = done ? recommend(answers) : null;

  // The auth screens need the result, a product the engine allows, and (for
  // the code) the address the code went to. Otherwise they fall back.
  const chosen = rec?.kind === "product" && checkout.product && rec.valid.includes(checkout.product) ? checkout.product : undefined;
  let phase: AuthPhase | null = null;
  if (requestedPhase && chosen) {
    phase = requestedPhase === "code" && !checkout.email ? "email" : requestedPhase;
  }

  const urlFor = useCallback(
    (target: Target) => {
      const params = new URLSearchParams();
      if (typeof target === "string") params.set("step", target);
      else if (target > 0) params.set("step", String(target + 1));
      const product = answers.preselected ?? searchParams.get("product");
      if (product) params.set("product", product);
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [answers.preselected, pathname, searchParams],
  );

  // Clamp a deep link that skips ahead of the answers, or an auth screen
  // reached without a result or a chosen product behind it.
  const wanted: Target = requestedPhase ?? requested;
  const actual: Target = phase ?? index;
  useEffect(() => {
    if (hydrated && wanted !== actual) router.replace(urlFor(actual), { scroll: false });
  }, [hydrated, wanted, actual, router, urlFor]);

  // Slide direction, derived from where the screen moved since the last render.
  const order = (t: Target) => (t === "email" ? steps.length + 1 : t === "code" ? steps.length + 2 : t);
  const position = order(actual);
  const [prevPosition, setPrevPosition] = useState(position);
  const [direction, setDirection] = useState(1);
  if (position !== prevPosition) {
    setDirection(position > prevPosition ? 1 : -1);
    setPrevPosition(position);
  }

  // One funnel event per screen the visitor actually reaches. The account
  // screens are not funnel steps; begin_checkout fires when the CTA is clicked.
  const screenId = phase ? null : index < steps.length ? steps[index]?.id : "result";
  useEffect(() => {
    if (!hydrated || !screenId) return;
    if (screenId === "result") {
      const r = recommend(answers);
      if (r.kind === "exit") trackExit(r.exit);
      else trackRecommendation(r.product, r.quantity, r.totalCents);
    } else {
      trackStep(index + 1, steps.length, screenId);
    }
    // Answers are read for the result payload only; the screen is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, screenId, index]);

  const goTo = (target: Target) => {
    visited.current += 1;
    router.push(urlFor(target), { scroll: false });
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  };

  const goBack = () => {
    if (visited.current > 0) {
      visited.current -= 1;
      router.back();
    } else if (phase === "code") {
      goTo("email");
    } else {
      goTo(phase ? steps.length : Math.max(0, index - 1));
    }
  };

  const startOver = () => {
    clearAnswers();
    clearCheckout();
    dispatch({ type: "reset" });
    setCheckoutState({});
    setSubmit({ status: "idle" });
    visited.current = 0;
    router.replace(pathname, { scroll: false });
  };

  /**
   * Writes the order for `product` to the signed in account and moves to
   * the dashboard. `router.refresh()` makes the server render the
   * destination with the new cookies, so the guard in src/proxy.ts sees a
   * user. A 401 means the session is gone: back to the email screen.
   */
  const submitOrder = async (product: ProductId) => {
    setSubmit({ status: "saving" });
    let ok = false;
    let message: string = applyCopy.account.errors.save;
    let signedOut = false;
    try {
      const res = await fetch(SUBMIT_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, product }),
      });
      const data = (await res.json().catch(() => ({}))) as { userServiceId?: unknown; error?: unknown };
      if (res.ok && typeof data.userServiceId === "string") ok = true;
      else if (res.status === 401) signedOut = true;
      else if (typeof data.error === "string" && data.error) message = data.error;
    } catch {
      // Network failure: the fallback message stands.
    }

    if (signedOut) {
      setSignedIn(false);
      setSubmit({ status: "error", message: applyCopy.account.errors.signedOut });
      goTo("email");
      return;
    }
    if (!ok) {
      setSubmit({ status: "error", message });
      return;
    }

    clearAnswers();
    clearCheckout();
    router.push(DASHBOARD_PATH);
    router.refresh();
  };

  /** The result screen's buttons: remember the product, then account or order. */
  const startCheckout = async (product: ProductId) => {
    if (!rec || rec.kind !== "product") return;
    const chosenOrder = alternativeFor(rec, product, answers);
    trackCheckoutClick(product, chosenOrder.totalCents, "stripe");
    setCheckout({ ...checkout, product });
    setSubmit({ status: "idle" });
    const hasSession = signedIn ?? (await (sessionCheck.current ?? Promise.resolve(false)));
    if (hasSession) await submitOrder(product);
    else goTo("email");
  };

  if (!hydrated) return <Skeleton />;

  // Living in Portugal ends the flow after the first answer.
  const earlyExit = answers.residence === "PT" && index >= 1;

  let screen: React.ReactNode;
  let key: string;

  if (earlyExit) {
    key = "exit-portugal";
    screen = <ExitScreen exit="portugal" notes={answers.childrenNifs ? ["childrenNifs"] : []} onBack={goBack} />;
  } else if (phase && rec?.kind === "product" && chosen) {
    const chosenOrder = alternativeFor(rec, chosen, answers);
    const service = serviceFor(services, chosen);
    if (submit.status !== "idle" && (phase === "code" || submit.status === "saving")) {
      key = "account-saving";
      screen = (
        <SavingScreen
          error={submit.status === "error" ? submit.message : null}
          onRetry={() => void submitOrder(chosen)}
        />
      );
    } else if (phase === "email") {
      key = "account-email";
      screen = (
        <AccountEmailScreen
          orderName={orderName(chosenOrder, service)}
          total={orderTotal(chosenOrder)}
          notice={submit.status === "error" ? submit.message : null}
          onSent={(email) => {
            setCheckout({ ...checkout, email });
            setSubmit({ status: "idle" });
            goTo("code");
          }}
          onBack={goBack}
        />
      );
    } else {
      key = "account-code";
      screen = (
        <AccountCodeScreen
          email={checkout.email ?? ""}
          onVerified={() => {
            setSignedIn(true);
            void submitOrder(chosen);
          }}
          onChangeEmail={goBack}
        />
      );
    }
  } else if (done && rec) {
    if (rec.kind === "exit") {
      key = `exit-${rec.exit}`;
      screen = <ExitScreen exit={rec.exit} notes={rec.notes} onBack={goBack} />;
    } else {
      key = "result";
      screen = (
        <ResultCard
          rec={rec}
          answers={answers}
          services={services}
          pending={submit.status === "saving"}
          error={submit.status === "error" ? submit.message : null}
          onCheckout={(product) => void startCheckout(product)}
          onStartOver={startOver}
        />
      );
    }
  } else {
    const step = steps[index];
    const Component = STEP_COMPONENTS[step.row.kind] ?? UnknownKindStep;
    const isLast = index === steps.length - 1;
    key = step.id;
    screen = (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step.isValid(answers)) goTo(index + 1);
        }}
      >
        <Progress current={index + 1} total={steps.length} />
        <div className="mt-8">
          <Component
            question={step.row}
            answers={answers}
            onChange={(patch) => dispatch({ type: "patch", patch })}
          />
        </div>
        <WizardNav
          canGoBack={index > 0}
          canContinue={step.isValid(answers)}
          continueLabel={isLast ? applyCopy.nav.showResult : applyCopy.nav.next}
          onBack={goBack}
        />
      </form>
    );
  }

  const slide = reducedMotion ? 0 : 24 * direction;

  return (
    <div>
      {index === 0 && !earlyExit && (
        <div className="mb-8">
          <EyebrowSolo>{applyCopy.intro.eyebrow}</EyebrowSolo>
          <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-navy-soft">{applyCopy.intro.lead}</p>
        </div>
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          initial={{ opacity: 0, x: slide }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -slide }}
          transition={{ duration: reducedMotion ? 0 : 0.28, ease: smooth }}
        >
          {screen}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Neutral placeholder while the stored answers are read. Matches the step layout height. */
export function Skeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="h-3 w-24 rounded-full bg-navy/10" />
      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="h-1 flex-1 rounded-full bg-navy/10" />
        ))}
      </div>
      <div className="mt-10 h-9 w-3/4 rounded-full bg-navy/10" />
      <div className="mt-4 h-4 w-1/2 rounded-full bg-navy/10" />
      <div className="mt-8 h-12 max-w-md rounded-full bg-navy/10" />
    </div>
  );
}
