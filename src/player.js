// Held: Laufen, Springen, Schwingen an Lianen.

import { drawWobblyLine, wobblyPoints, fillBlob, nextSeed, INK, dot } from './render.js';
import { GRAVITY, MAX_FALL, MOVE_SPEED, AIR_CONTROL, JUMP_V, FRICTION, pointSegmentDist, resolvePlatform, aabbOverlap } from './physics.js';
import { isDown, wasPressed } from './input.js';

export class Player {
  constructor(x, y) {
    this.spawnX = x; this.spawnY = y;
    this.reset();
    this.seed = nextSeed();
    this.w = 22; this.h = 34;
  }

  reset() {
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.swing = null;    // { liana, angle, angVel, tAlongRope (0..1) }
    this.grabCooldown = 0;
    this.runPhase = 0;
    this.ducking = false;
    this.dead = false;
    this.powerupRemaining = 0;    // Sekunden — aktiv wenn > 0
  }

  activatePowerup(seconds) {
    this.powerupRemaining = seconds;
  }

  get poweredUp() { return this.powerupRemaining > 0; }

  // Center (für Liana-Reach-Test)
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  // Volle AABB (für Plattform-Kollisionen)
  get aabb() { return { x: this.x, y: this.y, w: this.w, h: this.h, vx: this.vx, vy: this.vy }; }

  // Trefferbox: beim Ducken deutlich kleiner (nur unterer Teil = Körper, nicht Kopf)
  get hitbox() {
    if (this.ducking) {
      return { x: this.x + 2, y: this.y + 16, w: this.w - 4, h: this.h - 16 };
    }
    return { x: this.x + 4, y: this.y + 4, w: this.w - 8, h: this.h - 8 };
  }

  update(dt, level) {
    this.grabCooldown = Math.max(0, this.grabCooldown - dt);
    if (this.powerupRemaining > 0) {
      this.powerupRemaining = Math.max(0, this.powerupRemaining - dt);
    }

    if (this.swing) {
      this.updateSwinging(dt, level);
    } else {
      this.updateFree(dt, level);
    }
  }

  updateFree(dt, level) {
    const leftDown = isDown('left');
    const rightDown = isDown('right');
    const up = isDown('up');
    const downKey = isDown('down');
    const jumpP = wasPressed('jump');

    // Ducken nur am Boden; blockiert Springen und verlangsamt etwas
    this.ducking = this.onGround && downKey;
    const moveSpeedNow = this.ducking ? MOVE_SPEED * 0.4 : MOVE_SPEED;

    if (this.onGround) {
      if (leftDown)  this.vx = -moveSpeedNow, this.facing = -1;
      else if (rightDown) this.vx = moveSpeedNow, this.facing = 1;
      else this.vx -= this.vx * Math.min(1, FRICTION * dt);
    } else {
      if (leftDown)  this.vx -= AIR_CONTROL * dt, this.facing = -1;
      if (rightDown) this.vx += AIR_CONTROL * dt, this.facing = 1;
      this.vx = Math.max(-MOVE_SPEED * 1.2, Math.min(MOVE_SPEED * 1.2, this.vx));
    }

    if (jumpP && this.onGround && !this.ducking) {
      // Power-up: deutlich höherer Sprung
      this.vy = this.poweredUp ? -JUMP_V * 1.45 : -JUMP_V;
      this.onGround = false;
    }

    // Schwerkraft
    this.vy += GRAVITY * dt;
    if (this.vy > MAX_FALL) this.vy = MAX_FALL;

    // Bewegung
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Plattformen kollidieren (Bäume sind nur visuell / für Skorpion, Held durchquert sie).
    // Bei aktivem Power-Up wird zusätzlich der Kappen-Top zum begehbaren Boden.
    this.onGround = false;
    for (const p of level.platforms) {
      const res = resolvePlatform(this, p);
      if (res.ground) this.onGround = true;
    }
    if (this.poweredUp) {
      for (const t of level.trees) {
        const res = resolvePlatform(this, t.canopyAABB);
        if (res.ground) this.onGround = true;
      }
    }

    // Level-Grenzen
    if (this.x < 0) { this.x = 0; this.vx = 0; }
    if (this.x + this.w > level.width) { this.x = level.width - this.w; this.vx = 0; }

    // Abgrund? Wenn y tief unter dem Level ist -> Tod
    if (this.y > level.height + 200) {
      this.dead = true;
    }

    // Lianen-Greifen: wenn in der Luft und jump-Taste gehalten wird
    if (!this.onGround && isDown('jump') && this.grabCooldown <= 0) {
      this.tryGrabLiana(level);
    }

    // Animation
    if (this.onGround && Math.abs(this.vx) > 20) this.runPhase += dt * 10;
  }

  tryGrabLiana(level) {
    let best = null;
    for (const l of level.lianas) {
      const tip = l.tipAt(l.angle);
      // Prüfe Distanz zu gesamtem Liniensegment
      const r = pointSegmentDist(this.cx, this.cy, l.anchorX, l.anchorY, tip.x, tip.y);
      if (r.dist < 45) {
        // Nicht zu weit oben greifen (nur untere 2/3)
        if (r.t > 0.3) {
          if (!best || r.dist < best.dist) best = { liana: l, ...r };
        }
      }
    }
    if (best) {
      const l = best.liana;
      const ropeLen = l.length * best.t;
      // Winkel aus aktueller Position relativ zum Anker
      const dx = this.cx - l.anchorX;
      const dy = this.cy - l.anchorY;
      const angle = Math.atan2(dx, dy); // 0 = unten, positiv = rechts
      // Anfangs-Winkelgeschwindigkeit aus Spieler-velocity tangential zum Seil
      // tangent-Richtung: senkrecht zum Seilvektor
      const tang = { x: Math.cos(angle), y: -Math.sin(angle) };
      const vTang = this.vx * tang.x + this.vy * tang.y;
      const angVel = vTang / ropeLen;
      this.swing = {
        liana: l,
        angle,
        angVel,
        t: best.t, // Position entlang des Seils (0 am Anker, 1 am Ende)
      };
      this.grabCooldown = 0.15;
    }
  }

  updateSwinging(dt, level) {
    const s = this.swing;
    const l = s.liana;
    const ropeLen = l.length * s.t;

    // Pump-Eingabe: während Schwingen bewegt Spieler seinen "Körper" vor/zurück -> erhöht Energie
    const leftDown = isDown('left');
    const rightDown = isDown('right');
    const up = isDown('up');
    const down = isDown('down');

    // Standard Pendel-Gleichung
    const g = GRAVITY;
    let acc = -(g / ropeLen) * Math.sin(s.angle);

    // Pump: abhängig von Winkelgeschwindigkeit und aktueller Seite
    const pumpForce = 3.5;
    if (rightDown) acc += pumpForce;
    if (leftDown)  acc -= pumpForce;

    s.angVel += acc * dt;
    // Dämpfung
    s.angVel *= (1 - 0.4 * dt);
    s.angle += s.angVel * dt;

    // Rauf/runter am Seil (ändert t)
    if (up && s.t > 0.2) s.t -= 0.6 * dt;
    if (down && s.t < 1.0) s.t += 0.9 * dt;

    // Aktuelle Position = Anker + Seilvektor
    const len = l.length * s.t;
    const px = l.anchorX + Math.sin(s.angle) * len;
    const py = l.anchorY + Math.cos(s.angle) * len;

    // Facing Richtung Bewegung
    this.facing = (Math.cos(s.angle) * s.angVel) > 0 ? 1 : -1;
    // (Math.cos(angle)*angVel = horizontale Geschwindigkeit pro Einheit Seillänge)
    this.x = px - this.w / 2;
    this.y = py - this.h / 2;

    // Liane-Winkel sichtbar auf der Liane-Instanz aktualisieren
    l.angle = s.angle;

    // Loslassen: nur wenn Jump-Taste losgelassen wurde (wasReleased), oder sie gar nicht mehr gehalten wird.
    // Ein erneutes Drücken während des Schwingens löst KEIN Loslassen aus, das wäre zu empfindlich.
    if (!isDown('jump')) {
      this.release();
    }
  }

  release() {
    const s = this.swing;
    if (!s) return;
    const l = s.liana;
    const len = l.length * s.t;
    // Tangentialgeschwindigkeit = angVel * len, senkrecht zum Seil
    const vTangMag = s.angVel * len;
    // Richtung tangential: (cos(angle), -sin(angle))
    this.vx = Math.cos(s.angle) * vTangMag;
    this.vy = -Math.sin(s.angle) * vTangMag;
    // Kleiner Extra-Kick nach oben
    this.vy -= 60;
    this.swing = null;
    this.grabCooldown = 0.25;
    // Liane federt zurück in Idle
    l.angVel = s.angVel * 0.3;
  }

  draw(ctx) {
    let cx = this.x + this.w / 2;
    let cy = this.y + this.h / 2;

    // Zeichnung vereinfachter Mensch: Rumpf (dunkler Kasten), Kopf mit Cap, Arme, Beine.
    // Spiegelung für facing
    const f = this.facing;

    // Schwing-Pose: Arme hoch wenn am Seil
    const swinging = !!this.swing;

    // Ducken: gesamten Körper kompakter, nach unten verschoben
    if (this.ducking) {
      cy = this.y + this.h - 10;
    }

    // Power-Up-Aura
    if (this.poweredUp) {
      const pulse = 0.6 + 0.4 * Math.abs(Math.sin(this.runPhase * 0.8 + performance.now() / 200));
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 38);
      grad.addColorStop(0, `rgba(255, 220, 120, ${0.55 * pulse})`);
      grad.addColorStop(1, 'rgba(255, 220, 120, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 38, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rumpf-Block (schwarzer Kasten, wie Scribble)
    const bodyX = cx - 8, bodyY = cy - 6;
    ctx.fillStyle = 'rgba(30, 30, 35, 0.92)';
    ctx.beginPath();
    ctx.rect(bodyX, bodyY, 16, 18);
    ctx.fill();

    // Kopf (Kreis)
    const headX = cx - 9 * f, headY = cy - 8;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.fillStyle = 'rgba(255, 228, 200, 0.95)';
    ctx.beginPath();
    ctx.arc(headX, headY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Mütze (blaue Kappe)
    ctx.fillStyle = 'rgba(60, 100, 160, 0.85)';
    ctx.beginPath();
    ctx.arc(headX, headY - 2, 6.2, Math.PI, 0);
    ctx.fill();
    // Mützenschirm
    ctx.fillRect(headX - 1 * f, headY - 1, 8 * f, 2);
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.arc(headX, headY - 2, 6.2, Math.PI, 0);
    ctx.stroke();

    // Gesicht (kleiner Punkt = Auge, kleiner Strich = Mund)
    dot(ctx, headX + 1 * f, headY, 1.3);
    ctx.beginPath();
    ctx.moveTo(headX + 1 * f, headY + 2);
    ctx.lineTo(headX + 3 * f, headY + 2);
    ctx.stroke();

    // Arme
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    if (swinging) {
      // Arme beide hoch zur Liane (am Seil)
      const s = this.swing;
      const l = s.liana;
      const handX = cx, handY = cy - 14;
      // Dummy: zwei Linien vom Rumpf nach oben
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 4);
      ctx.lineTo(cx - 2, handY);
      ctx.moveTo(cx + 4, cy - 4);
      ctx.lineTo(cx + 2, handY);
      ctx.stroke();
    } else {
      // Arme seitlich, leicht animiert beim Laufen
      const t = this.runPhase;
      const armSwing = this.onGround ? Math.sin(t) * 6 : 0;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 2);
      ctx.lineTo(cx - 10, cy + 8 + armSwing);
      ctx.moveTo(cx + 4, cy - 2);
      ctx.lineTo(cx + 10, cy + 8 - armSwing);
      ctx.stroke();
    }

    // Beine
    const legT = this.runPhase;
    const legSwing = this.onGround && Math.abs(this.vx) > 20 ? Math.sin(legT) * 5 : 0;
    if (this.ducking) {
      // Hocke: kurze geknickte Beine
      const footY = this.y + this.h;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy + 6);
      ctx.lineTo(cx - 7, footY);
      ctx.moveTo(cx + 4, cy + 6);
      ctx.lineTo(cx + 7, footY);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy + 12);
      ctx.lineTo(cx - 6 + legSwing, cy + 20);
      ctx.moveTo(cx + 4, cy + 12);
      ctx.lineTo(cx + 6 - legSwing, cy + 20);
      ctx.stroke();
    }
  }
}
