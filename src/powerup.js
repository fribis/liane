// Power-up Block: ein kariertes Rechteck in der Welt.
// Beim Einsammeln erhält der Held 10s lang:
//   - höheren Sprung
//   - kann oben auf den Baumkronen laufen

import { drawWobblyLine, wobblyPoints, nextSeed, INK } from './render.js';

export const POWERUP_DURATION = 10;   // Sekunden

export class PowerupBlock {
  constructor(x, y, w = 40, h = 40) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.collected = false;
    this.seed = nextSeed();
    this.bobT = Math.random() * Math.PI * 2;
    this.pulseT = 0;
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
    const bob = Math.sin(this.bobT) * 4;
    const x = this.x, y = this.y + bob;
    const w = this.w, h = this.h;

    // Sanfter Glow
    const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, 40);
    glow.addColorStop(0, 'rgba(255, 220, 120, 0.55)');
    glow.addColorStop(1, 'rgba(255, 220, 120, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 20, y - 20, w + 40, h + 40);

    // Füllung des Blocks
    ctx.fillStyle = 'rgba(250, 220, 130, 0.85)';
    ctx.fillRect(x, y, w, h);

    // Äußere wackelige Kontur
    const outer = wobblyPoints(this.seed, [
      [x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]
    ], 1.4);
    drawWobblyLine(ctx, outer, { color: INK, width: 2.6 });

    // Gitter: 3 vertikale + 3 horizontale Striche innen (wie im Scribble)
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    const seg = 4;
    for (let i = 1; i < seg; i++) {
      // vertikal
      const vx = x + (w * i) / seg;
      drawWobblyLine(ctx,
        wobblyPoints(this.seed + i * 7, [[vx, y + 2], [vx, y + h - 2]], 0.9),
        { color: INK, width: 1.8 });
      // horizontal
      const hy = y + (h * i) / seg;
      drawWobblyLine(ctx,
        wobblyPoints(this.seed + i * 13, [[x + 2, hy], [x + w - 2, hy]], 0.9),
        { color: INK, width: 1.8 });
    }

    // Leichter Schein (Highlight oben-links)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(x + 3, y + 3, 8, 4);
  }
}
