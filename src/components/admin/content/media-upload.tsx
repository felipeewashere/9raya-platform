"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Loader2, Trash2, Upload, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { createMediaUpload, setMedia } from "@/app/actions/admin-content";

type Target = { kind: "course"; id: string; field: "video_url" | "cover_url" } | { kind: "chapter"; id: string; field: "video_url" };

/**
 * Upload an image or a video to the public `media` bucket and store its public URL.
 * The file goes straight from the browser to storage through a signed upload URL issued
 * by an admin-only server action.
 */
export function MediaUpload({ target, value, label }: { target: Target; value: string | null; label: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "upload" | "remove">(null);
  const isVideo = target.field === "video_url";
  const accept = isVideo ? "video/mp4,video/webm" : "image/png,image/jpeg,image/webp,image/gif";

  async function upload(file: File) {
    setBusy("upload");
    try {
      const signed = await createMediaUpload(target, { name: file.name, type: file.type, size: file.size });
      if (!signed.ok) throw new Error(signed.error);
      const { error } = await createClient().storage.from("media").uploadToSignedUrl(signed.data.path, signed.data.token, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      const saved = await setMedia(target, signed.data.path);
      if (!saved.ok) throw new Error(saved.error);
      toast.success(isVideo ? "Vidéo enregistrée" : "Image enregistrée");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy("remove");
    const r = await setMedia(target, null);
    setBusy(null);
    if (!r.ok) toast.error(r.error);
    else {
      toast.success("Média retiré");
      router.refresh();
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="overflow-hidden rounded-lg border bg-muted/40">
        {value ? (
          isVideo ? (
            <video src={value} controls muted playsInline preload="metadata" className="aspect-video w-full bg-black object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="aspect-video w-full object-cover" />
          )
        ) : (
          <div className="grid aspect-video place-items-center text-muted-foreground">
            <span className="flex flex-col items-center gap-1 text-xs">
              {isVideo ? <Video className="size-6" /> : <ImageIcon className="size-6" />}
              Aucun fichier
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept={accept}
          className="sr-only"
          id={`media-${target.kind}-${target.id}-${target.field}`}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => input.current?.click()}>
          {busy === "upload" ? <Loader2 className="animate-spin" /> : <Upload />}
          {busy === "upload" ? "Envoi…" : value ? "Remplacer" : "Envoyer un fichier"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={remove}>
            {busy === "remove" ? <Loader2 className="animate-spin" /> : <Trash2 />} Retirer
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{isVideo ? "MP4 ou WebM, 200 Mo max." : "PNG, JPEG, WebP ou GIF."}</p>
    </div>
  );
}
