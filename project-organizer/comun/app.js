// comun/app.js
// Clases CSS usadas (prefijo po-):
// po-aviso, po-cabecera, po-titulo, po-titulo-input, po-singuardar, po-boton, po-primario,
// po-pestanas, po-pestana, po-activa, po-cuerpo, po-vista, po-editor, po-inicio,
// po-formulario, po-campo, po-etiqueta, po-grupo, po-radio, po-borrador, po-boton-borrador

import * as M from './modelo.js';
import * as A from './archivo.js';
import { crearEditor } from './editor.js';
import { crearVista as vistaEdt } from '../vistas/edt.js';
import { crearVista as vistaGantt } from '../vistas/gantt.js';
import { crearVista as vistaTabla } from '../vistas/tabla.js';
import { crearVista as vistaCohete } from '../vistas/cohete.js';

const CLAVE_PESTANA = 'project-organizer:pestana';

// Estado global de la aplicación
const estado = {
  datos: null,
  manejador: null,
  nombreArchivo: null,
  historial: [],
  futuro: [],
  sinGuardar: false,
  estadoGuardado: 'guardado',
  temporizadorAutoguardado: null,
  intervaloAutoguardadoMs: 1000,
  eventSource: null,
  cambioExternoPendiente: null,
  edicionesDuranteCambio: [],
  recargasExternas: 0,
  filtros: {
    texto: '',
    responsable: '',
    estado: '',
    tipo: '',
    fecha: '',
    modoFecha: 'fin',
  },
  seleccion: null,
  pestana: 'edt',
  modelo: null,
  vista: null,
  editor: null,
  usuarioActual: null,
  usuariosCompartidos: [],
};

// Referencias a elementos del DOM
const dom = {};

/** Inicializa la aplicación. */
function inicializar() {
  dom.app = document.getElementById('app');
  if (!dom.aviso) {
    dom.aviso = document.createElement('div');
    dom.aviso.className = 'po-aviso';
    dom.aviso.style.display = 'none';
    document.body.append(dom.aviso);
  }

  // Cargar pestaña recordada
  try {
    const guardada = localStorage.getItem(CLAVE_PESTANA);
    if (guardada && ['edt', 'gantt', 'tabla', 'cohete'].includes(guardada)) {
      estado.pestana = guardada;
    }
  } catch { /* ignorar */ }

  // Intentar cargar datos.json
  cargarInicial();
}

/** Muestra un aviso que desaparece a los 5 segundos. */
function mostrarAviso(mensaje) {
  if (!dom.aviso) return;
  dom.aviso.textContent = mensaje;
  dom.aviso.style.display = 'block';
  clearTimeout(dom.aviso._timeout);
  dom.aviso._timeout = setTimeout(() => {
    dom.aviso.style.display = 'none';
  }, 5000);
}

/** Intenta cargar datos.json al arrancar. */
async function cargarInicial() {
  try {
    const [datos, usuario, usuarios] = await Promise.all([
      A.cargarDesdeServidor(),
      A.cargarUsuarioActual(),
      A.cargarUsuariosCompartidos(),
    ]);
    estado.usuarioActual = usuario;
    estado.usuariosCompartidos = usuarios;
    if (datos) {
      establecerDatos(datos, {
        manejador: null,
        nombre: 'datos.json',
        sinGuardar: false,
        guardarBorrador: false,
      });
      return;
    }
    // No hay datos.json → pantalla de inicio
    mostrarPantallaInicio();
  } catch (error) {
    mostrarAviso(error.message);
    mostrarPantallaInicio();
  }
}

/**
 * Establece los datos actuales y muestra la interfaz principal.
 * @param {object} datos - Datos del proyecto.
 * @param {object} opciones - { manejador, nombre, sinGuardar, guardarBorrador }
 */
function establecerDatos(datos, opciones = {}) {
  const {
    manejador = null,
    nombre = 'datos.json',
    sinGuardar = false,
    guardarBorrador = true,
  } = opciones;

  clearTimeout(estado.temporizadorAutoguardado);
  estado.temporizadorAutoguardado = null;
  estado.datos = datos;
  estado.manejador = manejador;
  estado.nombreArchivo = nombre;
  estado.historial = [];
  estado.futuro = [];
  estado.sinGuardar = sinGuardar;
  estado.estadoGuardado = sinGuardar ? 'modificado' : 'guardado';
  estado.cambioExternoPendiente = null;
  estado.edicionesDuranteCambio = [];
  estado.seleccion = null;
  estado.modelo = M.construir(datos);

  if (guardarBorrador) {
    A.guardarBorrador(datos);
  } else {
    A.borrarBorrador();
  }

  mostrarPantallaPrincipal();
  if (!manejador) {
    conectarEventosServidor();
    if (sinGuardar) {
      programarAutoguardado();
    }
  }
}

/** Muestra la pantalla de inicio (sin proyecto). */
function mostrarPantallaInicio() {
  clearTimeout(estado.temporizadorAutoguardado);
  estado.temporizadorAutoguardado = null;
  desconectarEventosServidor();
  // Limpiar vista/editor existentes
  if (estado.vista) {
    estado.vista.destruir();
    estado.vista = null;
  }
  estado.editor = null;

  dom.app.replaceChildren();

  const inicio = document.createElement('div');
  inicio.className = 'po-inicio';

  const tituloApp = document.createElement('h1');
  tituloApp.textContent = 'Project Organizer';
  inicio.append(tituloApp);

  // Formulario nuevo proyecto
  const form = document.createElement('form');
  form.className = 'po-formulario';

  const divNombre = document.createElement('div');
  divNombre.className = 'po-grupo';
  const etiquetaNombre = document.createElement('label');
  etiquetaNombre.className = 'po-etiqueta';
  etiquetaNombre.textContent = 'Nombre del proyecto';
  const inputNombre = document.createElement('input');
  inputNombre.className = 'po-campo';
  inputNombre.type = 'text';
  inputNombre.required = true;
  inputNombre.maxLength = 120;
  divNombre.append(etiquetaNombre, inputNombre);

  const divEquipo = document.createElement('div');
  divEquipo.className = 'po-grupo';
  const etiquetaEquipo = document.createElement('label');
  etiquetaEquipo.className = 'po-etiqueta';
  etiquetaEquipo.textContent = 'Equipo (separado por comas)';
  const inputEquipo = document.createElement('input');
  inputEquipo.className = 'po-campo';
  inputEquipo.type = 'text';
  inputEquipo.placeholder = 'Ana, Luis, Marta';
  divEquipo.append(etiquetaEquipo, inputEquipo);

  const divPlantilla = document.createElement('div');
  divPlantilla.className = 'po-grupo';
  const etiquetaPlantilla = document.createElement('span');
  etiquetaPlantilla.className = 'po-etiqueta';
  etiquetaPlantilla.textContent = 'Plantilla';
  const radioVacia = document.createElement('input');
  radioVacia.type = 'radio';
  radioVacia.name = 'plantilla';
  radioVacia.value = 'vacia';
  radioVacia.id = 'plantilla-vacia';
  radioVacia.checked = true;
  const labelVacia = document.createElement('label');
  labelVacia.htmlFor = 'plantilla-vacia';
  labelVacia.textContent = 'Vacía';
  const radioBasica = document.createElement('input');
  radioBasica.type = 'radio';
  radioBasica.name = 'plantilla';
  radioBasica.value = 'basica';
  radioBasica.id = 'plantilla-basica';
  const labelBasica = document.createElement('label');
  labelBasica.htmlFor = 'plantilla-basica';
  labelBasica.textContent = 'Básica';
  divPlantilla.append(etiquetaPlantilla, radioVacia, labelVacia, radioBasica, labelBasica);

  const botonCrear = document.createElement('button');
  botonCrear.type = 'submit';
  botonCrear.className = 'po-boton po-primario';
  botonCrear.textContent = 'Nuevo proyecto';

  form.append(divNombre, divEquipo, divPlantilla, botonCrear);

  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const nombre = inputNombre.value.trim();
    if (!nombre) {
      mostrarAviso('El nombre del proyecto es obligatorio.');
      return;
    }
    const equipoTexto = inputEquipo.value.trim();
    const equipo = equipoTexto
      ? equipoTexto.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const plantilla = radioVacia.checked ? 'vacia' : 'basica';

    try {
      const datos = M.proyectoDesdePlantilla(nombre, equipo, plantilla);
      establecerDatos(datos, {
        manejador: null,
        nombre: 'datos.json',
        sinGuardar: true,
        guardarBorrador: true,
      });
    } catch (error) {
      mostrarAviso(error.message);
    }
  });

  const botonAbrir = document.createElement('button');
  botonAbrir.type = 'button';
  botonAbrir.className = 'po-boton';
  botonAbrir.textContent = 'Abrir archivo…';
  botonAbrir.addEventListener('click', () => {
    abrirArchivo();
  });

  inicio.append(form, botonAbrir);

  // Opciones de borrador si existe
  const borrador = A.leerBorrador();
  if (borrador && borrador.datos) {
    const contenedorBorrador = document.createElement('div');
    contenedorBorrador.className = 'po-borrador';
    const fecha = new Date(borrador.guardado).toLocaleString();
    const textoBorrador = document.createElement('p');
    textoBorrador.textContent = `Hay un borrador sin guardar del ${fecha}.`;
    const btnRecuperar = document.createElement('button');
    btnRecuperar.className = 'po-boton po-boton-borrador';
    btnRecuperar.textContent = `Recuperar borrador del ${fecha}`;
    btnRecuperar.addEventListener('click', () => {
      establecerDatos(borrador.datos, {
        manejador: null,
        nombre: 'datos.json',
        sinGuardar: true,
        guardarBorrador: true,
      });
    });
    const btnDescartar = document.createElement('button');
    btnDescartar.className = 'po-boton po-boton-borrador';
    btnDescartar.textContent = 'Descartar';
    btnDescartar.addEventListener('click', () => {
      A.borrarBorrador();
      mostrarPantallaInicio(); // Reconstruye sin borrador
    });
    contenedorBorrador.append(textoBorrador, btnRecuperar, btnDescartar);
    inicio.append(contenedorBorrador);
  }

  dom.app.append(inicio);
}

/** Muestra la interfaz principal con datos cargados. */
function mostrarPantallaPrincipal() {
  if (typeof document !== 'undefined') {
    dom.app = document.getElementById('app') || dom.app;
  }
  // Limpiar vista anterior
  if (estado.vista) {
    estado.vista.destruir();
    estado.vista = null;
  }

  dom.app.replaceChildren();

  // Cabecera
  const cabecera = document.createElement('header');
  cabecera.className = 'po-cabecera';

  dom.tituloProyecto = document.createElement('span');
  dom.tituloProyecto.className = 'po-titulo';
  dom.tituloProyecto.textContent = estado.modelo.proyecto.nombre;
  dom.tituloProyecto.addEventListener('click', editarTitulo);

  dom.singuardar = document.createElement('span');
  dom.singuardar.className = 'po-singuardar';
  dom.singuardar.textContent = 'Guardado';

  dom.btnDeshacer = crearBoton('Deshacer', deshacer);
  dom.btnRehacer = crearBoton('Rehacer', rehacer);
  dom.btnGuardar = crearBoton('Guardar ahora', guardar);
  dom.btnGuardarComo = crearBoton('Guardar como…', guardarComo);
  dom.btnEquipo = crearBoton('Equipo…', abrirEquipo);
  dom.btnAbrir = crearBoton('Abrir…', () => {
    abrirArchivo();
  });
  dom.btnNuevo = crearBoton('Nuevo…', () => {
    if (confirmarSiHayCambios()) mostrarPantallaInicio();
  });

  cabecera.append(dom.tituloProyecto, dom.singuardar, dom.btnDeshacer, dom.btnRehacer, dom.btnGuardar, dom.btnGuardarComo, dom.btnEquipo, dom.btnAbrir, dom.btnNuevo);

  if (estado.usuarioActual && estado.usuarioActual.nombre) {
    dom.usuarioActivo = document.createElement('span');
    dom.usuarioActivo.className = 'po-usuario';
    dom.usuarioActivo.textContent = `👤 ${estado.usuarioActual.nombre}`;
    cabecera.append(dom.usuarioActivo);
  }

  // Contenedor para el aviso de conflicto (409)
  dom.contenedorConflicto = document.createElement('div');
  dom.contenedorConflicto.className = 'po-contenedor-conflicto';

  // Pestañas
  const pestanas = document.createElement('nav');
  pestanas.className = 'po-pestanas';
  dom.pestanas = {};
  const etiquetasPestanas = {
    edt: 'EDT',
    gantt: 'Gantt',
    tabla: 'Tabla',
    cohete: 'Cohete',
  };
  for (const p of ['edt', 'gantt', 'tabla', 'cohete']) {
    const boton = document.createElement('button');
    boton.className = 'po-pestana';
    boton.textContent = etiquetasPestanas[p];
    boton.addEventListener('click', () => cambiarPestana(p));
    pestanas.append(boton);
    dom.pestanas[p] = boton;
  }

  // Barra de filtros única para las vistas
  const barraFiltros = document.createElement('div');
  barraFiltros.className = 'po-barra-filtros';
  dom.barraFiltros = barraFiltros;

  dom.filtroTexto = document.createElement('input');
  dom.filtroTexto.type = 'search';
  dom.filtroTexto.className = 'po-campo po-filtro-texto';
  dom.filtroTexto.placeholder = 'Filtrar por texto…';
  dom.filtroTexto.setAttribute('aria-label', 'Filtrar por texto');
  dom.filtroTexto.value = estado.filtros.texto;
  dom.filtroTexto.addEventListener('input', () => {
    estado.filtros.texto = dom.filtroTexto.value;
    aplicarFiltros();
  });

  dom.filtroResponsable = document.createElement('select');
  dom.filtroResponsable.className = 'po-campo po-filtro-responsable';
  dom.filtroResponsable.setAttribute('aria-label', 'Filtrar por responsable');
  dom.filtroResponsable.addEventListener('change', () => {
    estado.filtros.responsable = dom.filtroResponsable.value;
    aplicarFiltros();
  });

  dom.filtroEstado = document.createElement('select');
  dom.filtroEstado.className = 'po-campo po-filtro-estado';
  dom.filtroEstado.setAttribute('aria-label', 'Filtrar por estado');
  const opcionesEstado = [
    ['', 'Todos los estados'],
    ['pendiente', 'Pendiente'],
    ['en curso', 'En curso'],
    ['hecha', 'Hecha'],
    ['bloqueada', 'Bloqueada'],
  ];
  for (const [val, etiq] of opcionesEstado) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = etiq;
    dom.filtroEstado.append(opt);
  }
  dom.filtroEstado.value = estado.filtros.estado;
  dom.filtroEstado.addEventListener('change', () => {
    estado.filtros.estado = dom.filtroEstado.value;
    aplicarFiltros();
  });

  dom.filtroTipo = document.createElement('select');
  dom.filtroTipo.className = 'po-campo po-filtro-tipo';
  dom.filtroTipo.setAttribute('aria-label', 'Filtrar por tipo');
  const opcionesTipo = [
    ['', 'Todos los tipos'],
    ['tarea', 'Tareas'],
    ['entregable', '📦 Entregables'],
  ];
  for (const [val, etiq] of opcionesTipo) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = etiq;
    dom.filtroTipo.append(opt);
  }
  dom.filtroTipo.value = estado.filtros.tipo || '';
  dom.filtroTipo.addEventListener('change', () => {
    estado.filtros.tipo = dom.filtroTipo.value;
    aplicarFiltros();
  });

  dom.filtroModoFecha = document.createElement('select');
  dom.filtroModoFecha.className = 'po-campo po-filtro-modo-fecha';
  dom.filtroModoFecha.setAttribute('aria-label', 'Criterio de fecha');
  for (const [val, etiq] of [
    ['fin', '📅 Se entregan el…'],
    ['activa', '📅 Activas el…'],
  ]) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = etiq;
    dom.filtroModoFecha.append(opt);
  }
  dom.filtroModoFecha.value = estado.filtros.modoFecha || 'fin';
  dom.filtroModoFecha.addEventListener('change', () => {
    estado.filtros.modoFecha = dom.filtroModoFecha.value;
    aplicarFiltros();
  });

  dom.filtroFecha = document.createElement('input');
  dom.filtroFecha.type = 'date';
  dom.filtroFecha.className = 'po-campo po-filtro-fecha';
  dom.filtroFecha.setAttribute('aria-label', 'Filtrar por fecha');
  dom.filtroFecha.value = estado.filtros.fecha || '';
  dom.filtroFecha.addEventListener('change', () => {
    estado.filtros.fecha = dom.filtroFecha.value;
    aplicarFiltros();
  });

  dom.btnQuitarFiltros = crearBoton('Quitar filtros', limpiarFiltros);
  dom.btnQuitarFiltros.classList.add('po-filtro-quitar');

  barraFiltros.append(
    dom.filtroTexto,
    dom.filtroResponsable,
    dom.filtroEstado,
    dom.filtroTipo,
    dom.filtroModoFecha,
    dom.filtroFecha,
    dom.btnQuitarFiltros
  );
  sincronizarOpcionesResponsable();

  // Cuerpo
  const cuerpo = document.createElement('div');
  cuerpo.className = 'po-cuerpo';
  dom.vistaContenedor = document.createElement('div');
  dom.vistaContenedor.className = 'po-vista';
  dom.editorContenedor = document.createElement('div');
  dom.editorContenedor.className = 'po-editor';
  cuerpo.append(dom.vistaContenedor, dom.editorContenedor);

  dom.app.append(cabecera, dom.contenedorConflicto, pestanas, barraFiltros, cuerpo);

  // Crear editor
  estado.editor = crearEditor(dom.editorContenedor, {
    aplicar: aplicar,
    alSeleccionar: manejarSeleccion,
    alTerminarEdicion: alTerminarEdicionCampo,
    usuariosCompartidos: estado.usuariosCompartidos,
  });

  // Crear vista actual y mostrar el editor (sin selección al abrir)
  crearVistaActual();
  estado.editor.mostrar(estado.modelo, estado.seleccion);

  // Actualizar UI
  refrescarUI();
}

/**
 * Ventana para editar el equipo. Escribir sobre un nombre lo renombra (conserva sus asignaciones);
 * ✕ lo quita (sus actividades quedan sin asignar). Se aplica con «Listo» y se puede deshacer.
 */
function abrirEquipo() {
  const dialogo = document.createElement('dialog');
  dialogo.className = 'po-dialogo';
  const titulo = document.createElement('h2');
  titulo.textContent = 'Equipo';
  const ayuda = document.createElement('p');
  ayuda.className = 'po-dialogo-ayuda';
  ayuda.textContent = 'Escribe sobre un nombre para renombrarlo; sus actividades pasan al nombre nuevo.';
  const lista = document.createElement('div');
  lista.className = 'po-equipo-lista';

  const agregarFila = (antes) => {
    const fila = document.createElement('div');
    fila.className = 'po-equipo-fila';
    const campo = document.createElement('input');
    campo.className = 'po-campo';
    campo.type = 'text';
    campo.value = antes || '';
    campo.placeholder = 'Nombre';
    campo.setAttribute('aria-label', 'Nombre de la persona');
    fila.dataset.antes = antes || '';
    const quitar = crearBoton('✕', () => fila.remove());
    quitar.title = 'Quitar del equipo';
    quitar.setAttribute('aria-label', `Quitar ${antes || 'persona'}`);
    fila.append(campo, quitar);
    lista.append(fila);
    return campo;
  };
  estado.datos.equipo.forEach(agregarFila);

  const botonAgregar = crearBoton('+ Agregar persona', () => agregarFila(null).focus());
  const acciones = document.createElement('div');
  acciones.className = 'po-dialogo-acciones';
  const cancelar = crearBoton('Cancelar', () => dialogo.close());
  const listo = crearBoton('Listo', () => {
    const filas = [...lista.children].map(f => ({
      antes: f.dataset.antes || null,
      ahora: f.querySelector('input').value,
    }));
    aplicar(datos => M.actualizarEquipo(datos, filas));
    dialogo.close();
  });
  listo.classList.add('po-primario');
  acciones.append(cancelar, listo);

  dialogo.append(titulo, ayuda, lista, botonAgregar, acciones);
  dialogo.addEventListener('close', () => dialogo.remove());
  document.body.append(dialogo);
  dialogo.showModal();
}

/** Crea un botón con el texto y el manejador dados. */
function crearBoton(texto, manejador) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'po-boton';
  boton.textContent = texto;
  boton.addEventListener('click', manejador);
  return boton;
}

/** Cambia la pestaña activa. */
function cambiarPestana(nuevaPestana) {
  if (nuevaPestana === estado.pestana) return;

  estado.pestana = nuevaPestana;
  try {
    localStorage.setItem(CLAVE_PESTANA, nuevaPestana);
  } catch { /* ignorar */ }

  // Destruir vista anterior
  if (estado.vista) {
    estado.vista.destruir();
    estado.vista = null;
  }
  dom.vistaContenedor.replaceChildren();

  // Crear nueva vista
  crearVistaActual();
  actualizarVistaYEditor();
  refrescarUI();
}

/** Devuelve el modelo filtrado según los filtros activos en la barra única. */
function obtenerModeloFiltrado() {
  if (!estado.modelo) return null;
  return M.filtrarModelo(estado.modelo, estado.filtros);
}

/** Sincroniza las opciones del selector de responsable en la barra de filtros. */
function sincronizarOpcionesResponsable() {
  if (!dom.filtroResponsable || !estado.modelo) return;
  const valorActual = estado.filtros.responsable || '';
  const vistos = new Set();
  const responsables = [];
  for (const m of (estado.modelo.equipo || [])) {
    if (m && !vistos.has(m)) {
      vistos.add(m);
      responsables.push(m);
    }
  }
  for (const a of (estado.modelo.lista || [])) {
    if (a.responsable && !vistos.has(a.responsable)) {
      vistos.add(a.responsable);
      responsables.push(a.responsable);
    }
  }
  for (const h of (estado.modelo.hitos || [])) {
    if (h.responsable && !vistos.has(h.responsable)) {
      vistos.add(h.responsable);
      responsables.push(h.responsable);
    }
  }
  dom.filtroResponsable.replaceChildren();
  const optTodos = document.createElement('option');
  optTodos.value = '';
  optTodos.textContent = 'Todos los responsables';
  dom.filtroResponsable.append(optTodos);
  for (const r of responsables) {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    dom.filtroResponsable.append(opt);
  }
  if (valorActual && !vistos.has(valorActual)) {
    const optExtra = document.createElement('option');
    optExtra.value = valorActual;
    optExtra.textContent = valorActual;
    dom.filtroResponsable.append(optExtra);
  }
  dom.filtroResponsable.value = valorActual;
}

/** Aplica los filtros activos a la vista actual sin alterar el editor. */
function aplicarFiltros() {
  if (estado.vista && estado.modelo) {
    estado.vista.mostrar(obtenerModeloFiltrado(), estado.seleccion);
  }
  refrescarUI();
}

/** Restablece todos los filtros de la barra única. */
function limpiarFiltros() {
  estado.filtros.texto = '';
  estado.filtros.responsable = '';
  estado.filtros.estado = '';
  estado.filtros.tipo = '';
  estado.filtros.fecha = '';
  estado.filtros.modoFecha = 'fin';
  if (dom.filtroTexto) dom.filtroTexto.value = '';
  if (dom.filtroResponsable) dom.filtroResponsable.value = '';
  if (dom.filtroEstado) dom.filtroEstado.value = '';
  if (dom.filtroTipo) dom.filtroTipo.value = '';
  if (dom.filtroFecha) dom.filtroFecha.value = '';
  if (dom.filtroModoFecha) dom.filtroModoFecha.value = 'fin';
  aplicarFiltros();
}

/** Cambia el filtro de fecha desde una vista (p. ej. el selector rápido de fecha del Cohete). */
function cambiarFiltroFechaDesdeVista(nuevaFecha, nuevoModoFecha) {
  if (nuevaFecha !== undefined) {
    estado.filtros.fecha = nuevaFecha;
    if (dom.filtroFecha) dom.filtroFecha.value = nuevaFecha;
  }
  if (nuevoModoFecha !== undefined) {
    estado.filtros.modoFecha = nuevoModoFecha;
    if (dom.filtroModoFecha) dom.filtroModoFecha.value = nuevoModoFecha;
  }
  aplicarFiltros();
}

/** Crea la instancia de vista correspondiente a la pestaña actual. */
function crearVistaActual() {
  let creador;
  switch (estado.pestana) {
    case 'gantt': creador = vistaGantt; break;
    case 'tabla': creador = vistaTabla; break;
    case 'cohete': creador = vistaCohete; break;
    case 'edt':
    default: creador = vistaEdt; break;
  }
  estado.vista = creador(dom.vistaContenedor, {
    alSeleccionar: manejarSeleccion,
    aplicar: aplicar,
    filtros: estado.filtros,
    alCambiarFiltroFecha: cambiarFiltroFechaDesdeVista,
  });
  estado.vista.mostrar(obtenerModeloFiltrado(), estado.seleccion);
}

/** Callback de selección desde la vista o el editor. */
function manejarSeleccion(id) {
  estado.seleccion = id;
  actualizarVistaYEditor();
}

/** Actualiza vista (con modelo filtrado) y editor (con modelo completo) y selección actuales. */
function actualizarVistaYEditor() {
  if (estado.vista) {
    estado.vista.mostrar(obtenerModeloFiltrado(), estado.seleccion);
  }
  if (estado.editor) {
    estado.editor.mostrar(estado.modelo, estado.seleccion);
  }
}

/** Actualiza el estado de guardado en el indicador de la cabecera. */
function actualizarEstadoGuardado(nuevoEstado) {
  estado.estadoGuardado = nuevoEstado;
  if (!dom.singuardar) return;
  dom.singuardar.className = `po-singuardar po-estado-${nuevoEstado}`;
  dom.singuardar.style.display = 'inline';
  if (nuevoEstado === 'guardando') {
    dom.singuardar.textContent = 'Guardando…';
  } else if (nuevoEstado === 'guardado') {
    dom.singuardar.textContent = 'Guardado';
  } else if (nuevoEstado === 'conflicto') {
    dom.singuardar.textContent = 'Conflicto';
  } else if (nuevoEstado === 'error') {
    dom.singuardar.textContent = 'Error al guardar';
  } else {
    dom.singuardar.textContent = 'Sin guardar…';
  }
}

/** Actualiza elementos de la interfaz estática (título, indicador, botones). */
function refrescarUI() {
  if (!estado.modelo) return;

  // Título
  if (dom.tituloProyecto) {
    dom.tituloProyecto.textContent = estado.modelo.proyecto.nombre;
  }

  // Indicador de guardado
  if (estado.estadoGuardado === 'guardando' || estado.estadoGuardado === 'conflicto' || estado.estadoGuardado === 'error') {
    actualizarEstadoGuardado(estado.estadoGuardado);
  } else if (estado.sinGuardar) {
    actualizarEstadoGuardado('modificado');
  } else {
    actualizarEstadoGuardado('guardado');
  }

  // Sincronizar opciones de responsables en barra de filtros
  sincronizarOpcionesResponsable();
  if (dom.btnQuitarFiltros) {
    const hayFiltro = Boolean(
      (estado.filtros.texto && estado.filtros.texto.trim()) ||
      estado.filtros.responsable ||
      estado.filtros.estado ||
      estado.filtros.tipo ||
      estado.filtros.fecha
    );
    dom.btnQuitarFiltros.disabled = !hayFiltro;
  }

  // Botones deshacer/rehacer
  if (dom.btnDeshacer) dom.btnDeshacer.disabled = estado.historial.length === 0;
  if (dom.btnRehacer) dom.btnRehacer.disabled = estado.futuro.length === 0;

  // Resaltar pestaña activa
  for (const [pestana, boton] of Object.entries(dom.pestanas || {})) {
    boton.classList.toggle('po-activa', pestana === estado.pestana);
  }
}

/** Indica si el usuario está escribiendo actualmente en un campo del editor o en el título. */
function estaEditandoCampo() {
  if (estado.editor && estado.editor.enEdicion) {
    return true;
  }
  if (dom.app && dom.app.querySelector('.po-titulo-input')) {
    return true;
  }
  const activo = typeof document !== 'undefined' ? document.activeElement : null;
  if (activo && dom.editorContenedor && dom.editorContenedor.contains(activo)) {
    const tag = activo.tagName;
    if (tag === 'TEXTAREA' || (tag === 'INPUT' && activo.type === 'text')) {
      return true;
    }
  }
  return false;
}

/** Se invoca cuando el usuario termina de editar un campo (al salir del campo o pulsar Enter). */
async function alTerminarEdicionCampo() {
  if (!estado.cambioExternoPendiente) return;
  if (estaEditandoCampo()) return;
  const pendiente = estado.cambioExternoPendiente;
  const ediciones = estado.edicionesDuranteCambio.splice(0);
  estado.cambioExternoPendiente = null;
  await aplicarRecargaDesdeServidor(pendiente.datos, pendiente.etag, ediciones, true);
}

/** Programa el guardado automático 1 s después del último cambio (debounce). */
function programarAutoguardado() {
  clearTimeout(estado.temporizadorAutoguardado);
  estado.temporizadorAutoguardado = setTimeout(() => {
    estado.temporizadorAutoguardado = null;
    guardarInmediato({ esAuto: true });
  }, estado.intervaloAutoguardadoMs);
}

/** Ejecuta el guardado contra el servidor (o archivo local) usando If-Match. */
async function guardarInmediato(opciones = {}) {
  const { esAuto = false, etagForzado = null } = opciones;
  if (!estado.datos) return null;

  clearTimeout(estado.temporizadorAutoguardado);
  estado.temporizadorAutoguardado = null;

  // Modo archivo local con manejador
  if (estado.manejador) {
    if (esAuto) return null;
    try {
      actualizarEstadoGuardado('guardando');
      const resultadoLocal = await A.guardar(estado.datos, estado.manejador);
      if (!resultadoLocal) {
        refrescarUI();
        return null;
      }
      if (resultadoLocal.manejador) estado.manejador = resultadoLocal.manejador;
      if (resultadoLocal.nombre) estado.nombreArchivo = resultadoLocal.nombre;
      estado.sinGuardar = false;
      A.borrarBorrador();
      actualizarEstadoGuardado('guardado');
      mostrarAviso('Guardado');
      refrescarUI();
      return resultadoLocal;
    } catch (error) {
      actualizarEstadoGuardado('error');
      mostrarAviso(error.message);
      return null;
    }
  }

  // Modo servidor (con fallback a descarga/selector si no hay servidor y es manual)
  try {
    actualizarEstadoGuardado('guardando');
    const resultado = await A.guardarEnServidor(estado.datos, etagForzado);
    if (resultado === null) {
      // Modo sin servidor (ej. archivo estático)
      if (esAuto) {
        actualizarEstadoGuardado('modificado');
        return null;
      }
      const fallback = await A.guardarComo(estado.datos);
      if (!fallback) {
        actualizarEstadoGuardado(estado.sinGuardar ? 'modificado' : 'guardado');
        return null;
      }
      if (fallback.manejador) estado.manejador = fallback.manejador;
      estado.sinGuardar = false;
      A.borrarBorrador();
      actualizarEstadoGuardado('guardado');
      mostrarAviso(fallback.modo === 'descarga' ? 'Descargado datos.json' : 'Guardado');
      refrescarUI();
      return fallback;
    }

    if (resultado.conflicto) {
      actualizarEstadoGuardado('conflicto');
      mostrarBannerConflicto(resultado.etagActual);
      return resultado;
    }

    // 200 OK confirmado por el servidor
    if (resultado.nombre) estado.nombreArchivo = resultado.nombre;
    estado.sinGuardar = false;
    A.borrarBorrador();
    ocultarBannerConflicto();
    actualizarEstadoGuardado('guardado');
    if (!esAuto) {
      mostrarAviso(`Guardado como ${resultado.nombre}`);
    }
    refrescarUI();
    return resultado;
  } catch (error) {
    actualizarEstadoGuardado('error');
    if (!esAuto) {
      mostrarAviso(error.message);
    }
    return null;
  }
}

/** Oculta el aviso de conflicto si existe. */
function ocultarBannerConflicto() {
  if (dom.contenedorConflicto) {
    dom.contenedorConflicto.replaceChildren();
  }
}

/** Muestra un aviso de conflicto 409 con dos botones: "Cargar lo del otro" y "Mantener lo mío". */
function mostrarBannerConflicto(etagActualServidor) {
  if (!dom.contenedorConflicto) return;
  dom.contenedorConflicto.replaceChildren();

  const banner = document.createElement('div');
  banner.className = 'po-banner-conflicto';
  banner.setAttribute('role', 'alert');

  const texto = document.createElement('span');
  texto.className = 'po-banner-conflicto-texto';
  texto.textContent = '⚠️ Otra persona guardó cambios mientras editabas. ¿Qué versión deseas conservar?';

  const acciones = document.createElement('div');
  acciones.className = 'po-banner-conflicto-acciones';

  const btnCargarOtro = crearBoton('Cargar lo del otro', async () => {
    ocultarBannerConflicto();
    clearTimeout(estado.temporizadorAutoguardado);
    estado.temporizadorAutoguardado = null;
    estado.cambioExternoPendiente = null;
    estado.edicionesDuranteCambio = [];
    await aplicarRecargaDesdeServidor(null, null, [], true);
    A.borrarBorrador();
  });
  btnCargarOtro.classList.add('po-boton-cargar-otro');

  const btnMantenerMio = crearBoton('Mantener lo mío', async () => {
    ocultarBannerConflicto();
    let etagReintento = etagActualServidor;
    if (!etagReintento) {
      const consulta = await A.consultarDesdeServidor();
      if (consulta && consulta.etag) {
        etagReintento = consulta.etag;
      }
    }
    if (etagReintento) {
      A.establecerUltimoEtag(etagReintento);
    }
    await guardarInmediato({ esAuto: false, etagForzado: etagReintento });
  });
  btnMantenerMio.classList.add('po-primario', 'po-boton-mantener-mio');

  acciones.append(btnCargarOtro, btnMantenerMio);
  banner.append(texto, acciones);
  dom.contenedorConflicto.append(banner);
}

/** Cierra la conexión SSE activa si existe. */
function desconectarEventosServidor() {
  if (estado.eventSource) {
    estado.eventSource.close();
    estado.eventSource = null;
  }
}

/** Conecta a /api/eventos (SSE) para sincronización en vivo y revalidación al reconectar. */
function conectarEventosServidor() {
  desconectarEventosServidor();
  if (typeof EventSource === 'undefined') return null;

  let desconectadoPreviamente = false;
  const es = new EventSource('/api/eventos');
  estado.eventSource = es;

  es.addEventListener('cambio', (ev) => {
    try {
      const payload = JSON.parse(ev.data || '{}');
      manejarCambioExterno(payload.etag);
    } catch { /* ignorar */ }
  });

  es.onopen = async () => {
    if (desconectadoPreviamente) {
      desconectadoPreviamente = false;
      // Al reconectar, revalidar el ETag y recargar si cambió
      const consulta = await A.consultarDesdeServidor();
      if (consulta && consulta.etag && !M.esEcoPropio(consulta.etag, A.obtenerUltimoEtag())) {
        await manejarCambioExterno(consulta.etag, consulta.datos);
      }
    }
  };

  es.onerror = () => {
    desconectadoPreviamente = true;
  };

  return es;
}

/** Maneja un evento de cambio externo recibido por SSE o al reconectar. */
async function manejarCambioExterno(etagEvento, datosPrecargados = null) {
  if (M.esEcoPropio(etagEvento, A.obtenerUltimoEtag())) {
    return false;
  }
  if (estaEditandoCampo()) {
    estado.cambioExternoPendiente = {
      etag: etagEvento,
      datos: datosPrecargados,
    };
    return false;
  }
  return aplicarRecargaDesdeServidor(datosPrecargados, etagEvento, [], false);
}

/**
 * Recarga los datos desde el servidor sin perder selección, pestaña, vista ni historial.
 * Si hubo ediciones del usuario mientras escribía en un campo, las reaplica sobre los datos nuevos.
 */
async function aplicarRecargaDesdeServidor(datosPrecargados = null, etagPrecargado = null, transformacionesExtra = [], forzar = false) {
  let nuevosDatos = datosPrecargados;
  let nuevoEtag = etagPrecargado;

  if (!nuevosDatos) {
    const consulta = await A.consultarDesdeServidor();
    if (!consulta || !consulta.datos) return false;
    nuevosDatos = consulta.datos;
    if (consulta.etag) nuevoEtag = consulta.etag;
  }

  if (!forzar && nuevoEtag && M.esEcoPropio(nuevoEtag, A.obtenerUltimoEtag())) {
    return false;
  }

  if (nuevoEtag) {
    A.establecerUltimoEtag(nuevoEtag);
  }

  let datosCombinados = nuevosDatos;
  for (const fn of transformacionesExtra) {
    try {
      datosCombinados = fn(datosCombinados);
    } catch { /* ignorar si no aplica */ }
  }

  estado.datos = datosCombinados;
  estado.modelo = M.construir(estado.datos);
  estado.recargasExternas += 1;

  // Conservar selección si el nodo o hito sigue existiendo
  const seleccionSigue = !estado.seleccion ||
    estado.modelo.porId.has(estado.seleccion) ||
    (estado.modelo.hitos || []).some(h => h.id === estado.seleccion);
  if (!seleccionSigue) {
    estado.seleccion = null;
  }

  if (transformacionesExtra.length > 0) {
    estado.sinGuardar = true;
    A.guardarBorrador(estado.datos);
    actualizarEstadoGuardado('modificado');
    programarAutoguardado();
  } else {
    estado.sinGuardar = false;
    actualizarEstadoGuardado('guardado');
  }

  // Actualizar vista y editor existentes (conserva pestaña, instancia de vista e historial)
  actualizarVistaYEditor();
  refrescarUI();
  return true;
}

/** Aplica una función de transformación a los datos, con historial, refresco y autoguardado. */
function aplicar(f) {
  try {
    const nuevos = f(estado.datos);
    // Historial: guardar estado actual antes de cambiarlo
    estado.historial.push(estado.datos);
    if (estado.historial.length > 100) estado.historial.shift();
    estado.futuro = [];
    estado.datos = nuevos;
    estado.sinGuardar = true;
    if (estado.cambioExternoPendiente) {
      estado.edicionesDuranteCambio.push(f);
    }
    estado.modelo = M.construir(estado.datos);
    // Si la selección ya no existe, limpiarla
    const seleccionValida = !estado.seleccion ||
      estado.modelo.porId.has(estado.seleccion) ||
      (estado.modelo.hitos || []).some(h => h.id === estado.seleccion);
    if (!seleccionValida) {
      estado.seleccion = null;
    }
    A.guardarBorrador(estado.datos);
    actualizarEstadoGuardado('modificado');
    actualizarVistaYEditor();
    refrescarUI();
    programarAutoguardado();
  } catch (error) {
    mostrarAviso(error.message);
  }
}

/** Deshace el último cambio. */
function deshacer() {
  if (estado.historial.length === 0) return;
  const anterior = estado.historial.pop();
  estado.futuro.push(estado.datos);
  estado.datos = anterior;
  estado.sinGuardar = true;
  estado.modelo = M.construir(estado.datos);
  const seleccionValida = !estado.seleccion ||
    estado.modelo.porId.has(estado.seleccion) ||
    (estado.modelo.hitos || []).some(h => h.id === estado.seleccion);
  if (!seleccionValida) {
    estado.seleccion = null;
  }
  A.guardarBorrador(estado.datos);
  actualizarEstadoGuardado('modificado');
  actualizarVistaYEditor();
  refrescarUI();
  programarAutoguardado();
}

/** Rehace el último cambio deshecho. */
function rehacer() {
  if (estado.futuro.length === 0) return;
  const siguiente = estado.futuro.pop();
  estado.historial.push(estado.datos);
  estado.datos = siguiente;
  estado.sinGuardar = true;
  estado.modelo = M.construir(estado.datos);
  const seleccionValida = !estado.seleccion ||
    estado.modelo.porId.has(estado.seleccion) ||
    (estado.modelo.hitos || []).some(h => h.id === estado.seleccion);
  if (!seleccionValida) {
    estado.seleccion = null;
  }
  A.guardarBorrador(estado.datos);
  actualizarEstadoGuardado('modificado');
  actualizarVistaYEditor();
  refrescarUI();
  programarAutoguardado();
}

/** Guarda el proyecto inmediatamente ("Guardar ahora"). */
async function guardar() {
  return guardarInmediato({ esAuto: false });
}

/** Abre siempre el explorador de archivos local (o descarga) para guardar una copia en el PC. */
async function guardarComo() {
  if (!estado.datos) return;
  try {
    const resultado = await A.guardarComo(estado.datos);
    if (!resultado) return; // Cancelado
    if (resultado.manejador) estado.manejador = resultado.manejador;
    estado.sinGuardar = false;
    A.borrarBorrador();
    actualizarEstadoGuardado('guardado');
    mostrarAviso(resultado.modo === 'descarga' ? 'Descargado datos.json' : `Guardado en tu equipo (${resultado.nombre})`);
    refrescarUI();
  } catch (error) {
    mostrarAviso(error.message);
  }
}

/** Abre el selector de archivos del computador del usuario. */
async function abrirArchivoLocal() {
  try {
    const resultado = await A.abrirArchivo();
    if (resultado) {
      establecerDatos(resultado.datos, {
        manejador: resultado.manejador,
        nombre: resultado.nombre,
        sinGuardar: false,
        guardarBorrador: false,
      });
    }
  } catch (error) {
    mostrarAviso(error.message);
  }
}

/**
 * Abre una ventana que muestra las versiones guardadas previamente en el servidor
 * y un botón para abrir un archivo local desde el computador.
 */
async function abrirArchivo() {
  if (!confirmarSiHayCambios()) return;

  const archivosServidor = await A.listarGuardadosServidor();
  if (!archivosServidor) {
    // Sin servidor.py (ej. GitHub Pages): abrir selector local directamente
    await abrirArchivoLocal();
    return;
  }

  const dialogo = document.createElement('dialog');
  dialogo.className = 'po-dialogo';

  const titulo = document.createElement('h2');
  titulo.textContent = 'Abrir proyecto';

  const subServ = document.createElement('p');
  subServ.className = 'po-dialogo-ayuda';
  subServ.textContent = 'Guardados previamente:';

  const lista = document.createElement('div');
  lista.className = 'po-guardados-lista';

  if (archivosServidor.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'po-dialogo-ayuda';
    vacio.textContent = 'No hay versiones guardadas todavía.';
    lista.append(vacio);
  } else {
    for (const item of archivosServidor) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'po-guardado-item';

      const filaSup = document.createElement('div');
      filaSup.className = 'po-guardado-cabecera';

      const nombreArchivo = document.createElement('span');
      nombreArchivo.className = 'po-guardado-nombre';
      nombreArchivo.textContent = item.nombre;

      const chip = document.createElement('span');
      chip.className = 'po-guardado-etiqueta';
      chip.textContent = item.etiqueta || '';

      filaSup.append(nombreArchivo, chip);

      const filaInf = document.createElement('div');
      filaInf.className = 'po-guardado-meta';
      const fechaTexto = item.fecha ? new Date(item.fecha).toLocaleString() : '';
      const proyTexto = item.proyecto ? `${item.proyecto} · ` : '';
      filaInf.textContent = `${proyTexto}${fechaTexto}`;

      btn.append(filaSup, filaInf);
      btn.addEventListener('click', async () => {
        try {
          const cargado = await A.cargarGuardadoServidor(item.nombre);
          dialogo.close();
          establecerDatos(cargado.datos, {
            manejador: null,
            nombre: cargado.nombre,
            sinGuardar: false,
            guardarBorrador: false,
          });
          mostrarAviso(`Abierto ${cargado.nombre}`);
        } catch (error) {
          mostrarAviso(error.message);
        }
      });
      lista.append(btn);
    }
  }

  const separador = document.createElement('div');
  separador.className = 'po-guardados-local';

  const btnLocal = crearBoton('Abrir desde mi computador…', async () => {
    dialogo.close();
    await abrirArchivoLocal();
  });
  btnLocal.classList.add('po-primario');
  separador.append(btnLocal);

  const acciones = document.createElement('div');
  acciones.className = 'po-dialogo-acciones';
  const cancelar = crearBoton('Cancelar', () => dialogo.close());
  acciones.append(cancelar);

  dialogo.append(titulo, subServ, lista, separador, acciones);
  dialogo.addEventListener('close', () => dialogo.remove());
  document.body.append(dialogo);
  dialogo.showModal();
}

/** Muestra confirmación si hay cambios sin guardar. Devuelve true si se puede continuar. */
function confirmarSiHayCambios() {
  if (estado.sinGuardar) {
    return confirm('Hay cambios sin guardar. ¿Deseas continuar?');
  }
  return true;
}

/** Inicia la edición del título del proyecto. */
function editarTitulo() {
  if (!estado.modelo) return;
  const nombreActual = estado.modelo.proyecto.nombre;
  const input = document.createElement('input');
  input.className = 'po-titulo-input';
  input.value = nombreActual;
  input.maxLength = 120;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      aplicarTitulo(input);
    } else if (e.key === 'Escape') {
      restaurarTitulo();
    }
  });
  input.addEventListener('blur', () => aplicarTitulo(input));
  dom.tituloProyecto.replaceWith(input);
  input.focus();
  input.select();
}

/** Aplica el nuevo título ingresado. */
function aplicarTitulo(input) {
  const nuevoNombre = input.value.trim();
  if (!nuevoNombre) {
    restaurarTitulo();
    return;
  }
  aplicar((datos) => M.editarProyecto(datos, { nombre: nuevoNombre }));
  restaurarTitulo();
}

/** Restaura la vista del título tras la edición. */
function restaurarTitulo() {
  // Reconstruir el span original
  const span = document.createElement('span');
  span.className = 'po-titulo';
  span.textContent = estado.modelo.proyecto.nombre;
  span.addEventListener('click', editarTitulo);
  const input = dom.app.querySelector('.po-titulo-input');
  if (input) input.replaceWith(span);
  dom.tituloProyecto = span;
  alTerminarEdicionCampo();
}

// Atajos de teclado globales
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (evento) => {
    const tecla = (evento.key || '').toLowerCase();
    const esMeta = evento.ctrlKey || evento.metaKey;

    if (!esMeta) return;

    // Ctrl/Cmd+S siempre guarda
    if (tecla === 's') {
      evento.preventDefault();
      guardar();
      return;
    }

    // Para Z/Y solo si no estamos en un campo de texto
    const objetivo = evento.target;
    const tag = objetivo && objetivo.tagName;
    const esCampoTexto = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (tecla === 'z' && !evento.shiftKey) {
      if (!esCampoTexto) {
        evento.preventDefault();
        deshacer();
      }
    } else if ((tecla === 'y') || (tecla === 'z' && evento.shiftKey)) {
      if (!esCampoTexto) {
        evento.preventDefault();
        rehacer();
      }
    }
  });
}

// Confirmación al cerrar con cambios sin guardar
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (evento) => {
    if (estado.sinGuardar) {
      evento.preventDefault();
      evento.returnValue = '';
    }
  });
}

// Arranque
if (typeof document !== 'undefined' && document.getElementById('app') && !globalThis.__PO_NO_AUTO_INIT__) {
  inicializar();
}

export {
  estado,
  dom,
  inicializar,
  establecerDatos,
  aplicar,
  deshacer,
  rehacer,
  guardar,
  guardarInmediato,
  manejarCambioExterno,
  aplicarRecargaDesdeServidor,
  mostrarBannerConflicto,
  ocultarBannerConflicto,
  conectarEventosServidor,
  desconectarEventosServidor,
  alTerminarEdicionCampo,
  limpiarFiltros,
  aplicarFiltros,
  cambiarPestana,
  manejarSeleccion,
};
