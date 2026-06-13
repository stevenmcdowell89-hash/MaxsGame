// ---------------------------------------------------------------------------
// Projectile entity. Homes toward its target each frame; if the target dies
// before impact it continues along its last heading and expires. On impact it
// applies damage and spawns a small hit burst.
//
// The scene owns the projectile array and calls update(); the projectile
// reports 'flying' | 'done' so the scene can recycle it.
// ---------------------------------------------------------------------------

import { DEPTH } from '../data/game.js';

export class Projectile extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, def, target, audio) {
    super(scene, x, y, def.projectileKey);
    scene.add.existing(this);

    this.def = def;
    this.damage = def.damage;
    this.speed = def.projectileSpeed;
    this.target = target;
    this.audio = audio;
    this.life = 2000; // ms safety timeout
    this.done = false;

    // Initial heading toward target (used as fallback if target dies).
    const angle = Phaser.Math.Angle.Between(x, y, target.x, target.y);
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.setRotation(angle);

    this.setDepth(DEPTH.entityBase + y + DEPTH.effectBias);
  }

  impact() {
    if (this.done) return;
    this.done = true;

    if (this.target && this.target.alive) {
      this.target.takeDamage(this.damage, this.audio);
      if (this.audio) this.audio.hit();
    }

    const burst = this.scene.add.particles(this.x, this.y, 'spark', {
      speed: { min: 30, max: 120 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0 },
      lifespan: 220,
      quantity: 6,
      tint: [this.def.color, 0xffffff],
      blendMode: 'ADD',
      emitting: false,
    });
    burst.setDepth(this.depth + 1);
    burst.explode();
    this.scene.time.delayedCall(260, () => burst.destroy());

    this.destroy();
  }

  update(delta) {
    if (this.done) return 'done';
    const dt = delta / 1000;
    this.life -= delta;
    if (this.life <= 0) {
      this.destroy();
      return 'done';
    }

    // Re-home if target still alive.
    if (this.target && this.target.alive) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
      this.vx = Math.cos(angle) * this.speed;
      this.vy = Math.sin(angle) * this.speed;
      this.setRotation(angle);

      const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
      if (dist <= Math.max(8, this.speed * dt)) {
        this.x = this.target.x;
        this.y = this.target.y;
        this.impact();
        return 'done';
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.setDepth(DEPTH.entityBase + this.y + DEPTH.effectBias);

    // Off-screen guard.
    if (this.x < -50 || this.x > this.scene.scale.width + 50 ||
        this.y < -50 || this.y > this.scene.scale.height + 50) {
      this.destroy();
      return 'done';
    }
    return 'flying';
  }
}
