"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Check, GripVertical, ArrowUp, ArrowDown, X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Md, Tex } from "@/components/math/md";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AnswerType, Feedback } from "@/lib/quiz/types";

const LETTERS = "ABCDEF";

// ------------------------------------------------------------------ multiple choice

export function McqInput({
  options,
  value,
  onChange,
  feedback,
  disabled,
}: {
  options: { id: string; md: string }[];
  value: string | null;
  onChange: (id: string) => void;
  feedback?: Feedback | null;
  disabled?: boolean;
}) {
  // keyboard shortcuts 1-6 / A-F
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      const idx = n >= 1 && n <= options.length ? n - 1 : LETTERS.indexOf(e.key.toUpperCase());
      if (idx >= 0 && idx < options.length) onChange(options[idx].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [options, onChange, disabled]);

  return (
    <div role="radiogroup" className="grid gap-2.5">
      {options.map((o, i) => {
        const selected = value === o.id;
        const isCorrect = feedback && feedback.correctOption === o.id;
        const isWrongPick = feedback && selected && !feedback.correct;
        return (
          <motion.button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            whileTap={disabled ? undefined : { scale: 0.985 }}
            animate={isWrongPick ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
            transition={{ duration: 0.35 }}
            className={cn(
              "flex w-full items-start gap-3 rounded-md border-[1.5px] bg-background px-4 py-3 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              !feedback && (selected ? "border-primary bg-brand-soft" : "border-border hover:border-primary/40 hover:bg-muted"),
              isCorrect && "border-success bg-success-soft",
              isWrongPick && "border-danger bg-danger-soft",
              feedback && !isCorrect && !isWrongPick && "opacity-60",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-[3px] border text-[0.8rem] font-bold",
                selected && !feedback ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
                isCorrect && "border-success bg-success text-white",
                isWrongPick && "border-danger bg-danger text-white",
              )}
            >
              {isCorrect ? <Check className="size-4" /> : isWrongPick ? <X className="size-4" /> : LETTERS[i]}
            </span>
            <Md inline className="min-w-0 flex-1 pt-0.5 [&_.katex]:text-[1em]">
              {o.md}
            </Md>
          </motion.button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ true / false

export function TrueFalseInput({
  value,
  onChange,
  feedback,
  disabled,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  feedback?: Feedback | null;
  disabled?: boolean;
}) {
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === "v") onChange(true);
      if (e.key.toLowerCase() === "f") onChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onChange, disabled]);

  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-3">
      {[true, false].map((v) => {
        const selected = value === v;
        const isCorrect = feedback && feedback.correctValue === v;
        const isWrongPick = feedback && selected && !feedback.correct;
        return (
          <motion.button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(v)}
            whileTap={disabled ? undefined : { scale: 0.97 }}
            animate={isWrongPick ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
            className={cn(
              "rounded-md border-[1.5px] bg-background px-4 py-4 text-[1.1rem] font-bold smallcaps transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              !feedback && (selected ? "border-primary bg-brand-soft text-primary" : "border-border hover:border-primary/40 hover:bg-muted"),
              isCorrect && "border-success bg-success-soft text-success",
              isWrongPick && "border-danger bg-danger-soft text-danger",
              feedback && !isCorrect && !isWrongPick && "opacity-60",
            )}
          >
            {v ? "Vrai" : "Faux"}
          </motion.button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ fill in the blank

const HINTS: Record<AnswerType, string> = {
  text: "Écris un mot ou une courte expression.",
  number: "Un nombre : entier, fraction (1/2) ou décimal (0,5).",
  expression: "Une expression, par ex. x^2 + 1 ou (x-1)(x+2).",
};

/** Lightweight preview of what the student typed, rendered as TeX. */
function toPreviewTex(s: string) {
  return s
    .replace(/\*/g, " \\cdot ")
    .replace(/sqrt\(([^()]*)\)/g, "\\sqrt{$1}")
    .replace(/\^\(([^()]*)\)/g, "^{$1}")
    .replace(/\^(-?\d+)/g, "^{$1}")
    .replace(/(\d+)\/(\d+)/g, "\\frac{$1}{$2}")
    .replace(/pi/g, "\\pi");
}

export function FillBlankInput({
  answerType,
  placeholder,
  value,
  onChange,
  onSubmit,
  feedback,
  disabled,
  autoFocus,
}: {
  answerType: AnswerType;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  feedback?: Feedback | null;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  const showPreview = answerType !== "text" && value.trim().length > 0 && /[\^/*]|sqrt|pi/.test(value);
  return (
    <div className="space-y-2">
      <motion.div animate={feedback && !feedback.correct ? { x: [0, -6, 6, -4, 4, 0] } : undefined} transition={{ duration: 0.35 }}>
        <Input
          ref={ref}
          value={value}
          disabled={disabled}
          inputMode={answerType === "number" ? "decimal" : "text"}
          autoComplete="off"
          spellCheck={false}
          aria-label="Ta réponse"
          placeholder={placeholder ?? (answerType === "text" ? "Ta réponse" : answerType === "number" ? "ex. 3, -1/2, 0,25" : "ex. x^2 - 1")}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) {
              e.preventDefault();
              onSubmit?.();
            }
          }}
          className={cn(
            "h-11 rounded-md border-[1.5px] text-[1.05rem]",
            answerType !== "text" && "font-mono",
            feedback?.correct && "border-success bg-success-soft",
            feedback && !feedback.correct && "border-danger bg-danger-soft",
          )}
        />
      </motion.div>
      <div className="flex min-h-6 flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{HINTS[answerType]}</span>
        {showPreview && (
          <span className="rounded-sm bg-muted px-2 py-0.5 text-foreground" aria-hidden>
            <Tex>{toPreviewTex(value)}</Tex>
          </span>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ matching

const PAIR_COLORS = [
  "border-primary bg-brand-soft",
  "border-[oklch(0.6_0.15_165)] bg-[oklch(0.6_0.15_165/0.12)]",
  "border-[oklch(0.62_0.18_300)] bg-[oklch(0.62_0.18_300/0.12)]",
  "border-[oklch(0.7_0.15_60)] bg-[oklch(0.7_0.15_60/0.14)]",
  "border-[oklch(0.6_0.17_20)] bg-[oklch(0.6_0.17_20/0.12)]",
  "border-[oklch(0.55_0.05_265)] bg-[oklch(0.55_0.05_265/0.14)]",
];

export function MatchingInput({
  left,
  right,
  value,
  onChange,
  feedback,
  disabled,
}: {
  left: string[];
  right: string[];
  /** value[i] = index in `right` paired with left[i], or -1 */
  value: number[];
  onChange: (v: number[]) => void;
  feedback?: Feedback | null;
  disabled?: boolean;
}) {
  const [activeLeft, setActiveLeft] = useState<number | null>(null);
  const pairOfRight = (r: number) => value.indexOf(r);
  const shown = feedback?.correctMap && !feedback.correct ? feedback.correctMap : value;

  function pickRight(r: number) {
    if (disabled) return;
    const target = activeLeft ?? value.findIndex((v) => v === -1);
    if (target < 0) return;
    const next = value.map((v) => (v === r ? -1 : v));
    next[target] = r;
    onChange(next);
    const free = next.findIndex((v) => v === -1);
    setActiveLeft(free >= 0 ? free : null);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Choisis un élément à gauche, puis l&apos;élément correspondant à droite. Clique sur une paire pour la refaire.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid content-start gap-2">
          {left.map((l, i) => {
            const paired = shown[i] >= 0;
            const ok = feedback ? (feedback.correctMap ? feedback.correctMap[i] === value[i] : feedback.correct) : null;
            return (
              <button
                key={i}
                type="button"
                data-side="left"
                disabled={disabled}
                aria-pressed={activeLeft === i}
                onClick={() => {
                  if (value[i] >= 0) onChange(value.map((v, j) => (j === i ? -1 : v)));
                  setActiveLeft(i);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md border-[1.5px] bg-background px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  paired ? PAIR_COLORS[i % PAIR_COLORS.length] : "border-border hover:bg-muted",
                  activeLeft === i && !paired && "border-primary ring-2 ring-primary/30",
                  feedback && ok === false && "ring-2 ring-danger/50",
                )}
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-[3px] border bg-background text-[0.8rem] font-bold">{i + 1}</span>
                <Md inline className="min-w-0 flex-1">
                  {l}
                </Md>
              </button>
            );
          })}
        </div>
        <div className="grid content-start gap-2">
          {right.map((r, j) => {
            const owner = feedback?.correctMap && !feedback.correct ? feedback.correctMap.indexOf(j) : pairOfRight(j);
            return (
              <button
                key={j}
                type="button"
                data-side="right"
                disabled={disabled}
                onClick={() => pickRight(j)}
                className={cn(
                  "flex items-center gap-2 rounded-md border-[1.5px] bg-background px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  owner >= 0 ? PAIR_COLORS[owner % PAIR_COLORS.length] : "border-dashed border-border hover:bg-muted",
                )}
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-[3px] border bg-background text-[0.8rem] font-bold">
                  {owner >= 0 ? owner + 1 : "·"}
                </span>
                <Md inline className="min-w-0 flex-1">
                  {r}
                </Md>
              </button>
            );
          })}
        </div>
      </div>
      {feedback && !feedback.correct && feedback.correctMap && (
        <p className="text-sm text-muted-foreground">Les couleurs montrent maintenant les bonnes associations.</p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ ordering (drag & drop + buttons)

function SortableRow({
  id,
  index,
  md,
  count,
  move,
  disabled,
  state,
}: {
  id: string;
  index: number;
  md: string;
  count: number;
  move: (from: number, to: number) => void;
  disabled?: boolean;
  state?: "correct" | "wrong" | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-md border-[1.5px] bg-background px-2 py-2 transition-shadow",
        isDragging ? "z-10 border-primary" : "border-border",
        state === "correct" && "border-success bg-success-soft",
        state === "wrong" && "border-danger bg-danger-soft",
      )}
    >
      <button
        type="button"
        className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-sm text-muted-foreground hover:bg-muted active:cursor-grabbing disabled:cursor-default"
        aria-label={`Déplacer l'étape ${index + 1}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="grid size-6 shrink-0 place-items-center rounded-[3px] bg-muted text-[0.8rem] font-bold">{index + 1}</span>
      <Md inline className="min-w-0 flex-1 py-1">
        {md}
      </Md>
      <div className="flex shrink-0 flex-col">
        <button type="button" disabled={disabled || index === 0} onClick={() => move(index, index - 1)} className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Monter">
          <ArrowUp className="size-3.5" />
        </button>
        <button type="button" disabled={disabled || index === count - 1} onClick={() => move(index, index + 1)} className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Descendre">
          <ArrowDown className="size-3.5" />
        </button>
      </div>
    </li>
  );
}

export function OrderingInput({
  items,
  value,
  onChange,
  feedback,
  disabled,
}: {
  items: string[];
  /** current order as indices into `items` */
  value: number[];
  onChange: (v: number[]) => void;
  feedback?: Feedback | null;
  disabled?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const order = feedback && !feedback.correct && feedback.correctOrder ? feedback.correctOrder : value;
  const ids = useMemo(() => order.map((i) => `item-${i}`), [order]);
  const move = (from: number, to: number) => onChange(arrayMove(value, from, to));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    move(ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
  };
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Glisse les éléments (ou utilise les flèches) pour les remettre dans le bon ordre.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol className="grid gap-2">
            {order.map((itemIdx, pos) => (
              <SortableRow
                key={`item-${itemIdx}`}
                id={`item-${itemIdx}`}
                index={pos}
                md={items[itemIdx]}
                count={order.length}
                move={move}
                disabled={disabled}
                state={feedback ? (feedback.correct ? "correct" : feedback.correctOrder ? "correct" : null) : null}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {feedback && !feedback.correct && <p className="text-sm text-muted-foreground">Voici le bon ordre.</p>}
    </div>
  );
}
