"use client";

import { CircleAlert } from "lucide-react";
import type { z } from "zod";
import type { Issue } from "@/app/actions/admin-shared";

export type { Issue };

export function zodIssues(e: z.ZodError): Issue[] {
  return e.issues.map((i) => ({ path: i.path.filter((p): p is string | number => typeof p !== "symbol"), message: i.message }));
}

/** Issues under `prefix`, with the prefix removed from their path. */
export function subIssues(issues: Issue[] | undefined, prefix: (string | number)[]): Issue[] {
  if (!issues?.length) return [];
  return issues.filter((i) => prefix.every((p, k) => i.path[k] === p)).map((i) => ({ ...i, path: i.path.slice(prefix.length) }));
}

/** Message for an exact relative path (e.g. ["md"]). */
export function issueAt(issues: Issue[], path: (string | number)[]) {
  return issues.find((i) => i.path.length === path.length && path.every((p, k) => i.path[k] === p))?.message ?? null;
}

const LABELS: Record<string, string> = {
  md: "texte",
  text: "texte",
  title: "titre",
  steps: "étapes",
  solution: "correction",
  why: "justification",
  prompt: "énoncé",
  options: "options",
  answer: "réponse",
  explanation: "explication",
  accepted: "réponses acceptées",
  answerType: "type de réponse",
  variables: "variables",
  pairs: "paires",
  left: "gauche",
  right: "droite",
  items: "éléments",
  spec: "widget",
  widget: "widget",
  props: "propriétés",
  question: "question",
  kind: "type",
  blocks: "blocs",
  quiz: "quiz",
  slug: "slug",
  summary: "résumé",
  estimatedMinutes: "durée",
  sections: "sections",
  lessons: "leçons",
  description: "description",
  number: "numéro",
};

export function pathLabel(path: (string | number)[]) {
  if (!path.length) return "";
  return path.map((p) => (typeof p === "number" ? `n°${p + 1}` : (LABELS[p] ?? p))).join(" › ");
}

/** Translates the most common zod messages. */
export function frMessage(m: string) {
  return m
    .replace(/^Too small: expected string to have >=1 characters?$/i, "ne peut pas être vide")
    .replace(/^Too small: expected array to have >=(\d+) items?$/i, "au moins $1 élément(s)")
    .replace(/^Too big: expected array to have <=(\d+) items?$/i, "au plus $1 élément(s)")
    .replace(/^Too small: expected number to be >=(\d+)$/i, "doit être ≥ $1")
    .replace(/^Too big: expected number to be <=(\d+)$/i, "doit être ≤ $1")
    .replace(/^Invalid input: expected (\w+), received (\w+)$/i, "valeur manquante ou invalide ($1 attendu)");
}

export function IssueList({ issues, className }: { issues: Issue[]; className?: string }) {
  if (!issues.length) return null;
  return (
    <ul role="alert" className={className ?? "space-y-1 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"}>
      {issues.slice(0, 12).map((i, k) => (
        <li key={k} className="flex gap-1.5">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {i.path.length > 0 && <span className="font-medium">{pathLabel(i.path)} : </span>}
            {frMessage(i.message)}
          </span>
        </li>
      ))}
      {issues.length > 12 && <li>… et {issues.length - 12} autre(s) problème(s).</li>}
    </ul>
  );
}
