# Liane

Ein 2D-Jump-&-Run-Browsergame: Der Held schwingt sich an Lianen und Palmwedeln
von Baum zu Baum durch eine Jungle-Szene. Gegner sind Vögel (die im Sturzflug
angreifen und denen man sich ducken muss), Skorpione (patrouillieren am Boden
und klettern Baumstämme hoch) und Spinnen (hängen an Seidenfäden, können durch
Draufspringen besiegt werden). Ein Power-Up-Block verleiht für 10 Sekunden
höhere Sprünge und macht die Baumkronen begehbar.

Alles ist mit HTML5 Canvas + Vanilla-JS implementiert, Scribble-Optik mit
handgezeichnet wirkenden wackeligen Linien.

## Lokale Entwicklung

Der lokale Dev-Server (Python 3) liefert alle Dateien mit `Cache-Control: no-cache`
aus, damit Browser-ESM-Modulcache keine Änderungen "verschluckt":

```bash
python3 serve.py
# → http://localhost:8123
```

## Deployment auf Vercel

Dies ist eine rein statische Seite — keine Build-Schritte, keine npm-Abhängigkeiten.

### Variante 1: Direkt über GitHub (empfohlen)

1. Ein leeres GitHub-Repo anlegen (z.B. `liane-game`).
2. `git remote add origin git@github.com:<nutzer>/<repo>.git`
3. `git push -u origin main`
4. Auf https://vercel.com/new das Repo importieren.
   - Framework Preset: **Other** (Static Site)
   - Build Command: *leer*
   - Output Directory: *leer* (Wurzel)
5. Fertig — Vercel deployed den Wurzelordner statisch.

### Variante 2: Vercel CLI

```bash
npm install -g vercel
vercel
```

Folge dem Dialog, Standardeinstellungen reichen.

## Steuerung

- `←` / `→` oder `A` / `D` — laufen
- `↓` — ducken (zum Ausweichen tief fliegender Vögel)
- `Space` — springen · Liane/Palmwedel greifen · Loslassen der Liane (Taste loslassen)
- `↑` — an der Liane hochklettern
- `R` — Neustart nach Ende

## Gegner besiegen / ausweichen

- **Vögel**: nicht berühren, bei tiefen Sturzflügen ducken
- **Skorpione**: nicht berühren — weder am Boden noch während sie einen Stamm hochkriechen
- **Spinnen**: von oben draufspringen (Mario-Stil) — der Held bekommt einen Bounce
