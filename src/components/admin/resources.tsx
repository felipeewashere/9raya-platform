"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FolderOpen, Loader2, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, formatBytes, formatDate, Panel } from "@/components/admin/parts";
import { ConfirmAction, Field, useAdminAction } from "@/components/admin/ui";
import { FormDialog } from "@/components/admin/content/forms";
import { createClient } from "@/lib/supabase/client";
import { createResourceUpload, deleteResource, registerResource, resourceDownloadUrl, updateResource } from "@/app/actions/admin-resources";
import type { CourseTree, ResourceRow } from "@/app/admin/_lib/data";

const ALL = "all";
const NONE = "none";

function LinkPickers({ course, chapterId, lessonId, onChange }: { course: CourseTree | undefined; chapterId: string; lessonId: string; onChange: (chapterId: string, lessonId: string) => void }) {
  const chapter = course?.chapters.find((c) => c.id === chapterId);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Chapitre (optionnel)">
        <Select value={chapterId} onValueChange={(v) => onChange(v, NONE)}>
          <SelectTrigger className="w-full" aria-label="Chapitre">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Tout le cours</SelectItem>
            {course?.chapters.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.number}. {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Leçon (optionnel)">
        <Select value={lessonId} onValueChange={(v) => onChange(chapterId, v)} disabled={!chapter}>
          <SelectTrigger className="w-full" aria-label="Leçon">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Tout le chapitre</SelectItem>
            {chapter?.lessons.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.number ? `${l.number} ` : ""}
                {l.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function EditDialog({ resource, course, onClose }: { resource: ResourceRow; course: CourseTree | undefined; onClose: () => void }) {
  const [title, setTitle] = useState(resource.title);
  const [chapterId, setChapterId] = useState(resource.chapter_id ?? NONE);
  const [lessonId, setLessonId] = useState(resource.lesson_id ?? NONE);
  const { pending, run } = useAdminAction();
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Modifier la ressource"
      pending={pending}
      onSubmit={() =>
        run(() => updateResource({ id: resource.id, title, chapterId: chapterId === NONE ? null : chapterId, lessonId: lessonId === NONE ? null : lessonId }), { success: "Ressource mise à jour", onOk: onClose })
      }
    >
      <Field label="Titre" htmlFor="res-title">
        <Input id="res-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>
      <LinkPickers
        course={course}
        chapterId={chapterId}
        lessonId={lessonId}
        onChange={(c, l) => {
          setChapterId(c);
          setLessonId(l);
        }}
      />
    </FormDialog>
  );
}

export function ResourcesManager({ resources, courses }: { resources: ResourceRow[]; courses: CourseTree[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState(ALL);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [chapterId, setChapterId] = useState(NONE);
  const [lessonId, setLessonId] = useState(NONE);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ResourceRow | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const { run } = useAdminAction();
  const course = courses.find((c) => c.id === courseId);
  const byId = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const shown = filter === ALL ? resources : resources.filter((r) => r.course_id === filter);

  const where = (r: ResourceRow) => {
    const c = byId.get(r.course_id);
    const ch = c?.chapters.find((x) => x.id === r.chapter_id);
    const l = ch?.lessons.find((x) => x.id === r.lesson_id);
    return [c?.title, ch && `chap. ${ch.number}`, l?.title].filter(Boolean).join(" · ");
  };

  async function upload() {
    if (!file || !courseId) return;
    setBusy(true);
    try {
      const signed = await createResourceUpload(courseId, { name: file.name, type: file.type, size: file.size });
      if (!signed.ok) throw new Error(signed.error);
      const up = await createClient().storage.from("resources").uploadToSignedUrl(signed.data.path, signed.data.token, file, { contentType: file.type || "application/octet-stream" });
      if (up.error) throw new Error(up.error.message);
      const reg = await registerResource({
        courseId,
        chapterId: chapterId === NONE ? null : chapterId,
        lessonId: lessonId === NONE ? null : lessonId,
        title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
        path: signed.data.path,
        mime: file.type || null,
        size: file.size,
      });
      if (!reg.ok) throw new Error(reg.error);
      toast.success("Ressource ajoutée");
      setFile(null);
      setTitle("");
      if (input.current) input.current.value = "";
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (!courses.length) return <EmptyState icon={FolderOpen} title="Aucun cours" description="Crée d'abord un cours dans Contenu." />;

  return (
    <div className="space-y-6">
      <Panel title="Ajouter un fichier" description="PDF de cours, fiches de TD, corrigés… (50 Mo max). Les étudiants connectés y accèdent depuis la page du cours.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            upload();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cours">
              <Select
                value={courseId}
                onValueChange={(v) => {
                  setCourseId(v);
                  setChapterId(NONE);
                  setLessonId(NONE);
                }}
              >
                <SelectTrigger className="w-full" aria-label="Cours">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Titre" htmlFor="new-res-title" hint="Par défaut : le nom du fichier.">
              <Input id="new-res-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
          </div>
          <LinkPickers
            course={course}
            chapterId={chapterId}
            lessonId={lessonId}
            onChange={(c, l) => {
              setChapterId(c);
              setLessonId(l);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="new-res-file" className="sr-only">
              Fichier
            </Label>
            <input id="new-res-file" ref={input} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="max-w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm" />
            <Button type="submit" disabled={!file || busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Upload />} Envoyer
            </Button>
          </div>
        </form>
      </Panel>

      <Panel
        title="Fichiers"
        actions={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger size="sm" className="w-48" aria-label="Filtrer par cours">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les cours</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        {shown.length === 0 ? (
          <EmptyState icon={FolderOpen} title="Aucune ressource" />
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead className="hidden md:table-cell">Rattachement</TableHead>
                  <TableHead className="hidden sm:table-cell">Taille</TableHead>
                  <TableHead className="hidden lg:table-cell">Ajouté</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-[14rem]">
                      <span className="block truncate font-medium">{r.title}</span>
                      <span className="block truncate text-xs text-muted-foreground md:hidden">{where(r)}</span>
                    </TableCell>
                    <TableCell className="hidden max-w-[18rem] truncate text-muted-foreground md:table-cell">{where(r)}</TableCell>
                    <TableCell className="hidden tabular-nums text-muted-foreground sm:table-cell">{formatBytes(r.size_bytes)}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{formatDate(r.created_at)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Ouvrir ${r.title}`}
                        onClick={async () => {
                          const res = await resourceDownloadUrl(r.id);
                          if (res.ok) window.open(res.data.url, "_blank", "noopener");
                          else toast.error(res.error);
                        }}
                      >
                        <Download />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${r.title}`} onClick={() => setEditing(r)}>
                        <Pencil />
                      </Button>
                      <ConfirmAction
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Supprimer ${r.title}`}>
                            <Trash2 />
                          </Button>
                        }
                        title={`Supprimer « ${r.title} » ?`}
                        description={<p>Le fichier est supprimé du stockage et n&apos;est plus accessible aux étudiants.</p>}
                        onConfirm={() => run(() => deleteResource(r.id), { success: "Ressource supprimée" })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
      {editing && <EditDialog key={editing.id} resource={editing} course={byId.get(editing.course_id)} onClose={() => setEditing(null)} />}
    </div>
  );
}
