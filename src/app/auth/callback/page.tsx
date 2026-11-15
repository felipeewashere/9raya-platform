import { Suspense } from "react";
import { AuthCallback } from "./callback";

export const metadata = { title: "Connexion" };

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <AuthCallback />
    </Suspense>
  );
}
