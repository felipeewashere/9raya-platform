"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { signInWithGoogle } from "@/lib/actions/auth";
import { completeOnboarding } from "@/lib/actions/profile";
import { cn } from "@/lib/utils";

/*
 * First visit, the gestion du temps way: no landing page. One big question at a time
 * (année → section → groupe), then the account step (guests) or straight to the dashboard (members).
 * Answers are kept in localStorage so they survive the Google / e-mail sign-in round trip.
 */

export type SurveyAnswers = { year?: string; section?: number; group?: string };
const STORE = "9raya.onboarding";

export const YEARS = [
  { v: "AP1", label: "AP1", hint: "1re année prépa", open: true },
  { v: "AP2", label: "AP2", hint: "2e année prépa", open: false },
  { v: "CI1", label: "CI1", hint: "1re année cycle ingénieur", open: false },
  { v: "CI2", label: "CI2", hint: "2e année cycle ingénieur", open: false },
  { v: "CI3", label: "CI3", hint: "3e année cycle ingénieur", open: false },
];
const SIX = ["G1", "G2", "G3", "G4", "G5", "G6"];
export const SECTIONS: Record<number, string[]> = { 1: SIX, 2: SIX };

export function readStoredAnswers(): SurveyAnswers {
  try {
    return JSON.parse(localStorage.getItem(STORE) || "{}") as SurveyAnswers;
  } catch {
    return {};
  }
}
function storeAnswers(a: SurveyAnswers) {
  try {
    localStorage.setItem(STORE, JSON.stringify(a));
  } catch {}
}
export function clearStoredAnswers() {
  try {
    localStorage.removeItem(STORE);
  } catch {}
}
export function isComplete(a: SurveyAnswers): a is Required<SurveyAnswers> {
  return a.year === "AP1" && !!a.section && !!SECTIONS[a.section]?.includes(a.group ?? "");
}

/** A line of text whose words slide up one after another. */
function Words({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  return (
    <span className={className}>
      {text.split(" ").map((w, i) => (
        <Fragment key={i}>
          <span className="sv-w">
            <span style={{ "--i": i, "--d": `${delay}ms` } as CSSProperties}>{w}</span>
          </span>{" "}
        </Fragment>
      ))}
    </span>
  );
}

type Option = { v: string; label: string; hint?: string; locked?: boolean };

function Choice({ options, value, onPick, layout = "row" }: { options: Option[]; value?: string; onPick: (v: string) => void; layout?: "row" | "col" }) {
  // keyboard: 1..9 picks the n-th open option
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!n || e.metaKey || e.ctrlKey || e.altKey) return;
      const o = options[n - 1];
      if (o && !o.locked) onPick(o.v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [options, onPick]);

  return (
    <div className={cn("sv-opts flex", layout === "col" ? "flex-col" : "flex-wrap")} role="radiogroup">
      {options.map((o, i) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          aria-label={o.locked ? `${o.label} (bientôt)` : o.hint ? `${o.label}, ${o.hint}` : o.label}
          disabled={o.locked}
          onClick={() => onPick(o.v)}
          className={cn("sv-opt group", value === o.v && "sv-sel", o.locked && "sv-locked")}
          style={{ "--i": i } as CSSProperties}
        >
          <kbd aria-hidden>{i + 1}</kbd>
          <span className="sv-label">{o.label}</span>
          {o.locked ? (
            <span className="sv-hint">
              <Lock className="size-3.5" aria-hidden /> bientôt
            </span>
          ) : (
            o.hint && <span className="sv-hint">{o.hint}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function GoogleSubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="sv-cta flex w-full items-center justify-center gap-3">
      {pending ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
        </svg>
      )}
      Continuer avec Google
    </button>
  );
}

type Step = "intro" | "year" | "section" | "group" | "account" | "saving";

/**
 * guest  → intro, year, section, group, account (Google / e-mail / login)
 * member → (stored answers? save them right away) else year, section, group, then save → dashboard
 */
export function Survey({ mode, name }: { mode: "guest" | "member"; name?: string }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [step, setStep] = useState<Step>(mode === "guest" ? "intro" : "year");
  const [dir, setDir] = useState(1);
  const [pending, start] = useTransition();
  const saved = useRef(false);

  const steps: Step[] = useMemo(() => (mode === "guest" ? ["year", "section", "group", "account"] : ["year", "section", "group"]), [mode]);
  const index = steps.indexOf(step);

  const save = useCallback(
    (a: Required<SurveyAnswers>) => {
      if (saved.current) return;
      saved.current = true;
      setStep("saving");
      start(async () => {
        let tz = "Africa/Casablanca";
        try {
          tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz;
        } catch {}
        const r = await completeOnboarding({ study_year: a.year, section: a.section, group_code: a.group, timezone: tz });
        if (!r.ok) {
          saved.current = false;
          toast.error(r.error);
          setStep("year");
          return;
        }
        clearStoredAnswers();
        router.replace("/tableau-de-bord");
      });
    },
    [router],
  );

  // restore answers (and for members coming back from sign-in: save them straight away)
  useEffect(() => {
    const stored = readStoredAnswers();
    if (mode === "member" && isComplete(stored)) {
      save(stored);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage after mount
    setAnswers(stored);
  }, [mode, save]);

  const go = useCallback((next: Step, d = 1) => {
    setDir(d);
    setStep(next);
  }, []);

  const pick = useCallback(
    (patch: SurveyAnswers, next: Step | "save") => {
      const a = { ...answers, ...patch };
      if (patch.section && patch.section !== answers.section) a.group = undefined;
      setAnswers(a);
      storeAnswers(a);
      if (next === "save") {
        if (isComplete(a)) save(a);
      } else window.setTimeout(() => go(next), 260);
    },
    [answers, go, save],
  );

  const back = () => {
    if (index > 0) go(steps[index - 1], -1);
    else if (mode === "guest") go("intro", -1);
  };

  // intro: any key or click starts
  useEffect(() => {
    if (step !== "intro") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") go("year");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, go]);

  const progress = index < 0 ? 0 : (index + (step === "account" ? 1 : 0)) / steps.length;

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div aria-hidden className={cn("fixed inset-x-0 top-0 z-40 h-[3px] transition-opacity", step === "intro" ? "opacity-0" : "opacity-100")}>
        <i className="block h-full bg-[linear-gradient(90deg,var(--primary),var(--accent-2))] transition-[width] duration-700" style={{ width: `${Math.max(progress, 0.04) * 100}%` }} />
      </div>

      <div className="grid h-11 grid-cols-[auto_1fr_auto] border-b border-[var(--rule)]">
        <button
          type="button"
          onClick={back}
          className={cn(
            "sv-link flex items-center border-r border-[var(--rule)] px-4",
            (step === "intro" || step === "saving" || (mode === "member" && index === 0)) && "pointer-events-none text-transparent",
          )}
        >
          ← Retour
        </button>
        <span className="label hidden items-center px-4 sm:flex">
          {step === "intro" ? "AP1 · AP2 · CI1 · CI2 · CI3" : `${answers.year ?? "—"} — Section ${answers.section ?? "—"} — ${answers.group ?? "—"}`}
        </span>
        {mode === "guest" && step !== "account" ? (
          <Link href="/connexion" className="label flex items-center bg-foreground px-4 text-background hover:bg-primary hover:text-primary-foreground">
            J&apos;ai déjà un compte
          </Link>
        ) : (
          <span />
        )}
      </div>

      <main id="contenu" className="flex flex-1 items-center justify-center px-5 pb-16" style={{ "--dir": dir } as CSSProperties}>
        {step === "intro" && (
          <button type="button" onClick={() => go("year")} className="sv-q cursor-pointer md:!flex-row md:items-end md:justify-between" aria-label="Commencer">
            <span className="block">
              <span className="sv-intro block">
                <Words text={name ? `Salut ${name}.` : "Salut."} />
              </span>
              <span className="sv-title block text-primary">
                <Words text="On commence ?" delay={350} />
                <span className="sv-cursor" aria-hidden />
              </span>
              <span className="sv-tap block">Clique n&apos;importe où — ou appuie sur Entrée</span>
            </span>
          </button>
        )}

        {step === "year" && (
          <section key="year" className="sv-q">
            <h2 className="sv-title w-full">
              <Words text={mode === "member" && name ? `${name}, tu es en quelle année ?` : "Tu es en quelle année ?"} />
            </h2>
            <Choice
              options={YEARS.map((y) => ({ v: y.v, label: y.label, hint: y.hint, locked: !y.open }))}
              value={answers.year}
              onPick={(v) => pick({ year: v }, "section")}
            />
          </section>
        )}

        {step === "section" && (
          <section key="section" className="sv-q">
            <h2 className="sv-title w-full">
              <Words text="Quelle section ?" />
            </h2>
            <Choice
              options={[
                { v: "1", label: "Section 1" },
                { v: "2", label: "Section 2" },
              ]}
              value={answers.section ? String(answers.section) : undefined}
              onPick={(v) => pick({ section: Number(v) }, "group")}
            />
          </section>
        )}

        {step === "group" && (
          <section key="group" className="sv-q">
            <h2 className="sv-title w-full">
              <Words text="Et ton groupe ?" />
            </h2>
            <Choice
              options={(SECTIONS[answers.section ?? 1] ?? []).map((g) => ({ v: g, label: g }))}
              value={answers.group}
              onPick={(v) => pick({ group: v }, mode === "guest" ? "account" : "save")}
            />
          </section>
        )}

        {step === "account" && (
          <section key="account" className="sv-q">
            <h2 className="sv-title w-full">
              <Words text="Dernière étape : ton compte." />
            </h2>
            <div className="sv-fade grid w-full max-w-xl gap-3">
              <GoogleSignIn
                next="/bienvenue"
                fallback={
                  <form action={signInWithGoogle}>
                    <input type="hidden" name="next" value="/bienvenue" />
                    <GoogleSubmit />
                  </form>
                }
              />
              <Link href="/inscription" className="sv-cta flex items-center justify-center gap-3">
                <Mail className="size-5" aria-hidden /> S&apos;inscrire avec un e-mail
              </Link>
              <Link href="/connexion?suivant=/bienvenue" className="sv-cta-ghost flex items-center justify-center">
                J&apos;ai déjà un compte
              </Link>
            </div>
          </section>
        )}

        {step === "saving" && (
          <section key="saving" className="sv-q" aria-live="polite">
            <h2 className="sv-title w-full">
              <Words text={pending ? "C'est noté. On prépare ton espace…" : "C'est noté."} />
            </h2>
            <Loader2 className="size-7 animate-spin text-primary" aria-hidden />
          </section>
        )}
      </main>

      {index >= 0 && step !== "saving" && (
        <span aria-hidden className="label fixed bottom-5 right-6 text-muted-foreground">
          {String(index + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
        </span>
      )}
    </div>
  );
}
