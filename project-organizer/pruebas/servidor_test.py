#!/usr/bin/env python3
"""Pruebas unitarias e integración para el servidor del EDT (Fase B1).

Ejecutar desde ~/apps:
  python3 -m unittest project-organizer/pruebas/servidor_test.py -v
"""
import hashlib
import http.client
import json
import os
import pathlib
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
import unittest

CARPETA_PROYECTO = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(CARPETA_PROYECTO))

import servidor  # noqa: E402


def sha256_archivo(ruta):
    """Calcula el hash SHA-256 de un archivo."""
    return hashlib.sha256(pathlib.Path(ruta).read_bytes()).hexdigest()


def crear_json_proyecto(nombre, extra_act=None):
    """Devuelve bytes UTF-8 de un proyecto válido para pruebas."""
    actividades = [
        {
            'id': 'a1',
            'codigo': '1',
            'nombre': f'Actividad de {nombre}',
            'inicio': '2026-03-02',
            'fin': '2026-03-06',
            'progreso': 50,
            'hijos': [],
        }
    ]
    if extra_act:
        actividades.extend(extra_act)
    obj = {
        'proyecto': {
            'nombre': nombre,
            'inicio': '2026-03-02',
            'fin': '2026-04-30',
        },
        'actividades': actividades,
    }
    return (json.dumps(obj, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


class PruebasServidorEDT(unittest.TestCase):
    """Suite de pruebas T1 a T10 en carpeta temporal sin tocar datos reales."""

    def setUp(self):
        self.raiz_original = servidor.RAIZ
        self.intervalo_original = servidor.INTERVALO_RESPALDO
        self.temp_dir = tempfile.TemporaryDirectory()
        self.ruta_temp = pathlib.Path(self.temp_dir.name)
        self.carpeta_guardados = self.ruta_temp / 'guardados'
        self.carpeta_guardados.mkdir(parents=True, exist_ok=True)

        # Sembrar datos.json, guardados/datos2.json y guardados/datos3.json
        (self.ruta_temp / 'datos.json').write_bytes(crear_json_proyecto('Base v1'))
        (self.carpeta_guardados / 'datos2.json').write_bytes(crear_json_proyecto('Guardado v2'))
        (self.carpeta_guardados / 'datos3.json').write_bytes(crear_json_proyecto('Guardado v3'))

        servidor.configurar_rutas(self.ruta_temp)
        self.httpd = None
        self.hilo_servidor = None

    def tearDown(self):
        if self.httpd is not None:
            self.httpd.shutdown()
            self.httpd.server_close()
        if self.hilo_servidor is not None:
            self.hilo_servidor.join(timeout=2)
        servidor.INTERVALO_RESPALDO = self.intervalo_original
        servidor.configurar_rutas(self.raiz_original)
        self.temp_dir.cleanup()

    def iniciar_servidor_hilo(self):
        """Arranca ServidorProjectOrganizer en un puerto libre de 127.0.0.1."""
        servidor.asegurar_archivo_actual()
        self.httpd = servidor.ServidorProjectOrganizer(
            ('127.0.0.1', 0),
            servidor.ManejadorProjectOrganizer,
        )
        self.puerto = self.httpd.server_address[1]
        self.url_base = f'http://127.0.0.1:{self.puerto}'
        self.hilo_servidor = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.hilo_servidor.start()

    def hacer_get(self, ruta):
        req = urllib.request.Request(f'{self.url_base}{ruta}', method='GET')
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status, dict(resp.headers), resp.read()

    def hacer_post_guardar(self, cuerpo_bytes, headers=None):
        cabeceras = {'Content-Type': 'application/json'}
        if headers:
            cabeceras.update(headers)
        req = urllib.request.Request(
            f'{self.url_base}/api/guardar',
            data=cuerpo_bytes,
            headers=cabeceras,
            method='POST',
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status, dict(resp.headers), json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as err:
            with err:
                cuerpo_err = err.read().decode('utf-8')
                datos_err = json.loads(cuerpo_err) if cuerpo_err else {}
                return err.code, dict(err.headers), datos_err

    def test_t1_migracion_crea_actual_sin_alterar_originales(self):
        """T1: Con datos.json + datos2.json y datos3.json se crea actual.json == datos3.json sin alterar hashes."""
        arch_base = self.ruta_temp / 'datos.json'
        arch_d2 = self.carpeta_guardados / 'datos2.json'
        arch_d3 = self.carpeta_guardados / 'datos3.json'
        arch_actual = self.carpeta_guardados / 'actual.json'

        hash_base_antes = sha256_archivo(arch_base)
        hash_d2_antes = sha256_archivo(arch_d2)
        hash_d3_antes = sha256_archivo(arch_d3)

        self.assertFalse(arch_actual.exists())
        creado = servidor.asegurar_archivo_actual()
        self.assertEqual(creado, arch_actual)
        self.assertTrue(arch_actual.is_file())

        # actual.json debe ser idéntico a datos3.json
        self.assertEqual(sha256_archivo(arch_actual), hash_d3_antes)
        self.assertEqual(arch_actual.read_bytes(), arch_d3.read_bytes())

        # Los 3 archivos originales mantienen exactamente su mismo hash
        self.assertEqual(sha256_archivo(arch_base), hash_base_antes)
        self.assertEqual(sha256_archivo(arch_d2), hash_d2_antes)
        self.assertEqual(sha256_archivo(arch_d3), hash_d3_antes)

    def test_t2_get_datos_devuelve_200_y_etag(self):
        """T2: GET /datos.json -> 200 + ETag."""
        self.iniciar_servidor_hilo()
        status, headers, cuerpo = self.hacer_get('/datos.json')
        self.assertEqual(status, 200)
        etag = headers.get('ETag') or headers.get('Etag')
        self.assertIsNotNone(etag)
        self.assertTrue(etag.startswith('"') and etag.endswith('"'))
        datos = json.loads(cuerpo.decode('utf-8'))
        self.assertEqual(datos['proyecto']['nombre'], 'Guardado v3')

    def test_t3_post_sin_if_match_devuelve_428(self):
        """T3: POST sin If-Match -> 428, archivo intacto."""
        self.iniciar_servidor_hilo()
        arch_actual = self.carpeta_guardados / 'actual.json'
        hash_antes = sha256_archivo(arch_actual)

        nuevo = crear_json_proyecto('Intento sin If-Match')
        status, _, resp = self.hacer_post_guardar(nuevo, headers={})
        self.assertEqual(status, 428)
        self.assertIn('error', resp)
        self.assertEqual(sha256_archivo(arch_actual), hash_antes)

    def test_t4_post_con_etag_viejo_devuelve_409(self):
        """T4: POST con ETag viejo -> 409 con etagActual, archivo intacto."""
        self.iniciar_servidor_hilo()
        arch_actual = self.carpeta_guardados / 'actual.json'
        hash_antes = sha256_archivo(arch_actual)
        _, headers_get, _ = self.hacer_get('/datos.json')
        etag_real = headers_get.get('ETag') or headers_get.get('Etag')

        nuevo = crear_json_proyecto('Intento con ETag viejo')
        status, _, resp = self.hacer_post_guardar(nuevo, headers={'If-Match': '"etag-obsoleto-000"'})
        self.assertEqual(status, 409)
        self.assertEqual(resp.get('etagActual'), etag_real)
        self.assertEqual(sha256_archivo(arch_actual), hash_antes)

    def test_t5_post_valido_actualiza_actual_y_no_crea_datos_n(self):
        """T5: POST válido -> 200, ETag cambia, guardado en actual.json, sin crear datos<N>.json."""
        self.iniciar_servidor_hilo()
        _, headers_get, _ = self.hacer_get('/datos.json')
        etag_inicial = headers_get.get('ETag') or headers_get.get('Etag')

        nuevo = crear_json_proyecto('Guardado nuevo T5')
        status, headers_post, resp = self.hacer_post_guardar(nuevo, headers={'If-Match': etag_inicial})
        self.assertEqual(status, 200)
        self.assertTrue(resp.get('ok'))
        etag_nuevo = resp.get('etag')
        self.assertIsNotNone(etag_nuevo)
        self.assertNotEqual(etag_nuevo, etag_inicial)
        self.assertEqual(headers_post.get('ETag') or headers_post.get('Etag'), etag_nuevo)

        # Contenido guardado en actual.json
        arch_actual = self.carpeta_guardados / 'actual.json'
        guardado = json.loads(arch_actual.read_text(encoding='utf-8'))
        self.assertEqual(guardado['proyecto']['nombre'], 'Guardado nuevo T5')

        # No se creó datos4.json ni ningún otro datos<N>.json nuevo
        archivos_datos_n = sorted(
            p.name for p in self.carpeta_guardados.iterdir()
            if servidor.PATRON_GUARDADO.match(p.name)
        )
        self.assertEqual(archivos_datos_n, ['datos2.json', 'datos3.json'])

    def test_t6_respaldo_unico_intervalo_y_actualizacion(self):
        """T6: 20 POST seguidos dentro del intervalo mantienen respaldo.json; al vencer el intervalo se actualiza."""
        servidor.INTERVALO_RESPALDO = 300
        self.iniciar_servidor_hilo()
        arch_actual = self.carpeta_guardados / 'actual.json'
        arch_respaldo = self.carpeta_guardados / 'respaldo.json'

        contenido_v0 = arch_actual.read_bytes()
        _, headers_get, _ = self.hacer_get('/datos.json')
        etag = headers_get.get('ETag') or headers_get.get('Etag')

        hash_respaldo_tras_primero = None
        for i in range(1, 21):
            cuerpo = crear_json_proyecto(f'Iteracion {i}')
            status, _, resp = self.hacer_post_guardar(cuerpo, headers={'If-Match': etag})
            self.assertEqual(status, 200)
            etag = resp['etag']
            if i == 1:
                self.assertTrue(arch_respaldo.is_file())
                # El primer POST copió el actual.json original (v0) a respaldo.json
                self.assertEqual(arch_respaldo.read_bytes(), contenido_v0)
                hash_respaldo_tras_primero = sha256_archivo(arch_respaldo)
            else:
                # Durante las siguientes 19 iteraciones dentro del intervalo, respaldo.json no cambia
                self.assertEqual(sha256_archivo(arch_respaldo), hash_respaldo_tras_primero)

        # Solo existen actual.json, respaldo.json y los viejos datos2.json, datos3.json
        nombres_en_guardados = sorted(p.name for p in self.carpeta_guardados.iterdir())
        self.assertEqual(
            nombres_en_guardados,
            ['actual.json', 'datos2.json', 'datos3.json', 'respaldo.json'],
        )

        # Verificar que GET /api/guardados incluye actual.json, respaldo.json y los datos<N>.json viejos
        status_lista, _, cuerpo_lista = self.hacer_get('/api/guardados')
        self.assertEqual(status_lista, 200)
        versiones = json.loads(cuerpo_lista.decode('utf-8'))['archivos']
        nombres_versiones = [v['nombre'] for v in versiones]
        self.assertIn('actual.json', nombres_versiones)
        self.assertIn('respaldo.json', nombres_versiones)
        self.assertIn('datos3.json', nombres_versiones)
        self.assertIn('datos2.json', nombres_versiones)

        # Simular que venció el intervalo envejeciendo el mtime de respaldo.json por 305 segundos
        contenido_iter_20 = arch_actual.read_bytes()
        tiempo_viejo = time.time() - 305
        os.utime(arch_respaldo, (tiempo_viejo, tiempo_viejo))

        # Siguiente POST tras vencer el intervalo actualiza respaldo.json con la versión anterior (Iteracion 20)
        cuerpo_21 = crear_json_proyecto('Iteracion 21')
        status_21, _, _ = self.hacer_post_guardar(cuerpo_21, headers={'If-Match': etag})
        self.assertEqual(status_21, 200)
        self.assertEqual(arch_respaldo.read_bytes(), contenido_iter_20)
        respaldo_json = json.loads(arch_respaldo.read_text(encoding='utf-8'))
        self.assertEqual(respaldo_json['proyecto']['nombre'], 'Iteracion 20')

    def test_t7_json_invalido_devuelve_400_y_no_toca_archivo(self):
        """T7: JSON inválido -> 400, archivo intacto."""
        self.iniciar_servidor_hilo()
        arch_actual = self.carpeta_guardados / 'actual.json'
        hash_antes = sha256_archivo(arch_actual)
        _, headers_get, _ = self.hacer_get('/datos.json')
        etag = headers_get.get('ETag') or headers_get.get('Etag')

        # 1) Sintaxis JSON corrupta
        status1, _, _ = self.hacer_post_guardar(b'{json_roto: [1, 2', headers={'If-Match': etag})
        self.assertEqual(status1, 400)
        self.assertEqual(sha256_archivo(arch_actual), hash_antes)

        # 2) JSON válido pero sin las claves obligatorias proyecto y actividades
        status2, _, _ = self.hacer_post_guardar(b'{"foo": "bar"}', headers={'If-Match': etag})
        self.assertEqual(status2, 400)
        self.assertEqual(sha256_archivo(arch_actual), hash_antes)

    def test_t8_sse_encabezados_y_evento_cambio(self):
        """T8: Abrir /api/eventos, verificar 3 encabezados, hacer POST -> llega event: cambio con nuevo ETag en < 3 s."""
        self.iniciar_servidor_hilo()
        _, headers_get, _ = self.hacer_get('/datos.json')
        etag_inicial = headers_get.get('ETag') or headers_get.get('Etag')

        conn = http.client.HTTPConnection('127.0.0.1', self.puerto, timeout=4)
        try:
            conn.request('GET', '/api/eventos')
            resp_sse = conn.getresponse()
            self.assertEqual(resp_sse.status, 200)

            headers_sse = {k.lower(): v for k, v in resp_sse.getheaders()}
            self.assertIn('text/event-stream', headers_sse.get('content-type', ''))
            self.assertEqual(headers_sse.get('cache-control'), 'no-cache, no-transform')
            self.assertEqual(headers_sse.get('x-accel-buffering'), 'no')

            # Leer comentario inicial ": conectado\n\n"
            linea_inicial = resp_sse.fp.readline().decode('utf-8')
            self.assertTrue(linea_inicial.startswith(':'))
            resp_sse.fp.readline()

            # Ejecutar POST en paralelo tras 150 ms
            resultado_post = {}

            def enviar_post():
                time.sleep(0.15)
                cuerpo = crear_json_proyecto('Disparo SSE')
                st, _, datos_r = self.hacer_post_guardar(cuerpo, headers={'If-Match': etag_inicial})
                resultado_post['status'] = st
                resultado_post['etag'] = datos_r.get('etag')

            hilo_post = threading.Thread(target=enviar_post, daemon=True)
            inicio = time.monotonic()
            hilo_post.start()

            evento_linea = None
            datos_linea = None
            while time.monotonic() - inicio < 3.0:
                linea = resp_sse.fp.readline().decode('utf-8').strip()
                if linea.startswith('event:'):
                    evento_linea = linea
                elif linea.startswith('data:'):
                    datos_linea = linea
                    break

            duracion = time.monotonic() - inicio
            hilo_post.join(timeout=1)

            self.assertLess(duracion, 3.0)
            self.assertEqual(resultado_post.get('status'), 200)
            self.assertEqual(evento_linea, 'event: cambio')
            self.assertIsNotNone(datos_linea)
            payload = json.loads(datos_linea[len('data:'):].strip())
            self.assertEqual(payload.get('etag'), resultado_post.get('etag'))
        finally:
            conn.close()

    def test_t9_cierre_con_cliente_sse_conectado(self):
        """T9: Con un cliente SSE conectado, enviar SIGINT al servidor -> termina en < 3 s sin procesos huérfanos."""
        # Buscar un puerto libre
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('127.0.0.1', 0))
            puerto_sub = s.getsockname()[1]

        cmd = [
            sys.executable,
            str(CARPETA_PROYECTO / 'servidor.py'),
            str(puerto_sub),
            '--bind',
            '127.0.0.1',
            '--raiz',
            str(self.ruta_temp),
        ]
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        conn = None
        try:
            # Esperar a que el subproceso acepte conexiones
            listo = False
            for _ in range(30):
                if proc.poll() is not None:
                    break
                try:
                    with socket.create_connection(('127.0.0.1', puerto_sub), timeout=0.2):
                        listo = True
                        break
                except OSError:
                    time.sleep(0.1)
            self.assertTrue(listo, 'El subproceso servidor.py no arrancó a tiempo')

            # Abrir conexión SSE persistente
            conn = http.client.HTTPConnection('127.0.0.1', puerto_sub, timeout=4)
            conn.request('GET', '/api/eventos')
            resp_sse = conn.getresponse()
            self.assertEqual(resp_sse.status, 200)
            linea = resp_sse.fp.readline().decode('utf-8')
            self.assertTrue(linea.startswith(':'))

            # Enviar SIGINT y medir tiempo de salida
            t0 = time.monotonic()
            proc.send_signal(signal.SIGINT)
            codigo_salida = proc.wait(timeout=3.0)
            transcurrido = time.monotonic() - t0

            self.assertLess(transcurrido, 3.0)
            self.assertEqual(codigo_salida, 0)
            self.assertIsNotNone(proc.poll())
        finally:
            if conn is not None:
                conn.close()
            if proc.poll() is None:
                proc.kill()
                proc.wait()
            if proc.stdout:
                proc.stdout.close()
            if proc.stderr:
                proc.stderr.close()

    def test_t10_formato_ida_y_vuelta_con_datos_reales(self):
        """T10: GET /datos.json, POST /api/guardar ese mismo contenido, GET de nuevo -> objetos idénticos."""
        # Copiar el datos.json real del proyecto a una subcarpeta temporal limpia
        temp_real = pathlib.Path(tempfile.mkdtemp(dir=self.ruta_temp))
        shutil.copy2(CARPETA_PROYECTO / 'datos.json', temp_real / 'datos.json')
        servidor.configurar_rutas(temp_real)
        self.iniciar_servidor_hilo()

        status_get1, headers_get1, cuerpo_get1 = self.hacer_get('/datos.json')
        self.assertEqual(status_get1, 200)
        etag1 = headers_get1.get('ETag') or headers_get1.get('Etag')
        obj_inicial = json.loads(cuerpo_get1.decode('utf-8'))

        status_post, _, resp_post = self.hacer_post_guardar(
            cuerpo_get1,
            headers={'If-Match': etag1},
        )
        self.assertEqual(status_post, 200)
        self.assertTrue(resp_post.get('ok'))

        status_get2, _, cuerpo_get2 = self.hacer_get('/datos.json')
        self.assertEqual(status_get2, 200)
        obj_final = json.loads(cuerpo_get2.decode('utf-8'))

        self.assertEqual(obj_inicial, obj_final)


if __name__ == '__main__':
    unittest.main()
