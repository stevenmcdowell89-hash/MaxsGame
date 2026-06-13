// ---------------------------------------------------------------------------
// Level definitions: the grid size and the enemy path through it.
//
// The grid is addressed by (c = column, r = row), 0-indexed from the top-left
// in grid space. `path` is the ordered list of cells enemies walk, from the
// spawn (first entry, an off-grid-feel edge cell) to the base (last entry).
// Any cell NOT on the path is buildable.
//
// To design a new level: set cols/rows and lay out a contiguous path (each
// step moves one cell up/down/left/right). The renderer + grid handle the rest.
// ---------------------------------------------------------------------------

export const LEVELS = {
  sectorOne: {
    id: 'sectorOne',
    name: 'Sector One',
    cols: 11,
    rows: 9,
    path: [
      { c: 0, r: 4 }, { c: 1, r: 4 }, { c: 2, r: 4 }, { c: 3, r: 4 },
      { c: 3, r: 3 }, { c: 3, r: 2 }, { c: 3, r: 1 },
      { c: 4, r: 1 }, { c: 5, r: 1 }, { c: 6, r: 1 }, { c: 7, r: 1 },
      { c: 7, r: 2 }, { c: 7, r: 3 }, { c: 7, r: 4 }, { c: 7, r: 5 },
      { c: 7, r: 6 }, { c: 7, r: 7 },
      { c: 8, r: 7 }, { c: 9, r: 7 }, { c: 10, r: 7 },
    ],
  },
};

export const DEFAULT_LEVEL_ID = 'sectorOne';
