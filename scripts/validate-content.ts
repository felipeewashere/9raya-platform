/**
 * Validate chapter JSON files against the content schema and run math sanity checks.
 * Usage: npx tsx scripts/validate-content.ts content/algebre-1/ch01.json [...more]
 *        npx tsx scripts/validate-content.ts            (validates every content/**\/ch*.json)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import katex from "katex";
import { chapterSchema, type Question } from "../src/content/schema";

function listChapterFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    // td/ holds TD series (another format), not course chapters
    if (statSync(p).isDirectory()) {
      if (name !== "td") out.push(...listChapterFiles(p));
    } else if (/^ch\d+\.json$/.test(name)) out.push(p);
  }
  return out;
}

/** Extract $...$ and $$...$$ segments and try to render each with KaTeX. */
function checkMath(text: string, where: string, errors: string[]) {
  // A single backslash in JSON turns \frac, \beta, \theta, \right, \neq into control characters.
  if (/[\f\b\t\r\v]/.test(text))
    errors.push(`${where}: contains a control character — a LaTeX command was written with ONE backslash in JSON (\\frac → form feed, \\theta → tab, \\beta → backspace, \\right → CR). Use \\\\frac in JSON.`);
  for (const seg of text.match(/\$\$[\s\S]+?\$\$/g) ?? [])
    if (/\n(?:eq|e\b|u\b|abla|ot|i\b|ewline|ormalsize|leq|geq|mid|subseteq|exists|in\b)/.test(seg))
      errors.push(`${where}: display math contains a newline followed by "${seg.match(/\n(\w+)/)?.[1]}" — probably \\neq / \\nu / \\not written with one backslash`);
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const src = m[1] ?? m[2];
    try {
      katex.renderToString(src, { throwOnError: true, displayMode: !!m[1], strict: "ignore" });
    } catch (e) {
      errors.push(`${where}: KaTeX error in "${src.slice(0, 80)}": ${(e as Error).message.split("\n")[0]}`);
    }
  }
  const dollars = (text.replace(/\\\$/g, "").match(/\$/g) ?? []).length;
  if (dollars % 2 !== 0) errors.push(`${where}: odd number of $ delimiters`);
}

function walkStrings(value: unknown, where: string, errors: string[]) {
  if (typeof value === "string") checkMath(value, where, errors);
  else if (Array.isArray(value)) value.forEach((v, i) => walkStrings(v, `${where}[${i}]`, errors));
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      if (k === "expr" || k === "latex" || k === "opLatex" || k === "elements" || k === "accepted") continue;
      walkStrings(v, `${where}.${k}`, errors);
    }
}

function checkQuestion(q: Question, where: string, errors: string[]) {
  if (q.kind === "mcq") {
    const ids = q.options.map((o) => o.id);
    if (new Set(ids).size !== ids.length) errors.push(`${where}: duplicate option ids`);
    if (!ids.includes(q.answer)) errors.push(`${where}: answer "${q.answer}" is not an option id`);
  }
  if (q.kind === "fill_blank" && (q.prompt.match(/___/g) ?? []).length !== 1)
    errors.push(`${where}: fill_blank prompt must contain exactly one ___`);
  if (q.kind === "steps")
    q.steps.forEach((s, i) => {
      if (s.kind === "mcq" && !s.options.some((o) => o.id === s.answer))
        errors.push(`${where}.steps[${i}]: answer is not an option id`);
    });
}

const files = process.argv.slice(2).length ? process.argv.slice(2) : listChapterFiles("content");
let failed = false;
for (const file of files) {
  const errors: string[] = [];
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`✗ ${file}: invalid JSON — ${(e as Error).message}`);
    failed = true;
    continue;
  }
  const parsed = chapterSchema.safeParse(json);
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 40))
      errors.push(`schema ${issue.path.join(".")}: ${issue.message}`);
  } else {
    const ch = parsed.data;
    const slugs = new Set<string>();
    ch.sections.forEach((s, si) =>
      s.lessons.forEach((l, li) => {
        const where = `sections[${si}].lessons[${li}] (${l.slug})`;
        if (slugs.has(l.slug)) errors.push(`${where}: duplicate lesson slug`);
        slugs.add(l.slug);
        l.quiz.forEach((q, qi) => checkQuestion(q, `${where}.quiz[${qi}]`, errors));
        l.blocks.forEach((b, bi) => {
          if (b.type === "checkpoint") checkQuestion(b.question, `${where}.blocks[${bi}]`, errors);
          if (b.type === "interactive" && b.spec.widget === "cayley-table") {
            const n = b.spec.props.elements.length;
            const t = b.spec.props.table;
            if (t.length !== n || t.some((r) => r.length !== n || r.some((x) => x >= n)))
              errors.push(`${where}.blocks[${bi}]: cayley table must be ${n}×${n} with indices < ${n}`);
          }
        });
      }),
    );
    walkStrings(json, "chapter", errors);
    const lessons = ch.sections.reduce((n, s) => n + s.lessons.length, 0);
    const questions = ch.sections.reduce(
      (n, s) => n + s.lessons.reduce((m, l) => m + l.quiz.length + l.blocks.filter((b) => b.type === "checkpoint").length, 0),
      0,
    );
    if (!errors.length) console.log(`✓ ${file}: ${ch.sections.length} sections, ${lessons} lessons, ${questions} questions`);
  }
  if (errors.length) {
    failed = true;
    console.error(`✗ ${file}: ${errors.length} problem(s)`);
    for (const e of errors) console.error("   - " + e);
  }
}
process.exit(failed ? 1 : 0);
