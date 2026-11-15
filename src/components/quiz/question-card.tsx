"use client";

import { useCallback, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Md } from "@/components/math/md";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Feedback, GivenAnswer, PublicQuestion, PublicStep } from "@/lib/quiz/types";
import { FillBlankInput, MatchingInput, McqInput, OrderingInput, TrueFalseInput } from "./inputs";

export type CheckFn = (given: GivenAnswer, stepIndex?: number, isLastStep?: boolean) => Promise<{ ok: true; feedback: Feedback } | { ok: false; error: string }>;

type Draft = { option: string | null; bool: boolean | null; text: string; map: number[]; order: number[] };

function initialDraft(q: PublicQuestion | PublicStep): Draft {
  return {
    option: null,
    bool: null,
    text: "",
    map: q.kind === "matching" ? q.left.map(() => -1) : [],
    order: q.kind === "ordering" ? q.items.map((_, i) => i) : [],
  };
}

function toGiven(q: PublicQuestion | PublicStep, d: Draft): GivenAnswer | null {
  switch (q.kind) {
    case "mcq":
      return d.option ? { option: d.option } : null;
    case "true_false":
      return d.bool === null ? null : { value: d.bool };
    case "fill_blank":
      return d.text.trim() ? { text: d.text.trim() } : null;
    case "matching":
      return d.map.every((v) => v >= 0) ? { map: d.map } : null;
    case "ordering":
      return { order: d.order };
    default:
      return null;
  }
}

function AnswerInput({
  q,
  draft,
  setDraft,
  feedback,
  onSubmit,
  autoFocus,
}: {
  q: PublicQuestion | PublicStep;
  draft: Draft;
  setDraft: (d: Draft) => void;
  feedback: Feedback | null;
  onSubmit: () => void;
  autoFocus?: boolean;
}) {
  const disabled = Boolean(feedback);
  switch (q.kind) {
    case "mcq":
      return <McqInput options={q.options} value={draft.option} onChange={(option) => setDraft({ ...draft, option })} feedback={feedback} disabled={disabled} />;
    case "true_false":
      return <TrueFalseInput value={draft.bool} onChange={(bool) => setDraft({ ...draft, bool })} feedback={feedback} disabled={disabled} />;
    case "fill_blank":
      return (
        <FillBlankInput
          answerType={q.answerType}
          placeholder={q.placeholder}
          value={draft.text}
          onChange={(text) => setDraft({ ...draft, text })}
          onSubmit={onSubmit}
          feedback={feedback}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      );
    case "matching":
      return <MatchingInput left={q.left} right={q.right} value={draft.map} onChange={(map) => setDraft({ ...draft, map })} feedback={feedback} disabled={disabled} />;
    case "ordering":
      return <OrderingInput items={q.items} value={draft.order} onChange={(order) => setDraft({ ...draft, order })} feedback={feedback} disabled={disabled} />;
    default:
      return null;
  }
}

/** Renders `___` in prompts as a visible blank. */
function promptMd(s: string) {
  return s.replace(/_{3,}/g, "\\_\\_\\_\\_\\_");
}

export function FeedbackPanel({
  feedback,
  onContinue,
  continueLabel,
  variant,
}: {
  feedback: Feedback;
  onContinue?: () => void;
  continueLabel: string;
  variant: "inline" | "sheet";
}) {
  const good = feedback.correct;
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={variant === "sheet" ? { y: "100%" } : { opacity: 0, y: 8 }}
      animate={variant === "sheet" ? { y: 0 } : { opacity: 1, y: 0 }}
      exit={variant === "sheet" ? { y: "100%" } : { opacity: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 36 }}
      className={cn(
        variant === "sheet" ? "fixed inset-x-0 bottom-0 z-40 border-t-[3px] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4" : "mt-4 rounded-md border-[1.5px] p-4",
        good ? "border-success bg-success-soft" : "border-danger bg-danger-soft",
      )}
    >
      <div className={cn(variant === "sheet" && "mx-auto max-w-3xl")}>
        <div className="flex items-start gap-3">
          <motion.span initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
            {good ? <CheckCircle2 className="size-6 text-success" /> : <XCircle className="size-6 text-danger" />}
          </motion.span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className={cn("text-[1.15rem] font-bold smallcaps", good ? "text-success" : "text-danger")}>{good ? "Bonne réponse !" : "Pas tout à fait."}</p>
            {!good && feedback.correctAnswer && (
              <div className="text-sm">
                <span className="font-bold text-danger">Réponse attendue : </span>
                <Md inline>{feedback.correctAnswer}</Md>
              </div>
            )}
            {feedback.explanation && (
              <div className="max-h-[40vh] overflow-y-auto text-[0.95rem] text-foreground/90">
                <Md>{feedback.explanation}</Md>
              </div>
            )}
          </div>
        </div>
        {onContinue && (
          <div className="mt-3 flex justify-end">
            <Button size="lg" onClick={onContinue} autoFocus className={cn("h-10 min-w-36 text-[1rem] text-white dark:text-[#0b1322]", good ? "bg-success hover:bg-success/90" : "bg-danger hover:bg-danger/90")}>
              {continueLabel}
              <ArrowRight />
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * One question of any kind, checked on the server. For "steps" questions the stages are
 * answered one after another; each stage is checked before the next one appears.
 */
export function QuestionCard({
  question,
  check,
  onDone,
  variant = "inline",
  continueLabel = "Continuer",
  autoFocus,
  className,
}: {
  question: { id: string; data: PublicQuestion };
  check: CheckFn;
  onDone?: (correct: boolean) => void;
  variant?: "inline" | "sheet";
  continueLabel?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const q = question.data;
  const isSteps = q.kind === "steps";
  const [step, setStep] = useState(0);
  const current: PublicQuestion | PublicStep = isSteps ? q.steps[step] : q;
  const [draft, setDraft] = useState<Draft>(() => initialDraft(current));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [stepResults, setStepResults] = useState<{ correct: boolean; feedback: Feedback }[]>([]);
  const [pending, start] = useTransition();
  const given = toGiven(current, draft);

  const submit = useCallback(() => {
    if (!given || feedback || pending) return;
    start(async () => {
      const last = isSteps ? step === q.steps.length - 1 : true;
      const res = await check(given, isSteps ? step : undefined, last);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setFeedback(res.feedback);
      if (isSteps) setStepResults((r) => [...r, { correct: res.feedback.correct, feedback: res.feedback }]);
    });
  }, [given, feedback, pending, check, isSteps, step, q]);

  const next = () => {
    if (!feedback) return;
    if (isSteps && step < q.steps.length - 1) {
      const n = step + 1;
      setStep(n);
      setDraft(initialDraft(q.steps[n]));
      setFeedback(null);
      return;
    }
    const allCorrect = isSteps ? [...stepResults].every((s) => s.correct) : feedback.correct;
    onDone?.(allCorrect);
  };

  const lastStep = !isSteps || step === q.steps.length - 1;

  return (
    <div className={cn("space-y-4", className)}>
      <Md className="text-[1.08rem]">{promptMd(q.prompt)}</Md>

      {isSteps && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5" aria-label={`Étape ${step + 1} sur ${q.steps.length}`}>
            {q.steps.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 transition-colors",
                  i < stepResults.length ? (stepResults[i].correct ? "bg-success" : "bg-danger") : i === step ? "bg-brand" : "bg-muted",
                )}
              />
            ))}
          </div>
          {/* previous stages stay visible, collapsed */}
          {stepResults.slice(0, feedback ? step : step).map((r, i) => (
            <div key={i} className="border-l-[3px] border-border pl-3 text-[0.95rem]">
              <span className={cn("mr-2 font-bold", r.correct ? "text-success" : "text-danger")}>Étape {i + 1} {r.correct ? "✓" : "✗"}</span>
              <Md inline>{(q.steps[i] as PublicStep).prompt}</Md>
            </div>
          ))}
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="border-l-[3px] border-primary pl-4">
              <p className="mb-2 font-bold text-primary">
                Étape {step + 1} / {q.steps.length} :
              </p>
              <Md className="mb-3">{promptMd((current as PublicStep).prompt)}</Md>
              <AnswerInput q={current} draft={draft} setDraft={setDraft} feedback={feedback} onSubmit={submit} autoFocus />
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {!isSteps && <AnswerInput q={current} draft={draft} setDraft={setDraft} feedback={feedback} onSubmit={submit} autoFocus={autoFocus} />}

      {!feedback && (
        <div className="flex justify-end">
          <Button size="lg" onClick={submit} disabled={!given || pending} className="h-10 min-w-36 text-[1rem]">
            {pending ? <Loader2 className="animate-spin" /> : null}
            Vérifier
          </Button>
        </div>
      )}

      <AnimatePresence>
        {feedback && (
          <FeedbackPanel
            key={`fb-${step}`}
            feedback={feedback}
            variant={variant}
            continueLabel={lastStep ? continueLabel : "Étape suivante"}
            onContinue={onDone || !lastStep ? next : undefined}
          />
        )}
      </AnimatePresence>
      {variant === "sheet" && feedback && <div className="h-56" aria-hidden />}
    </div>
  );
}
