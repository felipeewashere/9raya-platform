import { CourseEditor } from "@/components/admin/content/course-editor";
import { PageHeader, StatusBadge } from "@/components/admin/parts";
import { getCourseAdmin } from "../../_lib/data";

export default async function CourseAdminPage({ params }: PageProps<"/admin/contenu/[courseId]">) {
  const { courseId } = await params;
  const { course, semesters, chapters } = await getCourseAdmin(courseId);
  return (
    <>
      <PageHeader
        back={{ href: "/admin/contenu", label: "Contenu" }}
        eyebrow="Cours"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {course.title} <StatusBadge status={course.status} />
          </span>
        }
        description={course.description ?? undefined}
      />
      {/* remount when media change on the server so the form never overwrites a fresh URL */}
      <CourseEditor key={`${course.video_url}|${course.cover_url}`} course={course} semesters={semesters} chapters={chapters} />
    </>
  );
}
