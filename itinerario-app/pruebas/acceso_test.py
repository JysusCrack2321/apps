#!/usr/bin/env python3
"""Alta automática de correos verificados por Cloudflare Access.

Comprueba que un correo autorizado por Access pero ausente de usuarios.json
se registra solo, con id derivado del correo, y que no se duplica.
"""

import http.client
import json
import shutil
import subprocess
import tempfile
import time
import unittest
from pathlib import Path

PUERTO = 8096
URL_BASE = f"127.0.0.1:{PUERTO}"
CORREO = "nueva.persona@unal.edu.co"
ORIGEN = Path(__file__).resolve().parent.parent


class TestAltaAutomatica(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporal = Path(tempfile.mkdtemp(prefix="itinerario-alta-"))
        copia = cls.temporal / "itinerario-app"
        copia.mkdir()
        shutil.copy2(ORIGEN / "servidor.py", copia / "servidor.py")
        (cls.temporal / "usuarios.json").write_text(
            json.dumps(
                [{"id": "existente", "nombre": "Ya Está", "correo": "existente@unal.edu.co", "rol": "admin"}],
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        cls.ruta_usuarios = cls.temporal / "usuarios.json"
        cls.proceso = subprocess.Popen(
            ["python3", "servidor.py", str(PUERTO), "--bind", "127.0.0.1"], cwd=str(copia)
        )
        time.sleep(0.6)

    @classmethod
    def tearDownClass(cls):
        cls.proceso.terminate()
        cls.proceso.wait()
        shutil.rmtree(cls.temporal, ignore_errors=True)

    def pedir_yo(self, cabeceras):
        conexion = http.client.HTTPConnection(URL_BASE, timeout=10)
        conexion.request("GET", "/api/yo", headers=cabeceras)
        respuesta = conexion.getresponse()
        cuerpo = respuesta.read()
        conexion.close()
        return respuesta.status, json.loads(cuerpo.decode("utf-8")) if cuerpo else None

    def test_01_correo_nuevo_se_registra(self):
        estado, identidad = self.pedir_yo({"Cf-Access-Authenticated-User-Email": CORREO})
        self.assertEqual(estado, 200)
        self.assertIsNotNone(identidad, "debería crear la ficha, no devolver null")
        self.assertEqual(identidad["id"], "nueva-persona")
        self.assertEqual(identidad["rol"], "miembro")

        registrados = json.loads(self.ruta_usuarios.read_text(encoding="utf-8"))
        correos = [u["correo"] for u in registrados]
        self.assertIn(CORREO, correos)

    def test_02_no_duplica_al_volver(self):
        self.pedir_yo({"Cf-Access-Authenticated-User-Email": CORREO})
        self.pedir_yo({"Cf-Access-Authenticated-User-Email": CORREO})
        registrados = json.loads(self.ruta_usuarios.read_text(encoding="utf-8"))
        self.assertEqual(sum(1 for u in registrados if u["correo"] == CORREO), 1)

    def test_03_correo_existente_respeta_su_ficha(self):
        _, identidad = self.pedir_yo(
            {"Cf-Access-Authenticated-User-Email": "existente@unal.edu.co"}
        )
        self.assertEqual(identidad["id"], "existente")
        self.assertEqual(identidad["rol"], "admin")

    def test_04_sin_access_no_crea_nada(self):
        antes = len(json.loads(self.ruta_usuarios.read_text(encoding="utf-8")))
        estado, identidad = self.pedir_yo({})
        self.assertEqual(estado, 200)
        self.assertIsNone(identidad)
        despues = len(json.loads(self.ruta_usuarios.read_text(encoding="utf-8")))
        self.assertEqual(antes, despues)


if __name__ == "__main__":
    unittest.main()
