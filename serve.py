#!/usr/bin/env python3
"""Dev server for ddr-fresh.

Serves the ddr-fresh directory (rooted at this file's location) on
127.0.0.1 with no-store caching. Port comes from the PORT env var,
default 8897.

Usage:  python3 serve.py            # http://127.0.0.1:8897/
        PORT=9000 python3 serve.py  # http://127.0.0.1:9000/
"""

import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8897"))
HOST = "127.0.0.1"


class NoStoreHandler(SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler with no-store cache headers."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # keep the console quiet


if __name__ == "__main__":
    handler = partial(NoStoreHandler, directory=ROOT)
    server = ThreadingHTTPServer((HOST, PORT), handler)
    print(f"Serving {ROOT} at http://{HOST}:{PORT}/ (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
