"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink, Layers, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EmptyState, Panel, PublishedBadge } from "@/components/admin/parts";
import { DragHandle, PersistedSortable } from "@/components/admin/sortable";
import { ConfirmAction, Field, issueFor, ProgressWarning, useAdminAction } from "@/components/admin/ui";
import { CourseFields, NewChapterDialog, type CourseValues } from "./forms";
import { MediaUpload } from "./media-upload";
import { deleteChapter, reorderChapters, saveCourse, setChapterPublished } from "@/app/actions/admin-content";
import type { Issue } from "@/app/actions/admin-shared";
import type { AdminChapter, AdminCourse } from "@/app/admin/_lib/data";

type Chapter = AdminChapter & { sectionCount: number; lessonCount: number; publishedLessons: number };

export function CourseEditor({ course, semesters, chapters }: { course: AdminCourse; semesters: { id: string; title: string }[]; chapters: Chapter[] }) {
  const [v, setV] = useState<CourseValues>({
    id: course.id,
    semester_id: course.semester_id,
    title: course.title,
    short_title: course.short_title,
    slug: course.slug,
    description: course.description,
    color: course.color,
    status: course.status,
    sequential: course.sequential,
    video_url: course.video_url,
    cover_url: course.cover_url,
  });
  const [issues, setIssues] = useState<Issue[]>();
  const [newChapter, setNewChapter] = useState(false);
  const save = useAdminAction();
  const { run } = useAdminAction();

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <Panel
          title="Chapitres"
          description="Glisse pour réordonner. Un chapitre non publié est invisible pour les étudiants."
          actions={
            <Button size="sm" onClick={() => setNewChapter(true)}>
              <Plus /> Nouveau chapitre
            </Button>
          }
        >
          {chapters.length === 0 ? (
            <EmptyState icon={Layers} title="Aucun chapitre" description="Crée un chapitre ici, ou importe-le depuis un PDF ou un fichier JSON (Imports PDF)." />
          ) : (
            <PersistedSortable items={chapters} getLabel={(c) => `Chapitre ${c.number} — ${c.title}`} save={(ids) => reorderChapters(course.id, ids)} className="divide-y rounded-lg border">
              {(c, _i, h) => (
                <div className="flex flex-wrap items-center gap-2 bg-card p-2 sm:flex-nowrap">
                  <DragHandle handle={h} />
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold">{c.number}</span>
                  <Link href={`/admin/contenu/${course.id}/${c.id}`} className="min-w-0 flex-1 rounded-md px-1 py-1 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
                    <span className="block truncate font-medium">{c.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.sectionCount} section{c.sectionCount > 1 ? "s" : ""} · {c.lessonCount} leçon{c.lessonCount > 1 ? "s" : ""} ({c.publishedLessons} publiée{c.publishedLessons > 1 ? "s" : ""})
                    </span>
                  </Link>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <PublishedBadge published={c.published} />
                    <Switch
                      checked={c.published}
                      aria-label={`${c.published ? "Dépublier" : "Publier"} le chapitre ${c.number}`}
                      onCheckedChange={(p) => run(() => setChapterPublished(c.id, p), { success: p ? "Chapitre publié" : "Chapitre dépublié" })}
                    />
                  </label>
                  <ConfirmAction
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Supprimer le chapitre ${c.number}`}>
                        <Trash2 />
                      </Button>
                    }
                    title={`Supprimer le chapitre ${c.number} ?`}
                    description={<ProgressWarning what={`« ${c.title} », ses sections, ses leçons et ses questions`} />}
                    onConfirm={() => run(() => deleteChapter(c.id), { success: "Chapitre supprimé" })}
                  />
                  <Button asChild variant="ghost" size="icon-sm" aria-label={`Ouvrir le chapitre ${c.number}`}>
                    <Link href={`/admin/contenu/${course.id}/${c.id}`}>
                      <ChevronRight />
                    </Link>
                  </Button>
                </div>
              )}
            </PersistedSortable>
          )}
        </Panel>

        <Panel
          title="Informations du cours"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link href={`/cours/${course.slug}`} target="_blank">
                Voir côté étudiant <ExternalLink />
              </Link>
            </Button>
          }
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.run(() => saveCourse(v), { success: "Cours enregistré", onError: (_, i) => setIssues(i), onOk: () => setIssues(undefined) });
            }}
          >
            <CourseFields v={v} setV={setV} semesters={semesters} issues={issues} autoSlug={false} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="URL de la vidéo" htmlFor="course-video" error={issueFor(issues, "video_url")} hint="Rempli automatiquement après un envoi ; tu peux aussi coller un lien.">
                <Input id="course-video" value={v.video_url ?? ""} onChange={(e) => setV((s) => ({ ...s, video_url: e.target.value }))} />
              </Field>
              <Field label="URL de l'image de couverture" htmlFor="course-cover" error={issueFor(issues, "cover_url")}>
                <Input id="course-cover" value={v.cover_url ?? ""} onChange={(e) => setV((s) => ({ ...s, cover_url: e.target.value }))} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={save.pending}>
                {save.pending ? <Loader2 className="animate-spin" /> : <Save />} Enregistrer
              </Button>
            </div>
          </form>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Médias" description="Stockés dans le bucket public « media ».">
          <div className="space-y-6">
            <MediaUpload key={`v-${course.video_url}`} target={{ kind: "course", id: course.id, field: "video_url" }} value={course.video_url} label="Vidéo de présentation" />
            <MediaUpload key={`c-${course.cover_url}`} target={{ kind: "course", id: course.id, field: "cover_url" }} value={course.cover_url} label="Image de couverture" />
          </div>
        </Panel>
      </div>

      {newChapter && <NewChapterDialog open onOpenChange={setNewChapter} courseId={course.id} nextNumber={Math.max(0, ...chapters.map((c) => c.number)) + 1} />}
    </div>
  );
}
