# Grafo de Código — mini-proyecto

Generado automáticamente por `herramientas/grafo.mjs`.

## Resumen

- **Nodos:** 9 (funciones y métodos)
- **Aristas totales:** 17
  - **Resueltas:** 11
  - **Dudosas:** 3 (21.4%)
  - **Externas (nativas/DOM/D3):** 3

## Diagrama de Módulos

```mermaid
graph TD
  cliente_js["cliente.js"]
  matematicas_js["matematicas.js"]
  modulo_contexto_js["modulo_contexto.js"]
  servidor_py["servidor.py"]
  cliente_js --> matematicas_js
  cliente_js --> modulo_contexto_js
  cliente_js -. "api" .-> servidor_py
  modulo_contexto_js --> matematicas_js
```

## Módulos y Funciones

### `cliente.js`

| Función / Método | Archivo:Línea | Llamada por | Llama a |
|---|---|---|---|
| `accionInterna` | `cliente.js:4` | `procesarDatos` (cliente.js) (L18) | — |
| `procesarDatos` | `cliente.js:8` | — | `ManejadorServidor.manejar_saludo_get` (servidor.py) (L24) *(API GET /api/saludo)*<br>`ManejadorServidor.manejar_saludo_post` (servidor.py) (L27) *(API POST /api/saludo)*<br>`sumar` (matematicas.js) (L10)<br>`matematicas.js:Calculadora` (L13) *(dudosa)*<br>`calc.acumular` (L14) *(dudosa)*<br>`accionInterna` (cliente.js) (L18)<br>`ejecutarOperacion` (modulo_contexto.js) (L21)<br>`llamadaMisteriosa` (L33) *(dudosa)* |

### `matematicas.js`

| Función / Método | Archivo:Línea | Llamada por | Llama a |
|---|---|---|---|
| `Calculadora.acumular` | `matematicas.js:10` | — | `sumar` (matematicas.js) (L11) |
| `sumar` | `matematicas.js:1` | `procesarDatos` (cliente.js) (L10)<br>`Calculadora.acumular` (matematicas.js) (L11)<br>`ejecutarOperacion` (modulo_contexto.js) (L2) | — |

### `modulo_contexto.js`

| Función / Método | Archivo:Línea | Llamada por | Llama a |
|---|---|---|---|
| `ejecutarOperacion` | `modulo_contexto.js:1` | `procesarDatos` (cliente.js) (L21) | `sumar` (matematicas.js) (L2) |

### `servidor.py`

| Función / Método | Archivo:Línea | Llamada por | Llama a |
|---|---|---|---|
| `ManejadorServidor.do_GET` | `servidor.py:5` | — | `ManejadorServidor.manejar_saludo_get` (servidor.py) (L7) |
| `ManejadorServidor.do_POST` | `servidor.py:10` | — | `ManejadorServidor.manejar_saludo_post` (servidor.py) (L12) |
| `ManejadorServidor.manejar_saludo_get` | `servidor.py:15` | `ManejadorServidor.do_GET` (servidor.py) (L7)<br>`procesarDatos` (cliente.js) (L24) | — |
| `ManejadorServidor.manejar_saludo_post` | `servidor.py:20` | `ManejadorServidor.do_POST` (servidor.py) (L12)<br>`procesarDatos` (cliente.js) (L27) | — |

