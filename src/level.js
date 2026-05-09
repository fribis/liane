// Level-Daten + Factory.
//
// Architektur (für Editor-Support):
// - `defaultLevel1Data` ist eine reine, serialisierbare Daten-Definition (POJO).
// - `buildLevel(data)` baut daraus den vollständigen Instanz-Graph
//   (Tree-/Liana-/Enemy-/Powerup-Klassen). Das Spiel verwendet Instanzen.
// - `serializeLevel(data)` erzeugt einen import-fähigen JS-Snippet zum
//   Reinkopieren in dieses File.
// - `loadLevelData()` / `saveLevelData(data)`: localStorage-Persistenz für
//   den Editor.
//
// Hügel-Bereich (am Levelanfang, x=0..880):
//   `hills` ist eine Liste unsichtbarer Stufen-Plattformen. Visuell wird
//   stattdessen ein einziges geschwungenes Hügel-Polygon gemalt (in main.js
//   `drawHill`). Die Stufen dienen nur der Physik. Hügel-Daten sind getrennt
//   von normalen `platforms`, damit der Editor sie nicht als bewegliche
//   Objekte anzeigt.

import { Liana } from './liana.js';
import { makeTree } from './tree.js';
import { Flag } from './flag.js';
import { Bird } from './enemies/bird.js';
import { Scorpion } from './enemies/scorpion.js';
import { Spider } from './enemies/spider.js';
import { PowerupBlock } from './powerup.js';

// Bumped beim Hügel-Update — alte Layouts (vor +880 Shift) werden so
// automatisch verworfen, statt mit kaputten Koordinaten zurückzukommen.
const STORAGE_KEY = 'liane.levelData.v3';

export const defaultLevel1Data = {
  width: 6280,
  height: 720,
  start: { x: 60, y: 340 },     // oben auf der ersten Hügelstufe (y=380)

  platforms: [
    // Boden-Plattformen — alle ab x=880 (Hügel davor)
    { x: 880,  y: 680, w: 600,  h: 40, type: 'ground' },   // P1
    { x: 1930, y: 680, w: 450,  h: 40, type: 'ground' },   // P2
    { x: 2830, y: 680, w: 600,  h: 40, type: 'ground' },   // P3
    { x: 3880, y: 680, w: 450,  h: 40, type: 'ground' },   // P4
    { x: 4830, y: 680, w: 1450, h: 40, type: 'ground' },   // P5 (Ziel)

    // Fliegende Plattformen
    { x: 1140, y: 530, w: 80,  h: 14, type: 'float' },
    { x: 1660, y: 450, w: 90,  h: 14, type: 'float' },
    { x: 2600, y: 420, w: 90,  h: 14, type: 'float' },
    { x: 3580, y: 460, w: 90,  h: 14, type: 'float' },
    { x: 4480, y: 400, w: 90,  h: 14, type: 'float' },
    { x: 5180, y: 520, w: 90,  h: 14, type: 'float' },
  ],

  // Hügel-Stufen am Levelanfang (unsichtbar, nur Physik). Steigung von y=380
  // (Top, wo der Held spawnt) hinunter zu y=680 (auf P1-Niveau).
  hills: [
    { x: 0,   y: 380, w: 200 },
    { x: 200, y: 425, w: 100 },
    { x: 300, y: 470, w: 100 },
    { x: 400, y: 515, w: 100 },
    { x: 500, y: 560, w: 100 },
    { x: 600, y: 605, w: 100 },
    { x: 700, y: 645, w: 100 },
    { x: 800, y: 680, w: 80  },
  ],

  trees: [
    { type: 'mushroom', stumpX: 1260, baseY: 680, topY: 250, capW: 400, capH: 110 },
    { type: 'palm',     stumpX: 1700, baseY: 680, topY: 280, capW: 300, capH: 120 },
    { type: 'leafy',    stumpX: 2160, baseY: 680, topY: 230, capW: 360, capH: 200 },
    { type: 'palm',     stumpX: 2940, baseY: 680, topY: 290, capW: 280, capH: 110 },
    { type: 'mushroom', stumpX: 3280, baseY: 680, topY: 260, capW: 400, capH: 115 },
    { type: 'palm',     stumpX: 3680, baseY: 680, topY: 290, capW: 300, capH: 115 },
    { type: 'leafy',    stumpX: 4100, baseY: 680, topY: 220, capW: 360, capH: 210 },
    { type: 'palm',     stumpX: 4600, baseY: 680, topY: 300, capW: 280, capH: 105 },
    { type: 'mushroom', stumpX: 4930, baseY: 680, topY: 260, capW: 400, capH: 110 },
  ],

  lianas: [
    { anchorX: 1110, anchorY: 280, length: 360 },
    { anchorX: 1410, anchorY: 280, length: 380 },
    { anchorX: 1600, anchorY: 310, length: 330 },
    { anchorX: 1800, anchorY: 310, length: 330 },
    { anchorX: 2030, anchorY: 270, length: 360 },
    { anchorX: 2290, anchorY: 270, length: 360 },
    { anchorX: 2840, anchorY: 320, length: 320 },
    { anchorX: 3040, anchorY: 320, length: 320 },
    { anchorX: 3160, anchorY: 290, length: 360 },
    { anchorX: 3400, anchorY: 290, length: 360 },
    { anchorX: 3580, anchorY: 320, length: 320 },
    { anchorX: 3780, anchorY: 320, length: 340 },
    { anchorX: 3970, anchorY: 260, length: 360 },
    { anchorX: 4230, anchorY: 260, length: 360 },
    { anchorX: 4510, anchorY: 330, length: 320 },
    { anchorX: 4690, anchorY: 330, length: 340 },
    { anchorX: 4810, anchorY: 290, length: 360 },
    { anchorX: 5050, anchorY: 290, length: 340 },
  ],

  birds: [
    { patrolY: 90,  patrolMinX: 1380, patrolMaxX: 2080, lowDive: true },
    { patrolY: 80,  patrolMinX: 2480, patrolMaxX: 3580, lowDive: false },
    { patrolY: 95,  patrolMinX: 4080, patrolMaxX: 4980, lowDive: true },
  ],

  scorpions: [
    { patrolMinX: 960,  patrolMaxX: 1440, climbTreeIndex: 0 },
    { patrolMinX: 2890, patrolMaxX: 3360, climbTreeIndex: 4 },
    { patrolMinX: 3910, patrolMaxX: 4280, climbTreeIndex: 6 },
  ],

  spiders: [
    { anchorX: 1700, anchorY: 120, minLen: 220, maxLen: 360, speed: 0.9 },
    { anchorX: 3680, anchorY: 120, minLen: 260, maxLen: 380, speed: 1.1 },
    { anchorX: 4600, anchorY: 130, minLen: 220, maxLen: 340, speed: 1.0 },
  ],

  powerups: [
    { x: 1140, y: 490, w: 40, h: 40, type: 'jumpBoost' },
    { x: 3580, y: 420, w: 40, h: 40, type: 'jumpBoost' },
    { x: 4480, y: 360, w: 40, h: 40, type: 'jumpBoost' },
    { x: 2600, y: 300, w: 44, h: 44, type: 'airBlast' },
  ],

  flag: { x: 6080, groundY: 680 },
};

// Tiefe Kopie eines Daten-POJOs (sicher gegen versehentliche Mutationen).
export function cloneLevelData(data) {
  return JSON.parse(JSON.stringify(data));
}

// Erstelle Spielinstanzen aus einer Daten-Definition.
export function buildLevel(data = defaultLevel1Data) {
  const level = {
    width: data.width,
    height: data.height,
    start: { ...data.start },
    // Plattformen: normale + unsichtbare Hügel-Stufen (für Physik).
    platforms: [
      ...data.platforms.map(p => ({ ...p })),
      ...(data.hills || []).map(h => ({ x: h.x, y: h.y, w: h.w, h: 20, type: 'hillStep' })),
    ],
    // Hügel-Daten unverändert mitgeben — main.js zeichnet daraus das Polygon.
    hills: (data.hills || []).map(h => ({ ...h })),
    trees: data.trees.map(t => makeTree({ ...t })),
    lianas: [],
    enemies: [],
    powerups: [],
    flag: null,
  };

  level.lianas = data.lianas.map(l => {
    const liana = new Liana(l.anchorX, l.anchorY, l.length);
    liana.hidden = !!l.hidden;
    return liana;
  });

  for (const d of data.birds) level.enemies.push(new Bird({ ...d }));
  for (const d of data.scorpions) level.enemies.push(new Scorpion({ ...d }, level));
  for (const d of data.spiders) level.enemies.push(new Spider({ ...d }));

  level.powerups = data.powerups.map(d => new PowerupBlock(d.x, d.y, d.w, d.h, d.type));

  level.flag = new Flag(data.flag.x, data.flag.groundY);

  return level;
}

// Backwards-compatible Convenience: Default-Level direkt bauen.
export function buildLevel1() {
  const data = loadLevelData() || defaultLevel1Data;
  return buildLevel(data);
}

// localStorage helpers
export function loadLevelData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Konnte Level aus localStorage nicht lesen:', e);
    return null;
  }
}

export function saveLevelData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Konnte Level nicht in localStorage schreiben:', e);
  }
}

export function clearStoredLevelData() {
  localStorage.removeItem(STORAGE_KEY);
}

// Erzeugt einen JS-Code-Snippet, der direkt als `defaultLevel1Data` in level.js
// einsetzbar ist. Wir stringifyen mit Pretty-Printing aber ohne Quotes um die Keys
// (Standard-Identifier).
export function serializeLevel(data) {
  const lines = [];
  lines.push('export const defaultLevel1Data = {');
  lines.push(`  width: ${data.width},`);
  lines.push(`  height: ${data.height},`);
  lines.push(`  start: { x: ${data.start.x}, y: ${data.start.y} },`);
  lines.push('');
  lines.push('  platforms: [');
  for (const p of data.platforms) {
    lines.push(`    { x: ${num(p.x)}, y: ${num(p.y)}, w: ${num(p.w)}, h: ${num(p.h)}, type: '${p.type}' },`);
  }
  lines.push('  ],');
  lines.push('');
  if (data.hills && data.hills.length) {
    lines.push('  hills: [');
    for (const h of data.hills) {
      lines.push(`    { x: ${num(h.x)}, y: ${num(h.y)}, w: ${num(h.w)} },`);
    }
    lines.push('  ],');
    lines.push('');
  }
  lines.push('  trees: [');
  for (const t of data.trees) {
    lines.push(`    { type: '${t.type}', stumpX: ${num(t.stumpX)}, baseY: ${num(t.baseY)}, topY: ${num(t.topY)}, capW: ${num(t.capW)}, capH: ${num(t.capH)} },`);
  }
  lines.push('  ],');
  lines.push('');
  lines.push('  lianas: [');
  for (const l of data.lianas) {
    const hiddenPart = l.hidden ? ', hidden: true' : '';
    lines.push(`    { anchorX: ${num(l.anchorX)}, anchorY: ${num(l.anchorY)}, length: ${num(l.length)}${hiddenPart} },`);
  }
  lines.push('  ],');
  lines.push('');
  lines.push('  birds: [');
  for (const b of data.birds) {
    lines.push(`    { patrolY: ${num(b.patrolY)}, patrolMinX: ${num(b.patrolMinX)}, patrolMaxX: ${num(b.patrolMaxX)}, lowDive: ${b.lowDive} },`);
  }
  lines.push('  ],');
  lines.push('');
  lines.push('  scorpions: [');
  for (const s of data.scorpions) {
    lines.push(`    { patrolMinX: ${num(s.patrolMinX)}, patrolMaxX: ${num(s.patrolMaxX)}, climbTreeIndex: ${s.climbTreeIndex} },`);
  }
  lines.push('  ],');
  lines.push('');
  lines.push('  spiders: [');
  for (const s of data.spiders) {
    lines.push(`    { anchorX: ${num(s.anchorX)}, anchorY: ${num(s.anchorY)}, minLen: ${num(s.minLen)}, maxLen: ${num(s.maxLen)}, speed: ${num(s.speed)} },`);
  }
  lines.push('  ],');
  lines.push('');
  lines.push('  powerups: [');
  for (const p of data.powerups) {
    lines.push(`    { x: ${num(p.x)}, y: ${num(p.y)}, w: ${num(p.w)}, h: ${num(p.h)}, type: '${p.type}' },`);
  }
  lines.push('  ],');
  lines.push('');
  lines.push(`  flag: { x: ${num(data.flag.x)}, groundY: ${num(data.flag.groundY)} },`);
  lines.push('};');
  return lines.join('\n');
}

function num(v) {
  return Number.isInteger(v) ? v : Math.round(v * 100) / 100;
}
