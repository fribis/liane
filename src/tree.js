// Verschiedene Baumarten, alle mit wackeligem Zeichenstil.
// Gemeinsames Interface: stumpAABB, canopyAABB, climbX(), draw(ctx).
// Unterklassen rendern unterschiedlich, haben aber eine gemeinsame "Cap-Geometrie"
// (cx, cyTop, rx, ry), über die Lianen-Anchor und Skorpion-Klettern abgeleitet werden.

import { drawWobblyLine, wobblyPoints, fillBlob, nextSeed, INK } from './render.js';

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Gemeinsame Basis
class TreeBase {
  constructor({ stumpX, baseY, topY, capW, capH }) {
    this.stumpX = stumpX;
    this.baseY = baseY;
    this.topY = topY;
    this.capW = capW;
    this.capH = capH;
    this.stumpW = 50;
    this.seed = nextSeed();
    this.rng = mulberry32(this.seed);
  }

  get stumpAABB() {
    return { x: this.stumpX - this.stumpW / 2, y: this.topY, w: this.stumpW, h: this.baseY - this.topY };
  }

  climbX() { return this.stumpX + this.stumpW / 2 + 2; }

  get canopyAABB() {
    return { x: this.stumpX - this.capW * 0.35, y: this.topY - this.capH * 0.55, w: this.capW * 0.7, h: 14 };
  }
}

// 1) Pilzbaum (organisch, wie bisher)
export class MushroomTree extends TreeBase {
  constructor(opts) {
    super(opts);
    this.capShape = this.buildCapShape();
    this.underShape = this.buildUnderShape();
    this.stumpLeft = this.buildStumpSide(-1);
    this.stumpRight = this.buildStumpSide(1);
    this.capSpots = this.buildSpots();
  }

  get canopyAABB() {
    const { cx, cyTop, rx } = this.capShape;
    return { x: cx - rx * 0.75, y: cyTop - 6, w: rx * 1.5, h: 14 };
  }

  buildCapShape() {
    const rng = this.rng;
    const cx = this.stumpX + (rng() - 0.5) * 10;
    const cyTop = this.topY - this.capH * 0.35;
    const rx = this.capW / 2;
    const ry = this.capH;
    const pts = [];
    const N = 22;
    for (let i = 0; i <= N; i++) {
      const t = Math.PI + (i / N) * Math.PI;
      const wobble = (rng() - 0.5) * ry * 0.18;
      const radial = 1 + (rng() - 0.5) * 0.08;
      const x = cx + Math.cos(t) * rx * radial;
      const y = cyTop + Math.sin(t) * ry * radial + wobble;
      pts.push([x, y]);
    }
    const underY = cyTop + ry * 0.95;
    const underN = 10;
    for (let i = 1; i <= underN; i++) {
      const u = i / (underN + 1);
      const x = cx + rx - u * 2 * rx;
      const y = underY + Math.sin(u * Math.PI * 2.2 + rng()) * 8 + (rng() - 0.5) * 6;
      pts.push([x, y]);
    }
    return { cx, cyTop, rx, ry, pts };
  }

  buildUnderShape() {
    const { cx, cyTop, rx, ry } = this.capShape;
    const rng = this.rng;
    const underY = cyTop + ry * 0.85;
    const lines = [];
    const count = 9 + Math.floor(rng() * 4);
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1);
      const x0 = cx + (u - 0.5) * rx * 1.6;
      const y0 = underY - 6 + (rng() - 0.5) * 5;
      const x1 = cx + (u - 0.5) * rx * 1.2 + (rng() - 0.5) * 6;
      const y1 = underY + 28 + (rng() - 0.5) * 6;
      lines.push([x0, y0, x1, y1]);
    }
    return lines;
  }

  buildStumpSide(sideSign) {
    const rng = this.rng;
    const half = this.stumpW / 2;
    const N = 8;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const y = this.baseY - t * (this.baseY - this.topY);
      const waist = Math.sin(t * Math.PI) * 6;
      const bulge = Math.cos(t * Math.PI * 1.5) * 4;
      const wobble = (rng() - 0.5) * 3;
      const x = this.stumpX + sideSign * (half + waist * 0.3 - bulge * 0.4) + wobble;
      pts.push([x, y]);
    }
    return pts;
  }

  buildSpots() {
    const rng = this.rng;
    const { cx, cyTop, rx, ry } = this.capShape;
    const n = 3 + Math.floor(rng() * 3);
    const out = [];
    for (let i = 0; i < n; i++) {
      const ang = (rng() * 0.7 + 0.15) * Math.PI;
      const r = rng() * 0.7;
      const x = cx + Math.cos(ang + Math.PI) * rx * r;
      const y = cyTop + Math.sin(ang + Math.PI) * ry * r + ry * 0.35;
      const sz = 6 + rng() * 8;
      out.push({ x, y, rx: sz, ry: sz * 0.7 });
    }
    return out;
  }

  draw(ctx) { this.drawStump(ctx); this.drawCap(ctx); }

  drawStump(ctx) {
    const fillPts = [...this.stumpLeft, ...this.stumpRight.slice().reverse()];
    // Opake Grundierung + leichte Tönung
    fillBlob(ctx, fillPts, '#a58260');
    fillBlob(ctx, fillPts, 'rgba(120, 85, 55, 0.35)');
    drawWobblyLine(ctx, this.stumpLeft,  { color: INK, width: 2.6 });
    drawWobblyLine(ctx, this.stumpRight, { color: INK, width: 2.6 });
    ctx.strokeStyle = 'rgba(70, 45, 25, 0.55)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      const t = 0.2 + i * 0.18;
      const y = this.baseY - t * (this.baseY - this.topY);
      const xL = this.stumpLeft[Math.round(t * (this.stumpLeft.length - 1))][0] + 4;
      const xR = this.stumpRight[Math.round(t * (this.stumpRight.length - 1))][0] - 4;
      ctx.beginPath();
      ctx.moveTo(xL, y);
      ctx.bezierCurveTo(xL + 15, y - 3 + (i % 2) * 4, xR - 15, y + 3 - (i % 2) * 4, xR, y);
      ctx.stroke();
    }
  }

  drawCap(ctx) {
    const shape = this.capShape;
    // Opake Grundfüllung (verhindert, dass Background-Blätter durchscheinen)
    fillBlob(ctx, wobblyPoints(this.seed, shape.pts, 1.4), '#d8b89a');
    // Farbige Überlagerung für den Rot-Ton
    fillBlob(ctx, wobblyPoints(this.seed, shape.pts, 1.4), 'rgba(175, 80, 80, 0.55)');
    drawWobblyLine(ctx, wobblyPoints(this.seed + 3, [...shape.pts, shape.pts[0]], 1.6),
      { color: INK, width: 2.6 });
    ctx.strokeStyle = 'rgba(80, 40, 40, 0.7)';
    ctx.lineWidth = 1.6;
    for (const [x0, y0, x1, y1] of this.underShape) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(x0 - 2, (y0 + y1) / 2, x1 + 2, (y0 + y1) / 2, x1, y1);
      ctx.stroke();
    }
    for (const s of this.capSpots) {
      ctx.fillStyle = 'rgba(250, 238, 220, 0.55)';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120, 70, 60, 0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

// 2) Laubbaum — buschige Mehrfach-Krone aus mehreren Blättertöpfen
export class LeafyTree extends TreeBase {
  constructor(opts) {
    super(opts);
    this.trunkLeft = this.buildTrunkSide(-1);
    this.trunkRight = this.buildTrunkSide(1);
    this.bunches = this.buildBunches();
    this.stumpW = 44;
  }

  get canopyAABB() {
    // Oberer Rand der höchsten Blätterkrone
    const top = this.bunches.reduce((m, b) => Math.min(m, b.y - b.ry), this.topY);
    return { x: this.stumpX - this.capW * 0.32, y: top + 2, w: this.capW * 0.64, h: 14 };
  }

  buildTrunkSide(sign) {
    const rng = this.rng;
    const half = this.stumpW / 2;
    const pts = [];
    const N = 7;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const y = this.baseY - t * (this.baseY - this.topY);
      const sway = Math.sin(t * 3 + sign) * 3;
      const wobble = (rng() - 0.5) * 3;
      const x = this.stumpX + sign * (half - t * 6) + sway + wobble;
      pts.push([x, y]);
    }
    return pts;
  }

  buildBunches() {
    const rng = this.rng;
    const bunches = [];
    const centerX = this.stumpX;
    const centerY = this.topY - 20;
    const n = 5 + Math.floor(rng() * 3);
    // zentraler großer Blätterball
    bunches.push({ x: centerX, y: centerY - this.capH * 0.3, rx: this.capW * 0.42, ry: this.capH * 0.55, color: '#4faa51' });
    // peripher mehrere kleinere
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng() * 0.8;
      const dist = this.capW * (0.2 + rng() * 0.2);
      const x = centerX + Math.cos(a) * dist;
      const y = centerY - this.capH * 0.2 + Math.sin(a) * dist * 0.6;
      bunches.push({
        x, y,
        rx: this.capW * (0.18 + rng() * 0.12),
        ry: this.capH * (0.28 + rng() * 0.18),
        color: i % 2 ? '#5cb75c' : '#448a45',
      });
    }
    return bunches;
  }

  draw(ctx) {
    // Stamm
    const trunkFill = [...this.trunkLeft, ...this.trunkRight.slice().reverse()];
    fillBlob(ctx, trunkFill, 'rgba(120, 82, 50, 0.7)');
    drawWobblyLine(ctx, this.trunkLeft,  { color: INK, width: 2.4 });
    drawWobblyLine(ctx, this.trunkRight, { color: INK, width: 2.4 });
    // Ein paar Baum-Risse/Maserungen
    ctx.strokeStyle = 'rgba(60, 40, 25, 0.6)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      const t = 0.3 + i * 0.2;
      const y = this.baseY - t * (this.baseY - this.topY);
      ctx.beginPath();
      ctx.moveTo(this.stumpX - 10, y);
      ctx.quadraticCurveTo(this.stumpX, y + 4, this.stumpX + 10, y - 2);
      ctx.stroke();
    }

    // Blattbüschel
    for (const b of this.bunches) {
      // Füllung
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.rx, b.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      // Kontur leicht
      ctx.strokeStyle = 'rgba(30, 50, 30, 0.65)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // kleine Highlight-Punkte
      ctx.fillStyle = 'rgba(200, 230, 170, 0.55)';
      ctx.beginPath();
      ctx.ellipse(b.x - b.rx * 0.35, b.y - b.ry * 0.3, b.rx * 0.3, b.ry * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// 3) Palme — lange schmale Krone aus radialen Wedeln
export class PalmTree extends TreeBase {
  constructor(opts) {
    super(opts);
    this.stumpW = 30;
    this.trunk = this.buildTrunk();
    this.fronds = this.buildFronds();
    this.coconuts = this.buildCoconuts();
  }

  get canopyAABB() {
    // Palmen haben keine soliden Wipfel — aber wir geben trotzdem eine schmale begehbare
    // Zone am obersten Stammende, damit Power-Up auch hier einen Sinn hat.
    return { x: this.stumpX - 24, y: this.topY - 8, w: 48, h: 12 };
  }

  buildTrunk() {
    const rng = this.rng;
    // Palme leicht gekrümmt (Bogen)
    const lean = (rng() - 0.5) * 40;
    const pts = [];
    const N = 10;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const y = this.baseY - t * (this.baseY - this.topY);
      const curve = Math.sin(t * Math.PI) * lean;
      pts.push([this.stumpX + curve, y]);
    }
    return { pts, lean };
  }

  buildFronds() {
    const rng = this.rng;
    const fronds = [];
    const top = this.trunk.pts[this.trunk.pts.length - 1];
    const n = 7 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i / (n - 1) - 0.5) * Math.PI * 1.2 + (rng() - 0.5) * 0.15;
      const len = this.capW * 0.45 + rng() * 30;
      const droop = 0.4 + rng() * 0.3;
      fronds.push({ angle: ang, length: len, droop, anchor: top });
    }
    return fronds;
  }

  buildCoconuts() {
    const top = this.trunk.pts[this.trunk.pts.length - 1];
    const rng = this.rng;
    const n = 2 + Math.floor(rng() * 3);
    const cocos = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng();
      cocos.push({ x: top[0] + Math.cos(a) * 10, y: top[1] + 8 + Math.sin(a) * 4 });
    }
    return cocos;
  }

  draw(ctx) {
    // Stamm: dünner, mit horizontalen Ringen
    const pts = this.trunk.pts;
    ctx.strokeStyle = 'rgba(120, 85, 55, 0.85)';
    ctx.lineWidth = this.stumpW;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.stroke();
    // Kontur
    drawWobblyLine(ctx, pts.map(([x, y]) => [x - this.stumpW / 2 + 1, y]), { color: INK, width: 2 });
    drawWobblyLine(ctx, pts.map(([x, y]) => [x + this.stumpW / 2 - 1, y]), { color: INK, width: 2 });
    // Ringe
    ctx.strokeStyle = 'rgba(70, 45, 25, 0.75)';
    ctx.lineWidth = 1.4;
    for (let i = 1; i < pts.length - 1; i += 1) {
      const [x, y] = pts[i];
      ctx.beginPath();
      ctx.moveTo(x - this.stumpW / 2 + 2, y);
      ctx.quadraticCurveTo(x, y + 3, x + this.stumpW / 2 - 2, y);
      ctx.stroke();
    }

    // Kokosnüsse
    for (const c of this.coconuts) {
      ctx.fillStyle = 'rgba(70, 50, 30, 0.95)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Wedel (gefiederte Blätter)
    for (const f of this.fronds) {
      this.drawFrond(ctx, f);
    }
  }

  drawFrond(ctx, f) {
    const { anchor, angle, length, droop } = f;
    const [ax, ay] = anchor;
    // Mittelrippe als Bézier (durchhängend)
    const tipX = ax + Math.cos(angle) * length;
    const tipY = ay + Math.sin(angle) * length;
    const cX = ax + Math.cos(angle) * length * 0.6;
    const cY = ay + Math.sin(angle) * length * 0.6 + length * droop * 0.35;
    ctx.strokeStyle = 'rgba(70, 140, 60, 0.95)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(cX, cY, tipX, tipY);
    ctx.stroke();

    // Fiederblättchen links/rechts der Rippe
    const steps = 8;
    ctx.strokeStyle = 'rgba(85, 160, 75, 0.95)';
    ctx.lineWidth = 2.4;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      // Punkt auf Bézier
      const bx = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cX + t * t * tipX;
      const by = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cY + t * t * tipY;
      // Senkrechte auf Rippe
      const d = { x: Math.sin(angle), y: -Math.cos(angle) };
      const bladeLen = 14 + t * 22;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + d.x * bladeLen, by + d.y * bladeLen + 4);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - d.x * bladeLen, by - d.y * bladeLen + 4);
      ctx.stroke();
    }
  }
}

// Default-Export: Factory, die je nach Typ die richtige Klasse anlegt.
export function makeTree(spec) {
  const t = spec.type || 'mushroom';
  if (t === 'leafy') return new LeafyTree(spec);
  if (t === 'palm')  return new PalmTree(spec);
  return new MushroomTree(spec);
}

// Rückwärtskompatibilität: Tree = MushroomTree
export const Tree = MushroomTree;
