import Link from "next/link";
import { ThemeToggle } from "@/components/shell/theme-toggle";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="grid h-11 grid-cols-[auto_1fr_auto] border-b border-[var(--rule)]">
        <Link href="/" className="sv-link flex items-center border-r border-[var(--rule)] px-4">
          ← Retour
        </Link>
        <span className="label hidden items-center px-4 sm:flex">Compte</span>
        <div className="flex items-center border-l border-[var(--rule)] px-1">
          <ThemeToggle />
        </div>
      </div>
      <main id="contenu" className="mx-auto flex w-full max-w-md flex-1 items-center px-5 py-10">
        <div className="page-in w-full">{children}</div>
      </main>
    </div>
  );
}
