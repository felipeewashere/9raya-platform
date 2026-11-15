"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileJson, FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { createImportUpload, createJsonImport, extractImport, registerImport } from "@/app/actions/admin-imports";

const NONE = "none";

export function ImportUploader({ courses }: { courses: { id: string; title: string }[] }) {
  const router = useRouter();
  const [courseId, setCourseId] = useState<string>(courses[0]?.id ?? NONE);
  const [busy, setBusy] = useState<null | string>(null);
  const pdf = useRef<HTMLInputElement>(null);
  const json = useRef<HTMLInputElement>(null);
  const course = courseId === NONE ? null : courseId;

  async function uploadPdf(file: File) {
    try {
      setBusy("Envoi du PDF…");
      const signed = await createImportUpload({ name: file.name, type: file.type || "application/pdf", size: file.size });
      if (!signed.ok) throw new Error(signed.error);
      const up = await createClient().storage.from("imports").uploadToSignedUrl(signed.data.path, signed.data.token, file, { contentType: "application/pdf" });
      if (up.error) throw new Error(up.error.message);
      const reg = await registerImport({ path: signed.data.path, fileName: file.name, courseId: course });
      if (!reg.ok) throw new Error(reg.error);
      setBusy("Extraction du texte…");
      const ex = await extractImport(reg.data.id);
      if (!ex.ok) toast.error(ex.error);
      else toast.success(ex.data.empty ? `${ex.data.pages} pages, mais aucun texte (PDF scanné ?)` : `Texte extrait : ${ex.data.pages} pages`);
      router.push(`/admin/imports/${reg.data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setBusy(null);
      if (pdf.current) pdf.current.value = "";
    }
  }

  async function uploadJson(file: File) {
    try {
      setBusy("Lecture du JSON…");
      if (file.size > 10_000_000) throw new Error("Fichier trop volumineux (10 Mo max).");
      const text = await file.text();
      const r = await createJsonImport({ fileName: file.name, text, courseId: course });
      if (!r.ok) throw new Error(r.error);
      toast.success("Chapitre chargé : vérifie-le avant de l'importer");
      router.push(`/admin/imports/${r.data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setBusy(null);
      if (json.current) json.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="max-w-sm space-y-1.5">
        <Label>Cours de destination</Label>
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger className="w-full" aria-label="Cours de destination">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Choisir plus tard</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-dashed p-4">
          <p className="flex items-center gap-2 font-medium">
            <FileText className="size-4 text-primary" /> Polycopié PDF
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Le texte de chaque page est extrait ; tu rédiges ensuite le chapitre au format JSON à côté, puis tu le vérifies avant import.</p>
          <input ref={pdf} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="Choisir un PDF" onChange={(e) => e.target.files?.[0] && uploadPdf(e.target.files[0])} />
          <Button className="mt-3" disabled={busy !== null} onClick={() => pdf.current?.click()}>
            {busy ? <Loader2 className="animate-spin" /> : <Upload />} Envoyer un PDF
          </Button>
        </div>
        <div className="rounded-xl border border-dashed p-4">
          <p className="flex items-center gap-2 font-medium">
            <FileJson className="size-4 text-primary" /> Chapitre JSON
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Un fichier au format d&apos;écriture (comme content/algebre-1/ch01.json). Il passe par la même relecture.</p>
          <input ref={json} type="file" accept="application/json,.json" className="sr-only" aria-label="Choisir un fichier JSON" onChange={(e) => e.target.files?.[0] && uploadJson(e.target.files[0])} />
          <Button className="mt-3" variant="outline" disabled={busy !== null} onClick={() => json.current?.click()}>
            {busy ? <Loader2 className="animate-spin" /> : <Upload />} Importer un JSON
          </Button>
        </div>
      </div>
      {busy && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {busy}
        </p>
      )}
    </div>
  );
}
