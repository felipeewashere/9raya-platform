"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Dices, Lightbulb, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tex } from "@/components/math/md";
import { cn } from "@/lib/utils";
import { compileLaw, domainTex, inDomain, nearlyEqual, sampleValues, type Domain } from "./lib/law";
import { texExact } from "./lib/format";
import { Feedback, NumberField, NumberSlider, Verdict, WidgetFrame } from "./shared";

export type LawExplorerProps = {
  expr: string;
  latex: string;
  domain: Domain;
  neutral?: number | null;
};

const domainName: Record<Domain, string> = { N: "ℕ", Z: "ℤ", Q: "ℚ", R: "ℝ" };

export function LawExplorer({ expr, latex, domain, neutral }: LawExplorerProps) {
  const law = React.useMemo(() => {
    try {
      return compileLaw(expr);
    } catch {
      return null;
    }
  }, [expr]);

  const integer = domain === "N" || domain === "Z";
  const min = domain === "N" ? 0 : -10;
  const step = integer ? 1 : 0.5;
  const uid = React.useId();
  const [x, setX] = React.useState(2);
  const [y, setY] = React.useState(5);
  const [z, setZ] = React.useState(3);
  const fix = (v: number) => (domain === "N" ? Math.max(0, Math.round(v)) : integer ? Math.round(v) : v);

  if (!law) {
    return (
      <WidgetFrame label="Explorateur de loi">
        <Feedback tone="danger">Expression de la loi invalide : {expr}</Feedback>
      </WidgetFrame>
    );
  }

  const op = (a: number, b: number) => law(a, b);
  const t = (v: number) =>
    Number.isNaN(v) ? "\\text{indéfini}" : integer && Number.isInteger(v) ? String(v) : texExact(v, true);
  const p = (v: number) => (v < 0 ? `(${t(v)})` : t(v));

  const xy = op(x, y);
  const yx = op(y, x);
  const left = op(xy, z);
  const yz = op(y, z);
  const right = op(x, yz);
  const commOk = nearlyEqual(xy, yx);
  const assocOk = nearlyEqual(left, right);
  const outside = Number.isFinite(xy) && !inDomain(xy, domain);

  const randomTriple = () => {
    const r = () => {
      if (domain === "N") return Math.floor(Math.random() * 10);
      if (domain === "Z") return Math.floor(Math.random() * 19) - 9;
      return (Math.floor(Math.random() * 21) - 10) / 2;
    };
    setX(r());
    setY(r());
    setZ(r());
  };

  return (
    <WidgetFrame label="Explorateur de loi de composition">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0 overflow-x-auto">
          <Tex>{latex}</Tex>
        </div>
        <span className="text-sm text-muted-foreground">
          sur <Tex>{domainTex[domain]}</Tex>
        </span>
      </div>

      <fieldset className="space-y-1.5 rounded-lg border border-border p-2.5">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          Valeurs dans {domainName[domain]}
          {integer ? "" : " (vous pouvez taper n'importe quel décimal ou une fraction)"}
        </legend>
        {(
          [
            ["x", x, setX],
            ["y", y, setY],
            ["z", z, setZ],
          ] as const
        ).map(([name, val, set]) => (
          <NumberSlider
            key={name}
            id={`${uid}-${name}`}
            texLabel={name}
            ariaLabel={`Valeur de ${name}`}
            value={val}
            onChange={(v) => set(fix(v))}
            min={min}
            max={10}
            step={step}
            integer={integer}
          />
        ))}
        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={randomTriple}>
            <Dices aria-hidden /> Triplet au hasard
          </Button>
        </div>
      </fieldset>

      <motion.div layout className="rounded-lg bg-muted px-3 py-2 text-center" aria-live="polite">
        <Tex>{`x \\star y = ${p(x)} \\star ${p(y)} = ${t(xy)}`}</Tex>
        {outside && (
          <p className="mt-1 text-sm text-danger">
            <Tex>{`${t(xy)} \\notin ${domainTex[domain]}`}</Tex> : la loi n&apos;est pas interne sur {domainName[domain]}.
          </p>
        )}
      </motion.div>

      <div className="grid gap-2 @md:grid-cols-2">
        <CompareCard
          title="Commutativité"
          ok={commOk}
          lines={[`x \\star y = ${t(xy)}`, `y \\star x = ${p(y)} \\star ${p(x)} = ${t(yx)}`]}
          verdictTex={commOk ? "x \\star y = y \\star x" : "x \\star y \\neq y \\star x"}
          koHint="Un seul contre-exemple suffit : la loi n'est pas commutative."
        />
        <CompareCard
          title="Associativité"
          ok={assocOk}
          lines={[
            `(x \\star y) \\star z = ${p(xy)} \\star ${p(z)} = ${t(left)}`,
            `x \\star (y \\star z) = ${p(x)} \\star ${p(yz)} = ${t(right)}`,
          ]}
          verdictTex={
            assocOk ? "(x \\star y) \\star z = x \\star (y \\star z)" : "(x \\star y) \\star z \\neq x \\star (y \\star z)"
          }
          koHint="Ce triplet est un contre-exemple : la loi n'est pas associative."
        />
      </div>

      <NeutralSearch op={op} domain={domain} neutral={neutral} t={t} p={p} />
    </WidgetFrame>
  );
}

function CompareCard({
  title,
  ok,
  lines,
  verdictTex,
  koHint,
}: {
  title: string;
  ok: boolean;
  lines: string[];
  verdictTex: string;
  koHint: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 space-y-1 rounded-lg border p-2.5 transition-colors duration-300",
        ok ? "border-success/30 bg-success-soft" : "border-danger/30 bg-danger-soft",
      )}
    >
      <div className="flex items-center justify-between text-sm font-medium">
        <span>{title}</span>
        <Verdict ok={ok} okLabel="égalité vérifiée" koLabel="égalité fausse" />
      </div>
      <div className="space-y-0.5 overflow-x-auto text-sm">
        {lines.map((l) => (
          <div key={l}>
            <Tex>{l}</Tex>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto pt-0.5 text-sm">
        <Tex>{verdictTex}</Tex>
      </div>
      {!ok && <p className="text-xs text-muted-foreground">{koHint}</p>}
      {ok && <p className="text-xs text-muted-foreground">Vrai pour ces valeurs ; essayez-en d&apos;autres avant de conclure.</p>}
    </div>
  );
}

function NeutralSearch({
  op,
  domain,
  neutral,
  t,
  p,
}: {
  op: (a: number, b: number) => number;
  domain: Domain;
  neutral?: number | null;
  t: (v: number) => string;
  p: (v: number) => string;
}) {
  const [open, setOpen] = React.useState(false);
  const [candidate, setCandidate] = React.useState(1);
  const [tested, setTested] = React.useState<number | null>(null);
  const [hint, setHint] = React.useState(false);
  const xs = sampleValues(domain);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Search aria-hidden /> Chercher un neutre
      </Button>
    );
  }

  const rows =
    tested === null
      ? []
      : xs.map((v) => {
          const l = op(tested, v);
          const r = op(v, tested);
          return { v, l, r, lok: nearlyEqual(l, v), rok: nearlyEqual(r, v) };
        });
  const allL = rows.every((r) => r.lok);
  const allR = rows.every((r) => r.rok);

  return (
    <div className="space-y-2 rounded-lg border border-border p-2.5">
      <p className="text-sm">
        Proposez un élément <Tex>e</Tex> : on teste <Tex>{"e \\star x = x"}</Tex> et <Tex>{"x \\star e = x"}</Tex> sur plusieurs
        valeurs de <Tex>x</Tex>.
      </p>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(ev) => {
          ev.preventDefault();
          setTested(candidate);
        }}
      >
        <span className="text-sm" aria-hidden>
          <Tex>e =</Tex>
        </span>
        <NumberField value={candidate} onChange={setCandidate} ariaLabel="Candidat pour l'élément neutre e" className="w-20" />
        <Button type="submit" size="sm">
          Tester
        </Button>
        {neutral !== undefined && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setHint((h) => !h)} aria-expanded={hint}>
            <Lightbulb aria-hidden /> Indice
          </Button>
        )}
      </form>
      {hint && neutral !== undefined && (
        <Feedback tone="highlight">
          {neutral === null ? (
            <>
              Cette loi n&apos;a pas d&apos;élément neutre : aucun candidat ne marche pour tous les <Tex>x</Tex>.
            </>
          ) : (
            <>
              L&apos;élément neutre est <Tex>{`e = ${t(neutral)}`}</Tex>. Vérifiez-le ci-dessus, puis prouvez-le pour tout{" "}
              <Tex>x</Tex>.
            </>
          )}
        </Feedback>
      )}
      {tested !== null && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[18rem] border-collapse text-sm">
              <caption className="sr-only">Tests du candidat e = {tested}</caption>
              <thead>
                <tr className="text-muted-foreground">
                  <th className="px-2 py-1 text-left font-medium">
                    <Tex>x</Tex>
                  </th>
                  <th className="px-2 py-1 text-left font-medium">
                    <Tex>{"e \\star x"}</Tex>
                  </th>
                  <th className="px-2 py-1 text-left font-medium">
                    <Tex>{"x \\star e"}</Tex>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.v} className="border-t border-border">
                    <td className="px-2 py-1">
                      <Tex>{t(r.v)}</Tex>
                    </td>
                    <td className="px-2 py-1">
                      <span className="inline-flex items-center gap-1.5">
                        <Tex>{`${p(tested)} \\star ${p(r.v)} = ${t(r.l)}`}</Tex>
                        <Verdict ok={r.lok} okLabel="égal à x" koLabel="différent de x" />
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <span className="inline-flex items-center gap-1.5">
                        <Tex>{`${p(r.v)} \\star ${p(tested)} = ${t(r.r)}`}</Tex>
                        <Verdict ok={r.rok} okLabel="égal à x" koLabel="différent de x" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Feedback tone={allL && allR ? "success" : "danger"}>
            {allL && allR ? (
              <>
                <Tex>{`e = ${t(tested)}`}</Tex> marche pour tous ces <Tex>x</Tex> : c&apos;est un bon candidat. Reste à le
                démontrer pour tout <Tex>x</Tex>.
              </>
            ) : allR ? (
              <>
                <Tex>{`x \\star ${p(tested)} = x`}</Tex> à chaque fois, mais pas <Tex>{`${p(tested)} \\star x = x`}</Tex> : neutre
                à droite seulement, donc pas neutre.
              </>
            ) : allL ? (
              <>
                <Tex>{`${p(tested)} \\star x = x`}</Tex> à chaque fois, mais pas <Tex>{`x \\star ${p(tested)} = x`}</Tex> : neutre
                à gauche seulement, donc pas neutre.
              </>
            ) : (
              <>
                <Tex>{`e = ${t(tested)}`}</Tex> n&apos;est pas neutre : au moins un test échoue.
              </>
            )}
          </Feedback>
        </>
      )}
    </div>
  );
}

export default LawExplorer;
