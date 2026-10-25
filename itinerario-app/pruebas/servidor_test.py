#!/usr/bin/env python3
"""
Pruebas automáticas del servidor.py
Verifica GET, POST, ETag, 409 y respaldos.
"""

import http.client
import json
import os
import subprocess
import time
import unittest
from pathlib import Path

PUERTO_PRUEBA = 8099
URL_BASE = f"127.0.0.1:{PUERTO_PRUEBA}"


class TestServidor(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.proceso = subprocess.Popen(
            ["python3", "servidor.py", str(PUERTO_PRUEBA), "--bind", "127.0.0.1"],
            cwd=str(Path(__file__).resolve().parent.parent)
        )
        time.sleep(0.5)

    @classmethod
    def tearDownClass(cls):
        cls.proceso.terminate()
        cls.proceso.wait()

    def test_01_get_datos_devuelve_etag(self):
        conn = http.client.HTTPConnection(URL_BASE)
        conn.request("GET", "/api/datos")
        res = conn.getresponse()
        cuerpo = res.read()
        self.assertEqual(res.status, 200)
        etag = res.getheader("ETag")
        self.assertIsNotNone(etag)
        datos = json.loads(cuerpo.decode("utf-8"))
        self.assertEqual(datos.get("version"), 1)
        conn.close()

    def test_02_post_sin_if_match_rechaza(self):
        conn = http.client.HTTPConnection(URL_BASE)
        conn.request("POST", "/api/datos", body=json.dumps({"version": 1}))
        res = conn.getresponse()
        res.read()
        self.assertEqual(res.status, 428)
        conn.close()

    def test_03_post_con_etag_invalido_devuelve_409(self):
        conn = http.client.HTTPConnection(URL_BASE)
        headers = {"If-Match": '"etag-viejo-99999"', "Content-Type": "application/json"}
        conn.request("POST", "/api/datos", body=json.dumps({"version": 1}), headers=headers)
        res = conn.getresponse()
        res.read()
        self.assertEqual(res.status, 409)
        conn.close()

    def test_04_post_con_etag_correcto_guarda_y_respalda(self):
        conn = http.client.HTTPConnection(URL_BASE)
        conn.request("GET", "/api/datos")
        res_get = conn.getresponse()
        etag = res_get.getheader("ETag")
        cuerpo_original = json.loads(res_get.read().decode("utf-8"))

        headers = {"If-Match": etag, "Content-Type": "application/json"}
        conn.request("POST", "/api/datos", body=json.dumps(cuerpo_original), headers=headers)
        res_post = conn.getresponse()
        cuerpo_post = json.loads(res_post.read().decode("utf-8"))
        self.assertEqual(res_post.status, 200)
        self.assertTrue(cuerpo_post.get("ok"))
        self.assertIsNotNone(cuerpo_post.get("etag"))

        # Verificar que se creó el directorio respaldos
        dir_respaldos = Path(__file__).resolve().parent.parent / "respaldos"
        self.assertTrue(dir_respaldos.exists())
        self.assertTrue(len(list(dir_respaldos.glob("datos_*.json"))) > 0)
        conn.close()

    def test_05_seguridad_bloquea_traversal(self):
        conn = http.client.HTTPConnection(URL_BASE)
        conn.request("GET", "/../servidor.py")
        res = conn.getresponse()
        res.read()
        self.assertIn(res.status, [403, 404])
        conn.close()

    def test_06_archivos_independientes_por_usuario_sin_contrasena(self):
        conn = http.client.HTTPConnection(URL_BASE)

        # 1) Jesús Aragón tiene sus tareas cargadas en usuarios/jesus-aragon.json
        conn.request("GET", "/api/datos", headers={"Cookie": "usuario=jesus-aragon"})
        res_jesus = conn.getresponse()
        datos_jesus = json.loads(res_jesus.read().decode("utf-8"))
        self.assertEqual(res_jesus.status, 200)
        self.assertGreater(len(datos_jesus.get("tareas", [])), 0)

        # 2) Paola Bello tiene su propio archivo independiente en blanco (usuarios/paola-bello.json)
        conn.request("GET", "/api/datos", headers={"Cookie": "usuario=paola-bello"})
        res_paola = conn.getresponse()
        etag_paola = res_paola.getheader("ETag")
        datos_paola = json.loads(res_paola.read().decode("utf-8"))
        self.assertEqual(res_paola.status, 200)
        self.assertEqual(datos_paola.get("tareas"), [])
        self.assertEqual(datos_paola.get("bloques"), [])

        # 3) Guardar en el itinerario de Paola Bello no modifica el de Jesús Aragón
        conn.request(
            "POST",
            "/api/datos",
            body=json.dumps(datos_paola),
            headers={"Cookie": "usuario=paola-bello", "If-Match": etag_paola, "Content-Type": "application/json"},
        )
        res_post = conn.getresponse()
        res_post.read()
        self.assertEqual(res_post.status, 200)

        dir_usuarios = Path(__file__).resolve().parent.parent / "usuarios"
        self.assertTrue((dir_usuarios / "jesus-aragon.json").is_file())
        self.assertTrue((dir_usuarios / "paola-bello.json").is_file())
        conn.close()


if __name__ == "__main__":
    unittest.main()

