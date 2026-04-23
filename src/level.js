// Level-Daten + Factory.
//
// Layout-Prinzip:
// - Kletterbare Bäume (Pilz, Laub) stehen ausdrücklich AUF Plattformen, damit die
//   Skorpione dort patrouillieren und den Stamm hochklettern können.
// - Palmen sind in den Chasms bzw. als Dekoration. Ihre Wedel funktionieren auch als
//   Liane — über `hiddenLianas` werden zusätzliche Grab-Targets eingehängt.
// - Unregelmäßige Abstände zwischen Bäumen, wechselnde Typen.

import { Liana } from './liana.js';
import { makeTree } from './tree.js';
import { Flag } from './flag.js';
import { Bird } from './enemies/bird.js';
import { Scorpion } from './enemies/scorpion.js';
import { Spider } from './enemies/spider.js';
import { PowerupBlock } from './powerup.js';

export function buildLevel1() {
  const level = {
    width: 5400,
    height: 720,
    start: { x: 80, y: 600 },

    platforms: [
      { x: 0,    y: 680, w: 600,  h: 40, type: 'ground' }, // P1
      { x: 1050, y: 680, w: 450,  h: 40, type: 'ground' }, // P2
      { x: 1950, y: 680, w: 600,  h: 40, type: 'ground' }, // P3 (breiter, zwei Bäume)
      { x: 3000, y: 680, w: 450,  h: 40, type: 'ground' }, // P4
      { x: 3950, y: 680, w: 1450, h: 40, type: 'ground' }, // P5 (Ziel)

      // Fliegende Plattformen (Holzbretter) in verschiedenen Höhen
      { x: 260,  y: 530, w: 80,  h: 14, type: 'float' },
      { x: 780,  y: 450, w: 90,  h: 14, type: 'float' },
      { x: 1720, y: 420, w: 90,  h: 14, type: 'float' },
      { x: 2700, y: 460, w: 90,  h: 14, type: 'float' },
      { x: 3600, y: 400, w: 90,  h: 14, type: 'float' },
      { x: 4300, y: 520, w: 90,  h: 14, type: 'float' },
    ],
    trees: [],
    lianas: [],
    enemies: [],
    powerups: [],
    flag: null,
  };

  // Bäume: Kletterbäume auf Plattformen, Palmen dazwischen.
  const treeDefs = [
    // P1 — Mushroom (Skorpion klettert hier)
    { type: 'mushroom', stumpX: 380,  baseY: 680, topY: 250, capW: 400, capH: 110 },   // 0
    // Chasm P1→P2 — Palme
    { type: 'palm',     stumpX: 820,  baseY: 680, topY: 280, capW: 300, capH: 120 },   // 1
    // P2 — Leafy
    { type: 'leafy',    stumpX: 1280, baseY: 680, topY: 230, capW: 360, capH: 200 },   // 2
    // P3 (doppelt bevölkert) — Palme + Mushroom (Skorpion auf Mushroom)
    { type: 'palm',     stumpX: 2060, baseY: 680, topY: 290, capW: 280, capH: 110 },   // 3
    { type: 'mushroom', stumpX: 2400, baseY: 680, topY: 260, capW: 400, capH: 115 },   // 4
    // Chasm P3→P4 — Palme
    { type: 'palm',     stumpX: 2800, baseY: 680, topY: 290, capW: 300, capH: 115 },   // 5
    // P4 — Leafy (Skorpion hier)
    { type: 'leafy',    stumpX: 3220, baseY: 680, topY: 220, capW: 360, capH: 210 },   // 6
    // Chasm P4→P5 — Palme
    { type: 'palm',     stumpX: 3720, baseY: 680, topY: 300, capW: 280, capH: 105 },   // 7
    // P5 — Mushroom (zur Begrüßung am Ziel, mit Liane zum Einstieg)
    { type: 'mushroom', stumpX: 4050, baseY: 680, topY: 260, capW: 400, capH: 110 },   // 8
  ];
  level.trees = treeDefs.map(t => makeTree(t));

  // Lianen — hängen von Kletterbäumen (Pilz, Laub) und auch von Palmen (als Wedel-Grab-Targets).
  // Lianen mit `hidden: true` werden NICHT gezeichnet (der Palm-Wedel übernimmt das optisch),
  // sondern nur als unsichtbares Grab-Target verwendet.
  const lianaDefs = [
    // Mushroom 0 @ 380 (P1)  — zwei Lianen
    { anchorX: 230, anchorY: 280, length: 360 },  // links (Tutorial)
    { anchorX: 530, anchorY: 280, length: 380 },  // rechts (über P1-P2 Chasm)

    // Palm 1 @ 820 (Chasm) — Wedel links + rechts
    { anchorX: 720, anchorY: 310, length: 330, hidden: true },
    { anchorX: 920, anchorY: 310, length: 330, hidden: true },

    // Leafy 2 @ 1280 (P2)
    { anchorX: 1150, anchorY: 270, length: 360 },
    { anchorX: 1410, anchorY: 270, length: 360 },

    // Palm 3 @ 2060 (P3 links)
    { anchorX: 1960, anchorY: 320, length: 320, hidden: true },
    { anchorX: 2160, anchorY: 320, length: 320, hidden: true },

    // Mushroom 4 @ 2400 (P3 rechts)
    { anchorX: 2280, anchorY: 290, length: 360 },
    { anchorX: 2520, anchorY: 290, length: 360 },

    // Palm 5 @ 2800 (Chasm) — verbindet P3 und P4
    { anchorX: 2700, anchorY: 320, length: 320, hidden: true },
    { anchorX: 2900, anchorY: 320, length: 340, hidden: true },

    // Leafy 6 @ 3220 (P4)
    { anchorX: 3090, anchorY: 260, length: 360 },
    { anchorX: 3350, anchorY: 260, length: 360 },

    // Palm 7 @ 3720 (Chasm)
    { anchorX: 3630, anchorY: 330, length: 320, hidden: true },
    { anchorX: 3810, anchorY: 330, length: 340, hidden: true },

    // Mushroom 8 @ 4050 (P5 Einstieg)
    { anchorX: 3930, anchorY: 290, length: 360 },
    { anchorX: 4170, anchorY: 290, length: 340 },
  ];
  level.lianas = lianaDefs.map(l => {
    const liana = new Liana(l.anchorX, l.anchorY, l.length);
    liana.hidden = !!l.hidden;
    return liana;
  });

  // Vögel — einer mit lowDive (Ducken nötig) pro Abschnitt
  const birdDefs = [
    { patrolY: 90,  patrolMinX: 500,  patrolMaxX: 1200, lowDive: true },
    { patrolY: 80,  patrolMinX: 1600, patrolMaxX: 2700, lowDive: false },
    { patrolY: 95,  patrolMinX: 3200, patrolMaxX: 4100, lowDive: true },
  ];
  birdDefs.forEach(d => level.enemies.push(new Bird(d)));

  // Skorpione — jeder auf einer Plattform, wo "sein" Baum steht.
  const scorpionDefs = [
    { patrolMinX: 80,   patrolMaxX: 560,  climbTreeIndex: 0 }, // P1 → Mushroom 0
    { patrolMinX: 2010, patrolMaxX: 2480, climbTreeIndex: 4 }, // P3 → Mushroom 4
    { patrolMinX: 3030, patrolMaxX: 3400, climbTreeIndex: 6 }, // P4 → Leafy 6
  ];
  scorpionDefs.forEach(d => level.enemies.push(new Scorpion(d, level)));

  // Spinnen — hängen an Seidenfäden von den Baumkronen in Höhe der Schwing-Bahn
  const spiderDefs = [
    { anchorX: 820,  anchorY: 120, minLen: 220, maxLen: 360, speed: 0.9 },  // über Chasm P1-P2 (in der Lianenbahn)
    { anchorX: 2800, anchorY: 120, minLen: 260, maxLen: 380, speed: 1.1 },  // über Chasm P3-P4
    { anchorX: 3720, anchorY: 130, minLen: 220, maxLen: 340, speed: 1.0 },  // über Chasm P4-P5
  ];
  spiderDefs.forEach(d => level.enemies.push(new Spider(d)));

  // Power-Up-Blöcke: drei Standard-jumpBoosts + ein seltener airBlast (Luftblasen).
  const powerupDefs = [
    { x: 260,  y: 490, w: 40, h: 40, type: 'jumpBoost' },
    { x: 2700, y: 420, w: 40, h: 40, type: 'jumpBoost' },
    { x: 3600, y: 360, w: 40, h: 40, type: 'jumpBoost' },
    // Selten: hoch über Baum 3 (Palme), erreichbar per Liane + jumpBoost — echte Belohnung
    { x: 1720, y: 300, w: 44, h: 44, type: 'airBlast' },
  ];
  level.powerups = powerupDefs.map(d => new PowerupBlock(d.x, d.y, d.w, d.h, d.type));

  // Ziel-Fahne am rechten Ende von P5.
  level.flag = new Flag(5200, 680);

  return level;
}
