#!/usr/bin/env python3
"""
servidor.py - Servidor HTTP para Itinerario
Usa únicamente la biblioteca estándar de Python 3.
Soporta archivos estáticos locales, GET/POST con ETag y respaldo automático en respaldos/.
"""

import argparse
import datetime
import http.cookies
import http.server
import json
import os
from pathlib import Path
import random
import re
import shutil
import string
import sys
import tempfile
import threading
import urllib.parse

DIRECTORIO_RAIZ = Path(__file__).resolve().parent
ARCHIVO_DATOS = DIRECTORIO_RAIZ / "datos.json"
DIRECTORIO_USUARIOS = DIRECTORIO_RAIZ / "usuarios"
DIRECTORIO_RESPALDOS = DIRECTORIO_RAIZ / "respaldos"
ARCHIVO_USUARIOS = DIRECTORIO_RAIZ.parent / "usuarios.json"
MAX_RESPALDOS = 30

DATOS_EN_BLANCO = {
    "version": 1,
    "config": {
        "inicioDia": "06:00",
        "finDia": "23:00",
        "bloqueMaxMin": 120,
        "pausaMin": 5,
    },
    "materias": [],
    "tareas": [],
    "bloques": [],
    "fijos": [],
}

MIME_TIPOS = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
}


def cargar_usuarios_compartidos(ruta_usuarios: Path = None) -> list:
    """Lee usuarios.json si existe; devuelve [] en modo autónomo si falta."""
    ruta = ruta_usuarios if ruta_usuarios is not None else ARCHIVO_USUARIOS
    if not ruta.is_file():
        return []
    try:
        datos = json.loads(ruta.read_text(encoding="utf-8"))
        return datos if isinstance(datos, list) else []
    except Exception:
        return []


def detras_de_access(peticion) -> bool:
    """True si la petición llegó por Cloudflare Access (identidad ya verificada)."""
    headers = getattr(peticion, "headers", None) or {}
    return bool((headers.get("Cf-Access-Authenticated-User-Email") or "").strip())


CANDADO_USUARIOS = threading.Lock()


def id_desde_correo(correo: str) -> str:
    """Id provisional a partir de la parte local del correo (a-z0-9-)."""
    base = correo.split("@")[0].strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", base).strip("-") or "usuario"


def registrar_usuario_automatico(correo: str):
    """Da de alta un correo ya verificado por Access que no esté en usuarios.json.

    El nombre queda como la parte local del correo y el rol como miembro; luego
    un admin lo renombra. Devuelve {id, nombre, rol} o None si no se pudo.
    """
    correo = (correo or "").strip().lower()
    if not correo:
        return None
    with CANDADO_USUARIOS:
        usuarios = cargar_usuarios_compartidos()
        for u in usuarios:
            if isinstance(u, dict) and (u.get("correo") or "").strip().lower() == correo:
                return {"id": u["id"], "nombre": u["nombre"], "rol": u["rol"]}

        base = id_desde_correo(correo)
        existentes = {u.get("id") for u in usuarios if isinstance(u, dict)}
        nuevo_id, sufijo = base, 2
        while nuevo_id in existentes:
            nuevo_id = f"{base}-{sufijo}"
            sufijo += 1

        usuarios.append(
            {"id": nuevo_id, "nombre": base, "correo": correo, "rol": "miembro"}
        )
        try:
            ARCHIVO_USUARIOS.parent.mkdir(parents=True, exist_ok=True)
            temporal = ARCHIVO_USUARIOS.with_suffix(".tmp")
            temporal.write_text(
                json.dumps(usuarios, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            os.replace(temporal, ARCHIVO_USUARIOS)
        except OSError as exc:
            sys.stderr.write(f"No se pudo registrar {correo}: {exc}\n")
            return None
        sys.stderr.write(f"Alta automática: {nuevo_id} <{correo}>\n")
        return {"id": nuevo_id, "nombre": base, "rol": "miembro"}


def quien_es(peticion, ruta_usuarios: Path = None):
    """Identifica al usuario activo de forma aislada.

    Prioridad:
    1. Encabezado Cf-Access-Authenticated-User-Email (Fase D). Si viene, es la
       única fuente válida: la cookie se ignora para que nadie suplante a otro.
    2. Cookie 'usuario=<id>' (solo en local, sin Access).
    Devuelve { id, nombre, rol } o None si no hay identidad válida.
    """
    usuarios = cargar_usuarios_compartidos(ruta_usuarios)
    if not usuarios:
        return None

    headers = getattr(peticion, "headers", None) or {}

    # 1. Primero leer encabezado de Cloudflare Access
    correo_cf = (headers.get("Cf-Access-Authenticated-User-Email") or "").strip().lower()
    if correo_cf:
        for u in usuarios:
            if isinstance(u, dict) and (u.get("correo") or "").strip().lower() == correo_cf:
                return {"id": u["id"], "nombre": u["nombre"], "rol": u["rol"]}
        return registrar_usuario_automatico(correo_cf)  # alta automática del correo verificado

    # 2. Después leer la cookie usuario=<id>
    raw_cookie = headers.get("Cookie") or ""
    if raw_cookie:
        galleta = http.cookies.SimpleCookie()
        try:
            galleta.load(raw_cookie)
        except http.cookies.CookieError:
            return None
        morsel = galleta.get("usuario")
        if morsel and morsel.value:
            id_buscado = morsel.value.strip()
            for u in usuarios:
                if isinstance(u, dict):
                    if u.get("id") == id_buscado:
                        return {"id": u["id"], "nombre": u["nombre"], "rol": u["rol"]}
                    if id_buscado == "jesus-aragon" and u.get("id") == "jysusman":
                        return {"id": "jesus-aragon", "nombre": u["nombre"], "rol": u["rol"]}

    return None


def asegurar_archivo_usuario(id_usuario: str, dir_usuarios: Path = None) -> Path:
    """Garantiza que exista el archivo individual usuarios/<id>.json para el usuario dado.

    - Para 'jesus-aragon' y 'jysusman', si no existe aún, copia datos.json como base.
    - Para cualquier otro usuario (ej. 'paola-bello', 'maria-jose', 'santiago-benavides'),
      crea un itinerario en blanco (DATOS_EN_BLANCO).
    """
    carpeta = dir_usuarios if dir_usuarios is not None else DIRECTORIO_USUARIOS
    carpeta.mkdir(parents=True, exist_ok=True)
    ruta_usuario = carpeta / f"{id_usuario}.json"
    if not ruta_usuario.exists():
        if id_usuario in ("jesus-aragon", "jysusman") and ARCHIVO_DATOS.exists():
            shutil.copy2(ARCHIVO_DATOS, ruta_usuario)
        else:
            ruta_usuario.write_text(
                json.dumps(DATOS_EN_BLANCO, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
    return ruta_usuario


def resolver_archivo_datos(peticion, ruta_usuarios: Path = None, dir_usuarios: Path = None):
    """Devuelve la ruta del archivo JSON del usuario activo.

    - Con identidad válida: su archivo en usuarios/<id>.json.
    - Sin Access y sin cookie (modo autónomo): datos.json.
    - Detrás de Access pero sin correo registrado: None (no se comparte nada).
    """
    usuario = quien_es(peticion, ruta_usuarios)
    if usuario and usuario.get("id"):
        return asegurar_archivo_usuario(usuario["id"], dir_usuarios)
    if detras_de_access(peticion):
        return None
    return ARCHIVO_DATOS


def obtener_etag(archivo_path: Path) -> str:
    """Calcula un ETag basado en el mtime_ns del archivo."""
    if not archivo_path.exists():
        return '"0"'
    mtime_ns = archivo_path.stat().st_mtime_ns
    return f'"{mtime_ns}"'


def respaldar_datos(archivo_origen: Path = None):
    """Crea una copia de respaldo del archivo de datos y conserva las últimas 30 copias."""
    objetivo = archivo_origen if archivo_origen is not None else ARCHIVO_DATOS
    if not objetivo.exists():
        return
    DIRECTORIO_RESPALDOS.mkdir(parents=True, exist_ok=True)
    ahora_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    es_de_usuario = objetivo.parent == DIRECTORIO_USUARIOS
    prefijo = f"datos_{objetivo.stem}_" if es_de_usuario else "datos_"
    nombre_respaldo = f"{prefijo}{ahora_str}.json"
    ruta_respaldo = DIRECTORIO_RESPALDOS / nombre_respaldo
    shutil.copy2(objetivo, ruta_respaldo)

    # Mantener solo los últimos MAX_RESPALDOS de ese prefijo
    respaldos_existentes = sorted(DIRECTORIO_RESPALDOS.glob(f"{prefijo}*.json"))
    if len(respaldos_existentes) > MAX_RESPALDOS:
        sobrantes = respaldos_existentes[:-MAX_RESPALDOS]
        for antiguo in sobrantes:
            try:
                antiguo.unlink()
            except OSError:
                pass


# Serializa las escrituras: dos agentes a la vez no pueden pisarse el archivo.
CANDADO_ESCRITURA = threading.Lock()

ALFABETO_ID = string.ascii_lowercase + string.digits


def nuevo_id_tarea() -> str:
    """Identificador corto y único para una tarea (t-xxxxxx)."""
    return "t-" + "".join(random.choice(ALFABETO_ID) for _ in range(6))


def guardar_datos_atomico(archivo: Path, datos: dict):
    """Respalda y escribe el JSON de forma atómica (temp + os.replace)."""
    respaldar_datos(archivo)
    archivo.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", dir=archivo.parent, delete=False, encoding="utf-8", suffix=".tmp"
    ) as f_tmp:
        json.dump(datos, f_tmp, ensure_ascii=False, indent=2)
        nombre_temporal = f_tmp.name
    try:
        os.replace(nombre_temporal, archivo)
    except Exception:
        if os.path.exists(nombre_temporal):
            os.unlink(nombre_temporal)
        raise


def ids_descendientes(tareas: list, id_raiz: str) -> set:
    """Ids de la tarea y de todas sus descendientes."""
    objetivos = {id_raiz}
    cambio = True
    while cambio:
        cambio = False
        for t in tareas:
            if t.get("padre") in objetivos and t.get("id") not in objetivos:
                objetivos.add(t.get("id"))
                cambio = True
    return objetivos


class ManejadorItinerario(http.server.BaseHTTPRequestHandler):
    server_version = "ServidorItinerario/1.0"

    def responder_json(self, codigo: int, datos, headers_extra: dict = None):
        cuerpo = json.dumps(datos, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        if headers_extra:
            for clave, valor in headers_extra.items():
                self.send_header(clave, valor)
        self.end_headers()
        self.wfile.write(cuerpo)

    def responder_error(self, codigo: int, mensaje: str):
        self.responder_json(codigo, {"error": mensaje})

    def do_GET(self):
        url_parseada = urllib.parse.urlparse(self.path)
        ruta = url_parseada.path

        if ruta == "/api/yo":
            self.manejar_get_yo()
            return

        if ruta == "/api/usuarios":
            self.manejar_get_usuarios()
            return

        if ruta == "/api/datos":
            self.manejar_get_datos()
            return

        if ruta == "/api/eventos":
            self.manejar_eventos_sse()
            return

        if ruta == "/api/tareas":
            self.manejar_get_tareas()
            return

        # Servir archivos estáticos
        self.manejar_estatico(ruta)

    def archivo_activo(self):
        """Archivo del usuario activo, o None si Access no lo tiene registrado."""
        archivo = resolver_archivo_datos(self)
        if archivo is None:
            self.responder_error(403, "Tu correo no está registrado en usuarios.json")
        return archivo

    def do_HEAD(self):
        """HEAD para revalidar el ETag; el cliente lo usa al reconectar."""
        ruta = urllib.parse.urlparse(self.path).path
        if ruta != "/api/datos":
            self.send_response(405)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        archivo_objetivo = self.archivo_activo()
        if archivo_objetivo is None:
            return

        if not archivo_objetivo.exists():
            self.send_response(404)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(archivo_objetivo.stat().st_size))
        self.send_header("ETag", obtener_etag(archivo_objetivo))
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()

    def manejar_get_yo(self):
        usuario = quien_es(self)
        self.responder_json(200, usuario)

    def manejar_get_usuarios(self):
        # Detrás de Access cada quien ve solo su propia ficha: sin lista completa.
        if detras_de_access(self):
            activo = quien_es(self)
            self.responder_json(200, [activo] if activo else [])
            return

        usuarios = cargar_usuarios_compartidos()
        publicos = [
            {"id": u["id"], "nombre": u["nombre"], "rol": u["rol"]}
            for u in usuarios
            if isinstance(u, dict) and "id" in u and "nombre" in u and "rol" in u
        ]
        self.responder_json(200, publicos)

    def manejar_get_datos(self):
        archivo_objetivo = self.archivo_activo()
        if archivo_objetivo is None:
            return
        if not archivo_objetivo.exists():
            self.responder_error(404, "El archivo de datos no existe")
            return

        try:
            with open(archivo_objetivo, "rb") as f:
                contenido = f.read()
            etag = obtener_etag(archivo_objetivo)
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(contenido)))
            self.send_header("ETag", etag)
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.end_headers()
            self.wfile.write(contenido)
        except Exception as e:
            self.responder_error(500, f"Error al leer datos: {str(e)}")

    def do_POST(self):
        url_parseada = urllib.parse.urlparse(self.path)
        ruta = url_parseada.path

        if ruta == "/api/datos":
            self.manejar_post_datos()
            return

        if ruta == "/api/tareas":
            self.manejar_post_tarea()
            return

        self.responder_error(404, "Ruta no encontrada")

    def do_DELETE(self):
        ruta = urllib.parse.urlparse(self.path).path
        if ruta.startswith("/api/tareas/"):
            id_tarea = urllib.parse.unquote(ruta[len("/api/tareas/"):])
            self.manejar_delete_tarea(id_tarea)
            return
        self.responder_error(404, "Ruta no encontrada")

    def manejar_get_tareas(self):
        """Lista de tareas del usuario activo, con su ETag."""
        archivo = self.archivo_activo()
        if archivo is None:
            return
        datos = json.loads(archivo.read_text(encoding="utf-8")) if archivo.exists() else {}
        self.responder_json(
            200,
            {"tareas": datos.get("tareas", []), "etag": obtener_etag(archivo)},
            {"ETag": obtener_etag(archivo)},
        )

    def manejar_post_tarea(self):
        """Crea una tarea suelta sin reescribir el documento completo.

        Pensado para agentes: no exige If-Match porque la lectura y la escritura
        ocurren bajo el mismo candado, así no pisa cambios de otros.
        """
        archivo = self.archivo_activo()
        if archivo is None:
            return
        try:
            largo = int(self.headers.get("Content-Length", 0))
            cuerpo = json.loads(self.rfile.read(largo).decode("utf-8") or "{}")
        except Exception as e:
            self.responder_error(400, f"JSON inválido en el cuerpo: {e}")
            return

        titulo = (cuerpo.get("titulo") or "").strip()
        if not titulo:
            self.responder_error(400, "Falta el campo 'titulo'.")
            return
        try:
            duracion = int(cuerpo.get("duracionMin") or 60)
        except (TypeError, ValueError):
            self.responder_error(400, "'duracionMin' debe ser un número.")
            return

        with CANDADO_ESCRITURA:
            datos = (
                json.loads(archivo.read_text(encoding="utf-8"))
                if archivo.exists()
                else {"version": 1, "tareas": [], "bloques": [], "fijos": []}
            )
            tareas = datos.setdefault("tareas", [])
            padre = cuerpo.get("padre") or None
            if padre and not any(t.get("id") == padre for t in tareas):
                self.responder_error(400, f"El padre '{padre}' no existe.")
                return
            tarea = {
                "id": nuevo_id_tarea(),
                "titulo": titulo,
                "materia": cuerpo.get("materia") or None,
                "padre": padre,
                "entrega": cuerpo.get("entrega") or None,
                "duracionMin": duracion,
                "avance": 0,
                "estado": "pendiente",
                "notas": cuerpo.get("notas") or "",
            }
            tareas.append(tarea)
            try:
                guardar_datos_atomico(archivo, datos)
            except Exception as e:
                self.responder_error(500, f"Error al guardar: {e}")
                return

        etag = obtener_etag(archivo)
        self.responder_json(201, {"ok": True, "tarea": tarea, "etag": etag}, {"ETag": etag})

    def manejar_delete_tarea(self, id_tarea: str):
        """Borra una tarea y sus subtareas; los bloques quedan libres."""
        archivo = self.archivo_activo()
        if archivo is None:
            return
        with CANDADO_ESCRITURA:
            if not archivo.exists():
                self.responder_error(404, "No hay datos para este usuario.")
                return
            datos = json.loads(archivo.read_text(encoding="utf-8"))
            tareas = datos.get("tareas", [])
            if not any(t.get("id") == id_tarea for t in tareas):
                self.responder_error(404, f"No existe la tarea '{id_tarea}'.")
                return
            fuera = ids_descendientes(tareas, id_tarea)
            datos["tareas"] = [t for t in tareas if t.get("id") not in fuera]
            for bloque in datos.get("bloques", []):
                if bloque.get("tarea") in fuera:
                    bloque["tarea"] = None
                    bloque["titulo"] = "Bloque libre"
            try:
                guardar_datos_atomico(archivo, datos)
            except Exception as e:
                self.responder_error(500, f"Error al guardar: {e}")
                return

        etag = obtener_etag(archivo)
        self.responder_json(
            200, {"ok": True, "borradas": len(fuera), "etag": etag}, {"ETag": etag}
        )

    def manejar_post_datos(self):
        archivo_objetivo = self.archivo_activo()
        if archivo_objetivo is None:
            return
        if not archivo_objetivo.exists():
            etag_actual = '"0"'
        else:
            etag_actual = obtener_etag(archivo_objetivo)

        # Validación del encabezado If-Match
        if_match = self.headers.get("If-Match", "").strip()
        if not if_match:
            self.responder_error(428, "Se requiere el encabezado If-Match con el ETag actual")
            return

        # Normalizar comillas para comparación
        if_match_limpio = if_match.strip('"')
        etag_actual_limpio = etag_actual.strip('"')

        if if_match_limpio != etag_actual_limpio:
            self.responder_json(
                409,
                {
                    "error": "Conflicto de concurrencia: el archivo en disco fue modificado.",
                    "etagActual": etag_actual
                },
                {"ETag": etag_actual}
            )
            return

        # Leer contenido
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            cuerpo_bytes = self.rfile.read(content_length)
            datos_nuevos = json.loads(cuerpo_bytes.decode("utf-8"))
        except Exception as e:
            self.responder_error(400, f"JSON inválido en el cuerpo de la petición: {str(e)}")
            return

        # Crear respaldo
        try:
            respaldar_datos(archivo_objetivo)
        except Exception as e:
            sys.stderr.write(f"Aviso: error creando respaldo: {e}\n")

        # Escritura atómica mediante archivo temporal en el mismo directorio
        try:
            archivo_objetivo.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile("w", dir=archivo_objetivo.parent, delete=False, encoding="utf-8", suffix=".tmp") as f_tmp:
                json.dump(datos_nuevos, f_tmp, ensure_ascii=False, indent=2)
                nombre_temporal = f_tmp.name
            os.replace(nombre_temporal, archivo_objetivo)
        except Exception as e:
            if "nombre_temporal" in locals() and os.path.exists(nombre_temporal):
                os.unlink(nombre_temporal)
            self.responder_error(500, f"Error al guardar datos: {str(e)}")
            return

        nuevo_etag = obtener_etag(archivo_objetivo)
        self.responder_json(200, {"ok": True, "etag": nuevo_etag}, {"ETag": nuevo_etag})

    def manejar_eventos_sse(self):
        """Server-Sent Events para detectar cambios externos en el archivo del usuario activo."""
        archivo_objetivo = self.archivo_activo()
        if archivo_objetivo is None:
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        ultimo_etag = obtener_etag(archivo_objetivo)
        import time

        try:
            while True:
                time.sleep(1.0)
                if archivo_objetivo.exists():
                    actual_etag = obtener_etag(archivo_objetivo)
                    if actual_etag != ultimo_etag:
                        ultimo_etag = actual_etag
                        data_json = json.dumps({"etag": actual_etag})
                        mensaje = f"event: cambio\ndata: {data_json}\n\n"
                        self.wfile.write(mensaje.encode("utf-8"))
                        self.wfile.flush()
                # Enviar comentario keep-alive para detectar desconexión del cliente
                self.wfile.write(b": ping\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, IOError):
            pass

    def manejar_estatico(self, ruta_url: str):
        # Normalizar ruta y evitar rutas relativas '..' o archivos ocultos
        ruta_limpia = urllib.parse.unquote(ruta_url).lstrip("/")
        if not ruta_limpia or ruta_limpia.endswith("/"):
            ruta_limpia += "index.html"

        partes = Path(ruta_limpia).parts
        if any(parte.startswith(".") or parte == ".." for parte in partes):
            self.responder_error(403, "Acceso no permitido")
            return

        archivo_solicitado = (DIRECTORIO_RAIZ / ruta_limpia).resolve()

        # Verificar que esté contenido dentro de DIRECTORIO_RAIZ
        try:
            archivo_solicitado.relative_to(DIRECTORIO_RAIZ)
        except ValueError:
            self.responder_error(403, "Acceso denegado: fuera del proyecto")
            return

        if not archivo_solicitado.exists() or not archivo_solicitado.is_file():
            self.responder_error(404, "Archivo no encontrado")
            return

        extension = archivo_solicitado.suffix.lower()
        mime = MIME_TIPOS.get(extension, "application/octet-stream")

        try:
            with open(archivo_solicitado, "rb") as f:
                contenido = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(contenido)))
            self.send_header("Cache-Control", "no-cache, must-revalidate")
            self.end_headers()
            self.wfile.write(contenido)
        except Exception as e:
            self.responder_error(500, f"Error al leer archivo: {str(e)}")

    def log_message(self, format, *args):
        # Salida concisa en consola
        sys.stdout.write(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {args[0]} {args[1]}\n")
        sys.stdout.flush()


def parsear_argumentos():
    parser = argparse.ArgumentParser(description="Servidor HTTP local para Itinerario")
    parser.add_argument("puerto", nargs="?", type=int, default=8090, help="Puerto de escucha (defecto: 8090)")
    parser.add_argument("--bind", default="127.0.0.1", help="Dirección IP de escucha (defecto: 127.0.0.1)")
    return parser.parse_args()


def principal():
    args = parsear_argumentos()
    servidor = http.server.ThreadingHTTPServer((args.bind, args.puerto), ManejadorItinerario)
    print(f"Servidor Itinerario corriendo en http://{args.bind}:{args.puerto}")
    print("Presiona Ctrl+C para detener.")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nDeteniendo servidor...")
        servidor.server_close()


if __name__ == "__main__":
    principal()
