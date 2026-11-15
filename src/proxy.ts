import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/", "/connexion", "/inscription", "/mot-de-passe-oublie", "/auth", "/hors-ligne"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || (p !== "/" && pathname.startsWith(p + "/")));
}

/**
 * Refreshes the Supabase session cookie on every request and sends signed-out
 * visitors of private pages to the sign-in page. This is an optimistic check only:
 * every page and server action verifies the user again on the server.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Not configured yet: show the setup page instead of crashing.
    if (request.nextUrl.pathname !== "/configuration") {
      return NextResponse.redirect(new URL("/configuration", request.url));
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  // Do not run code between createServerClient and getClaims: it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  if (!signedIn && !isPublic(pathname) && pathname !== "/configuration") {
    const to = new URL("/connexion", request.url);
    to.searchParams.set("suivant", pathname + search);
    const redirect = NextResponse.redirect(to);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }

  if (signedIn && (pathname === "/connexion" || pathname === "/inscription")) {
    const redirect = NextResponse.redirect(new URL("/tableau-de-bord", request.url));
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // everything except static files, images and the PWA files
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|media/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|woff2?)$).*)",
  ],
};
