# Especificación Técnica de Implementación: Itinerario (Fases 1, 2 y 3)

Documento técnico descriptivo de los módulos, modelos, endpoints, planificador y comportamientos implementados en las **Fases 1, 2 y 3** de la aplicación Itinerario.

---

## 1. Arquitectura del Sistema

El sistema implementa una arquitectura desacoplada y sin dependencias externas:

```
┌────────────────────────────────────────────────────────┐
│                        Cliente                         │
│                                                        │
│  ┌───────────────┐     ┌────────────────────────────┐  │
│  │ Vistas        │     │ Editor Unificado           │  │
│  │ (Hoy, Semana, │◄────┤ (Lateral en escritorio,    │  │
│  │  Pendientes)  │     │  hoja inferior en móvil)   │  │
│  └───────┬───────┘     └─────────────┬──────────────┘  │
│          │                           │                 │
│          ▼                           ▼                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │ app.js (Coordinador de Estado & Eventos)          │  │
│  │  - Pila Deshacer / Rehacer (Ctrl+Z / Ctrl+Y)     │  │
│  │  - Autoguardado diferido (debounce 1000ms)       │  │
│  │  - Sincronización SSE (/api/eventos)             │  │
│  └───────────────────────┬──────────────────────────┘  │
│                          │                             │
│          ┌───────────────┴───────────────┐             │
│          ▼                               ▼             │
│  ┌───────────────┐               ┌───────────────┐     │
│  │ modelo.js     │               │ archivo.js    │     │
│  │ (Lógica pura, │               │ (Fetch API    │     │
│  │  inmutable)   │               │  con ETag)    │     │
│  └───────────────┘               └───────┬───────┘     │
└──────────────────────────────────────────┼─────────────┘
                                           │ HTTP
                                           ▼
┌────────────────────────────────────────────────────────┐
│               Servidor Python (servidor.py)            │
│  - GET/POST /api/datos con control ETag                │
│  - Escritura atómica (tempfile + os.replace)           │
│  - Rotación automática de respaldos en respaldos/      │
│  - SSE /api/eventos para recarga en vivo               │
└────────────────────────────────────────────────────────┘
```

---

## 2. Modelo de Datos (`datos.json`)

El archivo `datos.json` contiene la fuente única de verdad:

### 2.1 Esquema
```json
{
  "version": 1,
  "config": {
    "inicioDia": "06:00",
    "finDia": "24:00",
    "bloqueMaxMin": 90,
    "pausaMin": 10
  },
  "materias": [
    { "id": "proc1", "nombre": "Procesos de Manufactura I", "color": "#d6453d" }
  ],
  "tareas": [
    {
      "id": "t-1",
      "titulo": "Nombre de la tarea",
      "materia": "proc1",
      "padre": null,
      "entrega": "2026-10-15T07:00",
      "duracionMin": 240,
      "avance": 0,
      "estado": "pendiente",
      "notas": "Notas opcionales"
    }
  ],
  "bloques": [
    {
      "id": "b-1",
      "fecha": "2026-10-14",
      "inicio": "20:00",
      "fin": "22:00",
      "tarea": "t-1",
      "titulo": "",
      "hecho": false,
      "propuesto": false
    }
  ],
  "fijos": [
    {
      "id": "f-1",
      "titulo": "Clase",
      "materia": "proc1",
      "dias": [2, 4],
      "inicio": "07:00",
      "fin": "09:00",
      "lugar": "Salón 401",
      "desde": "2026-08-01",
      "hasta": "2026-12-15"
    }
  ]
}
```

### 2.2 Validación Tolerante (`comun/modelo.js`)
- **Campos faltantes:** Si un objeto omite `config`, `materias`, `bloques` o `fijos`, se proveen estructuras por defecto.
- **Relaciones huérfanas:** Si una tarea tiene un `padre` inexistente o cíclico, se desvincula (`padre = null`) y se reporta una advertencia sin bloquear la carga.
- **Identificadores:** Garantizados únicos mediante prefijo (`t-`, `b-`, `f-`, `m-`) + componente aleatorio + timestamp.

---

## 3. Cálculo de Urgencia y Subtareas

### 3.1 Subtareas y Agregación
Para tareas con hijas (`padre === t.id`):
- `duracionMin` = $\sum \text{duracionMin de hijas}$
- `restanteMin` = $\sum \text{restanteMin de hijas}$
- `avance` = $\text{round}\left(\frac{\text{duracionMin} - \text{restanteMin}}{\text{duracionMin}} \times 100\right)$
Los campos de duración y avance se bloquean en la interfaz para la tarea madre, calculándose exclusivamente de las subtareas.

### 3.2 Fórmulas de Urgencia
- $\text{restanteMin} = \text{duracionMin} \times (1 - \text{avance} / 100)$
- $\text{horasHasta} = \text{horas desde ahora hasta entrega}$
- $\text{holguraH} = \text{horasHasta} - (\text{restanteMin} / 60)$

### 3.3 Niveles y Señalización Visual
| Nivel | Condición | Etiqueta en Interfaz | Color / Estilo |
|---|---|---|---|
| **Vencida** | `horasHasta < 0` | "Vencida · hace X h" | Borde y texto rojo intenso (`#b91c1c`) |
| **Urgente** | `holguraH < 24` | "Urgente · holgura X h" | Rojo suave (`#d6453d`) |
| **Pronto** | `holguraH < 72` | "Pronto · holgura X h" | Ámbar (`#d99a1e`) |
| **Con tiempo** | `holguraH >= 72` | "Con tiempo · X d" | Gris neutro (`#8a8984`) |
| **Hecha** | `estado === "hecha"` | "Hecha" | Verde tachado (`#10b981`) |

---

## 4. Servidor HTTP (`servidor.py`)

Implementado con la biblioteca estándar `http.server.ThreadingHTTPServer`.

### 4.1 Endpoints
- `GET /` y rutas estáticas: Sirve archivos locales con MIME types adecuados. Bloquea navegación hacia carpetas superiores (`..`) y archivos ocultos (`.`).
- `GET /api/datos`: Devuelve el contenido de `datos.json` y el encabezado `ETag: "{mtime_ns}"`.
- `POST /api/datos`:
  1. Requiere encabezado `If-Match`. Si no coincide con el `ETag` actual en disco $\to$ `409 Conflict`.
  2. Crea un respaldo en `respaldos/datos_YYYYMMDD_HHMMSS_ffffff.json`.
  3. Mantiene un máximo de 30 respaldos, eliminando los más antiguos.
  4. Realiza escritura atómica en disco escribiendo en un archivo temporal en la misma carpeta y ejecutando `os.replace`.
  5. Retorna `200 OK` con el nuevo `ETag`.
- `GET /api/eventos`: Transmisión SSE de eventos `cambio` cuando el `mtime` de `datos.json` se modifica por fuera.

---

## 5. Interfaz de Usuario y Vistas (Fase 1 y Fase 2)

### 5.1 Vista Hoy (`vistas/hoy.js`)
- Línea de tiempo vertical desde `inicioDia` hasta `finDia` con cuadrícula horaria.
- Eventos fijos con fondo rayado y franja de color de materia (inmutables por arrastre).
- Bloques con color de materia, título, horas, notas y botón de check (✓) para marcar hecho.
- **Arrastre interactivo (*drag-and-drop*):** mover un bloque verticalmente cambia su hora de inicio y fin en pasos discretos de 15 minutos mediante eventos de puntero unificados (`pointerdown`, `pointermove`, `pointerup`), compatible con ratón y pantallas táctiles.
- **Redimensionado de duración:** manija en el borde inferior del bloque para alargar o acortar la duración en pasos de 15 minutos (mínimo 15 min).
- **Ajuste de texto en bloques pequeños:** para duraciones de 15 a 35 minutos se aplica formato compacto (`.bloque-compacto` y `.bloque-muy-compacto`), ocultando notas y optimizando el título y botón de check para evitar desbordes visuales.
- Bloques propuestos destacados con borde punteado.
- Línea de "ahora" horizontal que se recalcula cada minuto.
- Columna lateral "Entregas de hoy y mañana" ordenadas por urgencia.
- Navegación `‹ Hoy ›` para visualizar cualquier fecha.

### 5.2 Vista Semana (`vistas/semana.js`)
- Cuadrícula de 7 columnas completas (lunes a domingo) sobre una línea de tiempo continua.
- Desplazamiento horizontal fluido en dispositivos móviles mediante contenedor con scroll.
- **Clases fijas recurrentes:** aparecen estrictamente en los días de la semana especificados en su configuración (ej. clases de martes y jueves en columnas de martes y jueves).
- **Marcadores de entrega a su hora exacta:** las entregas de tareas no se acumulan en un encabezado, sino que se dibujan como marcadores horizontales (`.semana-marcador-entrega`) ubicados exactamente en la hora de entrega sobre el lienzo del día, identificadas con un pin (`🎯`) y coloreadas según su nivel de urgencia.
- Navegación semanal `‹ semana ›` con botón "Esta semana".
- Clic en cualquier bloque, clase fija o marcador de entrega abre su edición en el panel común.

### 5.3 Vista Pendientes (`vistas/pendientes.js`)
- Agrupación por nivel de urgencia: Vencidas $\to$ Urgentes $\to$ Pronto $\to$ Con tiempo $\to$ Completadas.
- Ordenamiento ascendente por `holguraH` dentro de cada grupo.
- **Subtareas plegables persistentes:** subtareas indentadas desplegables/plegables con botón chevron (▾). El estado de las tareas plegadas se guarda en `localStorage` (`itinerario_madres_plegadas`), manteniéndose intacto tras recargar la página.
- Filtro por materia y casilla para mostrar u ocultar completadas.
- Captura rápida: campo de texto superior para añadir tareas con tecla `Enter`.

### 5.4 Editor Unificado (`comun/editor.js`)
- Panel lateral deslizable en pantallas de escritorio; hoja inferior emergente (*bottom-sheet*) en pantallas menores a 760 px.
- Soporta edición completa de tareas, bloques y clases fijas.
- Confirmación de eliminación integrada en el panel (sin diálogos nativos `window.confirm`).

### 5.5 Coordinación y Deshacer (`comun/app.js`)
- Pila de historial inmutable (`historialDeshacer` y `historialRehacer`) de hasta 50 estados.
- Atajos globales `Ctrl+Z`, `Ctrl+Y`, `Ctrl+S` y `Escape`.
- Autoguardado diferido a 1 segundo del último cambio.
- Banner de resolución de conflictos ante respuestas `409` del servidor o notificaciones SSE.
- Cambio entre tema claro y tema oscuro respetando `prefers-color-scheme` y persistiendo preferencia en `localStorage`.

---

## 6. Planificador Automático (Fase 3)

### 6.1 Función Pura `planificar(datos, ahoraIso, dias = 2)` (`comun/modelo.js`)
- Retorna un objeto `{ bloquesPropuestos, avisosNoAlcanza }`.
1. **Detección de huecos disponibles:**
   - Para cada día en el horizonte de planificación (por defecto hoy y mañana):
     - Límite diario: de `config.inicioDia` a `config.finDia`.
     - Si el día es hoy, el inicio disponible arranca en `ahora`, redondeado hacia arriba al siguiente múltiplo de 15 minutos (`Math.ceil(minAhora / 15) * 15`).
     - Se descuentan todos los intervalos ocupados por clases fijas activas, bloques existentes en el estado (incluidos los confirmados y los propuestos) y el horario reservado de comida (`config.comida`).
     - Se unen intervalos solapados y se invierten para calcular los huecos libres continuos.
2. **Selección y ordenamiento de tareas:**
   - Solo se planifican tareas hoja (sin subtareas hijas) y que no estén en estado `hecha`.
   - Se descuentan del tiempo restante de cada tarea los minutos ya asignados en bloques futuros no completados (evitando duplicaciones).
   - Se ordenan de forma ascendente según su holgura (`holguraH`).
3. **Distribución en bloques:**
   - Los bloques respetan `bloqueMaxMin` (máximo configurable, por defecto 90 min) y nunca son inferiores a 15 min.
   - Todo bloque termina estrictamente después de su inicio (`fin > inicio`). Los bloques que alcanzan la medianoche se guardan con `fin: "24:00"`.
   - Se deja un espacio de descanso obligatorio `pausaMin` entre bloques consecutivos en un mismo hueco.
   - **Restricción de entrega:** ningún bloque puede colocarse después de la fecha y hora de entrega (`entrega`).
   - Todos los bloques nuevos se generan con `propuesto: true`.
4. **Detección de tareas sin tiempo suficiente ("No alcanza"):**
   - Si una tarea tiene fecha de entrega dentro del horizonte planificado (o matemáticamente `holguraH < 0`) y no se logra cubrir la totalidad de su tiempo requerido antes del límite, se genera un aviso:
     `{ tareaId, horasFaltantes, texto: "No alcanza: faltan X h" }`.

### 6.2 Interfaz de Usuario y Flujo de Aprobación
- **Botón "⚡ Planificar" en la vista Hoy:** ejecuta el algoritmo sobre hoy y mañana.
- **Visualización de comida:** el intervalo de comida (`config.comida`) se renderiza en la vista Hoy como un fijo suave (`.fijo-comida-suave`).
- **Sustitución sin acumulación:** volver a planificar limpia los bloques propuestos anteriores y genera el nuevo plan actualizado sin duplicados ni solapes.
- **Acciones por bloque:** cada bloque propuesto cuenta con botones independientes "Aceptar" (confirma a `propuesto: false`) y "Descartar" (elimina el bloque propuesto).
- **Acciones globales:** botones "Aceptar todos" y "Descartar todos" en la barra de herramientas de la vista Hoy cuando existen bloques propuestos en el sistema.
- **Insignias de advertencia:** se muestra la insignia destacada `⚠️ No alcanza: faltan X h` en:
  - La fila de la tarea en la vista **Pendientes**.
  - Los marcadores de entrega y la columna lateral de entregas en la vista **Hoy**.
