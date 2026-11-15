"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, ExternalLink, FileText, Loader2, RefreshCw, Rocket, Save, Trash2, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Panel, StatusBadge } from "@/components/admin/parts";
import { ConfirmAction, useAdminAction } from "@/components/admin/ui";
import { IssueList, zodIssues, type Issue } from "@/components/admin/lesson/issues";
import { LessonPreview } from "@/components/admin/lesson/preview";
import { chapterSchema } from "@/content/schema";
import { cn } from "@/lib/utils";
import { deleteImport, extractImport, importDraft, publishImport, saveImportDraft } from "@/app/actions/admin-imports";

const NONE = "none";

const TEMPLATE = {
  slug: "nouveau-chapitre",
  number: 1,
  title: "Titre du chapitre",
  description: "Une phrase qui présente le chapitre.",
  sourcePdf: "",
  sections: [
    {
      slug: "section-1",
      title: "Première section",
      number: "1.1",
      lessons: [
        {
          slug: "premiere-lecon",
          title: "Première leçon",
          number: "1.1.1",
          estimatedMinutes: 8,
          summary: "Ce que l'étudiant retiendra.",
          blocks: [
            { type: "heading", text: "Introduction" },
            { type: "definition", title: "Nom", md: "Soit $E$ un ensemble…" },
          ],
          quiz: [
            { kind: "true_false", prompt: "Énoncé vrai ou faux.", answer: true, explanation: "Pourquoi." },
            { kind: "mcq", prompt: "Question ?", options: [{ id: "a", md: "Oui" }, { id: "b", md: "Non" }], answer: "a", explanation: "Pourquoi." },
            { kind: "fill_blank", prompt: "$2+2=$ ___", answerType: "number", accepted: ["4"], explanation: "Calcul." },
          ],
        },
      ],
    },
  ],
  reviewNotes: [],
};

type Row = { id: string; course_id: string | null; storage_path: string; file_name: string; draft: unknown; status: string; error: string | null };

export function ImportReview({ row, pages, courses, pdfUrl }: { row: Row; pages: string[]; courses: { id: string; title: string; slug: string }[]; pdfUrl: string | null }) {
  const router = useRouter();
  const [courseId, setCourseId] = useState(row.course_id ?? NONE);
  const [text, setText] = useState(() => (row.draft == null ? "" : JSON.stringify(row.draft, null, 2)));
  const [savedText, setSavedText] = useState(text);
  const [page, setPage] = useState(0);
  const [lessonIdx, setLessonIdx] = useState(0);
  const [previewHref, setPreviewHref] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<Issue[] | null>(null);
  const { pending, run } = useAdminAction();
  const deferred = useDeferredValue(text);
  const isPdf = row.storage_path.startsWith("pdf/");
  const published = row.status === "published";
  const course = courses.find((c) => c.id === courseId) ?? null;

  const check = useMemo(() => {
    if (!deferred.trim()) return { json: null as unknown, error: null as string | null, issues: [] as Issue[], chapter: null };
    try {
      const json = JSON.parse(deferred);
      const r = chapterSchema.safeParse(json);
      return { json, error: null, issues: r.success ? [] : zodIssues(r.error), chapter: r.success ? r.data : null };
    } catch (e) {
      return { json: null, error: (e as Error).message, issues: [], chapter: null };
    }
  }, [deferred]);
  const lessons = useMemo(() => check.chapter?.sections.flatMap((s) => s.lessons) ?? [], [check.chapter]);
  const current = lessons[Math.min(lessonIdx, Math.max(0, lessons.length - 1))];
  const dirty = text !== savedText || (courseId === NONE ? null : courseId) !== row.course_id;

  const persist = () =>
    run(() => saveImportDraft(row.id, { courseId: courseId === NONE ? null : courseId, draftText: text }), {
      onOk: (d) => {
        setSavedText(text);
        setServerIssues(d.issues);
        toast.success(d.valid ? "Brouillon enregistré — chapitre valide" : `Brouillon enregistré — ${d.issues.length} problème(s) à corriger`);
      },
    });

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1 space-y-1.5 sm:max-w-sm">
            <Label>Cours de destination</Label>
            <Select value={courseId} onValueChange={setCourseId} disabled={published}>
              <SelectTrigger className="w-full" aria-label="Cours de destination">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Aucun (à choisir)</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={pending || published} onClick={persist}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />} Enregistrer le brouillon
            </Button>
            <Button
              disabled={pending || published || !check.chapter || !course}
              onClick={async () => {
                const s = await run(() => saveImportDraft(row.id, { courseId: courseId === NONE ? null : courseId, draftText: text }), { refresh: false });
                if (!s.ok) return;
                setSavedText(text);
                await run(() => importDraft(row.id), {
                  onOk: (d) => {
                    setPreviewHref(d.previewHref);
                    toast.success(`Importé en brouillon : ${d.report.lessons} leçons, ${d.report.questions} questions`);
                  },
                });
              }}
              title={!course ? "Choisis d'abord le cours" : !check.chapter ? "Le JSON doit être un chapitre valide" : undefined}
            >
              <Upload /> Importer en brouillon
            </Button>
            <ConfirmAction
              trigger={
                <Button variant="outline" disabled={pending || !["reviewed", "published"].includes(row.status) || dirty} title={dirty ? "Enregistre et réimporte d'abord tes modifications" : undefined}>
                  <Rocket /> Publier
                </Button>
              }
              destructive={false}
              title="Publier ce chapitre ?"
              description={<p>Le chapitre importé et toutes ses leçons deviendront visibles pour les étudiants (si le cours est publié). As-tu vérifié l&apos;aperçu dans le lecteur ?</p>}
              confirmLabel="Publier"
              onConfirm={() => run(() => publishImport(row.id), { success: "Chapitre publié" })}
            />
            <ConfirmAction
              trigger={
                <Button variant="ghost" size="icon" aria-label="Supprimer l'import" disabled={pending}>
                  <Trash2 />
                </Button>
              }
              title="Supprimer cet import ?"
              description={<p>Le fichier et le brouillon sont supprimés. Le contenu déjà importé dans un cours n&apos;est pas touché.</p>}
              onConfirm={() => run(() => deleteImport(row.id), { success: "Import supprimé", refresh: false, onOk: () => router.push("/admin/imports") })}
            />
          </div>
        </div>
        {(previewHref || row.status === "reviewed" || published) && check.chapter && course && (
          <p className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-brand-soft px-3 py-2 text-sm">
            <CheckCircle2 className="size-4 text-primary" />
            {published ? "Chapitre publié." : "Chapitre importé en brouillon : invisible pour les étudiants."}
            <Link href={previewHref ?? `/cours/${course.slug}/${check.chapter.slug}/${check.chapter.sections[0].lessons[0].slug}`} target="_blank" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              Ouvrir dans le lecteur étudiant <ExternalLink className="size-3.5" />
            </Link>
          </p>
        )}
        {row.error && <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{row.error}</p>}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Texte extrait"
          description={isPdf ? `${pages.length} page${pages.length > 1 ? "s" : ""}` : "Import JSON : pas de PDF source."}
          actions={
            isPdf && (
              <>
                {pdfUrl && (
                  <Button asChild variant="ghost" size="sm">
                    <a href={pdfUrl} target="_blank" rel="noreferrer">
                      <FileText /> PDF
                    </a>
                  </Button>
                )}
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => extractImport(row.id), { success: "Texte extrait" })}>
                  <RefreshCw /> {pages.length ? "Réextraire" : "Extraire"}
                </Button>
              </>
            )
          }
        >
          {isPdf && pages.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={String(page)} onValueChange={(v) => setPage(Number(v))}>
                  <SelectTrigger size="sm" className="w-32" aria-label="Page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        Page {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Précédente
                </Button>
                <Button variant="ghost" size="sm" disabled={page >= pages.length - 1} onClick={() => setPage(page + 1)}>
                  Suivante
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Copier le texte de la page" onClick={() => navigator.clipboard.writeText(pages[page]).then(() => toast.success("Page copiée"))}>
                  <Copy />
                </Button>
              </div>
              <pre className="h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed" tabIndex={0} aria-label={`Texte de la page ${page + 1}`}>
                {pages[page] || "(page sans texte — PDF scanné ou image)"}
              </pre>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{isPdf ? "Aucun texte extrait pour l'instant." : "Le chapitre a été chargé depuis un fichier JSON."}</p>
          )}
        </Panel>

        <Panel
          title="Chapitre (format d'écriture JSON)"
          description="Valide contre chapterSchema à chaque frappe."
          actions={
            !text.trim() && (
              <Button variant="ghost" size="sm" onClick={() => setText(JSON.stringify(TEMPLATE, null, 2))}>
                <Wand2 /> Insérer un modèle
              </Button>
            )
          }
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            readOnly={published}
            aria-label="Chapitre au format JSON"
            className="h-[60vh] font-mono text-[12px] leading-relaxed"
            placeholder="Colle ici le chapitre au format content/<cours>/chNN.json…"
          />
          <div className="mt-3" aria-live="polite">
            {check.error ? (
              <IssueList issues={[{ path: [], message: `JSON invalide : ${check.error}` }]} />
            ) : check.issues.length ? (
              <IssueList issues={check.issues} />
            ) : check.chapter ? (
              <p className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
                <CheckCircle2 className="size-4" /> Chapitre valide : {check.chapter.sections.length} section(s), {lessons.length} leçon(s),{" "}
                {lessons.reduce((n, l) => n + l.quiz.length + l.blocks.filter((b) => b.type === "checkpoint").length, 0)} questions.
              </p>
            ) : null}
            {serverIssues && serverIssues.length > 0 && text === savedText && !check.issues.length && <IssueList issues={serverIssues} />}
          </div>
        </Panel>
      </div>

      {check.chapter && current && (
        <Panel title="Aperçu des leçons" description="Exactement comme dans le lecteur ; les questions sont corrigées localement.">
          <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Leçons du chapitre">
            {lessons.map((l, i) => (
              <button
                key={l.slug + i}
                type="button"
                role="tab"
                aria-selected={l === current}
                onClick={() => setLessonIdx(i)}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40", l === current ? "border-primary bg-brand-soft text-primary" : "hover:bg-muted")}
              >
                {l.number ?? i + 1} · {l.title}
              </button>
            ))}
          </div>
          <div className="rounded-xl border bg-background px-4 py-8 sm:px-8">
            <LessonPreview key={current.slug} lesson={current} chapterSlug={check.chapter.slug} chapterNumber={check.chapter.number} />
          </div>
          {check.chapter.reviewNotes.length > 0 && (
            <div className="mt-4 text-sm">
              <p className="font-medium">Notes de relecture</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {check.chapter.reviewNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      )}
      <p className="text-xs text-muted-foreground">
        Statut : <StatusBadge status={row.status} />
      </p>
    </div>
  );
}
