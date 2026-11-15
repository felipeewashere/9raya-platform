import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { ModuleArt } from "./module-art";
import type { ModuleCard } from "@/lib/data/modules";
import { cn } from "@/lib/utils";
import { withBase } from "@/lib/base-path";

const PAPER = "#efede6";
const INK = "#0e0e0e";

/** Paper text on dark module colours, ink on light ones. */
function inkOn(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 115 ? INK : PAPER;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A module as an editorial panel: flat colour, big number, framed motion graphic, title, progress. */
export function CourseCard({ m, index = 0, unit = "leçons", progress = true }: { m: ModuleCard; index?: number; unit?: string; progress?: boolean }) {
  const fg = inkOn(m.color);
  const accent = fg === PAPER ? "#ffd60a" : m.color === "#2340ff" ? "#ffd60a" : "#2340ff";
  const pct = m.total ? Math.round((100 * m.completed) / m.total) : 0;
  const rule = { borderColor: fg } as CSSProperties;

  const body = (
    <>
      <div className="label flex items-center justify-between border-b px-4 py-2" style={rule}>
        <span>Module {pad(index + 1)}</span>
        <span>{m.available ? `${m.total} ${unit}` : "Bientôt"}</span>
      </div>
      <div className="grid grid-cols-[auto_1fr] items-end gap-4 px-4 pt-4">
        <span className="font-display text-[4.5rem] leading-[0.8] sm:text-[5.5rem]">{pad(index + 1)}</span>
        <figure className="min-w-0">
          <figcaption className="label mb-1 text-right !text-[0.6rem] opacity-80">Fig. {pad(index + 1)}</figcaption>
          <div className="relative aspect-[16/9] overflow-hidden border" style={rule}>
            {m.clip ? (
              <video
                src={withBase(m.clip.src)}
                poster={withBase(m.clip.poster ?? undefined)}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-hidden
                tabIndex={-1}
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <ModuleArt slug={m.slug} color={m.color} fg={fg} accent={accent} className="absolute inset-0" />
            )}
          </div>
        </figure>
      </div>
      <div className="space-y-3 px-4 pb-4 pt-4">
        <h3 className="font-display text-[2.1rem] leading-[0.9] sm:text-[2.5rem]">{m.title}</h3>
        {m.available && !progress ? (
          <p className="label flex items-center justify-between">
            <span>{m.total} {unit}</span>
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
          </p>
        ) : m.available ? (
          <>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label={`Progression en ${m.title}`}
              className="h-2 border"
              style={rule}
            >
              <div className="h-full transition-[width] duration-700" style={{ width: `${pct}%`, background: fg }} />
            </div>
            <div className="label flex items-center justify-between gap-3">
              <span className="truncate">
                {m.completed}/{m.total} {unit}
                {m.nextLesson ? ` — ${m.nextLesson}` : ""}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {pct} % <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </>
        ) : (
          <p className="label opacity-80">Arrive bientôt</p>
        )}
      </div>
    </>
  );

  const shell = "card-in group block overflow-hidden border border-[var(--rule)]";
  const style = { "--i": index, background: m.color, color: fg } as CSSProperties;
  if (!m.available)
    return (
      <div className={cn(shell, "saturate-[0.55]")} style={style}>
        {body}
      </div>
    );
  return (
    <Link
      href={m.href}
      className={cn(shell, "transition-[transform,box-shadow] duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_var(--rule)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60")}
      style={style}
    >
      {body}
    </Link>
  );
}
