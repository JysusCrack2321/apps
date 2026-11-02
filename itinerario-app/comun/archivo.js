// comun/archivo.js
// Comunicación con el servidor para cargar y guardar datos.json con control de ETag.

/**
 * Carga datos.json y su ETag desde el servidor.
 * @returns {Promise<{ datos: object, etag: string }>}
 */
export async function cargarDatos() {
  const respuesta = await fetch('api/datos', {
    headers: { 'Cache-Control': 'no-cache' }
  });

  if (!respuesta.ok) {
    throw new Error(`Error al cargar datos (${respuesta.status}): ${respuesta.statusText}`);
  }

  const etag = respuesta.headers.get('ETag') || '"0"';
  const datos = await respuesta.json();
  return { datos, etag };
}

/**
 * Guarda datos.json en el servidor enviando el ETag en If-Match.
 * Si el servidor responde 409, devuelve { conflicto: true, etagActual }.
 * @param {object} datos
 * @param {string} etagActual
 * @returns {Promise<{ ok: boolean, etag?: string, conflicto?: boolean, etagActual?: string, error?: string }>}
 */
export async function guardarDatos(datos, etagActual) {
  try {
    const respuesta = await fetch('api/datos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': etagActual || '"0"'
      },
      body: JSON.stringify(datos, null, 2)
    });

    if (respuesta.status === 409) {
      const errorJson = await respuesta.json().catch(() => ({}));
      const nuevoEtag = respuesta.headers.get('ETag') || errorJson.etagActual;
      return {
        ok: false,
        conflicto: true,
        etagActual: nuevoEtag,
        error: errorJson.error || 'El archivo fue modificado externamente.'
      };
    }

    if (!respuesta.ok) {
      const errorTexto = await respuesta.text();
      return {
        ok: false,
        error: `Error al guardar (${respuesta.status}): ${errorTexto}`
      };
    }

    const resultado = await respuesta.json();
    const nuevoEtag = respuesta.headers.get('ETag') || resultado.etag;
    return {
      ok: true,
      etag: nuevoEtag
    };
  } catch (err) {
    return {
      ok: false,
      error: `Error de red al guardar: ${err.message}`
    };
  }
}

/**
 * Consulta la identidad del usuario activo en /api/yo.
 * @returns {Promise<{ id: string, nombre: string, rol: string } | null>}
 */
export async function cargarUsuarioActual() {
  try {
    const respuesta = await fetch('api/yo', {
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!respuesta.ok) return null;
    const usuario = await respuesta.json();
    return usuario && usuario.nombre ? usuario : null;
  } catch (_) {
    return null;
  }
}

/**
 * Consulta la lista de usuarios disponibles en /api/usuarios (sin contraseña).
 * @returns {Promise<Array<{ id: string, nombre: string, rol: string }>>}
 */
export async function cargarListaUsuarios() {
  try {
    const respuesta = await fetch('api/usuarios', {
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!respuesta.ok) return [];
    const lista = await respuesta.json();
    return Array.isArray(lista) ? lista : [];
  } catch (_) {
    return [];
  }
}

/**
 * Guarda la cookie compartida usuario=<id> (sin contraseña) para cambiar de itinerario.
 * @param {string} id
 */
export function guardarCookieUsuario(id) {
  if (!id) {
    document.cookie = 'usuario=; Path=/; SameSite=Lax; Max-Age=0';
    return;
  }
  const valor = encodeURIComponent(id);
  document.cookie = `usuario=${valor}; Path=/; SameSite=Lax; Max-Age=2592000`;
}


