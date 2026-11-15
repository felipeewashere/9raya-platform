/** The site's sub-path on GitHub Pages ("/9raya-platform"), set in next.config.ts. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Prefixes a root-relative URL ("/figures/…", "/media/…") with the base path.
 * next/link and the router add it themselves; raw <img>, <video>, <a> and fetch() need this.
 */
export function withBase(url: string): string;
export function withBase(url: string | undefined): string | undefined;
export function withBase(url: string | undefined) {
  if (!url || !url.startsWith("/") || url.startsWith("//") || (BASE_PATH && (url === BASE_PATH || url.startsWith(BASE_PATH + "/")))) return url;
  return BASE_PATH + url;
}

/** Absolute URL of a page of this site (for auth e-mail links and OAuth redirects). */
export function siteHref(path: string) {
  return `${window.location.origin}${withBase(path)}`;
}

/** "/cours/x?a=1" → "/9raya-platform/cours/x/?a=1" (pages are folders with trailingSlash). */
export function pageUrl(path: string) {
  const m = /^([^?#]*)(.*)$/.exec(path)!;
  const p = m[1].endsWith("/") ? m[1] : `${m[1]}/`;
  return withBase(p) + m[2];
}

/** Full navigation to a page of the site (used after sign-in / sign-out to start from a clean state). */
export function hardNavigate(path: string) {
  window.location.assign(pageUrl(path));
}
