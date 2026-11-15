// Pure helpers (usable from server components) for HorizontalTrack timing.

/**
 * Scroll timeline of a track of `n` equal-width panels: each panel holds still for
 * `dwell` screens of scroll, then the strip moves to the next one over 1 screen.
 * Units: hold_i = [i(d+1), i(d+1)+d], move into i = [i(d+1)-1, i(d+1)].
 */
export function timeline(n: number, dwell: number) {
  const total = Math.max(1e-6, (n - 1) * (dwell + 1) + dwell);
  const input: number[] = [];
  const output: number[] = [];
  for (let i = 0; i < n; i++) {
    const start = i * (dwell + 1);
    const at = i / Math.max(1, n - 1);
    input.push(start / total);
    output.push(at);
    if (dwell > 0) {
      input.push((start + dwell) / total);
      output.push(at);
    }
  }
  return { total, input, output };
}

/**
 * Progress range (of the HorizontalTrack scene) during which panel `i` is on screen:
 * from when it starts sliding in until it starts sliding out. Feed it to ScrubVideo / reveals.
 */
export function trackPanelRange(i: number, n: number, dwell = 0): [number, number] {
  const { total } = timeline(n, dwell);
  const start = Math.max(0, i * (dwell + 1) - 1);
  const end = i * (dwell + 1) + dwell;
  return [start / total, Math.max(end, start + 0.0001) / total];
}
