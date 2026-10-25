Escribe `comun/editor.js` completo según el contrato "Editor (comun/editor.js)" de la especificación.
Reemplaza la versión provisional. Importa `import * as M from './modelo.js';`.

El panel muestra, según la selección:

1. **Nada seleccionado**: texto breve "Selecciona una actividad o un hito" y dos botones:
   "+ Actividad de nivel 1" y "+ Hito".
2. **Actividad** (id de `modelo.porId`):
   - Encabezado: código (fuente mono) + nombre.
   - Campos: Nombre (input) · Padre (select con "— (nivel 1)" y todas las actividades que NO sean ella misma ni
     sus descendientes, mostradas como "código nombre") · botones ↑ ↓ (M.subir/M.bajar).
   - Si es hoja: Responsable (select con "— sin asignar —" + equipo) · Inicio y Fin (input type=date) ·
     Estado (select con M.ESTADOS) · Notas (textarea).
     Si NO es hoja: texto "Fechas calculadas: inicio – fin · avance N %" (de los hijos) en lugar de esos campos.
   - Botones: "+ Hijo", "+ Hermano" (M.agregarActividad con despuesDe), "Eliminar" (confirm() que dice cuántas
     subactividades se borran usando M.contarDescendientes).
3. **Hito** (id que esté en `modelo.hitos`): Nombre, Inicio, Fin, Responsable; botón "Eliminar hito".

Reglas de edición:
- Cada campo aplica su cambio al confirmar (evento `change`, y Enter en inputs de texto), no en cada tecla.
- Todo cambio pasa por `aplicar(datos => M.funcion(datos, ...))`. Para fechas: al cambiar Inicio, si Fin está vacío
  o es anterior, poner Fin = Inicio (y viceversa), así nunca queda inválido.
- Mover de padre: `M.moverActividad(datos, id, nuevoPadre, posicionAlFinal)`.
- Tras crear actividad/hito nuevos: `alSeleccionar(idNuevo)` y poner el foco en el campo Nombre.
- Nueva actividad se crea con nombre "Nueva actividad"; nuevo hito con nombre "Nuevo hito" e inicio=fin=hoy (AAAA-MM-DD local).
- `mostrar` reconstruye el formulario solo si cambió el id seleccionado o los datos de esa actividad;
  si el usuario está escribiendo en un campo (document.activeElement dentro del panel) no lo reemplaces.
- Usa `textContent` siempre. Etiquetas `<label>` asociadas a cada campo (accesible).
- Clases con prefijo `po-editor-` (más `po-boton`, `po-primario`, `po-peligro`, `po-campo`). Lista las clases en un
  comentario al inicio. Objetivo: 250–350 líneas, funciones cortas.
