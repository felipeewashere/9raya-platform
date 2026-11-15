import { DocTitle, NotesPage } from "@/components/notes";
import { SettingsView } from "./settings-form";

export const metadata = { title: "Paramètres" };

export default function SettingsPage() {
  return (
    <NotesPage className="mx-auto max-w-3xl space-y-8" footer={{ label: "Paramètres" }}>
      <DocTitle title="Paramètres" />
      <SettingsView />
    </NotesPage>
  );
}
