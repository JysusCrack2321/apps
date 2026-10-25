Escribe `vistas/edt.js` completo según el contrato "Vistas" de la especificación (exporta solo `crearVista`).
Reemplaza la versión provisional.

Usa D3 v7 cargándolo como módulo ES: `import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';`

Toma como referencia `edt-anterior.js` (visor EDT con D3: árbol vertical, raíz arriba, ramas de nivel 1 en columnas,
hijos apilados debajo con sangría, enlaces en ángulo recto, nodos rectangulares con texto envuelto, zoom y arrastre,
centrar, expandir/colapsar). Conserva ese estilo de distribución y de interacción, pero:

- Datos: `modelo.raiz` (nodo raíz = proyecto, mostrar `modelo.proyecto.nombre`) y sus `hijos`. Cada nodo muestra
  el **código** (mono, pequeño) arriba y el **nombre** debajo (envuelto, máximo 3 líneas con "…").
- Color del nodo por nivel (raíz #1f3b57, nivel 1 #35627f, nivel 2 #4d7c73, nivel 3+ #6b8f71) con una franja inferior
  que muestra el **avance** (ancho = avance, color verde --ok). Hojas: además un punto de color según estado
  (pendiente gris, en curso azul --accent, hecha verde --ok, bloqueada rojo --bad).
- Clic en un nodo → `alSeleccionar(id)` (la raíz → `alSeleccionar(null)`). Nodo seleccionado con borde grueso de acento.
  Doble clic → plegar/desplegar sus hijos. Clic en fondo vacío → `alSeleccionar(null)`.
- Al mostrar: ramas desplegadas hasta el nivel 2 la primera vez; luego conservar qué ramas están abiertas (por id)
  aunque cambien los datos (nodos nuevos aparecen desplegados). Si la selección está dentro de una rama plegada,
  desplegar hasta ella.
- Barra superior de la vista: "Desplegar todo", "Plegar a nivel 1", "Centrar", campo Buscar (resalta coincidencias por
  código o nombre y centra la primera), "Exportar imagen" (PNG 2x del árbol completo desplegado como está, fondo
  claro, con el nombre del proyecto como título; serializar el SVG a imagen y dibujarlo en un canvas — sin html2canvas).
- Zoom y arrastre con d3.zoom; mantener la transformación entre llamadas a `mostrar`; "Centrar" ajusta todo a la vista.
- Responsive: el SVG ocupa el contenedor; ResizeObserver para recalcular. destruir() quita escuchas.
- Textos con `.text()` de D3 (nunca .html con datos). Clases con prefijo `po-edt-` (+ `po-boton`, `po-campo`).
  Lista las clases en un comentario al inicio. Funciones cortas. Objetivo: 350–450 líneas.
