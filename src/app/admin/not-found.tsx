import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/admin/parts";
import { Button } from "@/components/ui/button";

export default function AdminNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      className="mt-10"
      title="Élément introuvable"
      description="Il a peut-être été supprimé, ou le lien est incorrect."
      action={
        <Button asChild variant="outline">
          <Link href="/admin/contenu">Retour au contenu</Link>
        </Button>
      }
    />
  );
}
