"use client";

import { useDeferredValue, useId, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Md } from "@/components/math/md";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Snippet = { label: string; title: string; before: string; after?: string; placeholder?: string };

const SNIPPETS: Snippet[] = [
  { label: "$x$", title: "Formule en ligne", before: "$", after: "$", placeholder: "x" },
  { label: "$$", title: "Formule centrée ($$…$$)", before: "\n$$\n", after: "\n$$\n", placeholder: "f(x) = x^2" },
  { label: "a/b", title: "Fraction \\frac{a}{b}", before: "\\frac{", after: "}{b}", placeholder: "a" },
  { label: "∀", title: "Pour tout (\\forall)", before: "\\forall " },
  { label: "∃", title: "Il existe (\\exists)", before: "\\exists " },
  { label: "∈", title: "Appartient (\\in)", before: "\\in " },
  { label: "⊂", title: "Inclus (\\subset)", before: "\\subset " },
  { label: "⇒", title: "Implique (\\Rightarrow)", before: "\\Rightarrow " },
  { label: "⇔", title: "Équivaut (\\Leftrightarrow)", before: "\\Leftrightarrow " },
  { label: "ℝ", title: "\\mathbb{R}", before: "\\mathbb{R}" },
  { label: "ℕ", title: "\\mathbb{N}", before: "\\mathbb{N}" },
  { label: "ℤ", title: "\\mathbb{Z}", before: "\\mathbb{Z}" },
  { label: "Σ", title: "Somme \\sum_{k=1}^{n}", before: "\\sum_{k=1}^{n} " },
  { label: "( )", title: "Matrice (pmatrix)", before: "\\begin{pmatrix} ", after: " & b \\\\ c & d \\end{pmatrix}", placeholder: "a" },
  { label: "B", title: "Gras (**…**)", before: "**", after: "**", placeholder: "texte" },
];

/** Inserts a snippet around the selection of a textarea and restores the caret. */
function insert(el: HTMLTextAreaElement, value: string, s: Snippet, onChange: (v: string) => void) {
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const selected = value.slice(start, end) || s.placeholder || "";
  const next = value.slice(0, start) + s.before + selected + (s.after ?? "") + value.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    const a = start + s.before.length;
    el.setSelectionRange(a, a + selected.length);
  });
}

/**
 * Markdown + KaTeX text area with a LaTeX toolbar and a live preview (rendered with <Md>,
 * exactly like the student reader). `compact` is for list items (options, pairs, steps).
 */
export function MdField({
  label,
  value,
  onChange,
  rows = 4,
  error,
  compact = false,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  error?: string | null;
  compact?: boolean;
  placeholder?: string;
  hint?: React.ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(!compact);
  const deferred = useDeferredValue(value);
  const toolbar = compact ? SNIPPETS.slice(0, 3) : SNIPPETS;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id} className={cn(compact && "text-xs text-muted-foreground")}>
          {label}
        </Label>
        <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label={`Insérer du LaTeX dans « ${label} »`}>
          {toolbar.map((s) => (
            <Tooltip key={s.label}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => ref.current && insert(ref.current, value, s, onChange)}
                  className="min-w-7 rounded-md px-1.5 py-0.5 font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                  aria-label={s.title}
                >
                  {s.label}
                </button>
              </TooltipTrigger>
              <TooltipContent>{s.title}</TooltipContent>
            </Tooltip>
          ))}
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            aria-pressed={preview}
            className="ml-1 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            {preview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            Aperçu
          </button>
        </div>
      </div>
      <div className={cn("grid gap-2", preview && !compact && "lg:grid-cols-2")}>
        <Textarea
          id={id}
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={compact ? 2 : rows}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          spellCheck
          className={cn("font-mono text-[13px] leading-relaxed", compact ? "min-h-0" : "min-h-24")}
        />
        {preview && (
          <div aria-label="Aperçu" className={cn("min-w-0 overflow-x-auto rounded-lg border border-dashed bg-background p-3", compact && "py-2 text-sm")}>
            {deferred.trim() ? <Md className={compact ? "text-sm" : undefined}>{deferred}</Md> : <p className="text-sm text-muted-foreground">Aperçu…</p>}
          </div>
        )}
      </div>
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
