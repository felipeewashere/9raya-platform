"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpenText, CalendarRange, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PublishedBadge } from "@/components/admin/parts";
import { DragHandle, PersistedSortable } from "@/components/admin/sortable";
import { ConfirmAction, ProgressWarning, useAdminAction } from "@/components/admin/ui";
import { NewCourseDialog, SemesterDialog, STATUS_LABEL, type SemesterValues } from "./forms";
import { deleteCourse, deleteSemester, reorderCourses, reorderSemesters, setCourseStatus } from "@/app/actions/admin-content";
import type { AdminCourse, AdminSemester } from "@/app/admin/_lib/data";

type Course = AdminCourse & { chapters: { total: number; published: number } };

export function CatalogManager({ semesters, courses }: { semesters: AdminSemester[]; courses: Course[] }) {
  const [semesterDialog, setSemesterDialog] = useState<{ key: number; initial?: SemesterValues } | null>(null);
  const [courseDialog, setCourseDialog] = useState<string | null>(null);
  const { run } = useAdminAction();
  const semOptions = semesters.map((s) => ({ id: s.id, title: s.title }));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setSemesterDialog({ key: Date.now() })}>
          <Plus /> Nouveau semestre
        </Button>
      </div>

      {semesters.length === 0 ? (
        <EmptyState icon={CalendarRange} title="Aucun semestre" description="Crée un semestre, puis ajoute-lui des cours." />
      ) : (
        <PersistedSortable items={semesters} getLabel={(s) => s.title} save={(ids) => reorderSemesters(ids)} className="space-y-4">
          {(s, _i, handle) => {
            const list = courses.filter((c) => c.semester_id === s.id);
            return (
              <section className="rounded-xl border bg-card">
                <header className="flex flex-wrap items-center gap-2 border-b p-3 sm:p-4">
                  <DragHandle handle={handle} />
                  <div className="min-w-0 flex-1">
                    <h2 className="flex flex-wrap items-center gap-2 font-semibold">
                      {s.title} <PublishedBadge published={s.published} />
                    </h2>
                    {s.description && <p className="truncate text-sm text-muted-foreground">{s.description}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSemesterDialog({ key: Date.now(), initial: { id: s.id, title: s.title, slug: s.slug, description: s.description, published: s.published } })}>
                    <Pencil /> Modifier
                  </Button>
                  <ConfirmAction
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Supprimer ${s.title}`}>
                        <Trash2 />
                      </Button>
                    }
                    title={`Supprimer « ${s.title} » ?`}
                    description={<p>Un semestre ne peut être supprimé que s&apos;il ne contient plus aucun cours.</p>}
                    onConfirm={() => run(() => deleteSemester(s.id), { success: "Semestre supprimé" })}
                  />
                </header>
                <div className="p-3 sm:p-4">
                  {list.length === 0 ? (
                    <EmptyState icon={BookOpenText} title="Aucun cours dans ce semestre" className="py-6" />
                  ) : (
                    <PersistedSortable items={list} getLabel={(c) => c.title} save={(ids) => reorderCourses(s.id, ids)} className="divide-y rounded-lg border">
                      {(c, _j, h) => (
                        <div className="flex flex-wrap items-center gap-2 bg-card p-2 sm:flex-nowrap">
                          <DragHandle handle={h} />
                          <span className="size-3 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
                          <Link href={`/admin/contenu/${c.id}`} className="min-w-0 flex-1 rounded-md px-1 py-1 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
                            <span className="block truncate font-medium">{c.title}</span>
                            <span className="block text-xs text-muted-foreground">
                              {c.chapters.total} chapitre{c.chapters.total > 1 ? "s" : ""} · {c.chapters.published} publié{c.chapters.published > 1 ? "s" : ""} · /{c.slug}
                            </span>
                          </Link>
                          <Select value={c.status} onValueChange={(status) => run(() => setCourseStatus(c.id, status as Course["status"]), { success: "Statut mis à jour" })}>
                            <SelectTrigger size="sm" className="w-40" aria-label={`Statut de ${c.title}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((k) => (
                                <SelectItem key={k} value={k}>
                                  {STATUS_LABEL[k]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <ConfirmAction
                            trigger={
                              <Button variant="ghost" size="icon-sm" aria-label={`Supprimer ${c.title}`}>
                                <Trash2 />
                              </Button>
                            }
                            title={`Supprimer le cours « ${c.title} » ?`}
                            description={<ProgressWarning what="ce cours, ses chapitres, ses leçons, ses questions et ses ressources" />}
                            onConfirm={() => run(() => deleteCourse(c.id), { success: "Cours supprimé" })}
                          />
                          <Button asChild variant="ghost" size="icon-sm" aria-label={`Ouvrir ${c.title}`}>
                            <Link href={`/admin/contenu/${c.id}`}>
                              <ChevronRight />
                            </Link>
                          </Button>
                        </div>
                      )}
                    </PersistedSortable>
                  )}
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setCourseDialog(s.id)}>
                    <Plus /> Nouveau cours
                  </Button>
                </div>
              </section>
            );
          }}
        </PersistedSortable>
      )}

      {semesterDialog && <SemesterDialog key={semesterDialog.key} open onOpenChange={(o) => !o && setSemesterDialog(null)} initial={semesterDialog.initial} />}
      {courseDialog && <NewCourseDialog key={courseDialog} open onOpenChange={(o) => !o && setCourseDialog(null)} semesterId={courseDialog} semesters={semOptions} />}
    </div>
  );
}
