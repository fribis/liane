// Client für die Online-Rangliste (/api/scores) + Namens-Eingabe.
//
// Ablauf nach einem Lauf (gesteuert aus main.js über `reportRun`):
//   1. Kein Spielername gespeichert → Eingabe-Dialog (HTML, damit die iPad-Tastatur geht).
//   2. Wert an /api/scores schicken, Antwort enthält Rang + Top 10.
//   3. Bei Fehler/offline → state.status = 'offline', main.js zeigt dann die lokale Liste.
//
// `state` wird von ui.js gelesen, um den End-Screen zu zeichnen.

const NAME_KEY = 'liane.playerName';

export const state = {
  status: 'idle',     // idle | prompt | loading | ok | offline
  mode: null,
  entries: [],
  rank: null,         // 0-basierter Rang des Spielers (kann > 9 sein)
  best: null,         // persönlicher Bestwert online
  name: null,
};

let runId = 0;        // verhindert, dass eine alte Antwort einen neuen Lauf überschreibt
let dom = null;
let promptResolve = null;

export function getPlayerName() {
  try { return localStorage.getItem(NAME_KEY) || null; } catch (_) { return null; }
}

function setPlayerName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch (_) {}
}

export function isPromptOpen() {
  return state.status === 'prompt';
}

export function reset() {
  runId++;
  state.status = 'idle';
  state.entries = [];
  state.rank = null;
  state.best = null;
  hideNameChip();
  closePrompt(null);
}

// Nach Spielende aufrufen. `value` = Meter (endless) bzw. Millisekunden (level).
export async function reportRun(mode, value, elapsedMs) {
  const id = ++runId;
  state.mode = mode;
  state.entries = [];
  state.rank = null;
  state.best = null;

  let name = getPlayerName();
  if (!name) {
    state.status = 'prompt';
    name = await askName('');
    if (id !== runId) return;
    if (name) setPlayerName(name);
  }
  state.name = name;
  state.status = 'loading';

  try {
    const res = name
      ? await post({ mode, name, value, elapsedMs })
      : await get(mode);                       // übersprungen → nur Liste anzeigen
    if (id !== runId) return;
    state.entries = res.entries || [];
    state.rank = typeof res.rank === 'number' ? res.rank : null;
    state.best = typeof res.best === 'number' ? res.best : null;
    if (res.name) {
      state.name = res.name;                   // vom Server bereinigter Name
      setPlayerName(res.name);
    }
    state.status = 'ok';
    showNameChip();
  } catch (_) {
    if (id !== runId) return;
    state.status = 'offline';
  }
}

async function get(mode) {
  const r = await fetch(`/api/scores?mode=${encodeURIComponent(mode)}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return r.json();
}

async function post(payload) {
  const r = await fetch('/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return r.json();
}

// === DOM: Namens-Dialog + "Name ändern"-Chip =============================

function askName(initial) {
  buildDom();
  closePrompt(null);
  dom.input.value = initial || '';
  dom.prompt.classList.add('show');
  // Fokus erst nach dem Frame setzen — sonst ignoriert iOS ihn teilweise
  setTimeout(() => dom.input.focus(), 50);
  return new Promise(resolve => { promptResolve = resolve; });
}

function closePrompt(value) {
  if (dom) {
    dom.prompt.classList.remove('show');
    dom.input.blur();
  }
  if (promptResolve) {
    const r = promptResolve;
    promptResolve = null;
    r(value);
  }
}

function submitPrompt() {
  const v = dom.input.value.replace(/\s+/g, ' ').trim().slice(0, 16);
  if (!v) { dom.input.focus(); return; }
  closePrompt(v);
}

function showNameChip() {
  buildDom();
  dom.chipName.textContent = state.name || '—';
  dom.chip.classList.add('show');
}

function hideNameChip() {
  if (dom) dom.chip.classList.remove('show');
}

async function changeName() {
  hideNameChip();
  const prev = state.status;
  state.status = 'prompt';
  const name = await askName(getPlayerName() || '');
  state.status = prev;
  if (name) {
    setPlayerName(name);
    state.name = name;
  }
  showNameChip();
}

function buildDom() {
  if (dom) return;
  dom = {};

  const prompt = document.createElement('div');
  prompt.id = 'lb-prompt';
  prompt.innerHTML = `
    <form class="card">
      <div class="title">Online-Rangliste</div>
      <label for="lb-name">Unter welchem Namen soll dein Ergebnis erscheinen?</label>
      <input id="lb-name" type="text" maxlength="16" autocomplete="nickname"
             autocapitalize="words" spellcheck="false" placeholder="Dein Name">
      <div class="row">
        <button type="button" class="skip">Überspringen</button>
        <button type="submit" class="ok">Eintragen</button>
      </div>
      <div class="note">Name wird gespeichert und gilt für alle weiteren Läufe.</div>
    </form>`;
  document.body.appendChild(prompt);
  dom.prompt = prompt;
  dom.input = prompt.querySelector('input');
  prompt.querySelector('form').addEventListener('submit', e => { e.preventDefault(); submitPrompt(); });
  prompt.querySelector('.skip').addEventListener('click', () => closePrompt(null));
  // Tasten im Dialog nicht ans Spiel weitergeben (ESC schließt)
  dom.input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') closePrompt(null);
  });

  const chip = document.createElement('button');
  chip.id = 'lb-chip';
  chip.type = 'button';
  chip.innerHTML = '👤 <span></span> <em>✎</em>';
  chip.addEventListener('click', e => { e.preventDefault(); changeName(); });
  document.body.appendChild(chip);
  dom.chip = chip;
  dom.chipName = chip.querySelector('span');

  const style = document.createElement('style');
  style.textContent = `
    #lb-prompt {
      position: fixed; inset: 0; z-index: 120; display: none;
      align-items: center; justify-content: center;
      background: rgba(10, 15, 12, 0.55);
    }
    #lb-prompt.show { display: flex; }
    #lb-prompt .card {
      background: #fff6d6; color: #1a1a2e; border: 3px solid #1a1a2e; border-radius: 18px;
      padding: 22px 24px; width: min(420px, 86vw); box-shadow: 0 10px 30px rgba(0,0,0,0.4);
      font-family: 'Comic Sans MS', 'Marker Felt', system-ui, sans-serif;
      display: flex; flex-direction: column; gap: 12px;
    }
    #lb-prompt .title { font-size: 26px; font-weight: bold; text-align: center; }
    #lb-prompt label { font-size: 16px; text-align: center; }
    #lb-prompt input {
      font: inherit; font-size: 22px; padding: 10px 12px; border-radius: 10px;
      border: 2px solid #1a1a2e; background: #fff; color: #1a1a2e; text-align: center;
      -webkit-user-select: text; user-select: text; touch-action: auto;
    }
    #lb-prompt .row { display: flex; gap: 10px; }
    #lb-prompt button {
      flex: 1; font: inherit; font-size: 18px; padding: 10px; border-radius: 10px;
      border: 2px solid #1a1a2e; cursor: pointer;
    }
    #lb-prompt .ok { background: #ffdd77; font-weight: bold; }
    #lb-prompt .skip { background: transparent; }
    #lb-prompt .note { font-size: 13px; text-align: center; opacity: 0.7; }
    #lb-chip {
      position: fixed; z-index: 115; display: none;
      left: 50%; transform: translateX(-50%);
      bottom: max(20px, env(safe-area-inset-bottom, 20px));
      font-family: 'Comic Sans MS', 'Marker Felt', system-ui, sans-serif; font-size: 16px;
      background: rgba(0, 0, 0, 0.45); color: #fafaf5;
      border: 2px solid rgba(255, 255, 255, 0.5); border-radius: 999px;
      padding: 6px 14px; cursor: pointer;
    }
    #lb-chip.show { display: block; }
    #lb-chip em { font-style: normal; opacity: 0.8; }
  `;
  document.head.appendChild(style);
}
