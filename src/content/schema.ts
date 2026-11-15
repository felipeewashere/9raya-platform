/**
 * Course content format.
 *
 * Each chapter of a course lives in one JSON file under `content/<course-slug>/chNN.json`
 * and is validated against `chapterSchema` before being imported into the database
 * (`npm run content:import`). The admin editor reads and writes the same shapes, so
 * a chapter can be authored by hand, imported from a PDF review, or edited in the UI.
 *
 * Text fields are Markdown with KaTeX math: inline `$...$`, display `$$...$$`.
 */
import { z } from "zod";
import { SIM_SCENE_NAMES } from "./sim-scenes";

const md = z.string().min(1);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "kebab-case ASCII slug");

/** Where a block comes from: copied/adapted from the source PDF, or added for pedagogy. */
const origin = z.enum(["source", "added"]).default("source");

// ---------------------------------------------------------------- questions

const mcq = z.object({
  kind: z.literal("mcq"),
  prompt: md,
  options: z.array(z.object({ id: z.string().min(1), md })).min(2).max(6),
  answer: z.string().min(1), // id of the correct option
  explanation: md,
});

const trueFalse = z.object({
  kind: z.literal("true_false"),
  prompt: md,
  answer: z.boolean(),
  explanation: md,
});

const fillBlank = z.object({
  kind: z.literal("fill_blank"),
  /** Use `___` where the blank goes (exactly one blank). */
  prompt: md,
  /**
   * text: case/accent/space-insensitive string match against `accepted`.
   * number: numeric comparison (`accepted` holds numbers as strings, e.g. "-1", "0.5", "1/2").
   * expression: algebraic equivalence checked by evaluating at random points
   *   (`accepted` uses mathjs syntax in the variables listed in `variables`, e.g. "x^2 + 1").
   */
  answerType: z.enum(["text", "number", "expression"]),
  accepted: z.array(z.string().min(1)).min(1),
  variables: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  explanation: md,
});

const matching = z.object({
  kind: z.literal("matching"),
  prompt: md,
  /** Each left item matches exactly one right item. 2–6 pairs. Shuffled at display time. */
  pairs: z.array(z.object({ left: md, right: md })).min(2).max(6),
  explanation: md,
});

const ordering = z.object({
  kind: z.literal("ordering"),
  prompt: md,
  /** Items in the CORRECT order. Shuffled at display time. 3–7 items. */
  items: z.array(md).min(3).max(7),
  explanation: md,
});

const stepItem = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("mcq"),
    prompt: md,
    options: z.array(z.object({ id: z.string().min(1), md })).min(2).max(6),
    answer: z.string().min(1),
    explanation: md,
  }),
  z.object({
    kind: z.literal("fill_blank"),
    prompt: md,
    answerType: z.enum(["text", "number", "expression"]),
    accepted: z.array(z.string().min(1)).min(1),
    variables: z.array(z.string()).optional(),
    explanation: md,
  }),
]);

const steps = z.object({
  kind: z.literal("steps"),
  /** The overall problem statement. */
  prompt: md,
  /** Successive stages; each is answered and checked before the next appears. 2–5 stages. */
  steps: z.array(stepItem).min(2).max(5),
  explanation: md,
});

export const questionSchema = z.discriminatedUnion("kind", [
  mcq,
  trueFalse,
  fillBlank,
  matching,
  ordering,
  steps,
]);
export type Question = z.infer<typeof questionSchema>;

// ---------------------------------------------------------------- widgets

/**
 * Interactive widgets available in lessons. Each has fixed props (see WIDGETS.md).
 * Content authors may only use these ids.
 */
export const widgetSchema = z.discriminatedUnion("widget", [
  z.object({
    widget: z.literal("law-explorer"),
    props: z.object({
      /** mathjs expression in x and y, e.g. "x + y - x*y". */
      expr: z.string(),
      /** KaTeX for the law, e.g. "x \\star y = x + y - xy". */
      latex: z.string(),
      domain: z.enum(["N", "Z", "Q", "R"]),
      /** Known neutral element, if any (shown as a hint after the student searches). */
      neutral: z.number().nullable().optional(),
    }),
  }),
  z.object({
    widget: z.literal("cayley-table"),
    props: z.object({
      /** Element labels (KaTeX allowed), e.g. ["\\bar 0", "\\bar 1", "\\bar 2"]. */
      elements: z.array(z.string()).min(2).max(8),
      /** table[i][j] = index into `elements` of elements[i] ⋆ elements[j]. */
      table: z.array(z.array(z.number().int().min(0))),
      opLatex: z.string(),
      caption: z.string().optional(),
    }),
  }),
  z.object({
    widget: z.literal("modular-clock"),
    props: z.object({ n: z.number().int().min(2).max(12), op: z.enum(["+", "*"]) }),
  }),
  z.object({
    widget: z.literal("vector-combination"),
    props: z.object({
      u: z.tuple([z.number(), z.number()]),
      v: z.tuple([z.number(), z.number()]),
    }),
  }),
  z.object({
    widget: z.literal("linear-map-2d"),
    props: z.object({
      matrix: z.tuple([z.tuple([z.number(), z.number()]), z.tuple([z.number(), z.number()])]),
      editable: z.boolean().default(true),
    }),
  }),
  z.object({
    widget: z.literal("matrix-product"),
    props: z.object({ A: z.array(z.array(z.number())), B: z.array(z.array(z.number())) }),
  }),
  z.object({
    widget: z.literal("gauss-rank"),
    props: z.object({ matrix: z.array(z.array(z.number())) }),
  }),
  z.object({
    widget: z.literal("basis-change"),
    props: z.object({
      /** Columns of P are the new basis vectors expressed in the canonical basis (2×2). */
      P: z.tuple([z.tuple([z.number(), z.number()]), z.tuple([z.number(), z.number()])]),
      x: z.tuple([z.number(), z.number()]),
    }),
  }),
  z.object({
    widget: z.literal("polynomial-plot"),
    props: z.object({
      /** Coefficients in ASCENDING degree: [a0, a1, a2, ...]. Degree ≤ 5. */
      coeffs: z.array(z.number()).min(1).max(6),
      editable: z.boolean().default(true),
    }),
  }),
  z.object({
    widget: z.literal("poly-division"),
    props: z.object({
      /** Dividend and divisor, coefficients in ASCENDING degree. */
      A: z.array(z.number()).min(1),
      B: z.array(z.number()).min(1),
    }),
  }),
]);
export type Widget = z.infer<typeof widgetSchema>;

// ---------------------------------------------------------------- blocks

const step = z.object({ md, why: z.string().optional() });

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), text: z.string().min(1), origin }),
  z.object({ type: z.literal("text"), md, origin }),
  z.object({ type: z.literal("definition"), title: z.string().optional(), md, origin }),
  z.object({
    type: z.literal("theorem"),
    kind: z.enum(["theoreme", "proposition", "propriete", "lemme", "corollaire"]),
    title: z.string().optional(),
    md,
    origin,
  }),
  z.object({
    type: z.literal("proof"),
    title: z.string().optional(),
    /** Revealed one at a time with "Étape suivante". */
    steps: z.array(step).min(1),
    origin,
  }),
  z.object({
    type: z.literal("example"),
    title: z.string().optional(),
    md,
    /** Optional step-by-step worked solution. */
    steps: z.array(step).optional(),
    origin,
  }),
  z.object({ type: z.literal("remark"), md, origin }),
  z.object({ type: z.literal("intuition"), md, origin: origin.default("added") }),
  z.object({
    type: z.literal("exercise"),
    title: z.string().optional(),
    md,
    solution: z.array(step).optional(),
    origin,
  }),
  z.object({ type: z.literal("interactive"), title: z.string().optional(), intro: z.string().optional(), spec: widgetSchema, origin: origin.default("added") }),
  /** A drawing: SVG/PNG under public/figures/<course-slug>/… (src starts with "/figures/"). */
  z.object({
    type: z.literal("figure"),
    src: z.string().regex(/^\/figures\/[a-z0-9-]+\/[A-Za-z0-9._\/-]+\.(svg|png|webp)$/, "src = /figures/<course>/<file>.svg"),
    alt: z.string().min(1),
    caption: z.string().optional(),
    origin: origin.default("source"),
  }),
  /** Interactive simulation (see src/content/sim-scenes.ts for the scenes and their params). */
  z.object({
    type: z.literal("simulation"),
    scene: z.enum(SIM_SCENE_NAMES),
    params: z.record(z.string(), z.unknown()).optional(),
    caption: z.string().optional(),
    origin: origin.default("added"),
  }),
  /** Short graded question inside the lesson, right after the material it checks. */
  z.object({ type: z.literal("checkpoint"), question: questionSchema, origin: origin.default("added") }),
]);
export type Block = z.infer<typeof blockSchema>;

// ---------------------------------------------------------------- hierarchy

export const lessonSchema = z.object({
  slug,
  title: z.string().min(1),
  /** Numbering from the source, e.g. "1.3.2". */
  number: z.string().optional(),
  estimatedMinutes: z.number().int().min(2).max(40),
  summary: z.string().min(1),
  blocks: z.array(blockSchema).min(1),
  /** End-of-lesson quiz, 3–8 questions. Passing it completes the lesson. */
  quiz: z.array(questionSchema).min(3).max(8),
});

export const sectionSchema = z.object({
  slug,
  title: z.string().min(1),
  number: z.string().optional(),
  lessons: z.array(lessonSchema).min(1),
});

export const chapterSchema = z.object({
  slug,
  number: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  sourcePdf: z.string().optional(),
  sections: z.array(sectionSchema).min(1),
  /** Notes for the reviewer: typos fixed in the source, unclear passages, widget wishes. */
  reviewNotes: z.array(z.string()).default([]),
});
export type Chapter = z.infer<typeof chapterSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
