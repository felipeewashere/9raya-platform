/**
 * Question shapes as stored in the database.
 *   public data (questions.data)       → sent to the browser, never contains the answer
 *   secret answer (question_answers)   → server only, used for grading
 * For matching/ordering, the public lists are stored already shuffled, and the answer
 * refers to positions in those shuffled lists, so the browser cannot infer it.
 */

export type AnswerType = "text" | "number" | "expression";

export type PublicStep =
  | { kind: "mcq"; prompt: string; options: { id: string; md: string }[] }
  | { kind: "fill_blank"; prompt: string; answerType: AnswerType; placeholder?: string };

export type PublicQuestion =
  | { kind: "mcq"; prompt: string; options: { id: string; md: string }[] }
  | { kind: "true_false"; prompt: string }
  | { kind: "fill_blank"; prompt: string; answerType: AnswerType; placeholder?: string; variables?: string[] }
  | { kind: "matching"; prompt: string; left: string[]; right: string[] }
  | { kind: "ordering"; prompt: string; items: string[] }
  | { kind: "steps"; prompt: string; steps: PublicStep[] };

export type StepAnswer =
  | { kind: "mcq"; option: string }
  | { kind: "fill_blank"; answerType: AnswerType; accepted: string[]; variables?: string[] };

export type SecretAnswer =
  | { kind: "mcq"; option: string }
  | { kind: "true_false"; value: boolean }
  | { kind: "fill_blank"; answerType: AnswerType; accepted: string[]; variables?: string[] }
  /** map[i] = index in the shuffled `right` list that matches left[i] */
  | { kind: "matching"; map: number[] }
  /** order = indices into the shuffled `items`, in the correct order */
  | { kind: "ordering"; order: number[] }
  | { kind: "steps"; steps: StepAnswer[]; explanations: string[] };

/** What the student submits. */
export type GivenAnswer =
  | { option: string }
  | { value: boolean }
  | { text: string }
  | { map: number[] }
  | { order: number[] };

/** What the server returns after grading, to show feedback. */
export type Feedback = {
  correct: boolean;
  explanation: string;
  /** Human-readable correct answer (Markdown) shown when wrong. */
  correctAnswer?: string;
  /** For mcq: the correct option id (to highlight it). */
  correctOption?: string;
  /** For true/false. */
  correctValue?: boolean;
  /** For matching: the correct map. For ordering: the correct order. */
  correctMap?: number[];
  correctOrder?: number[];
};
