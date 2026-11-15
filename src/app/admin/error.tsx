"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && "digest" in error ? String((error as { digest?: string }).digest ?? "") : "";
  return (
    <div role="alert" className="mx-auto mt-10 max-w-md rounded-xl border bg-card p-6 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-full bg-danger-soft text-danger">
        <TriangleAlert className="size-5" />
      </span>
      <h1 className="mt-3 text-lg font-semibold">Cette page n&apos;a pas pu se charger</h1>
      <p className="mt-1 text-sm text-muted-foreground">Une erreur est survenue côté serveur ou base de données. Réessaie ; si le problème persiste, consulte les journaux du serveur.</p>
      {digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Réf. {digest}</p>}
      <div className="mt-4 flex justify-center gap-2">
        <Button onClick={() => retry()}>
          <RotateCcw /> Réessayer
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin">Vue d&apos;ensemble</Link>
        </Button>
      </div>
    </div>
  );
}
