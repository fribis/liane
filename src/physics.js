// Gemeinsame Physik-Konstanten und Kollisionshelfer.

export const GRAVITY = 1800;        // px/s^2
export const MAX_FALL = 900;        // px/s
export const MOVE_SPEED = 280;      // px/s am Boden
export const AIR_CONTROL = 180;     // px/s in der Luft
export const JUMP_V = 620;          // initiale Sprunggeschwindigkeit
export const FRICTION = 10;         // Boden-Dämpfung

// AABB-Overlap
export function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Aufgelöste AABB-Kollision (spieler gegen plattform): verschiebt spieler minimal,
// setzt vy=0 oder vx=0 je nach kleinster Überlappung, gibt "onGround" zurück.
export function resolvePlatform(p, plat) {
  if (!aabbOverlap(p, plat)) return { hit: false };
  const overlapLeft   = (p.x + p.w) - plat.x;
  const overlapRight  = (plat.x + plat.w) - p.x;
  const overlapTop    = (p.y + p.h) - plat.y;
  const overlapBottom = (plat.y + plat.h) - p.y;
  const minX = Math.min(overlapLeft, overlapRight);
  const minY = Math.min(overlapTop, overlapBottom);
  const hit = {};
  if (minX < minY) {
    if (overlapLeft < overlapRight) { p.x -= overlapLeft; hit.right = true; }
    else                            { p.x += overlapRight; hit.left  = true; }
    p.vx = 0;
    return { hit: true, ...hit };
  } else {
    if (overlapTop < overlapBottom) { p.y -= overlapTop; hit.ground = true; p.vy = 0; }
    else                            { p.y += overlapBottom; hit.ceiling = true; p.vy = 0; }
    return { hit: true, ...hit };
  }
}

// Abstand Punkt zu Liniensegment (für Lianen-Greifen).
export function pointSegmentDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + dx * t, cy = ay + dy * t;
  const ex = px - cx, ey = py - cy;
  return { dist: Math.hypot(ex, ey), t, cx, cy };
}
