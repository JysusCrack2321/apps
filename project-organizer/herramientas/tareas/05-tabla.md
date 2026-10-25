Escribe `vistas/tabla.js` completo según el contrato "Vistas" de la especificación (exporta solo `crearVista`).
Reemplaza la versión provisional. Importa `import * as M from '../comun/modelo.js';` si necesitas utilidades.

La vista muestra:
- **Barra superior** (dentro del contenedor): filtro de texto (busca en código, nombre y responsable), filtro de
  estado (todos / cada estado), casilla "Solo hojas", y botones "Exportar CSV" y "Copiar para Docs".
- **Tabla** con columnas: Código · Actividad · Responsable · Inicio · Fin · Días · Estado · Avance.
  Una fila por nodo de `modelo.lista` (preorden), con sangría por nivel en la columna Actividad; los padres en negrita
  y con sus fechas/avance calculados. Días = M.diasEntre(inicio, fin) o "—". Estado como etiqueta de color
  (clase po-tabla-estado-<estado sin espacios>). Avance como porcentaje entero.
- Debajo, sección **Hitos**: Nombre · Inicio · Fin · Responsable · Tipo ("Hito" si inicio==fin, si no "Periodo").
- Clic en una fila → `alSeleccionar(id)`; la fila seleccionada se resalta (clase po-tabla-seleccionada) y al
  mostrar se hace scrollIntoView({block:'nearest'}) si no está visible. Filas navegables con teclado (tabindex=0, Enter).
- Clic en cabecera ordena por esa columna (asc/desc); ordenar desactiva la sangría jerárquica; un botón
  "Orden EDT" vuelve al orden original.
- **Exportar CSV**: columnas codigo,actividad,responsable,inicio,fin,dias,estado,avance (+ hitos al final con
  codigo vacío y estado "hito"), con BOM UTF-8, descarga `<nombre-proyecto>.csv`.
- **Copiar para Docs**: copia la tabla filtrada como HTML con estilos en línea (Arial 10pt, encabezado #1B2A4A con
  texto blanco, bordes #D3D9DF, filas alternas #F5F7F9, padres en negrita) y también como texto con tabuladores,
  usando navigator.clipboard.write con ClipboardItem; si falla, alternativa con document.execCommand('copy').
  Toma como referencia la función `tablaDocs`/`copiarDocs` de la página adjunta (gantt-anterior.html).
- El estado de filtros y orden se conserva entre llamadas a `mostrar`.
- Usa `textContent` siempre para datos. Clases con prefijo `po-tabla-` (+ `po-boton`, `po-campo`). Lista las
  clases en un comentario al inicio. Objetivo: 250–350 líneas.
