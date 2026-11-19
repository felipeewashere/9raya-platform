"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { safeNext } from "@/lib/actions/auth";
import { hardNavigate } from "@/lib/base-path";
import { createClient } from "@/lib/supabase/client";

/*
 * "Sign in with Google" through Google Identity Services: the popup is opened from this site,
 * so Google shows our domain / app name instead of the Supabase project URL. Google returns an
 * ID token that Supabase turns into a session (signInWithIdToken). Without
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID the old redirect button (`fallback`) is shown instead.
 */

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type CredentialResponse = { credential: string };
type GoogleId = {
  initialize(opts: Record<string, unknown>): void;
  renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let scriptPromise: Promise<void> | undefined;
function loadGsi() {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = undefined;
      reject(new Error("gsi"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function makeNonce() {
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}

export function GoogleSignIn({ next, fallback }: { next?: string; fallback: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    (async () => {
      try {
        await loadGsi();
        const { raw, hashed } = await makeNonce();
        if (cancelled || !box.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashed,
          ux_mode: "popup",
          use_fedcm_for_button: true,
          callback: async ({ credential }: CredentialResponse) => {
            setError(undefined);
            const { error } = await createClient().auth.signInWithIdToken({ provider: "google", token: credential, nonce: raw });
            if (error) {
              console.error(error);
              setError("Connexion Google impossible. Réessaie.");
              return;
            }
            hardNavigate(safeNext(next));
          },
        });
        window.google.accounts.id.renderButton(box.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "center",
          locale: "fr",
          width: Math.min(400, Math.max(200, Math.round(box.current.offsetWidth))),
        });
      } catch {
        if (!cancelled) setBroken(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [next]);

  if (!GOOGLE_CLIENT_ID || broken) return <>{fallback}</>;
  return (
    <div className="grid gap-2">
      <div ref={box} className="flex min-h-11 w-full justify-center" />
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
