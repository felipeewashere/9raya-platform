"use client";

import { Survey } from "@/components/survey/survey";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { RequireSession, useSession } from "@/components/shell/session";
import { displayName } from "@/lib/auth";

export function WelcomeView() {
  return (
    <RequireSession onboarded={false}>
      <Welcome />
    </RequireSession>
  );
}

function Welcome() {
  const { profile } = useSession();
  return (
    <>
      <Survey mode="member" name={displayName(profile)} />
      <div className="fixed bottom-4 left-4 z-40 opacity-70 transition-opacity hover:opacity-100">
        <ThemeToggle />
      </div>
    </>
  );
}
