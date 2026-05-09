# Mini-Level-Editor

## Context

Während der Entwicklung von Liane wurden Level-Anpassungen über manuelle Edits in [`src/level.js`](../src/level.js) gemacht. Mit wachsendem Level-Umfang und mehreren Iterationen (z.B. Vögel zu tief, Bäume nicht kletterbar, neue Power-ups) entstand der Wunsch nach einem In-Game-Editor, mit dem man Plattformen, Bäume und Lianen direkt im laufenden Spiel verschieben, hinzufügen und löschen kann — und der die Änderungen sowohl im Browser persistiert als auch als JS-Snippet exportiert, das man zurück nach `level.js` kopieren kann.

Ziel: schnellere Level-Iteration ohne IDE-Wechsel, sowohl auf Desktop (Maus + Tastatur) als auch auf iPad (Touch).

## Entscheidungen (im Interview gesetzt)

| Aspekt | Wahl |
|---|---|
| Modus | In-Game-Toggle mit `E` |
| Scope | Plattformen (Boden + Float), Bäume (3 Typen), Lianen |
| Editing | Drag & Drop + Sidebar mit Werten |
| Erstellen | Toolbar mit Add-Buttons (kein Dropdown — alle Baumtypen direkt) |
| Snap | Frei, kein Grid |
| Edit↔Play | `E` toggelt, Level startet beim Wechsel immer frisch |
| Löschen | Drag in Trash-Zone (Mülltonne unten) |
| Lianen | Auto-Snap auf nächste Baumkrone |
| Persistenz | localStorage **und** Export-Button |
| Plattform | Desktop **und** iPad/Touch |
| Helpers | Hitbox-AABBs + Sprung-Reichweiten-Bögen |

## Architektur

### Daten ↔ Instanzen-Trennung

[`src/level.js`](../src/level.js) ist umgebaut: das Level liegt jetzt als reines POJO `defaultLevel1Data` (serialisierbar) vor. `buildLevel(data)` erzeugt daraus den Instanz-Graph (Tree-/Liana-/Bird-/Scorpion-/Spider-/PowerupBlock-/Flag-Klassen), den der Game-Loop verwendet.

Drei Hilfsfunktionen:
- `loadLevelData()` — liest aus `localStorage[liane.levelData.v1]`, fällt auf Default zurück.
- `saveLevelData(data)` — schreibt nach jedem Edit.
- `serializeLevel(data)` — erzeugt einen kopierfähigen JS-Snippet (kein `JSON.stringify`, sondern handgepflegtes Pretty-Printing mit Struct-Reihenfolge).
- `clearStoredLevelData()` — Reset.

### Editor-Modul

[`src/editor.js`](../src/editor.js) kapselt:
- **State**: aktuelle Selektion, Drag-State, Helper-Toggles, aktive Pointer.
- **Pointer-Events** auf dem Canvas (mouse + touch unified via Pointer Events). Multi-Touch: zweite Berührung startet Camera-Pan-Gestus, einfacher Touch macht Drag.
- **Hit-Test** (Lianen → Bäume → Plattformen, kleine Objekte zuerst).
- **DOM-Overlays**: Toolbar oben, Sidebar rechts, Trash-Zone unten, Flash-Toast für Bestätigungen. CSS wird inline injiziert.
- **Render-Overlays** im Welt-Koordinatensystem (Selektions-Rahmen, Lianen-Handles, Hitboxen, Sprung-Bögen).
- **commit()**: ruft `saveLevelData()` und den `onChange`-Callback (rebuilt Level-Instanzen).

### Hookup in main.js

[`src/main.js`](../src/main.js):
- Lädt beim Start `levelData` aus localStorage oder Default.
- Trennt `rebuildLevel()` (komplett mit Player-Reset) von `rebuildLevelOnly()` (nur Instanzen, für Edit-Live-Update).
- Neue Mode `'edit'`. Spielupdate (player, enemies, bubbles, timer) läuft im Edit-Modus nicht.
- `wasPressed('editor')` ruft `toggleEditor()`. Beim Verlassen wird `startGame()` aufgerufen — frischer Held, Timer auf 0.
- Editor-Overlays werden nach allen Game-Layern im Render-Pass gezeichnet, im Welt-Translate-Kontext.

### Tastatur

`KeyE` ist als `editor`-Action in [`src/input.js`](../src/input.js) gemappt. Im Edit-Modus werden die bestehenden `left`/`right`-Actions (über `isDown`) für Camera-Pan verwendet — keine extra Listener nötig. Ein zusätzlicher `keydown`-Listener im Editor selbst behandelt `Backspace`/`Delete` zum Löschen, ignoriert aber Eingaben in Form-Feldern.

## Bedienungs-Cheat-Sheet

**Anschalten**: `E` im Spiel/Menü.

**Toolbar oben**
- `+ Boden`, `+ Float`, `+ Mushroom`, `+ Leafy`, `+ Palm`, `+ Liane` — fügt Objekt in Camera-Mitte ein.
- ☑ Hitboxen, ☑ Sprung-Bögen — Helper-Overlays.
- `Export JS` — kopiert den `defaultLevel1Data`-Block in die Zwischenablage (Fallback: Prompt-Dialog).
- `Reset` — Default wiederherstellen, localStorage löschen.
- `Play (E)` — zurück ins Spiel.

**Im Canvas**
- Klick auf Objekt → Auswahl + Sidebar.
- Drag → verschieben; bei Lianen sind Anker (gelb) und Tip (blau) separate Handles.
- Drop in Trash → löschen.
- Pfeiltasten / A,D → Camera horizontal pannen.
- Zwei Finger auf Touch → Camera pannen.
- `Backspace`/`Delete` → selektiertes Objekt löschen.

**Sidebar rechts**
- Live-Eingabefelder für alle Properties.
- Type-Dropdown bei Plattform/Baum.
- Buttons `Duplizieren` / `Löschen`.

## Verifikation (durchgeführt)

- Editor-Toggle via `E` schaltet sauber zwischen Modi um.
- Toolbar/Sidebar/Trash erscheinen nur im Edit-Modus.
- Add-Buttons fügen Objekte hinzu, sichtbar im Canvas + in Level-Instanzgraph.
- Auswahl und Drag wirken; Sidebar zeigt Werte und schreibt sie zurück.
- localStorage persistiert nach Reload (Test: 10. Mushroom blieb erhalten).
- `Reset` löscht Storage, beim Reload wieder 9 Default-Bäume.
- `serializeLevel()` produziert gültiges JS (manuell verglichen).

## Bekannte Einschränkungen / Follow-ups

1. **Camera-Pan vertikal**: aktuell nur horizontal. Falls Level mal höher als 720 px wird, müssen `up`/`down` ebenfalls verarbeitet werden (`camera.y` clampen).
2. **Drag-Performance**: Bei jedem Frame wird `rebuildLevelOnly()` aufgerufen, was alle Instanzen neu allokiert. Für 9 Trees + 18 Lianen + Gegner ist das OK, könnte bei größeren Levels aber spürbar werden. Optimierung: Drag-Delta direkt auf der Tree-Instanz anwenden, ohne kompletten Rebuild.
3. **Undo/Redo**: nicht vorhanden. Die meisten Aktionen sind reversibel via Sidebar-Edit, aber ein Versehentliches-Löschen ist verloren. Mögliche Erweiterung: Snapshot-Stack im commit().
4. **Out-of-scope-Objekte**: Gegner, Powerups, Fahne, Spawnpoint sind nicht editierbar. Wenn nötig, derselbe Mechanismus erweiterbar — Rohling für `addEnemy(type)` / `addPowerup(type)` ist im Editor-State direkt anschließbar.
5. **Mobile-Sidebar**: Sidebar ist 240 px breit und auf kleinem iPhone-Display nicht ideal. Auf iPad in Landscape passt's. Für Phone-Portrait müsste der Sidebar als Bottom-Sheet eingeklappt werden.
6. **Konflikt mit Game-Tasten**: Im Edit-Modus reagieren `left`/`right` auf Pan, was sinnvoll ist. Aber wenn der Editor-Mode irgendwo mal von der Spiellogik durchsickert, könnten Tasten beide Effekte haben. Aktuell sauber getrennt durch `if (mode === 'edit')`.
7. **Touch-Zone für UI**: Tabbar/Sidebar/Trash sind absolute-positioned über dem Canvas. Auf manchen iPad-Modi kann das Canvas dahinter unbedacht Pointer fangen. Touch-Action ist auf `none` gesetzt — sollte halten.

## Pending (nach Approval)

- [ ] Commit der Änderungen: `level.js`-Refactor, neue Datei `editor.js`, `input.js`-Add (`KeyE`), `main.js`-Integration. Vorschlag-Message: *"Add mini level editor (E toggle, drag/sidebar/trash, localStorage + JS export)"*.
- [ ] Push nach GitHub → automatischer Vercel-Redeploy.
- [ ] Im Live-Spiel testen, ob iPad-Touch sauber funktioniert (Pinch-Zoom des Browsers könnte stören — `touch-action: none` ist gesetzt, aber Safari kann eigenwillig sein).
- [ ] Nach erstem Praxistest: Sidebar-Layout für kleinere Viewports nachjustieren, falls notwendig.
