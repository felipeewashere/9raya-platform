import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getCourseOutline } from "@/lib/data/courses";
import { Button } from "@/components/ui/button";
import { LearningPath } from "@/components/course/learning-path";
import { ChapterList } from "@/components/course/chapter-list";
import { DocTitle, NotesPage, SectionTitle, ThinProgress } from "@/components/notes";

export async function generateMetadata({ params }: PageProps<"/cours/[course]">) {
  const { course } = await params;
  const o = await getCourseOutline(course);
  return { title: o?.course.title ?? "Cours" };
}

export default async function CoursePage({ params }: PageProps<"/cours/[course]">) {
  const { course: slug } = await params;
  const outline = await getCourseOutline(slug);
  if (!outline) notFound();
  const { course, chapters, resume } = outline;

  if (course.status !== "published")
    return (
      <NotesPage className="mx-auto max-w-xl py-10">
        <DocTitle title={course.title} subtitleLabel="Remarque :" subtitle="ce module est en préparation. Il sera bientôt disponible." />
        <div className="mt-6 text-center">
          <Button asChild variant="outline">
            <Link href="/cours">Retour aux cours</Link>
          </Button>
        </div>
      </NotesPage>
    );

  const pct = outline.total ? outline.completed / outline.total : 0;

  return (
    <NotesPage className="mx-auto max-w-4xl" footer={{ label: course.title, page: `${outline.completed} / ${outline.total}` }}>
      <nav className="mb-6 text-[0.92rem] text-muted-foreground" aria-label="Fil d'Ariane">
        <Link href="/cours" className="hover:text-foreground hover:underline">
          Cours
        </Link>{" "}
        / <span className="text-foreground">{course.title}</span>
      </nav>

      <DocTitle kicker="Semestre 1" title={course.title} subtitle={course.description ?? undefined}>
        <div className="mx-auto flex max-w-md items-center gap-3 pt-3">
          <ThinProgress value={pct} label="Progression du cours" />
          <span className="shrink-0 font-bold tabular-nums">{Math.round(pct * 100)} %</span>
        </div>
        {resume && (
          <div className="pt-3">
            <Button asChild size="lg" className="h-10 max-w-full px-4 text-[1rem]">
              <Link href={`/cours/${course.slug}/${resume.chapterSlug}/${resume.lessonSlug}`}>
                <span className="truncate">
                  {outline.completed ? "Continuer" : "Commencer"} : {resume.title}
                </span>
                <ArrowRight />
              </Link>
            </Button>
          </div>
        )}
      </DocTitle>


      <section aria-labelledby="parcours" className="mt-10 space-y-3">
        <SectionTitle number={1} id="parcours">
          Ton parcours
        </SectionTitle>
        <LearningPath nodes={chapters.map((c) => ({ slug: c.slug, number: c.number, title: c.title, state: c.state, completed: c.completed, total: c.total }))} />
      </section>

      <section aria-labelledby="chapitres" className="mt-10 space-y-4">
        <SectionTitle number={2} id="chapitres">
          Table des matières
        </SectionTitle>
        {chapters.length ? (
          <ChapterList courseSlug={course.slug} chapters={chapters} />
        ) : (
          <p className="italic text-muted-foreground">Les chapitres de ce cours arrivent bientôt.</p>
        )}
      </section>
    </NotesPage>
  );
}
