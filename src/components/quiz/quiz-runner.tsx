"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Flame, Loader2, LockOpen, RotateCcw, X } from "lucide-react";
import { DocTitle, EmDashList, FooterBand, LeaderRow, NoteLabel, NumberSquare, Watermark } from "@/components/notes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { QuestionCard, FeedbackPanel } from "./question-card";
import { AchievementQueue, CountUp, ProgressBar, fireConfetti } from "@/components/rewards/rewards";
import { Md } from "@/components/math/md";
import { answerQuizQuestion, finishQuiz, getAttemptReview, startQuiz, type QuizSummary } from "@/lib/actions/learning";
import { PASS_RATIO, XP } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { refreshData } from "@/lib/use-data";
import type { PublicQuestion, Feedback } from "@/lib/quiz/types";

type Q = { id: string; kind: string; data: PublicQuestion };

export function QuizRunner({
  lessonId,
  lessonTitle,
  questions,
  backHref,
  nextHref,
  courseHref,
  alreadyCompleted,
}: {
  lessonId: string;
  lessonTitle: string;
  questions: Q[];
  backHref: string;
  nextHref: string | null;
  courseHref: string;
  alreadyCompleted: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"intro" | "running" | "finishing" | "results" | "review">("intro");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [combo, setCombo] = useState(0);
  const [summary, setSummary] = useState<QuizSummary | null>(null);
  const [review, setReview] = useState<{ questionId: string; data: PublicQuestion; explanation: string; feedback: Feedback }[] | null>(null);
  const [quit, setQuit] = useState(false);
  const [pending, start] = useTransition();

  const begin = () =>
    start(async () => {
      const r = await startQuiz(lessonId);
      if (!r.ok) return void toast.error(r.error);
      setAttemptId(r.data.attemptId);
      setI(0);
      setResults([]);
      setCombo(0);
      setSummary(null);
      setReview(null);
      setPhase("running");
    });

  const finish = (id: string) => {
    setPhase("finishing");
    start(async () => {
      const r = await finishQuiz(id);
      if (!r.ok) {
        toast.error(r.error);
        setPhase("running");
        return;
      }
      setSummary(r.data);
      setPhase("results");
      if (r.data.passed) fireConfetti(r.data.score === r.data.total ? "big" : "small");
      refreshData();
    });
  };

  const onDone = (correct: boolean) => {
    const next = [...results, correct];
    setResults(next);
    setCombo((c) => (correct ? c + 1 : 0));
    if (i + 1 < questions.length) setI(i + 1);
    else if (attemptId) finish(attemptId);
  };

  // warn before leaving a running quiz
  useEffect(() => {
    if (phase !== "running") return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [phase]);

  if (phase === "intro")
    return (
      <div className="relative isolate mx-auto flex min-h-dvh max-w-xl flex-col px-5 pt-6">
        <Watermark className="absolute right-[-10%] top-[16%] -z-10 w-[min(90vw,560px)]" />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="my-auto w-full space-y-7 py-10">
          <DocTitle
            kicker="Quiz de fin de leçon"
            title={lessonTitle}
            subtitleLabel="Barème :"
            subtitle={`${questions.length} questions · réussite à ${Math.round(PASS_RATIO * 100)} %`}
          />
          <EmDashList className="mx-auto max-w-md">
            <li>{alreadyCompleted ? "Leçon déjà validée : entraîne-toi librement." : `+${XP.lessonComplete + XP.quizPass} XP en réussissant, +${XP.quizPerfect} XP si tout est juste.`}</li>
            <li>Chaque réponse est corrigée et expliquée.</li>
            <li>
              <NoteLabel tone="red">Important :</NoteLabel> seule ta première réponse à chaque question compte.
            </li>
          </EmDashList>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button size="lg" onClick={begin} disabled={pending || !questions.length} className="h-11 px-6 text-[1.05rem]">
              {pending ? <Loader2 className="animate-spin" /> : null} Commencer
            </Button>
            <Button asChild size="lg" variant="ghost" className="h-11 text-[1.05rem] text-primary">
              <Link href={backHref}>Relire la leçon</Link>
            </Button>
          </div>
        </motion.div>
        <FooterBand className="mb-5" label="Quiz" page={`${questions.length} questions`} />
      </div>
    );

  if (phase === "running" || phase === "finishing") {
    const q = questions[i];
    return (
      <div className="min-h-dvh">
        <header className="sticky top-0 z-20 border-b border-primary/25 bg-background">
          <div className="mx-auto flex h-12 max-w-3xl items-center gap-3 px-4">
            <Button variant="ghost" size="icon" onClick={() => setQuit(true)} aria-label="Quitter le quiz">
              <X className="size-5" />
            </Button>
            <ProgressBar value={(i + (phase === "finishing" ? 1 : 0)) / questions.length} className="h-2" label="Progression du quiz" />
            <span className="w-12 shrink-0 text-right font-bold tabular-nums">
              {Math.min(i + 1, questions.length)}/{questions.length}
            </span>
            <AnimatePresence>
              {combo >= 2 && (
                <motion.span key={combo} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} className="flex shrink-0 items-center gap-1 rounded-[3px] bg-reward-soft px-2 py-0.5 text-sm font-bold text-reward-foreground">
                  <Flame className="size-4" /> {combo}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 pb-40 pt-8">
          {phase === "finishing" ? (
            <div className="grid place-items-center gap-3 py-24 italic text-muted-foreground">
              <Loader2 className="size-8 animate-spin" /> Calcul de ton score…
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={q.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
                <p className="mb-3 flex items-baseline gap-2 font-bold uppercase tracking-[0.03em] text-primary">
                  <NumberSquare className="translate-y-[0.1em] text-[0.8rem]">{i + 1}</NumberSquare>
                  {{ mcq: "Choix multiple", true_false: "Vrai ou faux", fill_blank: "Complète", matching: "Associe", ordering: "Remets dans l'ordre", steps: "Problème en étapes" }[q.kind] ?? "Question"}
                </p>
                <QuestionCard
                  question={q}
                  variant="sheet"
                  autoFocus
                  continueLabel={i + 1 < questions.length ? "Continuer" : "Voir mon score"}
                  check={async (given, step) => {
                    const r = await answerQuizQuestion(attemptId!, q.id, given, step);
                    return r.ok ? { ok: true, feedback: r.data.feedback } : r;
                  }}
                  onDone={onDone}
                />
              </motion.div>
            </AnimatePresence>
          )}
        </main>
        <AlertDialog open={quit} onOpenChange={setQuit}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Quitter le quiz ?</AlertDialogTitle>
              <AlertDialogDescription>Ta progression dans ce quiz sera perdue. Tu pourras le recommencer quand tu veux.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Continuer le quiz</AlertDialogCancel>
              <AlertDialogAction onClick={() => router.push(backHref)}>Quitter</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  if (phase === "review" && review)
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-[1.8rem] font-bold text-primary smallcaps">Revoir mes erreurs</h1>
          <Button variant="ghost" onClick={() => setPhase("results")}>
            Retour au score
          </Button>
        </div>
        {review.length === 0 && <p className="italic text-muted-foreground">Aucune erreur, bravo !</p>}
        {review.map((r, k) => (
          <section key={r.questionId} className="space-y-3 border-t border-primary/25 pt-4">
            <p className="flex items-baseline gap-2 font-bold uppercase tracking-[0.03em] text-danger">
              <NumberSquare tone="red" className="translate-y-[0.1em] text-[0.8rem]">{k + 1}</NumberSquare> Erreur
            </p>
            <Md className="font-medium">{r.data.prompt.replace(/_{3,}/g, "\\_\\_\\_")}</Md>
            <FeedbackPanel feedback={{ ...r.feedback, correct: false, explanation: r.explanation }} variant="inline" continueLabel="" />
          </section>
        ))}
        <Button onClick={begin} disabled={pending} className="h-11 w-full text-[1.05rem]" size="lg">
          <RotateCcw /> Recommencer le quiz
        </Button>
      </div>
    );

  // results
  const s = summary!;
  const pct = s.score / s.total;
  return (
    <div className="relative isolate mx-auto flex min-h-dvh max-w-xl flex-col px-5 pt-6">
      <Watermark className="absolute right-[-10%] top-[12%] -z-10 w-[min(90vw,560px)]" />
      <div className="my-auto w-full space-y-6 py-10 text-center">
        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 18 }}>
          <p className="font-bold leading-none text-primary">
            <span className="text-[5.5rem]">
              <CountUp value={s.score} />
            </span>
            <span className="text-[2.5rem] text-muted-foreground">/{s.total}</span>
          </p>
          <ProgressBar value={pct} tone={s.passed ? "success" : "primary"} className="mx-auto mt-3 max-w-xs" label="Score" />
          <p className="mt-1 text-[0.95rem] tabular-nums text-muted-foreground">{Math.round(pct * 100)} %</p>
        </motion.div>
        <div className="space-y-1">
          <h1 className={cn("text-[2rem] font-bold smallcaps", s.passed ? "text-success" : "text-foreground")}>
            {s.score === s.total ? "Parfait !" : s.passed ? "Quiz réussi !" : "Presque !"}
          </h1>
          <p className="text-muted-foreground">
            {s.passed
              ? s.lessonCompleted
                ? "Leçon validée. Continue sur ta lancée !"
                : "Tu maîtrises cette leçon."
              : `Il faut ${Math.ceil(PASS_RATIO * s.total)} bonnes réponses pour valider. Relis les explications et réessaie.`}
          </p>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mx-auto max-w-sm text-left">
          <LeaderRow label={<NoteLabel tone="gold">XP gagnés</NoteLabel>} value={<>+<CountUp value={s.xpGained} /></>} />
          <LeaderRow
            label={
              <span className="inline-flex items-center gap-1.5">
                Série <Flame className={cn("size-4", s.streak.active_today ? "fill-reward text-danger" : "text-muted-foreground")} />
              </span>
            }
            value={`${s.streak.current_streak} jour(s)`}
          />
          <LeaderRow label={`Niveau ${s.level}`} value={`${Math.round(s.levelProgress * 100)} %`} />
          <ProgressBar value={s.levelProgress} className="mt-1 h-1" label="Progression du niveau" />
        </motion.div>

        <AnimatePresence>
          {s.leveledUp && (
            <motion.p initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 }} className="rounded-md bg-primary px-4 py-2.5 font-bold text-primary-foreground smallcaps">
              Niveau supérieur ! Tu passes au niveau {s.level}.
            </motion.p>
          )}
        </AnimatePresence>

        {s.unlockedChapter && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, type: "spring" }} className="flex items-center gap-3 rounded-md border-[1.5px] border-primary bg-brand-soft p-4 text-left">
            <motion.span initial={{ rotate: -30 }} animate={{ rotate: [-30, 15, 0] }} transition={{ delay: 1.1, duration: 0.6 }} className="grid size-10 shrink-0 place-items-center rounded-[3px] bg-primary text-primary-foreground">
              <LockOpen className="size-5" />
            </motion.span>
            <div>
              <p className="font-bold text-primary">Nouveau chapitre débloqué :</p>
              <p>
                Chapitre {s.unlockedChapter.number} — {s.unlockedChapter.title}
              </p>
            </div>
          </motion.div>
        )}

        <div className="flex flex-col gap-2">
          {s.passed && nextHref ? (
            <Button asChild size="lg" className="h-11 text-[1.05rem]">
              <Link href={nextHref}>
                Leçon suivante <ArrowRight />
              </Link>
            </Button>
          ) : !s.passed ? (
            <Button size="lg" onClick={begin} disabled={pending} className="h-11 text-[1.05rem]">
              <RotateCcw /> Réessayer
            </Button>
          ) : (
            <Button asChild size="lg" className="h-11 text-[1.05rem]">
              <Link href={courseHref}>Retour au parcours</Link>
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="lg"
              className="h-10"
              disabled={pending || s.wrong.length === 0}
              onClick={() =>
                start(async () => {
                  if (!attemptId) return;
                  const r = await getAttemptReview(attemptId);
                  if (!r.ok) return void toast.error(r.error);
                  setReview(r.data);
                  setPhase("review");
                })
              }
            >
              Revoir mes erreurs ({s.wrong.length})
            </Button>
            <Button asChild variant="outline" size="lg" className="h-10">
              <Link href={backHref}>Relire la leçon</Link>
            </Button>
          </div>
        </div>
      </div>
      <FooterBand className="mb-5" label={lessonTitle} page={`${s.score} / ${s.total}`} />
      {s.achievements.length > 0 && <AchievementQueue items={s.achievements} />}
    </div>
  );
}
