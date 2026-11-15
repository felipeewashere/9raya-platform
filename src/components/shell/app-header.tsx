"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, LayoutDashboard, LogOut, PencilRuler, Settings, Shield, Trophy, User } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { CommandPalette } from "./command-palette";
import { StreakCalendar } from "./streak-calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

export type ShellUser = { name: string; username: string | null; avatar: string | null; role: "student" | "admin" };
export type ShellStats = {
  xp: number;
  level: number;
  streak: number;
  longest: number;
  activeToday: boolean;
  activeDays: string[];
  group: string | null;
  section: number | null;
};

export const NAV = [
  { href: "/tableau-de-bord", label: "Tableau de bord", short: "Accueil", icon: LayoutDashboard },
  { href: "/cours", label: "Cours", short: "Cours", icon: BookOpen },
  { href: "/td", label: "TD", short: "TD", icon: PencilRuler },
  { href: "/classement", label: "Classement", short: "Classement", icon: Trophy },
  { href: "/profil", label: "Profil", short: "Profil", icon: User },
];

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function UserMenu({ user }: { user: ShellUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-full items-center px-3 hover:bg-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50" aria-label="Menu du compte">
        <Avatar className="size-7 rounded-none border border-[var(--rule)]">
          {user.avatar && <AvatarImage src={user.avatar} alt="" className="rounded-none" />}
          <AvatarFallback className="rounded-none bg-primary font-mono text-[0.7rem] text-primary-foreground">{initials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-none border-[var(--rule)]">
        <DropdownMenuLabel>
          <div className="font-semibold">{user.name}</div>
          {user.username && <div className="font-mono text-xs font-normal text-muted-foreground">@{user.username}</div>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profil">
            <User /> Profil et succès
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/parametres">
            <Settings /> Paramètres
          </Link>
        </DropdownMenuItem>
        {user.role === "admin" && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Shield /> Administration
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut /> Se déconnecter
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Editorial header: one ruled bar of cells (nav on the left, search / streak / XP / theme / account on the right). */
export function AppHeader({ user, stats }: { user: ShellUser; stats: ShellStats }) {
  const pathname = usePathname();
  const cell = "flex h-full items-center border-l border-[var(--rule)]";
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--rule)] bg-background">
      <div className="flex h-12 items-stretch">
        <nav className="hidden items-stretch md:flex" aria-label="Navigation principale">
          {NAV.slice(0, 4).map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "label flex items-center border-r border-[var(--rule)] px-5 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50",
                  active ? "bg-foreground text-background" : "hover:bg-primary hover:text-primary-foreground",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-stretch">
          <div className={cn(cell, "px-2")}>
            <CommandPalette />
          </div>
          <div className={cell}>
            <StreakCalendar
              streak={stats.streak}
              activeToday={stats.activeToday}
              longest={stats.longest}
              activeDays={stats.activeDays}
              group={stats.group}
              section={stats.section}
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/profil" className={cn(cell, "gap-2 px-3 font-mono text-[0.8rem] tabular-nums hover:bg-foreground hover:text-background")}>
                <span className="grid h-5 min-w-5 place-items-center bg-reward px-1 text-[0.7rem] text-[#0e0e0e]">{stats.level}</span>
                {stats.xp.toLocaleString("fr-FR")} XP
              </Link>
            </TooltipTrigger>
            <TooltipContent>Niveau {stats.level}</TooltipContent>
          </Tooltip>
          <div className={cn(cell, "px-1")}>
            <ThemeToggle />
          </div>
          <div className={cell}>
            <UserMenu user={user} />
          </div>
        </div>
      </div>
    </header>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--rule)] bg-background pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Navigation">
      <ul className="grid grid-cols-5">
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + "/");
          const Icon = n.icon;
          return (
            <li key={n.href} className="border-r border-[var(--rule)] last:border-r-0">
              <Link
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn("label flex flex-col items-center gap-1 py-2 !text-[0.6rem]", active ? "bg-foreground text-background" : "text-foreground")}
              >
                <Icon className="size-5" strokeWidth={1.6} />
                {n.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
