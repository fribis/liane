// Power-up-Blöcke. Zwei Typen:
// - 'jumpBoost' (Standard, kariertes Gitter-Kasten): 10s höherer Sprung + Baumkronen begehbar
// - 'airBlast'  (selten, runder Tupfen-Ball): 10s automatisches Luftblasen-Schießen,
//   getroffene Gegner fliegen nach oben weg

import { drawWobblyLine, wobblyPoints, nextSeed, INK } from './render.js';

export const POWERUP_DURATION = 10;   // Sekunden

export class PowerupBlock {
  constructor(x, y, w = 40, h = 40, type = 'jumpBoost') {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.type = type;
    this.collected = false;
    this.seed = nextSeed();
    this.bobT = Math.random() * Math.PI * 2;
    this.pulseT = 0;
    // Tupfen-Positionen (nur für airBlast) — einmal zufällig, dann fix
    if (type === 'airBlast') {
      this.spots = this.buildSpots();
    }
  }

  get aabb() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  update(dt) {
    this.bobT += dt * 2;
    this.pulseT += dt;
  }

  draw(ctx) {
    if (this.collected) return;
    if (this.type === 'airBlast') this.drawAirBlast(ctx);
    else this.drawJumpBoost(ctx);
  }

  drawJumpBoost(ctx) {
    const bob = Math.sin(this.bobT) * 4;
    const x = this.x, y = this.y + bob;
    const w = this.w, h = this.h;

    // Sanfter Glow
    const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, 40);
    glow.addColorStop(0, 'rgba(255, 220, 120, 0.55)');
    glow.addColorStop(1, 'rgba(255, 220, 120, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 20, y - 20, w + 40, h + 40);

    // Füllung
    ctx.fillStyle = 'rgba(250, 220, 130, 0.85)';
    ctx.fillRect(x, y, w, h);

    // Kontur
    const outer = wobblyPoints(this.seed, [
      [x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]
    ], 1.4);
    drawWobblyLine(ctx, outer, { color: INK, width: 2.6 });

    // Gitter
    const seg = 4;
    for (let i = 1; i < seg; i++) {
      const vx = x + (w * i) / seg;
      drawWobblyLine(ctx,
        wobblyPoints(this.seed + i * 7, [[vx, y + 2], [vx, y + h - 2]], 0.9),
        { color: INK, width: 1.8 });
      const hy = y + (h * i) / seg;
      drawWobblyLine(ctx,
        wobblyPoints(this.seed + i * 13, [[x + 2, hy], [x + w - 2, hy]], 0.9),
        { color: INK, width: 1.8 });
    }

    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(x + 3, y + 3, 8, 4);
  }

  // Runder Tupfenball — seltener "Luft blasen"-Powerup (Scribble IMG_1275)
  drawAirBlast(ctx) {
    const bob = Math.sin(this.bobT) * 5;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2 + bob;
    const r = Math.min(this.w, this.h) / 2;

    // Starker pulsierender Glow (seltenes Item!)
    const pulse = 0.6 + 0.4 * Math.abs(Math.sin(this.pulseT * 2));
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, r * 2.2);
    glow.addColorStop(0, `rgba(140, 220, 255, ${0.7 * pulse})`);
    glow.addColorStop(1, 'rgba(140, 220, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Hauptblase (leicht transparent, hellblau)
    ctx.fillStyle = 'rgba(180, 230, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Wackelige Kontur
    const pts = [];
    const N = 18;
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2;
      pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
    }
    drawWobblyLine(ctx, wobblyPoints(this.seed, pts, 1.5), { color: INK, width: 2.4 });

    // Innere Tupfen (wie die Punkte im Scribble)
    for (const s of this.spots) {
      ctx.fillStyle = 'rgba(60, 130, 180, 0.8)';
      ctx.beginPath();
      ctx.arc(cx + s.dx, cy + s.dy, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Highlight oben-links (Glanzpunkt)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.45, cy - r * 0.45, r * 0.2, r * 0.12, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  buildSpots() {
    // Pseudo-zufällige Tupfenpositionen innerhalb des Balls
    const s = this.seed;
    const r = Math.min(this.w, this.h) / 2;
    const out = [];
    const n = 5;
    for (let i = 0; i < n; i++) {
      const ang = ((s * 37 * (i + 1)) % 360) * Math.PI / 180;
      const dist = (((s * 91 * (i + 3)) % 100) / 100) * r * 0.55;
      out.push({
        dx: Math.cos(ang) * dist,
        dy: Math.sin(ang) * dist,
        r: 2.6 + ((s * 17 * (i + 2)) % 30) / 20,
      });
    }
    return out;
  }
}
