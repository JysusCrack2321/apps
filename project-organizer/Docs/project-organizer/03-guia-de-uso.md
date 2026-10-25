# Guía de Uso — Project Organizer

Esta guía explica cómo utilizar **Project Organizer** para consultar, crear, editar y exportar la planeación de un proyecto.

---

## 1. Abrir o crear un proyecto

- **Al entrar al enlace web**: La aplicación carga automáticamente la **versión más reciente** guardada en el servidor (`guardados/datosN.json`) o, si aún no hay guardados nuevos, el `datos.json` base del proyecto.
- **Abrir una versión anterior o un archivo de tu PC**:
  1. Haz clic en el botón **«Abrir…»** en la barra superior.
  2. Se abrirá una ventana con:
     - **Guardados previamente**: Lista todas las versiones guardadas en el servidor (`datos3.json`, `datos2.json`, `datos.json` base) con su fecha y hora, ordenadas de la más reciente a la más antigua. Haz clic en cualquiera para abrirla.
     - **«Abrir desde mi computador…»**: Abre el explorador de archivos de tu propio PC para cargar un archivo `.json` local.
- **Crear un proyecto desde cero**:
  1. Haz clic en **«Nuevo…»** en la barra superior.
  2. Escribe el **Nombre del proyecto**.
  3. Escribe los integrantes del **Equipo** separados por comas (ej. `Ana, Luis, Marta, Pedro`).
  4. Elige la plantilla **Vacía** (sin actividades) o **Básica** (crea 4 fases iniciales: *Planeación*, *Ejecución*, *Pruebas* y *Cierre*).
  5. Haz clic en **«Nuevo proyecto»**.

---

## 2. Las tres vistas del proyecto

Puedes cambiar de vista en cualquier momento usando las pestañas superiores (**EDT**, **Gantt**, **Tabla**). Al hacer clic sobre una actividad o hito en cualquiera de las vistas, se abre su información a la derecha en el **Panel de edición**.

### A. Vista EDT (Estructura de Desglose del Trabajo)
Muestra el árbol jerárquico del proyecto para responder **¿qué hay que hacer?**:
- **Navegación**: Arrastra el lienzo con el ratón para desplazarte y usa la rueda del ratón para hacer zoom.
- **Plegar / Desplegar ramas**: Haz clic en el pequeño círculo inferior de cualquier actividad padre para ocultar o mostrar sus subactividades.
- **Barra de herramientas**:
  - **Desplegar todo**: Abre todas las ramas del árbol.
  - **Plegar a nivel 1**: Muestra únicamente los entregables principales.
  - **Centrar**: Ajusta el zoom para que todo el árbol quepa en pantalla.
  - **Buscar código o nombre**: Resalta las actividades que coincidan con el texto escrito.
  - **Exportar imagen**: Descarga el árbol EDT completo en formato PNG.

### B. Vista Gantt (Cronograma)
Muestra las barras de tiempo en un calendario para responder **¿cuándo y quién lo hace?**:
- **Barras y colores**: Cada integrante del equipo tiene un color asignado (visible en la leyenda inferior). Las actividades padre se muestran como barras resumen que abarcan desde el inicio más temprano hasta el fin más tardío de sus subactividades.
- **Línea de hoy**: Una línea vertical marca la fecha actual.
- **Hitos y periodos**: Se dibujan con un rombo (`◆`) cuando son de un solo día o una barra especial cuando abarcan varios días.
- **Controles superiores**:
  - **Desde / Hasta**: Filtra el rango de meses visible.
  - **Desde hace un mes / Todo**: Ajustes rápidos de ventana de tiempo.
  - **Plegar / Desplegar**: Contrae o expande los grupos de actividades.
  - **Exportar imagen**: Descarga el diagrama de Gantt en alta resolución (PNG) listo para informes o presentaciones.

### C. Vista Tabla (Revisión y exportación)
Lista todas las actividades con su código EDT, nombre, responsable, fechas, duración en días, estado y porcentaje de avance:
- **Filtros**:
  - **Buscador**: Filtra por código (`1.2`), nombre de actividad o nombre del responsable.
  - **Selector de estado**: Muestra todas o filtra por `Pendiente`, `En curso`, `Hecha` o `Bloqueada`.
  - **Casilla «Solo hojas»**: Oculta los títulos/padres y deja únicamente los paquetes de trabajo ejecutables.
- **Ordenamiento**: Haz clic en el encabezado de cualquier columna (*Código*, *Actividad*, *Responsable*, *Inicio*, *Fin*, *Días*, *Estado*, *Avance*) para ordenar ascendente o descendentemente. El botón **«Orden EDT»** restaura el orden jerárquico original.
- **Exportación**:
  - **Exportar CSV**: Descarga un archivo `.csv` compatible con Excel o Google Sheets.
  - **Copiar para Docs**: Copia la tabla con formato al portapapeles para pegarla directamente (`Ctrl+V`) en un documento de Google Docs o Word.

---

## 3. Editar actividades, hitos y equipo

### Editar el título del proyecto y el equipo
- **Renombrar el proyecto**: Haz clic directamente sobre el título del proyecto en la esquina superior izquierda, escribe el nuevo nombre y presiona `Enter`.
- **Gestionar el equipo**: Haz clic en el botón **«Equipo…»** de la barra superior:
  - Si **cambias un nombre existente**, todas las actividades asignadas a esa persona se actualizan automáticamente al nuevo nombre.
  - Si **eliminas a alguien (`✕`)**, sus actividades pasan a quedar sin asignar.
  - Puedes añadir nuevos integrantes con **«+ Agregar persona»** y confirmar con **«Listo»**.

### Crear y organizar actividades (Panel derecho)
1. **Sin nada seleccionado**:
   - **«+ Actividad de nivel 1»**: Crea una fase o entregable principal al final del proyecto.
   - **«+ Hito»**: Crea un nuevo hito o entrega clave.
2. **Con una actividad seleccionada**:
   - **«+ Hijo»**: Crea una subactividad dentro de la actividad actual.
   - **«+ Hermano»**: Crea una actividad al mismo nivel, justo debajo de la actual.
   - **Cambiar de Padre**: Usa el desplegable **Padre** para mover toda la actividad (y sus subactividades) dentro de otra rama.
   - **Reordenar (`↑` / `↓`)**: Sube o baja la actividad entre sus hermanas; los códigos EDT (`1.1`, `1.2`…) se recalculan solos.
   - **«Eliminar»**: Borra la actividad seleccionada (y sus subactividades, pidiendo confirmación).

### Regla importante: Hojas vs. Padres
- **Solo las actividades hoja** (las que **no** tienen subactividades dentro) permiten editar manualmente:
  - **Responsable**
  - **Fecha de inicio y Fecha de fin**
  - **Estado** (`pendiente`, `en curso`, `hecha`, `bloqueada`)
  - **Notas**
- **Las actividades padre** (las que contienen subactividades) **calculan automáticamente** sus fechas de inicio/fin y su porcentaje de avance a partir de sus hojas. Si a una actividad que tenía fechas le agregas un **«+ Hijo»**, pasa a ser padre y sus fechas pasan a calcularse automáticamente según sus hijos.

---

## 4. Deshacer, guardar y recuperar borradores

### Atajos de teclado
| Atajo | Acción |
|---|---|
| `Ctrl + Z` | **Deshacer** el último cambio (hasta 100 pasos hacia atrás) |
| `Ctrl + Y` o `Ctrl + Shift + Z` | **Rehacer** un cambio deshecho |
| `Ctrl + S` | **Guardar** una nueva versión en el servidor (`datos2.json`, `datos3.json`…) |

### Diferencia entre «Guardar» y «Guardar como…»
- Cuando haces cambios, aparece el indicador **«● sin guardar»** en la barra superior.
- **«Guardar» (`Ctrl+S`)**:
  - Guarda el proyecto directamente en el servidor dentro de la carpeta `guardados/` creando una **nueva versión consecutiva** (`datos2.json`, `datos3.json`, `datos4.json`…).
  - **No borra las versiones anteriores**, por lo que siempre puedes volver a una versión previa desde el botón **«Abrir…»**.
  - La próxima persona que abra la página verá automáticamente esta última versión guardada.
- **«Guardar como…»**:
  - Abre el explorador de archivos de **tu propio computador** (en Chrome/Edge/Brave) o descarga el archivo `.json` en tu carpeta de descargas (en Firefox/Safari) para que te lleves una copia local a tu PC.

### Borrador de emergencia
Cada cambio que realizas se guarda al instante como borrador en el navegador (`localStorage`). Si se cierra la pestaña o se apaga el computador antes de pulsar `Ctrl+S`, al volver a la pantalla de inicio (`Nuevo…`) verás un aviso **«Recuperar borrador del <fecha>»** para restaurar tu trabajo.

