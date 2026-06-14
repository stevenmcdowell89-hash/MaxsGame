// ---------------------------------------------------------------------------
// CameraController: drag-to-pan, pinch-to-zoom, wheel-zoom and stepped button
// zoom for the main game camera, with clamped zoom. The HUD lives in its own
// scene/camera, so it stays fixed while the world pans and zooms underneath it.
//
// GameScene owns the raw pointer events and forwards them here, because the same
// taps also drive building and tower selection. So this controller answers two
// questions for the scene:
//   onPointerMove(...) -> is a pan/pinch in progress? (skip the build highlight)
//   onPointerUp(...)   -> was this gesture a pan/pinch? (suppress the tap action)
//
// Gesture model (touch-first for a tablet):
//   - one finger drag  -> pan   (disabled in build mode so it can't fight the
//                                 build highlight; tap still builds)
//   - two fingers      -> pinch zoom + pan (works in any mode)
//   - mouse wheel      -> zoom toward the pointer (desktop)
//   - HUD +/- buttons  -> stepped zoom toward the screen centre
// ---------------------------------------------------------------------------

export class CameraController {
  constructor(scene, { minZoom = 0.4, maxZoom = 1.5, tapSlop = 12 } = {}) {
    this.scene = scene;
    this.cam = scene.cameras.main;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this.tapSlop = tapSlop;          // screen px of drift allowed before a tap becomes a pan
    this.allowSingleDragPan = true;  // turned off while in build mode

    this.downX = 0; this.downY = 0;
    this.lastX = 0; this.lastY = 0;
    this.panning = false;

    this.pinching = false;
    this.pinchDist = 0;
    this.lastMidX = 0; this.lastMidY = 0;
  }

  setSingleDragPan(on) { this.allowSingleDragPan = on; }

  // ---- helpers ----------------------------------------------------------

  activePointers() {
    const i = this.scene.input;
    let n = 0;
    for (const p of [i.pointer1, i.pointer2, i.pointer3]) if (p && p.isDown) n++;
    return n;
  }

  twoPointers() {
    const i = this.scene.input;
    const ps = [i.pointer1, i.pointer2, i.pointer3].filter((p) => p && p.isDown);
    return [ps[0], ps[1]];
  }

  // Zoom to `newZoom`, keeping the world point under screen (sx, sy) fixed.
  zoomAround(newZoom, sx, sy) {
    const z = Phaser.Math.Clamp(newZoom, this.minZoom, this.maxZoom);
    const before = this.cam.getWorldPoint(sx, sy);
    const bx = before.x, by = before.y;
    this.cam.setZoom(z);
    const after = this.cam.getWorldPoint(sx, sy);
    this.cam.scrollX += bx - after.x;
    this.cam.scrollY += by - after.y;
  }

  // ---- gesture lifecycle (forwarded from GameScene) ---------------------

  onPointerDown(pointer) {
    if (this.activePointers() >= 2) {
      this.beginPinch();
    } else {
      this.downX = this.lastX = pointer.x;
      this.downY = this.lastY = pointer.y;
      this.panning = false;
    }
  }

  beginPinch() {
    const [a, b] = this.twoPointers();
    if (!a || !b) return;
    this.pinching = true;
    this.panning = false;
    this.pinchDist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    this.lastMidX = (a.x + b.x) / 2;
    this.lastMidY = (a.y + b.y) / 2;
  }

  // Returns true if a pan/pinch consumed this move (so the scene skips its own
  // hover handling).
  onPointerMove(pointer) {
    if (this.activePointers() >= 2) {
      if (!this.pinching) this.beginPinch();
      this.updatePinch();
      return true;
    }
    // One finger left over after a pinch: swallow moves until full release so
    // the camera doesn't jump.
    if (this.pinching) return true;

    if (!pointer.isDown || !this.allowSingleDragPan) return false;

    const totalMoved = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.downX, this.downY);
    if (totalMoved > this.tapSlop) this.panning = true;

    if (this.panning) {
      this.cam.scrollX -= (pointer.x - this.lastX) / this.cam.zoom;
      this.cam.scrollY -= (pointer.y - this.lastY) / this.cam.zoom;
      this.lastX = pointer.x;
      this.lastY = pointer.y;
      return true;
    }
    this.lastX = pointer.x;
    this.lastY = pointer.y;
    return false;
  }

  updatePinch() {
    const [a, b] = this.twoPointers();
    if (!a || !b) return;
    const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;

    if (this.pinchDist > 0 && dist > 0) {
      this.zoomAround(this.cam.zoom * (dist / this.pinchDist), midX, midY);
    }
    // Pan by however much the two-finger midpoint slid.
    this.cam.scrollX -= (midX - this.lastMidX) / this.cam.zoom;
    this.cam.scrollY -= (midY - this.lastMidY) / this.cam.zoom;

    this.pinchDist = dist;
    this.lastMidX = midX;
    this.lastMidY = midY;
  }

  // Returns true if the just-ended gesture was a pan/pinch (so the scene treats
  // the release as a gesture end, not a tap).
  onPointerUp() {
    const wasGesture = this.panning || this.pinching;
    if (this.activePointers() === 0) {
      this.pinching = false;
      this.panning = false;
      this.pinchDist = 0;
    } else if (this.pinching) {
      // A finger lifted mid-pinch; force a fresh baseline on the next move.
      this.pinchDist = 0;
    }
    return wasGesture;
  }

  onWheel(deltaY, pointer) {
    const sx = pointer ? pointer.x : this.cam.width / 2;
    const sy = pointer ? pointer.y : this.cam.height / 2;
    const factor = deltaY > 0 ? 0.88 : 1.12;
    this.zoomAround(this.cam.zoom * factor, sx, sy);
  }

  // Stepped zoom from the HUD +/- buttons, anchored at the screen centre.
  zoomStep(dir) {
    const factor = dir > 0 ? 1.2 : 1 / 1.2;
    this.zoomAround(this.cam.zoom * factor, this.cam.width / 2, this.cam.height / 2);
  }
}
