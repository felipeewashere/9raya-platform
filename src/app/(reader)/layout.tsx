import { RequireSession } from "@/components/shell/session";
import { LessonSkeleton } from "@/components/shell/skeletons";

export default function ReaderLayout({ children }: LayoutProps<"/">) {
  return <RequireSession fallback={<LessonSkeleton />}>{children}</RequireSession>;
}
