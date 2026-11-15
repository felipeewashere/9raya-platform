import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";

/** Download a course resource: checks access with the student's own session, then redirects to a short-lived signed URL. */
export async function GET(_req: Request, ctx: RouteContext<"/api/ressources/[id]">) {
  const { id } = await ctx.params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const supabase = await createClient();
  const { data: res } = await supabase.from("resources").select("storage_path, title").eq("id", id).maybeSingle();
  if (!res) return NextResponse.json({ error: "Ressource introuvable." }, { status: 404 });
  const { data, error } = await supabase.storage.from("resources").createSignedUrl(res.storage_path, 60, { download: res.title.endsWith(".pdf") ? res.title : `${res.title}.pdf` });
  if (error || !data) return NextResponse.json({ error: "Téléchargement indisponible." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
