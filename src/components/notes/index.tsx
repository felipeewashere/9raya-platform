import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tx } from "@/components/math/tx";

/*
 * Shared page pieces, "paper" theme (same look as the gestion du temps prototype):
 * warm paper background, Fraunces headings, Space Grotesk text, orange-red + blue accents.
 * All server-safe (no hooks), usable from server and client components.
 * (Names kept from the earlier "printed notes" theme so every page keeps working.)
 */

/** Small rounded counter (section number, rank, chapter number). */
export function NumberSquare({
  children,
  className,
  tone = "blue",
}: {
  children: ReactNode;
  className?: string;
  tone?: "blue" | "red" | "gold" | "muted" | "green";
}) {
  return (
    <span
      className={cn(
        "inline-grid h-[1.6em] min-w-[1.6em] shrink-0 place-items-center px-[0.4em] font-mono text-[0.85em] font-medium leading-none tabular-nums",
        tone === "blue" && "bg-primary text-primary-foreground",
        tone === "red" && "bg-danger text-white dark:text-[#1a0d0e]",
        tone === "gold" && "bg-reward text-[#2b2000]",
        tone === "green" && "bg-success text-white dark:text-[#06180f]",
        tone === "muted" && "bg-muted text-muted-foreground",
        className,
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}

/** Section heading: a small faded number, then the title in Fraunces. */
export function SectionTitle({
  number,
  children,
  id,
  as: Tag = "h2",
  aside,
  className,
  size = "md",
}: {
  number?: ReactNode;
  children: ReactNode;
  id?: string;
  as?: "h1" | "h2" | "h3";
  /** right-aligned extra (a link, a count) */
  aside?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className={cn("flex items-baseline gap-3", className)}>
      <Tag
        id={id}
        className={cn(
          "flex min-w-0 scroll-mt-24 items-baseline gap-[0.6em] font-display",
          size === "sm" && "text-[1.3rem]",
          size === "md" && "text-[1.7rem] sm:text-[2rem]",
          size === "lg" && "text-[2.2rem] sm:text-[2.8rem]",
        )}
      >
        {number !== undefined && (
          <span aria-hidden className="label translate-y-[-0.3em] !text-[0.7rem] text-primary">
            {typeof number === "number" ? String(number).padStart(2, "0") : number}
          </span>
        )}
        <span className="min-w-0">{children}</span>
      </Tag>
      {aside && <div className="ml-auto shrink-0 text-sm">{aside}</div>}
    </div>
  );
}

/** Inline label: "Propositions :" (blue), "remarque :" (red), "Résumé :" (gold). */
export function NoteLabel({ tone = "blue", children, className }: { tone?: "blue" | "red" | "gold" | "muted"; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "font-bold",
        tone === "blue" && "text-accent-2",
        tone === "red" && "text-primary",
        tone === "gold" && "text-reward-foreground",
        tone === "muted" && "text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Highlighted box with a small title line. */
export function ImportantBox({
  title,
  tone = "red",
  children,
  className,
  bodyClassName,
  aside,
  ...props
}: Omit<ComponentProps<"section">, "title"> & {
  title: ReactNode;
  tone?: "red" | "blue";
  bodyClassName?: string;
  /** right side of the title bar */
  aside?: ReactNode;
}) {
  return (
    <section
      {...props}
      className={cn(
        "overflow-hidden border border-[var(--rule)]",
        tone === "red" ? "bg-accent-2/[0.07]" : "bg-primary/[0.06]",
        className,
      )}
    >
      <header
        className={cn(
          "label flex items-center gap-2 border-b border-[var(--rule)] px-4 py-2",
          tone === "red" ? "bg-accent-2 text-[#0e0e0e]" : "bg-primary text-primary-foreground",
        )}
      >
        <div className="min-w-0 flex-1">{title}</div>
        {aside}
      </header>
      <div className={cn("px-4 py-3 sm:px-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Bulleted list with em dashes and a generous indent. */
export function EmDashList({ children, className, ...props }: ComponentProps<"ul">) {
  return (
    <ul {...props} className={cn("dash-list space-y-1.5", className)}>
      {children}
    </ul>
  );
}

/** label ........ value */
export function LeaderRow({ label, value, hint, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("py-1", className)}>
      <div className="flex items-baseline gap-2">
        <span className="min-w-0">{label}</span>
        <span className="leader" aria-hidden />
        <span className="shrink-0 font-bold tabular-nums">{value}</span>
      </div>
      {hint && <p className="text-[0.85rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Page title: small kicker, big Fraunces title, muted subtitle. */
export function DocTitle({
  kicker,
  title,
  subtitle,
  subtitleLabel,
  align = "left",
  className,
  id,
  children,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** kept for compatibility; shown as a small label before the subtitle */
  subtitleLabel?: ReactNode;
  align?: "center" | "left";
  className?: string;
  id?: string;
  children?: ReactNode;
}) {
  return (
    <header className={cn("space-y-2", align === "center" ? "text-center" : "text-left", className)}>
      {kicker && <p className="label text-muted-foreground">{kicker}</p>}
      <h1 id={id} className="font-display text-[3rem] leading-[0.9] sm:text-[4.6rem]">
        {title}
      </h1>
      {subtitle && (
        <p className={cn("text-[1.02rem] text-muted-foreground", align === "center" && "mx-auto max-w-2xl")}>
          {subtitleLabel && <span className="font-medium text-foreground">{subtitleLabel} </span>}
          {typeof subtitle === "string" ? <Tx>{subtitle}</Tx> : subtitle}
        </p>
      )}
      {children}
    </header>
  );
}

/** Kept for compatibility: a plain heading (the bracket decoration was dropped). */
export function BracketTitle({ children, className, id, as: Tag = "h1" }: { children: ReactNode; className?: string; id?: string; as?: "h1" | "h2" | "p" | "span" }) {
  return (
    <Tag id={id} className={cn("font-display leading-none", className)}>
      {children}
    </Tag>
  );
}

/* Decorations of the previous theme: kept as no-ops so existing imports stay valid. */
export function SheetFooter(props: { page: ReactNode; title: ReactNode; side?: "left" | "right"; className?: string }) {
  void props;
  return null;
}
export function Watermark(props: { className?: string }) {
  void props;
  return null;
}
export function Swoosh(props: { className?: string }) {
  void props;
  return null;
}
export function FooterBand(props: { label: ReactNode; page?: ReactNode; className?: string }) {
  void props;
  return null;
}

/** A page container. */
export function NotesPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
  footer?: { label: ReactNode; page?: ReactNode };
  watermarkClassName?: string;
}) {
  return <div className={cn("relative", className)}>{children}</div>;
}

/** Thin rounded progress bar. */
export function ThinProgress({ value, label, className, tone = "blue" }: { value: number; label?: string; className?: string; tone?: "blue" | "gold" | "green" }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden bg-foreground/12", className)}
    >
      <div
        className={cn("h-full transition-[width] duration-700", tone === "blue" && "bg-primary", tone === "gold" && "bg-reward", tone === "green" && "bg-success")}
        style={{ width: `${v * 100}%` }}
      />
    </div>
  );
}
