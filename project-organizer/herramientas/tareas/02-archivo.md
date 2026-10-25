Escribe `comun/archivo.js` completo: el módulo que abre y guarda el archivo del proyecto en el NAVEGADOR.
Debe ser corto y fácil de entender (objetivo: menos de 200 líneas). Módulo ES, sin dependencias salvo:
`import { validar } from './modelo.js';`

Contrato (exporta exactamente esto):

```js
export function texto(datos)            // JSON con sangría de 2 espacios y salto de línea final
export function puedeGuardarDirecto()   // true si el navegador tiene showOpenFilePicker (Chrome/Edge)

export async function cargarDesdeServidor(url = 'datos.json')
//   fetch con cache 'no-store'. Devuelve los datos si existen y son válidos.
//   Devuelve null si no hay archivo o si falla la petición (p. ej. página abierta con file://).
//   Si el archivo existe pero es inválido, lanza Error con los errores de validar() unidos por '\n'.

export async function abrirArchivo()
//   Pide al usuario un .json. Usa showOpenFilePicker si existe (guarda el manejador para escribir después);
//   si no, un <input type="file" accept=".json,application/json"> temporal.
//   Devuelve { datos, nombre, manejador }  (manejador = null si no hay File System Access).
//   Si el usuario cancela devuelve null. Si el JSON no se puede leer o no es válido → Error con mensaje claro.

export async function guardar(datos, manejador = null)
//   Si hay manejador: pide permiso de escritura si hace falta y escribe texto(datos) en ese archivo.
//   Si no hay manejador pero existe showSaveFilePicker: pide dónde guardar ('datos.json') y escribe.
//   Si no: descarga 'datos.json' (Blob + <a download>).
//   Devuelve { manejador, modo: 'directo' | 'descarga' }. Si el usuario cancela el diálogo → devuelve null.

// Borrador de recuperación en localStorage (clave 'project-organizer:borrador').
// Todas envueltas en try/catch: si localStorage falla, no rompen nada (leer → null).
export function guardarBorrador(datos)  // guarda { guardado: fecha ISO, datos }
export function leerBorrador()          // → { guardado, datos } | null
export function borrarBorrador()
```

Detalles: cancelar un diálogo (AbortError) NO es un error. Mensajes de error en español.
