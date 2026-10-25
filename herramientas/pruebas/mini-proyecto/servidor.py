#!/usr/bin/env python3
import http.server

class ManejadorServidor(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/saludo':
            self.manejar_saludo_get()
            return

    def do_POST(self):
        if self.path == '/api/saludo':
            self.manejar_saludo_post()
            return

    def manejar_saludo_get(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'{"metodo": "GET"}')

    def manejar_saludo_post(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'{"metodo": "POST"}')
