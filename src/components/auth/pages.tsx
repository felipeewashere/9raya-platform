"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NewPasswordForm, SignInForm, SignUpForm } from "./forms";
import { useAuthUser } from "@/components/shell/session";

/** Signed-in students have nothing to do on the sign-in / sign-up pages. */
function useLeaveIfSignedIn() {
  const router = useRouter();
  const user = useAuthUser();
  useEffect(() => {
    if (user) router.replace("/tableau-de-bord");
  }, [user, router]);
}

export function SignInPageView() {
  useLeaveIfSignedIn();
  const sp = useSearchParams();
  return <SignInForm next={sp.get("suivant") ?? undefined} error={sp.get("erreur") ?? undefined} />;
}

export function SignUpPageView() {
  useLeaveIfSignedIn();
  return <SignUpForm />;
}

/** The reset link signs the student in through /auth/callback/ first. */
export function NewPasswordPageView() {
  const router = useRouter();
  const user = useAuthUser();
  useEffect(() => {
    if (user === null) router.replace("/mot-de-passe-oublie");
  }, [user, router]);
  return user ? <NewPasswordForm /> : null;
}
