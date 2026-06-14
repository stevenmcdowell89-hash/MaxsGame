// ---------------------------------------------------------------------------
// Level definitions: the grid size and the enemy path through it.
//
// The grid is addressed by (c = column, r = row), 0-indexed from the top-left
// in grid space. `path` is the ordered list of cells enemies walk, from the
// spawn (first entry, an off-grid-feel edge cell) to the base (last entry).
// Any cell NOT on the path is buildable.
//
// To design a new level: list the path's CORNER cells and let `buildPath` fill
// the straight runs between them. Each corner must share a row or column with
// the next (the path only moves up/down/left/right). The renderer + grid handle
// the rest. `buildPath` is a pure content helper — it imports nothing.
// ---------------------------------------------------------------------------

// Expand a list of corner cells into a contiguous, one-step-at-a-time path.
function buildPath(corners) {
  const path = [{ ...corners[0] }];
  for (let i = 1; i < corners.length; i++) {
    const a = corners[i - 1];
    const b = corners[i];
    const dc = Math.sign(b.c - a.c);
    const dr = Math.sign(b.r - a.r);
    let c = a.c;
    let r = a.r;
    while (c !== b.c || r !== b.r) {
      c += dc;
      r += dr;
      path.push({ c, r });
    }
  }
  return path;
}

export const LEVELS = {
  sectorOne: {
    id: 'sectorOne',
    name: 'Sector One',
    cols: 22,
    rows: 18,
    // A long serpentine across the doubled board: enter top-left, switchback
    // down the map, exit at the base on the right edge.
    path: buildPath([
      { c: 0, r: 2 },
      { c: 19, r: 2 },
      { c: 19, r: 5 },
      { c: 2, r: 5 },
      { c: 2, r: 8 },
      { c: 19, r: 8 },
      { c: 19, r: 11 },
      { c: 2, r: 11 },
      { c: 2, r: 14 },
      { c: 19, r: 14 },
      { c: 19, r: 16 },
      { c: 21, r: 16 },
    ]),
  },
};

export const DEFAULT_LEVEL_ID = 'sectorOne';
