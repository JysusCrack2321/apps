Corrige `vistas/edt.js` (adjunto) y devuelve el archivo COMPLETO. Solo este cambio:

Problema observado en pantalla: en nodos cuyo nombre ocupa 2 o 3 líneas (p. ej. "Control de calefactor y ventilador"),
la primera línea del nombre se dibuja ENCIMA del código (texto 'po-edt-codigo' en y = -NODE_HEIGHT/2 + 16).
Causa: `wrapText` centra el bloque de líneas alrededor de `y` desplazando la primera línea hacia arriba según el número
de líneas, e invade la franja del código.

Solución pedida:
- El código ocupa una franja fija arriba: su línea base en y = -NODE_HEIGHT/2 + 15.
- El nombre se dibuja en el área desde y = -NODE_HEIGHT/2 + 22 hasta y = NODE_HEIGHT/2 - 6 (raíz: todo el nodo),
  con interlineado de 15 px, y el bloque de N líneas centrado verticalmente DENTRO de esa área:
  primera línea base = centroArea - (N-1)*15/2 + 4.5 (4.5 ≈ ajuste de línea base para 13 px).
- Si con 3 líneas no cabe, reduce el nombre a 12 px. Nunca debe superponerse al código.
Haz que `wrapText` reciba el área (yInicio, yFin) en lugar de un `y` central, y úsalo igual en la exportación a imagen.
