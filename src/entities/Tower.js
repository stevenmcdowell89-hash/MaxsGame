// ---------------------------------------------------------------------------
// Tower entity. Sits on a grid cell, acquires the nearest in-range enemy and
// fires projectiles on a cooldown. Targeting is delegated to TargetingSystem so
// the selection policy can evolve independently of the entity.
//
// Rendering is data-driven: a tower's `textureKey` is whatever the data points
// at (a generated placeholder, or a real PNG). Optional art fields in the data
// (artHeight / originX / originY / facing / muzzle) control how that texture is
// scaled, anchored and aimed — so dropping in new drawings needs no code here.
//
// fire() pushes a Projectile into the scene's projectile array (passed in via
// the firing callback) so the scene stays the single owner of entity lists.
// ---------------------------------------------------------------------------

import { DEPTH } from '../data/game.js';
import { selectTarget } from '../systems/TargetingSystem.js';

export class Tower extends Phaser.GameObjects.Container {
  constructor(scene, def, cell, screenPos, rangePx) {
    super(scene, screenPos.x, screenPos.y);
    scene.add.existing(this);

    this.def = def;
    this.cell = cell;
    this.rangePx = rangePx;
    this.cooldown = 0;
    this.defaultLeft = (def.facing ?? 'left') === 'left';

    this.sprite = scene.add.sprite(0, 0, def.textureKey);
    this.sprite.setOrigin(def.originX ?? 0.5, def.originY ?? 0.92);

    // Scale real art to a target on-screen height (placeholders stay at 1:1).
    this.baseScale = def.artHeight ? def.artHeight / this.sprite.height : 1;
    this.sprite.setScale(this.baseScale);
    this.add(this.sprite);

    this.setDepth(DEPTH.entityBase + this.y);

    // Build-in animation: pop up from the ground.
    this.sprite.alpha = 0;
    this.sprite.setScale(this.baseScale * 0.7);
    this.sprite.y = -16;
    scene.tweens.add({
      targets: this.sprite,
      y: 0,
      alpha: 1,
      scaleX: this.baseScale,
      scaleY: this.baseScale,
      duration: 280,
      ease: 'Back.easeOut',
    });
  }

  // Visual recoil (relative to base scale) + a muzzle flash at the barrel tip.
  playFireFx(muzzleX, muzzleY) {
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: this.baseScale * 0.9,
      scaleY: this.baseScale * 1.08,
      duration: 60,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    const flash = this.scene.add.sprite(muzzleX, muzzleY, 'spark');
    flash.setTint(this.def.accent);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    flash.setDepth(this.depth + DEPTH.effectBias);
    this.scene.tweens.add({
      targets: flash,
      scale: { from: 1.8, to: 0 },
      duration: 150,
      onComplete: () => flash.destroy(),
    });
  }

  // World position of the barrel tip, mirrored to whichever side we're facing.
  muzzlePosition(faceRight) {
    const mx = this.def.muzzle?.x ?? 0;
    const my = this.def.muzzle?.y ?? this.sprite.displayHeight * 0.55;
    return { x: this.x + (faceRight ? mx : -mx), y: this.y - my };
  }

  update(delta, enemies, fireProjectile, audio) {
    this.cooldown -= delta;
    if (this.cooldown > 0) return;

    const target = selectTarget(this, enemies, this.rangePx);
    if (!target) return;

    this.cooldown = this.def.fireRate;

    // Aim: flip the sprite so the barrel points at the target.
    const faceRight = target.x > this.x;
    this.sprite.setFlipX(this.defaultLeft ? faceRight : !faceRight);

    const muzzle = this.muzzlePosition(faceRight);
    fireProjectile(this.def, muzzle.x, muzzle.y, target);
    this.playFireFx(muzzle.x, muzzle.y);
    if (audio) audio.shoot();
  }
}
