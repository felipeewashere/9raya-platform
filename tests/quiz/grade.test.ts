import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chapterSchema, type Question } from "@/content/schema";
import { equivalentExpressions, gradeQuestion, gradeStep, matchesAccepted, normalizeText, parseNumber } from "@/lib/quiz/grade";
import { shuffledIndices, splitQuestion } from "@/lib/quiz/serialize";
import type { GivenAnswer, PublicQuestion, SecretAnswer } from "@/lib/quiz/types";

describe("answer normalization", () => {
  it("ignores case, accents, spaces and final punctuation in text answers", () => {
    expect(normalizeText("  Élément   Neutre. ")).toBe("element neutre");
    expect(matchesAccepted("text", "associativite", ["associativité"])).toBe(true);
    expect(matchesAccepted("text", "commutativité", ["associativité"])).toBe(false);
  });

  it("reads numbers written as fractions, French decimals or expressions", () => {
    expect(parseNumber("1/2")).toBe(0.5);
    expect(parseNumber("0,5")).toBe(0.5);
    expect(parseNumber("−3")).toBe(-3);
    expect(parseNumber("2^3")).toBe(8);
    expect(matchesAccepted("number", "4/2", ["2"])).toBe(true);
    expect(matchesAccepted("number", "2.0001", ["2"])).toBe(false);
  });

  it("recognizes algebraically equivalent expressions", () => {
    expect(equivalentExpressions("(x-1)(x+1)", "x^2 - 1", ["x"])).toBe(true);
    expect(equivalentExpressions("X²−1", "x^2-1", ["x"])).toBe(true);
    expect(equivalentExpressions("x^2 + 1", "x^2 - 1", ["x"])).toBe(false);
    expect(equivalentExpressions("x + y - x y", "x+y-x*y", ["x", "y"])).toBe(true);
  });

  it("never evaluates anything but arithmetic", () => {
    expect(parseNumber("import({}, {})")).toBeNull();
    expect(parseNumber("a = 2")).toBeNull();
    expect(parseNumber("evaluate('1+1')")).toBeNull();
    expect(matchesAccepted("expression", "x => 1", ["x"])).toBe(false);
  });
});

describe("shuffling", () => {
  it("is deterministic and never leaves items in their original order", () => {
    for (let n = 2; n <= 7; n++)
      for (const seed of ["a", "b", "lesson-1:quiz-2", "xyz"]) {
        const p = shuffledIndices(n, seed);
        expect([...p].sort()).toEqual(Array.from({ length: n }, (_, i) => i));
        expect(p.some((v, i) => v !== i)).toBe(true);
        expect(shuffledIndices(n, seed)).toEqual(p);
      }
  });
});

// ------------------------------------------------------------------ every authored question

function correctGiven(data: PublicQuestion, answer: SecretAnswer): GivenAnswer | null {
  switch (answer.kind) {
    case "mcq":
      return { option: answer.option };
    case "true_false":
      return { value: answer.value };
    case "fill_blank":
      return { text: answer.accepted[0] };
    case "matching":
      return { map: answer.map };
    case "ordering":
      return { order: answer.order };
    default:
      return null;
  }
}

function wrongGiven(data: PublicQuestion, answer: SecretAnswer): GivenAnswer | null {
  switch (answer.kind) {
    case "mcq":
      return data.kind === "mcq" ? { option: data.options.find((o) => o.id !== answer.option)!.id } : null;
    case "true_false":
      return { value: !answer.value };
    case "fill_blank":
      return { text: "zzz_not_an_answer" };
    case "matching":
      return { map: [...answer.map].reverse() };
    case "ordering":
      return { order: [...answer.order].reverse() };
    default:
      return null;
  }
}

const contentDir = join(__dirname, "..", "..", "content", "algebre-1");
const files = readdirSync(contentDir).filter((f) => /^ch\d+\.json$/.test(f));

describe.each(files)("authored questions in %s", (file) => {
  const chapter = chapterSchema.parse(JSON.parse(readFileSync(join(contentDir, file), "utf8")));
  const all: { where: string; q: Question }[] = [];
  for (const s of chapter.sections)
    for (const l of s.lessons) {
      l.quiz.forEach((q, i) => all.push({ where: `${l.slug} quiz-${i}`, q }));
      l.blocks.forEach((b, i) => b.type === "checkpoint" && all.push({ where: `${l.slug} block-${i}`, q: b.question }));
    }

  it("accepts the correct answer and rejects a wrong one for every question", () => {
    const failures: string[] = [];
    for (const { where, q } of all) {
      const { data, answer, explanation } = splitQuestion(q, where);
      if (answer.kind === "steps" && data.kind === "steps") {
        answer.steps.forEach((s, i) => {
          const given: GivenAnswer = s.kind === "mcq" ? { option: s.option } : { text: s.accepted[0] };
          if (!gradeStep(data, answer, i, given).correct) failures.push(`${where} step ${i}: correct answer rejected`);
        });
        continue;
      }
      const good = correctGiven(data, answer)!;
      if (!gradeQuestion(data, answer, good, explanation).correct) failures.push(`${where}: correct answer rejected (${JSON.stringify(good)})`);
      const bad = wrongGiven(data, answer);
      if (bad && gradeQuestion(data, answer, bad, explanation).correct) failures.push(`${where}: wrong answer accepted (${JSON.stringify(bad)})`);
      // every accepted alternative must also pass
      if (answer.kind === "fill_blank")
        for (const alt of answer.accepted)
          if (!matchesAccepted(answer.answerType, alt, answer.accepted, answer.variables)) failures.push(`${where}: accepted "${alt}" does not parse`);
    }
    expect(failures).toEqual([]);
    expect(all.length).toBeGreaterThan(50);
  });

  it("never leaks the answer in the public data", () => {
    for (const { where, q } of all) {
      const { data } = splitQuestion(q, where);
      const json = JSON.stringify(data);
      expect(json).not.toMatch(/"answer"|"accepted"|"explanation"/);
      if (q.kind === "ordering") expect((data as { items: string[] }).items).not.toEqual(q.items);
    }
  });
});
