"use client";

import { Component, useMemo, useState } from "react";
import { Clock, ListChecks, TriangleAlert } from "lucide-react";
import { LessonBlockView } from "@/components/lesson/blocks";
import { QuestionCard, type CheckFn } from "@/components/quiz/question-card";
import { gradeQuestion, gradeStep } from "@/lib/quiz/grade";
import { splitQuestion } from "@/lib/quiz/serialize";
import type { Block, Lesson, Question } from "@/content/schema";
import type { LessonBlock } from "@/lib/data/lesson";

/** Catches rendering errors of one block (e.g. a widget with invalid props) so the preview keeps working. */
class BlockBoundary extends Component<{ children: React.ReactNode; label: string }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  render() {
    if (this.state.error)
      return (
        <div role="alert" className="flex gap-2 rounded-xl border border-danger/40 bg-danger-soft p-4 text-sm text-danger">
          <TriangleAlert className="size-4 shrink-0" />
          <span>
            {this.props.label} : impossible d&apos;afficher ce bloc ({this.state.error}).
          </span>
        </div>
      );
    return this.props.children;
  }
}

/** Grades locally from the in-memory answers (same grading code as the server). */
function localCheck(q: Question, seed: string): { data: ReturnType<typeof splitQuestion>["data"]; check: CheckFn } {
  const { data, answer, explanation } = splitQuestion(q, seed);
  return {
    data,
    check: async (given, stepIndex) => {
      try {
        if (answer.kind === "steps" && data.kind === "steps") return { ok: true, feedback: gradeStep(data, answer, stepIndex ?? 0, given) };
        return { ok: true, feedback: gradeQuestion(data, answer, given, explanation) };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Correction impossible." };
      }
    },
  };
}

export function PreviewQuestion({ q, seed, label }: { q: Question; seed: string; label?: string }) {
  const { data, check } = useMemo(() => localCheck(q, seed), [q, seed]);
  const [round, setRound] = useState(0);
  // "continue" restarts the question, so the admin can try every answer
  return <QuestionCard key={`${round}:${JSON.stringify(data)}`} question={{ id: seed, data }} variant="inline" check={check} continueLabel={label ?? "Réessayer"} onDone={() => setRound((r) => r + 1)} />;
}

function PreviewCheckpoint({ q, seed }: { q: Question; seed: string }) {
  return (
    <section className="relative rounded-xl border-2 border-dashed border-primary/30 bg-brand-soft/40 p-4 sm:p-5" aria-label="Vérifie ta compréhension">
      <header className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
        <ListChecks className="size-4" />
        <span className="uppercase tracking-wide">Vérifie ta compréhension</span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-muted-foreground">corrigé localement</span>
      </header>
      <PreviewQuestion q={q} seed={seed} label="J'ai compris" />
    </section>
  );
}

function asLessonBlock(b: Block, i: number): LessonBlock {
  const { type, origin, ...data } = b;
  return { id: `preview-${i}`, position: i + 1, type, origin, data: data as Record<string, unknown>, question: null };
}

/**
 * The lesson as students see it: same header, same block components (LessonBlockView) and the
 * same shuffles as after saving (seeded by chapter slug / lesson slug / question key).
 */
export function LessonPreview({ lesson, chapterSlug, chapterNumber, showQuiz = true }: { lesson: Lesson; chapterSlug: string; chapterNumber?: number; showQuiz?: boolean }) {
  let cp = 0;
  return (
    <article className="mx-auto max-w-[46rem] space-y-5">
      <header className="space-y-2">
        {chapterNumber !== undefined && <p className="text-sm font-medium text-primary">Chapitre {chapterNumber}{lesson.number ? ` · ${lesson.number}` : ""}</p>}
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{lesson.title || "Sans titre"}</h1>
        {lesson.summary && <p className="text-lg text-muted-foreground">{lesson.summary}</p>}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-4" /> {lesson.estimatedMinutes} min
          </span>
          <span>{lesson.quiz.length} questions au quiz final</span>
        </div>
      </header>
      {lesson.blocks.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">Le contenu de cette leçon arrive bientôt.</p>}
      {lesson.blocks.map((b, i) => {
        if (b.type === "checkpoint") {
          cp++;
          const seed = `${chapterSlug}/${lesson.slug}/cp-${cp}`;
          return (
            <BlockBoundary key={i} label={`Bloc ${i + 1}`}>
              <PreviewCheckpoint q={b.question} seed={seed} />
            </BlockBoundary>
          );
        }
        return (
          <BlockBoundary key={`${i}-${JSON.stringify(b).length}`} label={`Bloc ${i + 1}`}>
            <LessonBlockView block={asLessonBlock(b, i)} index={i} />
          </BlockBoundary>
        );
      })}
      {showQuiz && lesson.quiz.length > 0 && (
        <section className="space-y-4 rounded-2xl border-2 border-primary/20 bg-card p-4 sm:p-6">
          <h2 className="text-xl font-bold">Quiz de fin de leçon</h2>
          <p className="text-sm text-muted-foreground">Aperçu : les réponses sont corrigées localement et rien n&apos;est enregistré.</p>
          <ol className="space-y-6">
            {lesson.quiz.map((q, i) => (
              <li key={i} className="space-y-2 border-t pt-4 first:border-0 first:pt-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Question {i + 1} / {lesson.quiz.length}
                </p>
                <BlockBoundary label={`Question ${i + 1}`}>
                  <PreviewQuestion q={q} seed={`${chapterSlug}/${lesson.slug}/quiz-${i + 1}`} />
                </BlockBoundary>
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}
