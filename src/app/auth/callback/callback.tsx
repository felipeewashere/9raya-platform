"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/client";

/**
 * Landing point for Supabase auth links (Google OAuth, e-mail confirmation, password reset):
 *  - PKCE: ?code=... — exchanged by supabase-js (detectSessionInUrl) with the verifier stored in this browser;
 *  - token-hash e-mail templates: ?token_hash=...&type=...
 * Then continues to ?suivant=.
 */
export function AuthCallback() {
  const router = useRouter();
  const sp = useSearchParams();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const supabase = createClient();
    const next = safeNext(sp.get("suivant"));
    const tokenHash = sp.get("token_hash");
    const type = sp.get("type") as EmailOtpType | null;
    const fail = () => router.replace(`/connexion?erreur=${encodeURIComponent("Lien invalide ou expiré. Réessaie.")}`);

    (async () => {
      if (sp.get("error") || sp.get("error_description")) return fail();
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) return fail();
      }
      // getSession() waits for supabase-js to finish the ?code= exchange started at load
      const { data } = await supabase.auth.getSession();
      if (!data.session) return fail();
      router.replace(type === "recovery" ? "/auth/nouveau-mot-de-passe" : next);
    })();
  }, [router, sp]);

  return (
    <div className="grid min-h-[40dvh] place-items-center" aria-live="polite">
      <p className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Connexion en cours…
      </p>
    </div>
  );
}
