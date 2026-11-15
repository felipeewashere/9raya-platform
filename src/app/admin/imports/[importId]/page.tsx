import { ImportReview } from "@/components/admin/imports/review";
import { PageHeader, StatusBadge } from "@/components/admin/parts";
import { getImport } from "../../_lib/data";

export const metadata = { title: "Relecture d'import" };

export default async function ImportReviewPage({ params }: PageProps<"/admin/imports/[importId]">) {
  const { importId } = await params;
  const { row, pages, courses, pdfUrl } = await getImport(importId);
  return (
    <>
      <PageHeader
        back={{ href: "/admin/imports", label: "Imports PDF" }}
        eyebrow="Relecture"
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="break-all">{row.file_name}</span> <StatusBadge status={row.status} />
          </span>
        }
        description="Rédige ou colle le chapitre au format d'écriture à droite, en t'appuyant sur le texte extrait. Rien n'est visible des étudiants avant « Publier »."
      />
      <ImportReview key={row.updated_at} row={row} pages={pages} courses={courses} pdfUrl={pdfUrl} />
    </>
  );
}
