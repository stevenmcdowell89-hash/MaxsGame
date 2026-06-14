# Robo Defense — project guide

A robot-themed **tower defense** game for the browser, built to be played on an
Android tablet (Xiaomi Pad) in landscape, and to grow with my son over many
sessions. This file is the map of the project: read it first.

---

## How to run / view it

It's **static files, no build step**. Serve the repo root over HTTP and open it.

- **Entry path:** `index.html` (at the repo root).
- **Local preview:** from the repo root run a static server, e.g.
  `python3 -m http.server 8000`, then open `http://localhost:8000/`.
  (Do **not** open via `file://` — ES modules won't load from the filesystem.)
- **Hosting:** Cloudflare Pages. Build command: *none*. Output directory: `/`
  (the repo root). Pages serves `index.html` directly.

> The game must be served over HTTP(S); it relies on ES module imports.

---

## What v1 does (the current state)

One complete gameplay loop, deliberately minimal:

- **One level** (`Sector One`), a fixed snaking path in **gentle 2:1 isometric**.
- **One enemy** (`Scrapling`) that walks the path; reaching the base costs a life.
- **One tower** (`Blaster Bot`) you place on buildable tiles; it auto-targets and
  fires homing bolts.
- **Economy:** start with gold; build towers; earn gold per kill and per wave.
- **Waves:** 5 waves, started manually with the **START WAVE** button.
- **Win:** clear all waves. **Lose:** run out of lives.
- **Feedback:** muzzle flash + recoil, hit/death particle bursts, screen shake,
  HP bars, and synthesized Web Audio sounds (no audio files).
- **Persistence:** best wave reached, win count, and mute setting in
  `localStorage`.
- **Placeholder art:** all visuals are generated as shapes at boot (robots,
  tiles, base, bolts) — ready to be swapped for real PNGs (see "Art seam").

Verified end-to-end in a headless browser: full loop (start → build → win and
lose → restart) works with **zero console errors** when served over HTTP.

---

## Engine & rendering

- **Phaser 3** (v3.88.2) loaded from a CDN in `index.html` — the **WebGL**
  renderer, chosen for headroom (many entities/projectiles/particles at 60fps).
  The renderer is the one thing we don't intend to change.
- `Phaser` (the CDN global) is the **only** global the code relies on. Everything
  else is explicit ES module `import`/`export`.
- The game runs at a logical **1280×720** and uses `Scale.FIT` + `CENTER_BOTH`,
  so it fills a landscape tablet screen with letterboxing and stays crisp.

---

## File / folder layout

Servable files live at the **repo root** (so Pages serves them with no config):

```
index.html                 # entry HTML: viewport, styles, Phaser CDN, module entry
manifest.webmanifest       # PWA manifest (install/offline seam; see Next steps)
CLAUDE.md                  # this file
src/
  main.js                  # single entry point: Phaser config + scene registration
  core/
    EventBus.js            # shared event emitter + EVENTS name constants
    SaveManager.js         # localStorage read/write (versioned schema)
  data/                    # ALL tunable content lives here (no logic)
    game.js                # global tuning, ISO tile size, PALETTE, DEPTH bands
    towers.js              # tower + conduit definitions (incl. tier / energy fields)
    enemies.js             # enemy definitions
    levels.js              # grid size + enemy path per level
    waves.js               # wave/spawn schedules per level
    energy.js              # ALL energy-system tunables (sources, drain, visuals)
  rendering/
    iso.js                 # pure isometric projection math (no state)
    textures.js            # generates placeholder textures from data (ART SEAM)
  systems/
    IsoGrid.js             # stateful board: path/occupancy/centering, cell<->screen
    PlacementManager.js    # build-mode interaction + energy-aware placement overlay
    WaveManager.js         # spawn scheduling driven by data/waves.js
    TargetingSystem.js     # tower target-selection policy
    CameraController.js    # pan (drag / two-finger) + zoom (pinch/wheel/buttons)
    EnergyField.js         # stateful energy model: generated/available per tile
    EnergyView.js          # translucent banded field-glow layer over the terrain
  audio/
    AudioManager.js        # Web Audio synth (all SFX, no files)
  entities/
    Tower.js               # tower game object: targeting + firing + fire FX
    Enemy.js               # enemy game object: path movement, HP, death FX
    Projectile.js          # homing projectile + impact FX
  scenes/
    BootScene.js           # generates textures, then starts Game + HUD
    GameScene.js           # the world: owns entities + run state + game loop
    HUDScene.js            # all UI, parallel scene, talks only via EventBus
```

---

## Architecture & conventions

**Separation by concern.** Data describes *what*; systems/entities/scenes
decide *how*.

- **Data is a leaf.** Files in `data/` import nothing from the rest of the app.
  Add content (towers, enemies, waves, levels) by editing data only.
- **`GameScene` is the single owner** of entity arrays (`towers`, `enemies`,
  `projectiles`) and run state (lives, gold, waves). Entities don't reach into
  scene state — they return status from `update()` / take callbacks, and the
  scene applies economy/lives effects.
- **Scenes communicate only through `EventBus`** (a module singleton), never by
  reaching into each other. `GameScene` ↔ `HUDScene` is fully decoupled:
  GameScene emits state events; HUD reflects them and emits intent events back.
  All event names are constants in `EVENTS` (see `core/EventBus.js`).
  - First-load race is handled by a handshake: HUD emits `HUD_READY` once it has
    subscribed, and GameScene (re)publishes `STATE_INIT`.
- **Rendering math is pure** (`rendering/iso.js`); board *state* is in
  `systems/IsoGrid.js`. Depth sorting: tiles sit in a low band; everything else
  is depth-sorted by its screen-Y each frame (`DEPTH` in `data/game.js`).
- **Energy layers on top of money, not replacing it.** Money still buys; energy
  gates WHERE/HOW MANY pieces run. `systems/EnergyField.js` is pure spatial state
  (like `IsoGrid`) with two layers:
  - **WHERE — `generated`:** sources (core output 5, a generous turtle zone;
    conduits output 4, shorter reach so expanding is an investment) radiate
    strength falling off by Chebyshev distance — `generated = MAX over sources of
    (output − distance)`. A piece needs `generated ≥ its place-tier` to build/run
    (tier-1→1, tier-2→2, tier-3→3, conduit→1); a tower browns out if a source it
    relied on is removed (`Tower.setPowered`).
  - **HOW MANY — `reserved`:** each placed piece reserves a footprint by tier —
    tier-1 its own tile only (packs freely), tier-2 the 4 orthogonal cells,
    tier-3 and the conduit all 8 — and a piece can't be built if its tile or any
    footprint cell is already reserved/occupied. Bigger pieces need more spacing.
  A conduit is both a source and an 8-cell footprint, and must sit on existing
  tier-1 energy, so you expand the field outward, never from the void. `GameScene`
  owns the field, calls `refreshEnergy()` on every build/sell, and pushes the
  result to the heat-map glow (`EnergyView`), the consumption flow (`FlowView`),
  tower power state, and the placement overlay. All tuning is in `data/energy.js`.
- **Camera = the world; HUD is fixed.** The board can be larger than the screen,
  so `GameScene` pans/zooms its main camera via `CameraController` (drag or
  two-finger to pan, pinch/wheel/HUD `+`/`−` to zoom; clamped to the board). The
  HUD is a separate scene/camera, so it never moves. Because of this, all
  build/select hit-testing converts pointer→world through the camera
  (`GameScene.worldPoint`), not raw `pointer.worldX`.
- **No global state / no script-order reliance** beyond the `Phaser` CDN global.
  `window.__game` / `window.__bus` are attached in `main.js` purely as debug
  handles (handy in the console; safe to delete).

**The art seam (important).** Every visual is a texture referenced by a string
**key**. In v1, `rendering/textures.js` *generates* shapes into those keys at
boot. To use real hand-drawn transparent PNGs later: load them under the **same
keys** in `BootScene.preload()` and delete the generate call — **no other code
changes**. Eventual style is hand-inked gothic-storybook (Don't Starve-like),
animated with code tweens; entities already animate via tweens, so drawings drop
straight in.

**Audio seam.** `AudioManager` synthesizes every sound with the Web Audio API
(no files, works offline). Add a cue as a new named method; call it from the
relevant entity/scene. Audio is unlocked on the first pointer interaction.

---

## How the content data is structured

All in `src/data/`. Quick reference (full field docs are in each file):

- **`game.js`** — `GAME` (resolution, starting lives/gold), `ISO` (tile size),
  `PALETTE` (colours), `DEPTH` (render bands).
- **`towers.js`** — `TOWERS[id]`: `cost`, `range` (tiles), `fireRate` (ms),
  `damage`, `projectileSpeed` (px/s), `textureKey`, `projectileKey`, colours,
  plus energy fields `tier` (power gate, never stats), `isSource`/`noAttack`
  (the conduit), and `placeholder` ({shape,color}) for the temp art.
- **`enemies.js`** — `ENEMIES[id]`: `maxHp`, `speed` (tiles/s), `reward`,
  `damage` (lives lost at base), `textureKey`, colours.
- **`levels.js`** — `LEVELS[id]`: `cols`, `rows`, and `path` (ordered list of
  `{c,r}` cells from spawn to base). Any non-path cell is buildable.
- **`waves.js`** — `WAVES[levelId]`: array of waves; each has a `reward` and
  `groups` of `{ type, count, interval, delay? }`.
- **`energy.js`** — `ENERGY`: `coreOutput`/`conduitOutput` (source strengths),
  `conduitPlaceTier`, `footprint` (the cells each tier reserves), and the
  field/flow/overlay visuals. The one place to balance the power layer.

Common edits:
- **Tweak difficulty:** numbers in `towers.js` / `enemies.js` / `waves.js`.
- **Add a wave:** push an entry to `WAVES.sectorOne`.
- **Add an enemy/tower type:** add an entry in `enemies.js` / `towers.js`
  (a placeholder texture is auto-generated from its colours). Reference it from
  a wave (enemy) or wire a second build button (tower) in `HUDScene`.
- **New level:** add to `levels.js` + matching `waves.js` key; point
  `DEFAULT_LEVEL_ID` at it (or add level selection later).

---

## Migration to Vite + TypeScript (when we want a build step)

Designed to be mechanical:
1. `npm create vite@latest`, `npm i phaser`.
2. Replace the CDN `<script>` with `import Phaser from 'phaser'` in `main.js`.
3. Move `src/` in; rename `.js` → `.ts` and add types incrementally.
4. Everything already uses explicit ES module imports/exports and a single
   entry point, so no load-order or global untangling is needed.

---

## Next steps (ideas for future sessions)

- **Content:** more enemy types (fast/armored/flying), more towers (slow,
  splash, sniper), more levels/paths, a boss wave.
- **Real art:** drop son's drawings in as PNGs under existing texture keys;
  add simple tween-based idle/walk/attack animations.
- **UX:** tower selection/inspect, sell/upgrade, range ring on tap, auto-start
  toggle, pause, settings panel.
- **PWA / offline:** vendor Phaser locally (remove the CDN runtime dependency),
  add a service worker to cache `index.html` + `src/**` + assets, and add icons
  to `manifest.webmanifest` so it installs cleanly on the tablet.
- **Polish:** background music, more particle variety, damage numbers,
  difficulty curve pass, haptics on tablet.

---

## Testing notes

There's no test framework yet. The loop was validated by serving the root and
driving it in a headless browser (real button taps + canvas taps): build mode,
tower placement, win (all waves), lose (lives to 0), restart, and `localStorage`
persistence — all with zero console errors. A natural next step is to commit a
small Playwright smoke test (and a SessionStart hook to run it on the web).
