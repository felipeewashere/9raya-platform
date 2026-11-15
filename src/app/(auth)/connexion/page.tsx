import { Suspense } from "react";
import { SignInPageView } from "@/components/auth/pages";

export const metadata = { title: "Connexion" };

export default function SignInPage() {
  return (
    <Suspense>
      <SignInPageView />
    </Suspense>
  );
}
