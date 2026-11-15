import { redirect } from "next/navigation";
import { Survey } from "@/components/survey/survey";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { getProfile } from "@/lib/auth";
import { getUser } from "@/lib/supabase/server";

/** No landing page: visitors answer three questions, then create their account. */
export default async function Home() {
  const user = await getUser();
  if (user) {
    const profile = await getProfile();
    redirect(profile?.onboarded ? "/tableau-de-bord" : "/bienvenue");
  }
  return (
    <>
      <Survey mode="guest" />
      <div className="fixed bottom-4 left-4 z-40 opacity-70 transition-opacity hover:opacity-100">
        <ThemeToggle />
      </div>
    </>
  );
}
