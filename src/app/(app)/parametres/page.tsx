import { requireProfile } from "@/lib/auth";
import { getUser } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";
import { DocTitle, NotesPage } from "@/components/notes";

export const metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const profile = await requireProfile();
  const user = await getUser();
  return (
    <NotesPage className="mx-auto max-w-3xl space-y-8" footer={{ label: "Paramètres" }}>
      <DocTitle title="Paramètres" />
      <SettingsForm
        profile={{
          username: profile.username,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          timezone: profile.timezone,
          daily_goal_xp: profile.daily_goal_xp,
          email: user?.email ?? "",
          provider: (user?.app_metadata?.provider as string) ?? "email",
        }}
      />
    </NotesPage>
  );
}
