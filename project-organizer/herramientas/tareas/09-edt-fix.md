Corrige `vistas/edt.js` (adjunto) y devuelve el archivo COMPLETO corregido. No cambies nada más que esto:

1. ERROR: el código, el nombre, el color, el punto de estado y la franja de avance de cada nodo solo se dibujan
   en `enter()`. Cuando una actividad existente cambia (se mueve de padre, se reordena y cambia su código, se
   renombra, cambia su estado o avance), el nodo se reutiliza con los datos viejos. Ejemplo real: una actividad
   creada como 1.2.3 y movida bajo 4.2.2 sigue mostrando "1.2.3" en vez de "4.2.2.1".
   Solución: en cada `mostrar`, actualiza el contenido de TODOS los nodos (enter + update), no solo los nuevos.
   La forma más simple: en la selección unida (merge/join), vaciar el grupo del nodo y volver a dibujar su
   contenido (rect, código, nombre envuelto, punto de estado, franja de avance) con la función que ya existe.
   Igual para los enlaces si dependen de datos.

2. Diseño: cuando el nombre ocupa 2 o 3 líneas, el código (arriba) queda encima o pegado al texto.
   Coloca el código en una franja superior fija del nodo (p. ej. 16 px desde el borde superior) y el bloque de
   nombre centrado verticalmente en el espacio restante debajo, de modo que nunca se superpongan.

Mantén el resto del comportamiento y las clases igual.
