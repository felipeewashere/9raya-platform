"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useScroll, useSpring } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  CircleDot,
  Lock,
  Maximize2,
  Minimize2,
  NotebookPen,
  PanelLeft,
  PanelRight,
  SkipForward,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { FooterBand, NoteLabel, NumberSquare, Watermark } from "@/components/notes";
import { LessonBlockView, headingId } from "./blocks";
import { saveLessonPosition, completeLessonWithoutQuiz, skipLesson, unskipLesson } from "@/app/actions/learning";
import { cn } from "@/lib/utils";
import { stripNumber } from "./strip-number";
import type { LessonView } from "@/lib/data/lesson";
import type { OutlineChapter } from "@/lib/data/courses";

// ------------------------------------------------------------------ sidebar preferences (per browser)

type Panels = { left: boolean; right: boolean };
const PANELS_KEY = "reader-panels";
const DEFAULT_PANELS = '{"left":true,"right":true}';
const panelListeners = new Set<() => void>();

function readPanels(): string {
  try {
    return localStorage.getItem(PANELS_KEY) ?? DEFAULT_PANELS;
  } catch {
    return DEFAULT_PANELS;
  }
}

/** Sidebar visibility remembered in localStorage, hydration-safe (server renders the defaults). */
function usePanelPrefs(): [Panels, typeof updatePanels] {
  const raw = useSyncExternalStore(
    (cb) => {
      panelListeners.add(cb);
      return () => panelListeners.delete(cb);
    },
    readPanels,
    () => DEFAULT_PANELS,
  );
  return [parsePanels(raw), updatePanels];
}

function parsePanels(raw: string): Panels {
  try {
    const p = JSON.parse(raw);
    return { left: p.left !== false, right: p.right !== false };
  } catch {
    return { left: true, right: true };
  }
}

/** Updates from the CURRENT stored value, so stale closures (keyboard handlers) stay correct. */
function updatePanels(fn: (p: Panels) => Panels) {
  const next = fn(parsePanels(readPanels()));
  try {
    localStorage.setItem(PANELS_KEY, JSON.stringify(next));
  } catch {}
  panelListeners.forEach((l) => l());
}

type Outline ={ id: string; label: string; index: number; kind: "heading" | "definition" | "theorem" | "checkpoint" }[];

function buildOutline(view: LessonView): Outline {
  const out: Outline = [];
  view.blocks.forEach((b, i) => {
    const d = b.data as Record<string, string>;
    // "Définition — Définition 1 (…)" → "Définition 1 (…)"
    const labelled = (prefix: string, title?: string) =>
      !title ? prefix : title.toLowerCase().startsWith(prefix.toLowerCase().slice(0, 6)) ? title : `${prefix} — ${title}`;
    const THEOREM: Record<string, string> = { theoreme: "Théorème", proposition: "Proposition", propriete: "Propriété", lemme: "Lemme", corollaire: "Corollaire" };
    if (b.type === "heading") out.push({ id: headingId(d.text, i), label: stripNumber(d.text), index: i, kind: "heading" });
    else if (b.type === "definition") out.push({ id: `bloc-${i}`, label: labelled("Définition", d.title), index: i, kind: "definition" });
    else if (b.type === "theorem") out.push({ id: `bloc-${i}`, label: labelled(THEOREM[d.kind] ?? "Proposition", d.title), index: i, kind: "theorem" });
    else if (b.type === "checkpoint") out.push({ id: `bloc-${i}`, label: "Vérifie ta compréhension", index: i, kind: "checkpoint" });
  });
  return out;
}

function CourseNav({ view, chapters, onNavigate }: { view: LessonView; chapters: OutlineChapter[]; onNavigate?: () => void }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set([view.chapter.slug]));
  return (
    <nav aria-label="Chapitres et leçons" className="space-y-1 text-sm">
      {chapters.map((c) => {
        const isOpen = open.has(c.slug);
        const locked = c.state === "locked";
        return (
          <div key={c.id}>
            <button
              type="button"
              onClick={() => setOpen((s) => (s.has(c.slug) ? new Set([...s].filter((x) => x !== c.slug)) : new Set(s).add(c.slug)))}
              aria-expanded={isOpen}
              className={cn("flex w-full items-baseline gap-2 rounded-sm px-2 py-2 text-left font-bold hover:bg-muted", c.slug === view.chapter.slug && "text-primary")}
            >
              <NumberSquare tone={locked ? "muted" : c.slug === view.chapter.slug ? "blue" : "muted"} className="translate-y-[0.1em] text-[0.75rem]">
                {locked ? <Lock className="size-3" /> : c.number}
              </NumberSquare>
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              <motion.span animate={{ rotate: isOpen ? 180 : 0 }}>
                <ChevronDown className="size-4 text-muted-foreground" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  {c.sections.map((s) => (
                    <div key={s.id} className="mb-1 ml-3 border-l border-primary/20 pl-2">
                      <p className="px-2 pb-1 pt-2 text-[0.8rem] font-bold text-primary">{s.title} :</p>
                      {s.lessons.map((l) => {
                        const current = l.id === view.lesson.id;
                        const icon = l.status === "completed" ? <Check className={cn("size-3.5", l.skipped ? "text-muted-foreground" : "text-success")} /> : l.status === "in_progress" ? <CircleDot className="size-3.5 text-primary" /> : <Circle className="size-3.5 text-muted-foreground" />;
                        return locked ? (
                          <span key={l.id} className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-muted-foreground opacity-60">
                            {icon}
                            <span className="truncate">{l.title}</span>
                          </span>
                        ) : (
                          <Link
                            key={l.id}
                            href={`/cours/${view.courseSlug}/${c.slug}/${l.slug}`}
                            onClick={onNavigate}
                            aria-current={current ? "page" : undefined}
                            className={cn("flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted", current && "bg-brand-soft font-bold text-primary")}
                          >
                            {icon}
                            <span className="truncate">{l.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
}


export function LessonReader({ view, chapters }: { view: LessonView; chapters: OutlineChapter[] }) {
  const router = useRouter();
  const outline = useMemo(() => buildOutline(view), [view]);
  // headings are numbered like the sections of printed notes: 1, 2, 3…
  const headingNumbers = useMemo(() => {
    let n = 0;
    return view.blocks.map((b) => (b.type === "heading" ? ++n : undefined));
  }, [view.blocks]);
  const [{ left, right }, setPanels] = usePanelPrefs();
  const setLeft = (f: (v: boolean) => boolean) => setPanels((p) => ({ ...p, left: f(p.left) }));
  const setRight = (f: (v: boolean) => boolean) => setPanels((p) => ({ ...p, right: f(p.right) }));
  const [focus, setFocus] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [mobileOutline, setMobileOutline] = useState(false);
  const [active, setActive] = useState<string | null>(outline[0]?.id ?? null);
  const [showResume, setShowResume] = useState(view.lastBlock > 2 && view.lesson.status !== "completed");
  const [pending, start] = useTransition();
  const furthest = useRef(view.lastBlock);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });

  // scroll-spy + save the furthest block read
  useEffect(() => {
    const els = view.blocks.map((_, i) => document.getElementById(`bloc-${i}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.index);
          if (i > furthest.current) furthest.current = i;
          const o = [...outline].reverse().find((x) => x.index <= i);
          if (o) setActive(o.id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    const save = () => saveLessonPosition(view.lesson.id, furthest.current);
    const interval = setInterval(save, 15000);
    const onHide = () => document.visibilityState === "hidden" && save();
    document.addEventListener("visibilitychange", onHide);
    save();
    return () => {
      io.disconnect();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
      save();
    };
  }, [view.blocks, view.lesson.id, outline]);

  const toggleFocus = useCallback(() => {
    setFocus((f) => {
      const next = !f;
      if (next) document.documentElement.requestFullscreen?.().catch(() => {});
      else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      return next;
    });
  }, []);

  useEffect(() => {
    const onFs = () => !document.fullscreenElement && setFocus(false);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable], [role=dialog]") || e.ctrlKey || e.metaKey) return;
      if (e.altKey && e.key === "ArrowRight" && view.next && !view.next.locked) router.push(view.next.href);
      else if (e.altKey && e.key === "ArrowLeft" && view.prev) router.push(view.prev.href);
      else if (e.key === "[") setLeft((v) => !v);
      else if (e.key === "]") setRight((v) => !v);
      else if (e.key === "f") toggleFocus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.next, view.prev, router, toggleFocus]);

  const resume = () => {
    document.getElementById(`bloc-${view.lastBlock}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setShowResume(false);
  };

  const showLeft = left && !focus;
  const showRight = right && !focus;
  const quizHref = `/cours/${view.courseSlug}/${view.chapter.slug}/${view.lesson.slug}/quiz`;

  const outlineList = (
    <ol className="space-y-0.5 text-sm">
      {outline.map((o) => (
        <li key={o.id}>
          <a
            href={`#${o.id}`}
            onClick={() => setMobileOutline(false)}
            className={cn(
              "block truncate border-l-2 py-1 pl-3 pr-2 transition-colors",
              o.kind !== "heading" && "pl-5 text-[0.85rem]",
              active === o.id ? "border-brand font-bold text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </a>
        </li>
      ))}
      <li>
        <a href="#fin-lecon" className="block border-l-2 border-transparent py-1 pl-3 text-muted-foreground hover:text-foreground">
          Quiz de fin de leçon
        </a>
      </li>
    </ol>
  );

  return (
    <div className="min-h-dvh bg-background">
      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-primary/25 bg-background">
        <div className="flex h-12 items-center gap-2 px-3 sm:px-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Ouvrir le sommaire du cours">
            <PanelLeft className="size-4" />
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={() => setLeft((v) => !v)} aria-label="Afficher/masquer le sommaire" aria-pressed={showLeft}>
                <PanelLeft className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sommaire ( [ )</TooltipContent>
          </Tooltip>
          <Link href={`/cours/${view.courseSlug}`} className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4 shrink-0" />
            <span className="hidden truncate sm:inline">{view.courseTitle}</span>
          </Link>
          <span className="hidden min-w-0 truncate text-sm text-muted-foreground md:inline">· {view.lesson.section_title}</span>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="xl:hidden" onClick={() => setMobileOutline(true)} aria-label="Plan de la leçon">
              <NotebookPen className="size-4" />
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden xl:inline-flex" onClick={() => setRight((v) => !v)} aria-pressed={showRight} aria-label="Afficher/masquer le panneau de droite">
                  <PanelRight className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Plan de la leçon ( ] )</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={toggleFocus} aria-pressed={focus} aria-label={focus ? "Quitter le mode concentration" : "Mode concentration"}>
                  {focus ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mode concentration ( f )</TooltipContent>
            </Tooltip>
            <ThemeToggle />
          </div>
        </div>
        <motion.div className="-mb-px h-[3px] origin-left bg-brand" style={{ scaleX: progress }} aria-hidden />
      </header>

      <div className="mx-auto flex max-w-[1500px]">
        {/* left: course navigation */}
        <AnimatePresence initial={false}>
          {showLeft && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="sticky top-12 hidden h-[calc(100dvh-3rem)] shrink-0 overflow-hidden border-r border-primary/15 lg:block"
            >
              <div className="h-full w-[300px] overflow-y-auto p-3">
                <CourseNav view={view} chapters={chapters} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* main content */}
        <main id="contenu" className="relative isolate min-w-0 flex-1 px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
          <Watermark className="absolute right-[2%] top-28 -z-10 w-[min(70vw,520px)]" />
          <article className={cn("mx-auto space-y-6", focus ? "max-w-3xl" : "max-w-[46rem]")}>
            <header className="space-y-3 border-b border-[var(--rule)] pb-6">
              <h1 className="font-display text-[2.6rem] leading-[0.9] sm:text-[3.6rem]">{view.lesson.title}</h1>
              {view.lesson.status === "completed" && (
                <p className="label flex items-center gap-1 text-success">
                  <Check className="size-4" /> Terminée
                </p>
              )}
            </header>

            <AnimatePresence>
              {showResume && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 rounded-md border border-primary/40 bg-brand-soft px-4 py-2.5 text-[0.95rem]">
                  <span className="flex-1">
                    <NoteLabel>Reprise :</NoteLabel> tu t&apos;étais arrêté(e) plus bas dans cette leçon.
                  </span>
                  <Button size="sm" onClick={resume}>
                    Reprendre
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => setShowResume(false)} aria-label="Fermer">
                    <X className="size-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {view.blocks.length === 0 && <p className="py-6 text-center italic text-muted-foreground">Le contenu de cette leçon arrive bientôt.</p>}

            {view.blocks.map((b, i) => (
              <motion.div
                key={b.id}
                id={`bloc-${i}`}
                data-index={i}
                className="scroll-mt-24"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <LessonBlockView block={b} index={i} number={headingNumbers[i]} />
              </motion.div>
            ))}

            {/* end of lesson */}
            <section id="fin-lecon" aria-labelledby="fin-lecon-titre" className="scroll-mt-24 overflow-hidden rounded-md border-[1.5px] border-primary bg-brand-soft">
              <h2 id="fin-lecon-titre" className="bg-primary px-4 py-1.5 text-[1rem] font-bold text-primary-foreground smallcaps">
                {view.lesson.skipped ? "Leçon passée" : view.lesson.status === "completed" ? "Leçon terminée" : "Valide ta leçon"}
              </h2>
              <div className="px-4 py-4 text-center sm:px-6">
              {view.lesson.skipped && (
                <p className="mx-auto max-w-md text-[0.95rem]">
                  <NoteLabel tone="red">Remarque :</NoteLabel> cochée sans XP. Réussis le quiz quand tu veux pour gagner l&apos;XP de cette leçon.
                </p>
              )}
              <p className="mx-auto mt-1 max-w-md">
                {view.quizCount
                  ? view.lesson.status === "completed"
                    ? `Tu peux refaire le quiz (${view.quizCount} questions) pour t'entraîner.`
                    : ""
                  : "Cette leçon n'a pas de quiz : marque-la comme terminée."}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {view.quizCount ? (
                  <Button asChild size="lg" className="h-10 px-4 text-[1rem]">
                    <Link href={quizHref}>
                      {view.lesson.status === "completed" ? "Refaire le quiz" : "Commencer le quiz"} <ArrowRight />
                    </Link>
                  </Button>
                ) : (
                  view.lesson.status !== "completed" && (
                    <Button
                      size="lg"
                      className="h-10 px-4 text-[1rem]"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await completeLessonWithoutQuiz(view.lesson.id);
                          if (!r.ok) return void toast.error(r.error);
                          toast.success(`Leçon terminée ! +${r.data.xp} XP`);
                          router.refresh();
                        })
                      }
                    >
                      Marquer comme terminée
                    </Button>
                  )
                )}
                {view.lesson.status !== "completed" && (
                  <Button
                    size="lg"
                    variant="ghost"
                    className="h-10 text-[1rem] text-muted-foreground"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await skipLesson(view.lesson.id);
                        if (!r.ok) return void toast.error(r.error);
                        toast("Leçon passée (sans XP)");
                        if (view.next && !view.next.locked) router.push(view.next.href);
                        else router.refresh();
                      })
                    }
                  >
                    Passer la leçon <SkipForward />
                  </Button>
                )}
                {view.lesson.skipped && (
                  <Button
                    size="lg"
                    variant="ghost"
                    className="h-10 text-[1rem] text-muted-foreground"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await unskipLesson(view.lesson.id);
                        if (!r.ok) return void toast.error(r.error);
                        router.refresh();
                      })
                    }
                  >
                    Annuler le passage
                  </Button>
                )}
              </div>
              </div>
            </section>

            <nav className="grid gap-3 border-t border-primary/25 pt-4 sm:grid-cols-2" aria-label="Leçons précédente et suivante">
              {view.prev ? (
                <Link href={view.prev.href} className="group rounded-sm p-2 hover:bg-muted/60">
                  <span className="flex items-center gap-1 text-[0.85rem] text-muted-foreground smallcaps">
                    <ArrowLeft className="size-3 transition-transform group-hover:-translate-x-0.5" /> Précédente
                  </span>
                  <span className="mt-0.5 line-clamp-2 font-bold text-primary group-hover:underline">{view.prev.title}</span>
                </Link>
              ) : (
                <span />
              )}
              {view.next &&
                (view.next.locked ? (
                  <div className="p-2 text-right opacity-70">
                    <span className="flex items-center justify-end gap-1 text-[0.85rem] text-muted-foreground smallcaps">
                      <Lock className="size-3" /> Chapitre suivant verrouillé
                    </span>
                    <span className="mt-0.5 line-clamp-2 font-bold">{view.next.title}</span>
                  </div>
                ) : (
                  <Link href={view.next.href} className="group rounded-sm p-2 text-right hover:bg-muted/60">
                    <span className="flex items-center justify-end gap-1 text-[0.85rem] text-muted-foreground smallcaps">
                      Suivante <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <span className="mt-0.5 line-clamp-2 font-bold text-primary group-hover:underline">{view.next.title}</span>
                  </Link>
                ))}
            </nav>
            <FooterBand className="pt-6" label={`${view.courseTitle} — chapitre ${view.chapter.number}`} page={`${view.index} / ${view.chapterLessonCount}`} />
          </article>
        </main>

        {/* right: outline + notes */}
        <AnimatePresence initial={false}>
          {showRight && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="sticky top-12 hidden h-[calc(100dvh-3rem)] shrink-0 overflow-hidden border-l border-primary/15 xl:block"
            >
              <div className="h-full w-[280px] space-y-6 overflow-y-auto p-4">
                <div>
                  <p className="mb-2 font-bold text-primary">Dans cette leçon :</p>
                  {outlineList}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* mobile sheets */}
      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" className="w-[88vw] max-w-sm overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{view.courseTitle}</SheetTitle>
          </SheetHeader>
          <div className="px-2 pb-6">
            <CourseNav view={view} chapters={chapters} onNavigate={() => setMobileNav(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={mobileOutline} onOpenChange={setMobileOutline}>
        <SheetContent side="right" className="w-[88vw] max-w-sm overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Plan de la leçon</SheetTitle>
          </SheetHeader>
          <div className="space-y-6 px-4 pb-6">
            {outlineList}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
