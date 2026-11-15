// Serves out/ like GitHub Pages: under /9raya-platform/, folders → index.html, 404.html otherwise.
//   npm run build && npm run serve:out   → http://localhost:3000/9raya-platform/
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const BASE = process.env.PAGES_BASE_PATH ?? "/9raya-platform";
const PORT = Number(process.env.PORT ?? 3000);
const ROOT = join(process.cwd(), "out");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".mp4": "video/mp4", ".webm": "video/webm", ".webmanifest": "application/manifest+json",
};

function send(res, file, status = 200) {
  res.writeHead(status, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let path = decodeURIComponent(url.pathname);
  if (path === "/" || path === BASE) return res.writeHead(301, { Location: `${BASE}/` }).end();
  if (!path.startsWith(`${BASE}/`)) return res.writeHead(404).end("Not found");
  path = normalize(path.slice(BASE.length)).replace(/^[\\/]+/, "");
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!url.pathname.endsWith("/")) return res.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end();
    if (existsSync(join(file, "index.html"))) return send(res, join(file, "index.html"));
  } else if (existsSync(file)) return send(res, file);
  // Builds made on Windows write the RSC segment files (__next.a.b.__PAGE__.txt) as nested folders
  // (__next.a/b/__PAGE__.txt): Next joins the segment path with "\". Linux builds (CI) are flat.
  const seg = /^(.*[\\/])?__next\.([^/\\]+)\.txt$/.exec(file);
  if (seg) {
    const [first, ...rest] = seg[2].split(".");
    const nested = join(seg[1] ?? "", `__next.${first}`, ...rest.slice(0, -1), `${rest.at(-1)}.txt`);
    if (rest.length && existsSync(nested)) return send(res, nested);
  }
  send(res, join(ROOT, "404.html"), 404);
}).listen(PORT, () => console.log(`out/ served at http://localhost:${PORT}${BASE}/`));
