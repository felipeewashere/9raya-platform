"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, FilePlus2, ListTree, Loader2, NotebookPen, Pencil, Plus, Save, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { EmptyState, Panel, PublishedBadge } from "@/components/admin/parts";
import { DragHandle, PersistedSortable } from "@/components/admin/sortable";
import { ConfirmAction, ProgressWarning, useAdminAction } from "@/components/admin/ui";
import { ChapterFields, LessonMetaDialog, SectionDialog, type ChapterValues, type LessonMetaValues, type SectionValues } from "./forms";
import { MediaUpload } from "./media-upload";
import { deleteLesson, deleteSection, reorderLessons, reorderSections, saveChapter, setChapterPublished, setLessonPublished } from "@/app/actions/admin-content";
import type { Issue } from "@/app/actions/admin-shared";
import type { AdminChapter, AdminSection } from "@/app/admin/_lib/data";

type Props = { chapter: AdminChapter & { course: { id: string; slug: string; title: string } }; sections: AdminSection[] };

export function ChapterEditor({ chapter, sections }: Props) {
  const [v, setV] = useState<ChapterValues>({
    id: chapter.id,
    course_id: chapter.course_id,
    title: chapter.title,
    slug: chapter.slug,
    number: chapter.number,
    description: chapter.description,
    video_url: chapter.video_url,
    published: chapter.published,
  });
  const [issues, setIssues] = useState<Issue[]>();
  const [sectionDialog, setSectionDialog] = useState<{ key: number; initial: SectionValues } | null>(null);
  const [lessonDialog, setLessonDialog] = useState<{ key: number; initial: LessonMetaValues } | null>(null);
  const save = useAdminAction();
  const { run, pending } = useAdminAction();
  const sectionOptions = sections.map((s) => ({ id: s.id, title: s.number ? `${s.number} ${s.title}` : s.title }));
  const lessonCount = sections.reduce((n, s) => n + s.lessons.length, 0);
  const preview = (slug: string) => `/cours/${chapter.course.slug}/${chapter.slug}/${slug}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <Panel
          title="Sections et leçons"
          description="Glisse pour réordonner les sections et les leçons à l'intérieur d'une section."
          actions={
            <Button size="sm" onClick={() => setSectionDialog({ key: Date.now(), initial: { chapter_id: chapter.id, title: "", slug: "", number: "" } })}>
              <Plus /> Nouvelle section
            </Button>
          }
        >
          {sections.length === 0 ? (
            <EmptyState icon={ListTree} title="Aucune section" description="Une leçon appartient toujours à une section. Crée la première section du chapitre." />
          ) : (
            <PersistedSortable items={sections} getLabel={(s) => `Section ${s.title}`} save={(ids) => reorderSections(chapter.id, ids)} className="space-y-3">
              {(s, _i, h) => (
                <div className="rounded-lg border bg-card">
                  <div className="flex flex-wrap items-center gap-2 border-b p-2">
                    <DragHandle handle={h} />
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {s.number && <span className="mr-1 text-muted-foreground">{s.number}</span>}
                      {s.title}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setLessonDialog({ key: Date.now(), initial: { section_id: s.id, title: "", slug: "", number: "", summary: "", estimated_minutes: 8, published: false } })
                      }
                    >
                      <FilePlus2 /> Leçon
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Modifier la section ${s.title}`} onClick={() => setSectionDialog({ key: Date.now(), initial: { id: s.id, chapter_id: chapter.id, title: s.title, slug: s.slug, number: s.number } })}>
                      <Pencil />
                    </Button>
                    <ConfirmAction
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Supprimer la section ${s.title}`}>
                          <Trash2 />
                        </Button>
                      }
                      title={`Supprimer la section « ${s.title} » ?`}
                      description={<ProgressWarning what={`cette section et ses ${s.lessons.length} leçon(s)`} />}
                      onConfirm={() => run(() => deleteSection(s.id), { success: "Section supprimée" })}
                    />
                  </div>
                  {s.lessons.length === 0 ? (
                    <p className="p-4 text-center text-sm text-muted-foreground">Aucune leçon dans cette section.</p>
                  ) : (
                    <PersistedSortable items={s.lessons} getLabel={(l) => `Leçon ${l.title}`} save={(ids) => reorderLessons(s.id, ids)} className="divide-y">
                      {(l, _j, lh) => (
                        <div className="flex flex-wrap items-center gap-2 bg-card p-2 sm:flex-nowrap">
                          <DragHandle handle={lh} />
                          <Link href={`/admin/lecons/${l.id}`} className="min-w-0 flex-1 rounded-md px-1 py-1 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
                            <span className="block truncate text-sm font-medium">
                              {l.number && <span className="mr-1 text-muted-foreground">{l.number}</span>}
                              {l.title}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {l.estimated_minutes} min · /{l.slug}
                            </span>
                          </Link>
                          <span className="flex items-center gap-2">
                            <PublishedBadge published={l.published} />
                            <Switch
                              checked={l.published}
                              aria-label={`${l.published ? "Dépublier" : "Publier"} la leçon ${l.title}`}
                              onCheckedChange={(p) => run(() => setLessonPublished(l.id, p), { success: p ? "Leçon publiée" : "Leçon dépubliée" })}
                            />
                          </span>
                          <span className="flex items-center">
                            <Button asChild variant="ghost" size="icon-sm" aria-label={`Éditer le contenu de ${l.title}`}>
                              <Link href={`/admin/lecons/${l.id}`}>
                                <NotebookPen />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Paramètres de ${l.title}`}
                              onClick={() =>
                                setLessonDialog({
                                  key: Date.now(),
                                  initial: { id: l.id, section_id: l.section_id, title: l.title, slug: l.slug, number: l.number, summary: l.summary, estimated_minutes: l.estimated_minutes, published: l.published },
                                })
                              }
                            >
                              <Settings2 />
                            </Button>
                            <Button asChild variant="ghost" size="icon-sm" aria-label={`Prévisualiser ${l.title} dans le lecteur étudiant`}>
                              <Link href={preview(l.slug)} target="_blank">
                                <Eye />
                              </Link>
                            </Button>
                            <ConfirmAction
                              trigger={
                                <Button variant="ghost" size="icon-sm" aria-label={`Supprimer ${l.title}`}>
                                  <Trash2 />
                                </Button>
                              }
                              title={`Supprimer la leçon « ${l.title} » ?`}
                              description={<ProgressWarning what="cette leçon, ses blocs et ses questions" />}
                              onConfirm={() => run(() => deleteLesson(l.id), { success: "Leçon supprimée" })}
                            />
                          </span>
                        </div>
                      )}
                    </PersistedSortable>
                  )}
                </div>
              )}
            </PersistedSortable>
          )}
        </Panel>

        <Panel title="Informations du chapitre">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.run(() => saveChapter({ ...v, published: chapter.published, video_url: chapter.video_url }), { success: "Chapitre enregistré", onError: (_, i) => setIssues(i), onOk: () => setIssues(undefined) });
            }}
          >
            <ChapterFields v={v} setV={setV} issues={issues} autoSlug={false} />
            <div className="flex justify-end">
              <Button type="submit" disabled={save.pending}>
                {save.pending ? <Loader2 className="animate-spin" /> : <Save />} Enregistrer
              </Button>
            </div>
          </form>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Publication">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                Chapitre <PublishedBadge published={chapter.published} />
              </span>
              <Switch
                checked={chapter.published}
                disabled={pending}
                aria-label={chapter.published ? "Dépublier le chapitre" : "Publier le chapitre"}
                onCheckedChange={(p) => run(() => setChapterPublished(chapter.id, p), { success: p ? "Chapitre publié" : "Chapitre dépublié" })}
              />
            </div>
            {lessonCount > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => setChapterPublished(chapter.id, true, true), { success: "Chapitre et leçons publiés" })}>
                  Tout publier
                </Button>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setChapterPublished(chapter.id, false, true), { success: "Chapitre et leçons dépubliés" })}>
                  Tout dépublier
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Les étudiants voient une leçon seulement si elle, son chapitre et son cours sont publiés.</p>
          </div>
        </Panel>
        <Panel title="Vidéo du chapitre">
          <MediaUpload key={chapter.video_url ?? "none"} target={{ kind: "chapter", id: chapter.id, field: "video_url" }} value={chapter.video_url} label="Vidéo d'introduction" />
        </Panel>
        {chapter.review_notes?.length > 0 && (
          <Panel title="Notes de relecture" description="Issues de l'import.">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {chapter.review_notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      {sectionDialog && <SectionDialog key={sectionDialog.key} open onOpenChange={(o) => !o && setSectionDialog(null)} initial={sectionDialog.initial} />}
      {lessonDialog && <LessonMetaDialog key={lessonDialog.key} open onOpenChange={(o) => !o && setLessonDialog(null)} initial={lessonDialog.initial} sections={sectionOptions} openEditorAfterCreate />}
    </div>
  );
}
