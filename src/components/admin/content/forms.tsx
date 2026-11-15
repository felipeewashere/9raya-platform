"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field, issueFor, slugify, useAdminAction } from "@/components/admin/ui";
import { saveChapter, saveCourse, saveLessonMeta, saveSection, saveSemester } from "@/app/actions/admin-content";
import type { Issue } from "@/app/actions/admin-shared";

/** A titled dialog wrapping a form; closes itself after a successful save. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  pending,
  submitLabel = "Enregistrer",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  onSubmit: () => void;
  pending: boolean;
  submitLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Title + slug pair: the slug follows the title until edited by hand. */
function TitleSlug({
  prefix,
  title,
  slug,
  onTitle,
  onSlug,
  issues,
  autoSlug,
}: {
  prefix: string;
  title: string;
  slug: string;
  onTitle: (v: string) => void;
  onSlug: (v: string) => void;
  issues?: Issue[];
  autoSlug: boolean;
}) {
  const [touched, setTouched] = useState(!autoSlug);
  return (
    <>
      <Field label="Titre" htmlFor={`${prefix}-title`} error={issueFor(issues, "title")}>
        <Input
          id={`${prefix}-title`}
          value={title}
          required
          onChange={(e) => {
            onTitle(e.target.value);
            if (!touched) onSlug(slugify(e.target.value));
          }}
        />
      </Field>
      <Field label="Slug (URL)" htmlFor={`${prefix}-slug`} error={issueFor(issues, "slug")} hint="Minuscules, chiffres et tirets. Le modifier change l'adresse des pages.">
        <Input
          id={`${prefix}-slug`}
          value={slug}
          required
          className="font-mono"
          onChange={(e) => {
            setTouched(true);
            onSlug(e.target.value);
          }}
        />
      </Field>
    </>
  );
}

// ------------------------------------------------------------------ semester

export type SemesterValues = { id?: string; title: string; slug: string; description: string | null; published: boolean };

export function SemesterDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: SemesterValues }) {
  const [v, setV] = useState<SemesterValues>(initial ?? { title: "", slug: "", description: "", published: false });
  const [issues, setIssues] = useState<Issue[]>();
  const { pending, run } = useAdminAction();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? "Modifier le semestre" : "Nouveau semestre"}
      pending={pending}
      onSubmit={() =>
        run(() => saveSemester(v), {
          success: "Semestre enregistré",
          onOk: () => onOpenChange(false),
          onError: (_, i) => setIssues(i),
        })
      }
    >
      <TitleSlug prefix="sem" title={v.title} slug={v.slug} onTitle={(title) => setV((s) => ({ ...s, title }))} onSlug={(slug) => setV((s) => ({ ...s, slug }))} issues={issues} autoSlug={!initial} />
      <Field label="Description" htmlFor="sem-desc">
        <Textarea id="sem-desc" value={v.description ?? ""} onChange={(e) => setV({ ...v, description: e.target.value })} rows={3} />
      </Field>
      <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
        <span>
          <span className="font-medium">Publié</span>
          <span className="block text-xs text-muted-foreground">Visible dans le catalogue des étudiants.</span>
        </span>
        <Switch checked={v.published} onCheckedChange={(published) => setV({ ...v, published })} />
      </label>
    </FormDialog>
  );
}

// ------------------------------------------------------------------ course

export type CourseValues = {
  id?: string;
  semester_id: string;
  title: string;
  short_title: string | null;
  slug: string;
  description: string | null;
  color: string;
  status: "draft" | "published" | "coming_soon";
  sequential: boolean;
  video_url: string | null;
  cover_url: string | null;
};

export const STATUS_LABEL = { draft: "Brouillon", published: "Publié", coming_soon: "Bientôt disponible" } as const;

export function CourseFields({ v, setV, semesters, issues, autoSlug }: { v: CourseValues; setV: (f: (s: CourseValues) => CourseValues) => void; semesters: { id: string; title: string }[]; issues?: Issue[]; autoSlug: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-4 sm:col-span-2">
        <TitleSlug prefix="course" title={v.title} slug={v.slug} onTitle={(title) => setV((s) => ({ ...s, title }))} onSlug={(slug) => setV((s) => ({ ...s, slug }))} issues={issues} autoSlug={autoSlug} />
      </div>
      <Field label="Titre court" htmlFor="course-short" error={issueFor(issues, "short_title")} hint="Affiché dans les espaces étroits (ex. « Algèbre »).">
        <Input id="course-short" value={v.short_title ?? ""} onChange={(e) => setV((s) => ({ ...s, short_title: e.target.value }))} />
      </Field>
      <Field label="Semestre" error={issueFor(issues, "semester_id")}>
        <Select value={v.semester_id} onValueChange={(semester_id) => setV((s) => ({ ...s, semester_id }))}>
          <SelectTrigger className="w-full" aria-label="Semestre">
            <SelectValue placeholder="Choisir…" />
          </SelectTrigger>
          <SelectContent>
            {semesters.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Statut" error={issueFor(issues, "status")}>
        <Select value={v.status} onValueChange={(status) => setV((s) => ({ ...s, status: status as CourseValues["status"] }))}>
          <SelectTrigger className="w-full" aria-label="Statut">
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
      </Field>
      <Field label="Couleur" htmlFor="course-color" error={issueFor(issues, "color")}>
        <div className="flex gap-2">
          <input type="color" aria-label="Choisir la couleur" value={/^#[0-9a-fA-F]{6}$/.test(v.color) ? v.color : "#2563eb"} onChange={(e) => setV((s) => ({ ...s, color: e.target.value }))} className="h-8 w-10 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5" />
          <Input id="course-color" value={v.color} onChange={(e) => setV((s) => ({ ...s, color: e.target.value }))} className="font-mono" />
        </div>
      </Field>
      <Field label="Description" htmlFor="course-desc" className="sm:col-span-2" error={issueFor(issues, "description")}>
        <Textarea id="course-desc" rows={3} value={v.description ?? ""} onChange={(e) => setV((s) => ({ ...s, description: e.target.value }))} />
      </Field>
      <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm sm:col-span-2">
        <span>
          <span className="font-medium">Progression séquentielle</span>
          <span className="block text-xs text-muted-foreground">Le chapitre suivant s&apos;ouvre quand le précédent est terminé à 50 %.</span>
        </span>
        <Switch checked={v.sequential} onCheckedChange={(sequential) => setV((s) => ({ ...s, sequential }))} />
      </label>
    </div>
  );
}

export function NewCourseDialog({ open, onOpenChange, semesterId, semesters }: { open: boolean; onOpenChange: (o: boolean) => void; semesterId: string; semesters: { id: string; title: string }[] }) {
  const router = useRouter();
  const [v, setV] = useState<CourseValues>({ semester_id: semesterId, title: "", short_title: "", slug: "", description: "", color: "#2563EB", status: "draft", sequential: true, video_url: null, cover_url: null });
  const [issues, setIssues] = useState<Issue[]>();
  const { pending, run } = useAdminAction();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nouveau cours"
      description="Le cours est créé en brouillon : ajoute ses chapitres avant de le publier."
      pending={pending}
      submitLabel="Créer le cours"
      onSubmit={() =>
        run(() => saveCourse(v), {
          success: "Cours créé",
          refresh: false,
          onOk: (d) => router.push(`/admin/contenu/${d.id}`),
          onError: (_, i) => setIssues(i),
        })
      }
    >
      <CourseFields v={v} setV={setV} semesters={semesters} issues={issues} autoSlug />
    </FormDialog>
  );
}

// ------------------------------------------------------------------ chapter

export type ChapterValues = { id?: string; course_id: string; title: string; slug: string; number: number; description: string | null; video_url: string | null; published: boolean };

export function ChapterFields({ v, setV, issues, autoSlug }: { v: ChapterValues; setV: (f: (s: ChapterValues) => ChapterValues) => void; issues?: Issue[]; autoSlug: boolean }) {
  return (
    <div className="space-y-4">
      <TitleSlug prefix="chap" title={v.title} slug={v.slug} onTitle={(title) => setV((s) => ({ ...s, title }))} onSlug={(slug) => setV((s) => ({ ...s, slug }))} issues={issues} autoSlug={autoSlug} />
      <Field label="Numéro" htmlFor="chap-number" error={issueFor(issues, "number")}>
        <Input id="chap-number" type="number" min={1} max={99} value={v.number} onChange={(e) => setV((s) => ({ ...s, number: Number(e.target.value) }))} className="w-28" />
      </Field>
      <Field label="Description" htmlFor="chap-desc" error={issueFor(issues, "description")}>
        <Textarea id="chap-desc" rows={3} value={v.description ?? ""} onChange={(e) => setV((s) => ({ ...s, description: e.target.value }))} />
      </Field>
    </div>
  );
}

export function NewChapterDialog({ open, onOpenChange, courseId, nextNumber }: { open: boolean; onOpenChange: (o: boolean) => void; courseId: string; nextNumber: number }) {
  const router = useRouter();
  const [v, setV] = useState<ChapterValues>({ course_id: courseId, title: "", slug: "", number: nextNumber, description: "", video_url: null, published: false });
  const [issues, setIssues] = useState<Issue[]>();
  const { pending, run } = useAdminAction();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nouveau chapitre"
      description="Créé non publié."
      pending={pending}
      submitLabel="Créer le chapitre"
      onSubmit={() =>
        run(() => saveChapter(v), {
          success: "Chapitre créé",
          refresh: false,
          onOk: (d) => router.push(`/admin/contenu/${courseId}/${d.id}`),
          onError: (_, i) => setIssues(i),
        })
      }
    >
      <ChapterFields v={v} setV={setV} issues={issues} autoSlug />
    </FormDialog>
  );
}

// ------------------------------------------------------------------ section

export type SectionValues = { id?: string; chapter_id: string; title: string; slug: string; number: string | null };

export function SectionDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (o: boolean) => void; initial: SectionValues }) {
  const [v, setV] = useState<SectionValues>(initial);
  const [issues, setIssues] = useState<Issue[]>();
  const { pending, run } = useAdminAction();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={initial.id ? "Modifier la section" : "Nouvelle section"}
      pending={pending}
      onSubmit={() => run(() => saveSection(v), { success: "Section enregistrée", onOk: () => onOpenChange(false), onError: (_, i) => setIssues(i) })}
    >
      <TitleSlug prefix="sec" title={v.title} slug={v.slug} onTitle={(title) => setV((s) => ({ ...s, title }))} onSlug={(slug) => setV((s) => ({ ...s, slug }))} issues={issues} autoSlug={!initial.id} />
      <Field label="Numéro (optionnel)" htmlFor="sec-number" hint="Numérotation du polycopié, ex. « 1.2 ».">
        <Input id="sec-number" value={v.number ?? ""} onChange={(e) => setV({ ...v, number: e.target.value })} className="w-32" />
      </Field>
    </FormDialog>
  );
}

// ------------------------------------------------------------------ lesson metadata

export type LessonMetaValues = { id?: string; section_id: string; title: string; slug: string; number: string | null; summary: string | null; estimated_minutes: number; published: boolean };

export function LessonMetaDialog({
  open,
  onOpenChange,
  initial,
  sections,
  openEditorAfterCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: LessonMetaValues;
  sections: { id: string; title: string }[];
  openEditorAfterCreate?: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<LessonMetaValues>(initial);
  const [issues, setIssues] = useState<Issue[]>();
  const { pending, run } = useAdminAction();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={initial.id ? "Paramètres de la leçon" : "Nouvelle leçon"}
      description={initial.id ? undefined : "Créée non publiée. Tu écriras son contenu dans l'éditeur de leçon."}
      pending={pending}
      submitLabel={initial.id ? "Enregistrer" : "Créer et éditer"}
      onSubmit={() =>
        run(() => saveLessonMeta(v), {
          success: initial.id ? "Leçon enregistrée" : "Leçon créée",
          refresh: !(openEditorAfterCreate && !initial.id),
          onOk: (d) => {
            onOpenChange(false);
            if (openEditorAfterCreate && !initial.id) router.push(`/admin/lecons/${d.id}`);
          },
          onError: (_, i) => setIssues(i),
        })
      }
    >
      <TitleSlug prefix="les" title={v.title} slug={v.slug} onTitle={(title) => setV((s) => ({ ...s, title }))} onSlug={(slug) => setV((s) => ({ ...s, slug }))} issues={issues} autoSlug={!initial.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Numéro (optionnel)" htmlFor="les-number" hint="ex. « 1.3.2 »">
          <Input id="les-number" value={v.number ?? ""} onChange={(e) => setV({ ...v, number: e.target.value })} />
        </Field>
        <Field label="Durée estimée (min)" htmlFor="les-min" error={issueFor(issues, "estimated_minutes")}>
          <Input id="les-min" type="number" min={1} max={120} value={v.estimated_minutes} onChange={(e) => setV({ ...v, estimated_minutes: Number(e.target.value) })} />
        </Field>
      </div>
      {sections.length > 1 && (
        <Field label="Section">
          <Select value={v.section_id} onValueChange={(section_id) => setV({ ...v, section_id })}>
            <SelectTrigger className="w-full" aria-label="Section">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      <Field label="Résumé" htmlFor="les-summary" error={issueFor(issues, "summary")}>
        <Textarea id="les-summary" rows={2} value={v.summary ?? ""} onChange={(e) => setV({ ...v, summary: e.target.value })} />
      </Field>
      <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
        <span className="font-medium">Publiée</span>
        <Switch checked={v.published} onCheckedChange={(published) => setV({ ...v, published })} />
      </label>
    </FormDialog>
  );
}
