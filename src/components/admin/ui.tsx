"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ActionResult, Issue } from "@/app/actions/admin-shared";

/**
 * Runs an admin server action: shows a toast on success/failure and refreshes the route.
 * Returns the result so callers can read data or validation issues.
 */
export function useAdminAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, opts: { success?: string; refresh?: boolean; onOk?: (data: T) => void; onError?: (error: string, issues?: Issue[]) => void } = {}) =>
      new Promise<ActionResult<T>>((resolve) => {
        start(async () => {
          try {
            const r = await fn();
            if (r.ok) {
              if (opts.success) toast.success(opts.success);
              opts.onOk?.(r.data);
              if (opts.refresh !== false) router.refresh();
            } else {
              toast.error(r.error);
              opts.onError?.(r.error, r.issues);
            }
            resolve(r);
          } catch (e) {
            const error = e instanceof Error ? e.message : "Erreur réseau.";
            toast.error(error);
            resolve({ ok: false, error });
          }
        });
      }),
    [router],
  );
  return { pending, run };
}

/** Confirmation dialog in front of a destructive action. */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel = "Supprimer",
  destructive = true,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {destructive && <AlertTriangle className="size-4 text-danger" />}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
                setOpen(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The standard warning shown before deleting content that students may have worked on. */
export function ProgressWarning({ what }: { what: string }) {
  return (
    <>
      <p>
        Supprimer {what} efface aussi, définitivement, la progression des étudiants qui s&apos;y rapporte (leçons terminées, réponses aux quiz, notes et favoris).
      </p>
      <p className="font-medium text-foreground">Cette action est irréversible.</p>
    </>
  );
}

export function Field({ label, htmlFor, error, hint, children, className }: { label: React.ReactNode; htmlFor?: string; error?: string | null; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Issues for a field, from server/zod issues (first path segment). */
export function issueFor(issues: Issue[] | undefined, key: string) {
  return issues?.find((i) => i.path[0] === key)?.message ?? null;
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
