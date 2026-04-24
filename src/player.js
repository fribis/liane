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
    this.jumpBoostRemaining = 0;
    this.airBlastRemaining = 0;
    this.bubbleCooldown = 0;       // Zeit bis zum nächsten Auto-Shot
  }

  activatePowerup(type, seconds) {
    if (type === 'airBlast') {
      this.airBlastRemaining = seconds;
      this.bubbleCooldown = 0;  // sofort erstes Geschoss
    } else {
      // jumpBoost (Standard)
      this.jumpBoostRemaining = seconds;
    }
  }

  get poweredUp() { return this.jumpBoostRemaining > 0; }
  get hasAirBlast() { return this.airBlastRemaining > 0; }
  // Für Aura/Rendering — sobald irgendein Buff aktiv ist
  get anyBuffActive() { return this.jumpBoostRemaining > 0 || this.airBlastRemaining > 0; }

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
    if (this.jumpBoostRemaining > 0) {
      this.jumpBoostRemaining = Math.max(0, this.jumpBoostRemaining - dt);
    }
    if (this.airBlastRemaining > 0) {
      this.airBlastRemaining = Math.max(0, this.airBlastRemaining - dt);
    }
    this.bubbleCooldown = Math.max(0, this.bubbleCooldown - dt);

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

    // Buff-Auren: jumpBoost = gold, airBlast = blau. Falls beide: Farben überlagern.
    if (this.anyBuffActive) {
      const pulse = 0.6 + 0.4 * Math.abs(Math.sin(this.runPhase * 0.8 + performance.now() / 200));
      if (this.poweredUp) {
        const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 38);
        grad.addColorStop(0, `rgba(255, 220, 120, ${0.55 * pulse})`);
        grad.addColorStop(1, 'rgba(255, 220, 120, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy + 2, 38, 0, Math.PI * 2);
        ctx.fill();
      }
      if (this.hasAirBlast) {
        const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 42);
        grad.addColorStop(0, `rgba(140, 220, 255, ${0.55 * pulse})`);
        grad.addColorStop(1, 'rgba(140, 220, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy + 2, 42, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // === Scribble-Charakter nach Vorbild IMG_1197 ===
    // Konstruktion:
    // - Rumpf: solider, leicht schiefer schwarzer Block (nicht exakt rechteckig)
    // - Kopf: ovale Birne, seitlich versetzt in Blickrichtung
    // - Wilde Frisur: mehrere abstehende Locken/Strähnen oben
    // - Gesicht: runder "O"-Mund oder breites Grinsen + großes Auge
    // - Dünne, wackelige Arme/Beine
    const runT = this.runPhase;
    // Schnelle, deterministische "Wackel"-Phase, damit das Scribble leicht lebt
    const wobble = (i) => Math.sin(runT * 0.4 + i * 1.7) * 0.6;

    // --- Rumpf: schwarzer schiefer Block mit handgezeichneten Kanten ---
    this.drawBody(ctx, cx, cy, f, wobble);

    // --- Kopf + Frisur + Gesicht --- (mittig, plus Trailing-Animation gegen Bewegungsrichtung)
    // Läuft rechts → Kopf wippt leicht nach hinten (links); läuft links → nach hinten (rechts).
    // Beim Springen / Schwingen ebenfalls sanft gegen vx versetzt.
    const speedFrac = Math.max(-1, Math.min(1, this.vx / MOVE_SPEED));
    const headTilt = -speedFrac * 2.8;  // max ±2.8 px Versatz
    const headBob  = Math.abs(speedFrac) * 0.6;  // winziges Nicken nach unten wenn in Bewegung
    const headX = cx + headTilt;
    const headY = cy - 9 + headBob;
    this.drawHead(ctx, headX, headY, f, swinging);

    // --- Arme ---
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (swinging) {
      // Beide Arme nach oben zur Liane — handgezeichnet, leicht auseinander.
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 3);
      ctx.quadraticCurveTo(cx - 6, cy - 10, cx - 2, cy - 16);
      ctx.moveTo(cx + 5, cy - 3);
      ctx.quadraticCurveTo(cx + 6, cy - 10, cx + 2, cy - 16);
      ctx.stroke();
      // Kleine Fäustchen
      ctx.fillStyle = 'rgba(255, 220, 190, 0.95)';
      ctx.beginPath(); ctx.arc(cx - 2, cy - 16, 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + 2, cy - 16, 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      const armSwing = this.onGround ? Math.sin(runT) * 6 : -2;
      // Hinterer Arm (Schulter) — nach hinten schwingend
      ctx.beginPath();
      ctx.moveTo(cx - 4 * f, cy - 3);
      ctx.quadraticCurveTo(cx - 9 * f, cy + 2, cx - 10 * f, cy + 8 - armSwing * f);
      // Vorderer Arm — nach vorn schwingend
      ctx.moveTo(cx + 4 * f, cy - 3);
      ctx.quadraticCurveTo(cx + 8 * f, cy + 1, cx + 10 * f, cy + 6 + armSwing * f);
      ctx.stroke();
    }

    // --- Beine ---
    const legSwing = this.onGround && Math.abs(this.vx) > 20 ? Math.sin(runT) * 5 : 0;
    if (this.ducking) {
      // Hocke: kurze geknickte Beine
      const footY = this.y + this.h;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy + 5);
      ctx.quadraticCurveTo(cx - 8, cy + 9, cx - 7, footY);
      ctx.moveTo(cx + 4, cy + 5);
      ctx.quadraticCurveTo(cx + 8, cy + 9, cx + 7, footY);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy + 11);
      ctx.quadraticCurveTo(cx - 5 + legSwing * 0.5, cy + 16, cx - 6 + legSwing, cy + 20);
      ctx.moveTo(cx + 4, cy + 11);
      ctx.quadraticCurveTo(cx + 5 - legSwing * 0.5, cy + 16, cx + 6 - legSwing, cy + 20);
      ctx.stroke();
      // Kleine Füße als kurze horizontale Striche
      ctx.beginPath();
      ctx.moveTo(cx - 6 + legSwing, cy + 20);
      ctx.lineTo(cx - 3 + legSwing, cy + 20);
      ctx.moveTo(cx + 6 - legSwing, cy + 20);
      ctx.lineTo(cx + 3 - legSwing, cy + 20);
      ctx.stroke();
    }
  }

  // Rumpfkasten — schief und handgemalt, einfarbig schwarz wie im Scribble
  drawBody(ctx, cx, cy, f, wobble) {
    const w = 15, h = 18;
    const x = cx - w / 2;
    const y = cy - 6;
    // Leichter "Tilt" beim Laufen (ein paar Grad)
    const tilt = Math.sin(this.runPhase) * 0.05 * (this.onGround ? 1 : 0) * f;
    ctx.save();
    ctx.translate(cx, cy + 3);
    ctx.rotate(tilt);
    ctx.translate(-cx, -(cy + 3));

    // Solider Rumpf — Füllung
    ctx.fillStyle = '#1a1a22';
    ctx.beginPath();
    ctx.moveTo(x + wobble(1), y + wobble(2));
    ctx.lineTo(x + w + wobble(3), y + 1 + wobble(4));
    ctx.lineTo(x + w - 0.5 + wobble(5), y + h + wobble(6));
    ctx.lineTo(x + 0.5 + wobble(7), y + h - 0.5 + wobble(8));
    ctx.closePath();
    ctx.fill();

    // Handgezeichnete dunkle Kontur
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Kleiner Knopf/Kragen in der Mitte, damit der Rumpf nicht zu eintönig wirkt
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, y + 2);
    ctx.lineTo(cx, y + h - 2);
    ctx.stroke();

    ctx.restore();
  }

  // Kopf: ovale Birne, wilde Haare oben, großes expressives Gesicht
  drawHead(ctx, hx, hy, f, swinging) {
    const rw = 6.2, rh = 7.2;

    // Kontur/Füllung des Kopfes (leicht asymmetrisch wie im Scribble)
    ctx.fillStyle = '#fae2bf';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    // Eigene Kurve statt Ellipse, damit der Kopf "handgezogen" wirkt
    ctx.moveTo(hx - rw, hy + 1);
    ctx.bezierCurveTo(hx - rw - 0.5, hy - rh, hx - 1, hy - rh - 1, hx + 1, hy - rh);
    ctx.bezierCurveTo(hx + rw + 0.5, hy - rh, hx + rw + 1, hy - 1, hx + rw, hy + 2);
    ctx.bezierCurveTo(hx + rw - 1, hy + rh, hx - 1, hy + rh + 0.5, hx - rw + 0.5, hy + rh - 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Wilde Haare: 5 zackige Strähnen, gleich abstehend wie im Scribble
    ctx.strokeStyle = '#17171e';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#17171e';

    // Wilde Locken: jede Strähne ist eine kleine Schleife (wie die Locken im Scribble).
    // Kein spitzes Haar, sondern abstehende, gekringelte Büschel.
    ctx.lineWidth = 2;
    const curls = [
      { bx: -4.5, by: -rh * 0.7,  r: 2.4 },
      { bx: -2,   by: -rh * 1.15, r: 2.0 },
      { bx:  1.5, by: -rh * 1.25, r: 2.2 },
      { bx:  4.5, by: -rh * 0.85, r: 2.1 },
      { bx:  5.5, by: -rh * 0.2,  r: 1.8 },
    ];
    for (const c of curls) {
      const tipX = hx + c.bx;
      const tipY = hy + c.by;
      // Kleine Lockenschleife — nicht ganz geschlossen, wirkt wie ein Haarbüschel
      ctx.beginPath();
      ctx.moveTo(tipX - c.r * 0.8, tipY + c.r * 0.5);
      ctx.bezierCurveTo(
        tipX - c.r * 1.3, tipY - c.r * 0.8,
        tipX + c.r * 1.3, tipY - c.r * 0.8,
        tipX + c.r * 0.8, tipY + c.r * 0.5
      );
      ctx.stroke();
      // Kleine "Locken-Mitte" als dichter Punkt
      ctx.beginPath();
      ctx.arc(tipX, tipY + c.r * 0.2, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Gesicht (sieht in `f`-Richtung)
    // Auge: runder weißer Kreis mit schwarzer Pupille
    const eyeX = hx + 1.8 * f;
    const eyeY = hy - 0.5;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(eyeX + 0.3 * f, eyeY + 0.2, 0.85, 0, Math.PI * 2);
    ctx.fill();

    // Augenbraue über dem Auge (gibt Charakter)
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(eyeX - 2, eyeY - 2.4);
    ctx.quadraticCurveTo(eyeX, eyeY - 3, eyeX + 2, eyeY - 2.4);
    ctx.stroke();

    // Mund: je nach Zustand — beim Schwingen ein "o", sonst breites Grinsen
    ctx.lineWidth = 1.3;
    if (swinging) {
      ctx.fillStyle = '#5a2a2a';
      ctx.beginPath();
      ctx.ellipse(hx + 2 * f, hy + 3, 1.4, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.stroke();
    } else {
      // Grinsen: nach oben geöffneter Bogen mit kleiner Zahnandeutung
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(hx + 0 * f, hy + 2.5);
      ctx.quadraticCurveTo(hx + 2.5 * f, hy + 4.5, hx + 4.5 * f, hy + 2.5);
      ctx.stroke();
      // Mundinnenraum — kleiner dunkler Strich als "offener Mund"
      ctx.strokeStyle = 'rgba(100, 30, 30, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx + 1 * f, hy + 3);
      ctx.lineTo(hx + 4 * f, hy + 3);
      ctx.stroke();
    }

    // Kleiner Nasenpunkt (nicht immer in Skizze, aber verleiht Gesichtsform)
    ctx.fillStyle = 'rgba(200, 130, 90, 0.6)';
    ctx.beginPath();
    ctx.arc(hx + 3 * f, hy + 0.8, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}
