# Project Organizer — Especificación v1

Herramienta web **estática** (sin servidor, sin compilación) para organizar un proyecto con tres vistas
sobre **un único archivo JSON**: **EDT** (qué), **Gantt** (cuándo/quién) y **Tabla** (revisar/exportar).

## Principios

- JavaScript puro con **módulos ES** (`<script type="module">`), sin frameworks, sin npm, sin build.
- Librerías externas solo por CDN y solo donde haga falta (D3 v7 para la EDT).
- Interfaz en **español**. Código en español (nombres de funciones y variables), comentarios breves.
- Todo texto que venga de los datos se pinta con `textContent` (nunca `innerHTML`) → sin XSS.
- Fechas siempre como texto `AAAA-MM-DD` y aritmética en UTC → sin errores de zona horaria.
- Cada vista es **independiente**: recibe el modelo y dibuja; no conoce a las demás.

## Estructura

```
index.html            marco: título editable, pestañas, pantalla de inicio, panel de edición
datos.json            (opcional) si existe junto a index.html, se carga automáticamente
comun/modelo.js       lógica pura de datos (sin DOM): validar, calcular códigos/fechas/avance, editar
comun/archivo.js      abrir / guardar / descargar el JSON, borrador en localStorage
comun/editor.js       panel de edición común a las tres vistas, deshacer/rehacer
comun/estilos.css     tokens de color (claro/oscuro), tipografía, componentes
vistas/edt.js         árbol EDT (D3)
vistas/gantt.js       diagrama de Gantt (canvas) + exportar PNG
vistas/tabla.js       tabla + exportar CSV + copiar para Google Docs
pruebas/modelo.test.js  pruebas con `node --test`
```

## Formato del archivo (versión 1)

```json
{
  "version": 1,
  "proyecto": { "nombre": "Incubadora NEO", "descripcion": "" },
  "equipo": ["Ana", "Luis"],
  "actividades": [
    { "id": "a1b2", "padre": null,   "orden": 1, "nombre": "Gestión del proyecto" },
    { "id": "c3d4", "padre": "a1b2", "orden": 1, "nombre": "Definir alcance",
      "responsable": "Ana", "inicio": "2026-10-06", "fin": "2026-10-10",
      "estado": "en curso", "notas": "" }
  ],
  "hitos": [
    { "id": "h1", "nombre": "Entrega informe", "inicio": "2026-10-20", "fin": "2026-10-20", "responsable": "" }
  ]
}
```

### Reglas

| Campo | Regla |
|---|---|
| `version` | Entero. Hoy siempre `1`. |
| `proyecto.nombre` | Texto no vacío, ≤ 120 caracteres. |
| `equipo` | Lista de nombres únicos (texto no vacío). |
| `actividades[].id` | Texto único en todo el archivo (actividades + hitos). **Nunca cambia.** |
| `actividades[].padre` | `null` (nivel 1) o el `id` de otra actividad. Sin ciclos. |
| `actividades[].orden` | Número; define la posición entre hermanos (se ordena ascendente). |
| `nombre` | Texto no vacío, ≤ 200 caracteres. |
| `responsable` | Opcional. Debe ser uno de `equipo` o vacío. |
| `inicio`, `fin` | Opcionales, **solo en hojas** (actividades sin hijos). `AAAA-MM-DD`, `fin ≥ inicio`. Van juntos (los dos o ninguno). |
| `estado` | Opcional, uno de: `pendiente`, `en curso`, `hecha`, `bloqueada`. Por defecto `pendiente`. Solo en hojas. |
| `notas` | Opcional, texto. |
| `hitos[]` | `id`, `nombre`, `inicio`, `fin` obligatorios (`fin ≥ inicio`); `responsable` opcional. Si `inicio == fin` es un **hito** (un día); si no, un **periodo**. |

### Valores calculados (no se guardan)

- **Código EDT**: según posición en el árbol: nivel 1 → `1`, `2`…; hijos → `1.1`, `1.2`…; nietos → `1.1.1`…
  El nodo raíz es el proyecto (sin código).
- **Fechas de un padre**: `inicio` = mínimo de los inicios de sus hojas descendientes con fechas; `fin` = máximo.
  Si ninguna hoja descendiente tiene fechas → sin fechas.
- **Avance** (0–1) de un nodo: hojas → `1` si `hecha`, si no `0`. Padre → promedio de **todas** sus hojas descendientes.
- **Nivel**: 1 para actividades con `padre: null`, etc.

## Contrato de `comun/modelo.js` (puro, sin DOM, usable en navegador y en Node)

```js
export const ESTADOS = ['pendiente', 'en curso', 'hecha', 'bloqueada'];
export const VERSION = 1;

// Crear
export function proyectoVacio(nombre, equipo = [])            // → datos válidos sin actividades
export function proyectoDesdePlantilla(nombre, equipo, plantilla) // plantilla: 'vacia' | 'basica'
//   'basica' = 4 actividades nivel 1: Planeación, Ejecución, Pruebas, Cierre (sin fechas)

// Validar
export function validar(datos)  // → { ok: boolean, errores: string[] }  (mensajes en español, concretos)

// Construir la vista calculada (no modifica `datos`)
export function construir(datos) // → Modelo
// Modelo = {
//   proyecto, equipo, hitos,                       // copias de los datos
//   raiz: Nodo,                                    // nodo raíz = proyecto (id: null, codigo: '', nivel: 0)
//   porId: Map<id, Nodo>,
//   lista: Nodo[],                                 // recorrido en preorden, sin la raíz
//   hojas: Nodo[],                                 // nodos sin hijos, en preorden
//   rango: { inicio, fin } | null                  // mín/máx de hojas con fechas y de hitos
// }
// Nodo = { id, padre, nombre, codigo, nivel, hijos: Nodo[], esHoja,
//          responsable, estado, notas, inicio, fin, avance, datos /* referencia al objeto original */ }

// Editar: todas devuelven NUEVOS datos (inmutables, copia profunda); lanzan Error con mensaje en español si la operación es inválida
export function nuevoId(datos)                            // id corto único (4–6 caracteres a-z0-9)
export function agregarActividad(datos, { padre, nombre, despuesDe }) // → { datos, id }
//   padre: id o null. Si `despuesDe` (id de un hermano) se inserta justo después; si no, al final.
//   Si el padre era hoja con fechas/estado, esos campos se eliminan del padre (ahora tiene hijos).
export function editarActividad(datos, id, cambios)       // cambios: { nombre?, responsable?, inicio?, fin?, estado?, notas? }
export function moverActividad(datos, id, nuevoPadre, posicion) // posicion: índice 0-based entre los nuevos hermanos; impide ciclos
export function subir(datos, id) / bajar(datos, id)        // intercambia con el hermano anterior/siguiente
export function eliminarActividad(datos, id)               // elimina la actividad y TODOS sus descendientes
export function contarDescendientes(datos, id)
export function agregarHito(datos, { nombre, inicio, fin, responsable }) // → { datos, id }
export function editarHito(datos, id, cambios)
export function eliminarHito(datos, id)
export function editarProyecto(datos, { nombre, descripcion })
export function editarEquipo(datos, equipo)   // si se quita un nombre, se limpia como responsable donde aparezca

// Utilidades de fechas (UTC, texto AAAA-MM-DD)
export function esFecha(texto)
export function diasEntre(inicio, fin)   // inclusivo: mismo día → 1
export function sumarDias(fecha, n)
```

Tras cada operación, `orden` de los hermanos afectados se **renormaliza** a 1, 2, 3…

## Comportamiento de la aplicación (resumen, se detalla por vista)

- **Inicio**: si no hay proyecto → pantalla con "Nuevo proyecto" (nombre, equipo, plantilla vacía/básica) y "Abrir datos.json".
- **Título**: nombre del proyecto, editable con clic.
- **Pestañas**: EDT · Gantt · Tabla. Seleccionar una actividad en cualquier vista abre el **panel de edición** común.
- **Guardar**: los cambios viven en memoria; indicador "cambios sin guardar"; deshacer/rehacer (Ctrl+Z / Ctrl+Y).
  "Guardar" escribe en el archivo abierto (File System Access API en Chrome/Edge) o **descarga** `datos.json` (otros).
  Borrador automático en `localStorage` para recuperar si se cierra la pestaña.
- **Estilo**: mismo lenguaje visual que la herramienta de Gantt anterior (fuente Archivo, tokens de color claro/oscuro).

## Cómo se conectan las piezas (contratos de interfaz)

```
          datos (JSON)  ──construir()──►  modelo  ──►  vista activa (EDT | Gantt | Tabla)
               ▲                              │                │ alSeleccionar(id)
               │                              ▼                ▼
   app.js: historial (deshacer/rehacer) ◄── editor.js (panel)  ◄── selección
               │ aplicar(f): datos → f(datos)
               └──► guardar / borrador
```

### Vistas (`vistas/edt.js`, `vistas/gantt.js`, `vistas/tabla.js`)

Cada vista exporta una sola función:

```js
export function crearVista(contenedor, { alSeleccionar }) // → { mostrar(modelo, seleccionId), destruir() }
```

- `contenedor`: elemento vacío donde la vista dibuja. La vista no toca nada fuera de él.
- `alSeleccionar(id)`: la vista lo llama cuando el usuario hace clic en una actividad (id) o hito (id); `null` = nada.
- `mostrar(modelo, seleccionId)`: se llama al abrir la pestaña y cada vez que cambian los datos o la selección.
  Debe ser rápido y mantener el estado propio de la vista (zoom, ramas abiertas, filtros) entre llamadas.
- `destruir()`: quita escuchas (resize, teclado) al cambiar de pestaña.
- La vista **nunca modifica datos**: solo lee el modelo y avisa la selección.

### Editor (`comun/editor.js`)

```js
export function crearEditor(contenedor, { aplicar, alSeleccionar }) // → { mostrar(modelo, seleccionId) }
```

- Muestra el formulario de la actividad u hito seleccionado (o un mensaje si no hay selección).
- Para cambiar datos llama `aplicar(f)`, donde `f` es una función `datos → datos nuevos` hecha con las
  funciones de `modelo.js`. Si `f` lanza Error, `aplicar` lo muestra al usuario y no cambia nada.
- Tras crear una actividad nueva llama `alSeleccionar(idNuevo)`.

### Aplicación (`comun/app.js`)

Estado: `{ datos, manejador, nombreArchivo, historial[], futuro[], sinGuardar, seleccion, pestaña }`.

- **Inicio**: si `cargarDesdeServidor()` trae datos → abrirlos. Si no → pantalla de inicio
  (Nuevo proyecto: nombre, equipo separado por comas, plantilla vacía/básica · Abrir archivo).
  Si hay borrador en localStorage → ofrecer "Recuperar borrador del <fecha>".
- **aplicar(f)**: `nuevos = f(datos)`; guarda `datos` en `historial` (máx. 100), vacía `futuro`,
  marca `sinGuardar`, guarda borrador, vuelve a construir el modelo y refresca vista + editor.
- **Teclado**: Ctrl+Z deshacer · Ctrl+Y / Ctrl+Shift+Z rehacer · Ctrl+S guardar (solo si el foco no está en un campo de texto, salvo Ctrl+S).
- **Guardar**: `archivo.guardar(datos, manejador)`; al terminar, `sinGuardar = false` y borrar borrador.
- **Aviso al cerrar** la pestaña con cambios sin guardar (`beforeunload`).
- **Pestañas**: EDT · Gantt · Tabla; recuerda la última en localStorage (con try/catch).
- **Título**: nombre del proyecto en la cabecera; clic → campo editable → Enter/blur aplica `editarProyecto`.
- Cabecera: título · indicador "● sin guardar" · botones Deshacer, Rehacer, Guardar, Abrir, Nuevo.

## Diseño visual

Mismo lenguaje que la página de Gantt anterior: fuente **Archivo** (Google Fonts) e **IBM Plex Mono** para códigos,
fondo gris claro, paneles blancos con borde suave y radio 12 px, acento azul.

```css
:root{ --bg:#ECEFF2; --surface:#FFFFFF; --surface2:#F5F7F9; --ink:#15202B; --muted:#5A6774; --line:#D3D9DF;
       --accent:#1F4FD1; --accent-ink:#FFFFFF; --chip:#E2E7EC; --ok:#1B7A4B; --warn:#9E6310; --bad:#BA2F27; }
/* oscuro (prefers-color-scheme: dark, salvo data-theme="light"; y data-theme="dark") */
     --bg:#0F161D; --surface:#17212B; --surface2:#1C2733; --ink:#E5EBF0; --muted:#95A3B0; --line:#2B3947;
     --accent:#7C9CFF; --accent-ink:#0F161D; --chip:#23303D; --ok:#4CC38A; --warn:#E3A948; --bad:#F0736B;
```

Distribución: cabecera arriba; debajo, a la izquierda la vista activa (ocupa todo el ancho disponible) y a la derecha
el panel de edición (≈ 320 px; en pantallas < 900 px pasa debajo). Responsive hasta 360 px de ancho.
