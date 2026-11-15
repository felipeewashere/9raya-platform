"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, BarChart3, BookOpenText, FileUp, FolderOpen, LayoutDashboard, Menu, Puzzle, Users } from "lucide-react";
import { LogoMark } from "@/components/shell/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Vue d'ensemble", icon: LayoutDashboard, match: (p: string) => p === "/admin" },
  { href: "/admin/contenu", label: "Contenu", icon: BookOpenText, match: (p: string) => p.startsWith("/admin/contenu") || p.startsWith("/admin/lecons") },
  { href: "/admin/imports", label: "Imports PDF", icon: FileUp, match: (p: string) => p.startsWith("/admin/imports") },
  { href: "/admin/ressources", label: "Ressources", icon: FolderOpen, match: (p: string) => p.startsWith("/admin/ressources") },
  { href: "/admin/etudiants", label: "Étudiants", icon: Users, match: (p: string) => p.startsWith("/admin/etudiants") },
  { href: "/admin/analytique", label: "Analytique", icon: BarChart3, match: (p: string) => p.startsWith("/admin/analytique") },
  { href: "/admin/widgets", label: "Widgets", icon: Puzzle, match: (p: string) => p.startsWith("/admin/widgets") },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration" className="space-y-0.5">
      {NAV.map((n) => {
        const active = n.match(pathname);
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              active ? "bg-brand-soft text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
      <LogoMark className="size-7" />
      <span className="font-bold tracking-tight">9raya</span>
      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Admin</span>
    </Link>
  );
}

export function AdminShell({ user, children }: { user: { name: string; avatar: string | null }; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-dvh w-full">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 lg:flex">
        <Brand />
        <NavLinks />
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 max-w-[85vw] p-0">
          <SheetHeader className="border-b">
            <SheetTitle asChild>
              <div>
                <Brand />
              </div>
            </SheetTitle>
            <SheetDescription className="sr-only">Navigation de l&apos;administration</SheetDescription>
          </SheetHeader>
          <div className="px-3">
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
            <Menu />
          </Button>
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button asChild variant="outline" size="sm">
              <Link href="/tableau-de-bord">
                <span className="hidden sm:inline">Site étudiant</span>
                <span className="sm:hidden">Site</span>
                <ArrowUpRight />
              </Link>
            </Button>
            <ThemeToggle />
            <Avatar className="size-8 border" title={user.name}>
              {user.avatar && <AvatarImage src={user.avatar} alt="" />}
              <AvatarFallback className="bg-brand-soft text-xs font-semibold text-primary">
                {user.name
                  .split(/\s+/)
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>
        <main id="contenu" className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
