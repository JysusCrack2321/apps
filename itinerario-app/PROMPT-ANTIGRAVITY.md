# Contrato de proyecto: Itinerario (app personal de tareas y horario)

Eres el desarrollador de este proyecto. Lee este documento completo antes de escribir código.
Trabaja **por fases**: termina una fase, verifica sus criterios de aceptación, muéstrame el resultado y **espera mi aprobación** antes de seguir con la siguiente. No agregues funciones que no estén aquí; si algo no está claro, pregúntame.

---

## 1. Objetivo

Soy estudiante de ingeniería mecatrónica. Tengo muchas entregas, clases y proyectos al tiempo. La app debe responder dos preguntas:

1. **¿Qué hago ahora?**: un itinerario por horas para hoy.
2. **¿Qué viene y qué tan urgente es?**: las entregas ordenadas por urgencia calculada.

Uso personal: corre en mi laptop (Linux) y después en una Orange Pi Zero 3 dentro de mi red. Tiene que verse bien en el celular.

## 2. Restricciones técnicas (obligatorias)

- **Frontend:** HTML, CSS y JavaScript puros con **módulos ES**. **Sin frameworks, sin npm en tiempo de ejecución, sin paso de compilación, sin CDN.** Todo local.
- **Backend:** un solo archivo `servidor.py` con **solo la biblioteca estándar de Python 3** (`http.server`, `json`, `pathlib`…). Nada de Flask, FastAPI ni pip.
- **Datos:** un solo archivo `datos.json`. Sin base de datos.
- **Idioma:** interfaz, nombres de variables, funciones y comentarios **en español**. Comentarios breves.
- **Zona horaria:** America/Bogota. Fechas en ISO local sin zona: `"2026-10-14"`, `"2026-10-14T23:59"`, horas `"14:30"`.
- Pruebas del modelo con `node --test`, sin dependencias.

### Proyecto de referencia (léelo antes de empezar)
En `~/apps/project-organizer/` hay una app mía con la misma filosofía. **Úsala como guía de arquitectura y estilo, no la copies a ciegas:**
- `comun/modelo.js`: lógica pura sin DOM; todas las ediciones devuelven datos nuevos (inmutables).
- `comun/editor.js`: panel de edición lateral común a todas las vistas.
- `comun/app.js`: estado, pestañas, deshacer/rehacer (`Ctrl+Z` / `Ctrl+Y`), guardar (`Ctrl+S`).
- `comun/estilos.css`: tokens de color claro/oscuro.
- `servidor.py`: servidor estándar con endpoints de guardado.
- `ESPECIFICACION.md` y `README.md`: formato de documentación esperado.

## 3. Estructura de archivos

```
itinerario-app/
├── index.html
├── datos.json              ← datos reales (los edito yo y también Claude, a mano)
├── servidor.py
├── respaldos/              ← copias automáticas antes de cada guardado (las últimas 30)
├── comun/
│   ├── modelo.js           ← lógica pura: validar, calcular urgencia, editar, planificar
│   ├── tiempo.js           ← utilidades de fecha y hora (sin DOM)
│   ├── archivo.js          ← cargar/guardar contra el servidor, escuchar cambios
│   ├── app.js              ← estado, pestañas, deshacer, atajos
│   ├── editor.js           ← panel de edición
│   └── estilos.css
├── vistas/
│   ├── hoy.js
│   ├── semana.js
│   └── pendientes.js
├── pruebas/
│   └── modelo.test.js
├── README.md
└── ESPECIFICACION.md       ← la escribes tú al final de la fase 1, describiendo lo implementado
```

Regla de capas (igual que en project-organizer): **las vistas solo dibujan y avisan qué se seleccionó; nunca modifican datos.** Todas las modificaciones pasan por `modelo.js` y las coordina `app.js`.

## 4. Modelo de datos (`datos.json`)

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
      "id": "t-parcial-proc1",
      "titulo": "Estudiar parcial Procesos 1",
      "materia": "proc1",
      "padre": null,
      "entrega": "2026-10-15T07:00",
      "duracionMin": 240,
      "avance": 0,
      "estado": "pendiente",
      "notas": "Fundición, deformación plástica, laminado y forja"
    }
  ],
  "bloques": [
    { "id": "b-1", "fecha": "2026-10-14", "inicio": "20:00", "fin": "22:00", "tarea": "t-parcial-proc1", "hecho": false, "propuesto": false }
  ],
  "fijos": [
    { "id": "f-1", "titulo": "Clase Procesos 1", "materia": "proc1", "dias": [2, 4], "inicio": "07:00", "fin": "09:00", "lugar": "", "desde": "2026-08-01", "hasta": "2026-12-15" }
  ]
}
```

Reglas:
- `id` fijo y único, generado por la app (`t-`, `b-`, `f-` + sufijo aleatorio corto). Nunca se reutiliza.
- `estado`: `"pendiente" | "en curso" | "hecha"`.
- `padre`: id de otra tarea, para subtareas (ej. *TPI → Árbol de objetivos*). Una tarea con hijas calcula su `duracionMin` y su `avance` a partir de ellas; esos campos no se editan en la madre.
- `avance`: 0–100.
- `dias` en `fijos`: 1 = lunes … 7 = domingo.
- `bloques.tarea` puede ser `null`, para un bloque libre como "Comer" o "Pausa"; en ese caso lleva un campo `titulo`.
- `bloques.propuesto: true` = sugerido por el planificador y todavía no aceptado.
- **Validación tolerante:** si el JSON trae campos faltantes, se completan con valores por defecto; si trae algo inválido (ej. un `padre` que no existe), se muestra un aviso no bloqueante y la app sigue funcionando. Nunca debe quedar en blanco por un dato malo.

## 5. Urgencia (calculada, nunca escrita a mano)

Para cada tarea no hecha:

- `restanteMin = duracionMin × (1 − avance/100)`
- `horasHasta = horas desde ahora hasta entrega`
- `holguraH = horasHasta − restanteMin/60`

| Nivel | Condición | Color |
|---|---|---|
| **Vencida** | `horasHasta < 0` | rojo intenso + etiqueta "Vencida" |
| **Urgente** | `holguraH < 24` | rojo |
| **Pronto** | `holguraH < 72` | ámbar |
| **Con tiempo** | el resto | gris |
| **Hecha** | `estado = "hecha"` | gris tachado |

El color nunca es la única señal: siempre va acompañado del texto del nivel (ej. "Urgente · faltan 6 h").

## 6. Vistas

Pestañas arriba: **Hoy · Semana · Pendientes**. Panel de edición a la derecha (en el celular, hoja que sube desde abajo).

### 6.1 Hoy
- Línea de tiempo vertical por horas, entre `inicioDia` y `finDia`.
- Se dibujan: **fijos** del día (fondo rayado, no editables desde aquí), **bloques** (color de la materia, título, hora, nota) y **bloques propuestos** (borde punteado y botones "Aceptar" / "Descartar").
- **Línea de "ahora"** que se actualiza cada minuto.
- Clic en un bloque → se abre en el editor. Botón ✓ en cada bloque para marcarlo hecho.
- **Arrastrar** un bloque cambia su hora (pasos de 15 min). **Arrastrar el borde inferior** cambia su duración.
- Columna lateral con **"Entregas de hoy y mañana"**.
- Selector de fecha (‹ hoy ›) para ver otro día.

### 6.2 Semana
- 7 columnas (lunes a domingo) con fijos, bloques y entregas (un marcador en la hora de entrega).
- Navegación ‹ semana ›. Clic en un elemento → editor.

### 6.3 Pendientes
- Lista de tareas no hechas, **ordenada por `holguraH` ascendente**, agrupadas por nivel de urgencia.
- Cada fila: título, materia (punto de color), entrega ("mié 14, 11:59 pm"), barra de avance y etiqueta de urgencia.
- Subtareas indentadas bajo su madre (se pueden plegar).
- Filtros: por materia y "mostrar hechas".
- Botón **"+ Tarea"** y campo de **captura rápida**: escribo un título y Enter, y se crea con la entrega en blanco para completar.

### 6.4 Editor (común)
Formulario según el tipo (tarea, bloque o fijo), con validación en línea. Botones: Guardar cambios, Duplicar, Eliminar (con confirmación dentro de la página, nunca `alert`/`confirm` del navegador).

## 7. Planificador (fase 3)

Botón **"Planificar"** en la vista Hoy (planifica hoy y mañana):
1. Calcula los huecos libres entre `inicioDia` y `finDia`, descontando fijos y bloques existentes. Desde "ahora" si el día es hoy.
2. Ordena las tareas pendientes por `holguraH` ascendente.
3. Llena los huecos con bloques de máximo `bloqueMaxMin`, dejando `pausaMin` entre bloques, hasta cubrir el `restanteMin` de cada tarea. **Nunca pone un bloque después de la entrega de su tarea.**
4. Los bloques se crean con `propuesto: true`. Nada se confirma sin que yo lo acepte, uno por uno o con "Aceptar todos".
5. Si una tarea no cabe antes de su entrega, la marca con el aviso "No alcanza: faltan X h".

Es una función pura en `modelo.js`, con pruebas.

## 8. Servidor y sincronización

`python3 servidor.py [puerto] [--bind dirección]`. Por defecto: puerto **8090** y bind `127.0.0.1`.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/` y archivos estáticos | Sirve la app. **Solo** archivos dentro de la carpeta del proyecto: nada de rutas con `..` ni archivos ocultos |
| GET | `/api/datos` | Devuelve `datos.json` y su `mtime` (en el encabezado `ETag`) |
| POST | `/api/datos` | Guarda. Exige el encabezado `If-Match` con el ETag que tenía el cliente. Si el archivo cambió en disco desde entonces → **409** (no sobrescribe). Antes de escribir copia el actual en `respaldos/` (deja los últimos 30). Escritura atómica (archivo temporal + rename) |
| GET | `/api/eventos` | **Server-Sent Events**: revisa el `mtime` de `datos.json` cada segundo y emite `cambio` cuando alguien lo editó por fuera |

**Esto es clave:** Claude (otra IA) va a editar `datos.json` directamente cuando yo se lo pida por voz. La app tiene que:
- Al recibir `cambio` sin cambios locales pendientes → recargar los datos sola y mostrar un aviso discreto: "Actualizado desde el archivo".
- Al recibir `cambio` con cambios locales sin guardar → **no perder nada**: mostrar un aviso con dos opciones, "Recargar (descartar lo mío)" o "Mantener lo mío", y si elijo la segunda, guardar con el ETag nuevo.
- Guardado automático 1 segundo después del último cambio, además de `Ctrl+S`.

## 9. Estilos

- Variables CSS en `:root` para todos los colores; **modo claro y oscuro** según `prefers-color-scheme`, con un interruptor manual que se recuerda en `localStorage`.
- Paleta base, que puedes refinar manteniendo el carácter:
  - Claro: fondo `#f6f5f2`, panel `#ffffff`, texto `#1d1d1b`, texto suave `#6b6a66`, líneas `#e3e1dc`.
  - Oscuro: fondo `#161615`, panel `#201f1d`, texto `#ecebe8`, texto suave `#9d9b96`, líneas `#34332f`.
  - Urgente `#d6453d`/`#ef6a61` · Pronto `#d99a1e`/`#e8b44a` · Con tiempo `#8a8984` · Ahora `#2f6fde`/`#6b9cff`.
- Tipografía del sistema (`system-ui`), 15 px de base. Bordes redondeados de 8–10 px. Sombras mínimas.
- Contraste de texto de al menos 4.5:1.
- **Adaptable:** a menos de 760 px, una sola columna, pestañas abajo como barra de navegación, editor como hoja inferior, áreas táctiles de 44 px o más y nada de scroll horizontal.
- Sin animaciones innecesarias; las transiciones, cortas (150 ms).

## 10. Fases y criterios de aceptación

### Fase 1: MVP (reemplaza mi itinerario actual)
- `servidor.py` con GET/POST `/api/datos`, ETag, 409, respaldos y escritura atómica.
- `modelo.js` + `tiempo.js` con validación, urgencia y ediciones (crear, editar, eliminar, marcar hecho).
- Vistas **Hoy** (sin arrastrar todavía) y **Pendientes**, más el **editor**.
- Deshacer/rehacer y guardado automático.
- `datos.json` de ejemplo con los datos de la sección 11.
- `pruebas/modelo.test.js`: validación, cálculo de urgencia (incluye vencida y subtareas) y ediciones inmutables.
- **Acepto si:** `node --test` pasa · creo, edito y marco una tarea desde la app y el cambio queda en `datos.json` · al editar `datos.json` a mano y recargar la página aparece el cambio · un POST con un ETag viejo devuelve 409 · se ve bien a 390 px de ancho.

### Fase 2: Semana, arrastrar y fijos
- Vista Semana, clases fijas, arrastrar y redimensionar bloques, subtareas plegables.
- **Acepto si:** muevo un bloque arrastrando y se guarda · un fijo de martes y jueves aparece en esos días.

### Fase 3: Planificador
- Botón Planificar, bloques propuestos y aviso "No alcanza". Funciona con pruebas.
- **Acepto si:** con 3 tareas de ejemplo propone bloques sin solaparse con fijos ni pasar la entrega.

### Fase 4: Sincronización en vivo
- `/api/eventos` (SSE), recarga automática y el manejo del conflicto de la sección 8.
- **Acepto si:** con la app abierta, edito `datos.json` en otro editor y en menos de 2 segundos la app se actualiza sola.

## 11. Datos iniciales para `datos.json`

Materias: Procesos de Manufactura I, TPI, ION (proyecto Kyma), Finanzas, Robótica (ROS), Lab Sofrony.

Tareas:
| Título | Materia | Entrega | Duración | Estado |
|---|---|---|---|---|
| Estudiar parcial Procesos 1 (fundición, deformación plástica, laminado, forja) | Procesos I | 2026-10-15 07:00 | 4 h | pendiente |
| TPI | TPI | 2026-10-14 23:59 | — (madre) | pendiente |
| ↳ Corregir árbol de objetivos | TPI | 2026-10-14 23:59 | 1 h | pendiente |
| ↳ Generar requerimientos | TPI | 2026-10-14 23:59 | 1 h | pendiente |
| ↳ Matriz de alternativas | TPI | 2026-10-14 23:59 | 1 h | pendiente |
| ↳ Preparar pitch | TPI | 2026-10-14 23:59 | 1 h | pendiente |
| Actualizar EDT ION | ION | 2026-10-14 23:59 | 1 h | pendiente |
| Calificar taller 2 (3 compañeros) | Procesos I | 2026-10-14 23:59 | 1 h | pendiente |
| Simulación + ROS en GitHub | Robótica | 2026-10-16 18:00 | 1 h | pendiente |
| ROS en la RPi5 | Robótica | 2026-10-16 18:00 | 2 h | pendiente |

## 12. Lo que NO debes hacer

- No usar frameworks, bundlers, CDN, ni dependencias de Python o npm en tiempo de ejecución.
- No usar `alert`, `confirm` ni `prompt` del navegador.
- No guardar los datos en `localStorage` (solo preferencias visuales, como el tema).
- No sobrescribir `datos.json` sin el control de ETag.
- No inventar funciones fuera de este contrato. No hacer commits ni push sin que yo lo pida.
- No pasar a la siguiente fase sin mi aprobación.

## 13. Entregables por fase

Al cerrar cada fase dame: 1) la lista de archivos creados o cambiados, 2) cómo probarla (comandos exactos), 3) el resultado de `node --test` y 4) qué quedó pendiente o qué decisiones tomaste que no estaban en el contrato.
