#!/usr/bin/env python3
"""Local preview server. Serves the site and falls back to /coaches/index.html for /coaches/* paths,
like the Netlify rewrite does. Usage: python3 portal-ops/scripts/dev_server.py [port] [site-root]"""
import http.server, os, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ROOT = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def do_GET(self):
        path = self.path.split("?")[0]
        if path.startswith("/portal-ops/") and not path.startswith(("/portal-ops/content/", "/portal-ops/tests/")):
            self.send_error(404); return   # mirror the Netlify block (content/ is allowed here for demo mode only)
        if path.startswith("/coaches/") and not os.path.splitext(path)[1] and not os.path.isfile(ROOT + path):
            self.path = "/coaches/index.html"
        super().do_GET()
    def end_headers(self):
        self.send_header("Cache-Control", "no-store"); super().end_headers()

http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
