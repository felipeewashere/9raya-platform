import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chapterSchema, questionSchema, type Question } from "@/content/schema";
import { joinQuestion, splitQuestion } from "@/lib/quiz/serialize";
import type { PublicQuestion, SecretAnswer } from "@/lib/quiz/types";

const dir = join(__dirname, "..", "..", "content", "algebre-1");
const files = readdirSync(dir).filter((f) => /^ch0\d+\.json$/.test(f)).sort();

/** What the database stores: JSON (undefined fields disappear). */
const stored = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function collect() {
  const out: { where: string; q: Question }[] = [];
  for (const file of files) {
    const ch = chapterSchema.parse(JSON.parse(readFileSync(join(dir, file), "utf8")));
    for (const s of ch.sections)
      for (const l of s.lessons) {
        l.quiz.forEach((q, i) => out.push({ where: `${ch.slug}/${l.slug}/quiz-${i + 1}`, q }));
        let cp = 0;
        for (const b of l.blocks) if (b.type === "checkpoint") out.push({ where: `${ch.slug}/${l.slug}/cp-${++cp}`, q: b.question });
      }
  }
  return out;
}

describe("joinQuestion is the inverse of splitQuestion", () => {
  const all = collect();

  it("found the course questions", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(all.length).toBeGreaterThan(50);
  });

  it.each(all.map((x) => [x.where, x.q] as const))("%s", (where, q) => {
    const { data, answer, explanation } = splitQuestion(q, where);
    const joined = joinQuestion(q.kind, stored(data) as PublicQuestion, stored(answer) as SecretAnswer, explanation);
    expect(joined).toEqual(q);
    // the result is a valid authored question and re-splits to the same stored rows
    expect(questionSchema.parse(joined)).toEqual(q);
    const again = splitQuestion(joined, where);
    expect(stored(again)).toEqual(stored({ data, answer, explanation }));
  });

  it("covers every question kind", () => {
    const kinds = new Set(all.map((x) => x.q.kind));
    for (const k of ["mcq", "true_false", "fill_blank", "matching", "ordering", "steps"]) expect(kinds.has(k as Question["kind"])).toBe(true);
  });

  it("restores the authored order of matching pairs and ordering items", () => {
    const m: Question = { kind: "matching", prompt: "p", pairs: [{ left: "a", right: "1" }, { left: "b", right: "2" }, { left: "c", right: "3" }], explanation: "e" };
    const s = splitQuestion(m, "seed");
    expect(s.data.kind === "matching" && s.data.right).not.toEqual(["1", "2", "3"]);
    expect(joinQuestion("matching", s.data, s.answer, s.explanation)).toEqual(m);
    const o: Question = { kind: "ordering", prompt: "p", items: ["x", "y", "z", "w"], explanation: "e" };
    const so = splitQuestion(o, "seed-2");
    expect(joinQuestion("ordering", so.data, so.answer, so.explanation)).toEqual(o);
  });

  it("rejects inconsistent rows", () => {
    expect(() => joinQuestion("mcq", { kind: "true_false", prompt: "x" }, { kind: "true_false", value: true }, "e")).toThrow();
    expect(() => joinQuestion("ordering", { kind: "ordering", prompt: "x", items: ["a", "b", "c"] }, { kind: "ordering", order: [0, 1] }, "e")).toThrow();
  });
});
