import { notFound } from "next/navigation";
import { ChapterEditor } from "@/components/admin/content/chapter-editor";
import { PageHeader, PublishedBadge } from "@/components/admin/parts";
import { getChapterAdmin } from "../../../_lib/data";

export default async function ChapterAdminPage({ params }: PageProps<"/admin/contenu/[courseId]/[chapterId]">) {
  const { courseId, chapterId } = await params;
  const { chapter, sections } = await getChapterAdmin(chapterId);
  if (chapter.course_id !== courseId) notFound();
  return (
    <>
      <PageHeader
        back={{ href: `/admin/contenu/${courseId}`, label: chapter.course.title }}
        eyebrow={`Chapitre ${chapter.number}`}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {chapter.title} <PublishedBadge published={chapter.published} />
          </span>
        }
        description={chapter.description ?? undefined}
      />
      <ChapterEditor key={chapter.video_url ?? "none"} chapter={chapter} sections={sections} />
    </>
  );
}
