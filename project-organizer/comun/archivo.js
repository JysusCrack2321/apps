// comun/archivo.js
// Funciones para abrir, guardar y descargar el archivo del proyecto.
// Usa File System Access API cuando está disponible; si no, descarga.
import { validar } from './modelo.js';

const CLAVE_BORRADOR = 'project-organizer:borrador';
const TIPO_JSON = { description: 'Archivo JSON', accept: { 'application/json': ['.json'] } };

let ultimoEtag = '"0"';

/** Devuelve el último ETag conocido del servidor. */
export function obtenerUltimoEtag() {
  return ultimoEtag;
}

/** Establece manualmente el último ETag conocido del servidor. */
export function establecerUltimoEtag(nuevoEtag) {
  if (nuevoEtag) {
    ultimoEtag = nuevoEtag;
  }
}

/** Convierte los datos a texto JSON con sangría y salto de línea final. */
export function texto(datos) {
  return JSON.stringify(datos, null, 2) + '\n';
}

/** Indica si el navegador soporta el selector de archivos del sistema (Chrome/Edge). */
export function puedeGuardarDirecto() {
  return typeof window.showOpenFilePicker === 'function';
}

/**
 * Consulta datos y ETag desde el servidor sin alterar ultimoEtag.
 * Devuelve { datos, etag } o null si no hay archivo o falla la red.
 */
export async function consultarDesdeServidor(url = 'datos.json') {
  try {
    const respuesta = await fetch(url, { cache: 'no-store' });
    if (!respuesta.ok) return null;
    const etag = respuesta.headers.get('ETag') || null;
    let datos;
    try {
      datos = JSON.parse(await respuesta.text());
    } catch {
      throw new Error(`"${url}" no contiene JSON válido.`);
    }
    const resultado = validar(datos);
    if (!resultado.ok) {
      throw new Error('El archivo no es válido:\n' + resultado.errores.join('\n'));
    }
    return { datos, etag };
  } catch (error) {
    if (error instanceof TypeError || error.name === 'AbortError') return null;
    throw error;
  }
}

/**
 * Carga datos desde una URL relativa (por defecto 'datos.json') y actualiza ultimoEtag.
 * Devuelve null si no hay archivo o la petición falla (ej. file://).
 * Lanza Error si el archivo existe pero no es válido.
 */
export async function cargarDesdeServidor(url = 'datos.json') {
  const res = await consultarDesdeServidor(url);
  if (!res) return null;
  if (res.etag) {
    ultimoEtag = res.etag;
  }
  return res.datos;
}

/**
 * Abre un archivo .json seleccionado por el usuario.
 * Usa showOpenFilePicker si existe; si no, un input temporal.
 * Devuelve { datos, nombre, manejador } (manejador = null sin File System Access).
 * Devuelve null si el usuario cancela. Lanza Error si el archivo no se puede leer o no es válido.
 */
export async function abrirArchivo() {
  if (puedeGuardarDirecto()) {
    try {
      const [manejador] = await window.showOpenFilePicker({
        types: [TIPO_JSON],
        excludeAcceptAllOption: false,
        multiple: false
      });
      return await leerManejador(manejador);
    } catch (error) {
      if (error.name === 'AbortError') return null;
      throw error;
    }
  } else {
    return await abrirConInput();
  }
}

/** Lee un manejador de archivo y devuelve los datos validados. */
async function leerManejador(manejador) {
  const archivo = await manejador.getFile();
  const contenido = await archivo.text();
  return procesarContenido(contenido, archivo.name, manejador);
}

/** Procesa el contenido de un archivo .json y valida. Lanza Error si no es válido. */
async function procesarContenido(contenido, nombre, manejador) {
  let datos;
  try {
    datos = JSON.parse(contenido);
  } catch {
    throw new Error(`No se pudo leer el archivo "${nombre}" como JSON.`);
  }
  const resultado = validar(datos);
  if (!resultado.ok) {
    throw new Error(`El archivo "${nombre}" no es válido:\n` + resultado.errores.join('\n'));
  }
  return { datos, nombre, manejador };
}

/** Alternativa con <input type="file"> para navegadores sin File System Access. */
function abrirConInput() {
  return new Promise((resolver, rechazar) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.addEventListener('change', async () => {
      const archivo = input.files?.[0];
      if (!archivo) return resolver(null);
      try {
        resolver(await procesarContenido(await archivo.text(), archivo.name, null));
      } catch (error) {
        rechazar(error);
      }
    });
    input.addEventListener('cancel', () => resolver(null)); // el usuario cerró el diálogo

    input.click();
  });
}

/**
 * Lista las versiones guardadas en el servidor (/api/guardados).
 * Devuelve un arreglo de objetos { nombre, numero, etiqueta, fecha, proyecto }
 * o null si el servidor no soporta el listado (ej. servidor estático o file://).
 */
export async function listarGuardadosServidor() {
  try {
    const respuesta = await fetch('api/guardados', { cache: 'no-store' });
    if (!respuesta.ok) return null;
    const cuerpo = await respuesta.json();
    if (!cuerpo || !Array.isArray(cuerpo.archivos)) return null;
    return cuerpo.archivos;
  } catch {
    return null;
  }
}

/**
 * Carga una versión específica guardada en el servidor (/api/guardados/<nombre>).
 * Lanza Error si no se puede cargar o no pasa la validación.
 */
export async function cargarGuardadoServidor(nombre) {
  const respuesta = await fetch(`api/guardados/${encodeURIComponent(nombre)}`, { cache: 'no-store' });
  if (!respuesta.ok) {
    throw new Error(`No se pudo cargar "${nombre}" desde el servidor.`);
  }
  const etag = respuesta.headers.get('ETag');
  if (etag) {
    ultimoEtag = etag;
  }
  const contenido = await respuesta.text();
  return await procesarContenido(contenido, nombre, null);
}

/**
 * Guarda la versión activa (guardados/actual.json) en el servidor enviando If-Match.
 * Devuelve { ok: true, manejador: null, modo: 'servidor', nombre, etag } si el servidor lo acepta,
 * { ok: false, conflicto: true, modo: 'servidor', etagActual, error } si responde 409,
 * o null si se está ejecutando sin servidor.py (para caer al guardado local).
 */
export async function guardarEnServidor(datos, etagForzado = null) {
  try {
    const respuesta = await fetch('/api/guardar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': etagForzado || ultimoEtag || '"0"',
      },
      body: texto(datos),
    });
    if (respuesta.status === 404 || respuesta.status === 405 || respuesta.status === 501) {
      return null;
    }
    const cuerpo = await respuesta.json().catch(() => null);
    if (respuesta.status === 409) {
      const etagActual = respuesta.headers.get('ETag') || cuerpo?.etagActual || null;
      return {
        ok: false,
        conflicto: true,
        modo: 'servidor',
        etagActual,
        error: cuerpo?.error || 'Conflicto de concurrencia (409): el archivo fue modificado en el servidor.',
      };
    }
    if (!respuesta.ok) {
      throw new Error(cuerpo?.error || 'Error al guardar en el servidor.');
    }
    const nuevoEtag = respuesta.headers.get('ETag') || cuerpo?.etag;
    if (nuevoEtag) {
      ultimoEtag = nuevoEtag;
    }
    return {
      ok: true,
      manejador: null,
      modo: 'servidor',
      nombre: cuerpo?.nombre || 'actual.json',
      etag: ultimoEtag,
    };
  } catch (error) {
    if (error instanceof TypeError || error.name === 'AbortError') return null;
    throw error;
  }
}

/**
 * Guarda los datos: primero intenta guardar en el servidor (/api/guardar).
 * Si no hay servidor compatible, cae al guardado local (Guardar como).
 */
export async function guardar(datos, manejador = null) {
  const enServidor = await guardarEnServidor(datos);
  if (enServidor) return enServidor;

  if (manejador) {
    return await escribirEnManejador(manejador, datos);
  }
  return await guardarComo(datos);
}

/**
 * Abre siempre el explorador de archivos local (showSaveFilePicker) para elegir dónde
 * guardar en el computador del usuario, o descarga el archivo si el navegador no lo soporta.
 */
export async function guardarComo(datos) {
  if (puedeGuardarDirecto()) {
    try {
      const nuevoManejador = await window.showSaveFilePicker({
        suggestedName: 'datos.json',
        types: [TIPO_JSON]
      });
      return await escribirEnManejador(nuevoManejador, datos);
    } catch (error) {
      if (error.name === 'AbortError') return null;
      throw error;
    }
  }

  // Descarga directa sin File System Access.
  descargarArchivo(datos);
  return { manejador: null, modo: 'descarga', nombre: 'datos.json' };
}

/** Escribe los datos en un manejador de archivo, pidiendo permiso si hace falta. */
async function escribirEnManejador(manejador, datos) {
  // Verificar y pedir permiso de escritura si es necesario.
  let permiso = await manejador.queryPermission({ mode: 'readwrite' });
  if (permiso !== 'granted') {
    permiso = await manejador.requestPermission({ mode: 'readwrite' });
  }
  if (permiso !== 'granted') {
    throw new Error('No se pudo obtener permiso para guardar el archivo.');
  }
  const escribible = await manejador.createWritable();
  await escribible.write(texto(datos));
  await escribible.close();
  return { manejador, modo: 'directo', nombre: manejador.name || 'datos.json' };
}

/** Descarga los datos como 'datos.json' usando un Blob y un enlace temporal. */
function descargarArchivo(datos) {
  const blob = new Blob([texto(datos)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'datos.json';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- Borrador en localStorage ---

/** Guarda un borrador con la fecha actual y los datos. No falla si localStorage no está disponible. */
export function guardarBorrador(datos) {
  try {
    const borrador = { guardado: new Date().toISOString(), datos };
    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(borrador));
  } catch {
    // ignorar errores de almacenamiento
  }
}

/** Lee el borrador guardado o null si no hay o no se puede leer. */
export function leerBorrador() {
  try {
    const textoGuardado = localStorage.getItem(CLAVE_BORRADOR);
    if (!textoGuardado) return null;
    return JSON.parse(textoGuardado);
  } catch {
    return null;
  }
}

/** Elimina el borrador guardado. No falla si localStorage no está disponible. */
export function borrarBorrador() {
  try {
    localStorage.removeItem(CLAVE_BORRADOR);
  } catch {
    // ignorar
  }
}

/**
 * Consulta el usuario activo en /api/yo.
 * Devuelve { id, nombre, rol } o null si no hay sesión o no hay servidor.
 */
export async function cargarUsuarioActual() {
  try {
    const respuesta = await fetch('/api/yo', { cache: 'no-store' });
    if (!respuesta.ok) return null;
    const usuario = await respuesta.json();
    return usuario && usuario.nombre ? usuario : null;
  } catch {
    return null;
  }
}

/**
 * Consulta la lista de usuarios compartidos en /api/usuarios.
 * Devuelve arreglo de usuarios o [] si no está disponible.
 */
export async function cargarUsuariosCompartidos() {
  try {
    const respuesta = await fetch('/api/usuarios', { cache: 'no-store' });
    if (!respuesta.ok) return [];
    const lista = await respuesta.json();
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

