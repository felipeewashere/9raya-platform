import Link from "next/link";
import { cn } from "@/lib/utils";

/** A numbered square like the section headings, with a small golden corner. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-grid size-7 shrink-0 place-items-center rounded-[3px] bg-primary font-bold leading-none text-primary-foreground", className)}>
      <span className="text-[1.05rem]">9</span>
      <span className="absolute -right-[3px] -top-[3px] size-2 bg-reward" />
    </span>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40", className)} aria-label="9raya — accueil">
      <LogoMark />
      <span className="text-[1.2rem] font-bold text-primary smallcaps">9raya</span>
    </Link>
  );
}
