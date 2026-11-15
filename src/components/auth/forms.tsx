"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, signIn, signInWithGoogle, signUp, updatePassword, type FormState } from "@/lib/actions/auth";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="h-11 w-full text-base">
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

function Alert({ state }: { state: FormState }) {
  return (
    <AnimatePresence mode="wait">
      {state?.error && (
        <motion.p key="e" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
        </motion.p>
      )}
      {state?.message && (
        <motion.p key="m" role="status" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-2 rounded-md border border-success/40 bg-success-soft px-3 py-2 text-sm text-success">
          <MailCheck className="mt-0.5 size-4 shrink-0" /> {state.message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function PasswordInput({ name, autoComplete, label = "Mot de passe" }: { name: string; autoComplete: string; label?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <div className="relative">
        <Input id={name} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required className="h-11 pr-10" />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground" aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function GoogleButton({ next }: { next?: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next ?? ""} />
      <GoogleSubmit />
    </form>
  );
}

function GoogleSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="lg" disabled={pending} className="h-11 w-full gap-3 text-base">
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
        </svg>
      )}
      Continuer avec Google
    </Button>
  );
}

function Divider() {
  return (
    <div className="relative my-5 text-center text-xs text-muted-foreground">
      <span className="absolute inset-x-0 top-1/2 border-t" />
      <span className="relative bg-background px-3 italic">ou avec ton e-mail</span>
    </div>
  );
}

export function SignInForm({ next, error }: { next?: string; error?: string }) {
  const [state, action] = useActionState(signIn, error ? { error } : undefined);
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="sv-title !text-[3.2rem]">Content de te revoir</h1>
        <p className="text-muted-foreground">Connecte-toi pour reprendre là où tu t&apos;étais arrêté(e).</p>
      </div>
      <div>
        <GoogleButton next={next} />
        <Divider />
        <form action={action} className="space-y-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} className="h-11" />
          </div>
          <PasswordInput name="password" autoComplete="current-password" />
          <div className="text-right">
            <Link href="/mot-de-passe-oublie" className="text-sm font-medium text-primary hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>
          <Alert state={state} />
          <Submit>Se connecter</Submit>
        </form>
      </div>
      <p className="text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-semibold text-primary hover:underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUp, undefined);
  if (state?.message)
    return (
      <div className="space-y-4 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-md border border-success/40 bg-success-soft text-success">
          <MailCheck className="size-7" />
        </span>
        <h1 className="sv-title !text-[3.2rem]">Vérifie ta boîte mail</h1>
        <p className="text-muted-foreground">{state.message}</p>
        <Link href="/connexion" className="text-sm font-semibold text-primary hover:underline">
          Retour à la connexion
        </Link>
      </div>
    );
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="sv-title !text-[3.2rem]">Crée ton compte</h1>
        <p className="text-muted-foreground">Gratuit. Ta progression est enregistrée sur tous tes appareils.</p>
      </div>
      <div>
        <GoogleButton next="/bienvenue" />
        <Divider />
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Prénom et nom</Label>
            <Input id="full_name" name="full_name" autoComplete="name" required defaultValue={state?.fields?.full_name} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} className="h-11" />
          </div>
          <PasswordInput name="password" autoComplete="new-password" />
          <p className="text-xs text-muted-foreground">8 caractères minimum.</p>
          <Alert state={state} />
          <Submit>Créer mon compte</Submit>
        </form>
      </div>
      <p className="text-sm text-muted-foreground">
        Déjà inscrit(e) ?{" "}
        <Link href="/connexion" className="font-semibold text-primary hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, undefined);
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="sv-title !text-[3.2rem]">Mot de passe oublié</h1>
        <p className="text-muted-foreground">Entre ton e-mail : tu recevras un lien pour en choisir un nouveau.</p>
      </div>
      <form action={action} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
        </div>
        <Alert state={state} />
        <Submit>Envoyer le lien</Submit>
      </form>
      <p className="text-center text-sm">
        <Link href="/connexion" className="font-semibold text-primary hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, undefined);
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="sv-title !text-[3.2rem]">Nouveau mot de passe</h1>
        <p className="text-muted-foreground">Choisis un mot de passe d&apos;au moins 8 caractères.</p>
      </div>
      <form action={action} className="space-y-4">
        <PasswordInput name="password" autoComplete="new-password" label="Nouveau mot de passe" />
        <PasswordInput name="confirm" autoComplete="new-password" label="Confirme le mot de passe" />
        <Alert state={state} />
        <Submit>Enregistrer</Submit>
      </form>
    </div>
  );
}
