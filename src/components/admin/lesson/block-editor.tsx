"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { widgetSchema, type Block, type Widget } from "@/content/schema";
import { MdField } from "./md-field";
import { defaultQuestion, QuestionEditor } from "./question-editor";
import { issueAt, IssueList, subIssues, zodIssues, type Issue } from "./issues";

type Step = { md: string; why?: string };

export const BLOCK_LABEL: Record<Block["type"], string> = {
  heading: "Titre",
  text: "Texte",
  definition: "Définition",
  theorem: "Théorème / proposition",
  proof: "Démonstration",
  example: "Exemple",
  remark: "Remarque",
  intuition: "En clair (intuition)",
  exercise: "Exercice",
  interactive: "Widget interactif",
  figure: "Figure",
  simulation: "Simulation",
  checkpoint: "Question intégrée",
};

const THEOREM_KINDS = { theoreme: "Théorème", proposition: "Proposition", propriete: "Propriété", lemme: "Lemme", corollaire: "Corollaire" } as const;

export const WIDGET_DEFAULTS: { [K in Widget["widget"]]: Extract<Widget, { widget: K }>["props"] } = {
  "law-explorer": { expr: "x + y - x*y", latex: "x \\star y = x + y - xy", domain: "R", neutral: 0 },
  "cayley-table": { elements: ["\\bar 0", "\\bar 1", "\\bar 2"], table: [[0, 1, 2], [1, 2, 0], [2, 0, 1]], opLatex: "+" },
  "modular-clock": { n: 6, op: "+" },
  "vector-combination": { u: [1, 0], v: [0, 1] },
  "linear-map-2d": { matrix: [[1, 1], [0, 1]], editable: true },
  "matrix-product": { A: [[1, 2], [3, 4]], B: [[0, 1], [1, 0]] },
  "gauss-rank": { matrix: [[1, 2, 3], [2, 4, 6], [1, 0, 1]] },
  "basis-change": { P: [[1, 1], [0, 1]], x: [2, 1] },
  "polynomial-plot": { coeffs: [-1, 0, 1], editable: true },
  "poly-division": { A: [-1, 0, 0, 1], B: [-1, 1] },
};

const WIDGET_LABEL: Record<Widget["widget"], string> = {
  "law-explorer": "Explorateur de loi",
  "cayley-table": "Table de Cayley",
  "modular-clock": "Horloge modulaire",
  "vector-combination": "Combinaison de vecteurs",
  "linear-map-2d": "Application linéaire 2D",
  "matrix-product": "Produit matriciel",
  "gauss-rank": "Pivot de Gauss / rang",
  "basis-change": "Changement de base",
  "polynomial-plot": "Tracé de polynôme",
  "poly-division": "Division euclidienne",
};

export function defaultBlock(type: Block["type"]): Block {
  switch (type) {
    case "heading":
      return { type, text: "", origin: "source" };
    case "text":
    case "remark":
      return { type, md: "", origin: "source" };
    case "intuition":
      return { type, md: "", origin: "added" };
    case "definition":
      return { type, md: "", origin: "source" };
    case "theorem":
      return { type, kind: "proposition", md: "", origin: "source" };
    case "proof":
      return { type, steps: [{ md: "" }], origin: "source" };
    case "example":
      return { type, md: "", origin: "source" };
    case "exercise":
      return { type, md: "", origin: "source" };
    case "interactive":
      return { type, spec: { widget: "law-explorer", props: WIDGET_DEFAULTS["law-explorer"] } as Widget, origin: "added" };
    case "figure":
      return { type, src: "/figures/cours/figure.svg", alt: "", origin: "source" };
    case "simulation":
      return { type, scene: "cylindrical-coords", origin: "added" };
    case "checkpoint":
      return { type, question: defaultQuestion("mcq"), origin: "added" };
  }
}

/** Short text describing a block, for drag announcements and collapsed headers. */
export function blockSummary(b: Block) {
  const text = "text" in b ? b.text : "md" in b ? b.md : "title" in b && b.title ? b.title : b.type === "checkpoint" ? b.question.prompt : b.type === "proof" ? (b.steps[0]?.md ?? "") : "";
  const t = ("title" in b && b.title) || text || "";
  return t.replace(/\s+/g, " ").slice(0, 80);
}

function OptionalTitle({ value, onChange }: { value: string | undefined; onChange: (v: string | undefined) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>Titre (optionnel)</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} />
    </div>
  );
}

function withOptional<T extends object, K extends string>(obj: T, key: K, value: unknown): T {
  const next = { ...obj } as Record<string, unknown>;
  if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) delete next[key];
  else next[key] = value;
  return next as T;
}

function StepsEditor({ label, steps, onChange, issues, min = 1, addLabel }: { label: string; steps: Step[]; onChange: (s: Step[]) => void; issues: Issue[]; min?: number; addLabel: string }) {
  const mv = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    const n = [...steps];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      {steps.map((s, i) => (
        <div key={i} className="rounded-lg border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Étape {i + 1}</span>
            <div className="flex">
              <Button type="button" variant="ghost" size="icon-xs" disabled={i === 0} onClick={() => mv(i, -1)} aria-label={`Monter l'étape ${i + 1}`}>
                <ArrowUp />
              </Button>
              <Button type="button" variant="ghost" size="icon-xs" disabled={i === steps.length - 1} onClick={() => mv(i, 1)} aria-label={`Descendre l'étape ${i + 1}`}>
                <ArrowDown />
              </Button>
              <Button type="button" variant="ghost" size="icon-xs" disabled={steps.length <= min} onClick={() => onChange(steps.filter((_, k) => k !== i))} aria-label={`Retirer l'étape ${i + 1}`}>
                <X />
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            <MdField label="Contenu" rows={2} value={s.md} onChange={(md) => onChange(steps.map((x, k) => (k === i ? { ...x, md } : x)))} error={issueAt(issues, [i, "md"])} />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Justification « pourquoi ? » (optionnel)</Label>
              <Input value={s.why ?? ""} onChange={(e) => onChange(steps.map((x, k) => (k === i ? withOptional(x, "why", e.target.value) : x)))} />
            </div>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...steps, { md: "" }])}>
        <Plus /> {addLabel}
      </Button>
    </fieldset>
  );
}

function WidgetEditor({ spec, onChange, issues }: { spec: Widget; onChange: (s: Widget) => void; issues: Issue[] }) {
  const [text, setText] = useState(() => JSON.stringify(spec.props, null, 2));
  const [syntax, setSyntax] = useState<string | null>(null);
  const check = widgetSchema.safeParse(spec);
  const local = check.success ? [] : zodIssues(check.error);
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Widget</Label>
        <Select
          value={spec.widget}
          onValueChange={(w) => {
            const props = WIDGET_DEFAULTS[w as Widget["widget"]];
            setText(JSON.stringify(props, null, 2));
            setSyntax(null);
            onChange({ widget: w, props } as Widget);
          }}
        >
          <SelectTrigger className="w-full sm:w-72" aria-label="Widget">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(WIDGET_LABEL) as Widget["widget"][]).map((w) => (
              <SelectItem key={w} value={w}>
                {WIDGET_LABEL[w]} <span className="font-mono text-xs text-muted-foreground">({w})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Propriétés (JSON)</Label>
        <Textarea
          rows={Math.min(14, Math.max(4, text.split("\n").length))}
          value={text}
          spellCheck={false}
          className="font-mono text-[13px]"
          aria-invalid={syntax || local.length ? true : undefined}
          onChange={(e) => {
            setText(e.target.value);
            try {
              const props = JSON.parse(e.target.value);
              setSyntax(null);
              onChange({ widget: spec.widget, props } as Widget);
            } catch (err) {
              setSyntax((err as Error).message);
            }
          }}
        />
        <p className="text-xs text-muted-foreground">Voir content/WIDGETS.md pour la signification de chaque propriété.</p>
        {syntax && <IssueList issues={[{ path: [], message: `JSON invalide : ${syntax}` }]} />}
        {!syntax && <IssueList issues={local.length ? local : issues} />}
      </div>
    </div>
  );
}

/** Structured editor for one lesson block. `issues` are relative to the block. */
export function BlockEditor({ block, onChange, issues, name }: { block: Block; onChange: (b: Block) => void; issues: Issue[]; name: string }) {
  const b = block;
  const set = <K extends string>(key: K, value: unknown) => onChange(withOptional(b, key, value));
  const body = (() => {
    switch (b.type) {
      case "heading":
        return (
          <div className="space-y-1.5">
            <Label>Titre de section</Label>
            <Input value={b.text} onChange={(e) => onChange({ ...b, text: e.target.value })} aria-invalid={issueAt(issues, ["text"]) ? true : undefined} />
          </div>
        );
      case "text":
      case "remark":
      case "intuition":
        return <MdField label="Texte" rows={5} value={b.md} onChange={(md) => onChange({ ...b, md })} error={issueAt(issues, ["md"])} />;
      case "definition":
        return (
          <>
            <OptionalTitle value={b.title} onChange={(v) => set("title", v)} />
            <MdField label="Énoncé" rows={4} value={b.md} onChange={(md) => onChange({ ...b, md })} error={issueAt(issues, ["md"])} />
          </>
        );
      case "theorem":
        return (
          <>
            <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
              <div className="space-y-1.5">
                <Label>Nature</Label>
                <Select value={b.kind} onValueChange={(kind) => onChange({ ...b, kind: kind as typeof b.kind })}>
                  <SelectTrigger className="w-full" aria-label="Nature de l'énoncé">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(THEOREM_KINDS) as (keyof typeof THEOREM_KINDS)[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {THEOREM_KINDS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <OptionalTitle value={b.title} onChange={(v) => set("title", v)} />
            </div>
            <MdField label="Énoncé" rows={4} value={b.md} onChange={(md) => onChange({ ...b, md })} error={issueAt(issues, ["md"])} />
          </>
        );
      case "proof":
        return (
          <>
            <OptionalTitle value={b.title} onChange={(v) => set("title", v)} />
            <StepsEditor label="Étapes de la démonstration (révélées une à une)" steps={b.steps} onChange={(steps) => onChange({ ...b, steps })} issues={subIssues(issues, ["steps"])} addLabel="Étape" />
          </>
        );
      case "example":
        return (
          <>
            <OptionalTitle value={b.title} onChange={(v) => set("title", v)} />
            <MdField label="Énoncé" rows={4} value={b.md} onChange={(md) => onChange({ ...b, md })} error={issueAt(issues, ["md"])} />
            <StepsEditor label="Résolution pas à pas (optionnelle)" steps={b.steps ?? []} min={0} onChange={(steps) => set("steps", steps)} issues={subIssues(issues, ["steps"])} addLabel="Étape de résolution" />
          </>
        );
      case "exercise":
        return (
          <>
            <OptionalTitle value={b.title} onChange={(v) => set("title", v)} />
            <MdField label="Énoncé" rows={4} value={b.md} onChange={(md) => onChange({ ...b, md })} error={issueAt(issues, ["md"])} />
            <StepsEditor label="Correction pas à pas (optionnelle)" steps={b.solution ?? []} min={0} onChange={(steps) => set("solution", steps)} issues={subIssues(issues, ["solution"])} addLabel="Étape de correction" />
          </>
        );
      case "interactive":
        return (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <OptionalTitle value={b.title} onChange={(v) => set("title", v)} />
              <div className="space-y-1.5">
                <Label>Introduction (optionnelle)</Label>
                <Input value={b.intro ?? ""} onChange={(e) => set("intro", e.target.value)} />
              </div>
            </div>
            <WidgetEditor spec={b.spec} onChange={(spec) => onChange({ ...b, spec })} issues={subIssues(issues, ["spec"])} />
          </>
        );
      case "checkpoint":
        return <QuestionEditor name={name} value={b.question} onChange={(question) => onChange({ ...b, question })} issues={subIssues(issues, ["question"])} />;
    }
  })();

  const shown = new Set(["md", "text"]);
  const rest = b.type === "checkpoint" || b.type === "interactive" ? [] : issues.filter((i) => !(i.path.length === 1 && shown.has(String(i.path[0]))) && !["steps", "solution"].includes(String(i.path[0])));
  return (
    <div className="space-y-4">
      {body}
      <IssueList issues={rest} />
      <label className="flex w-fit items-center gap-2 text-xs text-muted-foreground">
        <Switch size="sm" checked={b.origin === "added"} onCheckedChange={(on) => onChange({ ...b, origin: on ? "added" : "source" })} aria-label="Bloc ajouté (complément)" />
        {b.origin === "added" ? "Complément ajouté (absent du polycopié)" : "Issu du polycopié"}
      </label>
    </div>
  );
}
