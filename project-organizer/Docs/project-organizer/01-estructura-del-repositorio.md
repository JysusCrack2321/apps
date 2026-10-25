# Estructura del Repositorio — Project Organizer

**Project Organizer** es una aplicación web estática escrita en JavaScript moderno (módulos ES nativos), sin frameworks, sin empaquetadores (*bundlers*) y sin dependencias de compilación. Todo el estado de un proyecto reside en un único archivo JSON (`datos.json`) que se visualiza y edita desde tres vistas sincronizadas: **EDT**, **Gantt** y **Tabla**.

---

## 1. Árbol de archivos

```text
project-organizer/
├── index.html                  # Punto de entrada HTML (carga fuentes, estilos y comun/app.js)
├── servidor.py                 # Servidor HTTP en Python 3 (sirve el JSON más reciente y guarda versiones)
├── datos.json                  # Proyecto base por defecto (versionado en Git)
├── guardados/                  # Versiones guardadas (datos2.json, datos3.json…), ignorada por Git
├── .gitignore                  # Ignora guardados/ y datosN.json generados
├── package.json                # Configuración mínima para correr pruebas con Node (npm test)
├── README.md                   # Resumen general del proyecto
├── ESPECIFICACION.md           # Contrato técnico y reglas de negocio detalladas
│
├── comun/                      # Núcleo de la aplicación (datos, estado, persistencia y estilos)
│   ├── modelo.js               # Lógica pura e inmutable (validación, cálculos EDT/fechas/avance, edición)
│   ├── archivo.js              # Guardado en servidor o local, listado de versiones y borrador en localStorage
│   ├── app.js                  # Coordinador principal (estado, historial Ctrl+Z/Y, pestañas, cabecera)
│   ├── editor.js               # Panel lateral derecho para editar actividades e hitos
│   └── estilos.css             # Sistema de diseño, variables CSS y tema claro/oscuro
│
├── vistas/                     # Vistas independientes (solo leen el modelo y notifican selección)
│   ├── edt.js                  # Árbol de Estructura de Desglose del Trabajo (D3 v7 en SVG)
│   ├── gantt.js                # Diagrama de Gantt interactivo en <canvas> + exportación PNG
│   └── tabla.js                # Tabla con filtros, ordenamiento, exportación CSV y copia para Docs
│
├── pruebas/                    # Pruebas unitarias automatizadas
│   └── modelo.test.js          # Suite de pruebas para comun/modelo.js (ejecutada con node --test)
│
├── ejemplos/                   # Proyectos de referencia
│   └── incubadora-neo.json     # Copia del proyecto de ejemplo "Incubadora portátil NEO"
│
├── herramientas/               # Scripts auxiliares de desarrollo
│   └── deepseek.py             # Generador asistido de módulos a partir de la especificación
│
└── Docs/                       # Documentación (enlazada al vault de Obsidian)
    └── project-organizer/
        ├── 01-estructura-del-repositorio.md
        ├── 02-servicio-y-tunel-cloudflare.md
        ├── 03-guia-de-uso.md
        └── 04-acceso-cloudflare-y-google.md
```

---

## 2. Flujo de datos y arquitectura

La arquitectura separa estrictamente los **datos puros**, la **coordinación de estado** y la **representación visual**:

```text
datos.json (JSON crudo)
    │
    ▼  construir(datos)
comun/modelo.js  ──────────────────────► Modelo calculado (árbol, códigos EDT, fechas, avance)
    ▲                                         │
    │ funciones puras de edición              ├────► Vista activa (vistas/edt.js | gantt.js | tabla.js)
    │ (agregar, editar, mover, eliminar)      │          │
    │                                         │          ▼ alSeleccionar(id)
comun/app.js (historial deshacer/rehacer) ◄───┴──── comun/editor.js (panel lateral de edición)
    │
    ▼
comun/archivo.js (Guardar en disco / Descargar JSON / Borrador en localStorage)
```

### Responsabilidad de cada módulo

1. **`comun/modelo.js` (Lógica pura, sin DOM)**
   - No toca el navegador (`window` ni `document`), por lo que funciona igual en el navegador y en Node.js.
   - **Inmutabilidad**: Ninguna función modifica el objeto `datos` recibido; todas las operaciones (`agregarActividad`, `editarActividad`, `moverActividad`, `subir`, `bajar`, `eliminarActividad`, `agregarHito`, etc.) devuelven un nuevo objeto clonado y validado.
   - **`construir(datos)`**: Transforma los datos planos en un árbol enriquecido donde calcula automáticamente:
     - **Código EDT** (`1`, `1.1`, `1.1.2`…) según la jerarquía y el campo `orden`.
     - **Fechas de actividades padre**: `inicio` = mínimo inicio de sus hojas descendientes; `fin` = máximo fin de sus hojas descendientes.
     - **Avance (`0` a `1`)**: En hojas es `1` si el estado es `"hecha"` y `0` en caso contrario; en padres es el promedio de todas sus hojas descendientes.

2. **`comun/archivo.js` (Persistencia)**
   - Intenta cargar `datos.json` automáticamente mediante `fetch('datos.json')` al iniciar.
   - Permite abrir y guardar archivos locales usando la **File System Access API** (`showOpenFilePicker` / `showSaveFilePicker`) en navegadores compatibles (Chrome, Edge, Brave), o mediante `<input type="file">` y descarga directa en otros navegadores (Firefox, Safari).
   - Mantiene un **borrador automático** en `localStorage` ante cada cambio para evitar pérdida de trabajo si se cierra la pestaña accidentalmente.

3. **`comun/app.js` (Coordinación)**
   - Mantiene el estado en memoria (`datos`, `modelo`, `historial`, `futuro`, `seleccion`, `pestana`).
   - Implementa la función `aplicar(fn)`: ejecuta la transformación sobre `datos`, guarda la versión anterior en la pila `historial` (hasta 100 pasos para `Ctrl+Z` / `Ctrl+Y`), actualiza el borrador y refresca tanto la vista activa como el panel de edición.
   - Gestiona la ventana modal de **Equipo** (agregar, renombrar en cascada o quitar integrantes).

4. **`comun/editor.js` (Panel lateral)**
   - Muestra el formulario contextual según lo que esté seleccionado (una actividad hoja, una actividad padre, un hito o nada).
   - Si la actividad seleccionada tiene subactividades (no es hoja), oculta los campos de fecha/estado/responsable manuales y muestra las fechas y el porcentaje de avance calculados.

5. **`vistas/edt.js`, `vistas/gantt.js`, `vistas/tabla.js` (Vistas independientes)**
   - Todas implementan la misma interfaz:
     ```js
     export function crearVista(contenedor, { alSeleccionar }) // → { mostrar(modelo, seleccionId), destruir() }
     ```
   - Ninguna vista modifica los datos ni conoce a las demás; únicamente dibujan el `modelo` recibido y llaman a `alSeleccionar(id)` cuando el usuario hace clic en un elemento.

---

## 3. Reglas del modelo de datos (`datos.json`)

- **Identificadores fijos (`id`)**: Cada actividad e hito tiene un `id` único que nunca cambia aunque la actividad se mueva o reordene.
- **Códigos calculados**: Los códigos (`1.2.1`) nunca se guardan en `datos.json`; se recalculan siempre en memoria a partir de `padre` y `orden`.
- **Diferencia entre Padres y Hojas**:
  - **Hojas** (paquetes de trabajo sin subactividades): Pueden tener `responsable`, `inicio`, `fin`, `estado` (`pendiente`, `en curso`, `hecha`, `bloqueada`) y `notas`.
  - **Padres** (entregables o fases con subactividades): Solo guardan `id`, `padre`, `orden` y `nombre`. Si una hoja recibe un hijo nuevo, sus fechas y estado propios se limpian automáticamente para pasar a ser calculados.
- **Hitos y periodos**: Se almacenan en la lista `hitos`. Si `inicio === fin`, se representa como un hito puntual (rombo); si `fin > inicio`, se representa como un periodo.

---

## 4. Pruebas automatizadas

El módulo `comun/modelo.js` cuenta con pruebas unitarias en `pruebas/modelo.test.js` que utilizan el ejecutor nativo de Node.js (sin dependencias externas):

```bash
npm test
# equivalente a: node --test pruebas/*.test.js
```
