// ---------------------------------------------------------------------------
// Enemy entity. A Container holding the body sprite + an HP bar, so visuals
// move and depth-sort together. Movement is manual (no physics) along the
// level's precomputed screen-space waypoints.
//
// The scene owns the array of enemies and calls update() each frame. The entity
// reports terminal states (reached base / died) via the returned status so the
// scene can apply economy/lives effects — entities don't reach back into scene
// state directly.
// ---------------------------------------------------------------------------

import { DEPTH } from '../data/game.js';
import { PALETTE } from '../data/game.js';

export class Enemy extends Phaser.GameObjects.Container {
  constructor(scene, def, waypoints, tileStep) {
    const start = waypoints[0];
    super(scene, start.x, start.y);
    scene.add.existing(this);

    this.def = def;
    this.hp = def.maxHp;
    this.maxHp = def.maxHp;
    this.tileStep = tileStep;
    this.reward = def.reward;
    this.damage = def.damage;

    // Speed wander: each enemy independently re-rolls its speed within
    // `speedRange` every `speedVaryMs`, so the pack breathes rather than
    // marching in lockstep. Falls back to a fixed `speed` if no range given.
    this.speedRange = def.speedRange || null;
    this.speedVaryMs = def.speedVaryMs || [2000, 3500];
    if (this.speedRange) {
      this.rollSpeed();
    } else {
      this.speed = def.speed * tileStep; // tiles/sec -> px/sec
    }

    this.waypoints = waypoints;
    this.wpIndex = 1; // heading toward the second point
    this.alive = true;
    this.reachedBase = false;

    // Body sprite: origin at bottom-centre so it stands on the tile.
    this.body = scene.add.sprite(0, 0, def.textureKey);
    this.body.setOrigin(0.5, 0.92);

    // HP bar above the head.
    this.hpBarW = 34;
    this.hpBg = scene.add.rectangle(0, -this.body.displayHeight * 0.95, this.hpBarW + 2, 6, PALETTE.hpBack, 0.6);
    this.hpFill = scene.add.rectangle(0, -this.body.displayHeight * 0.95, this.hpBarW, 4, PALETTE.hpFill, 1);
    this.hpFill.setOrigin(0, 0.5);
    this.hpFill.x = -this.hpBarW / 2;
    this.hpBg.setOrigin(0.5, 0.5);

    this.add([this.body, this.hpBg, this.hpFill]);

    // Gentle bob so idle enemies feel alive.
    this.bobT = Math.random() * Math.PI * 2;

    this.updateDepth();
  }

  updateDepth() {
    this.setDepth(DEPTH.entityBase + this.y);
  }

  // Pick a fresh random speed (tiles/sec -> px/sec) and the delay until the next
  // re-roll. Each enemy rolls independently.
  rollSpeed() {
    const [lo, hi] = this.speedRange;
    this.speed = Phaser.Math.FloatBetween(lo, hi) * this.tileStep;
    this.speedTimer = Phaser.Math.Between(this.speedVaryMs[0], this.speedVaryMs[1]);
  }

  takeDamage(amount, audio) {
    // `active` guards against a late projectile striking an enemy that has
    // already been destroyed (e.g. one that just reached the base); touching a
    // destroyed object's scene/children would otherwise throw and freeze the loop.
    if (!this.alive || !this.active) return;
    this.hp -= amount;

    // Hit flash.
    this.body.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.body.active) this.body.clearTint();
    });

    const ratio = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    this.hpFill.width = this.hpBarW * ratio;
    this.hpFill.fillColor = ratio < 0.35 ? PALETTE.hpLow : PALETTE.hpFill;

    if (this.hp <= 0) {
      this.die(audio);
    }
  }

  die(audio) {
    if (!this.alive) return;
    this.alive = false;
    if (audio) audio.explode();
    this.spawnDeathBurst();
    // Pop + fade out, then destroy.
    this.scene.tweens.add({
      targets: this,
      scale: 1.3,
      alpha: 0,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => this.destroy(),
    });
  }

  spawnDeathBurst() {
    const burst = this.scene.add.particles(this.x, this.y - this.body.displayHeight * 0.4, 'spark', {
      speed: { min: 60, max: 180 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0 },
      lifespan: 360,
      quantity: 12,
      tint: [this.def.color, this.def.accent, 0xffffff],
      blendMode: 'ADD',
      emitting: false,
    });
    burst.setDepth(DEPTH.entityBase + this.y + DEPTH.effectBias);
    burst.explode();
    this.scene.time.delayedCall(420, () => burst.destroy());
  }

  // Returns 'moving' | 'reachedBase'. Death is handled via takeDamage.
  update(delta) {
    if (!this.alive) return 'dead';

    // Drift speed every few seconds.
    if (this.speedRange) {
      this.speedTimer -= delta;
      if (this.speedTimer <= 0) this.rollSpeed();
    }

    const dt = delta / 1000;
    let remaining = this.speed * dt;

    // Walk along waypoints, consuming distance across corners.
    while (remaining > 0 && this.wpIndex < this.waypoints.length) {
      const target = this.waypoints[this.wpIndex];
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= remaining) {
        this.x = target.x;
        this.y = target.y;
        remaining -= dist;
        this.wpIndex++;
      } else {
        this.x += (dx / dist) * remaining;
        this.y += (dy / dist) * remaining;
        // Face travel direction (flip body horizontally).
        this.body.setFlipX(dx < 0);
        remaining = 0;
      }
    }

    // Idle bob.
    this.bobT += dt * 8;
    this.body.y = Math.sin(this.bobT) * 1.5;

    this.updateDepth();

    if (this.wpIndex >= this.waypoints.length) {
      this.reachedBase = true;
      return 'reachedBase';
    }
    return 'moving';
  }
}
