import { PageHeader } from "@/components/admin/parts";
import { ResourcesManager } from "@/components/admin/resources";
import { getResources } from "../_lib/data";

export const metadata = { title: "Ressources" };

export default async function ResourcesPage() {
  const { resources, courses } = await getResources();
  return (
    <>
      <PageHeader title="Ressources" description="Fichiers téléchargeables rattachés à un cours, et éventuellement à un chapitre ou une leçon (bucket privé « resources »)." />
      <ResourcesManager resources={resources} courses={courses} />
    </>
  );
}
