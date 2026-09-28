function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Consecutive-day posting streak, ending today — or, if nothing's been
 * posted yet today, still "alive" through yesterday (the same one-day
 * grace every daily-streak app gives, since today isn't over yet). Returns
 * 0 if neither today nor yesterday has a post, i.e. the streak is broken.
 */
export function computeStreak(postTimestampsMs: number[]): number {
  const days = new Set(postTimestampsMs.map((ms) => dayKey(new Date(ms))));

  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
