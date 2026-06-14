// ---------------------------------------------------------------------------
// Tower entity. Sits on a grid cell, acquires the best in-range enemy and
// fires on a cadence. Targeting is delegated to TargetingSystem.
//
// Two firing models, chosen by data:
//   - charge (def.chargeTime): builds a growing muzzle glow over chargeTime ms,
//     then fires (used by the laser turret). Charge decays if no target.
//   - instant (def.fireRate): classic cooldown firing.
//
// The tower doesn't know laser vs projectile — it just calls the `fire`
// callback with (def, muzzleX, muzzleY, target); the scene routes it to the
// right weapon and stays the owner of all entities.
//
// Rendering is data-driven (textureKey / artHeight / origin / facing / muzzle),
// so new drawings drop in without code changes.
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
    this.tier = def.tier ?? 0;
    this.cooldown = 0;
    this.charge = 0;
    this.faceRight = false;
    this.glow = null;
    this.warn = null;
    // Powered until the energy field says otherwise. An INACTIVE (browned-out)
    // tower stops firing and shows a warning; the scene drives this via
    // setPowered() whenever the field is recomputed.
    this.powered = true;
    this.defaultLeft = (def.facing ?? 'left') === 'left';

    this.sprite = scene.add.sprite(0, 0, def.textureKey);
    this.sprite.setOrigin(def.originX ?? 0.5, def.originY ?? 0.92);

    // Scale real art to a target on-screen height (placeholders stay 1:1).
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

  // World position of the barrel tip, mirrored to the side we're facing.
  muzzlePosition(faceRight) {
    const m = this.def.muzzle;
    let mx, my;
    if (m && m.xFrac != null) {
      mx = m.xFrac * this.sprite.displayWidth;
      my = m.yFrac * this.sprite.displayHeight;
    } else if (m) {
      mx = m.x; my = m.y;
    } else {
      mx = 0; my = this.sprite.displayHeight * 0.55;
    }
    return { x: this.x + (faceRight ? mx : -mx), y: this.y - my };
  }

  aimAt(target) {
    this.faceRight = target.x > this.x;
    this.sprite.setFlipX(this.defaultLeft ? this.faceRight : !this.faceRight);
  }

  update(delta, enemies, fire, audio) {
    // Conduits never attack; browned-out towers can't fire until repowered.
    if (this.def.noAttack || !this.powered) return;
    if (this.def.chargeTime) this.updateCharge(delta, enemies, fire, audio);
    else this.updateInstant(delta, enemies, fire, audio);
  }

  // Energy gate: when a tower's tile drops below its tier requirement it browns
  // out — tint red, dim, halt firing and raise a warning marker. Conduits are
  // sources, so they never brown out (their visual stays put).
  setPowered(on) {
    if (on === this.powered) return;
    this.powered = on;
    if (this.def.noAttack) return;
    if (on) {
      this.sprite.clearTint();
      this.sprite.setAlpha(1);
      this.hideWarn();
    } else {
      this.charge = 0;
      this.hideGlow();
      this.sprite.setTint(0xff5a5a);
      this.sprite.setAlpha(0.65);
      this.showWarn();
    }
  }

  // --- brownout warning marker ------------------------------------------
  showWarn() {
    if (!this.warn) {
      const top = -(this.sprite.displayHeight * (this.sprite.originY ?? 0.92) + 14);
      this.warn = this.scene.add.text(0, top, '⚠', {
        fontFamily: 'system-ui, sans-serif', fontSize: '28px',
        color: '#ffd23a', fontStyle: 'bold',
      }).setOrigin(0.5);
      this.warn.setShadow(0, 0, '#000000', 5);
      this.add(this.warn);
      this.warnTween = this.scene.tweens.add({
        targets: this.warn, alpha: { from: 1, to: 0.35 }, scale: { from: 1, to: 1.15 },
        duration: 520, yoyo: true, repeat: -1,
      });
    }
    this.warn.setVisible(true);
  }

  hideWarn() {
    if (this.warn) this.warn.setVisible(false);
  }

  // --- charge model (laser) ---------------------------------------------
  updateCharge(delta, enemies, fire, audio) {
    const target = selectTarget(this, enemies, this.rangePx);
    if (target) {
      this.aimAt(target);
      if (this.charge <= 0 && audio) audio.charge();
      this.charge += delta;
      this.updateGlow();
      if (this.charge >= this.def.chargeTime) {
        const m = this.muzzlePosition(this.faceRight);
        fire(this.def, m.x, m.y, target);
        this.fireFlash(m.x, m.y);
        this.charge = 0;
        this.hideGlow();
      }
    } else if (this.charge > 0) {
      // Lost the target mid-charge: bleed the charge back down.
      this.charge = Math.max(0, this.charge - delta * 2);
      if (this.charge <= 0) this.hideGlow();
      else this.updateGlow();
    }
  }

  // --- instant model (classic cooldown) ---------------------------------
  updateInstant(delta, enemies, fire, audio) {
    this.cooldown -= delta;
    if (this.cooldown > 0) return;
    const target = selectTarget(this, enemies, this.rangePx);
    if (!target) return;
    this.cooldown = this.def.fireRate;
    this.aimAt(target);
    const m = this.muzzlePosition(this.faceRight);
    fire(this.def, m.x, m.y, target);
    this.fireFlash(m.x, m.y);
    if (audio) audio.shoot();
  }

  // --- muzzle glow (charge feedback) ------------------------------------
  ensureGlow() {
    if (!this.glow) {
      this.glow = this.scene.add.sprite(this.x, this.y, 'spark');
      this.glow.setBlendMode(Phaser.BlendModes.ADD);
      this.glow.setTint(this.def.laserColor ?? this.def.accent);
      this.glow.setDepth(this.depth + DEPTH.effectBias);
    }
    this.glow.setVisible(true);
  }

  updateGlow() {
    this.ensureGlow();
    const m = this.muzzlePosition(this.faceRight);
    const p = Phaser.Math.Clamp(this.charge / this.def.chargeTime, 0, 1);
    this.glow.setPosition(m.x, m.y);
    this.glow.setScale(0.3 + p * 2.1);
    this.glow.setAlpha(0.2 + p * 0.8);
    this.glow.angle += 5; // subtle shimmer
  }

  hideGlow() {
    if (this.glow) this.glow.setVisible(false);
  }

  // Recoil + a bright flash at the muzzle when the shot goes off.
  fireFlash(x, y) {
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: this.baseScale * 0.9,
      scaleY: this.baseScale * 1.08,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    const flash = this.scene.add.sprite(x, y, 'spark');
    flash.setTint(this.def.laserColor ?? this.def.accent);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    flash.setDepth(this.depth + DEPTH.effectBias);
    this.scene.tweens.add({
      targets: flash,
      scale: { from: 3, to: 0 },
      duration: 180,
      onComplete: () => flash.destroy(),
    });
  }

  destroy(fromScene) {
    if (this.glow) { this.glow.destroy(); this.glow = null; }
    if (this.warnTween) { this.warnTween.stop(); this.warnTween = null; }
    super.destroy(fromScene);
  }
}
