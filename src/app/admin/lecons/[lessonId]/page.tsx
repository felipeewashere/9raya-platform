import { LessonEditor } from "@/components/admin/lesson/lesson-editor";
import { PageHeader, PublishedBadge } from "@/components/admin/parts";
import { getLessonForEditor } from "../../_lib/data";

export const metadata = { title: "Éditeur de leçon" };

export default async function LessonEditorPage({ params }: PageProps<"/admin/lecons/[lessonId]">) {
  const { lessonId } = await params;
  const { meta, lesson, warnings } = await getLessonForEditor(lessonId);
  const ch = meta.chapter;
  return (
    <>
      <PageHeader
        back={{ href: `/admin/contenu/${ch.course.id}/${ch.id}`, label: `${ch.course.title} · chapitre ${ch.number}` }}
        eyebrow="Éditeur de leçon"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {meta.title} <PublishedBadge published={meta.published} />
          </span>
        }
      />
      <LessonEditor
        key={lessonId}
        lessonId={lessonId}
        initial={lesson}
        warnings={warnings}
        published={meta.published}
        chapter={{ slug: ch.slug, number: ch.number }}
        previewHref={`/cours/${ch.course.slug}/${ch.slug}/${meta.slug}`}
      />
    </>
  );
}
