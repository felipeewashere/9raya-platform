import { CatalogManager } from "@/components/admin/content/catalog";
import { PageHeader } from "@/components/admin/parts";
import { getCatalogAdmin } from "../_lib/data";

export const metadata = { title: "Contenu" };

export default async function ContentPage() {
  const { semesters, courses } = await getCatalogAdmin();
  return (
    <>
      <PageHeader title="Contenu" description="Semestres, cours, chapitres, sections et leçons. Glisse les poignées (ou utilise Espace + flèches) pour réordonner." />
      <CatalogManager semesters={semesters} courses={courses} />
    </>
  );
}
