// GENERATED from src/lib/gamification.ts by scripts/sync-edge.mjs. Do not edit.
/** XP rewards. Each is granted at most once per (reason, item): retrying a quiz never farms XP. */
export const XP = {
  checkpoint: 2, // first correct answer to an in-lesson question
  lessonComplete: 10,
  quizPass: 20,
  quizPerfect: 10, // bonus for 100% (first time)
  chapterComplete: 50,
  courseComplete: 200,
  streakDay: 5, // granted by the database on the first XP of each day of a streak (≥ 2 days)
} as const;

/** A quiz is passed at 70%. Passing completes the lesson. */
export const PASS_RATIO = 0.7;

/**
 * Levels grow gently: level n needs 50·n·(n−1)/2 XP in total
 * (0, 50, 150, 300, 500, 750, ...).
 */
export function levelFromXp(xp: number) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, current: xp - start, needed: next - start, progress: (xp - start) / (next - start) };
}

export function xpForLevel(level: number) {
  return (50 * level * (level - 1)) / 2;
}

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

export function nextStreakMilestone(streak: number) {
  return STREAK_MILESTONES.find((m) => m > streak) ?? streak + 30;
}

/** Unlock rule for sequential courses: chapter k opens when chapter k−1 is at least half done. */
export function chapterStates(chapters: { total: number; completed: number }[], sequential: boolean, isAdmin: boolean) {
  return chapters.map((c, i) => {
    const prev = chapters[i - 1];
    const unlocked = isAdmin || !sequential || i === 0 || (prev && prev.total > 0 && prev.completed / prev.total >= 0.5);
    if (c.total > 0 && c.completed === c.total) return "completed" as const;
    if (!unlocked) return "locked" as const;
    if (c.completed > 0) return "in_progress" as const;
    return "available" as const;
  });
}
