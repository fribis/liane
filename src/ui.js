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
// `slot` gibt die Position an, damit mehrere Badges nebeneinander passen.
export function drawPowerupHud(ctx, w, h, secondsLeft, totalSeconds, slot = 0) {
  const rx = 52;
  const ry = 38;
  const cx = 80 + slot * (rx * 2 + 24);
  const cy = 56;
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

// AirBlast-Badge: runde Luftblase mit Tupfen + Countdown-Ring.
// Sitzt auf einer anderen Slot-Position, wenn gleichzeitig der jumpBoost aktiv ist.
export function drawAirBlastHud(ctx, w, h, secondsLeft, totalSeconds, slot = 0) {
  const r = 40;
  const cx = 80 + slot * (r * 2 + 30);
  const cy = 56;

  // Blase
  ctx.fillStyle = 'rgba(190, 230, 255, 0.92)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 2.6;
  ctx.stroke();

  // Tupfen im Inneren
  ctx.fillStyle = 'rgba(60, 130, 180, 0.85)';
  const spots = [
    [-10, -4, 3.5],
    [ 8, -8, 3.0],
    [ 2,  6, 3.8],
    [-6,  9, 2.6],
    [12,  5, 2.4],
  ];
  for (const [dx, dy, sr] of spots) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glanzpunkt
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.45, cy - r * 0.45, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();

  // Countdown-Ring
  const frac = Math.max(0, Math.min(1, secondsLeft / totalSeconds));
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#3b9bd4';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.stroke();

  // Restzeit
  ctx.fillStyle = '#1a1a2e';
  ctx.font = "bold 16px 'Comic Sans MS', 'Marker Felt', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(secondsLeft.toFixed(1) + 's', cx, cy + r + 10);
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

export function formatMeters(m) {
  return `${Math.floor(m)} m`;
}

// Distanz-Anzeige oben rechts im Endlos-Modus.
export function drawDistanceHud(ctx, w, h, meters, bestM) {
  const pad = 14;
  const x = w - pad;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(26, 26, 46, 0.8)';
  ctx.font = "bold 28px 'Comic Sans MS', 'Marker Felt', sans-serif";
  ctx.fillText(formatMeters(meters), x, pad);
  if (bestM !== null) {
    ctx.font = "16px 'Comic Sans MS', 'Marker Felt', sans-serif";
    ctx.fillStyle = 'rgba(80, 80, 100, 0.85)';
    ctx.fillText('Best: ' + formatMeters(bestM), x, pad + 34);
  }
}

const MODES = [
  { key: 'level',   label: 'LEVEL',  hint: 'Erreiche die Fahne' },
  { key: 'endless', label: 'ENDLOS', hint: 'Komm so weit wie möglich' },
];

// Startmenü mit Modus-Auswahl. `selected` ist 0 (Level) oder 1 (Endlos).
export function drawMenu(ctx, w, h, selected, bestLevelMs, bestEndlessM) {
  backdrop(ctx, w, h, 0.45);
  title(ctx, 'LIANE', w / 2, h / 2 - 200, 110, '#fff4d0');
  sub(ctx, 'Schwing dich von Baum zu Baum!', w / 2, h / 2 - 125, 26);

  // Zwei Modus-Kacheln nebeneinander
  const bw = 260, bh = 110, gap = 40;
  const top = h / 2 - 80;
  MODES.forEach((m, i) => {
    const x = w / 2 + (i === 0 ? -bw - gap / 2 : gap / 2);
    const active = i === selected;
    ctx.fillStyle = active ? 'rgba(255, 221, 119, 0.92)' : 'rgba(255, 255, 255, 0.12)';
    ctx.strokeStyle = active ? '#1a1a2e' : 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = active ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(x, top, bw, bh, 16);
    ctx.fill();
    ctx.stroke();
    const color = active ? '#1a1a2e' : '#fafaf5';
    sub(ctx, m.label, x + bw / 2, top + 34, 34, color);
    sub(ctx, m.hint, x + bw / 2, top + 66, 17, color);
    const best = m.key === 'level'
      ? (bestLevelMs !== null ? 'Best: ' + formatTime(bestLevelMs) : '—')
      : (bestEndlessM !== null ? 'Best: ' + formatMeters(bestEndlessM) : '—');
    sub(ctx, best, x + bw / 2, top + 92, 16, active ? '#5a4a1a' : '#ffe3a0');
  });

  sub(ctx, '←/→ Modus wählen · SPACE / JUMP starten', w / 2, top + bh + 40, 22, '#ffdd77');
  sub(ctx, '←/→ laufen · ↓ ducken · SPACE springen/greifen', w / 2, top + bh + 90, 19);
  sub(ctx, 'An der Liane: ←/→ pumpen · ↑ hoch · SPACE loslassen', w / 2, top + bh + 118, 18);
  sub(ctx, 'Achte auf den tief fliegenden Vogel — ducke dich!', w / 2, top + bh + 146, 18, '#ffcccc');
}

// Tabelle: Rang | Name (oder Datum) | Wert. `highlight` = Zeile, die gelb leuchtet.
function drawTable(ctx, cx, top, heading, rows, highlight) {
  sub(ctx, heading, cx, top, 20, '#ffe3a0');
  rows.forEach((r, i) => {
    const y = top + 32 + i * 26;
    const hot = i === highlight;
    ctx.font = `${hot ? 'bold ' : ''}19px 'Comic Sans MS', 'Marker Felt', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = hot ? '#ffdd44' : '#fafaf5';
    ctx.textAlign = 'right';
    ctx.fillText(`${i + 1}.`, cx - 150, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = hot ? '#ffdd44' : (r.dim ? 'rgba(255,255,255,0.6)' : '#fafaf5');
    ctx.fillText(r.label, cx - 135, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = hot ? '#ffdd44' : '#fafaf5';
    ctx.fillText(r.value, cx + 160, y);
  });
}

function formatDate(iso) {
  return iso ? iso.slice(5).split('-').reverse().join('.') : '';
}

// Ergebnis-Zeile + Liste für den End-Screen. Bevorzugt die Online-Rangliste,
// fällt auf die lokale Top 5 zurück, wenn der Server nicht erreichbar ist.
function drawResults(ctx, w, h, format, localRank, localScores, online) {
  const cx = w / 2;
  const infoY = 240, listY = 285;

  if (online.status === 'ok' && online.entries.length) {
    if (online.rank !== null) {
      const own = online.best !== null ? ` · dein Rekord: ${format(online.best)}` : '';
      const text = online.rank === 0 ? '🏆 Platz 1 online!' : `Online: Platz ${online.rank + 1}`;
      sub(ctx, text + own, cx, infoY, 22, '#ffdd44');
    }
    const rows = online.entries.map(e => ({ label: e.name, value: format(e.value) }));
    const hi = online.entries.findIndex(e => e.name === online.name);
    drawTable(ctx, cx, listY, 'ONLINE-RANGLISTE', rows, hi);
    return;
  }

  if (online.status === 'loading') sub(ctx, 'Rangliste wird geladen…', cx, infoY, 20, '#ffe3a0');
  else if (localRank === 0) sub(ctx, '🏆 Neuer Rekord!', cx, infoY, 26, '#ffdd44');
  else if (localRank > 0) sub(ctx, `Platz ${localRank + 1} der Bestenliste`, cx, infoY, 22, '#ffdd44');

  if (localScores.length && online.status !== 'prompt') {
    const rows = localScores.map(s => ({ label: formatDate(s.date), value: format(s.value), dim: true }));
    const heading = online.status === 'offline' ? 'BESTENLISTE (offline, dieses Gerät)' : 'BESTENLISTE (dieses Gerät)';
    drawTable(ctx, cx, listY, heading, rows, localRank);
  }
}

function footer(ctx, w, y) {
  sub(ctx, 'SPACE / R: nochmal · ↓ / ESC / ⌂: Menü', w / 2, y, 22, '#ffdd77');
}

export function drawWin(ctx, w, h, timeMs, rank, scores, online) {
  backdrop(ctx, w, h, 0.65);
  title(ctx, 'GESCHAFFT!', w / 2, 120, 84, '#ffee88');
  sub(ctx, 'Deine Zeit: ' + formatTime(timeMs), w / 2, 195, 32, '#fff4d0');
  drawResults(ctx, w, h, formatTime, rank, scores, online);
  footer(ctx, w, 610);
}

export function drawLose(ctx, w, h, reason = 'Autsch!', timeMs) {
  backdrop(ctx, w, h, 0.6);
  title(ctx, reason, w / 2, h / 2 - 60, 92, '#ff9090');
  sub(ctx, 'Erwischt — versuche es nochmal.', w / 2, h / 2 + 20, 26);
  if (typeof timeMs === 'number') {
    sub(ctx, 'Zeit: ' + formatTime(timeMs), w / 2, h / 2 + 60, 22, '#f5d0a0');
  }
  footer(ctx, w, h / 2 + 110);
}

// Game-Over im Endlos-Modus: Distanz + Rangliste.
export function drawEndlessOver(ctx, w, h, reason, meters, rank, scores, online) {
  backdrop(ctx, w, h, 0.65);
  title(ctx, reason, w / 2, 120, 80, '#ff9090');
  sub(ctx, 'Distanz: ' + formatMeters(meters), w / 2, 195, 32, '#fff4d0');
  drawResults(ctx, w, h, formatMeters, rank, scores, online);
  footer(ctx, w, 610);
}
