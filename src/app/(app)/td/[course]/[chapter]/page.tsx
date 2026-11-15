import Link from "next/link";
import { notFound } from "next/navigation";
import { courseTitle, publicExercise, readTdChapters, tdCourses } from "@/lib/content/static";
import { TdExercise } from "@/components/td/td-exercise";

export function generateStaticParams() {
  return tdCourses().flatMap((course) => readTdChapters(course).map((c) => ({ course, chapter: String(c.chapter) })));
}

export async function generateMetadata({ params }: PageProps<"/td/[course]/[chapter]">) {
  const { course, chapter } = await params;
  const title = await courseTitle(course);
  const ch = readTdChapters(course).find((c) => String(c.chapter) === chapter);
  return { title: ch ? `TD ${ch.chapter} — ${title ?? ""}` : title ? `TD — ${title}` : "TD" };
}

/** All exercises of one TD sheet. */
export default async function TdChapterPage({ params }: PageProps<"/td/[course]/[chapter]">) {
  const { course, chapter } = await params;
  const title = await courseTitle(course);
  const info = title ? { title } : null;
  const ch = readTdChapters(course).find((c) => String(c.chapter) === chapter);
  if (!info || !ch) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="page-in space-y-4">
        <p className="label border-y border-[var(--rule)] py-2">
          <Link href="/td" className="hover:text-primary">
            TD
          </Link>{" "}
          —{" "}
          <Link href={`/td/${course}`} className="hover:text-primary">
            {info.title}
          </Link>
        </p>
        <h1 className="font-display text-[clamp(2.6rem,7vw,5rem)] leading-[0.88]">Travaux dirigés n°{ch.chapter}</h1>
        <p className="text-[1.1rem] text-muted-foreground">{ch.title}</p>
      </header>
      <div className="space-y-6">
        {ch.exercises.map((e) => (
          <TdExercise key={e.number} ex={publicExercise(e)} />
        ))}
      </div>
    </div>
  );
}
