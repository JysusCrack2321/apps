#!/usr/bin/env python3
"""Pide código a DeepSeek a partir de archivos de contexto.

Uso:
  python herramientas/deepseek.py --tarea tarea.md --contexto ESPECIFICACION.md otro.js --salida comun/modelo.js

La clave se lee de ~/.config/deepseek/api_key y nunca se imprime.
La respuesta completa se guarda en herramientas/registro/ para revisión.
"""
import argparse, json, pathlib, re, sys, time, urllib.request

CLAVE = pathlib.Path.home() / '.config/deepseek/api_key'
URL = 'https://api.deepseek.com/chat/completions'
RAIZ = pathlib.Path(__file__).resolve().parent.parent
REGISTRO = RAIZ / 'herramientas/registro'

SISTEMA = """Eres un desarrollador frontend experto en JavaScript moderno (módulos ES, sin frameworks).
Escribes código claro, correcto y completo, en español (nombres y comentarios breves), siguiendo
exactamente el contrato que se te da. No inventas funciones fuera del contrato salvo ayudantes internos
no exportados. Respondes SOLO con el contenido del archivo pedido dentro de un único bloque de código."""


def saldo(clave):
    """Saldo en USD de la cuenta, o None si no se pudo consultar."""
    try:
        req = urllib.request.Request('https://api.deepseek.com/user/balance', headers={'Authorization': f'Bearer {clave}'})
        info = json.load(urllib.request.urlopen(req, timeout=20))['balance_infos']
        return sum(float(b['total_balance']) for b in info if b['currency'] == 'USD')
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tarea', required=True, help='archivo .md con la instrucción')
    ap.add_argument('--contexto', nargs='*', default=[], help='archivos que se adjuntan como contexto')
    ap.add_argument('--salida', required=True, help='archivo donde se escribe el código')
    ap.add_argument('--modelo', default='deepseek-v4-pro')
    ap.add_argument('--esfuerzo', choices=['low', 'high', 'max'], default='high', help='nivel de razonamiento')
    a = ap.parse_args()

    partes = []
    for c in a.contexto:
        p = RAIZ / c
        partes.append(f'### Archivo de contexto: {c}\n```\n{p.read_text(encoding="utf-8")}\n```')
    partes.append('### Tarea\n' + (RAIZ / a.tarea).read_text(encoding='utf-8'))
    cuerpo = {
        'model': a.modelo,
        'messages': [{'role': 'system', 'content': SISTEMA}, {'role': 'user', 'content': '\n\n'.join(partes)}],
        'temperature': 0.2,
        'max_tokens': 128000,
        'stream': True,
        'stream_options': {'include_usage': True},
        'reasoning_effort': a.esfuerzo,
    }
    clave = CLAVE.read_text().strip()
    saldo0 = saldo(clave)
    req = urllib.request.Request(URL, data=json.dumps(cuerpo).encode(), method='POST',
                                 headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {clave}'})
    t0 = time.time()
    texto, pensado, uso, ultimo, fin = [], 0, {}, 0.0, None
    with urllib.request.urlopen(req, timeout=900) as r:
        for linea in r:
            linea = linea.decode('utf-8').strip()
            if not linea.startswith('data:'):
                continue
            dato = linea[5:].strip()
            if dato == '[DONE]':
                break
            ev = json.loads(dato)
            uso = ev.get('usage') or uso
            for ch in ev.get('choices', []):
                delta = ch.get('delta', {})
                pensado += len(delta.get('reasoning_content') or '')
                fin = ch.get('finish_reason') or fin
                texto.append(delta.get('content') or '')
            ahora = time.time()
            if ahora - ultimo > 2:                      # progreso cada ~2 s, en la misma línea
                ultimo = ahora
                escrito = sum(len(t) for t in texto)
                print(f'\r  {ahora - t0:5.0f} s · pensando {pensado:6d} car · escribiendo {escrito:6d} car',
                      end='', file=sys.stderr, flush=True)
    print(file=sys.stderr)
    texto = ''.join(texto)

    REGISTRO.mkdir(parents=True, exist_ok=True)
    marca = time.strftime('%Y%m%d-%H%M%S')
    (REGISTRO / f'{marca}_{pathlib.Path(a.salida).name}.md').write_text(texto, encoding='utf-8')

    if fin != 'stop':
        sys.exit(f'Respuesta incompleta (finish_reason={fin}); ver herramientas/registro/.')
    bloques = re.findall(r'```[a-zA-Z]*\n(.*?)```', texto, re.S)
    if not bloques:
        sys.exit('La respuesta no trae un bloque de código (ver herramientas/registro/).')
    destino = RAIZ / a.salida
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(max(bloques, key=len).rstrip() + '\n', encoding='utf-8')
    print(f'{a.salida}: {len(max(bloques, key=len).splitlines())} líneas · {time.time() - t0:.0f} s · '
          f'tokens entrada {uso.get("prompt_tokens")} / salida {uso.get("completion_tokens")} '
          f'(razonamiento {(uso.get("completion_tokens_details") or {}).get("reasoning_tokens")})')
    time.sleep(3)
    saldo1 = saldo(clave)
    if saldo0 is not None and saldo1 is not None:
        print(f'costo ≈ USD {saldo0 - saldo1:.3f} · saldo USD {saldo1:.2f}  (el saldo puede tardar en actualizarse)')


if __name__ == '__main__':
    main()
