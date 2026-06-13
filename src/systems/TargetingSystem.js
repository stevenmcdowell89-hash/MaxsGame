// ---------------------------------------------------------------------------
// Target selection policy, kept separate so it can grow (first/last/strongest/
// closest, priority flags, etc.) without touching the Tower entity.
//
// v1 policy: target the enemy that is FURTHEST along the path (closest to the
// base) among those in range — the classic "defend the exit" behaviour.
// ---------------------------------------------------------------------------

export function selectTarget(tower, enemies, rangePx) {
  let best = null;
  let bestProgress = -1;
  const rangeSq = rangePx * rangePx;

  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = e.x - tower.x;
    const dy = e.y - tower.y;
    if (dx * dx + dy * dy > rangeSq) continue;

    // "Progress" ~ how far along the path the enemy is. wpIndex is the primary
    // measure; ties are rare and unimportant for v1.
    if (e.wpIndex > bestProgress) {
      bestProgress = e.wpIndex;
      best = e;
    }
  }
  return best;
}
