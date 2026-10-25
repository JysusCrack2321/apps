#!/usr/bin/env python3
"""Lanzador unificado para Portal (8080), Project Organizer (8088) e Itinerario (8090).

Uso:
  python3 iniciar.py [--bind 127.0.0.1]
"""

import argparse
from http.server import ThreadingHTTPServer
import pathlib
import signal
import socket
import subprocess
import sys
import time

from portal.servidor import (
    ARCHIVO_USUARIOS,
    ManejadorPortal,
    PUERTO_EDT,
    PUERTO_ITINERARIO,
    PUERTO_PORTAL,
    cargar_usuarios_compartidos,
    host_consulta_local,
)

RAIZ = pathlib.Path(__file__).resolve().parent
SERVIDOR_EDT = RAIZ / 'project-organizer' / 'servidor.py'
SERVIDOR_ITINERARIO = RAIZ / 'itinerario-app' / 'servidor.py'


def puerto_esta_ocupado(bind_host, puerto):
    """Devuelve True si el puerto ya está siendo escuchado o no se puede enlazar."""
    host_prueba = host_consulta_local(bind_host)
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s_conn:
        s_conn.settimeout(0.25)
        if s_conn.connect_ex((host_prueba, puerto)) == 0:
            return True

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s_bind:
        s_bind.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s_bind.bind((bind_host, puerto))
        except OSError:
            return True
    return False


def verificar_puertos_libres(bind_host, puertos):
    """Retorna la lista de tuplas (nombre, puerto) que están ocupados."""
    ocupados = []
    for nombre, puerto in puertos:
        if puerto_esta_ocupado(bind_host, puerto):
            ocupados.append((nombre, puerto))
    return ocupados


def detener_subprocesos(procesos):
    """Termina limpiamente una lista de subprocesos sin dejar huérfanos."""
    for proc in procesos:
        if proc.poll() is None:
            try:
                proc.terminate()
            except Exception:
                pass

    limite = time.monotonic() + 3.0
    for proc in procesos:
        while proc.poll() is None and time.monotonic() < limite:
            time.sleep(0.05)
        if proc.poll() is None:
            try:
                proc.kill()
                proc.wait(timeout=1.0)
            except Exception:
                pass


def esperar_puerto_activo(bind_host, puerto, proc, timeout=5.0):
    """Espera hasta que el subproceso escuche en su puerto o falle."""
    host_prueba = host_consulta_local(bind_host)
    inicio = time.monotonic()
    while time.monotonic() - inicio < timeout:
        if proc.poll() is not None:
            return False
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.2)
            if s.connect_ex((host_prueba, puerto)) == 0:
                return True
        time.sleep(0.05)
    return proc.poll() is None


def parsear_argumentos(argv=None):
    parser = argparse.ArgumentParser(
        description='Inicia el Portal (8080), Project Organizer (8088) e Itinerario (8090).'
    )
    parser.add_argument(
        '--bind',
        default='127.0.0.1',
        help='Dirección IP de enlace para los tres servidores (por defecto: 127.0.0.1)',
    )
    return parser.parse_args(argv)


def iniciar_todo(bind_host='127.0.0.1'):
    """Valida usuarios.json, comprueba puertos y arranca los tres servidores."""
    try:
        cargar_usuarios_compartidos(ARCHIVO_USUARIOS, validar=True)
    except Exception as exc:
        print(f'Error en usuarios.json: {exc}', file=sys.stderr, flush=True)
        return 1

    servicios = [
        ('Portal', PUERTO_PORTAL),
        ('Project Organizer (EDT)', PUERTO_EDT),
        ('Itinerario', PUERTO_ITINERARIO),
    ]
    ocupados = verificar_puertos_libres(bind_host, servicios)
    if ocupados:
        for nombre, puerto in ocupados:
            print(
                f'Error: el puerto {puerto} ({nombre}) ya está ocupado en {bind_host}. '
                f'Cierra el proceso que lo usa antes de iniciar.',
                file=sys.stderr,
                flush=True,
            )
        return 1

    procesos = []
    servidor_portal = None

    try:
        proc_edt = subprocess.Popen(
            [sys.executable, str(SERVIDOR_EDT), str(PUERTO_EDT), '--bind', bind_host],
            cwd=str(SERVIDOR_EDT.parent),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
        )
        procesos.append(proc_edt)

        proc_itinerario = subprocess.Popen(
            [sys.executable, str(SERVIDOR_ITINERARIO), str(PUERTO_ITINERARIO), '--bind', bind_host],
            cwd=str(SERVIDOR_ITINERARIO.parent),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
        )
        procesos.append(proc_itinerario)

        if not esperar_puerto_activo(bind_host, PUERTO_EDT, proc_edt):
            err = proc_edt.stderr.read() if proc_edt.stderr else ''
            print(f'Error al iniciar Project Organizer en puerto {PUERTO_EDT}: {err}', file=sys.stderr, flush=True)
            detener_subprocesos(procesos)
            return 1

        if not esperar_puerto_activo(bind_host, PUERTO_ITINERARIO, proc_itinerario):
            err = proc_itinerario.stderr.read() if proc_itinerario.stderr else ''
            print(f'Error al iniciar Itinerario en puerto {PUERTO_ITINERARIO}: {err}', file=sys.stderr, flush=True)
            detener_subprocesos(procesos)
            return 1

        ManejadorPortal.bind_host = bind_host
        ManejadorPortal.puerto_edt = PUERTO_EDT
        ManejadorPortal.puerto_itinerario = PUERTO_ITINERARIO

        try:
            servidor_portal = ThreadingHTTPServer((bind_host, PUERTO_PORTAL), ManejadorPortal)
        except OSError as exc:
            print(
                f'Error: no se pudo abrir el puerto {PUERTO_PORTAL} (Portal) en {bind_host}: {exc}',
                file=sys.stderr,
                flush=True,
            )
            detener_subprocesos(procesos)
            return 1

        def manejador_senal(signum, frame):
            raise KeyboardInterrupt

        signal.signal(signal.SIGINT, manejador_senal)
        signal.signal(signal.SIGTERM, manejador_senal)

        print('============================================================', flush=True)
        print('Servidores en línea:', flush=True)
        print(f'  Portal:                  http://{bind_host}:{PUERTO_PORTAL}/', flush=True)
        print(f'  Project Organizer (EDT): http://{bind_host}:{PUERTO_EDT}/', flush=True)
        print(f'  Itinerario:              http://{bind_host}:{PUERTO_ITINERARIO}/', flush=True)
        print('Presiona Ctrl+C para detener los tres servidores.', flush=True)
        print('============================================================', flush=True)

        servidor_portal.serve_forever()
    except KeyboardInterrupt:
        print('\nCerrando servidores...', flush=True)
    finally:
        if servidor_portal is not None:
            try:
                servidor_portal.server_close()
            except Exception:
                pass
        detener_subprocesos(procesos)

    return 0


def main():
    args = parsear_argumentos()
    sys.exit(iniciar_todo(args.bind))


if __name__ == '__main__':
    main()
