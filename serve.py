#!/usr/bin/env python3
"""Kleiner Dev-Server mit no-cache-Headern, damit Browser-Module immer frisch geladen werden.

Enthält außerdem eine lokale Attrappe der Online-Rangliste (/api/scores), die sich
wie die Vercel-Function in api/scores.js verhält, aber in .leaderboard-dev.json
speichert. So lässt sich die Rangliste ohne Vercel/Redis testen.
"""
import http.server
import json
import os
import re
import socketserver
import unicodedata
from urllib.parse import urlparse, parse_qs

PORT = 8123
STORE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".leaderboard-dev.json")
TOP_N = 10
HIGHER_IS_BETTER = {"endless": True, "level": False}


def load_store():
    try:
        with open(STORE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {"endless": {}, "level": {}}


def save_store(data):
    with open(STORE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def sanitize_name(raw):
    if not isinstance(raw, str):
        return None
    name = unicodedata.normalize("NFC", raw)
    name = "".join(c for c in name if c.isalnum() or c in " ._-!?")
    name = re.sub(r"\s+", " ", name).strip()[:16]
    return name or None


def is_plausible(mode, value, elapsed_ms):
    if not isinstance(value, int) or not isinstance(elapsed_ms, (int, float)):
        return False
    if mode == "endless":
        return 1 <= value <= 100000 and elapsed_ms >= value * 25
    return 8000 <= value <= 3600000


def ranked(scores, mode):
    items = sorted(scores.items(), key=lambda kv: kv[1], reverse=HIGHER_IS_BETTER[mode])
    return [{"name": n, "value": v} for n, v in items]


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path != "/api/scores":
            return super().do_GET()
        mode = parse_qs(url.query).get("mode", [None])[0]
        if mode not in HIGHER_IS_BETTER:
            return self.send_json(400, {"error": "bad_mode"})
        store = load_store()
        self.send_json(200, {"entries": ranked(store.get(mode, {}), mode)[:TOP_N]})

    def do_POST(self):
        if urlparse(self.path).path != "/api/scores":
            return self.send_json(404, {"error": "not_found"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}")
        except ValueError:
            body = {}
        mode = body.get("mode")
        name = sanitize_name(body.get("name"))
        value = body.get("value")
        elapsed = body.get("elapsedMs")
        if mode not in HIGHER_IS_BETTER:
            return self.send_json(400, {"error": "bad_mode"})
        if not name:
            return self.send_json(400, {"error": "bad_name"})
        if not is_plausible(mode, value, elapsed):
            return self.send_json(400, {"error": "implausible"})

        store = load_store()
        scores = store.setdefault(mode, {})
        prev = scores.get(name)
        better = prev is None or (value > prev if HIGHER_IS_BETTER[mode] else value < prev)
        if better:
            scores[name] = value
            save_store(store)
        rows = ranked(scores, mode)
        rank = next(i for i, r in enumerate(rows) if r["name"] == name)
        self.send_json(200, {"rank": rank, "best": scores[name], "name": name, "entries": rows[:TOP_N]})


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
    print(f"Liane dev server → http://localhost:{PORT}")
    httpd.serve_forever()
