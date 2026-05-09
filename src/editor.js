// Mini-Level-Editor.
//
// Verantwortlich für:
// - Editor-State (welches Objekt ist gewählt, Drag-State, Helper-Toggles).
// - Pointer-Eingabe auf dem Canvas (Mouse + Touch via Pointer Events).
// - Toolbar/Sidebar/Trash-DOM-Overlays.
// - Render-Overlays: Selektion, Hitboxen, Sprung-Reichweiten-Vorschau.
// - localStorage-Auto-Save + Export als JS-Snippet.
//
// Wird von main.js angesteuert: setActive(true) bei Edit-Modus, draw(ctx, camera)
// im Render-Pass, handleKey() für Tastatur-Shortcuts.

import { camera } from './camera.js';
import {
  defaultLevel1Data,
  cloneLevelData,
  saveLevelData,
  clearStoredLevelData,
  serializeLevel,
} from './level.js';
import { JUMP_V, GRAVITY, MOVE_SPEED } from './physics.js';
import { isDown } from './input.js';

// === State ============================================================

const state = {
  active: false,
  data: null,           // Referenz auf das aktuell editierte LevelData (mutable)
  selection: null,      // { kind, index } — kind ∈ 'platform'|'tree'|'liana'
  drag: null,           // { kind, index, startX, startY, origX, origY, pointerId }
  showHitboxes: true,
  showJumpArcs: true,
  // Subtile Re-Build-Callback (wird gefeuert wenn Daten verändert wurden)
  onChange: null,
};

// === Public API =======================================================

export function initEditor(levelData, onChange) {
  state.data = levelData;
  state.onChange = onChange;
  buildDom();
  attachPointerEvents();
  // Backspace/Delete für selektiertes Objekt löschen
  window.addEventListener('keydown', e => {
    if (!state.active) return;
    if (e.code === 'Backspace' || e.code === 'Delete') {
      // Wenn der Fokus in einem Eingabefeld ist, NICHT löschen
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      e.preventDefault();
      deleteSelection();
    }
  });
}

export function setActive(active) {
  state.active = active;
  document.body.classList.toggle('editor-active', active);
  refreshSidebar();
}

export function isActive() { return state.active; }

export function getLevelData() { return state.data; }

export function setLevelData(data) {
  state.data = data;
  state.selection = null;
  state.drag = null;
  refreshSidebar();
}

// Wird vom Game-Loop aufgerufen (auch wenn nicht aktiv: nur dann zeichnen wenn active)
export function drawOverlays(ctx, W, H) {
  if (!state.active) return;
  // Welt-Overlays werden im welt-translate-Kontext gezeichnet (callsite kümmert sich)
  drawHelperOverlays(ctx);
  drawSelectionOverlay(ctx);
}

// Pfeiltasten: Camera pan (nutzt direkt isDown aus dem Input-Modul, da die
// Game-Actions im Edit-Modus sowieso keinen Effekt haben).
export function updateEditor(dt, level) {
  if (!state.active) return;
  const speed = 700;
  if (isDown('left'))  camera.x -= speed * dt;
  if (isDown('right')) camera.x += speed * dt;
  camera.x = Math.max(0, Math.min(level.width - camera.w, camera.x));
}

// === Daten-Modifikatoren =============================================

function commit() {
  saveLevelData(state.data);
  if (state.onChange) state.onChange();
  refreshSidebar();
}

function addPlatform(typeName) {
  const p = typeName === 'float'
    ? { x: cameraCenterX() - 45, y: 450, w: 90, h: 14, type: 'float' }
    : { x: cameraCenterX() - 200, y: 680, w: 400, h: 40, type: 'ground' };
  state.data.platforms.push(p);
  state.selection = { kind: 'platform', index: state.data.platforms.length - 1 };
  commit();
}

function addTree(treeType) {
  const t = {
    type: treeType,
    stumpX: cameraCenterX(),
    baseY: 680,
    topY: 250,
    capW: treeType === 'palm' ? 280 : 380,
    capH: treeType === 'leafy' ? 200 : 110,
  };
  state.data.trees.push(t);
  state.selection = { kind: 'tree', index: state.data.trees.length - 1 };
  commit();
}

function addLiana() {
  // Position: über aktueller Camera-Mitte. Anker wird gleich auf nächsten Baum gesnappt.
  const anchor = { x: cameraCenterX(), y: 280, length: 340 };
  const snapped = snapLianaAnchorToNearestTree(anchor.x, anchor.y);
  state.data.lianas.push({
    anchorX: snapped.x,
    anchorY: snapped.y,
    length: anchor.length,
  });
  state.selection = { kind: 'liana', index: state.data.lianas.length - 1 };
  commit();
}

function deleteSelection() {
  if (!state.selection) return;
  const { kind, index } = state.selection;
  const list = listFor(kind);
  if (!list) return;
  list.splice(index, 1);
  state.selection = null;
  commit();
}

function duplicateSelection() {
  if (!state.selection) return;
  const { kind, index } = state.selection;
  const list = listFor(kind);
  if (!list) return;
  const copy = JSON.parse(JSON.stringify(list[index]));
  // 60 px nach rechts
  if (kind === 'platform') copy.x += 60;
  if (kind === 'tree') copy.stumpX += 60;
  if (kind === 'liana') copy.anchorX += 60;
  list.push(copy);
  state.selection = { kind, index: list.length - 1 };
  commit();
}

function listFor(kind) {
  if (kind === 'platform') return state.data.platforms;
  if (kind === 'tree')     return state.data.trees;
  if (kind === 'liana')    return state.data.lianas;
  return null;
}

function getSelected() {
  if (!state.selection) return null;
  const list = listFor(state.selection.kind);
  return list ? list[state.selection.index] : null;
}

// Liane-Anker an nächste Baumkrone snappen.
function snapLianaAnchorToNearestTree(x, y) {
  if (!state.data.trees.length) return { x, y };
  let best = null; let bestD = Infinity;
  for (const t of state.data.trees) {
    // Anker oben am Stamm-Top, plus kleines Capover
    const ax = t.stumpX;
    const ay = t.topY + 30;       // ein Stück unterhalb der Kappenoberkante
    const d = Math.hypot(ax - x, ay - y);
    if (d < bestD) { bestD = d; best = { x: ax, y: ay }; }
  }
  return best || { x, y };
}

function cameraCenterX() {
  return camera.x + camera.w / 2;
}

// === Pointer / Hit-Test ==============================================

const canvas = () => document.getElementById('game');

// Aktive Pointer für Multi-Touch-Pan (kein Drag)
const activePointers = new Map();   // pointerId → { x, y }
let panStart = null;                 // { camX, midX } beim Beginn eines Zwei-Finger-Gestens

function attachPointerEvents() {
  const c = canvas();
  if (!c) return;
  c.addEventListener('pointerdown', onPointerDown);
  c.addEventListener('pointermove', onPointerMove);
  c.addEventListener('pointerup',   onPointerUp);
  c.addEventListener('pointercancel', onPointerUp);
  // touch-action: none, damit Browser nicht selber pannt/zoomt
  c.style.touchAction = 'none';
}

// Canvas-Pixelkoordinate → Welt-Koordinate (Editor)
function eventToWorld(e) {
  const c = canvas();
  const rect = c.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (c.width / rect.width);
  const sy = (e.clientY - rect.top)  * (c.height / rect.height);
  return { x: sx + camera.x, y: sy + camera.y, sx, sy };
}

function onPointerDown(e) {
  if (!state.active) return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  // Mit zwei Fingern beginnt ein Pan-Gestus statt Drag
  if (activePointers.size >= 2) {
    if (state.drag) state.drag = null;
    const xs = [...activePointers.values()].map(p => p.x);
    const midX = xs.reduce((a, b) => a + b, 0) / xs.length;
    panStart = { camX: camera.x, midX };
    return;
  }

  const { x, y } = eventToWorld(e);

  // Hit-Test: Lianen → Bäume → Plattformen (kleiner Vorrang vor groß)
  const hit = hitTest(x, y);
  if (hit) {
    state.selection = hit;
    state.drag = makeDragFromHit(hit, x, y, e.pointerId);
    canvas().setPointerCapture(e.pointerId);
    refreshSidebar();
    e.preventDefault();
  } else {
    // Klick ins Leere → Auswahl aufheben
    state.selection = null;
    refreshSidebar();
  }
}

function onPointerMove(e) {
  if (!state.active) return;
  if (activePointers.has(e.pointerId)) {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  // Zwei-Finger-Pan
  if (panStart && activePointers.size >= 2) {
    const xs = [...activePointers.values()].map(p => p.x);
    const midX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const c = canvas();
    const rect = c.getBoundingClientRect();
    const scale = c.width / rect.width;
    camera.x = panStart.camX - (midX - panStart.midX) * scale;
    return;
  }
  if (!state.drag) return;
  const { x, y } = eventToWorld(e);
  const d = state.drag;
  if (d.pointerId !== e.pointerId) return;
  const dx = x - d.startX;
  const dy = y - d.startY;

  if (d.kind === 'platform') {
    const p = state.data.platforms[d.index];
    p.x = Math.round(d.origX + dx);
    p.y = Math.round(d.origY + dy);
  } else if (d.kind === 'tree') {
    const t = state.data.trees[d.index];
    t.stumpX = Math.round(d.origX + dx);
    // Y-Verschiebung passt topY/baseY (baseY = wo Stamm endet, topY = wo er beginnt)
    t.baseY = Math.round(d.origYBase + dy);
    t.topY  = Math.round(d.origYTop + dy);
  } else if (d.kind === 'liana') {
    const l = state.data.lianas[d.index];
    if (d.handle === 'tip') {
      // Tip-Drag: Länge folgt Pointer
      const dx2 = x - l.anchorX;
      const dy2 = y - l.anchorY;
      l.length = Math.max(40, Math.round(Math.hypot(dx2, dy2)));
    } else {
      // Anker-Drag: snap auf nächste Baumkrone
      const newAnchor = snapLianaAnchorToNearestTree(d.origX + dx, d.origY + dy);
      l.anchorX = Math.round(newAnchor.x);
      l.anchorY = Math.round(newAnchor.y);
    }
  }
  refreshSidebar();
  // Trash-Highlight wenn Pointer in Trash-Zone
  updateTrashHover(e.clientX, e.clientY);
}

function onPointerUp(e) {
  if (!state.active) return;
  activePointers.delete(e.pointerId);
  if (activePointers.size < 2) panStart = null;
  if (!state.drag) return;
  if (state.drag.pointerId !== e.pointerId) return;
  // Wenn auf Trash gedroppt → löschen
  if (isOverTrash(e.clientX, e.clientY)) {
    state.selection = { kind: state.drag.kind, index: state.drag.index };
    deleteSelection();
  } else {
    commit();
  }
  state.drag = null;
  setTrashHover(false);
  try { canvas().releasePointerCapture(e.pointerId); } catch (_) {}
}

function makeDragFromHit(hit, x, y, pointerId) {
  if (hit.kind === 'platform') {
    const p = state.data.platforms[hit.index];
    return { kind: 'platform', index: hit.index, startX: x, startY: y, origX: p.x, origY: p.y, pointerId };
  }
  if (hit.kind === 'tree') {
    const t = state.data.trees[hit.index];
    return { kind: 'tree', index: hit.index, startX: x, startY: y, origX: t.stumpX, origYBase: t.baseY, origYTop: t.topY, pointerId };
  }
  if (hit.kind === 'liana') {
    const l = state.data.lianas[hit.index];
    // Tip-Handle (unteres Ende) wenn Klick näher am Tip
    const tipX = l.anchorX, tipY = l.anchorY + l.length;
    const distAnchor = Math.hypot(x - l.anchorX, y - l.anchorY);
    const distTip    = Math.hypot(x - tipX, y - tipY);
    const handle = distTip < distAnchor ? 'tip' : 'anchor';
    return { kind: 'liana', index: hit.index, startX: x, startY: y, origX: l.anchorX, origY: l.anchorY, handle, pointerId };
  }
  return null;
}

function hitTest(x, y) {
  // Lianen: Punkt-zu-Linie-Distanz, oder direkt am Tip-Handle
  for (let i = state.data.lianas.length - 1; i >= 0; i--) {
    const l = state.data.lianas[i];
    const tipX = l.anchorX, tipY = l.anchorY + l.length;
    if (Math.hypot(x - tipX, y - tipY) < 14) return { kind: 'liana', index: i };
    if (Math.hypot(x - l.anchorX, y - l.anchorY) < 14) return { kind: 'liana', index: i };
    // Auf der Linie?
    const d = pointToSegment(x, y, l.anchorX, l.anchorY, tipX, tipY);
    if (d < 8) return { kind: 'liana', index: i };
  }
  // Bäume: Bounding-Box von Stamm + Krone
  for (let i = state.data.trees.length - 1; i >= 0; i--) {
    const t = state.data.trees[i];
    const left = t.stumpX - t.capW / 2;
    const right = t.stumpX + t.capW / 2;
    const top = t.topY - t.capH;
    const bottom = t.baseY;
    if (x >= left && x <= right && y >= top && y <= bottom) return { kind: 'tree', index: i };
  }
  // Plattformen
  for (let i = state.data.platforms.length - 1; i >= 0; i--) {
    const p = state.data.platforms[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return { kind: 'platform', index: i };
  }
  return null;
}

function pointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + dx * t, cy = ay + dy * t;
  return Math.hypot(px - cx, py - cy);
}

// === Render Overlays =================================================

function drawHelperOverlays(ctx) {
  // Hitboxen
  if (state.showHitboxes) {
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (const p of state.data.platforms) {
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    }
    ctx.setLineDash([]);
  }
  // Sprung-Reichweite ab Plattform-Kanten
  if (state.showJumpArcs) {
    drawJumpArcs(ctx);
  }
  // Lianen-Anker-Punkte sichtbar machen
  for (const l of state.data.lianas) {
    ctx.fillStyle = 'rgba(255, 230, 60, 0.9)';
    ctx.beginPath();
    ctx.arc(l.anchorX, l.anchorY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawJumpArcs(ctx) {
  // Standardsprung: vy0 = -JUMP_V, gravity = GRAVITY, vx = MOVE_SPEED.
  // Wir zeichnen pro Plattform-Kante (links + rechts) einen Bogen.
  // Dauer = 2 * JUMP_V / GRAVITY; Reichweite = MOVE_SPEED * Dauer.
  const dur = (2 * JUMP_V) / GRAVITY;
  const N = 24;
  ctx.strokeStyle = 'rgba(255, 90, 60, 0.45)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([6, 4]);
  for (const p of state.data.platforms) {
    if (p.type !== 'ground' && p.type !== 'float') continue;
    // Kante rechts: Held springt nach rechts
    const startRight = { x: p.x + p.w, y: p.y };
    drawArc(ctx, startRight, +1, dur, N);
    // Kante links: Held springt nach links
    const startLeft = { x: p.x, y: p.y };
    drawArc(ctx, startLeft, -1, dur, N);
  }
  ctx.setLineDash([]);
}

function drawArc(ctx, start, dir, dur, N) {
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * dur;
    const x = start.x + dir * MOVE_SPEED * t;
    const y = start.y - JUMP_V * t + 0.5 * GRAVITY * t * t;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawSelectionOverlay(ctx) {
  if (!state.selection) return;
  const sel = state.selection;
  ctx.save();
  ctx.strokeStyle = '#ffd84a';
  ctx.lineWidth = 2.5;
  if (sel.kind === 'platform') {
    const p = state.data.platforms[sel.index];
    if (!p) return;
    ctx.strokeRect(p.x - 3, p.y - 3, p.w + 6, p.h + 6);
  } else if (sel.kind === 'tree') {
    const t = state.data.trees[sel.index];
    if (!t) return;
    const x = t.stumpX - t.capW / 2;
    const y = t.topY - t.capH;
    ctx.strokeRect(x - 3, y - 3, t.capW + 6, (t.baseY - y) + 6);
  } else if (sel.kind === 'liana') {
    const l = state.data.lianas[sel.index];
    if (!l) return;
    // Anker und Tip hervorheben
    drawHandle(ctx, l.anchorX, l.anchorY, '#ffd84a');
    drawHandle(ctx, l.anchorX, l.anchorY + l.length, '#4ad7ff');
    // Linie vom Anker zum Tip in Selektionsfarbe
    ctx.strokeStyle = 'rgba(255, 216, 74, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(l.anchorX, l.anchorY);
    ctx.lineTo(l.anchorX, l.anchorY + l.length);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawHandle(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// === DOM-Overlays (Toolbar, Sidebar, Trash) ===========================

let dom = null;

function buildDom() {
  if (dom) return;
  dom = {};

  // Toolbar oben
  const toolbar = el('div', { id: 'editor-toolbar' });
  toolbar.innerHTML = `
    <span class="grp">
      <button data-act="add-platform-ground">+ Boden</button>
      <button data-act="add-platform-float">+ Float</button>
    </span>
    <span class="grp">
      <button data-act="add-tree-mushroom">+ Mushroom</button>
      <button data-act="add-tree-leafy">+ Leafy</button>
      <button data-act="add-tree-palm">+ Palm</button>
    </span>
    <span class="grp">
      <button data-act="add-liana">+ Liane</button>
    </span>
    <span class="grp">
      <label><input type="checkbox" id="ed-hb" checked> Hitboxen</label>
      <label><input type="checkbox" id="ed-arc" checked> Sprung-Bögen</label>
    </span>
    <span class="grp grp-right">
      <button data-act="export">Export JS</button>
      <button data-act="reset" class="warn">Reset</button>
      <button data-act="play" class="play">Play (E)</button>
    </span>
  `;
  document.body.appendChild(toolbar);
  toolbar.addEventListener('click', onToolbarClick);
  toolbar.querySelector('#ed-hb').addEventListener('change', e => { state.showHitboxes = e.target.checked; });
  toolbar.querySelector('#ed-arc').addEventListener('change', e => { state.showJumpArcs = e.target.checked; });
  dom.toolbar = toolbar;

  // Sidebar rechts
  const sidebar = el('div', { id: 'editor-sidebar' });
  document.body.appendChild(sidebar);
  dom.sidebar = sidebar;

  // Trash unten
  const trash = el('div', { id: 'editor-trash' });
  trash.innerHTML = '<span>🗑️ hierhin ziehen zum Löschen</span>';
  document.body.appendChild(trash);
  dom.trash = trash;

  injectStyles();
  refreshSidebar();
}

function onToolbarClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  const act = btn.dataset.act;
  switch (act) {
    case 'add-platform-ground': addPlatform('ground'); break;
    case 'add-platform-float':  addPlatform('float'); break;
    case 'add-tree-mushroom':   addTree('mushroom'); break;
    case 'add-tree-leafy':      addTree('leafy'); break;
    case 'add-tree-palm':       addTree('palm'); break;
    case 'add-liana':           addLiana(); break;
    case 'export':              doExport(); break;
    case 'reset':               doReset(); break;
    case 'play':                window.dispatchEvent(new CustomEvent('liane:toggle-editor')); break;
  }
}

function refreshSidebar() {
  if (!dom) return;
  const sb = dom.sidebar;
  const sel = getSelected();
  if (!sel || !state.active) {
    sb.innerHTML = '<div class="hint">Klick auf ein Objekt im Canvas, um es zu bearbeiten.<br><br>Pfeiltasten / WASD: Kamera bewegen.<br>Backspace: Löschen.<br>E: zurück zum Spiel.</div>';
    sb.style.display = state.active ? 'block' : 'none';
    return;
  }
  sb.style.display = 'block';
  const kind = state.selection.kind;
  let html = `<h3>${kindLabel(kind)} #${state.selection.index}</h3>`;
  for (const [key, val] of Object.entries(sel)) {
    if (key === 'type' && kind === 'tree') {
      html += `<label>type
        <select data-key="type">
          ${['mushroom','leafy','palm'].map(t => `<option value="${t}" ${t===val?'selected':''}>${t}</option>`).join('')}
        </select>
      </label>`;
    } else if (key === 'type' && kind === 'platform') {
      html += `<label>type
        <select data-key="type">
          <option value="ground" ${val==='ground'?'selected':''}>ground</option>
          <option value="float"  ${val==='float'?'selected':''}>float</option>
        </select>
      </label>`;
    } else if (typeof val === 'number') {
      html += `<label>${key}<input type="number" data-key="${key}" value="${val}" step="1"></label>`;
    } else if (typeof val === 'boolean') {
      html += `<label class="cb"><input type="checkbox" data-key="${key}" ${val?'checked':''}> ${key}</label>`;
    } else if (typeof val === 'string') {
      html += `<label>${key}<input type="text" data-key="${key}" value="${val}"></label>`;
    }
  }
  html += `<div class="actions">
    <button data-act-row="duplicate">Duplizieren</button>
    <button data-act-row="delete" class="warn">Löschen</button>
  </div>`;
  sb.innerHTML = html;

  sb.querySelectorAll('input,select').forEach(input => {
    input.addEventListener('input', e => {
      const target = getSelected();
      if (!target) return;
      const k = e.target.dataset.key;
      let v = e.target.value;
      if (e.target.type === 'number') v = Number(v);
      if (e.target.type === 'checkbox') v = e.target.checked;
      target[k] = v;
      commit();
    });
  });
  sb.querySelectorAll('button[data-act-row]').forEach(btn => {
    btn.addEventListener('click', e => {
      const a = btn.dataset.actRow;
      if (a === 'duplicate') duplicateSelection();
      if (a === 'delete')    deleteSelection();
    });
  });
}

function kindLabel(kind) {
  return { platform: 'Plattform', tree: 'Baum', liana: 'Liane' }[kind] || kind;
}

function isOverTrash(clientX, clientY) {
  if (!dom?.trash) return false;
  const r = dom.trash.getBoundingClientRect();
  return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
}

function updateTrashHover(clientX, clientY) {
  setTrashHover(isOverTrash(clientX, clientY));
}

function setTrashHover(active) {
  if (dom?.trash) dom.trash.classList.toggle('hover', !!active);
}

function doExport() {
  const code = serializeLevel(state.data);
  // Versuche Clipboard, sonst Prompt
  try {
    navigator.clipboard.writeText(code);
    flash('In die Zwischenablage kopiert! Füge es als defaultLevel1Data in src/level.js ein.');
  } catch (_) {
    window.prompt('Level als JS-Snippet — kopiere das hier:', code);
  }
}

function doReset() {
  if (!confirm('Wirklich auf das Default-Level zurücksetzen? Lokale Änderungen gehen verloren.')) return;
  clearStoredLevelData();
  setLevelData(cloneLevelData(defaultLevel1Data));
  if (state.onChange) state.onChange();
}

function flash(msg) {
  let f = document.getElementById('editor-flash');
  if (!f) {
    f = el('div', { id: 'editor-flash' });
    document.body.appendChild(f);
  }
  f.textContent = msg;
  f.classList.add('show');
  setTimeout(() => f.classList.remove('show'), 2200);
}

function el(tag, attrs = {}) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function injectStyles() {
  if (document.getElementById('editor-styles')) return;
  const s = document.createElement('style');
  s.id = 'editor-styles';
  s.textContent = `
    body:not(.editor-active) #editor-toolbar,
    body:not(.editor-active) #editor-sidebar,
    body:not(.editor-active) #editor-trash { display: none !important; }
    #editor-toolbar {
      position: fixed; top: 0; left: 0; right: 0;
      display: flex; align-items: center; gap: 12px; padding: 6px 12px;
      background: rgba(20,30,30,0.92); color: #fafaf5; z-index: 100;
      font-family: system-ui, sans-serif; font-size: 13px;
      border-bottom: 1px solid #444; flex-wrap: wrap;
    }
    #editor-toolbar .grp { display: flex; align-items: center; gap: 6px; padding: 0 4px; border-right: 1px solid rgba(255,255,255,0.08); }
    #editor-toolbar .grp:last-child { border-right: none; }
    #editor-toolbar .grp-right { margin-left: auto; }
    #editor-toolbar button {
      background: #4a8a4a; color: #fff; border: none; padding: 6px 10px;
      border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px;
    }
    #editor-toolbar button:hover { background: #5fa45f; }
    #editor-toolbar button.warn { background: #aa4040; }
    #editor-toolbar button.warn:hover { background: #c25555; }
    #editor-toolbar button.play { background: #d6a04a; color: #1a1a2e; }
    #editor-toolbar button.play:hover { background: #e6b860; }
    #editor-toolbar label { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
    #editor-sidebar {
      position: fixed; top: 50px; right: 0; width: 240px; max-height: calc(100vh - 60px);
      overflow-y: auto; background: rgba(20,30,30,0.92); color: #fafaf5;
      padding: 12px; z-index: 99; font-family: system-ui, sans-serif; font-size: 13px;
      border-left: 1px solid #444; box-sizing: border-box;
    }
    #editor-sidebar h3 { margin: 0 0 10px; font-size: 14px; color: #ffd84a; }
    #editor-sidebar label { display: flex; flex-direction: column; gap: 3px; margin-bottom: 8px; font-size: 12px; }
    #editor-sidebar label.cb { flex-direction: row; align-items: center; gap: 6px; }
    #editor-sidebar input, #editor-sidebar select {
      background: #1a1a22; color: #fafaf5; border: 1px solid #444;
      padding: 5px 6px; border-radius: 3px; font-size: 13px;
    }
    #editor-sidebar input[type="checkbox"] { width: auto; }
    #editor-sidebar .actions { display: flex; gap: 6px; margin-top: 10px; }
    #editor-sidebar .actions button {
      flex: 1; padding: 6px; border: none; border-radius: 4px; cursor: pointer;
      background: #4a6a8a; color: #fff; font-weight: bold;
    }
    #editor-sidebar .actions button.warn { background: #aa4040; }
    #editor-sidebar .hint { color: rgba(255,255,255,0.7); font-size: 12px; line-height: 1.5; }
    #editor-trash {
      position: fixed; bottom: 0; left: 0; right: 0; height: 56px;
      background: rgba(170, 60, 60, 0.65); color: #fff; z-index: 99;
      display: flex; align-items: center; justify-content: center;
      font-family: system-ui, sans-serif; font-size: 14px; font-weight: bold;
      border-top: 2px dashed rgba(255,255,255,0.5);
      transition: background 0.15s;
      pointer-events: none;
    }
    #editor-trash.hover {
      background: rgba(255, 90, 90, 0.9);
    }
    #editor-flash {
      position: fixed; top: 60px; left: 50%; transform: translateX(-50%);
      background: #2a8a4a; color: #fff; padding: 10px 18px; border-radius: 6px;
      z-index: 200; opacity: 0; transition: opacity 0.2s;
      font-family: system-ui, sans-serif; font-size: 13px; pointer-events: none;
    }
    #editor-flash.show { opacity: 1; }
  `;
  document.head.appendChild(s);
}
