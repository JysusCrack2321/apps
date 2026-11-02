#!/usr/bin/env python3
"""Servidor y utilidades del Portal de aplicaciones (puerto 8080)."""

from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import http.client
import json
import pathlib
import re
import socket
import sys
import threading
import unicodedata
import urllib.request

RAIZ_PORTAL = pathlib.Path(__file__).resolve().parent
RAIZ_APPS = RAIZ_PORTAL.parent
ARCHIVO_USUARIOS = RAIZ_APPS / 'usuarios.json'

PATRON_ID_USUARIO = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
ROLES_VALIDOS = ('admin', 'miembro')

PUERTO_PORTAL = 8080
PUERTO_EDT = 8088
PUERTO_ITINERARIO = 8090

# Prefijos públicos de las aplicaciones dentro del mismo hostname.
# El puerto de cada una sale de los atributos de la clase (puerto_edt /
# puerto_itinerario), que es lo que permite apuntarlas a otro puerto en pruebas.
APPS = ('edt', 'itinerario')

# Encabezados que no se reenvían al origen (son del salto, no del mensaje).
CABECERAS_NO_REENVIABLES = {
    'host', 'connection', 'keep-alive', 'proxy-connection', 'te', 'trailer',
    'transfer-encoding', 'upgrade', 'accept-encoding', 'content-length',
}

# Encabezados del origen que no se copian tal cual (el largo lo decide el proxy).
CABECERAS_NO_COPIADAS = {'transfer-encoding', 'connection', 'keep-alive', 'content-length'}


def generar_id_usuario(nombre):
    """Genera un identificador en minúsculas, sin tildes y con guiones (a-z0-9-)."""
    if not isinstance(nombre, str):
        raise ValueError('El nombre debe ser una cadena de texto.')
    normalizado = unicodedata.normalize('NFD', nombre.strip().lower())
    sin_tildes = ''.join(
        c for c in normalizado if unicodedata.category(c) != 'Mn'
    )
    limpio = re.sub(r'[^a-z0-9]+', '-', sin_tildes).strip('-')
    if not limpio:
        raise ValueError(f'No se pudo generar un id válido a partir de: {nombre!r}')
    return limpio


def validar_usuarios(datos):
    """Valida la estructura y restricciones de la lista de usuarios compartidos.

    Reglas:
    - Debe ser una lista de objetos con {"id", "nombre", "correo", "rol"}.
    - "id" debe ser único y cumplir el formato a-z0-9-.
    - "rol" debe ser "admin" o "miembro".
    - "nombre" debe ser texto no vacío; "correo" debe ser texto.
    """
    if not isinstance(datos, list):
        raise ValueError('usuarios.json debe contener una lista JSON.')

    ids_vistos = set()
    for indice, entrada in enumerate(datos):
        if not isinstance(entrada, dict):
            raise ValueError(f'El usuario en la posición {indice} debe ser un objeto.')

        for campo in ('id', 'nombre', 'correo', 'rol'):
            if campo not in entrada:
                raise ValueError(f'Falta el campo obligatorio "{campo}" en posición {indice}.')

        uid = entrada['id']
        nombre = entrada['nombre']
        correo = entrada['correo']
        rol = entrada['rol']

        if not isinstance(uid, str) or not PATRON_ID_USUARIO.match(uid):
            raise ValueError(
                f'El id "{uid}" en posición {indice} no es válido (solo a-z0-9- sin guiones extremos).'
            )
        if uid in ids_vistos:
            raise ValueError(f'El id de usuario "{uid}" está duplicado.')
        ids_vistos.add(uid)

        if not isinstance(nombre, str) or not nombre.strip():
            raise ValueError(f'El nombre del usuario "{uid}" no puede estar vacío.')

        if not isinstance(correo, str):
            raise ValueError(f'El correo del usuario "{uid}" debe ser una cadena de texto.')

        if rol not in ROLES_VALIDOS:
            raise ValueError(
                f'El rol "{rol}" del usuario "{uid}" no es válido (debe ser "admin" o "miembro").'
            )

    return True


def cargar_usuarios_compartidos(ruta_usuarios=None, validar=False):
    """Carga la lista de usuarios desde usuarios.json."""
    objetivo = pathlib.Path(ruta_usuarios) if ruta_usuarios else ARCHIVO_USUARIOS
    if not objetivo.is_file():
        if validar:
            raise FileNotFoundError(f'No se encontró el archivo de usuarios: {objetivo}')
        return []

    texto = objetivo.read_text(encoding='utf-8')
    try:
        datos = json.loads(texto)
    except Exception as exc:
        if validar:
            raise ValueError(f'usuarios.json no contiene JSON válido: {exc}') from exc
        return []

    if validar:
        validar_usuarios(datos)
    elif not isinstance(datos, list):
        return []

    return datos


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
    try:
        usuarios = cargar_usuarios_compartidos(ruta_usuarios, validar=False)
    except Exception:
        return None

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


def host_consulta_local(bind_host):
    """Traduce 0.0.0.0 o :: a 127.0.0.1 para sondas locales del servidor."""
    if not bind_host or bind_host in ('0.0.0.0', '::'):
        return '127.0.0.1'
    return bind_host


def verificar_servicio_en_linea(bind_host, puerto, timeout=0.6):
    """Comprueba del lado del servidor si una app responde en su puerto."""
    host = host_consulta_local(bind_host)
    url = f'http://{host}:{puerto}/api/yo'
    try:
        req = urllib.request.Request(url, method='GET')
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return 200 <= resp.status < 500
    except Exception:
        try:
            with socket.create_connection((host, puerto), timeout=timeout):
                return True
        except OSError:
            return False


class ManejadorPortal(SimpleHTTPRequestHandler):
    """Manejador HTTP para el portal en el puerto 8080."""

    protocol_version = 'HTTP/1.1'
    bind_host = '127.0.0.1'
    puerto_edt = PUERTO_EDT
    puerto_itinerario = PUERTO_ITINERARIO

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(RAIZ_PORTAL), **kwargs)

    def log_message(self, format, *args):
        pass

    def enviar_json(self, codigo, objeto):
        cuerpo = (json.dumps(objeto, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
        self.send_response(codigo)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_GET(self):
        ruta_limpia = self.path.split('?', 1)[0]

        if ruta_limpia == '/api/estado':
            self.manejar_get_estado()
            return

        if ruta_limpia == '/api/usuarios':
            self.manejar_get_usuarios()
            return

        if ruta_limpia == '/api/yo':
            self.manejar_get_yo()
            return

        if self.reenviar_a_app():
            return

        super().do_GET()

    def do_HEAD(self):
        if not self.reenviar_a_app():
            super().do_HEAD()

    def do_POST(self):
        if not self.reenviar_a_app():
            self.enviar_json(HTTPStatus.METHOD_NOT_ALLOWED, {'error': 'Método no permitido.'})

    # --- Puerta única: /edt/ y /itinerario/ apuntan a cada aplicación -------

    def app_de_ruta(self, ruta):
        """Devuelve el prefijo de app ('edt' o 'itinerario') o None."""
        for prefijo in APPS:
            if ruta == '/' + prefijo or ruta.startswith('/' + prefijo + '/'):
                return prefijo
        return None

    def reenviar_a_app(self):
        """Reenvía la petición a la app del prefijo, quitando el prefijo.

        Devuelve False si la ruta no pertenece a ninguna app.
        """
        prefijo = self.app_de_ruta(self.path.split('?', 1)[0])
        if prefijo is None:
            return False

        ruta_limpia = self.path.split('?', 1)[0]

        # /edt -> /edt/ para que las rutas relativas del HTML resuelvan dentro.
        if ruta_limpia == '/' + prefijo:
            consulta = self.path[len(ruta_limpia):]
            self.send_response(HTTPStatus.MOVED_PERMANENTLY)
            self.send_header('Location', '/' + prefijo + '/' + consulta)
            self.send_header('Content-Length', '0')
            self.end_headers()
            return True

        destino = ruta_limpia[len(prefijo) + 1:] or '/'
        if '?' in self.path:
            destino += '?' + self.path.split('?', 1)[1]

        cuerpo = None
        if self.command in ('POST', 'PUT', 'PATCH', 'DELETE'):
            try:
                largo = int(self.headers.get('Content-Length') or 0)
            except ValueError:
                largo = 0
            cuerpo = self.rfile.read(largo) if largo > 0 else b''

        cabeceras = {
            clave: valor
            for clave, valor in self.headers.items()
            if clave.lower() not in CABECERAS_NO_REENVIABLES
        }
        if cuerpo is not None:
            cabeceras['Content-Length'] = str(len(cuerpo))

        host = host_consulta_local(self.bind_host)
        puerto = self.puerto_edt if prefijo == 'edt' else self.puerto_itinerario
        conexion = http.client.HTTPConnection(host, puerto, timeout=3600)
        try:
            conexion.request(self.command, destino, body=cuerpo, headers=cabeceras)
            respuesta = conexion.getresponse()
        except Exception:
            self.enviar_json(
                HTTPStatus.BAD_GATEWAY,
                {'error': f'La aplicación "{prefijo}" no responde en el puerto {puerto}.'},
            )
            return True

        largo_respuesta = respuesta.getheader('Content-Length')
        self.send_response(respuesta.status, respuesta.reason)
        for clave, valor in respuesta.getheaders():
            if clave.lower() not in CABECERAS_NO_COPIADAS:
                self.send_header(clave, valor)

        # HEAD no lleva cuerpo: se copian solo las cabeceras.
        if self.command == 'HEAD':
            if largo_respuesta is not None:
                self.send_header('Content-Length', largo_respuesta)
            self.end_headers()
            conexion.close()
            return True

        if largo_respuesta is not None:
            self.send_header('Content-Length', largo_respuesta)
        else:
            # Sin largo conocido (SSE): se transmite por trozos, sin acumular.
            self.send_header('Transfer-Encoding', 'chunked')
        self.end_headers()

        try:
            while True:
                trozo = respuesta.read1(4096)   # read1: devuelve lo que ya llegó
                if not trozo:
                    break
                if largo_respuesta is None:
                    self.wfile.write(b'%x\r\n' % len(trozo) + trozo + b'\r\n')
                else:
                    self.wfile.write(trozo)
                self.wfile.flush()
            if largo_respuesta is None:
                self.wfile.write(b'0\r\n\r\n')
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            conexion.close()
        return True

    def manejar_get_estado(self):
        edt_ok = verificar_servicio_en_linea(self.bind_host, self.puerto_edt)
        itinerario_ok = verificar_servicio_en_linea(self.bind_host, self.puerto_itinerario)
        self.enviar_json(HTTPStatus.OK, {
            'edt': {
                'puerto': self.puerto_edt,
                'enLinea': edt_ok,
            },
            'itinerario': {
                'puerto': self.puerto_itinerario,
                'enLinea': itinerario_ok,
            },
        })

    def manejar_get_usuarios(self):
        usuarios = cargar_usuarios_compartidos(validar=False)
        lista_publica = [
            {
                'id': u.get('id'),
                'nombre': u.get('nombre'),
                'rol': u.get('rol'),
            }
            for u in usuarios
            if isinstance(u, dict) and u.get('id') and u.get('nombre')
        ]
        # Con Access la identidad la fija el correo: no se ofrece cambiar de usuario.
        if self.headers.get('Cf-Access-Authenticated-User-Email'):
            activo = quien_es(self)
            lista_publica = [
                u for u in lista_publica if activo and u['id'] == activo['id']
            ]
        self.enviar_json(HTTPStatus.OK, lista_publica)

    def manejar_get_yo(self):
        usuario = quien_es(self)
        self.enviar_json(HTTPStatus.OK, usuario)
