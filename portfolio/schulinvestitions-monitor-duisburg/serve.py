#!/usr/bin/env python3
"""Minimal static server for local preview of the Schulinvestitions-Monitor Duisburg demo.
Usage: python3 serve.py [port]   (default 8127)
"""
import http.server, socketserver, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8127


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Schulinvestitions-Monitor Duisburg läuft auf http://localhost:{PORT}")
    httpd.serve_forever()
