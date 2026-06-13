// ---------------------------------------------------------------------------
// Tower entity. Sits on a grid cell, acquires the nearest in-range enemy and
// fires projectiles on a cooldown. Targeting is delegated to TargetingSystem so
// the selection policy can evolve independently of the entity.
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

    this.sprite = scene.add.sprite(0, 0, def.textureKey);
    this.sprite.setOrigin(0.5, 0.92);
    this.add(this.sprite);

    this.setDepth(DEPTH.entityBase + this.y);

    // Build-in animation: pop up from the ground.
    this.sprite.y = -20;
    this.sprite.alpha = 0;
    scene.tweens.add({
      targets: this.sprite,
      y: 0,
      alpha: 1,
      duration: 260,
      ease: 'Back.easeOut',
    });
  }

  // Visual recoil + muzzle flash when firing.
  playFireFx() {
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 0.86,
      scaleY: 1.12,
      duration: 60,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    const flash = this.scene.add.sprite(this.x, this.y - this.sprite.displayHeight * 0.55, 'spark');
    flash.setTint(this.def.accent);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    flash.setDepth(this.depth + DEPTH.effectBias);
    this.scene.tweens.add({
      targets: flash,
      scale: { from: 1.6, to: 0 },
      duration: 140,
      onComplete: () => flash.destroy(),
    });
  }

  update(delta, enemies, fireProjectile, audio) {
    this.cooldown -= delta;
    if (this.cooldown > 0) return;

    const target = selectTarget(this, enemies, this.rangePx);
    if (!target) return;

    this.cooldown = this.def.fireRate;

    const muzzleY = this.y - this.sprite.displayHeight * 0.55;
    fireProjectile(this.def, this.x, muzzleY, target);
    this.playFireFx();
    if (audio) audio.shoot();

    // Face the target.
    this.sprite.setFlipX(target.x < this.x);
  }
}
