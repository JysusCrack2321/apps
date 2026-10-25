Escribe `vistas/gantt.js` completo según el contrato "Vistas" de la especificación (exporta solo `crearVista`).
Reemplaza la versión provisional. Importa `import * as M from '../comun/modelo.js';`.

Toma como referencia la página adjunta `gantt-anterior.html` (Gantt en <canvas>): reutiliza su forma de dibujar
(cabecera de meses y semanas que empiezan en lunes, fines de semana sombreados, filas alternas, línea "HOY",
barras redondeadas con días, rombos para hitos, barras con borde para periodos, recorte de etiquetas largas,
escala de días que se adapta al ancho, devicePixelRatio, exportación a PNG con título y leyenda en tema claro).
Pero los datos ahora vienen del modelo:

- Filas = `modelo.lista` en preorden. Columna izquierda: código (mono) + nombre, sangría por nivel; debajo, en gris,
  el responsable (hojas) o "N actividades" (padres).
- **Padres**: barra de resumen delgada y oscura entre su inicio y fin calculados, con el avance como relleno.
- **Hojas**: barra de color según responsable (paleta: #2F55CF #1B7A4B #C2572F #7B5BD6 #2B8FA3 #9E6310 #A23B72 #5B6B7A;
  oscuro: #7A9BFF #4CC38A #F08A5D #A98BF0 #4CB8CC #E3A948 #E07AB0 #95A3B0; color por índice en `modelo.equipo`;
  sin responsable → gris). Estado: `hecha` con opacidad 0.55 y ✓; `bloqueada` con borde rojo (#BA2F27 / #F0736B).
  Hojas sin fechas: fila con texto "sin fechas" en gris.
- **Hitos** (`modelo.hitos`) en un grupo final "Hitos": rombo rojo si inicio==fin; barra con borde rojo si es periodo.
- Ramas plegables: clic en el triángulo ▸/▾ de un padre oculta/muestra sus descendientes (estado propio de la vista).
- Clic en una fila o barra → `alSeleccionar(id)`; clic en zona vacía → `alSeleccionar(null)`.
  La fila seleccionada se resalta (fondo suave del color de acento).
- Barra superior de la vista: Desde [mes] Hasta [mes] (meses del rango del modelo, "inicio"/"final"),
  botón "Desde hace un mes", botón "Todo", botón "Plegar todo"/"Desplegar todo", botón "Exportar imagen" (PNG 2x, tema claro,
  título = nombre del proyecto, subtítulo con rango y fecha, leyenda de responsables, hito y periodo).
- Leyenda HTML debajo del canvas (responsables + hito + periodo).
- Colores del tema: leer variables CSS (--bg, --surface, --ink, --muted, --line, --accent, --chip) de
  getComputedStyle(document.documentElement); redibujar al cambiar el esquema (matchMedia) y al cambiar tamaño
  (ResizeObserver del contenedor). destruir() quita esas escuchas.
- Fechas con M.sumarDias/M.diasEntre (UTC). Sin dependencias externas.
- Clases con prefijo `po-gantt-` (+ `po-boton`, `po-campo`). Lista las clases en un comentario al inicio.
  Funciones cortas y con nombres claros. Objetivo: 400–550 líneas.
