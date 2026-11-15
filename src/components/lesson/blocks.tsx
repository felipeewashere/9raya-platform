"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Eye, EyeOff, Lightbulb, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Md } from "@/components/math/md";
import { ImportantBox, SectionTitle } from "@/components/notes";
import { Button } from "@/components/ui/button";
import { QuestionCard } from "@/components/quiz/question-card";
import { XpPop } from "@/components/rewards/rewards";
import { answerCheckpoint } from "@/lib/actions/learning";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import { stripNumber } from "./strip-number";
import { Simulation } from "@/components/sim/simulation";
import type { LessonBlock } from "@/lib/data/lesson";
import type { PublicQuestion } from "@/lib/quiz/types";

type Step = { md: string; why?: string };

const THEOREM_LABEL: Record<string, string> = {
  theoreme: "Théorème",
  proposition: "Proposition",
  propriete: "Propriété",
  lemme: "Lemme",
  corollaire: "Corollaire",
};

export function headingId(text: string, index: number) {
  return (
    "s-" +
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) +
    "-" +
    index
  );
}

type Tone = "definition" | "theorem" | "example" | "remark" | "intuition" | "exercise" | "proof";

/**
 * A block of the notes. Label first, as in printed course notes:
 *   **Définition —** title (blue), **Théorème —** (blue, framed), *Exemple :* / *Remarque :* (red),
 *   *En clair :* (gold), *Démonstration.* (italic).
 */
function Box({ tone, label, title, children, added }: { tone: Tone; label: string; title?: string; children: React.ReactNode; added?: boolean }) {
  const frame: Record<Tone, string> = {
    definition: "border-l-[5px] border-primary bg-primary/[0.08] px-5 py-4",
    theorem: "border-2 border-[var(--rule)] bg-card px-5 py-4 shadow-[5px_5px_0_0_var(--rule)]",
    example: "border-l-[5px] border-accent-2 bg-accent-2/[0.09] px-5 py-4",
    remark: "border-l-[5px] border-reward bg-reward/[0.14] px-5 py-4",
    intuition: "border-l-[5px] border-reward bg-reward/[0.14] px-5 py-4",
    exercise: "border-2 border-[var(--rule)] bg-primary/[0.05] px-5 py-4",
    proof: "border-l-[5px] border-foreground/30 bg-muted/70 px-5 py-4",
  };
  const labelTone: Record<Tone, string> = {
    definition: "text-definition",
    theorem: "text-theorem",
    example: "text-example",
    remark: "text-reward-foreground",
    intuition: "text-reward-foreground",
    exercise: "text-primary",
    proof: "italic text-foreground",
  };
  const colon = tone === "example" || tone === "remark" || tone === "intuition";
  // the title already names the block ("Définition 1 (magma)"): don't repeat the label
  const titled = title && title.toLowerCase().startsWith(label.toLowerCase().slice(0, 6));
  return (
    <section className={cn("relative", frame[tone])}>
      <header className="mb-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[1.05rem]">
        {titled ? (
          <span className={cn("font-bold", labelTone[tone])}>{title}</span>
        ) : (
          <>
            <span className={cn("font-bold", labelTone[tone])}>
              {label}
              {colon ? " :" : tone === "proof" ? "." : title ? " —" : ""}
            </span>
            {title && <span className="font-bold">{title}</span>}
          </>
        )}
        {added && (
          <span className="ml-auto text-[0.8rem] text-muted-foreground smallcaps" title="Ajouté pour t'aider (ne figure pas dans le polycopié)">
            complément
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

/** Steps revealed one at a time ("Étape suivante"), with optional justification. */
function StepReveal({ steps, kind }: { steps: Step[]; kind: "proof" | "solution" }) {
  const [shown, setShown] = useState(1);
  const done = shown >= steps.length;
  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        <AnimatePresence initial={false}>
          {steps.slice(0, shown).map((s, i) => (
            <motion.li key={i} initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="flex gap-3">
              <span className="mt-[0.2em] w-5 shrink-0 text-right font-bold tabular-nums text-primary">{i + 1}.</span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <Md>{s.md}</Md>
                {s.why && (
                  <p className="flex gap-1.5 text-[0.95rem] text-muted-foreground">
                    <Lightbulb className="mt-1 size-3.5 shrink-0 text-reward-foreground" />
                    <span>
                      <span className="italic">Pourquoi :</span> <Md inline>{s.why}</Md>
                    </span>
                  </p>
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      <div className="flex flex-wrap items-center gap-2 pl-8">
        {!done ? (
          <>
            <Button size="sm" onClick={() => setShown((n) => n + 1)}>
              Étape suivante <ChevronRight />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShown(steps.length)} className="text-muted-foreground">
              Tout afficher
            </Button>
            <span className="text-[0.85rem] tabular-nums text-muted-foreground">
              {shown} / {steps.length}
            </span>
          </>
        ) : (
          <>
            {kind === "proof" && (
              <span className="text-[0.95rem] italic text-muted-foreground">
                Fin de la démonstration <span className="not-italic text-foreground">∎</span>
              </span>
            )}
            {steps.length > 1 && (
              <Button size="sm" variant="ghost" onClick={() => setShown(1)} className="text-muted-foreground">
                <RotateCcw /> Revoir pas à pas
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProofBlock({ title, steps, added }: { title?: string; steps: Step[]; added: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Box tone="proof" label="Démonstration" title={title} added={added}>
      {open ? (
        <StepReveal steps={steps} kind="proof" />
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="border-primary/40 text-primary hover:bg-brand-soft hover:text-primary">
          Démontrer pas à pas ({steps.length} étape{steps.length > 1 ? "s" : ""})
        </Button>
      )}
    </Box>
  );
}

function SolutionToggle({ steps }: { steps: Step[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} className="-ml-2 text-primary hover:text-primary">
        {open ? <EyeOff /> : <Eye />}
        {open ? "Masquer la correction" : "Voir la correction"}
      </Button>
      {open && (
        <div className="mt-3">
          <StepReveal steps={steps} kind="solution" />
        </div>
      )}
    </div>
  );
}

function Checkpoint({ question }: { question: { id: string; data: PublicQuestion } }) {
  const [xp, setXp] = useState(0);
  return (
    <ImportantBox tone="blue" title="Vérifie ta compréhension" aria-label="Vérifie ta compréhension" aside={xp > 0 ? <XpPop amount={xp} /> : undefined}>
      <QuestionCard
        question={question}
        variant="inline"
        continueLabel="J'ai compris"
        check={async (given, step, last) => {
          const r = await answerCheckpoint(question.id, given, step, last);
          if (!r.ok) return r;
          if (r.data.xp) setXp(r.data.xp);
          for (const a of r.data.achievements) toast.success(`Succès débloqué : ${a.title}`, { description: a.description });
          return { ok: true, feedback: r.data.feedback };
        }}
      />
    </ImportantBox>
  );
}

export function LessonBlockView({ block, index, number }: { block: LessonBlock; index: number; /** section number shown in the heading square */ number?: number }) {
  const d = block.data as Record<string, unknown>;
  const added = block.origin === "added";
  switch (block.type) {
    case "heading":
      return (
        <SectionTitle number={number} id={headingId(String(d.text), index)} className="scroll-mt-24 pt-5">
          {stripNumber(String(d.text))}
        </SectionTitle>
      );
    case "text":
      return <Md>{String(d.md)}</Md>;
    case "definition":
      return (
        <Box tone="definition" label="Définition" title={d.title as string | undefined} added={added}>
          <Md>{String(d.md)}</Md>
        </Box>
      );
    case "theorem":
      return (
        <Box tone="theorem" label={THEOREM_LABEL[String(d.kind)] ?? "Proposition"} title={d.title as string | undefined} added={added}>
          <Md>{String(d.md)}</Md>
        </Box>
      );
    case "proof":
      return <ProofBlock title={d.title as string | undefined} steps={(d.steps as Step[]) ?? []} added={added} />;
    case "example":
      return (
        <Box tone="example" label="Exemple" title={d.title as string | undefined} added={added}>
          <Md>{String(d.md)}</Md>
          {Array.isArray(d.steps) && d.steps.length > 0 && <SolutionToggle steps={d.steps as Step[]} />}
        </Box>
      );
    case "remark":
      return (
        <Box tone="remark" label="Remarque" added={added}>
          <Md>{String(d.md)}</Md>
        </Box>
      );
    case "intuition":
      return (
        <Box tone="intuition" label="En clair">
          <Md>{String(d.md)}</Md>
        </Box>
      );
    case "exercise":
      return (
        <Box tone="exercise" label="Exercice" title={d.title as string | undefined} added={added}>
          <Md>{String(d.md)}</Md>
          {Array.isArray(d.solution) && d.solution.length > 0 && <SolutionToggle steps={d.solution as Step[]} />}
        </Box>
      );
    case "figure":
      return (
        <figure className="my-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={withBase(String(d.src))} alt={String(d.alt ?? "")} loading="lazy" className="fig mx-auto block h-auto max-h-[520px] w-full max-w-[720px] object-contain" />
          {typeof d.caption === "string" && <figcaption className="mt-2 text-center text-[0.95rem] text-muted-foreground">{d.caption}</figcaption>}
        </figure>
      );
    case "simulation":
      return <Simulation scene={String(d.scene)} params={(d.params as Record<string, unknown> | undefined) ?? undefined} caption={typeof d.caption === "string" ? d.caption : undefined} />;
    case "interactive":
      // "Manipule" widgets were removed from the courses at the student's request
      return null;
    case "checkpoint":
      return block.question ? <Checkpoint question={block.question} /> : null;
    default:
      return null;
  }
}
