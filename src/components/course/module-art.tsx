import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Card art for a module: a short looping motion graphic on the module's own colour, so it reads
 * the same in light and dark mode. When a Higgsfield clip exists (public/media/modules/<slug>.mp4,
 * same colour background), the card plays it instead (see CourseCard).
 * Pure SVG + CSS (classes `ma-*` in globals.css).
 */

type ArtProps = { a: string; b: string };

function Algebre({ a }: ArtProps) {
  return (
    <g>
      <g className="ma-spin" style={{ transformOrigin: "200px 112px" }}>
        {[-3, -2, -1, 0, 1, 2, 3].map((k) => (
          <g key={k}>
            <line x1={200 + k * 34} y1={-40} x2={200 + k * 34} y2={264} stroke="currentColor" strokeOpacity={0.35} strokeWidth={1.2} />
            <line x1={0} y1={112 + k * 34} x2={400} y2={112 + k * 34} stroke="currentColor" strokeOpacity={0.35} strokeWidth={1.2} />
          </g>
        ))}
        <line x1={200} y1={112} x2={268} y2={78} stroke={a} strokeWidth={4} strokeLinecap="round" />
        <circle cx={268} cy={78} r={5} fill={a} />
      </g>
      <path d="M118 52 H100 V172 H118 M282 52 H300 V172 H282" fill="none" stroke="currentColor" strokeWidth={5} />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <circle key={`${r}${c}`} cx={150 + c * 50} cy={78 + r * 34} r={7} fill={r === c ? a : "currentColor"} className="ma-pop" style={{ "--d": `${(r * 3 + c) * 0.18}s` } as CSSProperties} />
        )),
      )}
    </g>
  );
}

function Analyse({ a }: ArtProps) {
  return (
    <g>
      <path d="M40 190 H370 M60 205 V20" stroke="currentColor" strokeOpacity={0.35} strokeWidth={1.5} />
      <path id="ma-curve" className="ma-draw" pathLength={1} d="M60 180 C 120 180, 140 60, 200 70 S 300 170, 360 40" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
      <g className="ma-tangent">
        <line x1={-70} y1={0} x2={70} y2={0} stroke={a} strokeWidth={3} strokeLinecap="round" />
        <circle r={6} fill={a} />
        <animateMotion dur="6s" repeatCount="indefinite" rotate="auto" keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="spline" keySplines=".45 .05 .55 .95;.45 .05 .55 .95">
          <mpath href="#ma-curve" />
        </animateMotion>
      </g>
    </g>
  );
}

function Mecanique({ a }: ArtProps) {
  return (
    <g>
      <path d="M30 196 H370" stroke="currentColor" strokeOpacity={0.35} strokeWidth={1.5} />
      <path id="ma-traj" className="ma-draw" pathLength={1} d="M50 190 Q 200 -40 350 190" fill="none" stroke="currentColor" strokeWidth={3.5} strokeDasharray="1" strokeLinecap="round" />
      <g>
        <circle r={10} fill={a} />
        <line x1={0} y1={0} x2={46} y2={0} stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
        <path d="M38 -7 L48 0 L38 7" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <animateMotion dur="4.5s" repeatCount="indefinite" rotate="auto">
          <mpath href="#ma-traj" />
        </animateMotion>
      </g>
    </g>
  );
}

function Electrostatique({ a, b }: ArtProps) {
  const lines = [-60, -30, 0, 30, 60];
  return (
    <g>
      {lines.map((o, i) => (
        <path
          key={o}
          d={`M128 112 C 170 ${112 + o * 1.8}, 230 ${112 + o * 1.8}, 272 112`}
          fill="none"
          stroke="currentColor"
          strokeOpacity={o === 0 ? 1 : 0.4}
          strokeWidth={o === 0 ? 2.5 : 1.8}
          className="ma-flow"
          style={{ "--d": `${i * 0.2}s` } as CSSProperties}
        />
      ))}
      <circle cx={110} cy={112} r={22} fill={a} className="ma-pulse" />
      <path d="M100 112 H120 M110 102 V122" stroke={b} strokeWidth={3.5} strokeLinecap="round" />
      <circle cx={290} cy={112} r={22} fill="currentColor" className="ma-pulse" style={{ "--d": "1.2s" } as CSSProperties} />
      <path d="M280 112 H300" stroke={b} strokeWidth={3.5} strokeLinecap="round" />
    </g>
  );
}

function Algorithmique({ a }: ArtProps) {
  const boxes = [
    { x: 70, y: 90, w: 70 },
    { x: 175, y: 90, w: 70, diamond: true },
    { x: 280, y: 90, w: 70 },
  ];
  return (
    <g>
      {boxes.map((b, i) =>
        b.diamond ? (
          <path key={i} d={`M${b.x + b.w / 2} ${b.y - 22} L${b.x + b.w} ${b.y + 22} L${b.x + b.w / 2} ${b.y + 66} L${b.x} ${b.y + 22} Z`} fill="none" stroke="currentColor" strokeWidth={3} className="ma-pop" style={{ "--d": `${i * 0.3}s` } as CSSProperties} />
        ) : (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={44} rx={8} fill="none" stroke="currentColor" strokeWidth={3} className="ma-pop" style={{ "--d": `${i * 0.3}s` } as CSSProperties} />
        ),
      )}
      <path id="ma-loop" d="M140 112 H175 M245 112 H280 M210 178 V196 H105 V134" fill="none" stroke="currentColor" strokeOpacity={0.35} strokeWidth={2.5} />
      <path d="M140 112 H175 M245 112 H280 M210 178 V196 H105 V134" fill="none" stroke={a} strokeWidth={3} strokeLinecap="round" className="ma-run" pathLength={1} />
    </g>
  );
}

function Entrepreneuriat({ a }: ArtProps) {
  const bars = [60, 90, 75, 120, 150];
  return (
    <g>
      <path d="M50 196 H360" stroke="currentColor" strokeOpacity={0.35} strokeWidth={1.5} />
      {bars.map((h, i) => (
        <rect key={i} x={70 + i * 56} y={196 - h} width={32} height={h} rx={4} fill={i === bars.length - 1 ? a : "currentColor"} className="ma-grow" style={{ "--d": `${i * 0.15}s`, transformOrigin: `${86 + i * 56}px 196px` } as CSSProperties} />
      ))}
      <path className="ma-draw" pathLength={1} d="M86 120 L142 92 L198 104 L254 64 L310 34" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1" />
    </g>
  );
}

const ART: Record<string, (p: ArtProps) => ReactNode> = {
  "algebre-1": Algebre,
  "analyse-1": Analyse,
  "mecanique-du-point": Mecanique,
  electrostatique: Electrostatique,
  algorithmique: Algorithmique,
  entrepreneuriat: Entrepreneuriat,
};

/** Flat panel art: drawn in `fg` on the module colour `color`, with one accent. */
export function ModuleArt({ slug, color, fg = "#efede6", accent = "#ffd60a", className }: { slug: string; color: string; fg?: string; accent?: string; className?: string }) {
  const Art = ART[slug] ?? Analyse;
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ background: color, color: fg }}>
      <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid meet" aria-hidden className="module-art absolute inset-0 size-full">
        <Art a={accent} b={color} />
      </svg>
    </div>
  );
}
