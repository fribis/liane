// Endlos-Modus: das Level wird während des Laufens aus zufälligen Chunks
// zusammengesetzt und hinter der Kamera wieder abgebaut.
//
// Ein Chunk = Insel (Boden-Plattform mit Kletterbaum + zwei Lianen)
//           + Lücke (Palme mit zwei Lianen in der Mitte).
// Die Maße orientieren sich am handgebauten Level, das nachweislich schaffbar ist
// (Lücken ~450 px, Lianen-Anker ±150 px vom Stamm, Palm-Lianen ±100 px).
// Mit der Distanz steigt `d` von 0 → 1: Inseln werden schmaler, Lücken breiter,
// Gegner häufiger und Powerups seltener.

import { Liana } from './liana.js';
import { makeTree } from './tree.js';
import { Bird } from './enemies/bird.js';
import { Scorpion } from './enemies/scorpion.js';
import { Spider } from './enemies/spider.js';
import { PowerupBlock } from './powerup.js';
import { defaultLevel1Data } from './level.js';

export const PX_PER_METER = 20;           // Held ist 34 px ≈ 1,7 m
const FULL_DIFFICULTY_M = 2000;           // ab hier maximale Schwierigkeit
const GENERATE_AHEAD = 1600;              // so weit rechts vor der Kamera bauen
const CULL_BEHIND = 1200;                 // so weit links hinter der Kamera abbauen

const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const chance = p => Math.random() < p;

export function buildEndlessLevel() {
  const hills = defaultLevel1Data.hills.map(h => ({ ...h }));
  const hillEnd = hills.length ? hills[hills.length - 1].x + hills[hills.length - 1].w : 0;
  const level = {
    width: Infinity,
    height: 720,
    start: { ...defaultLevel1Data.start },
    hills,
    platforms: hills.map(h => ({ x: h.x, y: h.y, w: h.w, h: 20, type: 'hillStep' })),
    trees: [],
    lianas: [],
    enemies: [],
    powerups: [],
    flag: null,
    endless: { genX: hillEnd, chunks: 0 },
  };
  return level;
}

// Pro Frame aufrufen: vorne nachbauen, hinten abräumen.
export function updateEndlessLevel(level, camera, distanceM) {
  const d = Math.min(1, distanceM / FULL_DIFFICULTY_M);
  while (level.endless.genX < camera.x + camera.w + GENERATE_AHEAD) {
    addChunk(level, d);
  }
  cull(level, camera.x - CULL_BEHIND);
}

function addChunk(level, d) {
  const e = level.endless;
  const first = e.chunks === 0;
  const x0 = e.genX;

  // --- Insel mit Kletterbaum ---
  const islandW = first ? 700 : Math.round(lerp(650, 420, d) + rand(-40, 40));
  level.platforms.push({ x: x0, y: 680, w: islandW, h: 40, type: 'ground' });

  const treeType = chance(0.5) ? 'mushroom' : 'leafy';
  const tree = makeTree({
    type: treeType,
    stumpX: Math.round(x0 + islandW * 0.55),
    baseY: 680,
    topY: Math.round(rand(225, 265)),
    capW: Math.round(rand(360, 410)),
    capH: treeType === 'leafy' ? Math.round(rand(195, 215)) : Math.round(rand(105, 120)),
  });
  level.trees.push(tree);
  addLiana(level, tree.stumpX - 150, tree.topY + 30, rand(340, 370));
  addLiana(level, tree.stumpX + 150, tree.topY + 30, rand(350, 380));

  // --- Lücke mit Palme in der Mitte ---
  const gap = Math.round(Math.min(520, lerp(380, 500, d) + rand(0, 40)));
  const palmX = Math.round(x0 + islandW + gap / 2);
  const palm = makeTree({
    type: 'palm', stumpX: palmX, baseY: 680,
    topY: Math.round(rand(280, 300)), capW: Math.round(rand(280, 310)), capH: 115,
  });
  level.trees.push(palm);
  addLiana(level, palmX - 100, palm.topY + 30, rand(320, 335));
  addLiana(level, palmX + 100, palm.topY + 30, rand(330, 345));

  // --- Schwebebrett (Abwechslung + Powerup-Ablage) ---
  let float = null;
  if (!first && chance(0.4)) {
    float = { x: Math.round(x0 + rand(80, islandW - 160)), y: Math.round(rand(430, 520)), w: 90, h: 14, type: 'float' };
    level.platforms.push(float);
  }

  // --- Gegner (nicht im ersten Chunk) ---
  if (!first) {
    if (chance(lerp(0.25, 0.7, d))) {
      const s = new Scorpion({ patrolMinX: x0 + 30, patrolMaxX: x0 + islandW - 30, climbTreeIndex: -1 }, level);
      // Direkte Referenz statt Index — Indizes verschieben sich beim Abräumen.
      s.targetTree = () => tree;
      level.enemies.push(s);
    }
    if (chance(lerp(0.15, 0.55, d))) {
      level.enemies.push(new Spider({
        anchorX: palmX, anchorY: 120,
        minLen: Math.round(rand(220, 260)), maxLen: Math.round(rand(340, 380)), speed: rand(0.9, 1.2),
      }));
    }
    if (chance(lerp(0.2, 0.6, d))) {
      level.enemies.push(new Bird({
        patrolY: Math.round(rand(80, 95)),
        patrolMinX: x0, patrolMaxX: x0 + islandW + gap,
        lowDive: chance(0.6),
      }));
    }
  }

  // --- Powerups ---
  if (!first && chance(0.04)) {
    level.powerups.push(new PowerupBlock(palmX - 22, 300, 44, 44, 'airBlast'));
  }
  if (first || chance(lerp(0.25, 0.08, d))) {
    const px = float ? float.x + 25 : x0 + 80;
    const py = float ? float.y - 40 : 490;
    level.powerups.push(new PowerupBlock(px, py, 40, 40, 'jumpBoost'));
  }

  e.genX = x0 + islandW + gap;
  e.chunks++;
}

function addLiana(level, x, y, length) {
  level.lianas.push(new Liana(Math.round(x), Math.round(y), Math.round(length)));
}

function cull(level, minX) {
  level.platforms = level.platforms.filter(p => p.type === 'hillStep' || p.x + p.w >= minX);
  level.trees = level.trees.filter(t => t.stumpX + t.capW / 2 >= minX);
  level.lianas = level.lianas.filter(l => l.anchorX + l.length >= minX);
  level.powerups = level.powerups.filter(p => p.x + p.w >= minX);
  level.enemies = level.enemies.filter(e => {
    if (e.dead) return false;
    if (e.dying) return true;               // Wegflieg-Animation fertig laufen lassen
    const right = e.patrolMaxX ?? e.anchorX ?? e.x;
    return right >= minX;
  });
}
