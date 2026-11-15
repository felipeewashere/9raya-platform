import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for Supabase auth links:
 *  - OAuth (Google) and PKCE email links: ?code=...
 *  - token-hash email links (confirmation, recovery): ?token_hash=...&type=...
 * Exchanges them for a session cookie and continues to ?suivant=.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const nextParam = url.searchParams.get("suivant") ?? "/tableau-de-bord";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/tableau-de-bord";
  const supabase = await createClient();

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }

  if (!ok) {
    const desc = url.searchParams.get("error_description");
    return NextResponse.redirect(new URL(`/connexion?erreur=${encodeURIComponent(desc ? "Lien invalide ou expiré." : "Lien invalide ou expiré. Réessaie.")}`, url.origin));
  }
  const dest = type === "recovery" ? "/auth/nouveau-mot-de-passe" : next;
  return NextResponse.redirect(new URL(dest, url.origin));
}
