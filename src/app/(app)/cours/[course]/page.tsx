import { courseParams, courseTitle } from "@/lib/content/static";
import { CourseView } from "./view";

export const generateStaticParams = courseParams;

export async function generateMetadata({ params }: PageProps<"/cours/[course]">) {
  const { course } = await params;
  return { title: (await courseTitle(course)) ?? "Cours" };
}

export default async function CoursePage({ params }: PageProps<"/cours/[course]">) {
  const { course } = await params;
  return <CourseView slug={course} />;
}
