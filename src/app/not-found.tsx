import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FooterBand, NoteLabel, Watermark } from "@/components/notes";

export default function NotFound() {
  return (
    <div className="relative isolate flex min-h-dvh flex-col px-5 pb-5">
      <Watermark className="absolute right-[-10%] top-[14%] -z-10 w-[min(90vw,620px)]" />
      <div className="my-auto max-w-md space-y-4 self-center py-10 text-center">
        <p className="text-[6rem] font-bold leading-none text-primary">404</p>
        <h1 className="text-[1.8rem] font-bold text-primary smallcaps">Page introuvable</h1>
        <p>
          <NoteLabel tone="red">Remarque :</NoteLabel> cette page n&apos;existe pas ou n&apos;est pas encore publiée.
        </p>
        <div className="flex justify-center gap-2">
          <Button asChild>
            <Link href="/tableau-de-bord">Tableau de bord</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/cours">Cours</Link>
          </Button>
        </div>
      </div>
      <FooterBand label="9raya" page="404" />
    </div>
  );
}
