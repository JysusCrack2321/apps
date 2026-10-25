# Índice Maestro de Funciones

Índice exhaustivo de las funciones y clases exportadas en **Project Organizer** e **Itinerario App**.
Diseñado para que cualquier agente o desarrollador pueda comprender la anatomía y llamadas del sistema leyendo únicamente este documento.

---

## 1. Project Organizer (`~/apps/project-organizer`)

### Módulo `comun/modelo.js` (Lógica pura, sin DOM)

| Archivo:Línea | Entradas | Salida | Efectos (¿Muta, guarda, dibuja?) | Quién la llama |
|---|---|---|---|---|
| [`comun/modelo.js:11`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L11) `esFecha(texto)` | `texto: any` | `boolean` | **Pura:** sin efectos secundarios. Valida formato `AAAA-MM-DD` y días válidos por mes/año bisiesto. | `validar()` (L279, L358), `comun/editor.js` (L333), pruebas. |
| [`comun/modelo.js:24`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L24) `diasEntre(inicio, fin)` | `inicio: string, fin: string` (`AAAA-MM-DD`) | `number` | **Pura:** calcula la cantidad de días inclusivos en UTC (`(fin - inicio) + 1`). | `vistas/tabla.js` (L158), `vistas/gantt.js` (L110), pruebas. |
| [`comun/modelo.js:32`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L32) `sumarDias(fecha, n)` | `fecha: string, n: number` | `string` (`AAAA-MM-DD`) | **Pura:** suma o resta días en UTC sobre la fecha dada. | `vistas/gantt.js` (L117), `comun/editor.js` (L340), pruebas. |
| [`comun/modelo.js:92`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L92) `proyectoVacio(nombre, equipo)` | `nombre: string, equipo?: string[]` | `object` (estructura `datos.json`) | **Inmutable:** crea un nuevo objeto JSON base sin actividades ni hitos. | `comun/app.js` (L204), `proyectoDesdePlantilla()` (L127). |
| [`comun/modelo.js:122`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L122) `proyectoDesdePlantilla(nombre, equipo, plantilla)` | `nombre: string, equipo: string[], plantilla: 'vacia'\|'basica'` | `object` (estructura `datos.json`) | **Inmutable:** crea proyecto y añade 4 actividades nivel 1 si es `'basica'`. | `comun/app.js` (L207). |
| [`comun/modelo.js:142`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L142) `validar(datos)` | `datos: any` | `{ ok: boolean, errores: string[] }` | **Pura:** valida esquema, jerarquía, reglas hoja vs contenedor, ciclos DFS e integridad del equipo. | `comun/archivo.js` (`cargarDesdeServidor`, `procesarContenido`), `proyectoVacio()`, pruebas. |
| [`comun/modelo.js:380`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L380) `construir(datos)` | `datos: object` | `Modelo` (`{ proyecto, equipo, hitos, raiz, porId, lista, hojas, rango }`) | **Pura/Calculada:** arma árbol en memoria, ordena hermanos, numera códigos EDT (preorden) y computa rollups de fechas y avance. | `comun/app.js` (`establecerDatos`, `aplicar`, `deshacer`, `rehacer`), pruebas. |
| [`comun/modelo.js:542`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L542) `nuevoId(datos)` | `datos: object` | `string` (id corto único) | **Pura (aleatoria):** genera identificador de 4–6 caracteres alfanuméricos no colisionante. | `agregarActividad()` (L570), `agregarHito()` (L864). |
| [`comun/modelo.js:569`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L569) `agregarActividad(datos, { padre, nombre, despuesDe })` | `datos: object, { padre: string\|null, nombre: string, despuesDe?: string }` | `{ datos: object, id: string }` | **Inmutable:** clona datos, inserta la actividad, elimina fechas/estado del padre si era hoja, y renormaliza `orden`. | `comun/editor.js` (L381), `proyectoDesdePlantilla()` (L131). |
| [`comun/modelo.js:627`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L627) `editarActividad(datos, id, cambios)` | `datos: object, id: string, cambios: object` | `object` (nuevos datos) | **Inmutable:** clona datos y aplica modificaciones (`nombre`, `responsable`, `inicio`, `fin`, `estado`, `notas`) sobre la actividad indicada. | `comun/editor.js` (L304, L314, L325, L347, L358). |
| [`comun/modelo.js:705`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L705) `moverActividad(datos, id, nuevoPadre, posicion)` | `datos: object, id: string, nuevoPadre: string\|null, posicion: number` | `object` (nuevos datos) | **Inmutable:** mueve de rama evitando ciclos; limpia fechas del nuevo padre si era hoja; renormaliza `orden` de hermanos viejos y nuevos. | `comun/editor.js` (vistas drag & drop). |
| [`comun/modelo.js:767`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L767) `subir(datos, id)` | `datos: object, id: string` | `object` (nuevos datos) | **Inmutable:** intercambia el `orden` de la actividad con el hermano anterior inmediato. | `comun/editor.js` (L254). |
| [`comun/modelo.js:790`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L790) `bajar(datos, id)` | `datos: object, id: string` | `object` (nuevos datos) | **Inmutable:** intercambia el `orden` de la actividad con el hermano siguiente inmediato. | `comun/editor.js` (L266). |
| [`comun/modelo.js:813`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L813) `eliminarActividad(datos, id)` | `datos: object, id: string` | `object` (nuevos datos) | **Inmutable:** elimina la actividad y todos sus descendientes en cascada; renormaliza `orden` de hermanos restantes. | `comun/editor.js` (L281). |
| [`comun/modelo.js:846`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L846) `contarDescendientes(datos, id)` | `datos: object, id: string` | `number` | **Pura:** cuenta recursivamente cuántas actividades dependen directa o indirectamente del nodo. | `comun/editor.js` (L278, para advertencia de borrado). |
| [`comun/modelo.js:863`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L863) `agregarHito(datos, { nombre, inicio, fin, responsable })` | `datos: object, params: object` | `{ datos: object, id: string }` | **Inmutable:** genera id, valida y agrega un nuevo hito o periodo a la lista `hitos`. | `comun/editor.js` (L499). |
| [`comun/modelo.js:893`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L893) `editarHito(datos, id, cambios)` | `datos: object, id: string, cambios: object` | `object` (nuevos datos) | **Inmutable:** actualiza propiedades (`nombre`, `inicio`, `fin`, `responsable`) del hito. | `comun/editor.js` (L450, L461, L474, L486). |
| [`comun/modelo.js:933`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L933) `eliminarHito(datos, id)` | `datos: object, id: string` | `object` (nuevos datos) | **Inmutable:** remueve el hito especificado de la lista `hitos`. | `comun/editor.js` (L422). |
| [`comun/modelo.js:946`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L946) `editarProyecto(datos, { nombre, descripcion })` | `datos: object, { nombre?: string, descripcion?: string }` | `object` (nuevos datos) | **Inmutable:** actualiza el nombre y/o descripción general del proyecto en `datos.proyecto`. | `comun/app.js` (`editarTitulo`, L670). |
| [`comun/modelo.js:967`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L967) `editarEquipo(datos, equipo)` | `datos: object, equipo: string[]` | `object` (nuevos datos) | **Inmutable:** reemplaza el equipo; limpia como responsable en actividades e hitos a quienes hayan sido eliminados. | Pruebas, scripts de mantenimiento. |
| [`comun/modelo.js:1010`](file:///home/jysusman/apps/project-organizer/comun/modelo.js#L1010) `actualizarEquipo(datos, filas)` | `datos: object, filas: Array<{ antes: string\|null, ahora: string }>` | `object` (nuevos datos) | **Inmutable:** permite renombrar miembros (migrando asignaciones) o eliminarlos (desasignando actividades). | `comun/app.js` (`abrirEquipo`, L380). |

---

### Módulo `comun/archivo.js` (I/O, Red y Persistencia)

| Archivo:Línea | Entradas | Salida | Efectos (¿Muta, guarda, dibuja?) | Quién la llama |
|---|---|---|---|---|
| [`comun/archivo.js:10`](file:///home/jysusman/apps/project-organizer/comun/archivo.js#L10) `texto(datos)` | `datos: object` | `string` | **Pura:** formatea el objeto a texto JSON indentado a 2 espacios con salto final. | `guardarEnServidor()` (L154), `escribirManejador()` (L218), `descargarArchivo()` (L225). |
| [`comun/archivo.js:15`](file:///home/jysusman/apps/project-organizer/comun/archivo.js#L15) `puedeGuardarDirecto()` | Ninguna | `boolean` | **Pura:** verifica si el navegador soporta `window.showOpenFilePicker`. | `abrirArchivo()` (L53), `guardarComo()` (L189). |
| [`comun/archivo.js:24`](file:///home/jysusman/apps/project-organizer/comun/archivo.js#L24) `cargarDesdeServidor(url)` | `url?: string` (def: `'datos.json'`) | `Promise<object\|null>` | **I/O Red:** hace `fetch(url, { cache: 'no-store' })` y valida el JSON devuelto. | `comun/app.js` (`cargarInicial`, L68). |
| [`comun/archivo.js:52`](file:///home/jysusman/apps/project-organizer/comun/archivo.js#L52) `abrirArchivo()` | Ninguna | `Promise<{ datos, nombre, manejador }\|null>` | **UI/Disco:** abre el diálogo del sistema operativo para leer un `.json` local. | `comun/app.js` (`abrirArchivoLocal`, L575). |
| [`comun/archivo.js:119`](file:///home/jysusman/apps/project-organizer/comun/archivo.js#L119) `listarGuardadosServidor()` | Ninguna | `Promise<Array<object>\|null>` | **I/O Red:** pide `GET /api/guardados` para listar versiones existentes. | `comun/app.js` (`abrirArchivo`, L596). |
| [`comun/archivo.js:135`](file:///home/jysusman/apps/project-organizer/comun/archivo.js#L135) `cargarGuardadoServidor(nombre)` | `nombre: string` | `Promise<{ datos, nombre, manejador }>` | **I/O Red:** pide `GET /api/guardados/<nombre>` y valida el JSON. | `comun/app.js` (`abrirArchivo`, L636). |
| [`comun/archivo.js:149`](file:///home/jysusman/apps/project-organizer/comun/archivo.js#L149) `guardarEnServidor(datos)` | `datos: object` | `Promise<{ manejador: null, modo: 'servidor', nombre }\|null>` | **I/O Red:** hace `POST /api/guardar` creando una nueva versión `datosN.json`. | `guardar()` (L175). |
| [`comun/archivo.js:174`](file:///home/jysusman/apps/project-organizer/comun/archivo.js#L174) `guardar(datos, manejador)` | `datos: object, manejador?: FileSystemFileHandle` | `Promise<object>` | **Persistencia:** intenta guardar en servidor; si falla, escribe en manejador local o descarga. | `comun/app.js` (`guardar`, L537). |
| [`comun/archivo.js:188`](file:///home/jysusman/apps/project-organizer/comun/archivo.js#L188) `guardarComo(datos)` | `datos: object` | `Promise<object>` | **UI/Disco:** fuerza diálogo "Guardar como..." en el sistema o descarga archivo Blob. | `comun/app.js` (`guardarComo`, L560), `guardar()` (L181). |
| [`comun/archivo.js:239`](file:///home/jysusman/apps/project-organizer/comun/archivo.js#L239) `guardarBorrador(datos)` | `datos: object` | `void` | **Disco Local:** escribe copia en `localStorage['project-organizer:borrador']`. | `comun/app.js` (`establecerDatos`, `aplicar`, `deshacer`, `rehacer`). |
| [`comun/archivo.js:249`](file:///home/jysusman/apps/project-organizer/comun/archivo.js#L249) `leerBorrador()` | Ninguna | `object\|null` | **Disco Local:** lee borrador de `localStorage`. | `comun/app.js` (`mostrarPantallaInicio`, L224). |
| [`comun/archivo.js:260`](file:///home/jysusman/apps/project-organizer/comun/archivo.js#L260) `borrarBorrador()` | Ninguna | `void` | **Disco Local:** remueve borrador de `localStorage`. | `comun/app.js` (`establecerDatos`, `guardar`, `guardarComo`, descarte). |

---

### Módulos de Vista y Editor (`comun/editor.js`, `vistas/*`)

| Archivo:Línea | Entradas | Salida | Efectos (¿Muta, guarda, dibuja?) | Quién la llama |
|---|---|---|---|---|
| [`comun/editor.js:11`](file:///home/jysusman/apps/project-organizer/comun/editor.js#L11) `crearEditor(contenedor, callbacks)` | `contenedor: HTMLElement, { aplicar, alSeleccionar }` | `{ mostrar(modelo, seleccionId) }` | **Dibuja:** monta formulario lateral para editar propiedades del nodo o hito seleccionado. | `comun/app.js` (L324). |
| [`vistas/edt.js:30`](file:///home/jysusman/apps/project-organizer/vistas/edt.js#L30) `crearVista(contenedor, callbacks)` | `contenedor: HTMLElement, { alSeleccionar }` | `{ mostrar(modelo, seleccionId), destruir() }` | **Dibuja:** renderiza árbol jerárquico interactivo usando D3 v7 SVG con zoom, colapso y búsqueda. | `comun/app.js` (`crearVistaActual`, L430). |
| [`vistas/gantt.js:56`](file:///home/jysusman/apps/project-organizer/vistas/gantt.js#L56) `crearVista(contenedor, callbacks)` | `contenedor: HTMLElement, { alSeleccionar }` | `{ mostrar(modelo, seleccionId), destruir() }` | **Dibuja:** renderiza cronograma en `<canvas>` con barras, hitos, escalas temporales y exportación PNG. | `comun/app.js` (`crearVistaActual`, L427). |
| [`vistas/tabla.js:10`](file:///home/jysusman/apps/project-organizer/vistas/tabla.js#L10) `crearVista(contenedor, callbacks)` | `contenedor: HTMLElement, { alSeleccionar }` | `{ mostrar(modelo, seleccionId), destruir() }` | **Dibuja:** renderiza tabla HTML con ordenamiento por columnas, filtros, exportación CSV y copiado a portapapeles. | `comun/app.js` (`crearVistaActual`, L428). |

---

## 2. Itinerario App (`~/apps/itinerario-app`)

### Módulo `comun/modelo.js` (Lógica de datos, validación, urgencia y planificador)

| Archivo:Línea | Entradas | Salida | Efectos (¿Muta, guarda, dibuja?) | Quién la llama |
|---|---|---|---|---|
| [`comun/modelo.js:11`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L11) `generarId(prefijo)` | `prefijo?: string` (def: `'id'`) | `string` (`prefijo-xxxxx`) | **Pura (aleatoria):** genera ID único no colisionante. | `crearTarea`, `crearBloque`, `crearFijo`, `planificar`, `comun/app.js`. |
| [`comun/modelo.js:23`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L23) `clonar(obj)` | `obj: any` | `any` | **Pura:** clonación profunda mediante `JSON.parse(JSON.stringify(obj))`. | Todas las mutaciones inmutables de `modelo.js`, `comun/app.js`. |
| [`comun/modelo.js:36`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L36) `esEcoPropio(etagEvento, etagActual)` | `etagEvento: string, etagActual: string` | `boolean` | **Pura:** compara ETags normalizando prefijos débiles `W/` y comillas para descartar ecos de guardado propio. | `comun/app.js` (L275, L292). |
| [`comun/modelo.js:53`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L53) `validarDatos(datosRaw)` | `datosRaw: any` | `{ datos: object, advertencias: string[] }` | **Pura/Normalizadora:** rellena campos faltantes, valida horas, normaliza medianoche a 24:00 y migra configuraciones viejas. | `comun/app.js` (`iniciar`, `manejarCambioExterno`), pruebas. |
| [`comun/modelo.js:204`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L204) `obtenerHijas(tareas, padreId)` | `tareas: Array, padreId: string` | `Array<object>` | **Pura:** filtra las subtareas directas pertenecientes a la tarea madre. | `calcularMetricasTarea`, `eliminarTarea`, `planificar`, `VistaPendientes`. |
| [`comun/modelo.js:215`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L215) `calcularMetricasTarea(tarea, todasLasTareas)` | `tarea: object, todasLasTareas: Array` | `{ duracionMin, avance, restanteMin, tieneHijas }` | **Pura:** agrega recursivamente la duración y calcula el avance ponderado de las subtareas. | `calcularUrgencia()`, `sincronizarMadre()`. |
| [`comun/modelo.js:247`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L247) `sincronizarMadre(datos, madreId)` | `datos: object, madreId: string` | `void` | **Muta in-place (sobre clon):** actualiza `duracionMin`, `avance` y `estado` (`hecha` / `pendiente`) de la tarea madre según sus hijas. | `marcarBloqueHecho()`, `marcarTareaHecha()`. |
| [`comun/modelo.js:277`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L277) `calcularUrgencia(tarea, ahoraIso, todasLasTareas)` | `tarea, ahoraIso: string, todasLasTareas?: Array` | `{ nivel, holguraH, horasHasta, restanteMin, textoUrgencia, ... }` | **Pura:** hereda entrega de la madre si no tiene propia; calcula horas hasta entrega, tiempo restante y holgura; categoriza nivel (`vencida`, `urgente`, etc.). | `planificar()`, `VistaHoy`, `VistaSemana`, `VistaPendientes`. |
| [`comun/modelo.js:361`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L361) `agruparEntregas(entregas, ventanaMin)` | `entregas: Array, ventanaMin?: number` (def: 15) | `Array<Grupo>` | **Pura:** agrupa entregas que caen a la misma hora o dentro de la ventana; anida subtareas dentro de su madre si coinciden. | `VistaHoy`, `VistaSemana`. |
| [`comun/modelo.js:478`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L478) `planificar(datos, ahoraIso, dias)` | `datos: object, ahoraIso: string, dias?: number` (def: 2) | `{ bloquesPropuestos: Array, avisosNoAlcanza: object }` | **Pura (Algoritmo Voraz):** resta bloques en curso y futuros; reutiliza bloques pasados no hechos con su ID; llena huecos libres respetando fijos, pausas y entregas; emite avisos si no alcanza. | `comun/app.js` (`ejecutarPlanificador`, L438). |
| [`comun/modelo.js:801`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L801) `crearTarea(datos, tareaNueva)` | `datos: object, tareaNueva: object` | `object` (nuevos datos) | **Inmutable:** agrega una nueva tarea con valores normalizados por defecto. | `comun/app.js` (L100, L209, L475). |
| [`comun/modelo.js:819`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L819) `actualizarTarea(datos, id, cambios)` | `datos: object, id: string, cambios: object` | `object` (nuevos datos) | **Inmutable:** aplica cambios; protege duracionMin y avance en tareas con hijas. | `comun/app.js` (L104). |
| [`comun/modelo.js:842`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L842) `eliminarTarea(datos, id)` | `datos: object, id: string` | `object` (nuevos datos) | **Inmutable:** elimina en cascada todas las subtareas descendientes y desvincula bloques asociados (`tarea: null`). | `comun/app.js` (L110). |
| [`comun/modelo.js:870`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L870) `marcarTareaHecha(datos, id, hecha, ahoraIso)` | `datos: object, id: string, hecha?: boolean, ahoraIso?: string` | `object` (nuevos datos) | **Inmutable:** si hecha, elimina futuros no hechos y marca pasados; si no, recalcula avance a partir de sus bloques hechos (no pone 0); sincroniza madres e hijas. | `comun/app.js` (L219). |
| [`comun/modelo.js:954`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L954) `crearBloque(datos, bloqueNuevo)` | `datos: object, bloqueNuevo: object` | `object` (nuevos datos) | **Inmutable:** agrega un bloque de trabajo al calendario. | `comun/app.js` (L101, L483). |
| [`comun/modelo.js:971`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L971) `actualizarBloque(datos, id, cambios)` | `datos: object, id: string, cambios: object` | `object` (nuevos datos) | **Inmutable:** actualiza horarios/título; si cambia `hecho`, delega a `marcarBloqueHecho`. | `comun/app.js` (L105, L134, L137). |
| [`comun/modelo.js:982`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L982) `eliminarBloque(datos, id)` | `datos: object, id: string` | `object` (nuevos datos) | **Inmutable:** elimina el bloque del estado. | `comun/app.js` (L111, L140). |
| [`comun/modelo.js:988`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L988) `marcarBloqueHecho(datos, id, hecho)` | `datos: object, id: string, hecho?: boolean` | `object` (nuevos datos) | **Inmutable:** marca bloque y recalcula el avance porcentual de la tarea; si llega a 100% marca la tarea como hecha, si baja de 100% la vuelve pendiente. | `comun/app.js` (L131), `actualizarBloque()`. |
| [`comun/modelo.js:1022`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L1022) `crearFijo(datos, fijoNuevo)` | `datos: object, fijoNuevo: object` | `object` (nuevos datos) | **Inmutable:** agrega un evento/clase recurrente semanal. | `comun/app.js` (L102). |
| [`comun/modelo.js:1043`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L1043) `actualizarFijo(datos, id, cambios)` | `datos: object, id: string, cambios: object` | `object` (nuevos datos) | **Inmutable:** modifica días, hora, lugar o materia del fijo. | `comun/app.js` (L106). |
| [`comun/modelo.js:1054`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L1054) `eliminarFijo(datos, id)` | `datos: object, id: string` | `object` (nuevos datos) | **Inmutable:** remueve el evento fijo del calendario. | `comun/app.js` (L112). |

---

### Módulo `comun/tiempo.js` (Aritmética y formateo de fechas locales)

| Archivo:Línea | Entradas | Salida | Efectos (¿Muta, guarda, dibuja?) | Quién la llama |
|---|---|---|---|---|
| [`comun/tiempo.js:9`](file:///home/jysusman/apps/itinerario-app/comun/tiempo.js#L9) `aFechaIso(fecha)` | `fecha?: Date` | `string` (`YYYY-MM-DD`) | **Pura:** fecha local ISO. | `comun/modelo.js`, `comun/app.js`, vistas. |
| [`comun/tiempo.js:21`](file:///home/jysusman/apps/itinerario-app/comun/tiempo.js#L21) `aFechaHoraIso(fecha)` | `fecha?: Date` | `string` (`YYYY-MM-DDTHH:MM`) | **Pura:** fecha y hora local ISO. | `comun/app.js`, `comun/modelo.js`. |
| [`comun/tiempo.js:33`](file:///home/jysusman/apps/itinerario-app/comun/tiempo.js#L33) `aHoraIso(fecha)` | `fecha?: Date` | `string` (`HH:MM`) | **Pura:** hora local ISO. | `comun/modelo.js`, `comun/app.js`. |
| [`comun/tiempo.js:44`](file:///home/jysusman/apps/itinerario-app/comun/tiempo.js#L44) `horaAMinutos(horaStr)` | `horaStr: string` | `number` | **Pura:** convierte `HH:MM` a minutos desde medianoche (0–1440). | `planificar()`, drag & drop, vistas. |
| [`comun/tiempo.js:55`](file:///home/jysusman/apps/itinerario-app/comun/tiempo.js#L55) `minutosAHora(minutos)` | `minutos: number` | `string` | **Pura:** convierte minutos a `HH:MM` (1440 se formatea como `24:00`). | `planificar()`, drag & drop, vistas. |
| [`comun/tiempo.js:69`](file:///home/jysusman/apps/itinerario-app/comun/tiempo.js#L69) `parsearIso(isoStr)` | `isoStr: string` | `Date\|null` | **Pura:** parsea fecha ISO local evitando desfases UTC. | `diferenciaHoras()`. |
| [`comun/tiempo.js:91`](file:///home/jysusman/apps/itinerario-app/comun/tiempo.js#L91) `diferenciaHoras(desdeIso, hastaIso)` | `desdeIso: string, hastaIso: string` | `number` | **Pura:** calcula diferencia en horas fraccionarias (`hasta - desde`). | `calcularUrgencia()`. |
| [`comun/tiempo.js:104`](file:///home/jysusman/apps/itinerario-app/comun/tiempo.js#L104) `sumarDias(fechaIso, dias)` | `fechaIso: string, dias: number` | `string` (`YYYY-MM-DD`) | **Pura:** suma o resta días a una fecha ISO. | `planificar()`, `VistaHoy`, `VistaSemana`. |
| [`comun/tiempo.js:116`](file:///home/jysusman/apps/itinerario-app/comun/tiempo.js#L116) `diaDeLaSemana(fechaIso)` | `fechaIso: string` | `number` (1=Lun ... 7=Dom) | **Pura:** día de la semana estándar ISO 8601. | `planificar()`, `VistaSemana`. |
| [`comun/tiempo.js:132`](file:///home/jysusman/apps/itinerario-app/comun/tiempo.js#L132) `formatearFecha(fechaIso)` | `fechaIso: string` | `string` | **Pura:** formatea a texto legible en español (ej. "Miércoles, 15 de octubre"). | Cabeceras de `VistaHoy` y `VistaSemana`. |
| [`comun/tiempo.js:146`](file:///home/jysusman/apps/itinerario-app/comun/tiempo.js#L146) `formatearHora12(horaStr)` | `horaStr: string` | `string` | **Pura:** formatea `13:00` a `1:00 pm`. | Cuadrículas de `VistaHoy` y `VistaSemana`. |
| [`comun/tiempo.js:163`](file:///home/jysusman/apps/itinerario-app/comun/tiempo.js#L163) `formatearEntrega(fechaHoraIso)` | `fechaHoraIso: string` | `string` | **Pura:** formatea fecha y hora de entrega para etiquetas y badges. | Marcadores de entrega en vistas. |

---

### Módulo `comun/archivo.js` (I/O HTTP con ETag)

| Archivo:Línea | Entradas | Salida | Efectos (¿Muta, guarda, dibuja?) | Quién la llama |
|---|---|---|---|---|
| [`comun/archivo.js:8`](file:///home/jysusman/apps/itinerario-app/comun/archivo.js#L8) `cargarDatos()` | Ninguna | `Promise<{ datos: object, etag: string }>` | **I/O Red:** hace `GET /api/datos` con `Cache-Control: no-cache` y extrae el header `ETag`. | `comun/app.js` (`iniciar`, reconexión SSE, resolución de conflicto). |
| [`comun/archivo.js:29`](file:///home/jysusman/apps/itinerario-app/comun/archivo.js#L29) `guardarDatos(datos, etagActual)` | `datos: object, etagActual: string` | `Promise<{ ok: boolean, etag?: string, conflicto?: boolean, error?: string }>` | **I/O Red/Disco:** hace `POST /api/datos` con `If-Match: <etag>`. Detecta 409 Conflict. | `comun/app.js` (`guardarInmediato`, L565). |

---

### Clases Principales de Orquestación y Vistas (`comun/app.js`, `comun/editor.js`, `vistas/*`)

| Archivo:Línea | Entradas de Constructor | Métodos Públicos Clave | Efectos (¿Muta, guarda, dibuja?) | Quién la instancia |
|---|---|---|---|---|
| [`comun/app.js:24`](file:///home/jysusman/apps/itinerario-app/comun/app.js#L24) `AplicacionItinerario` | Ninguna | `iniciar()`, `aplicarModificacion()`, `deshacer()`, `rehacer()`, `guardarInmediato()`, `ejecutarPlanificador()` | **Orquestador Central:** maneja estado en memoria (`this.datos`), historial undo/redo, debounce de autoguardado, eventos SSE en vivo y atajos de teclado. | `index.html` (L90). |
| [`comun/editor.js:16`](file:///home/jysusman/apps/itinerario-app/comun/editor.js#L16) `EditorModal` | `elDialogo: HTMLDialogElement, callbacks: object` | `abrir(elemento, datos)`, `cerrar()` | **Dibuja/UI:** renderiza modal para crear o modificar tareas, bloques y fijos. | `comun/app.js` (L45). |
| [`vistas/hoy.js:12`](file:///home/jysusman/apps/itinerario-app/comun/vistas/hoy.js#L12) `VistaHoy` | `contenedor: HTMLElement, callbacks: object` | `renderizar(datos, fechaIso, avisosNoAlcanza)` | **Dibuja/UI:** renderiza timeline interactivo de 1 día, línea de hora actual, drag & drop de bloques con eventos pointer y marcadores de entrega agrupados. | `comun/app.js` (L124). |
| [`vistas/semana.js:12`](file:///home/jysusman/apps/itinerario-app/comun/vistas/semana.js#L12) `VistaSemana` | `contenedor: HTMLElement, callbacks: object` | `renderizar(datos, fechaIso)` | **Dibuja/UI:** renderiza cuadrícula semanal de 7 días con fijos, bloques y marcadores de entrega. | `comun/app.js` (L176). |
| [`vistas/pendientes.js:11`](file:///home/jysusman/apps/itinerario-app/comun/vistas/pendientes.js#L11) `VistaPendientes` | `contenedor: HTMLElement, callbacks: object` | `renderizar(datos, filtroMateria, mostrarHechas, avisosNoAlcanza)` | **Dibuja/UI:** renderiza árbol jerárquico colapsable de tareas y subtareas, barra de captura rápida, filtros por materia y badges de urgencia. | `comun/app.js` (L199). |
