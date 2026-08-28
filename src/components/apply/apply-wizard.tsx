"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";

import { ExitScreen } from "@/components/apply/exit-screen";
import { ResultCard } from "@/components/apply/result-card";
import { BankStep } from "@/components/apply/steps/bank-step";
import { HasNifStep } from "@/components/apply/steps/has-nif-step";
import { PassportStep } from "@/components/apply/steps/passport-step";
import { ResidenceStep } from "@/components/apply/steps/residence-step";
import { VisaStep } from "@/components/apply/steps/visa-step";
import { WhoStep } from "@/components/apply/steps/who-step";
import type { StepProps } from "@/components/apply/steps/types";
import { Progress } from "@/components/apply/ui/progress";
import { WizardNav } from "@/components/apply/ui/wizard-nav";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { trackExit, trackRecommendation, trackStep } from "@/lib/analytics";
import { applyCopy } from "@/content/apply";
import { recommend } from "@/lib/apply/recommend";
import { clearAnswers, loadAnswers, saveAnswers } from "@/lib/apply/storage";
import { maxReachable, pruneAnswers, visibleSteps, type StepId } from "@/lib/apply/steps";
import { isProductId, type Answers } from "@/lib/apply/types";

const STEP_COMPONENTS: Record<StepId, (props: StepProps) => React.JSX.Element> = {
  residence: ResidenceStep,
  who: WhoStep,
  "has-nif": HasNifStep,
  bank: BankStep,
  passport: PassportStep,
  visa: VisaStep,
};

type Action =
  | { type: "patch"; patch: Partial<Answers> }
  | { type: "replace"; answers: Answers }
  | { type: "reset" };

function reducer(state: Answers, action: Action): Answers {
  switch (action.type) {
    case "patch":
      return pruneAnswers({ ...state, ...action.patch });
    case "replace":
      return pruneAnswers(action.answers);
    case "reset":
      return {};
  }
}

const smooth = [0.22, 0.61, 0.36, 1] as const;

const noop = () => () => {};
/** False while the server HTML is being hydrated, true afterwards. */
function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}

/**
 * The /en/apply wizard.
 *
 * The URL owns the screen index (`?step=`), so the browser's Back button is
 * the wizard's Back button. Answers live in a reducer mirrored to
 * sessionStorage, so a refresh keeps them. A `?step=` beyond what the answers
 * allow is clamped to the first unanswered screen, which also covers a shared
 * link opened on a device that never answered anything.
 *
 * `?product=` is the landing's preselection. It is folded into the answers on
 * first load and travels on every URL the wizard writes.
 */
export function ApplyWizard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();

  const hydrated = useHydrated();
  const visited = useRef(0);

  // The stored answers are read once, on the client, when the component first
  // renders, and the preselection from the landing is folded in at the same
  // time. The server renders a skeleton, so reading the browser here cannot
  // produce a hydration mismatch.
  const [answers, dispatch] = useReducer(reducer, null, () => {
    if (typeof window === "undefined") return {};
    const product = searchParams.get("product");
    const stored = loadAnswers();
    return pruneAnswers(isProductId(product) ? { ...stored, preselected: product } : stored);
  });

  useEffect(() => {
    if (hydrated) saveAnswers(answers);
  }, [answers, hydrated]);

  const steps = visibleSteps(answers);
  const reachable = maxReachable(answers);
  const requested = Math.max(0, (Number.parseInt(searchParams.get("step") ?? "1", 10) || 1) - 1);
  const index = Math.min(requested, reachable);

  const urlFor = useCallback(
    (stepIndex: number) => {
      const params = new URLSearchParams();
      if (stepIndex > 0) params.set("step", String(stepIndex + 1));
      const product = answers.preselected ?? searchParams.get("product");
      if (product) params.set("product", product);
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [answers.preselected, pathname, searchParams],
  );

  // Clamp a deep link that skips ahead of the answers.
  useEffect(() => {
    if (hydrated && requested !== index) router.replace(urlFor(index), { scroll: false });
  }, [hydrated, requested, index, router, urlFor]);

  // Slide direction, derived from where the index moved since the last render.
  const [prevIndex, setPrevIndex] = useState(index);
  const [direction, setDirection] = useState(1);
  if (index !== prevIndex) {
    setDirection(index > prevIndex ? 1 : -1);
    setPrevIndex(index);
  }

  // One funnel event per screen the visitor actually reaches.
  const screenId = index < steps.length ? steps[index]?.id : "result";
  useEffect(() => {
    if (!hydrated || !screenId) return;
    if (screenId === "result") {
      const rec = recommend(answers);
      if (rec.kind === "exit") trackExit(rec.exit);
      else trackRecommendation(rec.product, rec.quantity, rec.totalCents);
    } else {
      trackStep(index + 1, steps.length, screenId);
    }
    // Answers are read for the result payload only; the screen is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, screenId, index]);

  const goTo = (stepIndex: number) => {
    visited.current += 1;
    router.push(urlFor(stepIndex), { scroll: false });
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  };

  const goBack = () => {
    if (visited.current > 0) {
      visited.current -= 1;
      router.back();
    } else {
      goTo(Math.max(0, index - 1));
    }
  };

  const startOver = () => {
    clearAnswers();
    dispatch({ type: "reset" });
    visited.current = 0;
    router.replace(pathname, { scroll: false });
  };

  if (!hydrated) return <Skeleton />;

  // Living in Portugal ends the flow after the first answer.
  const earlyExit = answers.residence === "PT" && index >= 1;
  const done = index >= steps.length;

  let screen: React.ReactNode;
  let key: string;

  if (earlyExit) {
    key = "exit-portugal";
    screen = <ExitScreen exit="portugal" notes={answers.childrenNifs ? ["childrenNifs"] : []} onBack={goBack} />;
  } else if (done) {
    const rec = recommend(answers);
    if (rec.kind === "exit") {
      key = `exit-${rec.exit}`;
      screen = <ExitScreen exit={rec.exit} notes={rec.notes} onBack={goBack} />;
    } else {
      key = "result";
      screen = <ResultCard rec={rec} answers={answers} onStartOver={startOver} />;
    }
  } else {
    const step = steps[index];
    const Component = STEP_COMPONENTS[step.id];
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
          <Component answers={answers} onChange={(patch) => dispatch({ type: "patch", patch })} />
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
