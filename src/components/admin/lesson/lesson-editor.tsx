"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, CircleAlert, Copy, ExternalLink, Loader2, MoreHorizontal, Plus, Save, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DragHandle, SortableList, arrayMove } from "@/components/admin/sortable";
import { useAdminAction } from "@/components/admin/ui";
import { lessonSchema, type Block, type Lesson, type Question } from "@/content/schema";
import { cn } from "@/lib/utils";
import { saveLesson } from "@/app/actions/admin-lesson";
import { setLessonPublished } from "@/app/actions/admin-content";
import { BLOCK_LABEL, BlockEditor, blockSummary, defaultBlock } from "./block-editor";
import { defaultQuestion, KIND_LABEL, QuestionEditor } from "./question-editor";
import { issueAt, IssueList, subIssues, zodIssues, type Issue } from "./issues";
import { LessonPreview } from "./preview";

type Item<T> = { key: string; value: T };
let seq = 0;
const nextKey = () => `k${++seq}`;
const wrap = <T,>(list: T[]): Item<T>[] => list.map((value) => ({ key: nextKey(), value }));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

type Meta = Pick<Lesson, "slug" | "title" | "number" | "estimatedMinutes" | "summary">;

export type LessonEditorProps = {
  lessonId: string;
  initial: Lesson;
  warnings: string[];
  published: boolean;
  chapter: { slug: string; number: number };
  previewHref: string;
};

function AddBlockMenu({ onAdd, label = "Ajouter un bloc", variant = "outline" }: { onAdd: (t: Block["type"]) => void; label?: string; variant?: "outline" | "ghost" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant={variant} size="sm">
          <Plus /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Type de bloc</DropdownMenuLabel>
        {(Object.keys(BLOCK_LABEL) as Block["type"][]).map((t) => (
          <DropdownMenuItem key={t} onSelect={() => onAdd(t)}>
            {BLOCK_LABEL[t]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ItemCard({
  title,
  badge,
  summary,
  open,
  onToggle,
  handle,
  errors,
  menu,
  children,
  added,
}: {
  title: string;
  badge?: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  handle: Parameters<typeof DragHandle>[0]["handle"];
  errors: number;
  menu: React.ReactNode;
  children: React.ReactNode;
  added?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border bg-card", errors > 0 && "border-danger/50")}>
      <div className="flex items-center gap-1.5 p-2">
        <DragHandle handle={handle} />
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
          <span className="shrink-0 text-sm font-semibold">{title}</span>
          {badge && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{badge}</span>}
          {added && <span className="hidden shrink-0 rounded-full bg-reward-soft px-2 py-0.5 text-[11px] font-medium text-reward-foreground sm:inline">complément</span>}
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{summary}</span>
          {errors > 0 && (
            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-danger">
              <CircleAlert className="size-3.5" /> {errors}
            </span>
          )}
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        {menu}
      </div>
      {open && <div className="border-t p-3 sm:p-4">{children}</div>}
    </div>
  );
}

function JsonTab({ lesson, onApply }: { lesson: Lesson; onApply: (l: Lesson) => void }) {
  const [text, setText] = useState(() => JSON.stringify(lesson, null, 2));
  const [problems, setProblems] = useState<Issue[]>([]);
  const apply = () => {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      setProblems([{ path: [], message: `JSON invalide : ${(e as Error).message}` }]);
      return;
    }
    const r = lessonSchema.safeParse(raw);
    if (!r.success) {
      setProblems(zodIssues(r.error));
      return;
    }
    setProblems([]);
    onApply(r.data);
    toast.success("JSON appliqué à l'éditeur (pense à enregistrer)");
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">La leçon au format d&apos;écriture (lessonSchema, comme dans content/&lt;cours&gt;/chNN.json). Colle une leçon puis applique-la : elle remplace le contenu de l&apos;éditeur.</p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} rows={28} className="font-mono text-[12px] leading-relaxed" aria-label="Leçon au format JSON" />
      <IssueList issues={problems} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={apply}>
          Appliquer
        </Button>
        <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Copié"), () => toast.error("Copie impossible"))}>
          <Copy /> Copier
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = `${lesson.slug || "lecon"}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Télécharger
        </Button>
        <Button type="button" variant="ghost" onClick={() => setText(JSON.stringify(lesson, null, 2))}>
          Recharger depuis l&apos;éditeur
        </Button>
      </div>
    </div>
  );
}

export function LessonEditor({ lessonId, initial, warnings, published, chapter, previewHref }: LessonEditorProps) {
  const router = useRouter();
  const [meta, setMeta] = useState<Meta>(() => ({ slug: initial.slug, title: initial.title, number: initial.number, estimatedMinutes: initial.estimatedMinutes, summary: initial.summary }));
  const [blocks, setBlocks] = useState<Item<Block>[]>(() => wrap(initial.blocks));
  const [quiz, setQuiz] = useState<Item<Question>[]>(() => wrap(initial.quiz));
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [saved, setSaved] = useState(() => JSON.stringify(lessonSchema.safeParse(initial).data ?? initial));
  const [showErrors, setShowErrors] = useState(false);
  const [serverIssues, setServerIssues] = useState<Issue[]>([]);
  const [tab, setTab] = useState("contenu");
  const [jsonKey, setJsonKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const publish = useAdminAction();

  const lesson: Lesson = useMemo(() => {
    const m: Meta = { ...meta };
    if (!m.number) delete m.number;
    return { ...m, blocks: blocks.map((b) => b.value), quiz: quiz.map((q) => q.value) } as Lesson;
  }, [meta, blocks, quiz]);
  const parsed = useMemo(() => lessonSchema.safeParse(lesson), [lesson]);
  const liveIssues = useMemo(() => (parsed.success ? [] : zodIssues(parsed.error)), [parsed]);
  const issues = showErrors ? liveIssues : serverIssues;
  const dirty = useMemo(() => JSON.stringify(parsed.success ? parsed.data : lesson) !== saved, [parsed, lesson, saved]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = useCallback(async () => {
    if (saving) return;
    setShowErrors(true);
    if (!parsed.success) {
      const n = liveIssues.length;
      toast.error(`${n} problème${n > 1 ? "s" : ""} à corriger avant d'enregistrer.`);
      const first = liveIssues[0];
      if (first?.path[0] === "quiz") setTab("quiz");
      else setTab("contenu");
      const idx = typeof first?.path[1] === "number" ? first.path[1] : null;
      if (idx !== null && first) {
        const key = first.path[0] === "quiz" ? quiz[idx]?.key : first.path[0] === "blocks" ? blocks[idx]?.key : undefined;
        if (key) setOpen((s) => new Set(s).add(key));
      }
      return;
    }
    setSaving(true);
    try {
      const r = await saveLesson(lessonId, parsed.data);
      if (!r.ok) {
        setServerIssues(r.issues ?? []);
        toast.error(r.error);
        return;
      }
      setServerIssues([]);
      setSaved(JSON.stringify(parsed.data));
      toast.success(`Leçon enregistrée (${r.data.blocks} blocs, ${r.data.questions} questions)`);
      router.refresh();
    } catch {
      toast.error("Erreur réseau : la leçon n'a pas été enregistrée.");
    } finally {
      setSaving(false);
    }
  }, [saving, parsed, liveIssues, lessonId, router, quiz, blocks]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const toggle = (key: string) => setOpen((s) => (s.has(key) ? new Set([...s].filter((k) => k !== key)) : new Set(s).add(key)));
  const insertBlock = (type: Block["type"], at: number) => {
    const item = { key: nextKey(), value: defaultBlock(type) };
    setBlocks((bs) => [...bs.slice(0, at), item, ...bs.slice(at)]);
    setOpen((s) => new Set(s).add(item.key));
  };
  const removeBlock = (i: number) => {
    const before = blocks;
    setBlocks(blocks.filter((_, k) => k !== i));
    toast("Bloc supprimé", { action: { label: "Annuler", onClick: () => setBlocks(before) } });
  };
  const removeQuestion = (i: number) => {
    const before = quiz;
    setQuiz(quiz.filter((_, k) => k !== i));
    toast("Question supprimée", { action: { label: "Annuler", onClick: () => setQuiz(before) } });
  };

  const metaIssues = issues.filter((i) => i.path.length >= 1 && !["blocks", "quiz"].includes(String(i.path[0])));
  const listIssue = (name: "blocks" | "quiz") => issues.filter((i) => i.path[0] === name && i.path.length === 1);
  const blockErrors = issues.filter((i) => i.path[0] === "blocks").length;
  const quizErrors = issues.filter((i) => i.path[0] === "quiz").length;

  return (
    <div className="space-y-4">
      {/* sticky save bar */}
      <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <span className={cn("flex items-center gap-1.5 text-sm", dirty ? "text-reward-foreground" : "text-muted-foreground")} aria-live="polite">
          <span className={cn("size-2 rounded-full", dirty ? "bg-reward" : "bg-success")} />
          {dirty ? "Modifications non enregistrées" : "Tout est enregistré"}
        </span>
        {showErrors && liveIssues.length > 0 && (
          <span className="flex items-center gap-1 text-sm font-medium text-danger">
            <CircleAlert className="size-4" /> {liveIssues.length} problème{liveIssues.length > 1 ? "s" : ""}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={published} disabled={publish.pending} onCheckedChange={(p) => publish.run(() => setLessonPublished(lessonId, p), { success: p ? "Leçon publiée" : "Leçon dépubliée" })} aria-label="Leçon publiée" />
            <span className="hidden sm:inline">{published ? "Publiée" : "Brouillon"}</span>
          </label>
          <Button asChild variant="outline" size="sm">
            <Link href={previewHref} target="_blank">
              Lecteur <ExternalLink />
            </Link>
          </Button>
          <Button size="sm" onClick={save} disabled={saving} title="Ctrl+S">
            {saving ? <Loader2 className="animate-spin" /> : <Save />} Enregistrer
          </Button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div role="status" className="flex gap-2 rounded-lg border border-reward/50 bg-reward-soft px-3 py-2 text-sm text-reward-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <ul className="space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <Tabs
        value={tab}
        onValueChange={(t) => {
          if (t === "json") setJsonKey((k) => k + 1);
          setTab(t);
        }}
      >
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="contenu">
            Contenu {blockErrors > 0 && <span className="ml-1 text-danger">({blockErrors})</span>}
          </TabsTrigger>
          <TabsTrigger value="quiz">
            Quiz ({quiz.length}) {quizErrors > 0 && <span className="ml-1 text-danger">({quizErrors})</span>}
          </TabsTrigger>
          <TabsTrigger value="apercu">Prévisualiser</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="contenu" className="mt-4 space-y-4">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 font-semibold">Paramètres</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="lesson-title">Titre</Label>
                <Input id="lesson-title" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} aria-invalid={issueAt(issues, ["title"]) ? true : undefined} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lesson-slug">Slug</Label>
                <Input id="lesson-slug" className="font-mono" value={meta.slug} onChange={(e) => setMeta({ ...meta, slug: e.target.value })} aria-invalid={issueAt(issues, ["slug"]) ? true : undefined} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lesson-number">Numéro</Label>
                  <Input id="lesson-number" value={meta.number ?? ""} placeholder="1.3.2" onChange={(e) => setMeta({ ...meta, number: e.target.value || undefined })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lesson-min">Durée (min)</Label>
                  <Input id="lesson-min" type="number" min={2} max={40} value={meta.estimatedMinutes} onChange={(e) => setMeta({ ...meta, estimatedMinutes: Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="lesson-summary">Résumé</Label>
                <Textarea id="lesson-summary" rows={2} value={meta.summary} onChange={(e) => setMeta({ ...meta, summary: e.target.value })} aria-invalid={issueAt(issues, ["summary"]) ? true : undefined} />
              </div>
            </div>
            <IssueList issues={metaIssues} className="mt-3 space-y-1 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger" />
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              Blocs <span className="font-normal text-muted-foreground">({blocks.length})</span>
            </h2>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(new Set(blocks.map((b) => b.key)))}>
                <ChevronsUpDown /> Tout déplier
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(new Set())}>
                <ChevronsDownUp /> Tout replier
              </Button>
            </div>
          </div>
          <IssueList issues={listIssue("blocks")} />

          {blocks.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">Cette leçon n&apos;a encore aucun bloc. Une leçon contient au moins 1 bloc et un quiz de 3 à 8 questions.</p>
              <div className="mt-3">
                <AddBlockMenu onAdd={(t) => insertBlock(t, 0)} />
              </div>
            </div>
          ) : (
            <SortableList
              items={blocks}
              getId={(b) => b.key}
              getLabel={(b, i) => `bloc ${i + 1}, ${BLOCK_LABEL[b.value.type]}`}
              onMove={(from, to) => setBlocks((bs) => arrayMove(bs, from, to))}
              className="space-y-2"
            >
              {(item, i, handle) => {
                const b = item.value;
                const own = subIssues(issues, ["blocks", i]);
                return (
                  <ItemCard
                    title={`${i + 1}. ${BLOCK_LABEL[b.type]}`}
                    badge={b.type === "theorem" ? b.kind : b.type === "interactive" ? b.spec.widget : b.type === "checkpoint" ? KIND_LABEL[b.question.kind] : undefined}
                    summary={blockSummary(b)}
                    added={b.origin === "added"}
                    open={open.has(item.key)}
                    onToggle={() => toggle(item.key)}
                    handle={handle}
                    errors={own.length}
                    menu={
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Actions du bloc ${i + 1}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem
                            onSelect={() => {
                              const copy = { key: nextKey(), value: clone(b) };
                              setBlocks((bs) => [...bs.slice(0, i + 1), copy, ...bs.slice(i + 1)]);
                              setOpen((s) => new Set(s).add(copy.key));
                            }}
                          >
                            <Copy /> Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={i === 0} onSelect={() => setBlocks((bs) => arrayMove(bs, i, i - 1))}>
                            Monter
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={i === blocks.length - 1} onSelect={() => setBlocks((bs) => arrayMove(bs, i, i + 1))}>
                            Descendre
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs">Insérer après</DropdownMenuLabel>
                          {(["text", "definition", "theorem", "example", "checkpoint"] as Block["type"][]).map((t) => (
                            <DropdownMenuItem key={t} onSelect={() => insertBlock(t, i + 1)}>
                              <Plus /> {BLOCK_LABEL[t]}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => removeBlock(i)}>
                            <Trash2 /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    }
                  >
                    <BlockEditor name={item.key} block={b} issues={own} onChange={(value) => setBlocks((bs) => bs.map((x) => (x.key === item.key ? { ...x, value } : x)))} />
                  </ItemCard>
                );
              }}
            </SortableList>
          )}
          {blocks.length > 0 && <AddBlockMenu onAdd={(t) => insertBlock(t, blocks.length)} />}
        </TabsContent>

        <TabsContent value="quiz" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Quiz de fin de leçon : 3 à 8 questions, 70 % pour valider. Les questions sont identifiées par leur position (quiz-1, quiz-2…) : réordonner rattache l&apos;historique des réponses à la nouvelle position.
          </p>
          <IssueList issues={listIssue("quiz")} />
          {quiz.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Aucune question pour l&apos;instant.</p>
          ) : (
            <SortableList items={quiz} getId={(q) => q.key} getLabel={(q, i) => `question ${i + 1}, ${KIND_LABEL[q.value.kind]}`} onMove={(from, to) => setQuiz((qs) => arrayMove(qs, from, to))} className="space-y-2">
              {(item, i, handle) => {
                const own = subIssues(issues, ["quiz", i]);
                return (
                  <ItemCard
                    title={`Question ${i + 1}`}
                    badge={KIND_LABEL[item.value.kind]}
                    summary={item.value.prompt.replace(/\s+/g, " ").slice(0, 90)}
                    open={open.has(item.key)}
                    onToggle={() => toggle(item.key)}
                    handle={handle}
                    errors={own.length}
                    menu={
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Actions de la question ${i + 1}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={quiz.length >= 8}
                            onSelect={() => {
                              const copy = { key: nextKey(), value: clone(item.value) };
                              setQuiz((qs) => [...qs.slice(0, i + 1), copy, ...qs.slice(i + 1)]);
                            }}
                          >
                            <Copy /> Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={i === 0} onSelect={() => setQuiz((qs) => arrayMove(qs, i, i - 1))}>
                            Monter
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={i === quiz.length - 1} onSelect={() => setQuiz((qs) => arrayMove(qs, i, i + 1))}>
                            Descendre
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => removeQuestion(i)}>
                            <Trash2 /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    }
                  >
                    <QuestionEditor name={item.key} value={item.value} issues={own} onChange={(value) => setQuiz((qs) => qs.map((x) => (x.key === item.key ? { ...x, value } : x)))} />
                  </ItemCard>
                );
              }}
            </SortableList>
          )}
          {quiz.length < 8 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Plus /> Ajouter une question
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {(Object.keys(KIND_LABEL) as Question["kind"][]).map((k) => (
                  <DropdownMenuItem
                    key={k}
                    onSelect={() => {
                      const item = { key: nextKey(), value: defaultQuestion(k) };
                      setQuiz((qs) => [...qs, item]);
                      setOpen((s) => new Set(s).add(item.key));
                    }}
                  >
                    {KIND_LABEL[k]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </TabsContent>

        <TabsContent value="apercu" className="mt-4">
          <div className="rounded-xl border bg-background px-4 py-8 sm:px-8">{tab === "apercu" && <LessonPreview lesson={lesson} chapterSlug={chapter.slug} chapterNumber={chapter.number} />}</div>
        </TabsContent>

        <TabsContent value="json" className="mt-4">
          {tab === "json" && (
            <JsonTab
              key={jsonKey}
              lesson={lesson}
              onApply={(l) => {
                setMeta({ slug: l.slug, title: l.title, number: l.number, estimatedMinutes: l.estimatedMinutes, summary: l.summary });
                setBlocks(wrap(l.blocks));
                setQuiz(wrap(l.quiz));
                setOpen(new Set());
              }}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
