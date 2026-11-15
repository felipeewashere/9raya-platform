/**
 * Electrostatics helpers in a plane (2D, units with k = 1/(4πε0) = 1):
 * field of point charges, field-line tracing and equipotential contours (marching squares).
 */
export type Charge = { x: number; y: number; q: number };
export type P2 = [number, number];

export function fieldAt(charges: Charge[], x: number, y: number): P2 {
  let ex = 0;
  let ey = 0;
  for (const c of charges) {
    const dx = x - c.x;
    const dy = y - c.y;
    const r2 = dx * dx + dy * dy + 1e-9;
    const k = c.q / (r2 * Math.sqrt(r2));
    ex += k * dx;
    ey += k * dy;
  }
  return [ex, ey];
}

export function potentialAt(charges: Charge[], x: number, y: number) {
  let v = 0;
  for (const c of charges) v += c.q / (Math.hypot(x - c.x, y - c.y) + 1e-9);
  return v;
}

export type TraceResult = { points: P2[]; end: "charge" | "out" | "steps" | "blocked"; hit?: number };

/**
 * Follow a field line from `start`, along E (sign = 1) or against it (sign = −1).
 * Stops near a charge (within `stopR`), outside the box, or when `blocked(x, y)` returns true.
 */
export function traceLine(
  charges: Charge[],
  start: P2,
  sign: 1 | -1,
  opts: { box: [number, number, number, number]; step?: number; maxSteps?: number; stopR?: number; blocked?: (x: number, y: number) => boolean },
): TraceResult {
  const { box, step = 0.035, maxSteps = 900, stopR = 0.08, blocked } = opts;
  const pts: P2[] = [start];
  let [x, y] = start;
  const dirAt = (px: number, py: number): P2 => {
    const [ex, ey] = fieldAt(charges, px, py);
    const n = Math.hypot(ex, ey) || 1;
    return [(sign * ex) / n, (sign * ey) / n];
  };
  for (let i = 0; i < maxSteps; i++) {
    // midpoint (RK2) step
    const [d1x, d1y] = dirAt(x, y);
    const [d2x, d2y] = dirAt(x + (d1x * step) / 2, y + (d1y * step) / 2);
    x += d2x * step;
    y += d2y * step;
    pts.push([x, y]);
    if (x < box[0] || x > box[1] || y < box[2] || y > box[3]) return { points: pts, end: "out" };
    if (blocked?.(x, y)) return { points: pts, end: "blocked" };
    for (let k = 0; k < charges.length; k++) {
      const c = charges[k];
      if (i > 3 && Math.hypot(x - c.x, y - c.y) < stopR) {
        pts.push([c.x, c.y]);
        return { points: pts, end: "charge", hit: k };
      }
    }
  }
  return { points: pts, end: "steps" };
}

/**
 * Contour segments of a scalar field f on a grid (marching squares).
 * Returns flat pairs of points, ready for a segments line.
 */
export function contours(
  f: (x: number, y: number) => number,
  box: [number, number, number, number],
  nx: number,
  ny: number,
  levels: number[],
): P2[] {
  const [x0, x1, y0, y1] = box;
  const dx = (x1 - x0) / nx;
  const dy = (y1 - y0) / ny;
  const val: number[] = new Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) val[j * (nx + 1) + i] = f(x0 + i * dx, y0 + j * dy);
  const out: P2[] = [];
  for (const L of levels) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const a = val[j * (nx + 1) + i];
        const b = val[j * (nx + 1) + i + 1];
        const c = val[(j + 1) * (nx + 1) + i + 1];
        const d = val[(j + 1) * (nx + 1) + i];
        if (![a, b, c, d].every(Number.isFinite)) continue;
        const X = x0 + i * dx;
        const Y = y0 + j * dy;
        // edge crossings: bottom (a-b), right (b-c), top (d-c), left (a-d)
        const cross: P2[] = [];
        const lerp = (v1: number, v2: number) => (L - v1) / (v2 - v1);
        if ((a < L) !== (b < L)) cross.push([X + lerp(a, b) * dx, Y]);
        if ((b < L) !== (c < L)) cross.push([X + dx, Y + lerp(b, c) * dy]);
        if ((d < L) !== (c < L)) cross.push([X + lerp(d, c) * dx, Y + dy]);
        if ((a < L) !== (d < L)) cross.push([X, Y + lerp(a, d) * dy]);
        if (cross.length === 2) out.push(cross[0], cross[1]);
        else if (cross.length === 4) out.push(cross[0], cross[1], cross[2], cross[3]);
      }
    }
  }
  return out;
}

/** Point every `every` units of arc length along a polyline, with the local direction. */
export function marksAlong(points: P2[], every: number, offset = every / 2): { p: P2; d: P2 }[] {
  const res: { p: P2; d: P2 }[] = [];
  let next = offset;
  let s = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const l = Math.hypot(bx - ax, by - ay);
    while (l > 0 && s + l >= next) {
      const t = (next - s) / l;
      res.push({ p: [ax + (bx - ax) * t, ay + (by - ay) * t], d: [(bx - ax) / l, (by - ay) / l] });
      next += every;
    }
    s += l;
  }
  return res;
}
