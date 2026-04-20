// UI-Overlays: Menü, Win, Lose + Timer-HUD.

import { INK } from './render.js';

export function formatTime(ms) {
  const totalMs = Math.max(0, Math.round(ms));
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const cs = Math.floor((totalMs % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

// Power-Up-Badge oben links (Oval mit zwei Pfeilen nach oben + Countdown),
// wie im Scribble IMG_1220 dargestellt.
export function drawPowerupHud(ctx, w, h, secondsLeft, totalSeconds) {
  const cx = 80;
  const cy = 56;
  const rx = 52;
  const ry = 38;
  // Oval-Hintergrund mit Füllung
  ctx.fillStyle = 'rgba(255, 240, 170, 0.85)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 2.6;
  ctx.stroke();

  // Zwei Pfeile nach oben nebeneinander (wie Scribble)
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const drawUpArrow = (x, y) => {
    ctx.beginPath();
    ctx.moveTo(x, y + 14);       // Schaft unten
    ctx.lineTo(x, y - 8);        // Schaft oben
    ctx.moveTo(x - 6, y - 2);    // linker Flügel
    ctx.lineTo(x, y - 10);
    ctx.lineTo(x + 6, y - 2);    // rechter Flügel
    ctx.stroke();
  };
  drawUpArrow(cx - 12, cy);
  drawUpArrow(cx + 12, cy);

  // Countdown-Ring (Fortschritts-Bogen unter dem Oval)
  const frac = Math.max(0, Math.min(1, secondsLeft / totalSeconds));
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 4, ry + 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#e8a030';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 4, ry + 4, 0, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.stroke();

  // Restzeit in Sekunden
  ctx.fillStyle = '#1a1a2e';
  ctx.font = "bold 16px 'Comic Sans MS', 'Marker Felt', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(secondsLeft.toFixed(1) + 's', cx, cy + ry + 10);
}

// Timer oben rechts während des Spiels.
export function drawTimerHud(ctx, w, h, currentMs, bestMs) {
  const pad = 14;
  const x = w - pad;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  // Current
  ctx.fillStyle = 'rgba(26, 26, 46, 0.8)';
  ctx.font = "bold 28px 'Comic Sans MS', 'Marker Felt', sans-serif";
  ctx.fillText(formatTime(currentMs), x, pad);
  if (bestMs !== null) {
    ctx.font = "16px 'Comic Sans MS', 'Marker Felt', sans-serif";
    ctx.fillStyle = 'rgba(80, 80, 100, 0.85)';
    ctx.fillText('Best: ' + formatTime(bestMs), x, pad + 34);
  }
}

function backdrop(ctx, w, h, alpha = 0.6) {
  ctx.fillStyle = `rgba(20, 20, 30, ${alpha})`;
  ctx.fillRect(0, 0, w, h);
}

function title(ctx, text, x, y, size = 72, color = '#fafaf5') {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px 'Comic Sans MS', 'Marker Felt', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function sub(ctx, text, x, y, size = 22, color = '#fafaf5') {
  ctx.fillStyle = color;
  ctx.font = `${size}px 'Comic Sans MS', 'Marker Felt', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

export function drawMenu(ctx, w, h, bestMs) {
  backdrop(ctx, w, h, 0.45);
  title(ctx, 'LIANE', w / 2, h / 2 - 120, 120, '#fff4d0');
  sub(ctx, 'Schwing dich von Baum zu Baum!', w / 2, h / 2 - 40, 28);
  sub(ctx, '←/→ laufen · ↓ ducken · SPACE springen/greifen', w / 2, h / 2 + 20, 22);
  sub(ctx, 'An der Liane: ←/→ pumpen · ↑ hoch · SPACE loslassen', w / 2, h / 2 + 52, 20);
  sub(ctx, 'Achte auf den tief fliegenden Vogel — ducke dich!', w / 2, h / 2 + 84, 20, '#ffcccc');
  sub(ctx, 'Drücke SPACE zum Starten', w / 2, h / 2 + 140, 26, '#ffdd77');
  if (bestMs !== null) {
    sub(ctx, 'Beste Zeit: ' + formatTime(bestMs), w / 2, h / 2 + 185, 22, '#ffe3a0');
  }
}

export function drawWin(ctx, w, h, timeMs, bestMs, isNewBest) {
  backdrop(ctx, w, h, 0.6);
  title(ctx, 'GESCHAFFT!', w / 2, h / 2 - 80, 96, '#ffee88');
  sub(ctx, 'Deine Zeit: ' + formatTime(timeMs), w / 2, h / 2 + 10, 32, '#fff4d0');
  if (isNewBest) {
    sub(ctx, '🏆 Neuer Rekord!', w / 2, h / 2 + 55, 26, '#ffdd44');
  } else if (bestMs !== null) {
    sub(ctx, 'Beste Zeit: ' + formatTime(bestMs), w / 2, h / 2 + 55, 22, '#ffe3a0');
  }
  sub(ctx, 'R für Neustart', w / 2, h / 2 + 120, 24, '#ffdd77');
}

export function drawLose(ctx, w, h, reason = 'Autsch!', timeMs) {
  backdrop(ctx, w, h, 0.6);
  title(ctx, reason, w / 2, h / 2 - 60, 92, '#ff9090');
  sub(ctx, 'Erwischt — versuche es nochmal.', w / 2, h / 2 + 20, 26);
  if (typeof timeMs === 'number') {
    sub(ctx, 'Zeit: ' + formatTime(timeMs), w / 2, h / 2 + 60, 22, '#f5d0a0');
  }
  sub(ctx, 'R für Neustart', w / 2, h / 2 + 110, 24, '#ffdd77');
}
