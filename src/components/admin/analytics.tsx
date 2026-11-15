"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { LessonStat } from "@/app/admin/_lib/data";

const completion = (s: LessonStat) => (s.started ? Math.round((100 * s.completed) / s.started) : null);
const fmt = (v: number | null, unit = " %") => (v === null ? "—" : `${v.toLocaleString("fr-FR")}${unit}`);

/** Horizontal bar, 0–100, animated from zero (no chart library). */
export function Bar({ value, tone, label }: { value: number | null; tone: "primary" | "success" | "danger"; label: string }) {
  const reduce = useReducedMotion();
  const v = value ?? 0;
  return (
    <div className="flex items-center gap-2" role="img" aria-label={`${label} : ${fmt(value)}`}>
      <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn("h-full rounded-full", tone === "primary" ? "bg-primary" : tone === "success" ? "bg-success" : "bg-danger")}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, v))}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{fmt(value)}</span>
    </div>
  );
}

type Key = "order" | "title" | "started" | "completion" | "attempts" | "avg_score" | "pass_rate";

export function CourseStats({ stats }: { stats: LessonStat[] }) {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "order", dir: 1 });
  const rows = useMemo(() => {
    const indexed = stats.map((s, i) => ({ ...s, order: i, completion: completion(s) }));
    const val = (r: (typeof indexed)[number]) => (sort.key === "title" ? r.title.toLowerCase() : (r[sort.key] ?? -1));
    return indexed.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [stats, sort]);

  const head = (label: string, key: Key, className?: string) => {
    const active = sort.key === key;
    return (
      <TableHead className={className} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
        <button
          type="button"
          onClick={() => setSort({ key, dir: active ? (sort.dir === 1 ? -1 : 1) : key === "order" || key === "title" ? 1 : -1 })}
          className={cn("inline-flex items-center gap-1 rounded-md font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40", active && "text-foreground")}
        >
          {label}
          {active && (sort.dir === 1 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />)}
        </button>
      </TableHead>
    );
  };

  const chartRows = stats.map((s) => ({ ...s, completion: completion(s) }));

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Complétion et réussite par leçon</h2>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-primary" /> Complétion (terminées / commencées)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-success" /> Taux de réussite au quiz
            </span>
          </div>
        </div>
        <ul className="space-y-3">
          {chartRows.map((s) => (
            <li key={s.lesson_id} className="grid gap-1 sm:grid-cols-[minmax(0,16rem)_1fr] sm:items-center sm:gap-4">
              <Link href={`/admin/analytique/${s.lesson_id}`} className="truncate text-sm hover:underline">
                <span className="text-muted-foreground">Ch. {s.chapter_number} · </span>
                {s.title}
              </Link>
              <div className="space-y-1">
                <Bar value={s.completion} tone="primary" label={`Complétion de ${s.title}`} />
                <Bar value={s.pass_rate} tone={s.pass_rate !== null && s.pass_rate < 50 ? "danger" : "success"} label={`Réussite de ${s.title}`} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="-mx-4 overflow-x-auto rounded-xl border bg-card sm:mx-0">
        <Table>
          <TableHeader>
            <TableRow>
              {head("#", "order", "w-12")}
              {head("Leçon", "title")}
              {head("Commencée", "started", "text-right")}
              {head("Complétion", "completion", "text-right")}
              {head("Quiz finis", "attempts", "text-right hidden sm:table-cell")}
              {head("Score moyen", "avg_score", "text-right hidden md:table-cell")}
              {head("Réussite", "pass_rate", "text-right")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.lesson_id}>
                <TableCell className="text-muted-foreground tabular-nums">{s.order + 1}</TableCell>
                <TableCell className="max-w-[16rem]">
                  <Link href={`/admin/analytique/${s.lesson_id}`} className="block truncate font-medium text-primary hover:underline">
                    {s.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">Chapitre {s.chapter_number}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{s.started}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(s.completion)}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{s.attempts}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{fmt(s.avg_score)}</TableCell>
                <TableCell className={cn("text-right font-medium tabular-nums", s.pass_rate !== null && s.pass_rate < 50 && "text-danger")}>{fmt(s.pass_rate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
