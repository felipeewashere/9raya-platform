import Link from "next/link";
import { FileUp } from "lucide-react";
import { ImportUploader } from "@/components/admin/imports/uploader";
import { EmptyState, formatDate, PageHeader, Panel, StatusBadge } from "@/components/admin/parts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getImports } from "../_lib/data";

export const metadata = { title: "Imports PDF" };

export default async function ImportsPage() {
  const { imports, courses } = await getImports();
  return (
    <>
      <PageHeader
        title="Imports PDF"
        description="Flux de relecture : envoi → extraction du texte → rédaction et vérification du chapitre → import en brouillon → aperçu → publication. Rien n'est publié automatiquement."
      />
      <div className="space-y-6">
        <Panel title="Nouvel import">
          <ImportUploader courses={courses} />
        </Panel>
        <Panel title="Imports">
          {imports.length === 0 ? (
            <EmptyState icon={FileUp} title="Aucun import" description="Envoie un PDF ou un fichier JSON pour commencer." />
          ) : (
            <div className="-mx-4 overflow-x-auto sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fichier</TableHead>
                    <TableHead>Cours</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden sm:table-cell">Mis à jour</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imports.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="max-w-[16rem]">
                        <Link href={`/admin/imports/${i.id}`} className="block truncate font-medium text-primary hover:underline">
                          {i.file_name}
                        </Link>
                        <span className="text-xs text-muted-foreground">{i.storage_path.startsWith("json/") ? "JSON" : "PDF"}</span>
                        {i.error && <span className="block truncate text-xs text-danger">{i.error}</span>}
                      </TableCell>
                      <TableCell>{i.course?.title ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        <StatusBadge status={i.status} />
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(i.updated_at, true)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
