# Grafo de Código — portal

Generado automáticamente por `herramientas/grafo.mjs`.

## Resumen

- **Nodos:** 30 (funciones y métodos)
- **Aristas totales:** 89
  - **Resueltas:** 46
  - **Dudosas:** 0 (0.0%)
  - **Externas (nativas/DOM/D3):** 43

## Diagrama de Módulos

```mermaid
graph TD
  app_js["app.js"]
  servidor_py["servidor.py"]
  app_js -. "api" .-> servidor_py
```

## Módulos y Funciones

### `app.js`

| Función / Método | Archivo:Línea | Llamada por | Llama a |
|---|---|---|---|
| `construirRutaApp` | `app.js:18` | `configurarTarjetas` (app.js) (L55)<br>`configurarTarjetas` (app.js) (L56) | — |
| `guardarCookieUsuario` | `app.js:23` | `seleccionarUsuario` (app.js) (L129) | — |
| `consultarEstadoServidores` | `app.js:29` | `refrescarEstadoServidores` (app.js) (L80) | `ManejadorPortal.manejar_get_estado` (servidor.py) (L30) *(API GET /api/estado)* |
| `cargarListaUsuarios` | `app.js:38` | `iniciarPortal` (app.js) (L187) | `ManejadorPortal.manejar_get_usuarios` (servidor.py) (L39) *(API GET /api/usuarios)* |
| `cargarUsuarioActivo` | `app.js:46` | `seleccionarUsuario` (app.js) (L131)<br>`iniciarPortal` (app.js) (L188) | `ManejadorPortal.manejar_get_yo` (servidor.py) (L47) *(API GET /api/yo)* |
| `configurarTarjetas` | `app.js:54` | `iniciarPortal` (app.js) (L173) | `construirRutaApp` (app.js) (L55)<br>`construirRutaApp` (app.js) (L56) |
| `actualizarInsigniaEstado` | `app.js:65` | `refrescarEstadoServidores` (app.js) (L81)<br>`refrescarEstadoServidores` (app.js) (L82)<br>`refrescarEstadoServidores` (app.js) (L84)<br>`refrescarEstadoServidores` (app.js) (L85) | — |
| `refrescarEstadoServidores` | `app.js:78` | `iniciarPortal` (app.js) (L189)<br>`iniciarPortal` (app.js) (L198) | `consultarEstadoServidores` (app.js) (L80)<br>`actualizarInsigniaEstado` (app.js) (L81)<br>`actualizarInsigniaEstado` (app.js) (L82)<br>`actualizarInsigniaEstado` (app.js) (L84)<br>`actualizarInsigniaEstado` (app.js) (L85) |
| `renderizarUsuario` | `app.js:90` | `seleccionarUsuario` (app.js) (L133)<br>`iniciarPortal` (app.js) (L178)<br>`iniciarPortal` (app.js) (L183)<br>`iniciarPortal` (app.js) (L195) | `seleccionarUsuario` (app.js) (L122) |
| `seleccionarUsuario` | `app.js:128` | `renderizarUsuario` (app.js) (L122) | `guardarCookieUsuario` (app.js) (L129)<br>`cargarUsuarioActivo` (app.js) (L131)<br>`renderizarUsuario` (app.js) (L133) |
| `conectarTema` | `app.js:137` | `iniciarPortal` (app.js) (L174) | `aplicarTema` (app.js) (L150)<br>`aplicarTema` (app.js) (L154) |
| `iniciarPortal` | `app.js:159` | — | `configurarTarjetas` (app.js) (L173)<br>`conectarTema` (app.js) (L174)<br>`renderizarUsuario` (app.js) (L178)<br>`renderizarUsuario` (app.js) (L183)<br>`cargarListaUsuarios` (app.js) (L187)<br>`cargarUsuarioActivo` (app.js) (L188)<br>`refrescarEstadoServidores` (app.js) (L189)<br>`renderizarUsuario` (app.js) (L195)<br>`refrescarEstadoServidores` (app.js) (L198) |
| `aplicarTema` | `app.js:142` | `conectarTema` (app.js) (L150)<br>`conectarTema` (app.js) (L154) | — |

### `servidor.py`

| Función / Método | Archivo:Línea | Llamada por | Llama a |
|---|---|---|---|
| `generar_id_usuario` | `servidor.py:41` | — | — |
| `validar_usuarios` | `servidor.py:55` | `cargar_usuarios_compartidos` (servidor.py) (L120) | — |
| `cargar_usuarios_compartidos` | `servidor.py:103` | `quien_es` (servidor.py) (L136)<br>`ManejadorPortal.manejar_get_usuarios` (servidor.py) (L360) | `validar_usuarios` (servidor.py) (L120) |
| `quien_es` | `servidor.py:127` | `ManejadorPortal.manejar_get_usuarios` (servidor.py) (L372)<br>`ManejadorPortal.manejar_get_yo` (servidor.py) (L379) | `cargar_usuarios_compartidos` (servidor.py) (L136) |
| `host_consulta_local` | `servidor.py:169` | `verificar_servicio_en_linea` (servidor.py) (L178)<br>`ManejadorPortal.reenviar_a_app` (servidor.py) (L292) | — |
| `verificar_servicio_en_linea` | `servidor.py:176` | `ManejadorPortal.manejar_get_estado` (servidor.py) (L346)<br>`ManejadorPortal.manejar_get_estado` (servidor.py) (L347) | `host_consulta_local` (servidor.py) (L178) |
| `ManejadorPortal.__init__` | `servidor.py:200` | — | — |
| `ManejadorPortal.log_message` | `servidor.py:203` | — | — |
| `ManejadorPortal.enviar_json` | `servidor.py:206` | `ManejadorPortal.do_POST` (servidor.py) (L241)<br>`ManejadorPortal.reenviar_a_app` (servidor.py) (L299)<br>`ManejadorPortal.manejar_get_estado` (servidor.py) (L348)<br>`ManejadorPortal.manejar_get_usuarios` (servidor.py) (L376)<br>`ManejadorPortal.manejar_get_yo` (servidor.py) (L380) | — |
| `ManejadorPortal.do_GET` | `servidor.py:215` | — | `ManejadorPortal.manejar_get_estado` (servidor.py) (L219)<br>`ManejadorPortal.manejar_get_usuarios` (servidor.py) (L223)<br>`ManejadorPortal.manejar_get_yo` (servidor.py) (L227)<br>`ManejadorPortal.reenviar_a_app` (servidor.py) (L230) |
| `ManejadorPortal.do_HEAD` | `servidor.py:235` | — | `ManejadorPortal.reenviar_a_app` (servidor.py) (L236) |
| `ManejadorPortal.do_POST` | `servidor.py:239` | — | `ManejadorPortal.reenviar_a_app` (servidor.py) (L240)<br>`ManejadorPortal.enviar_json` (servidor.py) (L241) |
| `ManejadorPortal.app_de_ruta` | `servidor.py:245` | `ManejadorPortal.reenviar_a_app` (servidor.py) (L257) | — |
| `ManejadorPortal.reenviar_a_app` | `servidor.py:252` | `ManejadorPortal.do_GET` (servidor.py) (L230)<br>`ManejadorPortal.do_HEAD` (servidor.py) (L236)<br>`ManejadorPortal.do_POST` (servidor.py) (L240) | `ManejadorPortal.app_de_ruta` (servidor.py) (L257)<br>`host_consulta_local` (servidor.py) (L292)<br>`ManejadorPortal.enviar_json` (servidor.py) (L299) |
| `ManejadorPortal.manejar_get_estado` | `servidor.py:345` | `ManejadorPortal.do_GET` (servidor.py) (L219)<br>`consultarEstadoServidores` (app.js) (L30) | `verificar_servicio_en_linea` (servidor.py) (L346)<br>`verificar_servicio_en_linea` (servidor.py) (L347)<br>`ManejadorPortal.enviar_json` (servidor.py) (L348) |
| `ManejadorPortal.manejar_get_usuarios` | `servidor.py:359` | `ManejadorPortal.do_GET` (servidor.py) (L223)<br>`cargarListaUsuarios` (app.js) (L39) | `cargar_usuarios_compartidos` (servidor.py) (L360)<br>`quien_es` (servidor.py) (L372)<br>`ManejadorPortal.enviar_json` (servidor.py) (L376) |
| `ManejadorPortal.manejar_get_yo` | `servidor.py:378` | `ManejadorPortal.do_GET` (servidor.py) (L227)<br>`cargarUsuarioActivo` (app.js) (L47) | `quien_es` (servidor.py) (L379)<br>`ManejadorPortal.enviar_json` (servidor.py) (L380) |

