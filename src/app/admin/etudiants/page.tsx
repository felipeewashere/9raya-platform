import { PageHeader } from "@/components/admin/parts";
import { StudentsTable } from "@/components/admin/students";
import { getStudents } from "../_lib/data";

export const metadata = { title: "Étudiants" };

export default async function StudentsPage() {
  const rows = await getStudents();
  return (
    <>
      <PageHeader title="Étudiants" description="Tous les comptes inscrits. Trie par XP ou par dernière activité, ouvre un compte pour voir sa progression." />
      <StudentsTable rows={rows} />
    </>
  );
}
