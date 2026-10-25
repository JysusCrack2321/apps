Escribe `comun/app.js` completo: el coordinador de la aplicación, según la sección
"Aplicación (comun/app.js)" y "Cómo se conectan las piezas" de la especificación.

Contexto fijo:
- `index.html` solo tiene `<div id="app"></div>` y carga este módulo y `comun/estilos.css`.
  **app.js construye todo el DOM** dentro de #app (cabecera, pestañas, zona de vista, panel de editor,
  pantalla de inicio, avisos). Usa `document.createElement` + `textContent` (nunca innerHTML con datos).
- Importa:
  `import * as M from './modelo.js';`
  `import * as A from './archivo.js';`
  `import { crearEditor } from './editor.js';`
  `import { crearVista as vistaEdt } from '../vistas/edt.js';` (igual para gantt y tabla)
- Clases CSS que debes usar (luego se escribirá estilos.css a partir de tu código, así que usa nombres
  claros en español con prefijo `po-`, p. ej. `po-cabecera`, `po-titulo`, `po-pestanas`, `po-pestana`,
  `po-activa`, `po-cuerpo`, `po-vista`, `po-editor`, `po-inicio`, `po-boton`, `po-primario`, `po-aviso`,
  `po-singuardar`, `po-campo`). Pon al inicio del archivo un comentario con la lista de clases usadas.

Comportamiento obligatorio:
- Pantalla de inicio cuando no hay proyecto: formulario Nuevo proyecto (nombre, equipo separado por comas,
  plantilla: radio "Vacío" / "Básica") y botón "Abrir archivo…". Si hay borrador, botón
  "Recuperar borrador del <fecha local legible>" y botón "Descartar".
- Cabecera con: título del proyecto (clic → input; Enter o blur aplica `M.editarProyecto`, Escape cancela),
  indicador "● sin guardar" visible solo si hay cambios, botones Deshacer, Rehacer (deshabilitados si no aplica),
  Guardar, Abrir…, Nuevo… (Nuevo/Abrir piden confirmación si hay cambios sin guardar).
- Pestañas EDT · Gantt · Tabla. Al cambiar: `destruir()` la vista anterior, crear la nueva en un contenedor
  vacío y llamar `mostrar(modelo, seleccion)`. Recordar la pestaña en localStorage (try/catch).
- `aplicar(f)`: como dice la especificación. Si `f` lanza Error → mostrar aviso (po-aviso, desaparece a los 5 s)
  y no cambiar nada. Si la selección deja de existir (p. ej. tras eliminar) → seleccion = null.
- Deshacer/rehacer con historial de máximo 100 estados.
- Atajos de teclado (Ctrl/Cmd): Z deshacer, Y o Shift+Z rehacer, S guardar (preventDefault).
  Z/Y no actúan si el foco está en un input/textarea/select (para no romper el deshacer del texto).
- Guardar: `A.guardar(datos, manejador)`; si devuelve null (cancelado) no cambia nada; si no, guarda el manejador,
  `sinGuardar=false`, `A.borrarBorrador()` y aviso "Guardado" ("Descargado datos.json" si modo descarga).
- `beforeunload` avisa si hay cambios sin guardar.
- Al arrancar: `A.cargarDesdeServidor()`; si lanza error → aviso con el mensaje y pantalla de inicio.
- Clic en zona vacía de la vista no debe deseleccionar (eso lo decide cada vista llamando alSeleccionar(null)).

Mantenlo legible: funciones cortas con nombre claro, sin clases, estado en un solo objeto `estado`.
Objetivo aproximado: 300–400 líneas.
