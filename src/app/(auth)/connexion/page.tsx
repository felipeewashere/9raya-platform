import { SignInForm } from "@/components/auth/forms";

export const metadata = { title: "Connexion" };

export default async function SignInPage({ searchParams }: PageProps<"/connexion">) {
  const sp = await searchParams;
  const next = typeof sp.suivant === "string" ? sp.suivant : undefined;
  const error = typeof sp.erreur === "string" ? sp.erreur : undefined;
  return <SignInForm next={next} error={error} />;
}
