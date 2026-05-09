// Touch-Steuerung für iOS / Android.
// Bindet sich an feste DOM-Elemente mit data-touch-action="..." (siehe index.html)
// und übersetzt Multi-Touch in registerTouchPress/Release-Aufrufe.

import { registerTouchPress, registerTouchRelease } from './input.js';

// touchId → action  — damit wir wissen, welcher Finger welche Action freigeben muss.
const fingerToAction = new Map();
// action → Set<touchId>  — damit eine Action erst wirklich endet, wenn der LETZTE Finger sie loslässt.
const actionFingers = new Map();

function pressAction(action, touchId) {
  let set = actionFingers.get(action);
  if (!set) { set = new Set(); actionFingers.set(action, set); }
  if (set.size === 0) registerTouchPress(action);
  set.add(touchId);
  fingerToAction.set(touchId, action);
}

function releaseAction(touchId) {
  const action = fingerToAction.get(touchId);
  if (!action) return;
  fingerToAction.delete(touchId);
  const set = actionFingers.get(action);
  if (!set) return;
  set.delete(touchId);
  if (set.size === 0) registerTouchRelease(action);
}

// Findet das Button-Element unter einem Touch-Punkt. Wir benutzen
// document.elementFromPoint statt e.target, damit "drag-to-button" funktioniert
// (Finger gleitet von links zu rechts, ohne loszulassen).
function actionAtPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const btn = el.closest('[data-touch-action]');
  return btn ? btn.dataset.touchAction : null;
}

export function initTouch() {
  const overlay = document.getElementById('touch-overlay');
  if (!overlay) return;
  overlay.classList.add('touch-active');

  const onStart = (e) => {
    for (const t of e.changedTouches) {
      const action = actionAtPoint(t.clientX, t.clientY);
      if (action) {
        pressAction(action, t.identifier);
        e.preventDefault();
      }
    }
  };

  const onMove = (e) => {
    for (const t of e.changedTouches) {
      const prev = fingerToAction.get(t.identifier);
      const next = actionAtPoint(t.clientX, t.clientY);
      if (prev === next) continue;
      // Finger hat einen Button verlassen oder einen neuen erreicht.
      if (prev) releaseAction(t.identifier);
      if (next) pressAction(next, t.identifier);
      if (prev || next) e.preventDefault();
    }
  };

  const onEnd = (e) => {
    for (const t of e.changedTouches) {
      if (fingerToAction.has(t.identifier)) {
        releaseAction(t.identifier);
        e.preventDefault();
      }
    }
  };

  // passive:false, weil wir preventDefault() brauchen (sonst löst iOS Scrollen / Zoom aus).
  overlay.addEventListener('touchstart',  onStart, { passive: false });
  overlay.addEventListener('touchmove',   onMove,  { passive: false });
  overlay.addEventListener('touchend',    onEnd,   { passive: false });
  overlay.addEventListener('touchcancel', onEnd,   { passive: false });

  // Sicherheitsnetz: bei Tab-Wechsel / App-Wechsel alle gehaltenen Actions freigeben.
  const releaseAll = () => {
    for (const id of Array.from(fingerToAction.keys())) releaseAction(id);
  };
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
  });
}
