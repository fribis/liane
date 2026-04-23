// Haupt-Einstiegspunkt: Game-Loop + State-Machine.

import * as Input from './input.js';
const { initInput, updateInput, wasPressed, isDown } = Input;
import { drawJungleBackground } from './render.js';
import { buildLevel1 } from './level.js';
import { Player } from './player.js';
import { camera, followCamera, centerCameraOn } from './camera.js';
import { aabbOverlap } from './physics.js';
import { drawMenu, drawWin, drawLose, drawTimerHud, drawPowerupHud, drawAirBlastHud } from './ui.js';
import { POWERUP_DURATION } from './powerup.js';
import { Bubble } from './bubble.js';

const BUBBLE_INTERVAL = 0.35;   // Sekunden zwischen Auto-Shots
const BUBBLE_RANGE = 520;       // Ziel-Suchradius

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

let mode = 'menu';          // 'menu' | 'play' | 'win' | 'lose'
let loseReason = 'Autsch!';
let level;
let player;

// Timer
const BEST_KEY = 'liane.bestTime';
let startTime = 0;
let elapsedMs = 0;
let finalMs = 0;
function getBestMs() {
  const s = localStorage.getItem(BEST_KEY);
  const n = s ? parseInt(s, 10) : NaN;
  return Number.isFinite(n) ? n : null;
}
function saveBestMs(ms) {
  const prev = getBestMs();
  if (prev === null || ms < prev) {
    localStorage.setItem(BEST_KEY, String(ms));
    return true;
  }
  return false;
}

// Aktive Projektile
let bubbles = [];

function startGame() {
  level = buildLevel1();
  player = new Player(level.start.x, level.start.y);
  centerCameraOn(player.x);
  mode = 'play';
  startTime = performance.now();
  elapsedMs = 0;
  finalMs = 0;
  bubbles = [];
}

function nearestEnemy(fromX, fromY, maxDist) {
  let best = null; let bestD = maxDist;
  for (const e of level.enemies) {
    if (e.dead || e.dying) continue;
    const a = e.aabb;
    const ex = a.x + a.w / 2;
    const ey = a.y + a.h / 2;
    const d = Math.hypot(ex - fromX, ey - fromY);
    if (d < bestD) { bestD = d; best = { e, ex, ey }; }
  }
  return best;
}

function checkEnemyCollisions() {
  // Dynamische Hitbox vom Spieler (beim Ducken kleiner).
  const pbox = player.hitbox;
  for (const e of level.enemies) {
    if (e.dead || e.dying) continue;
    if (!aabbOverlap(pbox, e.aabb)) continue;
    // Spinne: Stomp erlaubt — Spieler fällt von oben in die Stomp-Zone → Spinne tot.
    if (e.constructor.name === 'Spider') {
      const playerBottom = player.y + player.h;
      const spiderTop = e.aabb.y;
      // Von oben treffen UND nach unten bewegen
      if (player.vy > 0 && playerBottom - spiderTop < 18) {
        e.dead = true;
        player.vy = -480;    // Bounce
        continue;            // kein Tod für den Spieler
      }
    }
    return true;
  }
  return false;
}

function checkFlag() {
  return aabbOverlap(player.aabb, level.flag.collisionAABB);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  updateInput();

  if (mode === 'menu') {
    if (wasPressed('jump')) startGame();
  } else if (mode === 'play') {
    // Player
    player.update(dt, level);

    // Lianen updaten (idle + aktive gehen über player.swing)
    for (const l of level.lianas) {
      if (!player.swing || player.swing.liana !== l) l.updateIdle(dt);
      else l.idleTime += dt; // stabil
    }

    // Gegner
    for (const e of level.enemies) e.update(dt, player, level);

    // Powerups
    for (const pu of level.powerups) {
      pu.update(dt);
      if (!pu.collected && aabbOverlap(player.aabb, pu.aabb)) {
        pu.collected = true;
        player.activatePowerup(pu.type, POWERUP_DURATION);
      }
    }

    // Auto-Fire der Luftblasen
    if (player.hasAirBlast && player.bubbleCooldown <= 0) {
      const target = nearestEnemy(player.cx, player.cy, BUBBLE_RANGE);
      if (target) {
        bubbles.push(Bubble.spawnTowards(player.cx, player.cy, target.ex, target.ey));
        player.bubbleCooldown = BUBBLE_INTERVAL;
      } else {
        // Kein Gegner in Reichweite — kurzes Retry-Intervall
        player.bubbleCooldown = 0.2;
      }
    }

    // Bubbles updaten + Treffer prüfen
    for (const b of bubbles) b.update(dt);
    for (const b of bubbles) {
      if (b.dead) continue;
      for (const e of level.enemies) {
        if (e.dead || e.dying) continue;
        if (aabbOverlap(b.aabb, e.aabb)) {
          b.dead = true;
          // Gegner nach oben wegschleudern — wird in enemy.update weiter animiert
          e.dying = true;
          e.dieVx = (Math.random() - 0.5) * 160;
          e.dieVy = -540;
          e.dieSpin = (Math.random() - 0.5) * 10;
          e.dieRot = 0;
          break;
        }
      }
    }
    // Sterbende Gegner animieren (nach oben schleudern)
    for (const e of level.enemies) {
      if (e.dying && !e.dead) {
        e.dieY = (e.dieY ?? 0) + e.dieVy * dt;
        e.dieX = (e.dieX ?? 0) + e.dieVx * dt;
        e.dieVy += 900 * dt;  // leichte Gravitation, aber Grundgeschwindigkeit zieht sie hoch raus
        e.dieRot += e.dieSpin * dt;
        // Wenn Gegner weit oben aus dem Bild → final tot
        const baseY = (e.y ?? (e.aabb.y + e.aabb.h / 2));
        if (baseY + (e.dieY || 0) < -80) e.dead = true;
      }
    }
    // Abgeräumte Bubbles entfernen
    bubbles = bubbles.filter(b => !b.dead && b.life > 0);

    // Fahne
    level.flag.update(dt);

    // Kamera
    followCamera(player, level);

    // Timer
    elapsedMs = performance.now() - startTime;

    // Tod / Ziel
    if (player.dead) {
      mode = 'lose';
      loseReason = 'Abgestürzt!';
      finalMs = elapsedMs;
    } else if (checkEnemyCollisions()) {
      mode = 'lose';
      loseReason = 'Autsch!';
      finalMs = elapsedMs;
    } else if (checkFlag()) {
      mode = 'win';
      finalMs = elapsedMs;
      saveBestMs(Math.round(finalMs));
    }
  } else if (mode === 'win' || mode === 'lose') {
    if (wasPressed('reset') || wasPressed('jump')) startGame();
  }

  render();
  requestAnimationFrame(loop);
}

function render() {
  // Hintergrund (Jungle)
  drawJungleBackground(ctx, W, H, camera.x);

  // Welt relativ zur Kamera
  ctx.save();
  ctx.translate(-camera.x, 0);

  // Boden/Plattformen
  drawPlatforms();

  // Bäume (hinter Lianen)
  for (const t of level?.trees || []) t.draw(ctx);

  // Lianen
  for (const l of level?.lianas || []) l.draw(ctx);

  // Powerups (hinter Spieler)
  for (const pu of level?.powerups || []) pu.draw(ctx);

  // Gegner (Skorpione erst, damit Vögel vorne fliegen)
  for (const e of level?.enemies || []) if (e.constructor.name !== 'Bird') drawEnemyWithDying(e);

  // Fahne
  level?.flag.draw(ctx);

  // Spieler
  player?.draw(ctx);

  // Vögel ganz vorne
  for (const e of level?.enemies || []) if (e.constructor.name === 'Bird') drawEnemyWithDying(e);

  // Luftblasen vor allem anderen
  for (const b of bubbles) b.draw(ctx);

  ctx.restore();

  // Timer-HUD während des Spiels
  if (mode === 'play') {
    drawTimerHud(ctx, W, H, elapsedMs, getBestMs());
    let slot = 0;
    if (player && player.poweredUp) {
      drawPowerupHud(ctx, W, H, player.jumpBoostRemaining, POWERUP_DURATION, slot);
      slot++;
    }
    if (player && player.hasAirBlast) {
      drawAirBlastHud(ctx, W, H, player.airBlastRemaining, POWERUP_DURATION, slot);
      slot++;
    }
  }

  // Overlays
  const best = getBestMs();
  if (mode === 'menu') drawMenu(ctx, W, H, best);
  else if (mode === 'win') {
    const isNew = best !== null && Math.round(finalMs) === best;
    drawWin(ctx, W, H, finalMs, best, isNew);
  }
  else if (mode === 'lose') drawLose(ctx, W, H, loseReason, finalMs);
}

// Beim Sterben rotieren die Gegner und werden nach oben verschoben.
function drawEnemyWithDying(e) {
  if (e.dead) return;
  if (!e.dying) { e.draw(ctx); return; }
  ctx.save();
  // Bezugspunkt: Zentrum des Gegners
  const ax = e.aabb.x + e.aabb.w / 2;
  const ay = e.aabb.y + e.aabb.h / 2;
  ctx.translate((e.dieX || 0), (e.dieY || 0));
  ctx.translate(ax, ay);
  ctx.rotate(e.dieRot || 0);
  ctx.translate(-ax, -ay);
  e.draw(ctx);
  ctx.restore();
}

function drawPlatforms() {
  if (!level) return;
  for (const p of level.platforms) {
    if (p.type === 'float') drawFloatPlatform(p);
    else drawGroundPlatform(p);
  }
}

function drawGroundPlatform(p) {
  // Erdboden-Optik: heller sandiger Streifen mit Kontur (guter Kontrast zu dunkler Figur)
  ctx.fillStyle = '#e0c48a';
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  for (let x = p.x; x <= p.x + p.w; x += 20) {
    ctx.lineTo(x, p.y + (Math.sin(x * 0.3) * 1.2));
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(70, 120, 50, 0.75)';
  ctx.lineWidth = 1.5;
  for (let x = p.x + 10; x < p.x + p.w; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, p.y);
    ctx.lineTo(x + 2, p.y - 5);
    ctx.moveTo(x + 4, p.y);
    ctx.lineTo(x + 6, p.y - 4);
    ctx.stroke();
  }
}

// Fliegende Plattform: drei-segmentiges Holzbrett wie im Scribble.
function drawFloatPlatform(p) {
  const segs = 3;
  const segW = p.w / segs;
  // Füllung (dezentes Holzbraun)
  ctx.fillStyle = 'rgba(190, 150, 95, 0.55)';
  ctx.fillRect(p.x, p.y, p.w, p.h);
  // Kontur um ganzes Brett
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 2;
  ctx.strokeRect(p.x, p.y, p.w, p.h);
  // Segment-Trennlinien
  ctx.beginPath();
  for (let i = 1; i < segs; i++) {
    const xi = p.x + i * segW;
    ctx.moveTo(xi, p.y);
    ctx.lineTo(xi, p.y + p.h);
  }
  ctx.stroke();
  // Kleiner Schatten unter dem Brett
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.fillRect(p.x + 3, p.y + p.h, p.w - 6, 3);
}

initInput();
level = buildLevel1();
player = new Player(level.start.x, level.start.y);
centerCameraOn(player.x);
// Debug-Hooks
window.__game = {
  getMode: () => mode,
  getPlayer: () => ({ x: player.x, y: player.y, vx: player.vx, vy: player.vy, onGround: player.onGround, swing: !!player.swing, dead: player.dead, poweredUp: player.poweredUp, jumpBoostRemaining: player.jumpBoostRemaining, hasAirBlast: player.hasAirBlast, airBlastRemaining: player.airBlastRemaining, bubbleCooldown: player.bubbleCooldown, ducking: player.ducking }),
  getBubbles: () => bubbles.map(b => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, life: b.life })),
  getAliveEnemies: () => level.enemies.filter(e => !e.dead && !e.dying).length,
  getDyingEnemies: () => level.enemies.filter(e => e.dying && !e.dead).length,
  getLevel: () => level,
  startGame,
  teleport: (x, y) => { player.x = x; player.y = y; player.vx = 0; player.vy = 0; },
  Input,
};
requestAnimationFrame(loop);
