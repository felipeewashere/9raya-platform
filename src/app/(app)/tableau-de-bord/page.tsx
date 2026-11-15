import { getModuleClips } from "@/lib/content/static";
import { DashboardView } from "./view";

export const metadata = { title: "Tableau de bord" };

/** Courses only. Streak, XP and the calendar live in the header. */
export default function DashboardPage() {
  return <DashboardView clips={getModuleClips()} />;
}
