"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Camera, Loader2, Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { deleteAccount, updateProfile, uploadAvatar } from "@/app/actions/profile";
import { initials } from "@/components/shell/app-header";
import { cn } from "@/lib/utils";
import { SectionTitle } from "@/components/notes";

const COMMON_TZ = ["Africa/Casablanca", "Europe/Paris", "Europe/Madrid", "Europe/Brussels", "Africa/Algiers", "Africa/Tunis", "America/Montreal", "UTC"];

export function SettingsForm({
  profile,
}: {
  profile: { username: string | null; full_name: string | null; avatar_url: string | null; timezone: string; daily_goal_xp: number; email: string; provider: string };
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [username, setUsername] = useState(profile.username ?? "");
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [timezone, setTimezone] = useState(profile.timezone);
  const [goal, setGoal] = useState(String(profile.daily_goal_xp));
  const [avatar, setAvatar] = useState(profile.avatar_url);
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const timezones = COMMON_TZ.includes(timezone) ? COMMON_TZ : [timezone, ...COMMON_TZ];

  const save = () =>
    start(async () => {
      const r = await updateProfile({ username, full_name: fullName, timezone, daily_goal_xp: Number(goal) });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Profil enregistré");
      router.refresh();
    });

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    const fd = new FormData();
    fd.set("file", f);
    const r = await uploadAvatar(fd);
    setUploading(false);
    if (!r.ok) return void toast.error(r.error);
    setAvatar(r.data.url);
    toast.success("Photo mise à jour");
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <section className="space-y-5">
        <SectionTitle number={1}>Profil</SectionTitle>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="size-20 border-2">
              {avatar && <AvatarImage src={avatar} alt="" />}
              <AvatarFallback className="bg-brand-soft text-2xl font-bold text-primary">{initials(fullName || username || "?")}</AvatarFallback>
            </Avatar>
            {uploading && (
              <span className="absolute inset-0 grid place-items-center rounded-full bg-background/70">
                <Loader2 className="size-5 animate-spin" />
              </span>
            )}
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-md">
              <Camera /> Changer la photo
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG ou WebP · 2 Mo max.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Prénom et nom</Label>
            <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} className="rounded-md" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="username">Nom d&apos;utilisateur</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-muted-foreground">@</span>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={24} className="rounded-md pl-7" />
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>E-mail</Label>
          <p className="text-sm text-muted-foreground">
            {profile.email} · connexion {profile.provider === "google" ? "Google" : "e-mail et mot de passe"}
          </p>
        </div>
      </section>

      <section className="space-y-5 border-t border-primary/20 pt-8">
        <SectionTitle number={2}>Apprentissage</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Objectif quotidien</Label>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger className="w-full rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[20, 30, 40, 60, 80, 120].map((g) => (
                  <SelectItem key={g} value={String(g)}>
                    {g} XP par jour
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Fuseau horaire (pour les séries)</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="w-full rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Apparence</Label>
          <div className="flex gap-2">
            {[
              { v: "light", label: "Clair", icon: Sun },
              { v: "dark", label: "Sombre", icon: Moon },
              { v: "system", label: "Système", icon: Monitor },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setTheme(o.v)}
                aria-pressed={theme === o.v}
                className={cn("flex items-center gap-2 rounded-md border-2 px-3 py-2 text-sm", theme === o.v ? "border-primary bg-brand-soft" : "hover:bg-muted")}
              >
                <o.icon className="size-4" /> {o.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button size="lg" onClick={save} disabled={pending} className="rounded-md">
          {pending && <Loader2 className="animate-spin" />} Enregistrer
        </Button>
      </div>

      <section className="space-y-3 overflow-hidden rounded-md border-[1.5px] border-danger bg-danger-soft">
        <h2 className="bg-danger px-4 py-1.5 font-bold text-white smallcaps dark:text-[#1a0d0e]">Zone sensible</h2>
        <div className="space-y-3 px-4 pb-4">
        <p className="text-sm">Supprimer ton compte efface définitivement ta progression, tes notes et tes succès.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="rounded-md">
              Supprimer mon compte
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer définitivement ton compte ?</AlertDialogTitle>
              <AlertDialogDescription>Cette action est irréversible. Tape SUPPRIMER pour confirmer.</AlertDialogDescription>
            </AlertDialogHeader>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="SUPPRIMER" className="rounded-md" />
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={confirm !== "SUPPRIMER" || pending}
                onClick={() =>
                  start(async () => {
                    const r = await deleteAccount(confirm);
                    if (!r.ok) return void toast.error(r.error);
                    router.push("/");
                  })
                }
              >
                Supprimer
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </section>
    </div>
  );
}
