// Lokale Bestenlisten (localStorage), Top 5 pro Modus.
// - Level-Modus: schnellste Zeiten (ms, aufsteigend)
// - Endlos-Modus: weiteste Distanzen (m, absteigend)

const MAX_ENTRIES = 5;
const KEYS = {
  level: 'liane.scores.level',
  endless: 'liane.scores.endless',
};
const LEGACY_BEST_KEY = 'liane.bestTime';

function read(key) {
  try {
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

function write(key, arr) {
  try { localStorage.setItem(key, JSON.stringify(arr)); } catch (_) {}
}

// Alte Einzel-Bestzeit einmalig in die neue Liste übernehmen.
function migrateLegacy() {
  const legacy = parseInt(localStorage.getItem(LEGACY_BEST_KEY) || '', 10);
  if (!Number.isFinite(legacy)) return;
  const list = read(KEYS.level);
  if (!list.length) write(KEYS.level, [{ value: legacy, date: null }]);
  localStorage.removeItem(LEGACY_BEST_KEY);
}
migrateLegacy();

export function getScores(mode) {
  return read(KEYS[mode]);
}

export function getBest(mode) {
  const list = read(KEYS[mode]);
  return list.length ? list[0].value : null;
}

// Trägt einen Wert ein. Gibt den Rang (0-basiert) zurück, oder -1 wenn er
// nicht in die Top 5 gekommen ist.
export function submitScore(mode, value) {
  const list = read(KEYS[mode]);
  const entry = { value, date: new Date().toISOString().slice(0, 10) };
  list.push(entry);
  list.sort((a, b) => mode === 'level' ? a.value - b.value : b.value - a.value);
  const top = list.slice(0, MAX_ENTRIES);
  write(KEYS[mode], top);
  return top.indexOf(entry);
}
