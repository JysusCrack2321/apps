#!/usr/bin/env python3
"""Pruebas de los endpoints por tarea (GET/POST/DELETE /api/tareas).

Trabajan sobre una copia de la app en un directorio temporal, para no tocar
los datos reales del Itinerario.
"""

import http.client
import json
import shutil
import subprocess
import tempfile
import time
import unittest
from pathlib import Path

PUERTO = 8098
URL_BASE = f"127.0.0.1:{PUERTO}"
CABECERAS = {"Cookie": "usuario=prueba", "Content-Type": "application/json"}
ORIGEN = Path(__file__).resolve().parent.parent


class TestTareas(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporal = Path(tempfile.mkdtemp(prefix="itinerario-prueba-"))
        copia = cls.temporal / "itinerario-app"
        copia.mkdir()
        for nombre in ("servidor.py",):
            shutil.copy2(ORIGEN / nombre, copia / nombre)
        (cls.temporal / "usuarios.json").write_text(
            json.dumps([{"id": "prueba", "nombre": "Prueba", "correo": "prueba@ejemplo.com", "rol": "miembro"}]),
            encoding="utf-8",
        )
        cls.proceso = subprocess.Popen(
            ["python3", "servidor.py", str(PUERTO), "--bind", "127.0.0.1"],
            cwd=str(copia),
        )
        time.sleep(0.6)

    @classmethod
    def tearDownClass(cls):
        cls.proceso.terminate()
        cls.proceso.wait()
        shutil.rmtree(cls.temporal, ignore_errors=True)

    def pedir(self, metodo, ruta, cuerpo=None):
        conexion = http.client.HTTPConnection(URL_BASE, timeout=10)
        datos = json.dumps(cuerpo).encode("utf-8") if cuerpo is not None else None
        conexion.request(metodo, ruta, body=datos, headers=CABECERAS)
        respuesta = conexion.getresponse()
        contenido = respuesta.read()
        conexion.close()
        return respuesta.status, (json.loads(contenido.decode("utf-8")) if contenido else {})

    def test_01_lista_vacia(self):
        estado, cuerpo = self.pedir("GET", "/api/tareas")
        self.assertEqual(estado, 200)
        self.assertEqual(cuerpo["tareas"], [])

    def test_02_crear_tarea(self):
        estado, cuerpo = self.pedir("POST", "/api/tareas", {"titulo": "Informe", "duracionMin": 90})
        self.assertEqual(estado, 201)
        self.assertTrue(cuerpo["tarea"]["id"].startswith("t-"))
        self.assertEqual(cuerpo["tarea"]["estado"], "pendiente")
        self.assertEqual(cuerpo["tarea"]["duracionMin"], 90)

    def test_03_crear_sin_titulo_falla(self):
        estado, _ = self.pedir("POST", "/api/tareas", {"duracionMin": 30})
        self.assertEqual(estado, 400)

    def test_04_crear_con_padre_inexistente_falla(self):
        estado, _ = self.pedir("POST", "/api/tareas", {"titulo": "Hija", "padre": "t-noexiste"})
        self.assertEqual(estado, 400)

    def test_05_lista_contiene_la_creada(self):
        estado, cuerpo = self.pedir("GET", "/api/tareas")
        self.assertEqual(estado, 200)
        titulos = [t["titulo"] for t in cuerpo["tareas"]]
        self.assertIn("Informe", titulos)

    def test_06_borrar_en_cascada(self):
        _, creada = self.pedir("POST", "/api/tareas", {"titulo": "Madre"})
        id_madre = creada["tarea"]["id"]
        _, hija = self.pedir("POST", "/api/tareas", {"titulo": "Hija", "padre": id_madre})
        estado, cuerpo = self.pedir("DELETE", f"/api/tareas/{id_madre}")
        self.assertEqual(estado, 200)
        self.assertEqual(cuerpo["borradas"], 2)
        _, lista = self.pedir("GET", "/api/tareas")
        ids = [t["id"] for t in lista["tareas"]]
        self.assertNotIn(id_madre, ids)
        self.assertNotIn(hija["tarea"]["id"], ids)

    def test_07_borrar_inexistente_404(self):
        estado, _ = self.pedir("DELETE", "/api/tareas/t-zzzzzz")
        self.assertEqual(estado, 404)


if __name__ == "__main__":
    unittest.main()
