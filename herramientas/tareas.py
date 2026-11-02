#!/usr/bin/env python3
"""Cliente de tareas del Itinerario para terminal y agentes.

Usa la API del servidor (GET/POST /api/tareas, DELETE /api/tareas/<id>),
así que funciona igual en local que a través de Cloudflare Access.

Identidad (una de las dos):
  --cookie usuario=<id>                     uso local, sin Access
  --access-client-id / --access-client-secret   token de servicio de Access

También se pueden pasar por entorno: GIDA_URL, GIDA_COOKIE,
CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET.

Ejemplos:
  python3 herramientas/tareas.py listar
  python3 herramientas/tareas.py agregar --titulo "Informe de laboratorio" \
      --materia proc1 --entrega 2026-11-06T23:59 --duracion 120
  python3 herramientas/tareas.py borrar --id t-a1b2c3
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

URL_POR_DEFECTO = os.environ.get("GIDA_URL", "http://127.0.0.1:8080/itinerario")


def construir_cabeceras(args):
    cabeceras = {"Accept": "application/json"}
    cookie = getattr(args, "cookie", None) or os.environ.get("GIDA_COOKIE")
    if cookie:
        cabeceras["Cookie"] = cookie if "=" in cookie else f"usuario={cookie}"
    client_id = getattr(args, "access_client_id", None) or os.environ.get("CF_ACCESS_CLIENT_ID")
    client_secret = getattr(args, "access_client_secret", None) or os.environ.get("CF_ACCESS_CLIENT_SECRET")
    if client_id and client_secret:
        cabeceras["CF-Access-Client-Id"] = client_id
        cabeceras["CF-Access-Client-Secret"] = client_secret
    return cabeceras


def llamar(args, metodo, ruta, cuerpo=None):
    base = getattr(args, "url", None) or URL_POR_DEFECTO
    url = base.rstrip("/") + ruta
    datos = json.dumps(cuerpo).encode("utf-8") if cuerpo is not None else None
    cabeceras = construir_cabeceras(args)
    if datos:
        cabeceras["Content-Type"] = "application/json"
    peticion = urllib.request.Request(url, data=datos, method=metodo, headers=cabeceras)
    try:
        with urllib.request.urlopen(peticion, timeout=30) as respuesta:
            return respuesta.status, json.loads(respuesta.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as error:
        detalle = error.read().decode("utf-8", "replace").strip()
        try:
            detalle = json.loads(detalle).get("error", detalle)
        except Exception:
            pass
        print(f"ERROR {error.code}: {detalle}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as error:
        print(f"ERROR de conexión con {url}: {error.reason}", file=sys.stderr)
        sys.exit(1)


def comando_listar(args):
    _, respuesta = llamar(args, "GET", "/api/tareas")
    tareas = respuesta.get("tareas", [])
    if args.json:
        print(json.dumps(tareas, ensure_ascii=False, indent=2))
        return
    if not tareas:
        print("(sin tareas)")
        return
    print(f"{'id':<10} {'estado':<10} {'dur':>4}  {'entrega':<16} título")
    for t in tareas:
        print(
            f"{t.get('id',''):<10} {t.get('estado',''):<10} "
            f"{t.get('duracionMin', 0):>4}  {(t.get('entrega') or '-'):<16} {t.get('titulo','')}"
        )


def comando_agregar(args):
    cuerpo = {
        "titulo": args.titulo,
        "materia": args.materia,
        "entrega": args.entrega,
        "duracionMin": args.duracion,
        "padre": args.padre,
        "notas": args.notas,
    }
    _, respuesta = llamar(args, "POST", "/api/tareas", cuerpo)
    tarea = respuesta.get("tarea", {})
    print(f"creada {tarea.get('id')}  {tarea.get('titulo')}  ({tarea.get('duracionMin')} min)")


def comando_borrar(args):
    _, respuesta = llamar(args, "DELETE", f"/api/tareas/{args.id}")
    print(f"borradas {respuesta.get('borradas', 0)} tarea(s); etag {respuesta.get('etag')}")


def main():
    # SUPPRESS evita que los valores por defecto del subcomando pisen los del
    # comando principal (--url antes de la acción debe respetarse).
    comun = argparse.ArgumentParser(add_help=False)
    comun.add_argument("--url", default=argparse.SUPPRESS, help="base del itinerario")
    comun.add_argument("--cookie", default=argparse.SUPPRESS, help="usuario=<id> (modo local)")
    comun.add_argument(
        "--access-client-id", default=argparse.SUPPRESS, help="Client ID del token de servicio"
    )
    comun.add_argument(
        "--access-client-secret", default=argparse.SUPPRESS, help="Client Secret del token"
    )

    parser = argparse.ArgumentParser(
        description="Crear, listar y borrar tareas del Itinerario", parents=[comun]
    )
    sub = parser.add_subparsers(dest="comando", required=True)

    p_listar = sub.add_parser("listar", parents=[comun], help="lista las tareas")
    p_listar.add_argument("--json", action="store_true", help="salida JSON cruda")
    p_listar.set_defaults(func=comando_listar)

    p_agregar = sub.add_parser("agregar", parents=[comun], help="crea una tarea")
    p_agregar.add_argument("--titulo", required=True)
    p_agregar.add_argument("--materia", default=None)
    p_agregar.add_argument("--entrega", default=None, help="AAAA-MM-DDTHH:MM")
    p_agregar.add_argument("--duracion", type=int, default=60, help="minutos (60 por defecto)")
    p_agregar.add_argument("--padre", default=None, help="id de la tarea madre")
    p_agregar.add_argument("--notas", default="")
    p_agregar.set_defaults(func=comando_agregar)

    p_borrar = sub.add_parser("borrar", parents=[comun], help="borra una tarea y sus subtareas")
    p_borrar.add_argument("--id", required=True)
    p_borrar.set_defaults(func=comando_borrar)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
