/**
 * Renders every Markdown string of the course content through the SAME pipeline as the site
 * (react-markdown + remark-math + rehype-katex) and fails on any KaTeX error. The content
 * validator checks formulas with KaTeX directly; this also catches Markdown side effects
 * (escapes, line breaks inside math) that only happen in the real renderer.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Md } from "@/components/math/md";

const SKIP_KEYS = new Set(["expr", "latex", "opLatex", "elements", "accepted", "variables", "slug", "id", "answerType", "kind", "type", "origin", "widget", "answer"]);

function collect(value: unknown, path: string, out: { path: string; md: string }[]) {
  if (typeof value === "string") {
    if (value.includes("$")) out.push({ path, md: value });
  } else if (Array.isArray(value)) value.forEach((v, i) => collect(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) if (!SKIP_KEYS.has(k)) collect(v, `${path}.${k}`, out);
}

const root = join(__dirname, "..", "..", "content");
const files = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) => readdirSync(join(root, d.name)).filter((f) => /^ch\d+\.json$/.test(f)).map((f) => join(d.name, f)));

describe.each(files)("site rendering of %s", (file) => {
  it("renders every formula without a KaTeX error", { timeout: 600_000 }, () => {
    const strings: { path: string; md: string }[] = [];
    collect(JSON.parse(readFileSync(join(root, file), "utf8")), "chapter", strings);
    const failures: string[] = [];
    for (const s of strings) {
      const html = renderToStaticMarkup(createElement(Md as (p: { inline?: boolean }) => ReturnType<typeof Md>, { inline: false }, s.md));
      const m = html.match(/class="katex-error"[^>]*title="([^"]*)"/);
      if (m) failures.push(`${s.path}: ${m[1].slice(0, 140)}`);
    }
    expect(failures).toEqual([]);
  });
});
