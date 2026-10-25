Escribe el archivo `comun/modelo.js` completo, implementando EXACTAMENTE el contrato de la sección
"Contrato de comun/modelo.js" de la especificación adjunta, con todas las reglas de validación y los
valores calculados descritos.

Requisitos:
- Módulo ES puro, sin DOM y sin dependencias: debe funcionar en el navegador y en Node 22.
- Todas las funciones de edición devuelven datos NUEVOS (copia profunda con structuredClone) y nunca mutan la entrada.
  Si la operación es inválida, lanzan `Error` con un mensaje en español claro.
- Después de cada edición, los datos resultantes deben pasar `validar`; si no, lanzar Error (no devolver datos inválidos).
- `orden` de los hermanos afectados se renormaliza a 1, 2, 3… tras agregar, mover, subir, bajar o eliminar.
- `construir` ordena hermanos por `orden` ascendente (desempate estable por posición en el arreglo).
- Fechas: texto AAAA-MM-DD validado de verdad (año bisiesto, días del mes); aritmética en UTC con Date.UTC.
- En `editarActividad`, un valor vacío ('' o null) en inicio/fin/responsable/notas elimina ese campo.
  `inicio` y `fin` deben quedar los dos o ninguno.
- `editarEquipo`: nombres recortados (trim), sin vacíos ni duplicados; quita el responsable de actividades e hitos
  cuyo responsable ya no está.
- `nuevoId`: 4 caracteres [a-z0-9] aleatorios; si colisiona reintenta y, tras varios intentos, usa 6.
- Mensajes de error de `validar` concretos, por ejemplo: "Actividad 'c11': fin (2026-10-01) es anterior a inicio (2026-10-05)".

Abajo tienes el archivo de pruebas que tu código debe pasar (`node --test pruebas/`). Léelo con cuidado: define
detalles del comportamiento esperado.
