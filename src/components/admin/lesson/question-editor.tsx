"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Question } from "@/content/schema";
import { MdField } from "./md-field";
import { issueAt, IssueList, subIssues, type Issue } from "./issues";

type Mcq = Extract<Question, { kind: "mcq" }>;
type FillBlank = Extract<Question, { kind: "fill_blank" }>;
type Steps = Extract<Question, { kind: "steps" }>;
type StepItem = Steps["steps"][number];
type AnswerType = FillBlank["answerType"];

export const KIND_LABEL: Record<Question["kind"], string> = {
  mcq: "QCM",
  true_false: "Vrai / Faux",
  fill_blank: "Réponse à compléter",
  matching: "Association",
  ordering: "Remise en ordre",
  steps: "Problème en étapes",
};

const ANSWER_TYPE: Record<AnswerType, string> = { text: "Texte", number: "Nombre", expression: "Expression" };

const LETTERS = "abcdefghij";
const nextOptionId = (ids: string[]) => [...LETTERS].find((l) => !ids.includes(l)) ?? `o${ids.length + 1}`;

/** A new question of `kind`, keeping the prompt and explanation of `from`. */
export function defaultQuestion(kind: Question["kind"], from?: Partial<Pick<Question, "prompt" | "explanation">>): Question {
  const prompt = from?.prompt ?? "";
  const explanation = from?.explanation ?? "";
  switch (kind) {
    case "mcq":
      return { kind, prompt, explanation, answer: "a", options: [{ id: "a", md: "" }, { id: "b", md: "" }, { id: "c", md: "" }] };
    case "true_false":
      return { kind, prompt, explanation, answer: true };
    case "fill_blank":
      return { kind, prompt: prompt || "___", explanation, answerType: "number", accepted: [""] };
    case "matching":
      return { kind, prompt, explanation, pairs: [{ left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }] };
    case "ordering":
      return { kind, prompt, explanation, items: ["", "", ""] };
    case "steps":
      return {
        kind,
        prompt,
        explanation,
        steps: [
          { kind: "mcq", prompt: "", options: [{ id: "a", md: "" }, { id: "b", md: "" }], answer: "a", explanation: "" },
          { kind: "fill_blank", prompt: "", answerType: "number", accepted: [""], explanation: "" },
        ],
      };
  }
}

function move<T>(list: T[], i: number, d: -1 | 1) {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function RowControls({ i, n, min, onMove, onRemove, label }: { i: number; n: number; min: number; onMove: (d: -1 | 1) => void; onRemove: () => void; label: string }) {
  return (
    <div className="flex shrink-0 items-center">
      <Button type="button" variant="ghost" size="icon-xs" disabled={i === 0} onClick={() => onMove(-1)} aria-label={`Monter ${label}`}>
        <ArrowUp />
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" disabled={i === n - 1} onClick={() => onMove(1)} aria-label={`Descendre ${label}`}>
        <ArrowDown />
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" disabled={n <= min} onClick={onRemove} aria-label={`Retirer ${label}`}>
        <X />
      </Button>
    </div>
  );
}

function OptionsEditor({
  options,
  answer,
  onChange,
  issues,
  name,
}: {
  options: Mcq["options"];
  answer: string;
  onChange: (options: Mcq["options"], answer: string) => void;
  issues: Issue[];
  name: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium">Options (coche la bonne réponse)</legend>
      {options.map((o, i) => (
        <div key={i} className={cn("flex items-start gap-2 rounded-lg border p-2", o.id === answer && "border-success/50 bg-success-soft/40")}>
          <input
            type="radio"
            name={name}
            checked={o.id === answer}
            onChange={() => onChange(options, o.id)}
            className="mt-2 size-4 shrink-0 accent-[var(--success)]"
            aria-label={`Option ${o.id} correcte`}
          />
          <span className="mt-1.5 w-5 shrink-0 font-mono text-sm font-semibold">{o.id}</span>
          <div className="min-w-0 flex-1">
            <MdField compact label={`Option ${o.id}`} value={o.md} onChange={(md) => onChange(options.map((x, k) => (k === i ? { ...x, md } : x)), answer)} error={issueAt(issues, ["options", i, "md"])} />
          </div>
          <RowControls
            i={i}
            n={options.length}
            min={2}
            label={`l'option ${o.id}`}
            onMove={(d) => onChange(move(options, i, d), answer)}
            onRemove={() => {
              const next = options.filter((_, k) => k !== i);
              onChange(next, answer === o.id ? next[0].id : answer);
            }}
          />
        </div>
      ))}
      {options.length < 6 && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...options, { id: nextOptionId(options.map((o) => o.id)), md: "" }], answer)}>
          <Plus /> Option
        </Button>
      )}
    </fieldset>
  );
}

function AcceptedEditor({
  answerType,
  accepted,
  variables,
  onChange,
  issues,
}: {
  answerType: AnswerType;
  accepted: string[];
  variables?: string[];
  onChange: (v: { answerType: AnswerType; accepted: string[]; variables?: string[] }) => void;
  issues: Issue[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Type de réponse</Label>
        <Select value={answerType} onValueChange={(t) => onChange({ answerType: t as AnswerType, accepted, variables: t === "expression" ? (variables ?? ["x"]) : variables })}>
          <SelectTrigger className="w-full" aria-label="Type de réponse">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ANSWER_TYPE) as AnswerType[]).map((k) => (
              <SelectItem key={k} value={k}>
                {ANSWER_TYPE[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {answerType === "text" && "Comparaison sans casse, accents ni espaces."}
          {answerType === "number" && "Comparaison numérique (« 0.5 », « 1/2 », « -1 »)."}
          {answerType === "expression" && "Équivalence algébrique (syntaxe mathjs : x^2 + 1)."}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label>Variables {answerType !== "expression" && <span className="font-normal text-muted-foreground">(optionnel)</span>}</Label>
        <Input
          value={(variables ?? []).join(", ")}
          placeholder="x, y"
          onChange={(e) => {
            const vs = e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            onChange({ answerType, accepted, variables: vs.length ? vs : undefined });
          }}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Réponses acceptées (une par ligne)</Label>
        <Textarea
          rows={Math.max(2, accepted.length)}
          className="font-mono text-[13px]"
          value={accepted.join("\n")}
          onChange={(e) => onChange({ answerType, accepted: e.target.value.split("\n"), variables })}
          aria-invalid={issues.some((i) => i.path[0] === "accepted") || undefined}
        />
        <IssueList issues={subIssues(issues, ["accepted"])} />
      </div>
    </div>
  );
}

function StepEditor({ step, onChange, issues, name }: { step: StepItem; onChange: (s: StepItem) => void; issues: Issue[]; name: string }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs text-muted-foreground">Type d&apos;étape</Label>
        <Select
          value={step.kind}
          onValueChange={(k) =>
            onChange(
              k === "mcq"
                ? { kind: "mcq", prompt: step.prompt, explanation: step.explanation, options: [{ id: "a", md: "" }, { id: "b", md: "" }], answer: "a" }
                : { kind: "fill_blank", prompt: step.prompt, explanation: step.explanation, answerType: "number", accepted: [""] },
            )
          }
        >
          <SelectTrigger size="sm" className="w-48" aria-label="Type d'étape">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mcq">QCM</SelectItem>
            <SelectItem value="fill_blank">Réponse à compléter</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <MdField label="Énoncé de l'étape" rows={2} value={step.prompt} onChange={(prompt) => onChange({ ...step, prompt })} error={issueAt(issues, ["prompt"])} />
      {step.kind === "mcq" ? (
        <OptionsEditor name={name} options={step.options} answer={step.answer} issues={issues} onChange={(options, answer) => onChange({ ...step, options, answer })} />
      ) : (
        <AcceptedEditor
          answerType={step.answerType}
          accepted={step.accepted}
          variables={step.variables}
          issues={issues}
          onChange={(v) => {
            const { variables: _old, ...rest } = step;
            void _old;
            onChange({ ...rest, answerType: v.answerType, accepted: v.accepted, ...(v.variables ? { variables: v.variables } : {}) });
          }}
        />
      )}
      <MdField label="Explication de l'étape" rows={2} value={step.explanation} onChange={(explanation) => onChange({ ...step, explanation })} error={issueAt(issues, ["explanation"])} />
    </div>
  );
}

/** Structured editor for one question of any kind (quiz or checkpoint). */
export function QuestionEditor({ value, onChange, issues = [], name }: { value: Question; onChange: (q: Question) => void; issues?: Issue[]; name: string }) {
  const q = value;
  const other = issues.filter((i) => !["prompt", "explanation"].includes(String(i.path[0])) || i.path.length > 1);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-sm">Type</Label>
        <Select value={q.kind} onValueChange={(k) => onChange(defaultQuestion(k as Question["kind"], q))}>
          <SelectTrigger className="w-56" aria-label="Type de question">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(KIND_LABEL) as Question["kind"][]).map((k) => (
              <SelectItem key={k} value={k}>
                {KIND_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <MdField
        label="Énoncé"
        rows={3}
        value={q.prompt}
        onChange={(prompt) => onChange({ ...q, prompt })}
        error={issueAt(issues, ["prompt"])}
        hint={q.kind === "fill_blank" ? "Écris ___ (trois tirets bas) à l'endroit du blanc." : undefined}
      />

      {q.kind === "mcq" && <OptionsEditor name={name} options={q.options} answer={q.answer} issues={issues} onChange={(options, answer) => onChange({ ...q, options, answer })} />}

      {q.kind === "true_false" && (
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-1 w-full text-sm font-medium">Bonne réponse</legend>
          {[true, false].map((b) => (
            <label key={String(b)} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm", q.answer === b && "border-success/50 bg-success-soft/40")}>
              <input type="radio" name={name} checked={q.answer === b} onChange={() => onChange({ ...q, answer: b })} className="size-4 accent-[var(--success)]" />
              {b ? "Vrai" : "Faux"}
            </label>
          ))}
        </fieldset>
      )}

      {q.kind === "fill_blank" && (
        <>
          <AcceptedEditor
            answerType={q.answerType}
            accepted={q.accepted}
            variables={q.variables}
            issues={issues}
            onChange={(v) => {
              const { variables: _old, ...rest } = q;
              void _old;
              onChange({ ...rest, answerType: v.answerType, accepted: v.accepted, ...(v.variables ? { variables: v.variables } : {}) });
            }}
          />
          <div className="space-y-1.5">
            <Label>Texte d&apos;exemple dans le champ (optionnel)</Label>
            <Input
              value={q.placeholder ?? ""}
              onChange={(e) => {
                const { placeholder: _p, ...rest } = q;
                void _p;
                onChange(e.target.value ? { ...rest, placeholder: e.target.value } : rest);
              }}
            />
          </div>
        </>
      )}

      {q.kind === "matching" && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Paires (dans le bon appariement ; mélangées à l&apos;affichage)</legend>
          {q.pairs.map((p, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border p-2">
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <MdField compact label={`Gauche ${i + 1}`} value={p.left} onChange={(left) => onChange({ ...q, pairs: q.pairs.map((x, k) => (k === i ? { ...x, left } : x)) })} error={issueAt(issues, ["pairs", i, "left"])} />
                <MdField compact label={`Droite ${i + 1}`} value={p.right} onChange={(right) => onChange({ ...q, pairs: q.pairs.map((x, k) => (k === i ? { ...x, right } : x)) })} error={issueAt(issues, ["pairs", i, "right"])} />
              </div>
              <RowControls i={i} n={q.pairs.length} min={2} label={`la paire ${i + 1}`} onMove={(d) => onChange({ ...q, pairs: move(q.pairs, i, d) })} onRemove={() => onChange({ ...q, pairs: q.pairs.filter((_, k) => k !== i) })} />
            </div>
          ))}
          {q.pairs.length < 6 && (
            <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...q, pairs: [...q.pairs, { left: "", right: "" }] })}>
              <Plus /> Paire
            </Button>
          )}
        </fieldset>
      )}

      {q.kind === "ordering" && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Éléments dans le BON ordre (mélangés à l&apos;affichage)</legend>
          {q.items.map((it, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border p-2">
              <span className="mt-1.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <MdField compact label={`Élément ${i + 1}`} value={it} onChange={(md) => onChange({ ...q, items: q.items.map((x, k) => (k === i ? md : x)) })} error={issueAt(issues, ["items", i])} />
              </div>
              <RowControls i={i} n={q.items.length} min={3} label={`l'élément ${i + 1}`} onMove={(d) => onChange({ ...q, items: move(q.items, i, d) })} onRemove={() => onChange({ ...q, items: q.items.filter((_, k) => k !== i) })} />
            </div>
          ))}
          {q.items.length < 7 && (
            <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...q, items: [...q.items, ""] })}>
              <Plus /> Élément
            </Button>
          )}
        </fieldset>
      )}

      {q.kind === "steps" && (
        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-medium">Étapes (2 à 5, révélées l&apos;une après l&apos;autre)</legend>
          {q.steps.map((s, i) => (
            <div key={i} className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">Étape {i + 1}</span>
                <RowControls i={i} n={q.steps.length} min={2} label={`l'étape ${i + 1}`} onMove={(d) => onChange({ ...q, steps: move(q.steps, i, d) })} onRemove={() => onChange({ ...q, steps: q.steps.filter((_, k) => k !== i) })} />
              </div>
              <StepEditor name={`${name}-s${i}`} step={s} issues={subIssues(issues, ["steps", i])} onChange={(step) => onChange({ ...q, steps: q.steps.map((x, k) => (k === i ? step : x)) })} />
            </div>
          ))}
          {q.steps.length < 5 && (
            <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...q, steps: [...q.steps, { kind: "fill_blank", prompt: "", answerType: "number", accepted: [""], explanation: "" }] })}>
              <Plus /> Étape
            </Button>
          )}
        </fieldset>
      )}

      <MdField label="Explication (montrée après la réponse)" rows={3} value={q.explanation} onChange={(explanation) => onChange({ ...q, explanation })} error={issueAt(issues, ["explanation"])} />

      <IssueList issues={other.filter((i) => !(i.path[0] === "accepted"))} />
    </div>
  );
}
