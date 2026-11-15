"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, FileText, Layers, Search, LayoutDashboard, User } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { getSearchIndex, type SearchEntry } from "@/app/actions/profile";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open && !index) getSearchIndex().then(setIndex).catch(() => setIndex([]));
  }, [open, index]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const icon = (t: SearchEntry["type"]) => (t === "course" ? <BookOpen /> : t === "chapter" ? <Layers /> : <FileText />);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="hidden h-8 w-48 justify-start gap-2 rounded-sm font-normal text-muted-foreground lg:flex" aria-label="Rechercher (Ctrl+K)">
        <Search className="size-4" />
        <span className="flex-1 text-left text-[0.9rem] italic">Rechercher…</span>
        <kbd className="rounded-sm border bg-muted px-1.5 font-label text-[10px]">Ctrl K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Rechercher">
        <Search className="size-4" />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Rechercher" description="Cherche un cours, un chapitre ou une leçon">
        <CommandInput placeholder="Cherche une leçon, une notion (ex. noyau, groupe, rang)…" />
        <CommandList>
          <CommandEmpty>{index ? "Aucun résultat." : "Chargement…"}</CommandEmpty>
          <CommandGroup heading="Aller à">
            <CommandItem onSelect={() => go("/tableau-de-bord")}>
              <LayoutDashboard /> Tableau de bord
            </CommandItem>
            <CommandItem onSelect={() => go("/cours")}>
              <BookOpen /> Tous les cours
            </CommandItem>
            <CommandItem onSelect={() => go("/profil")}>
              <User /> Mon profil
            </CommandItem>
          </CommandGroup>
          {index && index.length > 0 && <CommandSeparator />}
          {index && index.length > 0 && (
            <CommandGroup heading="Contenu">
              {index.map((e) => (
                <CommandItem key={e.href} value={`${e.title} ${e.keywords} ${e.subtitle}`} onSelect={() => go(e.href)}>
                  {icon(e.type)}
                  <div className="min-w-0">
                    <div className="truncate">{e.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{e.subtitle}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
