// Spinne: hängt an einem Seidenfaden von einem Ankerpunkt,
// bewegt sich langsam hoch und runter. Kann durch Aufspringen besiegt werden
// (Mario-Stil: Spieler fällt von oben → Spinne stirbt, Spieler bekommt Sprung-Bounce).

import { drawWobblyLine, wobblyPoints, nextSeed, INK } from '../render.js';

export class Spider {
  constructor({ anchorX, anchorY, minLen = 80, maxLen = 200, speed = 1.2 }) {
    this.anchorX = anchorX;
    this.anchorY = anchorY;
    this.minLen = minLen;
    this.maxLen = maxLen;
    this.speed = speed;
    this.phase = Math.random() * Math.PI * 2;
    this.dead = false;
    this.seed = nextSeed();
    this.legWobble = 0;
    this.w = 28; this.h = 22;
  }

  currentLen(t) {
    const tn = (Math.sin(this.phase + t * this.speed) + 1) * 0.5; // 0..1
    return this.minLen + (this.maxLen - this.minLen) * tn;
  }

  get x() {
    return this.anchorX;
  }
  get y() {
    // Live-berechnet — nicht gespeichert.
    const len = this.currentLen(performance.now() / 1000);
    return this.anchorY + len;
  }

  // Hitbox (ohne Beine, nur Körper)
  get aabb() {
    return {
      x: this.x - this.w / 2,
      y: this.y - this.h / 2,
      w: this.w,
      h: this.h,
    };
  }

  // Extra: obere Stomp-Zone — Spieler muss von oben reinfallen, um Kill zu triggern.
  get stompZone() {
    return {
      x: this.x - this.w / 2,
      y: this.y - this.h / 2,
      w: this.w,
      h: 10,     // oberer Streifen
    };
  }

  update(dt, player) {
    if (this.dead) return;
    this.legWobble += dt * 6;
  }

  draw(ctx) {
    if (this.dead) return;
    const now = performance.now() / 1000;
    const len = this.currentLen(now);
    const bx = this.anchorX;
    const by = this.anchorY + len;

    // Seidenfaden
    ctx.strokeStyle = 'rgba(240, 240, 240, 0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.anchorX, this.anchorY);
    ctx.lineTo(bx, by - this.h / 2);
    ctx.stroke();

    // Körper (ovaler Blob)
    ctx.fillStyle = '#15151a';
    ctx.beginPath();
    ctx.ellipse(bx, by, this.w * 0.4, this.h * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Kopf (kleiner Kreis)
    ctx.fillStyle = '#25252e';
    ctx.beginPath();
    ctx.arc(bx, by + this.h * 0.25, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Augen (rot, böse)
    ctx.fillStyle = '#ff5030';
    ctx.beginPath();
    ctx.arc(bx - 2, by + this.h * 0.22, 1.3, 0, Math.PI * 2);
    ctx.arc(bx + 2, by + this.h * 0.22, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Beine (8, geknickt, leicht zappelnd)
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    const wobble = Math.sin(this.legWobble) * 2;
    for (let i = 0; i < 4; i++) {
      const t = -0.8 + i * 0.55;
      const sign = i % 2 === 0 ? -1 : 1;
      // Oberes Beinsegment
      const ox = bx;
      const oy = by;
      const k1x = bx + Math.cos(t) * 10;
      const k1y = by + Math.sin(t) * 6 - 2;
      const tipx = bx + Math.cos(t) * 16 + sign * wobble;
      const tipy = by + Math.sin(t) * 14 + wobble;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(k1x, k1y);
      ctx.lineTo(tipx, tipy);
      ctx.stroke();

      // Gespiegelt auf andere Seite
      const t2 = Math.PI - t;
      const k2x = bx + Math.cos(t2) * 10;
      const k2y = by + Math.sin(t2) * 6 - 2;
      const tip2x = bx + Math.cos(t2) * 16 - sign * wobble;
      const tip2y = by + Math.sin(t2) * 14 + wobble;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(k2x, k2y);
      ctx.lineTo(tip2x, tip2y);
      ctx.stroke();
    }
  }
}
