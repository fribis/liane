// Zielfahne: Stein-/Sandhaufen-Basis + Pfahl + gezacktes Banner.

import { drawWobblyLine, wobblyPoints, fillBlob, nextSeed, INK } from './render.js';

export class Flag {
  constructor(x, groundY) {
    this.x = x;
    this.groundY = groundY;
    this.height = 220;         // Pfahl-Höhe
    this.seed = nextSeed();
    this.waveT = 0;
  }

  get collisionAABB() {
    return {
      x: this.x - 4,
      y: this.groundY - this.height,
      w: 16,
      h: this.height + 10,
    };
  }

  update(dt) { this.waveT += dt; }

  draw(ctx) {
    const { x, groundY, height } = this;

    // Stein-/Sandhaufen (Dreieck mit Kieseln)
    const baseY = groundY;
    const triPts = [
      [x - 48, baseY],
      [x - 8, baseY - 40],
      [x + 45, baseY],
    ];
    fillBlob(ctx, wobblyPoints(this.seed, triPts, 2), 'rgba(200, 175, 120, 0.55)');
    drawWobblyLine(ctx, wobblyPoints(this.seed + 1, [...triPts, triPts[0]], 1.8), { color: INK, width: 2 });

    // Kieselpunkte im Haufen
    ctx.fillStyle = 'rgba(90, 60, 40, 0.7)';
    const dots = [
      [x - 20, baseY - 8],
      [x - 5, baseY - 20],
      [x + 12, baseY - 12],
      [x + 28, baseY - 4],
      [x - 30, baseY - 3],
      [x + 2, baseY - 5],
    ];
    for (const [dx, dy] of dots) {
      ctx.beginPath();
      ctx.arc(dx, dy, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Stein links neben dem Haufen
    const rockCX = x - 60, rockCY = baseY - 14;
    ctx.fillStyle = 'rgba(140, 130, 120, 0.55)';
    ctx.beginPath();
    ctx.ellipse(rockCX, rockCY, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    drawWobblyLine(ctx,
      wobblyPoints(this.seed + 2, [
        [rockCX - 18, rockCY + 2],
        [rockCX - 14, rockCY - 12],
        [rockCX, rockCY - 14],
        [rockCX + 15, rockCY - 10],
        [rockCX + 18, rockCY + 2],
      ], 1.3),
      { color: INK, width: 2 });

    // Pfahl
    const poleTop = groundY - height;
    drawWobblyLine(ctx,
      wobblyPoints(this.seed + 3, [[x, groundY - 4], [x - 1, (groundY + poleTop) / 2], [x + 1, poleTop]], 1.2),
      { color: INK, width: 3.5 });

    // Banner (gezacktes Rechteck mit zwei Einschnitten, wie IMG_1198 oben zeigt)
    this.drawBanner(ctx, x, poleTop);
  }

  drawBanner(ctx, poleX, poleTop) {
    const bannerH = 70;
    const bannerW = 110;
    // Wellen-Animation: sanftes horizontales Auslenken der Tips
    const wave = Math.sin(this.waveT * 3) * 4;

    // Rand des Banners — mit zwei Einschnitten an der rechten Seite (wie Krenelage auf der Seite)
    const notch = 14;
    const pts = [
      [poleX, poleTop + 2],
      [poleX + bannerW + wave * 0.4, poleTop + 4],
      [poleX + bannerW - notch + wave * 0.5, poleTop + bannerH * 0.22],
      [poleX + bannerW + wave * 0.6, poleTop + bannerH * 0.44],
      [poleX + bannerW - notch + wave * 0.7, poleTop + bannerH * 0.66],
      [poleX + bannerW + wave * 0.8, poleTop + bannerH * 0.88],
      [poleX, poleTop + bannerH],
    ];

    // Füllung
    fillBlob(ctx, wobblyPoints(this.seed + 4, pts, 1.4), 'rgba(200, 60, 60, 0.6)');

    // Kontur
    drawWobblyLine(ctx, wobblyPoints(this.seed + 5, [...pts, pts[0]], 1.4), { color: INK, width: 2.2 });

    // Banner-Motiv: kleines Pilz-Symbol in der Mitte
    const mx = poleX + 40, my = poleTop + bannerH * 0.5;
    ctx.strokeStyle = 'rgba(255, 240, 230, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my - 6, 10, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 4, my - 6);
    ctx.lineTo(mx - 4, my + 8);
    ctx.moveTo(mx + 4, my - 6);
    ctx.lineTo(mx + 4, my + 8);
    ctx.stroke();
  }
}
