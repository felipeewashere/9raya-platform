"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getProfile, isOnboarded, type Profile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/lib/use-data";

type Session = { user: User; profile: Profile };

const SessionContext = createContext<Session | null>(null);

/** The signed-in student and their profile (inside <RequireSession>). */
export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession() outside <RequireSession>");
  return s;
}

/** The current session user, or null when signed out (undefined while loading). */
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    supabase.auth.getSession().then(({ data }) => alive && setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => alive && setUser(session?.user ?? null));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return user;
}

/**
 * Client-side guard (the static site has no server): signed-out visitors go to /connexion,
 * students who have not answered the first-visit questions go to /bienvenue.
 * The real protection is RLS + the Edge Function, which check the token on every request.
 */
export function RequireSession({ children, fallback = null, onboarded = true }: { children: React.ReactNode; fallback?: React.ReactNode; onboarded?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthUser();
  const { data: profile, error } = useData(user ? `profile:${user.id}` : null, () => getProfile(user!.id));

  const signedOut = user === null || (user && error === null && profile === null);
  const needsOnboarding = onboarded && !!profile && !isOnboarded(profile);

  useEffect(() => {
    if (signedOut) {
      const here = pathname + window.location.search;
      router.replace(`/connexion?suivant=${encodeURIComponent(here)}`);
    } else if (needsOnboarding) router.replace("/bienvenue");
  }, [signedOut, needsOnboarding, pathname, router]);

  if (error && !profile)
    return (
      <p role="alert" className="py-16 text-center italic text-muted-foreground">
        Impossible de charger ton compte. Vérifie ta connexion puis recharge la page.
      </p>
    );
  if (!user || !profile || needsOnboarding) return <>{fallback}</>;
  return <SessionContext.Provider value={{ user, profile }}>{children}</SessionContext.Provider>;
}
