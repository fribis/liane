#!/usr/bin/env python3
"""Erzeugt einfache Platzhalter-Icons für die PWA, ohne externe Libs (nur stdlib).

Ausgabe:
  icons/icon-192.png            — 192x192, abgerundetes Quadrat mit "L"
  icons/icon-512.png            — 512x512, dito
  icons/icon-512-maskable.png   — 512x512, mit größerem Sicherheitsrand für Adaptive-Icons

Bei Bedarf neu laufen lassen. Später durch ein richtiges Logo ersetzen.
"""
import os
import struct
import zlib

BG = (45, 90, 58)        # #2d5a3a — Jungle-Grün
FG = (255, 220, 100)     # #ffdc64 — Sonnen-Gelb
ACCENT = (160, 90, 40)   # Liane-Braun


def in_round_rect(x, y, left, top, right, bottom, radius):
    if not (left <= x <= right and top <= y <= bottom):
        return False
    # Welcher Quadrant?
    cx = left + radius if x < left + radius else (right - radius if x > right - radius else x)
    cy = top + radius if y < top + radius else (bottom - radius if y > bottom - radius else y)
    if cx == x and cy == y:
        return True
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2


def in_rect(x, y, r):
    return r[0] <= x <= r[2] and r[1] <= y <= r[3]


def near_segment(x, y, x1, y1, x2, y2, thick):
    dx, dy = x2 - x1, y2 - y1
    L2 = dx * dx + dy * dy
    if L2 == 0:
        return False
    t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / L2))
    px2 = x1 + t * dx
    py2 = y1 + t * dy
    return (x - px2) ** 2 + (y - py2) ** 2 <= (thick / 2) ** 2


def write_png(path, w, h, pixels):
    raw = bytearray()
    stride = w * 4
    for yy in range(h):
        raw.append(0)  # Filter-Typ 0
        raw.extend(pixels[yy * stride:(yy + 1) * stride])
    compressed = zlib.compress(bytes(raw), 9)

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)  # 8-bit RGBA
    out = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(out)
    print(f"wrote {path} ({len(out)} bytes)")


def make_icon(path, size, safe_inset=0):
    w = h = size
    inset = safe_inset
    card_left, card_top = inset, inset
    card_right, card_bottom = size - inset, size - inset
    cw = card_right - card_left
    ch = card_bottom - card_top
    radius = max(8, cw * 0.18)

    # "L" zentriert
    l_h = ch * 0.55
    l_w = cw * 0.45
    l_thick = max(6, int(min(cw, ch) * 0.13))
    l_left = card_left + (cw - l_w) / 2
    l_top = card_top + (ch - l_h) / 2
    l_vert = (l_left, l_top, l_left + l_thick, l_top + l_h)
    l_horiz = (l_left, l_top + l_h - l_thick, l_left + l_w, l_top + l_h)

    # Liane-Schwung als dekorativer Bogen oben
    liane_x1 = card_left + cw * 0.65
    liane_y1 = card_top + ch * 0.18
    liane_x2 = card_left + cw * 0.88
    liane_y2 = card_top + ch * 0.55
    liane_thick = max(4, int(min(cw, ch) * 0.05))

    px = bytearray()
    for yy in range(h):
        for xx in range(w):
            x = xx + 0.5
            y = yy + 0.5
            if not in_round_rect(x, y, card_left, card_top, card_right, card_bottom, radius):
                px.extend((0, 0, 0, 0))
                continue
            r, g, b = BG
            if near_segment(x, y, liane_x1, liane_y1, liane_x2, liane_y2, liane_thick):
                r, g, b = ACCENT
            if in_rect(x, y, l_vert) or in_rect(x, y, l_horiz):
                r, g, b = FG
            px.extend((r, g, b, 255))

    write_png(path, w, h, px)


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    make_icon(os.path.join(here, "icon-192.png"), 192, safe_inset=0)
    make_icon(os.path.join(here, "icon-512.png"), 512, safe_inset=0)
    # Maskable: ~10% Sicherheitsrand, damit Android-Adaptive-Masken nichts abschneiden.
    make_icon(os.path.join(here, "icon-512-maskable.png"), 512, safe_inset=52)
