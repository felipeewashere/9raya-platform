"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Search, ShieldCheck, ShieldOff, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, formatDate, StatusBadge } from "@/components/admin/parts";
import { ConfirmAction, useAdminAction } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { setUserRole } from "@/app/actions/admin-students";
import type { StudentRow } from "@/app/admin/_lib/data";

type Row = StudentRow & { role: "student" | "admin" };
type SortKey = "total_xp" | "last_active" | "lessons_completed" | "created_at" | "name";

function SortButton({ label, k, sort, setSort, className }: { label: string; k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; setSort: (s: { key: SortKey; dir: 1 | -1 }) => void; className?: string }) {
  const active = sort.key === k;
  return (
    <button
      type="button"
      onClick={() => setSort({ key: k, dir: active ? (sort.dir === 1 ? -1 : 1) : -1 })}
      className={cn("inline-flex items-center gap-1 rounded-md font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40", active && "text-foreground", className)}
      aria-label={`Trier par ${label}`}
    >
      {label}
      {active && (sort.dir === -1 ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />)}
    </button>
  );
}

export function StudentsTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "total_xp", dir: -1 });
  const query = useDeferredValue(q.trim().toLowerCase());
  const shown = useMemo(() => {
    const list = query ? rows.filter((r) => `${r.full_name ?? ""} ${r.username ?? ""}`.toLowerCase().includes(query)) : rows;
    const val = (r: Row): number | string => {
      switch (sort.key) {
        case "name":
          return (r.full_name || r.username || "").toLowerCase();
        case "last_active":
          return r.last_active ?? "";
        case "created_at":
          return r.created_at;
        default:
          return r[sort.key];
      }
    };
    return [...list].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [rows, query, sort]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un nom ou un pseudo…" className="pl-8" aria-label="Rechercher un étudiant" />
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={Users} title={rows.length ? "Aucun résultat" : "Aucun inscrit pour l'instant"} />
      ) : (
        <div className="-mx-4 overflow-x-auto rounded-xl border bg-card sm:mx-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortButton label="Étudiant" k="name" sort={sort} setSort={setSort} />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton label="XP" k="total_xp" sort={sort} setSort={setSort} />
                </TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  <SortButton label="Leçons" k="lessons_completed" sort={sort} setSort={setSort} />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton label="Dernière activité" k="last_active" sort={sort} setSort={setSort} />
                </TableHead>
                <TableHead className="hidden text-right md:table-cell">
                  <SortButton label="Inscription" k="created_at" sort={sort} setSort={setSort} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="max-w-[14rem]">
                    <Link href={`/admin/etudiants/${r.id}`} className="flex items-center gap-2 rounded-md hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.full_name || r.username || "Sans nom"}</span>
                        {r.username && <span className="block truncate text-xs text-muted-foreground">@{r.username}</span>}
                      </span>
                      {r.role === "admin" && <StatusBadge status="admin" />}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.total_xp.toLocaleString("fr-FR")}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{r.lessons_completed}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{r.last_active ? formatDate(r.last_active) : "—"}</TableCell>
                  <TableCell className="hidden text-right text-muted-foreground md:table-cell">{formatDate(r.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {shown.length} / {rows.length} compte{rows.length > 1 ? "s" : ""}
      </p>
    </div>
  );
}

export function RoleToggle({ userId, role, isSelf }: { userId: string; role: "student" | "admin"; isSelf: boolean }) {
  const { pending, run } = useAdminAction();
  if (role === "admin")
    return isSelf ? (
      <p className="text-sm text-muted-foreground">C&apos;est ton compte : tu ne peux pas retirer ton propre rôle d&apos;administrateur.</p>
    ) : (
      <ConfirmAction
        trigger={
          <Button variant="outline" disabled={pending}>
            <ShieldOff /> Retirer le rôle admin
          </Button>
        }
        title="Retirer le rôle d'administrateur ?"
        description={<p>Ce compte redevient étudiant et perd l&apos;accès à l&apos;administration.</p>}
        confirmLabel="Rétrograder"
        onConfirm={() => run(() => setUserRole(userId, "student"), { success: "Rôle retiré" })}
      />
    );
  return (
    <ConfirmAction
      trigger={
        <Button variant="outline" disabled={pending}>
          <ShieldCheck /> Promouvoir administrateur
        </Button>
      }
      destructive={false}
      title="Promouvoir ce compte administrateur ?"
      description={<p>Il pourra modifier tout le contenu, voir les corrections des quiz et les données de tous les étudiants.</p>}
      confirmLabel="Promouvoir"
      onConfirm={() => run(() => setUserRole(userId, "admin"), { success: "Compte promu administrateur" })}
    />
  );
}
