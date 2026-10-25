Escribe `comun/estilos.css` completo: la hoja de estilos de TODA la aplicación.

Usa la sección "Diseño visual" de la especificación (tokens de color claro/oscuro, fuentes Archivo e IBM Plex Mono,
distribución con vista a la izquierda y panel de edición de ≈320 px a la derecha, que pasa debajo en < 900 px).
Toma como referencia de estilo la página adjunta gantt-anterior.html (cabecera, pestañas con subrayado de acento,
paneles blancos con borde suave y radio 12 px, botones .btn, tabla, aviso).

Reglas:
- Define los tokens en :root, el modo oscuro con @media (prefers-color-scheme: dark) bajo :root:not([data-theme="light"])
  y también :root[data-theme="dark"]. body con fondo explícito.
- La app ocupa toda la ventana: cabecera fija arriba, debajo un área flexible (vista + editor) que llena el alto
  restante (height: 100vh con flex); la vista activa hace scroll interno; el lienzo de la EDT (.po-edt-lienzo) y el
  canvas del Gantt deben tener altura útil (flex: 1; min-height: 0).
- Estiliza TODAS estas clases (son las que usa el código):
po-activa po-aviso po-borrador po-boton po-boton-borrador po-cabecera po-campo po-cuerpo po-editor po-editor-actividad po-editor-boton po-editor-botones po-editor-botones-acciones po-editor-botones-orden po-editor-cabecera po-editor-campo po-editor-codigo po-editor-estado po-editor-etiqueta po-editor-fechas po-editor-fechas-calc po-editor-fin po-editor-hito po-editor-inicio po-editor-input po-editor-mensaje po-editor-nombre po-editor-notas po-editor-padre po-editor-responsable po-editor-select po-editor-textarea po-editor-vacio po-edt-avance po-edt-barra po-edt-codigo po-edt-contenedor po-edt-estado po-edt-fondo po-edt-lienzo po-edt-link po-edt-links po-edt-nodes po-edt-nodo po-edt-nombre po-etiqueta po-formulario po-gantt po-gantt-barra po-gantt-canvas po-gantt-leyenda po-gantt-leyenda-icono po-gantt-leyenda-item po-gantt-scroll po-grupo po-inicio po-peligro po-pestana po-pestanas po-primario po-radio po-singuardar po-tabla po-tabla-actividad po-tabla-barra po-tabla-cabecera po-tabla-casilla po-tabla-codigo po-tabla-estado- po-tabla-estado-bloqueada po-tabla-estado-en-curso po-tabla-estado-filtro po-tabla-estado-hecha po-tabla-estado-pendiente po-tabla-fila po-tabla-filtro po-tabla-hito-fila po-tabla-hitos po-tabla-hitos-wrap po-tabla-orden-asc po-tabla-orden-desc po-tabla-padre po-tabla-scroll po-tabla-seleccionada po-tabla-tabla po-titulo po-titulo-input po-vista 
- Botones: .po-boton (secundario), .po-primario (acento), .po-peligro (rojo). Deshabilitados con opacidad.
- Campos (.po-campo, inputs, selects, textarea) con fondo --surface2, borde --line, radio 6 px, altura mínima 36 px.
- .po-singuardar: punto naranja (--warn) + texto pequeño. .po-aviso: toast abajo a la derecha, aparece con transición.
- Estados en la tabla (.po-tabla-estado-pendiente / -encurso / -hecha / -bloqueada, o como estén en la lista):
  etiquetas tipo píldora con colores --muted / --accent / --ok / --bad.
- Fila seleccionada de la tabla con fondo de acento suave. Encabezados de tabla en mayúsculas pequeñas y --muted.
- Pantalla de inicio (.po-inicio): tarjeta centrada de ancho ≤ 520 px.
- Foco visible (:focus-visible con contorno de acento). Responsive hasta 360 px de ancho, sin scroll horizontal de la página.
- Comentarios breves por sección. Sin dependencias. Objetivo: 350–500 líneas.
