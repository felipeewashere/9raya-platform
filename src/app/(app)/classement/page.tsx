import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/skeletons";
import { LeaderboardView } from "./view";

export const metadata = { title: "Classement" };

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LeaderboardView />
    </Suspense>
  );
}
