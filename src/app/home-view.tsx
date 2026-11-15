"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Survey } from "@/components/survey/survey";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { useAuthUser } from "@/components/shell/session";
import { getProfile, isOnboarded } from "@/lib/auth";

/** Signed-in students go to their dashboard (or the first-visit questions); visitors get the survey. */
export function HomeView() {
  const router = useRouter();
  const user = useAuthUser();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    getProfile(user.id)
      .then((p) => {
        if (!alive) return;
        setRedirecting(true);
        router.replace(isOnboarded(p) ? "/tableau-de-bord" : "/bienvenue");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, router]);

  if (user === undefined || user || redirecting) return null;
  return (
    <>
      <Survey mode="guest" />
      <div className="fixed bottom-4 left-4 z-40 opacity-70 transition-opacity hover:opacity-100">
        <ThemeToggle />
      </div>
    </>
  );
}
