# Grafo de Código — portal

Generado automáticamente por `herramientas/grafo.mjs`.

## Resumen

- **Nodos:** 26 (funciones y métodos)
- **Aristas totales:** 81
  - **Resueltas:** 38
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
| `construirUrlApp` | `app.js:17` | `configurarTarjetas` (app.js) (L56)<br>`configurarTarjetas` (app.js) (L57) | — |
| `guardarCookieUsuario` | `app.js:24` | `seleccionarUsuario` (app.js) (L130) | — |
| `consultarEstadoServidores` | `app.js:30` | `refrescarEstadoServidores` (app.js) (L81) | `ManejadorPortal.manejar_get_estado` (servidor.py) (L31) *(API GET /api/estado)* |
| `cargarListaUsuarios` | `app.js:39` | `iniciarPortal` (app.js) (L188) | `ManejadorPortal.manejar_get_usuarios` (servidor.py) (L40) *(API GET /api/usuarios)* |
| `cargarUsuarioActivo` | `app.js:47` | `seleccionarUsuario` (app.js) (L132)<br>`iniciarPortal` (app.js) (L189) | `ManejadorPortal.manejar_get_yo` (servidor.py) (L48) *(API GET /api/yo)* |
| `configurarTarjetas` | `app.js:55` | `iniciarPortal` (app.js) (L174) | `construirUrlApp` (app.js) (L56)<br>`construirUrlApp` (app.js) (L57) |
| `actualizarInsigniaEstado` | `app.js:66` | `refrescarEstadoServidores` (app.js) (L82)<br>`refrescarEstadoServidores` (app.js) (L83)<br>`refrescarEstadoServidores` (app.js) (L85)<br>`refrescarEstadoServidores` (app.js) (L86) | — |
| `refrescarEstadoServidores` | `app.js:79` | `iniciarPortal` (app.js) (L190)<br>`iniciarPortal` (app.js) (L199) | `consultarEstadoServidores` (app.js) (L81)<br>`actualizarInsigniaEstado` (app.js) (L82)<br>`actualizarInsigniaEstado` (app.js) (L83)<br>`actualizarInsigniaEstado` (app.js) (L85)<br>`actualizarInsigniaEstado` (app.js) (L86) |
| `renderizarUsuario` | `app.js:91` | `seleccionarUsuario` (app.js) (L134)<br>`iniciarPortal` (app.js) (L179)<br>`iniciarPortal` (app.js) (L184)<br>`iniciarPortal` (app.js) (L196) | `seleccionarUsuario` (app.js) (L123) |
| `seleccionarUsuario` | `app.js:129` | `renderizarUsuario` (app.js) (L123) | `guardarCookieUsuario` (app.js) (L130)<br>`cargarUsuarioActivo` (app.js) (L132)<br>`renderizarUsuario` (app.js) (L134) |
| `conectarTema` | `app.js:138` | `iniciarPortal` (app.js) (L175) | `aplicarTema` (app.js) (L151)<br>`aplicarTema` (app.js) (L155) |
| `iniciarPortal` | `app.js:160` | — | `configurarTarjetas` (app.js) (L174)<br>`conectarTema` (app.js) (L175)<br>`renderizarUsuario` (app.js) (L179)<br>`renderizarUsuario` (app.js) (L184)<br>`cargarListaUsuarios` (app.js) (L188)<br>`cargarUsuarioActivo` (app.js) (L189)<br>`refrescarEstadoServidores` (app.js) (L190)<br>`renderizarUsuario` (app.js) (L196)<br>`refrescarEstadoServidores` (app.js) (L199) |
| `aplicarTema` | `app.js:143` | `conectarTema` (app.js) (L151)<br>`conectarTema` (app.js) (L155) | — |

### `servidor.py`

| Función / Método | Archivo:Línea | Llamada por | Llama a |
|---|---|---|---|
| `generar_id_usuario` | `servidor.py:26` | — | — |
| `validar_usuarios` | `servidor.py:40` | `cargar_usuarios_compartidos` (servidor.py) (L105) | — |
| `cargar_usuarios_compartidos` | `servidor.py:88` | `quien_es` (servidor.py) (L121)<br>`ManejadorPortal.manejar_get_usuarios` (servidor.py) (L230) | `validar_usuarios` (servidor.py) (L105) |
| `quien_es` | `servidor.py:112` | `ManejadorPortal.manejar_get_yo` (servidor.py) (L243) | `cargar_usuarios_compartidos` (servidor.py) (L121) |
| `host_consulta_local` | `servidor.py:153` | `verificar_servicio_en_linea` (servidor.py) (L162) | — |
| `verificar_servicio_en_linea` | `servidor.py:160` | `ManejadorPortal.manejar_get_estado` (servidor.py) (L216)<br>`ManejadorPortal.manejar_get_estado` (servidor.py) (L217) | `host_consulta_local` (servidor.py) (L162) |
| `ManejadorPortal.__init__` | `servidor.py:183` | — | — |
| `ManejadorPortal.log_message` | `servidor.py:186` | — | — |
| `ManejadorPortal.enviar_json` | `servidor.py:189` | `ManejadorPortal.manejar_get_estado` (servidor.py) (L218)<br>`ManejadorPortal.manejar_get_usuarios` (servidor.py) (L240)<br>`ManejadorPortal.manejar_get_yo` (servidor.py) (L244) | — |
| `ManejadorPortal.do_GET` | `servidor.py:198` | — | `ManejadorPortal.manejar_get_estado` (servidor.py) (L202)<br>`ManejadorPortal.manejar_get_usuarios` (servidor.py) (L206)<br>`ManejadorPortal.manejar_get_yo` (servidor.py) (L210) |
| `ManejadorPortal.manejar_get_estado` | `servidor.py:215` | `ManejadorPortal.do_GET` (servidor.py) (L202)<br>`consultarEstadoServidores` (app.js) (L31) | `verificar_servicio_en_linea` (servidor.py) (L216)<br>`verificar_servicio_en_linea` (servidor.py) (L217)<br>`ManejadorPortal.enviar_json` (servidor.py) (L218) |
| `ManejadorPortal.manejar_get_usuarios` | `servidor.py:229` | `ManejadorPortal.do_GET` (servidor.py) (L206)<br>`cargarListaUsuarios` (app.js) (L40) | `cargar_usuarios_compartidos` (servidor.py) (L230)<br>`ManejadorPortal.enviar_json` (servidor.py) (L240) |
| `ManejadorPortal.manejar_get_yo` | `servidor.py:242` | `ManejadorPortal.do_GET` (servidor.py) (L210)<br>`cargarUsuarioActivo` (app.js) (L48) | `quien_es` (servidor.py) (L243)<br>`ManejadorPortal.enviar_json` (servidor.py) (L244) |

