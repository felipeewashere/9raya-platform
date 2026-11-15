"use client";

import { useState } from "react";
import { Loader2, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { skipLesson } from "@/lib/actions/learning";

/** Marks every unfinished lesson of a chapter as skipped (checked, no XP). */
export function SkipChapter({ lessonIds }: { lessonIds: string[] }) {
  const [busy, setBusy] = useState(false);
  if (!lessonIds.length) return null;

  const run = async () => {
    setBusy(true);
    for (const id of lessonIds) {
      const r = await skipLesson(id);
      if (!r.ok) {
        toast.error(r.error);
        setBusy(false);
        return;
      }
    }
    toast("Chapitre passé (sans XP)");
    window.location.reload();
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="label inline-flex items-center gap-2 border-2 border-[var(--rule)] px-3 py-2 transition-colors hover:bg-foreground hover:text-background disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <SkipForward className="size-4" />}
      Passer le chapitre
    </button>
  );
}
