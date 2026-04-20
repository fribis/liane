// Tastatur-Eingabe.

const down = new Set();
const pressedThisFrame = new Set();
const releasedThisFrame = new Set();
let pendingPress = new Set();
let pendingRelease = new Set();

const keyMap = {
  'ArrowLeft':  'left',
  'ArrowRight': 'right',
  'ArrowUp':    'up',
  'ArrowDown':  'down',
  'KeyA':       'left',
  'KeyD':       'right',
  'KeyW':       'up',
  'KeyS':       'down',
  'Space':      'jump',
  'KeyR':       'reset',
  'Enter':      'jump',
};

export function initInput() {
  window.addEventListener('keydown', e => {
    const a = keyMap[e.code];
    if (!a) return;
    if (!down.has(a)) pendingPress.add(a);
    down.add(a);
    if (a === 'jump' || a === 'up' || a === 'down' || a === 'left' || a === 'right') e.preventDefault();
  });
  window.addEventListener('keyup', e => {
    const a = keyMap[e.code];
    if (!a) return;
    down.delete(a);
    pendingRelease.add(a);
  });
  // Wenn Fenster Fokus verliert, alle Tasten loslassen.
  window.addEventListener('blur', () => {
    for (const a of down) pendingRelease.add(a);
    down.clear();
  });
}

export function updateInput() {
  pressedThisFrame.clear();
  releasedThisFrame.clear();
  for (const a of pendingPress) pressedThisFrame.add(a);
  for (const a of pendingRelease) releasedThisFrame.add(a);
  pendingPress.clear();
  pendingRelease.clear();
}

export function isDown(action) { return down.has(action); }
export function wasPressed(action) { return pressedThisFrame.has(action); }
export function wasReleased(action) { return releasedThisFrame.has(action); }
