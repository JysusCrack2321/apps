# Arquitectura de Project Organizer

Documento de referencia técnica sobre el funcionamiento interno de Project Organizer, su flujo de datos, modelo jerárquico (EDT/Gantt), algoritmos de agregación, servidor y despliegue de producción.

---

## 1. Flujo de datos

| Componente | Archivo y línea | Responsabilidad y comportamiento |
|---|---|---|
| **Residencia del estado** | [`comun/app.js` (L17–L45)](file:///home/jysusman/apps/project-organizer/comun/app.js#L17-L45) | El estado en memoria vive en un objeto `estado` mutable a nivel de módulo: `{ datos, manejador, nombreArchivo, historial, futuro, sinGuardar, estadoGuardado, temporizadorAutoguardado, intervaloAutoguardadoMs, eventSource, cambioExternoPendiente, edicionesDuranteCambio, recargasExternas, filtros, seleccion, pestana, modelo, vista, editor, usuarioActual, usuariosCompartidos }`. El `ETag` de la última respuesta se conserva en [`comun/archivo.js` (L9–L21)](file:///home/jysusman/apps/project-organizer/comun/archivo.js#L9-L21). |
| **Carga inicial** | [`comun/app.js` (L83–L107)](file:///home/jysusman/apps/project-organizer/comun/app.js#L83-L107)<br>[`comun/archivo.js` (L37–L70)](file:///home/jysusman/apps/project-organizer/comun/archivo.js#L37-L70) | Al arrancar, `cargarInicial()` solicita `GET /datos.json` (que devuelve `guardados/actual.json` y su `ETag`). Si el servidor responde 200, guarda el `ETag`, valida el JSON mediante `validar(datos)` y lo monta. Si falla o no hay datos, muestra la pantalla de inicio (`mostrarPantallaInicio()`, L152–L295). |
| **Carga de versiones previas** | [`comun/app.js` (L1092–L1184)](file:///home/jysusman/apps/project-organizer/comun/app.js#L1092-L1184)<br>[`comun/archivo.js` (L143–L172)](file:///home/jysusman/apps/project-organizer/comun/archivo.js#L143-L172) | Al pulsar "Abrir...", `listarGuardadosServidor()` consulta `GET /api/guardados` (que incluye `actual.json`, `respaldo.json`, los `datos<N>.json` históricos y `datos.json` base). Al seleccionar uno, lo pide mediante `GET /api/guardados/<nombre>` y lo carga. |
| **Mutaciones y autoguardado (B2)** | [`comun/app.js` (L708–L715, L975–L1047)](file:///home/jysusman/apps/project-organizer/comun/app.js#L975-L1047) | Todas las mutaciones (`aplicar`, `deshacer`, `rehacer`) actualizan el historial, reconstruyen `M.construir()`, guardan el borrador en `localStorage`, muestran `"Sin guardar…"` en la cabecera y llaman a `programarAutoguardado()` (debounce de 1 s). El botón `"Guardar ahora"` (`guardar()`) ejecuta `guardarInmediato()` sin esperar el debounce. Al confirmar el servidor con `200 OK`, se borra el borrador de `localStorage` (`A.borrarBorrador()`). |
| **Persistencia en servidor** | [`comun/archivo.js` (L181–L222)](file:///home/jysusman/apps/project-organizer/comun/archivo.js#L181-L222)<br>[`servidor.py` (L193–L214)](file:///home/jysusman/apps/project-organizer/servidor.py#L193-L214) | `guardarEnServidor(datos, etagForzado)` envía `POST /api/guardar` con `If-Match: <etag>`. El servidor valida `If-Match` (`428` si falta, `409` si cambió), actualiza `guardados/respaldo.json` si no existe o supera `INTERVALO_RESPALDO` (300 s), y sobrescribe atómicamente `guardados/actual.json`, devolviendo el nuevo `ETag`. |
| **Persistencia local (fallback)** | [`comun/archivo.js` (L228–L288)](file:///home/jysusman/apps/project-organizer/comun/archivo.js#L228-L288) | Si no hay servidor compatible, `"Guardar ahora"` y `"Guardar como…"` utilizan la File System Access API (`window.showSaveFilePicker`) si está disponible, o fuerzan la descarga en el navegador mediante un enlace `Blob` temporal. |
| **Control de conflictos 409 y sincronización SSE (B2)** | [`comun/app.js` (L814–L972)](file:///home/jysusman/apps/project-organizer/comun/app.js#L814-L972)<br>[`comun/modelo.js` (L1035–L1044)](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L1035-L1044) | `conectarEventosServidor()` escucha `GET /api/eventos`. Al recibir `event: cambio`, si `!M.esEcoPropio(etagEvento, A.obtenerUltimoEtag())`, recarga desde `/datos.json` conservando selección, pestaña, instancia de vista e historial. Si el usuario está escribiendo en un campo del editor (`estaEditandoCampo()`), pospone la recarga hasta que salga del campo (`blur` o `Enter`) y reaplica el texto escrito. Al reconectar tras un corte (`onopen` tras `onerror`), revalida el `ETag`. Si `POST /api/guardar` responde `409`, `mostrarBannerConflicto(etagActual)` ofrece `"Cargar lo del otro"` y `"Mantener lo mío"` (que reintenta con `etagActual`). |
| **Filtros unificados (B3), vista Cohete y soporte celular (B4)** | [`comun/modelo.js` (L1080–L1185)](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L1080-L1185)<br>[`comun/app.js` (L415–L490, L615–L660)](file:///home/jysusman/apps/project-organizer/comun/app.js#L415-L490)<br>[`vistas/cohete.js` (L1–L1060)](file:///home/jysusman/apps/project-organizer/vistas/cohete.js#L1-L1060) | `M.filtrarModelo(modelo, filtros)` es una función pura que filtra por `responsable`, `estado`, `tipo` (`tarea` / `entregable`), `fecha` (`modoFecha: 'fin'` o `'activa'`) y `texto`, conservando ancestros sin recalcular `codigo`, `avance`, `inicio` ni `fin`. La barra única de filtros alimenta las 4 vistas (`EDT`, `Gantt`, `Tabla`, `Cohete`), mientras el editor sigue recibiendo el `estado.modelo` completo. En celular: `vistas/edt.js` incluye botón táctil `(+/−)` en nodos con hijos, `vistas/gantt.js` usa `pointerdown`/`pointerup` (< 6 px selecciona o pliega en zona de 36 px) y `comun/estilos.css` adapta el editor a pantallas de 390 px. |

---

## 2. Modelo de datos de `datos.json`

Ubicación del contrato y validaciones: [`comun/modelo.js` L142–L385](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L142-L385).

### Esquema y Entidades

```json
{
  "version": 1,
  "proyecto": {
    "nombre": "Nombre del proyecto",
    "descripcion": ""
  },
  "equipo": ["Persona 1", "Persona 2"],
  "actividades": [
    {
      "id": "a1b2",
      "padre": null,
      "orden": 1,
      "nombre": "Fase 1: Concepción",
      "responsable": "",
      "notas": ""
    },
    {
      "id": "c3d4",
      "padre": "a1b2",
      "orden": 1,
      "nombre": "Definir requerimientos",
      "tipo": "entregable",
      "responsable": "Persona 1",
      "inicio": "2026-10-19",
      "fin": "2026-10-19",
      "estado": "en curso",
      "notas": ""
    }
  ],
  "hitos": [
    {
      "id": "h1a2",
      "nombre": "Entrega de informe",
      "inicio": "2026-10-20",
      "fin": "2026-10-20",
      "responsable": ""
    }
  ]
}
```

### Reglas de negocio y relaciones

1. **Jerarquía EDT (`actividades`):**
   * Relación reflexiva de árbol 1:N mediante el campo `padre` (contiene el `id` del contenedor o `null` si está en la raíz del proyecto).
   * Detección estricta de ciclos mediante DFS en [`comun/modelo.js` L322–L340](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L322-L340).
   * El orden visual y secuencial entre hermanos se define por el entero `orden` (L251), renormalizado tras inserciones o reubicaciones (`establecerOrden`, L72–L77).
2. **Regla estricta Hoja vs. Contenedor y campo `tipo` (`tarea` | `entregable`):**
   * Las fechas (`inicio`, `fin`), el `estado` y el `tipo` (`"tarea"` por defecto o `"entregable"`) **solo están permitidos en actividades hoja** (sin hijos) ([`comun/modelo.js` L299–L325](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L299-L325)).
   * Si una actividad hoja recibe un hijo mediante `agregarActividad()`, sus atributos `inicio`, `fin`, `estado` y `tipo` se eliminan inmediatamente (`delete a.inicio; delete a.fin; delete a.estado; delete a.tipo;`).
   * Las actividades hoja con `tipo: "entregable"` (`M.esEntregable(a)`) son nodos hoja normales del EDT que llevan la insignia `📦 Entregable` en las vistas EDT, Tabla y Cohete.
3. **Integridad del equipo (`equipo`):**
   * El campo `responsable` de actividades e hitos debe coincidir con un elemento del arreglo `equipo` o ser cadena vacía (L265–L271).
   * Al actualizar el equipo con `actualizarEquipo()` ([`comun/modelo.js` L1010–L1025](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L1010-L1025)), los cambios de nombre se propagan automáticamente a las actividades asociadas, y los miembros eliminados quedan desasignados.
4. **Hitos y periodos (`hitos`):**
   * Los hitos son entidades planas independientes de la jerarquía de actividades.
   * `inicio` y `fin` son obligatorios. Si `inicio === fin` representa un hito puntual (rombo en Gantt); si `fin > inicio` representa un periodo destacado (franja coloreada) ([`vistas/gantt.js` L480–L510](file:///home/jysusman/apps/project-organizer/vistas/gantt.js#L480-L510)).
5. **Dependencias y ruta crítica:**
   * **NO EXISTEN en el modelo de datos.** No hay campos para dependencias (tipo fin a inicio, predecesoras o sucesoras).

---

## 3. Algoritmos clave

### A. Numeración de códigos de la EDT
Ubicación: [`comun/modelo.js` L450–L467](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L450-L467).

* En `construir(datos)`, se ordenan los nodos hijos de cada padre según `orden` numérico con desempate por su índice original en el arreglo (L440–L448).
* Se ejecuta un recorrido recursivo en preorden (`recorrer(nodo, codigoPadre, nivel)`):
  * La raíz (`proyecto`) tiene nivel 0 y código vacío `""`.
  * Los hijos directos de la raíz (nivel 1) reciben `"1"`, `"2"`, `"3"`...
  * Cada nivel sucesivo concatena su posición 1-indexada: `${codigoPadre}.${i + 1}` (ej. `"1.1"`, `"1.2.3"`).
  * Este código se recalcula dinámicamente en tiempo de ejecución cada vez que se llama a `construir()`; nunca se guarda en el JSON para evitar inconsistencias.

### B. Cálculo del Gantt (fechas y avance acumulado)
Ubicación: [`comun/modelo.js` L469–L536](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L469-L536).

1. **Rollup de fechas en actividades padre:**
   * Algoritmo postorden `calcularFechas(nodo)` (L488–L501).
   * Para cada contenedor:
     $$\text{padre.inicio} = \min_{h \in \text{hijos con fecha}}(\text{h.inicio})$$
     $$\text{padre.fin} = \max_{h \in \text{hijos con fecha}}(\text{h.fin})$$
   * Si ninguna hoja descendiente tiene fechas, el padre permanece con `inicio: undefined, fin: undefined`.
2. **Cálculo de avance:**
   * Algoritmo postorden `calcularAvance(nodo)` (L470–L485).
   * En hojas: `avance = 1` si `estado === 'hecha'`, en caso contrario `0`.
   * En contenedores: promedio aritmético simple de **todas** sus hojas descendientes:
     $$\text{avance} = \frac{\sum \text{avance de hojas descendientes}}{\text{total de hojas descendientes}}$$
3. **Rango global del proyecto:**
   * Determina el menor `inicio` y mayor `fin` entre todas las hojas con fechas y los hitos existentes (L507–L525).
4. **Dependencias y ruta crítica:**
   * **Inexistentes.** El Gantt se limita a proyectar barras temporales en canvas con base en las fechas explícitas de las hojas. No calcula holguras libres ni ruta crítica.

### C. Sincronización y filtrado entre las cuatro vistas (EDT, Gantt, Tabla, Cohete)
Ubicación: [`comun/app.js` L600–L740](file:///home/jysusman/apps/project-organizer/comun/app.js#L600-L740), [`comun/modelo.js` L1080–L1185](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L1080-L1185) y [`vistas/cohete.js`](file:///home/jysusman/apps/project-organizer/vistas/cohete.js).

* **Patrón Mediador Unidireccional con Filtrado Puro:**
  ```text
  [datos.json] ──► M.construir(datos) ──► estado.modelo (completo)
                                                 │
                                    M.filtrarModelo(modelo, filtros)
                                                 │
          ┌──────────────────────┬───────────────┴───────────────┬──────────────────────┐
          ▼                      ▼                               ▼                      ▼
   vistas/edt.js          vistas/gantt.js                 vistas/tabla.js        vistas/cohete.js
          │                      │                               │                      │
          └──────────────────────┴─────── alSeleccionar(id) ─────┴──────────────────────┘
                                                 │
                                                 ▼
                               comun/editor.js (recibe modelo completo)
                                                 │ aplicar(f)
                                                 ▼
                               comun/app.js (historial + autoguardado 1 s)
  ```
* Cada vista expone la interfaz `crearVista(contenedor, opciones)` $\rightarrow$ `{ mostrar(modelo, seleccionId), destruir() }`.
* En [`vistas/cohete.js`](file:///home/jysusman/apps/project-organizer/vistas/cohete.js), las 7 partes físicas del cohete (`Ojiva`, `Fuselaje superior`, `Carga útil`, `Acople + Aviónica`, `Fuselaje inferior + Aletas`, `Paracaídas`, `Soporte del motor`) más los 2 iconos inferiores de competencia (`Documentación` y `Redes y Videos`) mapean directamente a las secciones raíz del EDT y muestran en una sola lista unificada tanto tareas como `📦 Entregable` (por sección o en modo `"Ver todos"`), sincronizando el filtro por fecha (`Todas las fechas`, `📅 Lunes 19/10`, `Se entregan el…` / `Activas el…`, `<input type="date">`) con la barra superior.
* `actualizarVistaYEditor()` entrega `M.filtrarModelo(estado.modelo, estado.filtros)` a la vista activa y el `estado.modelo` completo sin filtrar a `estado.editor.mostrar(estado.modelo, estado.seleccion)`.

---

## 4. Servidor y despliegue en producción

Ubicación: [`servidor.py`](file:///home/jysusman/apps/project-organizer/servidor.py) y [`Docs/project-organizer/02-servicio-y-tunel-cloudflare.md`](file:///home/jysusman/apps/project-organizer/Docs/project-organizer/02-servicio-y-tunel-cloudflare.md).

### Rutas del servidor HTTP (`servidor.py`)

El servidor ejecuta `ServidorProjectOrganizer` (`ThreadingHTTPServer` con `daemon_threads = True`) y al iniciar garantiza que exista `guardados/actual.json` copiando el archivo más reciente entre `guardados/datos<N>.json` y `datos.json` de la raíz (sin modificar ni borrar los archivos históricos).

| Método | Ruta | Código | Comportamiento |
|---|---|---|---|
| `GET` | `/datos.json` | 200 / 404 | Devuelve `guardados/actual.json` con el encabezado `ETag` (`st_mtime_ns` entre comillas). Si aún no existe `actual.json`, lo inicializa desde el `datos<N>.json` más reciente o `datos.json`. |
| `POST` | `/api/guardar` | 200 / 400 / 409 / 428 | Exige `If-Match` (`428` si falta; `409` con `etagActual` si no coincide con el `ETag` de `actual.json`). Valida el cuerpo (límite 10 MB, claves `proyecto` y `actividades`). Copia `actual.json` a `guardados/respaldo.json` solo si `respaldo.json` no existe o tiene antigüedad $\ge$ `INTERVALO_RESPALDO` (`300 s`), y sobrescribe atómicamente `guardados/actual.json` devolviendo el nuevo `ETag`. |
| `GET` | `/api/guardados` | 200 | Lista metadatos de `actual.json`, `respaldo.json`, las versiones históricas `guardados/datos<N>.json` y `datos.json` base. |
| `GET` | `/api/guardados/<nombre>` | 200 / 404 | Entrega el contenido JSON de `actual.json`, `respaldo.json`, `datos<N>.json` o `datos.json`. |
| `GET` | `/api/eventos` | 200 | Stream Server-Sent Events (`Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`, `flush` tras cada escritura). Emite `event: cambio` con `{"etag": ...}` cuando cambia `actual.json` y `: ping` periódicamente. |
| `GET` | `/api/yo` | 200 | Devuelve `{ id, nombre, rol }` del usuario activo (`quien_es(peticion)`) o `null`. |
| `GET` | `/api/usuarios` | 200 | Lista los usuarios compartidos de `~/apps/usuarios.json`. |
| `GET` | `/guardados/*` | 403 | Bloquea acceso directo para forzar el paso por la API. |
| `GET` | `/*` | 200 / 404 | Sirve archivos estáticos (`index.html`, `comun/*`, `vistas/*`, `herramientas/*`) mediante `SimpleHTTPRequestHandler`. |

### Despliegue en producción (Orange Pi Zero 3)

1. **Servicio local (`systemd` de usuario):**
   * Unidad: `~/.config/systemd/user/project-organizer.service`.
   * Comando: `/usr/bin/python3 servidor.py 8088 --bind 127.0.0.1`.
   * Solo escucha en loopback local (`127.0.0.1`), impidiendo accesos directos desde la LAN o WAN.
2. **Túnel de Cloudflare (`cloudflared`):**
   * Unidad: `~/.config/systemd/user/project-organizer-tunnel.service`.
   * Comando: `cloudflared tunnel --no-autoupdate run edt`.
   * Mantiene una conexión saliente permanente y cifrada (QUIC / HTTP/2) hacia los edge servers de Cloudflare. No requiere abrir puertos en el router residencial ni usar DDNS.
3. **Publicación y Seguridad:**
   * Dominio: `https://edt.gida.lat` (DNS gestionado en Cloudflare, CNAME apuntando al túnel `5290c16f-0a9b-4224-a654-bd087d91c8bf`).
   * Capa de autenticación: **Cloudflare Zero Trust Access** (`summer-sea-d4a8.cloudflareaccess.com`). Todo acceso a `edt.gida.lat` exige autenticación previa con Google OAuth o PIN de un solo uso por correo antes de enrutar el tráfico al túnel.

---

## 5. Limitaciones y deudas técnicas

1. **Dependencia externa de CDN en tiempo de ejecución:**
   * [`vistas/edt.js` (L6)](file:///home/jysusman/apps/project-organizer/vistas/edt.js#L6) importa D3 mediante `import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm'`. Si el usuario pierde conexión a internet o la CDN experimenta latencia/bloqueo, la vista EDT falla completamente.
2. **Modelo temporal simplista sin dependencias:**
   * No existe modelado de dependencias entre tareas ni holguras. Las fechas en actividades padre son meramente agregaciones min/max de sus hojas, lo que impide detectar cuellos de botella o calcular rutas críticas.
3. **Avance discreto no ponderado en hojas:**
   * Una hoja solo puede tener avance 0% o 100% (`estado === 'hecha'`). No admite avances porcentuales continuos (ej. 45%), y el avance del padre es un promedio no ponderado (no considera la duración en días de cada hoja).


