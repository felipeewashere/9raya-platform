import { buildSearchIndex } from "@/lib/content/static";

export const dynamic = "force-static";

/** Search palette index (public course / chapter / lesson titles), written to out/search-index.json. */
export async function GET() {
  return Response.json(await buildSearchIndex());
}
