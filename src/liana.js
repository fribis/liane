// Liane — Pendel-Ankerpunkt + Rendering.

import { drawWobblyLine, wobblyPoints, nextSeed, INK } from './render.js';

export class Liana {
  constructor(anchorX, anchorY, length) {
    this.anchorX = anchorX;
    this.anchorY = anchorY;
    this.length = length;
    this.seed = nextSeed();
    // Aktueller Winkel (nur für Idle-Sway-Darstellung, wenn nicht gegriffen)
    this.angle = 0;
    this.angVel = 0;
    this.idleTime = Math.random() * Math.PI * 2;
  }

  // Endposition für einen Winkel
  tipAt(angle) {
    return {
      x: this.anchorX + Math.sin(angle) * this.length,
      y: this.anchorY + Math.cos(angle) * this.length,
    };
  }

  // Nicht-interaktive Liane wackelt sanft im Wind.
  updateIdle(dt) {
    this.idleTime += dt;
    this.angle = Math.sin(this.idleTime * 0.9) * 0.08;
  }

  draw(ctx, grabbed, grabT) {
    // Seil als gewellte Linie vom Anker zur Spitze, mit dichten Segmenten (damit's biegsam aussieht).
    const segs = 10;
    const basePts = [];
    const tip = this.tipAt(this.angle);
    // Leichte Kurve (Durchhängen): quadratische Interpolation mit Kontrollpunkt
    const cx = (this.anchorX + tip.x) / 2 - Math.sin(this.angle) * 6;
    const cy = (this.anchorY + tip.y) / 2 + 14;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = (1 - t) * (1 - t) * this.anchorX + 2 * (1 - t) * t * cx + t * t * tip.x;
      const y = (1 - t) * (1 - t) * this.anchorY + 2 * (1 - t) * t * cy + t * t * tip.y;
      basePts.push([x, y]);
    }
    const pts = wobblyPoints(this.seed, basePts, 1.2);
    drawWobblyLine(ctx, pts, { color: 'rgba(80, 110, 60, 0.95)', width: 3 });

    // Ranken-Blätter (Büschel entlang der Liane).
    this.drawLeaves(ctx, pts);

    // Anker als kleiner Knoten.
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(this.anchorX, this.anchorY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawLeaves(ctx, pts) {
    ctx.strokeStyle = 'rgba(70, 110, 50, 0.8)';
    ctx.lineWidth = 1.5;
    // Ein paar kleine Zickzack-Ranken
    for (let i = 2; i < pts.length - 1; i += 3) {
      const [x, y] = pts[i];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 8, y + 3);
      ctx.lineTo(x + 4, y + 8);
      ctx.moveTo(x, y);
      ctx.lineTo(x - 8, y + 3);
      ctx.lineTo(x - 4, y + 8);
      ctx.stroke();
    }
  }
}
