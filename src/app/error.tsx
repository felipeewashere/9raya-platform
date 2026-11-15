"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { ImportantBox } from "@/components/notes";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-[60dvh] place-items-center p-6">
      <ImportantBox title={<h1>Oups, quelque chose s&apos;est mal passé</h1>} className="w-full max-w-md">
        <p>Ta progression est enregistrée. Réessaie, et si le problème continue, reviens dans quelques minutes.</p>
        {error.digest && <p className="mt-1 text-[0.85rem] text-muted-foreground">Code : {error.digest}</p>}
        <div className="mt-4 flex gap-2">
          <Button onClick={reset}>
            <RotateCcw /> Réessayer
          </Button>
          <Button asChild variant="outline">
            <Link href="/tableau-de-bord">Tableau de bord</Link>
          </Button>
        </div>
      </ImportantBox>
    </div>
  );
}
