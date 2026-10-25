#!/usr/bin/env python3
"""Pruebas automatizadas de la Fase A:
- Validación de usuarios.json
- Generación de IDs de usuario (tildes, espacios, mayúsculas, caracteres especiales)
- Identidad aislada quien_es() y endpoint GET /api/yo (cookie válida, inválida, sin cookie, y prioridad Cf-Access)
- Funcionamiento autónomo sin usuarios.json
- Sondas /api/estado y detección de puertos ocupados en iniciar.py
"""

from http.server import ThreadingHTTPServer
import importlib.util
import json
import pathlib
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.request

RAIZ_APPS = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ_APPS))

from portal.servidor import (
    ARCHIVO_USUARIOS,
    ManejadorPortal,
    cargar_usuarios_compartidos,
    generar_id_usuario,
    quien_es as quien_es_portal,
    validar_usuarios,
)


def cargar_modulo(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, str(ruta))
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


servidor_itinerario = cargar_modulo(
    'servidor_itinerario', RAIZ_APPS / 'itinerario-app' / 'servidor.py'
)
servidor_edt = cargar_modulo(
    'servidor_edt', RAIZ_APPS / 'project-organizer' / 'servidor.py'
)


class PeticionFalsa:
    def __init__(self, headers=None):
        self.headers = headers or {}


class PruebasFaseA(unittest.TestCase):
    def test_generar_id_usuario_tildes_espacios_mayusculas(self):
        self.assertEqual(generar_id_usuario('María José'), 'maria-jose')
        self.assertEqual(generar_id_usuario('Jesús Aragón'), 'jesus-aragon')
        self.assertEqual(generar_id_usuario('  Paola   Bello '), 'paola-bello')
        self.assertEqual(generar_id_usuario('Santiago Benavides'), 'santiago-benavides')
        self.assertEqual(generar_id_usuario('ÁÉÍÓÚ Ñ Ü'), 'aeiou-n-u')
        self.assertEqual(generar_id_usuario('jysusman'), 'jysusman')
        with self.assertRaises(ValueError):
            generar_id_usuario('   ---   ')

    def test_usuarios_json_real_es_valido(self):
        usuarios = cargar_usuarios_compartidos(ARCHIVO_USUARIOS, validar=True)
        self.assertTrue(len(usuarios) >= 5)
        ids = [u['id'] for u in usuarios]
        self.assertIn('jysusman', ids)
        self.assertIn('maria-jose', ids)
        self.assertIn('jesus-aragon', ids)
        self.assertIn('paola-bello', ids)
        self.assertIn('santiago-benavides', ids)

    def test_validar_usuarios_casos_invalidos(self):
        # No es lista
        with self.assertRaises(ValueError):
            validar_usuarios({'id': 'ana'})

        # ID con mayúsculas o caracteres inválidos
        with self.assertRaises(ValueError):
            validar_usuarios([
                {'id': 'Maria-Jose', 'nombre': 'María José', 'correo': '', 'rol': 'miembro'}
            ])

        with self.assertRaises(ValueError):
            validar_usuarios([
                {'id': 'maria_jose', 'nombre': 'María José', 'correo': '', 'rol': 'miembro'}
            ])

        # IDs duplicados
        with self.assertRaises(ValueError):
            validar_usuarios([
                {'id': 'ana', 'nombre': 'Ana 1', 'correo': '', 'rol': 'admin'},
                {'id': 'ana', 'nombre': 'Ana 2', 'correo': '', 'rol': 'miembro'},
            ])

        # Rol inválido
        with self.assertRaises(ValueError):
            validar_usuarios([
                {'id': 'ana', 'nombre': 'Ana', 'correo': '', 'rol': 'superadmin'}
            ])

        # Falta campo obligatorio
        with self.assertRaises(ValueError):
            validar_usuarios([
                {'id': 'ana', 'nombre': 'Ana', 'rol': 'miembro'}
            ])

    def test_quien_es_cookie_valida_invalida_sin_cookie_y_cf_access(self):
        with tempfile.TemporaryDirectory() as tmp:
            ruta_u = pathlib.Path(tmp) / 'usuarios.json'
            ruta_u.write_text(
                json.dumps([
                    {'id': 'jysusman', 'nombre': 'jysusman', 'correo': 'jy@example.com', 'rol': 'admin'},
                    {'id': 'maria-jose', 'nombre': 'María José', 'correo': '', 'rol': 'miembro'},
                ]),
                encoding='utf-8',
            )

            for funcion_quien_es in (
                quien_es_portal,
                servidor_itinerario.quien_es,
                servidor_edt.quien_es,
            ):
                # 1. Sin cookie
                self.assertIsNone(funcion_quien_es(PeticionFalsa({}), ruta_u))

                # 2. Cookie inválida
                self.assertIsNone(
                    funcion_quien_es(PeticionFalsa({'Cookie': 'usuario=no-existe'}), ruta_u)
                )

                # 3. Cookie válida
                identidad = funcion_quien_es(
                    PeticionFalsa({'Cookie': 'usuario=maria-jose'}), ruta_u
                )
                self.assertEqual(
                    identidad,
                    {'id': 'maria-jose', 'nombre': 'María José', 'rol': 'miembro'},
                )

                # 4. Prioridad de Cf-Access-Authenticated-User-Email sobre la cookie
                identidad_cf = funcion_quien_es(
                    PeticionFalsa({
                        'Cf-Access-Authenticated-User-Email': 'jy@example.com',
                        'Cookie': 'usuario=maria-jose',
                    }),
                    ruta_u,
                )
                self.assertEqual(
                    identidad_cf,
                    {'id': 'jysusman', 'nombre': 'jysusman', 'rol': 'admin'},
                )

                # 5. Sin archivo usuarios.json (modo autónomo)
                ruta_inexistente = pathlib.Path(tmp) / 'no_existe.json'
                self.assertIsNone(
                    funcion_quien_es(PeticionFalsa({'Cookie': 'usuario=jysusman'}), ruta_inexistente)
                )

    def test_endpoint_api_yo_en_los_tres_servidores(self):
        for clase_manejador in (
            ManejadorPortal,
            servidor_itinerario.ManejadorItinerario,
            servidor_edt.ManejadorProjectOrganizer,
        ):
            httpd = ThreadingHTTPServer(('127.0.0.1', 0), clase_manejador)
            puerto = httpd.server_address[1]
            hilo = threading.Thread(target=httpd.serve_forever, daemon=True)
            hilo.start()
            try:
                url = f'http://127.0.0.1:{puerto}/api/yo'

                # Sin cookie -> null
                with urllib.request.urlopen(url, timeout=2) as resp:
                    self.assertEqual(resp.status, 200)
                    self.assertIsNone(json.loads(resp.read().decode('utf-8')))

                # Con cookie inválida -> null
                req_invalida = urllib.request.Request(url, headers={'Cookie': 'usuario=fantasma'})
                with urllib.request.urlopen(req_invalida, timeout=2) as resp:
                    self.assertEqual(resp.status, 200)
                    self.assertIsNone(json.loads(resp.read().decode('utf-8')))

                # Con cookie válida -> objeto {id, nombre, rol}
                req_valida = urllib.request.Request(url, headers={'Cookie': 'usuario=jysusman'})
                with urllib.request.urlopen(req_valida, timeout=2) as resp:
                    self.assertEqual(resp.status, 200)
                    datos = json.loads(resp.read().decode('utf-8'))
                    self.assertEqual(
                        datos,
                        {'id': 'jysusman', 'nombre': 'jysusman', 'rol': 'admin'},
                    )
            finally:
                httpd.shutdown()
                httpd.server_close()

    def test_iniciar_detecta_puerto_ocupado_sin_dejar_huerfanos(self):
        # Ocupamos temporalmente el puerto 8088 en 127.0.0.1 (si está libre)
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(('127.0.0.1', 8088))
                s.listen(1)
            except OSError:
                self.skipTest('El puerto 8088 ya está en uso en el entorno de pruebas.')

            proc = subprocess.run(
                [sys.executable, str(RAIZ_APPS / 'iniciar.py'), '--bind', '127.0.0.1'],
                cwd=str(RAIZ_APPS),
                capture_output=True,
                text=True,
                timeout=5,
            )
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn('8088', proc.stderr)
            self.assertIn('ocupado', proc.stderr.lower())

    def test_arrancar_cerrar_y_volver_a_arrancar_enseguida(self):
        # Verificar primero que 8080, 8088 y 8090 estén libres en el entorno
        for puerto in (8080, 8088, 8090):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.2)
                if s.connect_ex(('127.0.0.1', puerto)) == 0:
                    self.skipTest(f'El puerto {puerto} ya está en uso en el entorno de pruebas.')

        def esperar_portal_listo(proc, timeout=5.0):
            limite = time.monotonic() + timeout
            while time.monotonic() < limite:
                if proc.poll() is not None:
                    return None
                try:
                    with urllib.request.urlopen('http://127.0.0.1:8080/api/estado', timeout=0.5) as resp:
                        if resp.status == 200:
                            return json.loads(resp.read().decode('utf-8'))
                except Exception:
                    time.sleep(0.05)
            return None

        # 1. Primer arranque
        proc1 = subprocess.Popen(
            [sys.executable, str(RAIZ_APPS / 'iniciar.py'), '--bind', '127.0.0.1'],
            cwd=str(RAIZ_APPS),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        try:
            estado1 = esperar_portal_listo(proc1)
            self.assertIsNotNone(estado1, 'El primer arranque de iniciar.py no respondió en /api/estado')
            self.assertTrue(estado1['edt']['enLinea'])
            self.assertTrue(estado1['itinerario']['enLinea'])
        finally:
            if proc1.poll() is None:
                proc1.send_signal(signal.SIGINT)
                proc1.wait(timeout=5)
            if proc1.stdout:
                proc1.stdout.close()
            if proc1.stderr:
                proc1.stderr.close()

        # 2. Segundo arranque inmediato (con conexiones previas en TIME_WAIT)
        proc2 = subprocess.Popen(
            [sys.executable, str(RAIZ_APPS / 'iniciar.py'), '--bind', '127.0.0.1'],
            cwd=str(RAIZ_APPS),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        try:
            estado2 = esperar_portal_listo(proc2)
            err2 = ''
            if estado2 is None and proc2.stderr:
                err2 = proc2.stderr.read()
            self.assertIsNotNone(
                estado2,
                f'El segundo arranque inmediato falló (posible falso positivo por TIME_WAIT): {err2}',
            )
            self.assertTrue(estado2['edt']['enLinea'])
            self.assertTrue(estado2['itinerario']['enLinea'])
        finally:
            if proc2.poll() is None:
                proc2.send_signal(signal.SIGINT)
                proc2.wait(timeout=5)
            if proc2.stdout:
                proc2.stdout.close()
            if proc2.stderr:
                proc2.stderr.close()


if __name__ == '__main__':
    unittest.main()

