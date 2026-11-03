// Haupt-Einstiegspunkt: Game-Loop + State-Machine.

import * as Input from './input.js';
const { initInput, updateInput, wasPressed, isDown } = Input;
import { initTouch } from './touch.js';
import { drawJungleBackground } from './render.js';
import {
  buildLevel,
  loadLevelData,
  saveLevelData,
  defaultLevel1Data,
  cloneLevelData,
} from './level.js';
import { Player } from './player.js';
import { camera, followCamera, centerCameraOn } from './camera.js';
import { aabbOverlap } from './physics.js';
import {
  drawMenu, drawWin, drawLose, drawEndlessOver,
  drawTimerHud, drawDistanceHud, drawPowerupHud, drawAirBlastHud,
} from './ui.js';
import { POWERUP_DURATION } from './powerup.js';
import { Bubble } from './bubble.js';
import * as Editor from './editor.js';
import { buildEndlessLevel, updateEndlessLevel, PX_PER_METER } from './endless.js';
import { getScores, getBest, submitScore } from './scores.js';
import * as Leaderboard from './leaderboard.js';

const BUBBLE_INTERVAL = 0.35;   // Sekunden zwischen Auto-Shots
const BUBBLE_RANGE = 520;       // Ziel-Suchradius

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

let mode = 'menu';          // 'menu' | 'play' | 'win' | 'lose' | 'edit'
let prevMode = 'menu';      // Mode vor dem Edit-Wechsel, damit wir zurückspringen können
let gameMode = 'level';     // 'level' | 'endless'
let menuSel = 0;            // 0 = Level, 1 = Endlos
let loseReason = 'Autsch!';
let level;
let levelData;              // POJO — Editor mutiert diese
let player;

// Timer (Level-Modus) / Distanz (Endlos-Modus)
let elapsedMs = 0;
let finalMs = 0;
let distanceM = 0;
// Ergebnis des letzten Laufs für die Bestenliste auf dem End-Screen
let endRank = -1;
let endScores = [];

// Aktive Projektile
let bubbles = [];

function rebuildLevel() {
  level = gameMode === 'endless' ? buildEndlessLevel() : buildLevel(levelData);
  // Spieler ggf. an aktuellen Spawn setzen
  player = new Player(level.start.x, level.start.y);
  bubbles = [];
}

// Rebuild ohne Player-/Bubble-Reset (für Edit-Modus, damit das Bild aktualisiert wird).
function rebuildLevelOnly() {
  level = buildLevel(levelData);
}

function startGame(gm = gameMode) {
  gameMode = gm;
  rebuildLevel();
  centerCameraOn(player.x);
  mode = 'play';
  elapsedMs = 0;
  finalMs = 0;
  distanceM = 0;
  endRank = -1;
  endScores = [];
  Leaderboard.reset();
  if (gameMode === 'endless') updateEndlessLevel(level, camera, 0);
}

function goToMenu() {
  Leaderboard.reset();
  mode = 'menu';
  menuSel = gameMode === 'endless' ? 1 : 0;
}

// Lauf beenden (Tod oder Ziel), lokal und online in die Bestenliste eintragen.
function endRun(outcome, reason) {
  finalMs = elapsedMs;
  loseReason = reason;
  mode = outcome;
  if (gameMode === 'endless') {
    const meters = Math.floor(distanceM);
    endRank = submitScore('endless', meters);
    endScores = getScores('endless');
    if (meters >= 1) Leaderboard.reportRun('endless', meters, finalMs);
  } else if (outcome === 'win') {
    const ms = Math.round(finalMs);
    endRank = submitScore('level', ms);
    endScores = getScores('level');
    Leaderboard.reportRun('level', ms, finalMs);
  }
}

function enterEditor() {
  prevMode = (mode === 'edit') ? prevMode : mode;
  Leaderboard.reset();
  // Der Editor bearbeitet immer das handgebaute Level — aus dem Endlos-Modus
  // heraus wird deshalb erst auf das Level umgeschaltet.
  if (gameMode === 'endless') {
    gameMode = 'level';
    rebuildLevelOnly();
  }
  mode = 'edit';
  Editor.setActive(true);
}

function exitEditor() {
  Editor.setActive(false);
  // Level frisch aufbauen aus den (möglicherweise geänderten) Daten und neu starten.
  startGame('level');
}

function toggleEditor() {
  if (mode === 'edit') exitEditor();
  else                 enterEditor();
}

function nearestEnemy(fromX, fromY, maxDist) {
  let best = null; let bestD = maxDist;
  for (const e of level.enemies) {
    if (e.dead || e.dying || e.isBoss) continue;   // Boss ist immun gegen Luftblasen
    const a = e.aabb;
    const ex = a.x + a.w / 2;
    const ey = a.y + a.h / 2;
    const d = Math.hypot(ex - fromX, ey - fromY);
    if (d < bestD) { bestD = d; best = { e, ex, ey }; }
  }
  return best;
}

// Gibt den Todesgrund zurück ('Autsch!', 'Verbrannt!') oder null.
function checkEnemyCollisions() {
  // Dynamische Hitbox vom Spieler (beim Ducken kleiner).
  const pbox = player.hitbox;
  for (const e of level.enemies) {
    if (e.dead || e.dying) continue;
    if (e.isBoss) {
      if (e.fireballHits(player)) return 'Verbrannt!';
      const hit = e.playerContact(player);
      if (hit === 'stomp') {
        // kräftiger Abpraller nach links weg vom Boss
        player.vy = -640;
        player.vx = -260;
      }
      else if (hit === 'kill') return 'Autsch!';
      continue;
    }
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
    return 'Autsch!';
  }
  return null;
}

function checkFlag() {
  if (!level.flag) return false;
  if (level.boss && !level.boss.defeated) return false;   // erst den Endgegner besiegen
  return aabbOverlap(player.aabb, level.flag.collisionAABB);
}

// Solange der Endgegner steht, kommt man nicht an ihm vorbei.
function applyBossWall() {
  const b = level.boss;
  if (!b || !b.walls) return;
  // Grenze an seiner Körpermitte: man kann auf seine vordere Hälfte springen,
  // aber nicht über ihn hinweg zur Fahne.
  const limit = b.x - player.w / 2;
  if (player.x > limit) {
    player.x = limit;
    if (player.vx > 0) player.vx = 0;
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  step(dt);
  render();
  requestAnimationFrame(loop);
}

// Ein Simulationsschritt (Eingabe + Spiellogik), ohne Zeichnen.
function step(dt) {
  updateInput();

  // E toggelt den Editor in jedem Modus außer während eines aktiven Game-Overs.
  if (wasPressed('editor')) toggleEditor();

  if (mode === 'edit') {
    Editor.updateEditor(dt, level);
  } else if (mode === 'menu') {
    if (wasPressed('left') || wasPressed('up'))    menuSel = 0;
    if (wasPressed('right') || wasPressed('down')) menuSel = 1;
    if (wasPressed('jump')) startGame(menuSel === 0 ? 'level' : 'endless');
  } else if (mode === 'play') {
    if (wasPressed('menu')) goToMenu();

    // Endlos: vorne Chunks nachbauen, hinten abräumen
    if (gameMode === 'endless') updateEndlessLevel(level, camera, distanceM);

    // Player
    player.update(dt, level);
    applyBossWall();
    if (gameMode === 'endless') {
      distanceM = Math.max(distanceM, (player.x - level.start.x) / PX_PER_METER);
    }

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
        if (e.dead || e.dying || e.isBoss) continue;
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

    // Fahne (gibt's nur im Level-Modus)
    level.flag?.update(dt);

    // Kamera — im Bosskampf so weit nach rechts schieben, dass der Boss voll im Bild ist
    followCamera(player, level);
    const boss = level.boss;
    if (boss && boss.awake && boss.blocksPath) {
      const minCam = boss.x + 220 - camera.w;
      if (camera.x < minCam) camera.x += (minCam - camera.x) * Math.min(1, dt * 4);
    }

    // Timer — über die Simulationszeit summiert, damit er bei pausiertem Tab
    // (Hintergrund, App-Wechsel am iPad) nicht weiterläuft.
    elapsedMs += dt * 1000;

    // Tod / Ziel
    let deathReason = null;
    if (mode !== 'play') {
      // per Menü-Taste verlassen
    } else if (player.dead) {
      endRun('lose', 'Abgestürzt!');
    } else if ((deathReason = checkEnemyCollisions())) {
      endRun('lose', deathReason);
    } else if (checkFlag()) {
      endRun('win', '');
    }
  } else if (mode === 'win' || mode === 'lose') {
    // Während der Namens-Eingabe nicht versehentlich neu starten (Touch-JUMP etc.)
    if (Leaderboard.isPromptOpen()) {
      // nichts
    } else if (wasPressed('reset') || wasPressed('jump')) startGame();
    else if (wasPressed('down') || wasPressed('menu')) goToMenu();
  }
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
  level?.flag?.draw(ctx);

  // Spieler
  player?.draw(ctx);

  // Vögel ganz vorne
  for (const e of level?.enemies || []) if (e.constructor.name === 'Bird') drawEnemyWithDying(e);

  // Luftblasen vor allem anderen
  for (const b of bubbles) b.draw(ctx);

  ctx.restore();

  // Timer-HUD während des Spiels
  if (mode === 'play') {
    if (gameMode === 'endless') drawDistanceHud(ctx, W, H, distanceM, getBest('endless'));
    else                        drawTimerHud(ctx, W, H, elapsedMs, getBest('level'));
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

  // Editor-Overlays liegen direkt auf der Welt (also vor restore)
  // — werden hier außerhalb der Welt-Translation NACHTRÄGLICH gezeichnet.
  // Wir wiederholen den Translate für Editor-Helpers:
  if (mode === 'edit') {
    ctx.save();
    ctx.translate(-camera.x, 0);
    Editor.drawOverlays(ctx, W, H);
    ctx.restore();
  }

  // Overlays
  if (mode === 'menu') drawMenu(ctx, W, H, menuSel, getBest('level'), getBest('endless'));
  else if (mode === 'win') drawWin(ctx, W, H, finalMs, endRank, endScores, Leaderboard.state);
  else if (mode === 'lose') {
    if (gameMode === 'endless') drawEndlessOver(ctx, W, H, loseReason, distanceM, endRank, endScores, Leaderboard.state);
    else                        drawLose(ctx, W, H, loseReason, finalMs);
  }
  else if (mode === 'edit') drawEditModeBanner(ctx, W, H);
}

function drawEditModeBanner(ctx, W, H) {
  // Dezenter "EDIT MODE"-Hinweis oben Mitte
  ctx.save();
  ctx.fillStyle = 'rgba(255, 216, 74, 0.85)';
  ctx.fillRect(W / 2 - 70, 60, 140, 26);
  ctx.fillStyle = '#1a1a2e';
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EDIT MODE — E', W / 2, 73);
  ctx.restore();
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
  // Hügel zuerst — die Stufen unterhalb gehören dazu und sollen verdeckt werden.
  drawHill();
  for (const p of level.platforms) {
    if (p.type === 'hillStep') continue;     // unsichtbar, nur Physik
    if (p.type === 'float') drawFloatPlatform(p);
    else drawGroundPlatform(p);
  }
}

// Sanfter Grashügel am Levelanfang. Verbindet die Stufen-Tops mit
// quadratischen Bezier-Kurven zu einer geschwungenen Silhouette.
// Body grün, oben sandige Bordüre + Grasbüschel — passt zu den anderen Plattformen.
function drawHill() {
  if (!level.hills || level.hills.length === 0) return;
  const steps = level.hills;
  const groundY = 720;

  // Top-Punkte der Stufen sammeln (linker Rand jeder Stufe + rechter Rand der letzten)
  const topPoints = [];
  for (const s of steps) topPoints.push({ x: s.x, y: s.y });
  const last = steps[steps.length - 1];
  topPoints.push({ x: last.x + last.w, y: last.y });

  // Body: grünes Polygon, von (0, groundY) hoch über die geschwungene Top-Linie,
  // bis zum letzten Top-Punkt, dann runter zu (xEnd, groundY) und schließen.
  ctx.fillStyle = '#7fc060';
  ctx.beginPath();
  ctx.moveTo(topPoints[0].x, groundY);
  ctx.lineTo(topPoints[0].x, topPoints[0].y);
  // Sanfte Kurve durch die mittleren Punkte (quadratic curve to midpoints)
  for (let i = 0; i < topPoints.length - 1; i++) {
    const cur = topPoints[i];
    const nxt = topPoints[i + 1];
    const mx = (cur.x + nxt.x) / 2;
    const my = (cur.y + nxt.y) / 2;
    ctx.quadraticCurveTo(cur.x, cur.y, mx, my);
  }
  ctx.lineTo(last.x + last.w, last.y);
  ctx.lineTo(last.x + last.w, groundY);
  ctx.closePath();
  ctx.fill();

  // Sandige Bordüre 36 px dick entlang des Top-Verlaufs — passt visuell zu Plattformen
  ctx.fillStyle = '#e0c48a';
  ctx.beginPath();
  ctx.moveTo(topPoints[0].x, topPoints[0].y);
  for (let i = 0; i < topPoints.length - 1; i++) {
    const cur = topPoints[i];
    const nxt = topPoints[i + 1];
    const mx = (cur.x + nxt.x) / 2;
    const my = (cur.y + nxt.y) / 2;
    ctx.quadraticCurveTo(cur.x, cur.y, mx, my);
  }
  ctx.lineTo(last.x + last.w, last.y);
  // Untere Kontur des Sandstreifens
  ctx.lineTo(last.x + last.w, last.y + 36);
  for (let i = topPoints.length - 1; i > 0; i--) {
    const cur = topPoints[i];
    const prv = topPoints[i - 1];
    const mx = (cur.x + prv.x) / 2;
    const my = (cur.y + prv.y) / 2 + 36;
    ctx.quadraticCurveTo(cur.x, cur.y + 36, mx, my);
  }
  ctx.lineTo(topPoints[0].x, topPoints[0].y + 36);
  ctx.closePath();
  ctx.fill();

  // Top-Konturlinie (ink) entlang der Silhouette
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(topPoints[0].x, topPoints[0].y);
  for (let i = 0; i < topPoints.length - 1; i++) {
    const cur = topPoints[i];
    const nxt = topPoints[i + 1];
    const mx = (cur.x + nxt.x) / 2;
    const my = (cur.y + nxt.y) / 2;
    ctx.quadraticCurveTo(cur.x, cur.y, mx, my);
  }
  ctx.lineTo(last.x + last.w, last.y);
  ctx.stroke();

  // (Grasbüschel weggelassen — sie hätten auf den horizontalen Stufen-Tops gesessen
  //  und so die Step-Struktur sichtbar gemacht. Die Bordüre allein reicht.)
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
if ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0) initTouch();
levelData = loadLevelData() || cloneLevelData(defaultLevel1Data);
rebuildLevel();
centerCameraOn(player.x);
Editor.initEditor(levelData, () => {
  // Daten haben sich geändert → Level-Instanzen neu bauen, damit das Bild folgt.
  // (Player bleibt für den Edit-Modus stabil; beim Verlassen wird sowieso startGame
  //  aufgerufen.)
  rebuildLevelOnly();
});
window.addEventListener('liane:toggle-editor', toggleEditor);
// Debug-Hooks
window.__game = {
  getMode: () => mode,
  getGameMode: () => gameMode,
  getDistance: () => distanceM,
  getPlayer: () => ({ x: player.x, y: player.y, vx: player.vx, vy: player.vy, onGround: player.onGround, swing: !!player.swing, dead: player.dead, poweredUp: player.poweredUp, jumpBoostRemaining: player.jumpBoostRemaining, hasAirBlast: player.hasAirBlast, airBlastRemaining: player.airBlastRemaining, bubbleCooldown: player.bubbleCooldown, ducking: player.ducking }),
  getBubbles: () => bubbles.map(b => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, life: b.life })),
  getAliveEnemies: () => level.enemies.filter(e => !e.dead && !e.dying).length,
  getDyingEnemies: () => level.enemies.filter(e => e.dying && !e.dead).length,
  getLevel: () => level,
  startGame,
  // Spielzeit vorspulen (auch wenn der Tab im Hintergrund ist und rAF pausiert)
  advance: (seconds) => {
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n; i++) step(1 / 60);
    render();
  },
  teleport: (x, y) => { player.x = x; player.y = y; player.vx = 0; player.vy = 0; },
  Input,
};
requestAnimationFrame(loop);
