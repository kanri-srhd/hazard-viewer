#!/usr/bin/env python3
"""
Simple tile proxy for development.

Usage:
  python tile_proxy.py 8080

Requests:
  /tile/{z}/{x}/{y}.png -> proxies to https://tile.openstreetmap.org/{z}/{x}/{y}.png
"""
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

class TileProxyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if not self.path.startswith('/tile/'):
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not found')
            return

        upstream_base = 'https://tile.openstreetmap.org'
        upstream_path = self.path[len('/tile'):]
        upstream_url = upstream_base + upstream_path

        try:
            req = Request(upstream_url, headers={'User-Agent': 'hazard-viewer-dev-proxy/1.0'})
            with urlopen(req, timeout=15) as resp:
                data = resp.read()
                content_type = resp.headers.get('Content-Type', 'image/png')

                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
        except HTTPError as e:
            self.send_response(e.code)
            self.end_headers()
            self.wfile.write(b'Upstream HTTPError')
        except URLError:
            self.send_response(502)
            self.end_headers()
            self.wfile.write(b'Bad gateway')
        except Exception:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b'Internal server error')

def run(port=8080):
    server = HTTPServer(('0.0.0.0', port), TileProxyHandler)
    print(f'Tile proxy running on http://0.0.0.0:{port}/tile/{{z}}/{{x}}/{{y}}.png')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopping...')
        server.server_close()

if __name__ == '__main__':
    port = 8080
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except Exception:
            pass
    run(port)
