// portal/app.js
// Lógica del portal: URLs dinámicas por host, estado de servidores y selector de usuario compartido.

// Las apps se publican bajo el mismo hostname, cada una en su prefijo.
const RUTA_EDT = '/edt/';
const RUTA_ITINERARIO = '/itinerario/';
const CLAVE_TEMA = 'itinerario_tema';

const estadoPortal = {
  usuarios: [],
  usuarioActivo: null,
  mostrandoSelector: false,
};

const dom = {};

/** Devuelve la ruta pública de una app dentro del hostname único. */
export function construirRutaApp(prefijo) {
  return `/${prefijo}/`;
}

/** Guarda la cookie compartida usuario=<id> (Path=/, SameSite=Lax). */
export function guardarCookieUsuario(id) {
  const valor = encodeURIComponent(id);
  document.cookie = `usuario=${valor}; Path=/; SameSite=Lax; Max-Age=2592000`;
}

/** Consulta /api/estado en el servidor del portal. */
export async function consultarEstadoServidores() {
  const respuesta = await fetch('/api/estado', { cache: 'no-store' });
  if (!respuesta.ok) {
    throw new Error(`Error al consultar estado (${respuesta.status})`);
  }
  return await respuesta.json();
}

/** Consulta /api/usuarios en el servidor del portal. */
export async function cargarListaUsuarios() {
  const respuesta = await fetch('/api/usuarios', { cache: 'no-store' });
  if (!respuesta.ok) return [];
  const datos = await respuesta.json();
  return Array.isArray(datos) ? datos : [];
}

/** Consulta /api/yo en el servidor del portal. */
export async function cargarUsuarioActivo() {
  const respuesta = await fetch('/api/yo', { cache: 'no-store' });
  if (!respuesta.ok) return null;
  const usuario = await respuesta.json();
  return usuario && usuario.id ? usuario : null;
}

/** Configura los enlaces de las dos tarjetas con su ruta dentro del hostname. */
function configurarTarjetas() {
  const rutaEdt = construirRutaApp('edt');
  const rutaItinerario = construirRutaApp('itinerario');

  if (dom.tarjetaEdt) dom.tarjetaEdt.href = rutaEdt;
  if (dom.tarjetaItinerario) dom.tarjetaItinerario.href = rutaItinerario;
  if (dom.urlEdt) dom.urlEdt.textContent = rutaEdt;
  if (dom.urlItinerario) dom.urlItinerario.textContent = rutaItinerario;
}

/** Actualiza visualmente la insignia de estado de una tarjeta. */
function actualizarInsigniaEstado(elemento, enLinea) {
  if (!elemento) return;
  elemento.classList.remove('estado-verificando', 'estado-en-linea', 'estado-caido');
  if (enLinea) {
    elemento.classList.add('estado-en-linea');
    elemento.textContent = 'En línea';
  } else {
    elemento.classList.add('estado-caido');
    elemento.textContent = 'Caído';
  }
}

/** Refresca el estado en línea/caído de ambos servidores. */
async function refrescarEstadoServidores() {
  try {
    const estado = await consultarEstadoServidores();
    actualizarInsigniaEstado(dom.estadoEdt, Boolean(estado?.edt?.enLinea));
    actualizarInsigniaEstado(dom.estadoItinerario, Boolean(estado?.itinerario?.enLinea));
  } catch (_) {
    actualizarInsigniaEstado(dom.estadoEdt, false);
    actualizarInsigniaEstado(dom.estadoItinerario, false);
  }
}

/** Renderiza la barra superior de usuario y el selector. */
function renderizarUsuario() {
  const activo = estadoPortal.usuarioActivo;
  if (activo) {
    dom.etiquetaUsuario.textContent = `👤 ${activo.nombre}`;
    dom.btnCambiarUsuario.textContent = 'Cambiar';
    dom.btnCerrarSelector.hidden = false;
  } else {
    dom.etiquetaUsuario.textContent = 'Sin usuario activo';
    dom.btnCambiarUsuario.textContent = 'Elegir usuario';
    dom.btnCerrarSelector.hidden = true;
  }

  const mostrarPanel = estadoPortal.mostrandoSelector || !activo;
  dom.panelUsuarios.hidden = !mostrarPanel;

  dom.listaUsuarios.replaceChildren();
  for (const u of estadoPortal.usuarios) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'opcion-usuario' + (activo && activo.id === u.id ? ' activo' : '');
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', activo && activo.id === u.id ? 'true' : 'false');

    const spanNombre = document.createElement('span');
    spanNombre.className = 'opcion-usuario-nombre';
    spanNombre.textContent = u.nombre;

    const spanRol = document.createElement('span');
    spanRol.className = 'opcion-usuario-rol';
    spanRol.textContent = u.rol;

    btn.append(spanNombre, spanRol);
    btn.addEventListener('click', () => seleccionarUsuario(u.id));
    dom.listaUsuarios.append(btn);
  }
}

/** Guarda la cookie del usuario elegido y actualiza la vista. */
async function seleccionarUsuario(idUsuario) {
  guardarCookieUsuario(idUsuario);
  const encontrado = estadoPortal.usuarios.find((u) => u.id === idUsuario) || null;
  estadoPortal.usuarioActivo = encontrado || (await cargarUsuarioActivo());
  estadoPortal.mostrandoSelector = false;
  renderizarUsuario();
}

/** Conecta el botón de tema claro/oscuro sincronizado con itinerario-app. */
function conectarTema() {
  const guardado = localStorage.getItem(CLAVE_TEMA);
  const prefiereOscuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const temaInicial = guardado || (prefiereOscuro ? 'oscuro' : 'claro');

  const aplicarTema = (tema) => {
    document.documentElement.setAttribute('data-tema', tema);
    localStorage.setItem(CLAVE_TEMA, tema);
    if (dom.btnTema) {
      dom.btnTema.textContent = tema === 'oscuro' ? '☀️' : '🌙';
    }
  };

  aplicarTema(temaInicial);

  dom.btnTema?.addEventListener('click', () => {
    const actual = document.documentElement.getAttribute('data-tema');
    aplicarTema(actual === 'oscuro' ? 'claro' : 'oscuro');
  });
}

/** Inicializa el portal. */
async function iniciarPortal() {
  dom.tarjetaEdt = document.getElementById('tarjeta-edt');
  dom.tarjetaItinerario = document.getElementById('tarjeta-itinerario');
  dom.estadoEdt = document.getElementById('estado-edt');
  dom.estadoItinerario = document.getElementById('estado-itinerario');
  dom.urlEdt = document.getElementById('url-edt');
  dom.urlItinerario = document.getElementById('url-itinerario');
  dom.etiquetaUsuario = document.getElementById('etiqueta-usuario');
  dom.btnCambiarUsuario = document.getElementById('btn-cambiar-usuario');
  dom.panelUsuarios = document.getElementById('panel-usuarios');
  dom.listaUsuarios = document.getElementById('lista-usuarios');
  dom.btnCerrarSelector = document.getElementById('btn-cerrar-selector');
  dom.btnTema = document.getElementById('btn-tema');

  configurarTarjetas();
  conectarTema();

  dom.btnCambiarUsuario?.addEventListener('click', () => {
    estadoPortal.mostrandoSelector = !estadoPortal.mostrandoSelector;
    renderizarUsuario();
  });

  dom.btnCerrarSelector?.addEventListener('click', () => {
    estadoPortal.mostrandoSelector = false;
    renderizarUsuario();
  });

  const [usuarios, activo] = await Promise.all([
    cargarListaUsuarios(),
    cargarUsuarioActivo(),
    refrescarEstadoServidores(),
  ]);

  estadoPortal.usuarios = usuarios;
  estadoPortal.usuarioActivo = activo;
  estadoPortal.mostrandoSelector = !activo;
  renderizarUsuario();

  setInterval(() => {
    refrescarEstadoServidores();
  }, 5000);
}

iniciarPortal();
