# Arquitectura de Itinerario

Documento de referencia técnica sobre el funcionamiento interno de la aplicación, el flujo de estado, el planificador algorítmico, el ciclo de sincronización y las reglas de negocio.

---

## 1. Flujo de datos e independencia por usuario

| Componente | Archivo y línea | Responsabilidad y comportamiento |
|---|---|---|
| **Residencia del estado** | [`comun/app.js` (L35–L58, L245–L280)](file:///home/jysusman/apps/itinerario-app/comun/app.js#L35-L58) | El estado en memoria vive en la propiedad `this.datos` de la clase `AplicacionItinerario`. Mantiene además `this.etag` con el identificador de versión del archivo en disco, `this.usuarioActual` y `this.usuariosDisponibles`. |
| **Independencia por usuario (sin contraseña)** | [`servidor.py` (L88–L138, L186–L300)](file:///home/jysusman/apps/itinerario-app/servidor.py#L88-L138)<br>[`comun/archivo.js` (L75–L120)](file:///home/jysusman/apps/itinerario-app/comun/archivo.js#L75-L120)<br>[`comun/app.js` (L283–L335)](file:///home/jysusman/apps/itinerario-app/comun/app.js#L283-L335) | Cada usuario definido en `~/apps/usuarios.json` tiene su propio archivo individual en `itinerario-app/usuarios/<id>.json` resuelto por `resolver_archivo_datos(peticion)`. Para `jesus-aragon` y `jysusman` se inicializa con la copia base de `datos.json`; para los demás usuarios (`paola-bello`, `maria-jose`, `santiago-benavides`, etc.) se crea en blanco (`DATOS_EN_BLANCO`). En la cabecera se muestra un selector directo `👤 <Nombre>` (`GET /api/usuarios`) que cambia la cookie `usuario=<id>` sin pedir contraseña y recarga el itinerario de esa persona (además de sincronizarse al volver del Portal `:8080`). En modo autónomo sin cookie de usuario, el servidor usa `datos.json`. |
| **Mutaciones (de `app.js` a `modelo.js`)** | [`comun/app.js` (L560–L585)](file:///home/jysusman/apps/itinerario-app/comun/app.js#L560-L585) | Se realizan exclusivamente a través de `this.aplicarModificacion(transformacionFn)`. Registra el estado previo en `this.historialDeshacer`, ejecuta la función pura de [`comun/modelo.js`](file:///home/jysusman/apps/itinerario-app/comun/modelo.js) que clona profundamente (`clonar(datos)`, L23) sin mutar el original, actualiza `this.datos`, marca `this.hayCambiosSinGuardar = true` y renderiza la vista activa. |
| **Persistencia (de `app.js` a `archivo.js`)** | [`comun/archivo.js` (L29–L71)](file:///home/jysusman/apps/itinerario-app/comun/archivo.js#L29-L71) | `guardarDatos(this.datos, this.etag)` envía un `POST /api/datos` con encabezado `If-Match: <etag>`. El servidor guarda en `usuarios/<id>.json` (y respalda en `respaldos/datos_<id>_<timestamp>.json`). Si responde `409 Conflict`, retorna `{ conflicto: true, etagActual }`. Si responde `200`, actualiza `this.etag` y marca `this.hayCambiosSinGuardar = false`. |
| **Disparadores de guardado** | [`comun/app.js` (L618–L650)](file:///home/jysusman/apps/itinerario-app/comun/app.js#L618-L650) | **1. Autoguardado con debounce:** tras cada mutación vía `aplicarModificacion()`, se programa un temporizador de 1000 ms (`programarAutoguardado()`).<br>**2. Guardado inmediato:** al pulsar `Ctrl+S` / `Cmd+S`.<br>**3. Resolución de conflicto:** al pulsar *"Mantener lo mío"* en el banner, se refresca el ETag del disco y se guarda inmediatamente sin 409. |

---

## 2. Algoritmo `planificar()` paso a paso

Función pura: [`comun/modelo.js` L478–L777](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L478-L777).

### Selección de tareas candidatas (L501–L575)
1. **Filtro de candidatas:** excluye tareas con `t.estado === 'hecha'` (L503) y tareas madre que tengan subtareas (`obtenerHijas(datos.tareas, t.id).length > 0`, L505). Solo se planifican tareas hoja.
2. **Herencia de fecha de entrega:** si una subtarea no tiene `entrega` propia, hereda la de su tarea madre (`entregaEfectiva`, L508).
3. **Cálculo de minutos pendientes netos:**
   * Parte de `restanteBase = duracionMin * (1 - avance / 100)` (L512).
   * Resta los minutos que la tarea tenga en **bloques futuros no hechos** (`inicio >= ahora`, L520–L524).
   * Resta los minutos restantes de un **bloque en curso no hecho** (`inicio < ahora < fin`, descuenta `fin - ahora`, L525–L529).
4. **Cola de bloques pasados sin hacer:** identifica los bloques no hechos con `fin < ahora` (L535–L558). Se ordenan cronológicamente para reutilizar sus identificadores (`id`).
5. **Candidatura:** pasa si `minutosPendientes > 0` o si tiene bloques pasados por reubicar (L560).
6. **Ordenamiento:** ordena las candidatas por `holguraH` ascendente (L574), priorizando las más apretadas respecto a su entrega.

### Tratamiento de cada tipo de bloque

| Tipo de bloque | Condición en código | Efecto en minutos pendientes de la tarea | Efecto en ocupación del calendario y movimiento |
|---|---|---|---|
| **En curso** (inició antes de ahora y termina después) | `${b.fecha}T${b.inicio} < ahoraIso` y `${b.fecha}T${b.fin} > ahoraIso` no hecho ([L525–L529](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L525-L529)) | **Descuenta los minutos que le quedan** (`fin - ahora`) de `minutosPendientes`. | **Ocupa hueco:** su intervalo `[inicio, fin]` se agrega a `ocupados` (L602–L610) y se recorta a `[inicioDisponibilidad, minFinDia]`. Ningún bloque nuevo se colocará sobre él. |
| **Pasado no hecho** | `${b.fecha}T${b.fin} < ahoraIso` y `!b.hecho` ([L535–L558](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L535-L558)) | Se integran en `colaPasados` para programar sus minutos pendientes. | **Se mueve con el mismo ID:** se reubica en el primer hueco válido con `propuesto: true` (L703–L728). Si no cabe entero en el hueco o excede `bloqueMaxMin`, se acorta (manteniendo el `id`) y el resto va en un bloque nuevo (`generarId('b')`). Si no cabe en el horizonte, se queda donde estaba y la tarea muestra *"No alcanza"*. |
| **Futuro no hecho** | `${b.fecha}T${b.inicio} >= ahoraIso` y `!b.hecho` ([L520–L524](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L520-L524)) | **Se resta** su duración de `minutosPendientes` para evitar duplicar trabajo. | **Ocupa hueco:** entra en `ocupados` en su día respectivo impidiendo solapes. |
| **Futuro hecho** | `b.hecho === true` | **No se resta** de `minutosEnBloquesFuturos` (su avance ya está sumado en la tarea). | **Ocupa hueco:** entra en `ocupados` impidiendo sobreescrituras. |
| **Bloques de tareas hechas** | `tarea.estado === 'hecha'` | No entran en tareas candidatas. | **No se mueven.** Se quedan donde estaban. |
| **Propuesto existente** | `b.propuesto === true` | En `comun/app.js` (L436) se descartan los propuestos anteriores antes de llamar a `planificar()`. | Al integrar los nuevos propuestos (L442–L449), se deduplican por `id` para reemplazar los bloques pasados movidos sin duplicados. Descartar un bloque movido lo elimina del estado. |

---

## 3. Cálculo de huecos libres y solapes

Ubicación: [`comun/modelo.js` L579–L665](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L579-L665).

1. **Ventana diaria:**
   * Límite inferior: `inicioDisponibilidad`. Si el día es hoy (`diaIdx === 0`), es `Math.max(minInicioDia, Math.ceil(minAhora / 15) * 15)` (L584–L589). En días futuros, es `minInicioDia` (`config.inicioDia`).
   * Límite superior: `minFinDia` (`config.finDia` o 1440 min para `'24:00'`).
2. **Construcción de ocupados:**
   * Se agregan las clases/eventos fijos válidos para el día de la semana y fecha (`[iniF, finF]`, L591–L600).
   * Se agregan todos los bloques existentes del día (`[iniB, finB]`, L602–L610).
3. **Clampeo y fusión:**
   * Cada intervalo se recorta dentro de `[inicioDisponibilidad, minFinDia]` (L613–L620).
   * Se ordenan por hora de inicio y se unen los intervalos que solapen o colinden (`ini <= ult[1]`, L624–L636).
4. **Inversión a huecos libres:**
   * Se recorre con un `cursor` desde `inicioDisponibilidad` saltando los ocupados unidos, generando los segmentos libres mayores o iguales a 15 min (L639–L650).
5. **¿Se permiten bloques solapados al crearlos o moverlos a mano?**
   * **SÍ.** Ni `crearBloque` ([`comun/modelo.js` L954](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L954)), ni `actualizarBloque` (L971), ni el arrastre/redimensión en la vista ([`vistas/hoy.js` L500–L580](file:///home/jysusman/apps/itinerario-app/vistas/hoy.js#L500-L580)) validan colisiones.
   * El planificador es el único que respeta estrictamente los huecos libres y jamás genera un bloque solapado ni con fijos ni con otros bloques.

---

## 4. Matriz de sincronización de estados

Ubicación: [`comun/modelo.js` L867–L1020](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L867-L1020).

| Campo | ¿Cambia automáticamente cuando cambia otro? | Comportamiento exacto |
|---|---|---|
| `bloque.hecho` | **SÍ (bidireccional con tarea).** | Al marcar un bloque como hecho vía `marcarBloqueHecho(id, true)` (L988–L1020), suma sus minutos al avance de la tarea: $\text{avance} = \min(100, \text{round}((\text{minutos hechos} / \text{duracionMin}) \times 100))$. Al desmarcarlo, réstalos. Si llega al 100 %, la tarea pasa automáticamente a `estado = 'hecha'`. Si baja del 100 % y estaba hecha, vuelve a `'pendiente'`. |
| `tarea.estado` | **SÍ (con bloques y subtareas).** | **Al marcar tarea como hecha (`hecha = true`, L880–L914):** `avance = 100`, sus **bloques futuros no hechos se eliminan** y sus **bloques pasados no hechos se marcan como hechos**.<br>**Al desmarcarla (`hecha = false`, L915–L949):** `estado = 'pendiente'`, y **recalcula su avance a partir de sus bloques hechos** (no se pone en 0). |
| `tarea.avance` | **SÍ.** | Se deriva dinámicamente de los bloques completados de la tarea. En tareas madre con subtareas, se calcula sumando la duración y avance de las hijas mediante `sincronizarMadre()` (L248–L260). |
| **Subtareas y madre** | **SÍ.** | Al marcar o desmarcar la madre, se actualizan todas sus hijas. Al cambiar una hija (o sus bloques), `sincronizarMadre()` actualiza el avance y estado de la madre (`estado = 'hecha'` si todas alcanzan el 100%). |
| **Bloques al eliminar una tarea** | **Se desvinculan.** | En `eliminarTarea()` (L859–L865), los bloques asociados pasan a `tarea: null` y reciben el título `"Bloque libre"`. |

---

## 5. Urgencia y cálculo de avisos

### Cálculo de urgencia y holgura
Ubicación: [`comun/modelo.js` L268–L344](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L268-L344).

* **Herencia de fecha de entrega:** si una subtarea no tiene entrega propia, hereda la de la tarea madre (`entregaEfectiva`, L277–L278).
* **Tiempo disponible:** `horasHasta = diferenciaHoras(ahoraIso, entregaEfectiva)` (L292).
* **Tiempo restante:** `restanteMin = duracionMin * (1 - avance / 100)`. Si tiene hijas, suma el restante de todas las hojas hijas (L224–L240).
* **Holgura:**
  $$\text{holguraH} = \text{horasHasta} - \frac{\text{restanteMin}}{60} \quad \text{(L293)}$$
* **Clasificación por niveles:**
  1. `horasHasta < 0`: `'vencida'` $\rightarrow$ *"Vencida · hace X h/d"* (L298–L301).
  2. `holguraH < 24`: `'urgente'` $\rightarrow$ *"Urgente · holgura X h"* (L302–L305).
  3. `holguraH < 72`: `'pronto'` $\rightarrow$ *"Pronto · holgura X h"* (L306–L309).
  4. En otro caso: `'con-tiempo'` $\rightarrow$ *"Con tiempo · X d/h"* (L310–L314).
  5. Si `tarea.estado === 'hecha'`: `'hecha'`, con holgura infinita (L266–L275).
  6. Sin entrega: `'con-tiempo'`, holgura 999999 (L280–L290).

### Aviso "No alcanza: faltan X h"
Ubicación: [`comun/modelo.js` L754–L773](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L754-L773) y [`comun/app.js` L439](file:///home/jysusman/apps/itinerario-app/comun/app.js#L439).

* Se dispara para cualquier tarea candidata que tenga `minutosPendientes > 0` tras intentar colocar bloques en la ventana planificada cuando:
  1. Su fecha de entrega efectiva está dentro del rango planificado (`entregaFecha <= ultimaFecha`, típicamente hoy o mañana) o la holgura inicial ya era negativa (`urg.holguraH < 0`).
  2. O tenía bloques pasados que no pudieron reubicarse en el horizonte planificado (`noCabeEnHorizonte`, L760).
* **Valor:** `horasFaltantes = round(minutosPendientes / 60, 1 decimal)`. Se muestra como aviso destacado en la vista Pendientes y en Hoy.

---

## 6. Limitaciones conocidas y casos borde

| Caso borde / Limitación | Archivo y línea de impacto | Comportamiento observado y consecuencias |
|---|---|---|
| **Bloques que cruzan medianoche (24:00 / 00:00)** | [`comun/tiempo.js` L55–L61](file:///home/jysusman/apps/itinerario-app/comun/tiempo.js#L55-L61), [`comun/modelo.js` L149–L152](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L149-L152) | Si un usuario ingresa manualmente un bloque que termina después de medianoche (ej. 23:00 a 01:00), el validador normaliza `fin <= inicio` convirtiendo el fin a `24:00`. No existe partición automática de bloques entre dos fechas continuas. |
| **Solapamiento manual sin bloqueo** | [`comun/modelo.js` L954, L971](file:///home/jysusman/apps/itinerario-app/comun/modelo.js#L954), [`vistas/hoy.js` L500](file:///home/jysusman/apps/itinerario-app/vistas/hoy.js#L500) | No hay validación de colisiones al mover o crear bloques a mano; pueden apilarse visualmente en la misma franja horaria. |
| **Horizonte fijo de 2 días en planificación** | [`comun/app.js` L438](file:///home/jysusman/apps/itinerario-app/comun/app.js#L438) | `planificar(datos, ahora, 2)` proyecta hoy y mañana. Tareas con entrega a 3 o más días solo recibirán bloques si sobran huecos hoy o mañana tras atender las más urgentes. |
| **Desconexión SSE prolongada y guardados concurrentes** | [`comun/app.js` L258–L300](file:///home/jysusman/apps/itinerario-app/comun/app.js#L258-L300) | Durante una caída total de red, el navegador no recibe eventos SSE. Si se edita `datos.json` en disco en ese intervalo y el usuario local también edita en la app, la divergencia se detecta al reanudar conexión y dispararse el `onopen` con verificación de ETag o al intentar guardar y recibir el `409 Conflict`. |
