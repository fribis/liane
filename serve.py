#!/usr/bin/env python3
"""Kleiner Dev-Server mit no-cache-Headern, damit Browser-Module immer frisch geladen werden."""
import http.server
import socketserver

PORT = 8123


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
    print(f"Liane dev server → http://localhost:{PORT}")
    httpd.serve_forever()
