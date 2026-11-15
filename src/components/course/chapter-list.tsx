"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, CircleDot, Lock } from "lucide-react";
import { NoteLabel, NumberSquare } from "@/components/notes";
import { cn } from "@/lib/utils";
import type { OutlineChapter } from "@/lib/data/courses";

const STATE = {
  completed: { label: "terminé", cls: "text-success" },
  in_progress: { label: "en cours", cls: "text-primary" },
  available: { label: "disponible", cls: "text-muted-foreground" },
  locked: { label: "verrouillé", cls: "text-muted-foreground" },
} as const;

/** The course as a table of contents: chapters (numbered squares) → sections → lessons (em dashes). */
export function ChapterList({ courseSlug, chapters }: { courseSlug: string; chapters: OutlineChapter[] }) {
  const initial = chapters.find((c) => c.state === "in_progress")?.slug ?? chapters.find((c) => c.state === "available")?.slug ?? chapters[0]?.slug;
  const [open, setOpen] = useState<Set<string>>(() => new Set(initial ? [initial] : []));

  // open the chapter targeted by the URL hash (#chapitre-<slug>), e.g. from the learning path
  useEffect(() => {
    const sync = () => {
      const slug = decodeURIComponent(window.location.hash.replace(/^#chapitre-/, ""));
      if (slug && chapters.some((c) => c.slug === slug)) {
        setOpen((s) => new Set(s).add(slug));
        requestAnimationFrame(() => document.getElementById(`chapitre-${slug}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [chapters]);

  const toggle = (slug: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(slug)) n.delete(slug);
      else n.add(slug);
      return n;
    });

  return (
    <ol className="divide-y divide-border border-y border-border">
      {chapters.map((c) => {
        const isOpen = open.has(c.slug);
        const locked = c.state === "locked";
        return (
          <li key={c.id} id={`chapitre-${c.slug}`} className="scroll-mt-20">
            <h3>
            <button
              type="button"
              onClick={() => toggle(c.slug)}
              aria-expanded={isOpen}
              aria-controls={`chapitre-${c.slug}-contenu`}
              className="group flex w-full items-baseline gap-3 py-3.5 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40"
            >
              <NumberSquare tone={c.state === "completed" ? "green" : locked ? "muted" : "blue"} className="translate-y-[0.15em] text-[0.85rem]">
                {c.state === "completed" ? <Check className="size-3.5" strokeWidth={3} /> : locked ? <Lock className="size-3" /> : c.number}
              </NumberSquare>
              <span className="min-w-0 flex-1">
                <span className={cn("block font-bold uppercase leading-snug tracking-[0.02em]", locked ? "text-muted-foreground" : "text-primary group-hover:underline group-hover:underline-offset-4")}>{c.title}</span>
                <span className="block text-[0.88rem] font-normal text-muted-foreground">
                  <span className={cn("smallcaps", STATE[c.state].cls)}>{STATE[c.state].label}</span> · {c.completed} / {c.total} leçons
                </span>
              </span>
              <motion.span animate={{ rotate: isOpen ? 180 : 0 }} className="self-center text-muted-foreground">
                <ChevronDown className="size-5" />
              </motion.span>
            </button>
            </h3>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={`chapitre-${c.slug}-contenu`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-4 pb-5 pl-1 sm:pl-10">
                    {c.description && <p className="text-[0.95rem] italic text-muted-foreground">{c.description}</p>}
                    {locked && (
                      <p className="text-[0.95rem]">
                        <NoteLabel tone="red">Remarque :</NoteLabel> termine au moins la moitié du chapitre précédent pour débloquer celui-ci.
                      </p>
                    )}
                    {c.sections.map((s) => (
                      <div key={s.id}>
                        <p className="mb-1">
                          <NoteLabel>
                            {s.number ? `${s.number} ` : ""}
                            {s.title} :
                          </NoteLabel>
                        </p>
                        <ul className="dash-list">
                          {s.lessons.map((l) => {
                            const href = `/cours/${courseSlug}/${c.slug}/${l.slug}`;
                            const status =
                              l.status === "completed" ? (
                                <Check className={cn("size-4", l.skipped ? "text-muted-foreground" : "text-success")} strokeWidth={2.6} aria-label={l.skipped ? "Passée" : "Terminée"} />
                              ) : l.status === "in_progress" ? (
                                <CircleDot className="size-3.5 text-primary" aria-label="En cours" />
                              ) : null;
                            const row = (
                              <span className="flex items-baseline gap-2 py-1">
                                <span className={cn("min-w-0", !locked && "group-hover/row:text-primary group-hover/row:underline group-hover/row:underline-offset-2")}>
                                  {l.number && <span className="mr-1.5 tabular-nums text-muted-foreground">{l.number}</span>}
                                  {l.title}
                                </span>
                                <span className="leader" aria-hidden />
                                {l.bestScore !== null && (
                                  <span className={cn("hidden shrink-0 text-[0.85rem] tabular-nums sm:inline", l.bestScore >= 70 ? "text-success" : "text-muted-foreground")}>{l.bestScore} %</span>
                                )}
                                <span className="grid w-4 shrink-0 translate-y-0.5 place-items-center">{status}</span>
                              </span>
                            );
                            return (
                              <li key={l.id}>
                                {locked ? (
                                  <span className="block cursor-not-allowed opacity-60">{row}</span>
                                ) : (
                                  <Link href={href} className="group/row block focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
                                    {row}
                                  </Link>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ol>
  );
}
