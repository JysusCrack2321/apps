# Project Organizer

Organiza un proyecto en **tres vistas sobre un solo archivo**:

| Vista | Responde |
|---|---|
| **EDT** | ¿Qué hay que hacer? (árbol de entregables y paquetes de trabajo) |
| **Gantt** | ¿Cuándo y quién? (barras, hitos, línea de hoy) |
| **Tabla** | Revisar, filtrar y exportar (CSV, copiar a Google Docs) |

Todo vive en `datos.json`. Es una página estática: **sin servidor, sin instalación, sin compilación**.

## Uso

- **Ver / editar en tu equipo**: desde esta carpeta ejecuta `python -m http.server` y abre <http://localhost:8000>.
  (Con doble clic en `index.html` también funciona, pero debes abrir el archivo con «Abrir…».)
- **Publicar**: sube la carpeta a GitHub y activa GitHub Pages. Si hay un `datos.json` junto a `index.html`, se carga solo.
- **Editar**: selecciona una actividad en cualquier vista → panel de edición a la derecha.
  Deshacer `Ctrl+Z` · Rehacer `Ctrl+Y` · Guardar `Ctrl+S`.
- **Guardar**: en Chrome/Edge escribe directo sobre el archivo abierto; en otros navegadores descarga `datos.json`.
  Después: `git commit` y `git push`. Git es el historial del proyecto.

## Cómo está hecho

```
datos.json ──► comun/modelo.js ──► vista activa (vistas/edt.js | gantt.js | tabla.js)
   ▲             (validar, códigos,          │ el usuario selecciona algo
   │              fechas, avance)            ▼
comun/archivo.js ◄── comun/app.js ◄── comun/editor.js (panel de edición)
 (abrir/guardar)     (estado, pestañas,
                      deshacer, guardar)
```

| Archivo | Responsabilidad |
|---|---|
| `comun/modelo.js` | Lógica pura de datos, sin DOM. Valida el JSON, calcula códigos EDT, fechas de los padres y avance; todas las ediciones (agregar, mover, eliminar…) devuelven datos nuevos. **Tiene pruebas.** |
| `comun/archivo.js` | Abrir y guardar el archivo; borrador de recuperación en el navegador. |
| `comun/app.js` | Arma la página, guarda el estado, coordina pestañas, deshacer/rehacer y guardar. |
| `comun/editor.js` | Panel de edición, común a las tres vistas. |
| `vistas/*.js` | Cada vista solo **dibuja** el modelo y avisa qué se seleccionó. No modifica datos y no conoce a las otras. |
| `comun/estilos.css` | Colores (claro/oscuro), tipografía y componentes. |

Reglas clave (detalle completo en [`ESPECIFICACION.md`](ESPECIFICACION.md)):

- Cada actividad tiene un `id` fijo, un `padre` y un `orden`. **El código (1, 1.1, 1.1.1) no se guarda: se calcula.**
- Solo las hojas (paquetes de trabajo) llevan fechas, responsable y estado; los padres los calculan.
- Los hitos (entregas, eventos) van aparte, en `hitos`.

## Desarrollo

- Pruebas del modelo: `npm test` (usa `node --test`, sin dependencias).
- `ejemplos/incubadora-neo.json`: proyecto de ejemplo completo.
- `herramientas/deepseek.py`: script con el que se generaron los módulos a partir de `ESPECIFICACION.md`
  (la clave se lee de `~/.config/deepseek/api_key`). No es necesario para usar ni modificar el proyecto.

---

## 🤖 Uso vía API y Conexión con IA

Project Organizer se expone vía HTTP con servidor local (`servidor.py`, puerto 8088):

- **Archivo de trabajo en el servidor:** El backend sirve y guarda sobre `guardados/actual.json` (respaldando periódicamente en `guardados/respaldo.json`).
- `GET /datos.json`: retorna la estructura del proyecto y la cabecera `ETag`.
- `POST /api/guardar`: guarda el proyecto y emite un evento Server-Sent Events (`/api/eventos`) para refrescar la interfaz de todos los navegadores conectados automáticamente.
  - **Requisito `If-Match`:** Responde `428 Precondition Required` si falta el encabezado `If-Match`.
  - **Validación de estructura:** Responde `400 Bad Request` si el JSON recibido no contiene los objetos obligatorios `proyecto` y `actividades`.
  - **Resolución de conflictos:** Responde `409 Conflict` si el ETag enviado no coincide con la versión actual en disco.
- Exportación Gantt a PNG: optimizada a escala 3x de alta definición para impresión sin márgenes transparentes sobrantes.

### Esquema de `datos.json` (fuente de verdad: `comun/modelo.js`)

> **Advertencia de convención:** En el EDT (`project-organizer`) las actividades usan `nombre`; en el Itinerario (`itinerario-app`) las tareas y los fijos usan `titulo`.

```json
{
  "version": 1,
  "proyecto": {
    "nombre": "Nombre del Proyecto",
    "descripcion": "Descripción opcional del proyecto"
  },
  "equipo": [
    "Ana Pérez",
    "Carlos Gómez"
  ],
  "actividades": [
    {
      "id": "act1",
      "padre": null,
      "orden": 1,
      "nombre": "Fase de Diseño",
      "responsable": "Ana Pérez",
      "notas": ""
    },
    {
      "id": "act2",
      "padre": "act1",
      "orden": 1,
      "nombre": "Diseño de circuitería",
      "responsable": "Carlos Gómez",
      "inicio": "2026-10-01",
      "fin": "2026-10-15",
      "estado": "en curso",
      "tipo": "tarea",
      "notas": ""
    },
    {
      "id": "act3",
      "padre": "act1",
      "orden": 2,
      "nombre": "Prototipo de PCB entregable",
      "responsable": "Carlos Gómez",
      "inicio": "2026-10-16",
      "fin": "2026-10-20",
      "estado": "pendiente",
      "tipo": "entregable",
      "notas": "Entregable para revisión"
    }
  ],
  "hitos": [
    {
      "id": "hito1",
      "nombre": "Entrega Fase 1",
      "inicio": "2026-10-20",
      "fin": "2026-10-20",
      "responsable": "Ana Pérez"
    }
  ]
}
```

#### Reglas de validación del esquema:
- **Estados válidos (`comun/modelo.js:5`):** `'pendiente'`, `'en curso'`, `'hecha'`, `'bloqueada'`.
- **Hojas vs Padres:** Las fechas (`inicio`, `fin`), el `estado` y el `tipo` solo se permiten en **nodos hoja** (sin hijos). En nodos padre, las fechas y el avance se calculan automáticamente a partir de sus descendientes.
- **Tipos de actividad:** `'tarea'` o `'entregable'`.
- **Responsables:** Cualquier cadena de texto asignada a `responsable` en una actividad o hito debe coincidir exactamente con un elemento de la lista `equipo`.
- **Formato de fechas:** Cadenas estrictas en formato `AAAA-MM-DD`. `fin` debe ser igual o posterior a `inicio`.
