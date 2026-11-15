import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getCatalog } from "@/lib/data/courses";
import { readTdChapters } from "@/lib/data/td";

export async function generateMetadata({ params }: PageProps<"/td/[course]">) {
  const { course } = await params;
  const c = (await getCatalog()).flatMap((s) => s.courses).find((x) => x.slug === course);
  return { title: c ? `TD — ${c.title}` : "TD" };
}

/** One module's TD, one row per chapter. */
export default async function TdCoursePage({ params }: PageProps<"/td/[course]">) {
  const { course } = await params;
  const info = (await getCatalog()).flatMap((s) => s.courses).find((x) => x.slug === course);
  const chapters = readTdChapters(course);
  if (!info || !chapters.length) notFound();

  return (
    <div className="space-y-8">
      <header className="page-in space-y-4">
        <p className="label border-y border-[var(--rule)] py-2">
          <Link href="/td" className="hover:text-primary">
            TD
          </Link>{" "}
          — {info.title}
        </p>
        <h1 className="font-display text-[clamp(3rem,9vw,7rem)] leading-[0.85]">{info.title}</h1>
      </header>
      <ol className="border-t border-[var(--rule)]">
        {chapters.map((ch) => {
          return (
            <li key={ch.chapter} className="border-b border-[var(--rule)]">
              <Link href={`/td/${course}/${ch.chapter}`} className="group grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 px-2 py-5 transition-colors hover:bg-foreground hover:text-background">
                <span className="font-display text-[2.6rem] leading-none">{String(ch.chapter).padStart(2, "0")}</span>
                <span className="font-display text-[1.6rem] leading-none sm:text-[2rem]">{ch.title}</span>
                <span className="label flex items-center gap-2">
                  {ch.exercises.length} ex.
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
