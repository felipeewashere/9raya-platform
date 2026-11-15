import { Survey } from "@/components/survey/survey";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { displayName, requireProfile } from "@/lib/auth";

export const metadata = { title: "Bienvenue" };

/** After sign-in: save the answers given before the account step (or ask them now). */
export default async function WelcomePage() {
  const profile = await requireProfile();
  return (
    <>
      <Survey mode="member" name={displayName(profile)} />
      <div className="fixed bottom-4 left-4 z-40 opacity-70 transition-opacity hover:opacity-100">
        <ThemeToggle />
      </div>
    </>
  );
}
