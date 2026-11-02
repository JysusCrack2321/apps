#!/usr/bin/env python3
"""Servidor web para Project Organizer (Fase B1).

- Sirve los archivos estáticos de la aplicación.
- Al iniciar, garantiza que exista guardados/actual.json copiando el más reciente
  entre guardados/datos<N>.json y datos.json de la raíz (sin alterar los antiguos).
- GET /datos.json: devuelve guardados/actual.json con encabezado ETag.
- POST /api/guardar: exige If-Match (428 si falta, 409 si cambió), respalda en
  guardados/respaldo.json si no existe o supera INTERVALO_RESPALDO (300 s), y
  sobrescribe atómicamente guardados/actual.json devolviendo el nuevo ETag.
- GET /api/guardados: lista actual.json, respaldo.json, los datos<N>.json históricos
  y el datos.json base.
- GET /api/guardados/<nombre>: devuelve el contenido de esa versión específica.
- GET /api/eventos: stream Server-Sent Events (SSE) que emite event: cambio
  con {"etag": ...} cuando cambia actual.json y : ping periódicamente.

Uso:
  python3 servidor.py [puerto] [--bind direccion] [--raiz carpeta]
  Por defecto: puerto 8088, bind 127.0.0.1
"""
import argparse
from datetime import datetime, timezone
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import pathlib
import re
import signal
import sys
import threading
import time

RAIZ = pathlib.Path(__file__).resolve().parent
CARPETA_GUARDADOS = RAIZ / 'guardados'
ARCHIVO_BASE = RAIZ / 'datos.json'
ARCHIVO_ACTUAL = CARPETA_GUARDADOS / 'actual.json'
ARCHIVO_RESPALDO = CARPETA_GUARDADOS / 'respaldo.json'
ARCHIVO_USUARIOS = RAIZ.parent / 'usuarios.json'
PATRON_GUARDADO = re.compile(r'^datos(\d+)\.json$')

INTERVALO_RESPALDO = 300
ThreadingHTTPServer.daemon_threads = True


def configurar_rutas(nueva_raiz):
    """Permite redirigir las rutas del servidor (útil en pruebas con carpetas temporales)."""
    global RAIZ, CARPETA_GUARDADOS, ARCHIVO_BASE, ARCHIVO_ACTUAL, ARCHIVO_RESPALDO
    RAIZ = pathlib.Path(nueva_raiz).resolve()
    CARPETA_GUARDADOS = RAIZ / 'guardados'
    ARCHIVO_BASE = RAIZ / 'datos.json'
    ARCHIVO_ACTUAL = CARPETA_GUARDADOS / 'actual.json'
    ARCHIVO_RESPALDO = CARPETA_GUARDADOS / 'respaldo.json'


def obtener_etag(archivo_path):
    """Calcula un ETag basado en el mtime_ns del archivo (reutilizado del itinerario)."""
    if not archivo_path or not pathlib.Path(archivo_path).exists():
        return '"0"'
    mtime_ns = pathlib.Path(archivo_path).stat().st_mtime_ns
    return f'"{mtime_ns}"'


def cargar_usuarios_compartidos(ruta_usuarios=None):
    """Lee usuarios.json compartido si existe y es válido; si no, devuelve []."""
    objetivo = pathlib.Path(ruta_usuarios) if ruta_usuarios else ARCHIVO_USUARIOS
    if not objetivo.is_file():
        return []
    try:
        datos = json.loads(objetivo.read_text(encoding='utf-8'))
        if isinstance(datos, list):
            return datos
    except Exception:
        pass
    return []


CANDADO_USUARIOS = threading.Lock()


def id_desde_correo(correo):
    """Id provisional a partir de la parte local del correo (a-z0-9-)."""
    base = correo.split('@')[0].strip().lower()
    return re.sub(r'[^a-z0-9]+', '-', base).strip('-') or 'usuario'


def registrar_usuario_automatico(correo):
    """Alta automática de un correo ya verificado por Cloudflare Access.

    El nombre queda como la parte local del correo y el rol como miembro; luego
    un admin lo renombra. Devuelve {id, nombre, rol} o None si no se pudo.
    """
    correo = (correo or '').strip().lower()
    if not correo:
        return None
    with CANDADO_USUARIOS:
        usuarios = cargar_usuarios_compartidos()
        for u in usuarios:
            if isinstance(u, dict) and str(u.get('correo', '')).strip().lower() == correo:
                return {'id': u['id'], 'nombre': u['nombre'], 'rol': u['rol']}

        base = id_desde_correo(correo)
        existentes = {u.get('id') for u in usuarios if isinstance(u, dict)}
        nuevo_id, sufijo = base, 2
        while nuevo_id in existentes:
            nuevo_id = f'{base}-{sufijo}'
            sufijo += 1

        usuarios.append({'id': nuevo_id, 'nombre': base, 'correo': correo, 'rol': 'miembro'})
        try:
            ARCHIVO_USUARIOS.parent.mkdir(parents=True, exist_ok=True)
            temporal = ARCHIVO_USUARIOS.with_suffix('.tmp')
            temporal.write_text(
                json.dumps(usuarios, ensure_ascii=False, indent=2) + '\n',
                encoding='utf-8',
            )
            temporal.replace(ARCHIVO_USUARIOS)
        except OSError as exc:
            sys.stderr.write(f'No se pudo registrar {correo}: {exc}\n')
            return None
        sys.stderr.write(f'Alta automática: {nuevo_id} <{correo}>\n')
        return {'id': nuevo_id, 'nombre': base, 'rol': 'miembro'}


def quien_es(peticion, ruta_usuarios=None):
    """Identifica al usuario activo de la petición HTTP.

    Preparada para Fase D:
    1. Primero inspecciona el encabezado Cf-Access-Authenticated-User-Email.
    2. Si no está presente, lee la cookie 'usuario'.
    Devuelve { id, nombre, rol } o None si no hay usuario válido.
    """
    usuarios = cargar_usuarios_compartidos(ruta_usuarios)
    if not usuarios:
        return None

    headers = getattr(peticion, 'headers', None) or {}

    correo_cf = headers.get('Cf-Access-Authenticated-User-Email')
    if correo_cf:
        correo_limpio = correo_cf.strip().lower()
        for u in usuarios:
            if isinstance(u, dict) and str(u.get('correo', '')).strip().lower() == correo_limpio and correo_limpio:
                return {'id': u['id'], 'nombre': u['nombre'], 'rol': u['rol']}
        return registrar_usuario_automatico(correo_cf)  # alta automática del correo verificado

    cookie_raw = headers.get('Cookie', '')
    if cookie_raw:
        cookie = SimpleCookie()
        try:
            cookie.load(cookie_raw)
        except Exception:
            return None
        if 'usuario' in cookie:
            uid = cookie['usuario'].value.strip()
            for u in usuarios:
                if isinstance(u, dict) and u.get('id') == uid:
                    return {'id': u['id'], 'nombre': u['nombre'], 'rol': u['rol']}

    return None


def listar_archivos_guardados():
    """Devuelve lista de tuplas (numero, Path) de datos<N>.json ordenadas de más reciente a más antiguo."""
    if not CARPETA_GUARDADOS.is_dir():
        return []
    encontrados = []
    for ruta in CARPETA_GUARDADOS.iterdir():
        if not ruta.is_file():
            continue
        m = PATRON_GUARDADO.match(ruta.name)
        if m:
            encontrados.append((int(m.group(1)), ruta))
    encontrados.sort(key=lambda par: par[0], reverse=True)
    return encontrados


def asegurar_archivo_actual():
    """Garantiza que exista guardados/actual.json copiando el más reciente entre datos<N>.json y datos.json."""
    if ARCHIVO_ACTUAL.is_file():
        return ARCHIVO_ACTUAL

    origen = None
    guardados = listar_archivos_guardados()
    if guardados:
        origen = guardados[0][1]
    elif ARCHIVO_BASE.is_file():
        origen = ARCHIVO_BASE

    if origen is None:
        return None

    CARPETA_GUARDADOS.mkdir(parents=True, exist_ok=True)
    temporal = CARPETA_GUARDADOS / '.actual.json.init.tmp'
    temporal.write_bytes(origen.read_bytes())
    temporal.replace(ARCHIVO_ACTUAL)
    return ARCHIVO_ACTUAL


def info_archivo(ruta, numero, etiqueta):
    """Extrae metadatos básicos de un archivo de proyecto para mostrar en la lista."""
    stat = ruta.stat()
    fecha_iso = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
    nombre_proyecto = ''
    try:
        contenido = json.loads(ruta.read_text(encoding='utf-8'))
        nombre_proyecto = contenido.get('proyecto', {}).get('nombre', '')
    except Exception:
        pass
    return {
        'nombre': ruta.name,
        'numero': numero,
        'etiqueta': etiqueta,
        'fecha': fecha_iso,
        'proyecto': nombre_proyecto,
    }


def obtener_lista_versiones():
    """Construye la lista completa de versiones disponibles (actual, respaldo, datos<N> y base)."""
    asegurar_archivo_actual()
    resultado = []

    if ARCHIVO_ACTUAL.is_file():
        resultado.append(info_archivo(ARCHIVO_ACTUAL, 0, 'Actual (en curso)'))

    if ARCHIVO_RESPALDO.is_file():
        resultado.append(info_archivo(ARCHIVO_RESPALDO, 0, 'Respaldo reciente'))

    for num, ruta in listar_archivos_guardados():
        resultado.append(info_archivo(ruta, num, f'Versión {num}'))

    if ARCHIVO_BASE.is_file():
        etiqueta_base = 'Más reciente (base)' if not resultado else 'Original (base)'
        resultado.append(info_archivo(ARCHIVO_BASE, 1, etiqueta_base))

    return resultado


def resolver_archivo_mas_reciente():
    """Devuelve el Path del archivo activo guardados/actual.json (creándolo si hace falta)."""
    return asegurar_archivo_actual()


def actualizar_respaldo_si_corresponde(intervalo=None):
    """Copia actual.json a respaldo.json si respaldo.json no existe o tiene antigüedad >= intervalo."""
    if not ARCHIVO_ACTUAL.is_file():
        return False

    segundos = INTERVALO_RESPALDO if intervalo is None else intervalo
    debe_copiar = False
    if not ARCHIVO_RESPALDO.is_file():
        debe_copiar = True
    else:
        edad = time.time() - ARCHIVO_RESPALDO.stat().st_mtime
        if edad >= segundos:
            debe_copiar = True

    if debe_copiar:
        CARPETA_GUARDADOS.mkdir(parents=True, exist_ok=True)
        temporal_resp = CARPETA_GUARDADOS / '.respaldo.json.tmp'
        temporal_resp.write_bytes(ARCHIVO_ACTUAL.read_bytes())
        temporal_resp.replace(ARCHIVO_RESPALDO)
        return True
    return False


def guardar_nueva_version(cuerpo_bytes, intervalo_respaldo=None):
    """Valida el JSON recibido, respalda si corresponde y sobrescribe atómicamente guardados/actual.json."""
    try:
        texto = cuerpo_bytes.decode('utf-8')
        datos = json.loads(texto)
    except Exception as exc:
        raise ValueError('El contenido enviado no es JSON válido.') from exc

    if not isinstance(datos, dict) or 'proyecto' not in datos or 'actividades' not in datos:
        raise ValueError('El JSON no tiene la estructura de un proyecto válido.')

    CARPETA_GUARDADOS.mkdir(parents=True, exist_ok=True)
    asegurar_archivo_actual()
    mtime_previo_ns = ARCHIVO_ACTUAL.stat().st_mtime_ns if ARCHIVO_ACTUAL.is_file() else 0
    actualizar_respaldo_si_corresponde(intervalo=intervalo_respaldo)

    temporal = CARPETA_GUARDADOS / '.actual.json.tmp'
    contenido_formateado = json.dumps(datos, ensure_ascii=False, indent=2) + '\n'
    temporal.write_text(contenido_formateado, encoding='utf-8')
    temporal.replace(ARCHIVO_ACTUAL)
    stat_nuevo = ARCHIVO_ACTUAL.stat()
    if stat_nuevo.st_mtime_ns <= mtime_previo_ns:
        os.utime(ARCHIVO_ACTUAL, ns=(stat_nuevo.st_atime_ns, mtime_previo_ns + 1))
    return ARCHIVO_ACTUAL.name


class ServidorProjectOrganizer(ThreadingHTTPServer):
    daemon_threads = True


class ManejadorProjectOrganizer(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(RAIZ), **kwargs)

    def enviar_json(self, codigo, objeto, headers_extra=None):
        cuerpo = (json.dumps(objeto, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
        self.send_response(codigo)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        if headers_extra:
            for clave, valor in headers_extra.items():
                self.send_header(clave, valor)
        self.send_header('Content-Length', str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def enviar_archivo_json(self, ruta, incluir_etag=True):
        cuerpo = ruta.read_bytes()
        etag = obtener_etag(ruta) if incluir_etag else None
        self.send_response(HTTPStatus.OK)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Archivo-Origen', ruta.name)
        if etag is not None:
            self.send_header('ETag', etag)
        self.send_header('Content-Length', str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_GET(self):
        ruta_limpia = self.path.split('?', 1)[0]

        if ruta_limpia == '/api/yo':
            self.manejar_get_yo()
            return

        if ruta_limpia == '/api/usuarios':
            self.manejar_get_usuarios()
            return

        if ruta_limpia == '/api/eventos':
            self.manejar_eventos_sse()
            return

        # 1. Al pedir /datos.json, entregar guardados/actual.json con ETag
        if ruta_limpia == '/datos.json':
            self.manejar_get_datos()
            return

        # 2. Listar las versiones guardadas en el servidor
        if ruta_limpia == '/api/guardados':
            self.enviar_json(HTTPStatus.OK, {'archivos': obtener_lista_versiones()})
            return

        # 3. Cargar una versión específica de las guardadas
        if ruta_limpia.startswith('/api/guardados/'):
            nombre = ruta_limpia[len('/api/guardados/'):]
            asegurar_archivo_actual()
            if nombre == 'actual.json' and ARCHIVO_ACTUAL.is_file():
                self.enviar_archivo_json(ARCHIVO_ACTUAL)
                return
            if nombre == 'respaldo.json' and ARCHIVO_RESPALDO.is_file():
                self.enviar_archivo_json(ARCHIVO_RESPALDO, incluir_etag=False)
                return
            if nombre == 'datos.json' and ARCHIVO_BASE.is_file():
                self.enviar_archivo_json(ARCHIVO_BASE, incluir_etag=False)
                return
            if PATRON_GUARDADO.match(nombre):
                candidato = CARPETA_GUARDADOS / nombre
                if candidato.is_file():
                    self.enviar_archivo_json(candidato, incluir_etag=False)
                    return
            self.enviar_json(HTTPStatus.NOT_FOUND, {'error': 'Versión no encontrada.'})
            return

        # Bloquear acceso directo por URL a la carpeta guardados/ por limpieza
        if ruta_limpia == '/guardados' or ruta_limpia.startswith('/guardados/'):
            self.enviar_json(HTTPStatus.FORBIDDEN, {'error': 'Usa /api/guardados'})
            return

        super().do_GET()

    def manejar_get_datos(self):
        reciente = resolver_archivo_mas_reciente()
        if not reciente or not reciente.is_file():
            self.enviar_json(HTTPStatus.NOT_FOUND, {'error': 'No hay datos.json'})
            return
        self.enviar_archivo_json(reciente, incluir_etag=True)

    def manejar_get_yo(self):
        usuario = quien_es(self)
        self.enviar_json(HTTPStatus.OK, usuario)

    def manejar_get_usuarios(self):
        usuarios = cargar_usuarios_compartidos()
        # Detrás de Access no se exponen los correos: solo id, nombre y rol,
        # que es lo que necesita el selector de responsable del EDT.
        if self.headers.get('Cf-Access-Authenticated-User-Email'):
            usuarios = [
                {'id': u['id'], 'nombre': u['nombre'], 'rol': u['rol']}
                for u in usuarios
                if isinstance(u, dict) and u.get('id') and u.get('nombre')
            ]
        self.enviar_json(HTTPStatus.OK, usuarios)

    def manejar_eventos_sse(self):
        """Server-Sent Events para detectar cambios en guardados/actual.json."""
        asegurar_archivo_actual()
        self.send_response(HTTPStatus.OK)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache, no-transform')
        self.send_header('X-Accel-Buffering', 'no')
        self.send_header('Connection', 'keep-alive')
        self.end_headers()

        ultimo_etag = obtener_etag(ARCHIVO_ACTUAL)
        try:
            self.wfile.write(b': ping\n\n')
            self.wfile.flush()
            while True:
                time.sleep(0.4)
                if ARCHIVO_ACTUAL.exists():
                    actual_etag = obtener_etag(ARCHIVO_ACTUAL)
                    if actual_etag != ultimo_etag:
                        ultimo_etag = actual_etag
                        data_json = json.dumps({'etag': actual_etag})
                        mensaje = f'event: cambio\ndata: {data_json}\n\n'
                        self.wfile.write(mensaje.encode('utf-8'))
                        self.wfile.flush()
                self.wfile.write(b': ping\n\n')
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass

    def do_POST(self):
        ruta_limpia = self.path.split('?', 1)[0]
        if ruta_limpia == '/api/guardar':
            self.manejar_post_guardar()
            return
        self.enviar_json(HTTPStatus.NOT_FOUND, {'error': 'Ruta no encontrada.'})

    def manejar_post_guardar(self):
        actual = asegurar_archivo_actual()
        etag_actual = obtener_etag(actual) if actual and actual.exists() else '"0"'

        if_match = self.headers.get('If-Match', '').strip()
        if not if_match:
            self.enviar_json(
                428,
                {'error': 'Se requiere el encabezado If-Match con el ETag actual.'},
            )
            return

        if if_match.strip('"') != etag_actual.strip('"'):
            self.enviar_json(
                HTTPStatus.CONFLICT,
                {
                    'error': 'Conflicto de concurrencia: el proyecto fue modificado en el servidor.',
                    'etagActual': etag_actual,
                },
                {'ETag': etag_actual},
            )
            return

        try:
            longitud = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            longitud = 0

        if longitud <= 0 or longitud > 10 * 1024 * 1024:
            self.enviar_json(HTTPStatus.BAD_REQUEST, {'error': 'Tamaño de archivo inválido.'})
            return

        cuerpo = self.rfile.read(longitud)
        try:
            nombre = guardar_nueva_version(cuerpo)
            nuevo_etag = obtener_etag(ARCHIVO_ACTUAL)
            self.enviar_json(
                HTTPStatus.OK,
                {'ok': True, 'nombre': nombre, 'etag': nuevo_etag},
                {'ETag': nuevo_etag},
            )
        except ValueError as exc:
            self.enviar_json(HTTPStatus.BAD_REQUEST, {'error': str(exc)})
        except Exception as exc:
            self.enviar_json(HTTPStatus.INTERNAL_SERVER_ERROR, {'error': f'Error al guardar: {exc}'})


def main():
    parser = argparse.ArgumentParser(description='Servidor de Project Organizer')
    parser.add_argument('puerto', nargs='?', type=int, default=8088, help='Puerto HTTP (por defecto 8088)')
    parser.add_argument('--bind', default='127.0.0.1', help='Dirección de escucha (por defecto 127.0.0.1)')
    parser.add_argument('--raiz', default=None, help='Carpeta raíz de datos (opcional, para pruebas)')
    args = parser.parse_args()

    if args.raiz:
        configurar_rutas(args.raiz)

    CARPETA_GUARDADOS.mkdir(parents=True, exist_ok=True)
    asegurar_archivo_actual()

    def manejador_senal(signum, frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGINT, manejador_senal)
    signal.signal(signal.SIGTERM, manejador_senal)

    servidor = ServidorProjectOrganizer((args.bind, args.puerto), ManejadorProjectOrganizer)
    print(f'Sirviendo Project Organizer en http://{args.bind}:{args.puerto}/', flush=True)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print('\nCerrando servidor...', flush=True)
        servidor.server_close()
        sys.exit(0)


if __name__ == '__main__':
    main()
