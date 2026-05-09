# Liane auf iOS — Steuerungs-Optionen

## Context

Die Liane-Webversion (HTML5 Canvas + Vanilla JS) läuft aktuell nur mit Desktop-Tastatur. Damit das Spiel auch auf iOS spielbar ist (Safari mobil oder als Home-Screen-App), braucht es touch-basierte Eingaben. Die bestehende Input-Abstraktion in [../src/input.js](../src/input.js) unterstützt sechs Actions: `left`, `right`, `up`, `down`, `jump`, `reset`. Jede touch-Lösung muss diese Actions in `pendingPress` / `pendingRelease` / `down` schreiben — dann bleibt der Rest des Spielcodes unverändert.

Mechanik-Anforderungen (wichtig für die Wahl):
- **Lauf (`left`/`right`)**: gedrückt halten, präzises Timing am Plattformrand nötig.
- **Schwingen**: `jump` halten während der Liane, `left`/`right` pumpt den Schwung, `up` klettert hoch, Loslassen von `jump` = Liane loslassen — alles gleichzeitig möglich.
- **Sprung**: kurzer Tap vom Boden, aber gleichzeitig dient `jump` zum Greifen in der Luft.
- **Ducken (`down`)**: gedrückt halten, um tief fliegenden Vögeln auszuweichen.
- **Zwei-Finger-Gleichzeitigkeit** ist Pflicht (mind. Richtung + Jump).

## Optionen

### A) Virtuelles D-Pad + Jump-Button (Overlay-Buttons)

Zwei halbtransparente UI-Elemente, die über dem Canvas liegen und nur auf Touch-Geräten eingeblendet werden:

- **Unten links**: D-Pad (vier Pfeile oder Joystick-Stick). Tap links/rechts = laufen, Tap oben = hochklettern, Tap unten = ducken.
- **Unten rechts**: großer Jump-Button. Hold = Liane greifen/halten, Release = Liane loslassen.

*Vorteile*
- Vertraut für Mobile-Gamer. Direkte 1:1-Übersetzung der Keyboard-Actions, keine neuen Spielkonzepte.
- Funktioniert in jedem Browser, keine iOS-spezifischen APIs.
- Präzises Pumpen/Schwingen ist machbar.

*Nachteile*
- Verdeckt ca. 15–20 % der Spielfläche.
- Fingerauflage-Feeling kann indirekt wirken; Button-Größe muss stimmen.

*Aufwand*: ca. 1 neue Datei (`src/touch.js`), kleine Anpassung in `input.js` + `index.html` / CSS-Overlay. ~2–3 Stunden.

### B) Unsichtbare Touch-Zonen (Zone-Mapping)

Kein sichtbares UI. Stattdessen Bildschirm in semantische Zonen teilen:

- Linke Hälfte: Finger setzen + nach links/rechts ziehen = laufen. Nach unten ziehen = ducken. Nach oben ziehen = hochklettern.
- Rechte Hälfte: Tap/Hold = jump/grab. Zweiter Finger rechts zum schnellen Loslassen.

*Vorteile*
- Spielfläche komplett frei.
- Wirkt "clean", kein UI-Noise.

*Nachteile*
- Entdeckbarkeit schlecht — braucht Tutorial-Overlay beim ersten Start.
- Kombi "laufen rechts + jump + klettern hoch" wird am Daumen-Ergonomie schwierig.
- Ducken während Vogel-Sturzflug fordert schnelle Geste, leichter Hit-Gefahr.

*Aufwand*: ähnlich wie A, aber Tutorial-Overlay kommt dazu. ~3 Stunden.

### C) Tilt + Tap (DeviceOrientation)

Gerät seitlich neigen für Bewegung links/rechts, Tap für Jump.

*Vorteile*
- Immersiv, spielerisch.

*Nachteile*
- iOS 13+ verlangt explizite Permission (`DeviceOrientationEvent.requestPermission()`), nur nach User-Geste möglich → zusätzlicher Tap-Dialog beim Spielstart.
- Schwingen braucht präzise Timing-Kombi (Taste + Richtung) — Tilt zu grob für Pumpen.
- Ducken hat keinen sinnvollen Tilt-Gegenstück.
- **Nicht empfohlen** als Haupteingabe, nur als Bonus-Modus denkbar.

### D) Native iOS-Wrapper (Capacitor / WKWebView)

Die Webversion in eine native iOS-App einpacken (Capacitor, Tauri-Mobile oder direkter Xcode-Wrapper).

*Vorteile*
- App-Store-Distribution möglich.
- Zugriff auf MFi-Controller (Xbox/PS-Controller via Bluetooth), Haptic-Feedback.
- Fullscreen ohne Safari-UI-Balken.

*Nachteile*
- Apple Developer Account (99 USD/Jahr), App-Review-Prozess, Xcode.
- Deutlich mehr Setup-Aufwand, wenig Mehrwert für ein Hobby-Spiel.
- Touch-Steuerung braucht man trotzdem — keine Ersparnis.

*Aufwand*: 1–2 Tage Setup + laufende Pflege. **Overkill für aktuellen Projektstatus.**

### E) PWA — Add to Home Screen (orthogonal)

Unabhängig von der gewählten Touch-Lösung: ein Web-App-Manifest + Service-Worker macht das Spiel als "richtige App" installierbar (Icon auf Home-Screen, Fullscreen ohne Safari-UI).

*Vorteile*
- Keine Native-Entwicklung nötig.
- Nutzer-Erlebnis fast wie native: Splash, Icon, kein URL-Balken.
- Landscape-Orientierung kann im Manifest erzwungen werden.

*Nachteile*
- Kein App-Store; Nutzer muss "Zum Home-Bildschirm" selbst tippen.
- Service-Worker-Cache muss gepflegt werden (sonst sieht man keine Updates).

*Aufwand*: ~1 Stunde (manifest.json, minimaler Service-Worker, Icon).

## Empfehlung

**Kombination aus A + E**: virtuelle D-Pad/Jump-Buttons als Haupt-Touch-Eingabe + PWA-Manifest für Home-Screen-Install und Landscape-Lock.

Das liefert ein klar verständliches Kontroll-Schema, respektiert das schnelle Liana-Gameplay (Pump + Release), kostet wenig Code und ist komplett webbasiert (kein App-Store-Overhead). Die Tilt-Idee könnte man später als Easter-Egg-Modus nachrüsten.

## Vorschlag für die Umsetzung (wenn A+E gewählt)

**Neue Dateien:**
- `src/touch.js` — Erkennung von Touch-Start/Move/End auf vier Buttons (links, rechts, hoch, unten) + einem großen Jump-Button. Benutzt `touchId`-Tracking, damit Multi-Touch robust funktioniert.
- `manifest.webmanifest` + ein paar Icon-PNGs (192, 512 px) + `sw.js` (minimaler Cache).

**Änderungen:**
- [../src/input.js](../src/input.js): neue Funktion `registerTouchPress(action)` / `registerTouchRelease(action)` die dieselben Sets befüllen wie die Keyboard-Handler. Keine Game-Code-Änderung nötig — die Abstraktion hält.
- [../index.html](../index.html): HTML-Overlay mit den Touch-Buttons, CSS `@media (hover: none) and (pointer: coarse)` zeigt sie nur auf Touch-Geräten. `<link rel="manifest">` + `<meta name="apple-mobile-web-app-capable">`-Tags.
- [../src/main.js](../src/main.js): `initTouch()` aufrufen, nur wenn `'ontouchstart' in window`.

**Button-Layout (Vorschlag)**
```
 ┌─────────────────────────────────────────────────┐
 │                                                 │
 │              Spielfläche (Canvas)               │
 │                                                 │
 │                                                 │
 │  ┌───┐                                ┌──────┐  │
 │  │ ↑ │                                │      │  │
 │ ┌┴─┬─┴┐                               │ JUMP │  │
 │ │←│→│                                 │      │  │
 │ └┬─┴─┬┘                               └──────┘  │
 │  │ ↓ │                                          │
 │  └───┘                                          │
 └─────────────────────────────────────────────────┘
```

`↓` = ducken (Hold), `↑` = hochklettern an der Liane (Hold), `←/→` = laufen / pumpen (Hold), **JUMP** = springen / Liane greifen / Liane loslassen bei Release.

**PWA-Manifest**
```json
{
  "name": "Liane",
  "short_name": "Liane",
  "display": "fullscreen",
  "orientation": "landscape",
  "background_color": "#2d5a3a",
  "theme_color": "#2d5a3a",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "start_url": "/"
}
```

## Offene Punkte (Defaults bei Implementierung)

1. **Button-Sichtbarkeit**: Touch-UI nur auf Touch-Geräten (CSS-Media-Query + `'ontouchstart' in window`). Desktop-User sehen die Buttons nicht.
2. **Landscape erzwingen**: Manifest setzt `orientation: landscape`. Zusätzlich ein "Bitte Gerät drehen"-Overlay, falls jemand das Spiel im Browser im Hochformat öffnet.
3. **Icon**: Erstmal einfaches Platzhalter-Logo (großer "L" oder Held-Silhouette). Später durch sauberes Scribble-Icon ersetzen.

## Verifikation nach Implementierung

- Auf iPhone (Safari) + iPad (Safari) öffnen, beide Orientierungen durchspielen.
- Multi-Touch testen: gleichzeitig ←/→ + JUMP + ↑ (auf der Liane Pumpen + Klettern).
- "Zum Home-Bildschirm hinzufügen" in Safari → Icon + Fullscreen-Start prüfen.
- Sicherstellen, dass normale Desktop-Tastatur weiterhin funktioniert (Input-Paths nebeneinander).
- Chrome DevTools Device-Toolbar (iPhone 14) für schnelle Iteration verwenden.
