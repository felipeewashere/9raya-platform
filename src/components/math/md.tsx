import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import katex from "katex";
import { cn } from "@/lib/utils";

const rehype = [[rehypeKatex, { strict: "ignore", throwOnError: false, output: "htmlAndMathml" }]] as const;

/**
 * remark-math only treats `$$…$$` as display math when the delimiters sit on their own lines;
 * written mid-sentence they become inline math, where `\tag`, `\\` row breaks and environments
 * fail. Content is authored both ways, so normalise before parsing:
 *  - block mode: put every `$$…$$` on its own lines (a centred display formula);
 *  - inline mode (options, labels): keep it inline as `\displaystyle`, dropping `\tag{…}`.
 */
export function normalizeMath(md: string, inline: boolean) {
  return md.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => {
    const body = tex.trim();
    return inline ? `$\\displaystyle ${body.replace(/\\tag\*?\{[^}]*\}/g, "")}$` : `\n\n$$\n${body}\n$$\n\n`;
  });
}

/**
 * Markdown with KaTeX math ($inline$ and $$display$$). Works in server and client components.
 * `inline` renders without wrapping paragraphs (for options, labels, table cells).
 */
export function Md({ children, className, inline = false }: { children: string; className?: string; inline?: boolean }) {
  const md = (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rehypePlugins={rehype as any}
      components={{
        // figures: readable in both themes (dark mode inverts the drawing, keeping hues)
        img: ({ src, alt }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" className="fig mx-auto my-4 block h-auto max-h-[480px] w-full max-w-[680px] object-contain" />
        ),
        a: ({ href, children }) => (
          <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
            {children}
          </a>
        ),
        // inline mode lives inside buttons, labels and paragraphs: only phrasing content is valid there
        ...(inline ? { p: ({ children }) => <span>{children}</span> } : {}),
      }}
    >
      {normalizeMath(children, inline)}
    </ReactMarkdown>
  );
  return inline ? <span className={cn("inline", className)}>{md}</span> : <div className={cn("prose-lesson", className)}>{md}</div>;
}

/** A single TeX expression (no Markdown). */
export function Tex({ children, display = false, className }: { children: string; display?: boolean; className?: string }) {
  const html = katex.renderToString(children, { displayMode: display, throwOnError: false, strict: "ignore" });
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
