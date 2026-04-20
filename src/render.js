// Scribble-Render-Utilities — wackelige Linien, lockerer Zeichenstil.

export const INK = '#1a1a2e';
export const PAPER = '#fafaf5';

// Seeded RNG, damit Jitter stabil bleibt (kein Flackern).
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let globalSeed = 1;
export function nextSeed() { return ++globalSeed; }

// Cache: für eine (seed, pointsHash) Kombination die verrauschten Punkte.
export function wobblyPoints(seed, points, jitter = 1.8) {
  const rng = mulberry32(seed);
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    // Endpunkte weniger verschieben, damit Formen passen
    const edge = (i === 0 || i === points.length - 1) ? 0.4 : 1.0;
    out.push([
      x + (rng() - 0.5) * 2 * jitter * edge,
      y + (rng() - 0.5) * 2 * jitter * edge,
    ]);
  }
  return out;
}

// Zeichnet eine Linie durch eine Punktfolge mit sanften Kurven (quadratic to midpoints).
export function drawWobblyLine(ctx, pts, opts = {}) {
  const { color = INK, width = 2, close = false } = opts;
  if (pts.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
  if (close) ctx.closePath();
  ctx.stroke();
}

export function fillBlob(ctx, pts, color) {
  if (pts.length < 3) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  ctx.closePath();
  ctx.fill();
}

// Elliptische Punktfolge (für Pilzhüte, Köpfe, Flecken).
export function ellipsePoints(cx, cy, rx, ry, n = 28, phase = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = phase + (i / n) * Math.PI * 2;
    out.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  return out;
}

// Rechteck als Punktfolge.
export function rectPoints(x, y, w, h) {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

// Hintergrund: Jungle-Szene mit Sky-Gradient, dunstigen Dschungelbäumen im Hintergrund,
// hängenden Blattsilhouetten und einem dunklen Grün am Boden.
// camX: Kamera-X für Parallax.
export function drawJungleBackground(ctx, w, h, camX) {
  // Helles, frisches Himmelsfarbschema (mehr Kontrast zu dunklen Charakteren)
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.00, '#fff5c8');   // warmes Cremegelb oben
  grad.addColorStop(0.35, '#e8f6a8');   // Lime
  grad.addColorStop(0.70, '#b5e08f');   // frisches Grasgrün
  grad.addColorStop(1.00, '#6bb65a');   // saftiges Bodengrün
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Ferne Bergkette — helles, frisches Limegrün
  drawDistantCanopy(ctx, w, h, camX * 0.08, '#b8d890', 0.55, 220);
  // Mittlere Baumkronen — sattes Grün
  drawDistantCanopy(ctx, w, h, camX * 0.2, '#7fc060', 0.7, 320);
  // Hängende Blätter von oben
  drawHangingLeaves(ctx, w, h, camX * 0.4);
  // Vordergrund-Blätter
  drawForegroundLeaves(ctx, w, h, camX * 0.6);
  // Dezenter Bodennebel (viel heller als vorher — keine Verdunklung)
  const floorGrad = ctx.createLinearGradient(0, h - 100, 0, h);
  floorGrad.addColorStop(0, 'rgba(240, 255, 200, 0)');
  floorGrad.addColorStop(1, 'rgba(240, 255, 200, 0.18)');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, h - 100, w, 100);
}

// Backwards-compat Alias (falls main.js noch alten Namen nutzt)
export const drawPaperBackground = drawJungleBackground;

function drawDistantCanopy(ctx, w, h, offset, color, alpha, topY) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  const step = 60;
  for (let x = -step; x <= w + step; x += step) {
    const worldX = x + offset;
    // Deterministische Wellen über x (keine echten Zufallszahlen, damit stabil beim Scrollen)
    const n1 = Math.sin(worldX * 0.013) * 40;
    const n2 = Math.sin(worldX * 0.037 + 1.3) * 24;
    const n3 = Math.sin(worldX * 0.007 + 2.4) * 60;
    const y = topY + n1 + n2 + n3;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w + step, h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHangingLeaves(ctx, w, h, offset) {
  ctx.save();
  ctx.globalAlpha = 0.85;
  const spacing = 130;
  const startX = -((offset % spacing) + spacing);
  for (let x = startX; x < w + spacing; x += spacing) {
    const worldX = x + offset;
    const baseY = 0;
    const height = 80 + (Math.sin(worldX * 0.02) + 1) * 50;
    drawLeaf(ctx, x + 12, baseY, height, '#5cb863', true);
    drawLeaf(ctx, x + 60, baseY, height * 0.7 + 30, '#82cb74', true);
    drawLeaf(ctx, x + 95, baseY, height * 0.55 + 20, '#4a9a4a', true);
  }
  ctx.restore();
}

function drawForegroundLeaves(ctx, w, h, offset) {
  ctx.save();
  ctx.globalAlpha = 0.9;
  const spacing = 260;
  const startX = -((offset % spacing) + spacing);
  for (let x = startX; x < w + spacing; x += spacing) {
    drawLeaf(ctx, x + 30, 0, 180, '#3d8a3e', true);
    drawLeaf(ctx, x + 210, 0, 140, '#306e30', true);
  }
  ctx.restore();
}

// Einzelnes hängendes Blatt (Tropfenform)
function drawLeaf(ctx, x, y, length, color, hanging = true) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const tipY = y + length;
  const mid = y + length * 0.55;
  const w = length * 0.35;
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + w, mid, x, tipY);
  ctx.quadraticCurveTo(x - w, mid, x, y);
  ctx.closePath();
  ctx.fill();
  // Mittelader
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, tipY - 3);
  ctx.stroke();
}

// Kleinen Punkt (Auge, Nase) zeichnen.
export function dot(ctx, x, y, r = 2, color = INK) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
