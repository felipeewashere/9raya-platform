import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Logo } from "@/components/shell/logo";

export const metadata = { title: "Configuration requise" };

/** Shown instead of the app while the Supabase environment variables are missing. */
export default function ConfigurationPage() {
  if (isSupabaseConfigured) redirect("/");
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-16">
      <Logo />
      <h1 className="text-3xl font-bold">Configuration requise</h1>
      <p className="text-muted-foreground">
        L&apos;application a besoin d&apos;un projet Supabase (base de données, authentification et stockage). Les variables d&apos;environnement ne sont pas encore définies.
      </p>
      <ol className="list-decimal space-y-3 pl-5">
        <li>
          Crée un projet gratuit sur <a className="font-medium text-primary underline" href="https://supabase.com/dashboard">supabase.com</a>.
        </li>
        <li>
          Copie <code className="rounded bg-muted px-1.5">.env.example</code> en <code className="rounded bg-muted px-1.5">.env.local</code> et remplis l&apos;URL du projet, la clé « anon » et la clé « service_role » (Paramètres → API).
        </li>
        <li>
          Applique les migrations du dossier <code className="rounded bg-muted px-1.5">supabase/migrations</code>, puis importe le contenu : <code className="rounded bg-muted px-1.5">npm run content:import</code>.
        </li>
        <li>Redémarre le serveur de développement.</li>
      </ol>
      <p className="text-sm text-muted-foreground">Le README détaille chaque étape, y compris la connexion Google.</p>
    </div>
  );
}
