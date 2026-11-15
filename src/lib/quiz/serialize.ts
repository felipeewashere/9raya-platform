import type { Question } from "@/content/schema";
import type { PublicQuestion, SecretAnswer, StepAnswer, PublicStep } from "./types";

/** Small deterministic PRNG so re-importing content keeps the same shuffled order. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns a permutation of 0..n-1 that is never the identity (for n ≥ 2). */
export function shuffledIndices(n: number, seed: string): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return idx;
  const rand = seeded(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  if (idx.every((v, i) => v === i)) idx.push(idx.shift()!);
  return idx;
}

/** Split an authored question into its public part and its secret answer. */
export function splitQuestion(q: Question, seed: string): { data: PublicQuestion; answer: SecretAnswer; explanation: string } {
  switch (q.kind) {
    case "mcq":
      return {
        data: { kind: "mcq", prompt: q.prompt, options: q.options },
        answer: { kind: "mcq", option: q.answer },
        explanation: q.explanation,
      };
    case "true_false":
      return { data: { kind: "true_false", prompt: q.prompt }, answer: { kind: "true_false", value: q.answer }, explanation: q.explanation };
    case "fill_blank":
      return {
        data: { kind: "fill_blank", prompt: q.prompt, answerType: q.answerType, placeholder: q.placeholder, variables: q.variables },
        answer: { kind: "fill_blank", answerType: q.answerType, accepted: q.accepted, variables: q.variables },
        explanation: q.explanation,
      };
    case "matching": {
      // perm[k] = original index of the k-th displayed right item
      const perm = shuffledIndices(q.pairs.length, seed);
      const right = perm.map((orig) => q.pairs[orig].right);
      const map = q.pairs.map((_, i) => perm.indexOf(i));
      return {
        data: { kind: "matching", prompt: q.prompt, left: q.pairs.map((p) => p.left), right },
        answer: { kind: "matching", map },
        explanation: q.explanation,
      };
    }
    case "ordering": {
      const perm = shuffledIndices(q.items.length, seed);
      const items = perm.map((orig) => q.items[orig]);
      const order = q.items.map((_, i) => perm.indexOf(i));
      return { data: { kind: "ordering", prompt: q.prompt, items }, answer: { kind: "ordering", order }, explanation: q.explanation };
    }
    case "steps": {
      const steps: PublicStep[] = [];
      const answers: StepAnswer[] = [];
      for (const s of q.steps) {
        if (s.kind === "mcq") {
          steps.push({ kind: "mcq", prompt: s.prompt, options: s.options });
          answers.push({ kind: "mcq", option: s.answer });
        } else {
          steps.push({ kind: "fill_blank", prompt: s.prompt, answerType: s.answerType });
          answers.push({ kind: "fill_blank", answerType: s.answerType, accepted: s.accepted, variables: s.variables });
        }
      }
      return {
        data: { kind: "steps", prompt: q.prompt, steps },
        answer: { kind: "steps", steps: answers, explanations: q.steps.map((s) => s.explanation) },
        explanation: q.explanation,
      };
    }
  }
}
