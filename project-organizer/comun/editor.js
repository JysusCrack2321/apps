/* Clases:
 * po-editor, po-editor-vacio, po-editor-mensaje, po-editor-botones,
 * po-editor-cabecera, po-editor-codigo, po-editor-nombre, po-editor-campo,
 * po-editor-etiqueta, po-editor-fechas, po-editor-fechas-calc,
 * po-editor-botones-orden, po-editor-botones-acciones, po-editor-boton,
 * po-boton, po-primario, po-peligro, po-campo, po-editor-input,
 * po-editor-select, po-editor-textarea
 */
import * as M from './modelo.js';

export function crearEditor(contenedor, { aplicar, alSeleccionar, alTerminarEdicion, usuariosCompartidos = [] }) {
  let modeloActual = null;
  let seleccionIdActual = null;
  let ultimoSeleccionId;
  let ultimoSerial;
  let campoEnEdicion = null;
  const apiEditor = { mostrar, estaEscribiendo, enEdicion: false };

  function estaEscribiendo() {
    if (campoEnEdicion && contenedor.contains(campoEnEdicion)) {
      return true;
    }
    const activo = typeof document !== 'undefined' ? document.activeElement : null;
    return Boolean(
      activo && contenedor.contains(activo) &&
      (activo.tagName === 'TEXTAREA' || (activo.tagName === 'INPUT' && activo.type === 'text'))
    );
  }

  function conectarEdicionTexto(el, valorInicial) {
    let valorConfirmado = valorInicial;
    el.addEventListener('focus', () => {
      campoEnEdicion = el;
      apiEditor.enEdicion = true;
    });
    el.addEventListener('input', () => {
      campoEnEdicion = el;
      apiEditor.enEdicion = true;
    });
    el.addEventListener('change', () => {
      valorConfirmado = el.value;
      campoEnEdicion = null;
      apiEditor.enEdicion = false;
      queueMicrotask(() => {
        if (!campoEnEdicion && alTerminarEdicion) {
          alTerminarEdicion();
        }
      });
    });
    el.addEventListener('blur', () => {
      campoEnEdicion = null;
      apiEditor.enEdicion = false;
      if (el.value !== valorConfirmado) {
        el.dispatchEvent(new Event('change'));
      }
      if (alTerminarEdicion) {
        alTerminarEdicion();
      }
    });
  }

  function obtenerListaResponsables() {
    const vistos = new Set();
    const lista = [];
    for (const m of (modeloActual?.equipo || [])) {
      if (m && !vistos.has(m)) {
        vistos.add(m);
        lista.push(m);
      }
    }
    for (const u of (usuariosCompartidos || [])) {
      const nombre = typeof u === 'string' ? u : u?.nombre;
      if (nombre && !vistos.has(nombre)) {
        vistos.add(nombre);
        lista.push(nombre);
      }
    }
    return lista;
  }

  function esActividad(id) {
    return modeloActual?.porId?.has(id) ?? false;
  }

  function esHito(id) {
    return Array.isArray(modeloActual?.hitos) && modeloActual.hitos.some(h => h.id === id);
  }

  function nodoDe(id) {
    return modeloActual?.porId?.get(id);
  }

  function hitoDe(id) {
    return modeloActual?.hitos?.find(h => h.id === id);
  }

  function serializarSeleccion(id) {
    if (!id || !modeloActual) return null;
    const nodo = nodoDe(id);
    if (nodo) {
      return JSON.stringify({
        tipo: 'actividad',
        tipoActividad: M.esEntregable(nodo) ? 'entregable' : 'tarea',
        nombre: nodo.nombre,
        padre: nodo.padre,
        responsable: nodo.responsable,
        inicio: nodo.inicio,
        fin: nodo.fin,
        estado: nodo.estado,
        notas: nodo.notas,
        numHijos: nodo.hijos.length,
        codigo: nodo.codigo,
      });
    }
    const hito = hitoDe(id);
    if (hito) {
      return JSON.stringify({
        tipo: 'hito',
        nombre: hito.nombre,
        inicio: hito.inicio,
        fin: hito.fin,
        responsable: hito.responsable,
      });
    }
    return null;
  }

  function mostrar(modelo, seleccionId) {
    modeloActual = modelo;
    seleccionIdActual = seleccionId;

    // No interrumpir si el usuario está escribiendo texto en la MISMA actividad.
    if (estaEscribiendo() && seleccionId === ultimoSeleccionId) {
      return;
    }

    const serial = serializarSeleccion(seleccionId);
    if (seleccionId === ultimoSeleccionId && serial === ultimoSerial) {
      return;
    }
    ultimoSeleccionId = seleccionId;
    ultimoSerial = serial;
    renderizar();
  }

  function renderizar() {
    while (contenedor.firstChild) contenedor.removeChild(contenedor.firstChild);

    if (!seleccionIdActual) {
      dibujarVacio();
    } else if (esActividad(seleccionIdActual)) {
      dibujarActividad(seleccionIdActual);
    } else if (esHito(seleccionIdActual)) {
      dibujarHito(seleccionIdActual);
    } else {
      dibujarVacio();
    }
  }

  function crearElemento(tag, clase, texto) {
    const el = document.createElement(tag);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  function crearCampo(texto, id) {
    const div = crearElemento('div', 'po-editor-campo');
    const label = crearElemento('label', 'po-editor-etiqueta', texto);
    label.htmlFor = id;
    div.appendChild(label);
    return div;
  }

  function crearBoton(texto, extraClases = '') {
    const btn = crearElemento('button', `po-boton po-editor-boton ${extraClases}`.trim(), texto);
    btn.type = 'button';
    return btn;
  }

  function fechaHoyLocal() {
    const d = new Date();
    const año = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const día = String(d.getDate()).padStart(2, '0');
    return `${año}-${mes}-${día}`;
  }

  function posicionFinal(id, nuevoPadre) {
    if (!modeloActual) return 0;
    return modeloActual.lista.filter(n => n.padre === nuevoPadre && n.id !== id).length;
  }

  function contarDescendientesModelo(id) {
    const nodo = nodoDe(id);
    if (!nodo) return 0;
    let total = 0;
    (function visitar(n) {
      for (const hijo of n.hijos) {
        total += 1;
        visitar(hijo);
      }
    })(nodo);
    return total;
  }

  function enfocarNombre() {
    setTimeout(() => {
      const input = contenedor.querySelector('#po-editor-nombre');
      if (input) input.focus();
    }, 0);
  }

  function dibujarVacio() {
    const div = crearElemento('div', 'po-editor po-editor-vacio');
    div.appendChild(crearElemento('p', 'po-editor-mensaje', 'Selecciona una actividad o un hito'));

    const botones = crearElemento('div', 'po-editor-botones');

    const btnActividad = crearBoton('+ Actividad de nivel 1', 'po-primario');
    btnActividad.addEventListener('click', () => {
      let idCreado = null;
      aplicar(datos => {
        const r = M.agregarActividad(datos, { padre: null, nombre: 'Nueva actividad' });
        idCreado = r.id;
        return r.datos;
      });
      if (idCreado) {
        alSeleccionar(idCreado);
        enfocarNombre();
      }
    });
    botones.appendChild(btnActividad);

    const btnHito = crearBoton('+ Hito');
    btnHito.addEventListener('click', () => {
      const hoy = fechaHoyLocal();
      let idCreado = null;
      aplicar(datos => {
        const r = M.agregarHito(datos, { nombre: 'Nuevo hito', inicio: hoy, fin: hoy, responsable: '' });
        idCreado = r.id;
        return r.datos;
      });
      if (idCreado) {
        alSeleccionar(idCreado);
        enfocarNombre();
      }
    });
    botones.appendChild(btnHito);

    div.appendChild(botones);
    contenedor.appendChild(div);
  }

  function dibujarActividad(id) {
    const nodo = nodoDe(id);
    if (!nodo) return;

    const div = crearElemento('div', 'po-editor po-editor-actividad');

    // Encabezado: código + nombre.
    const cabecera = crearElemento('div', 'po-editor-cabecera');
    cabecera.appendChild(crearElemento('span', 'po-editor-codigo', nodo.codigo));
    cabecera.appendChild(crearElemento('span', 'po-editor-nombre', nodo.nombre));
    div.appendChild(cabecera);

    // Nombre.
    const campoNombre = crearCampo('Nombre', 'po-editor-nombre');
    const inputNombre = crearElemento('input', 'po-campo po-editor-input');
    inputNombre.type = 'text';
    inputNombre.id = 'po-editor-nombre';
    inputNombre.value = nodo.nombre;
    inputNombre.addEventListener('change', () => {
      aplicar(datos => M.editarActividad(datos, id, { nombre: inputNombre.value }));
    });
    conectarEdicionTexto(inputNombre, nodo.nombre);
    inputNombre.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') {
        inputNombre.blur();
        if (campoEnEdicion === inputNombre) inputNombre.dispatchEvent(new Event('blur'));
      }
    });
    campoNombre.appendChild(inputNombre);
    div.appendChild(campoNombre);

    // Padre.
    const campoPadre = crearCampo('Padre', 'po-editor-padre');
    const selectPadre = crearElemento('select', 'po-campo po-editor-select');
    selectPadre.id = 'po-editor-padre';

    const optNivel1 = crearElemento('option', '', '— (nivel 1)');
    optNivel1.value = '';
    selectPadre.appendChild(optNivel1);

    const descIds = new Set();
    (function recolectar(n) {
      descIds.add(n.id);
      n.hijos.forEach(recolectar);
    })(nodo);

    for (const n of modeloActual.lista) {
      if (n.id !== id && !descIds.has(n.id)) {
        const opt = crearElemento('option', '', `${n.codigo} ${n.nombre}`);
        opt.value = n.id;
        selectPadre.appendChild(opt);
      }
    }
    selectPadre.value = nodo.padre || '';
    selectPadre.addEventListener('change', () => {
      const nuevoPadre = selectPadre.value || null;
      const pos = posicionFinal(id, nuevoPadre);
      aplicar(datos => M.moverActividad(datos, id, nuevoPadre, pos));
    });
    campoPadre.appendChild(selectPadre);
    div.appendChild(campoPadre);

    // Subir / bajar.
    const botonesOrden = crearElemento('div', 'po-editor-botones-orden');
    const btnSubir = crearBoton('↑', '');
    btnSubir.title = 'Subir';
    btnSubir.addEventListener('click', () => aplicar(datos => M.subir(datos, id)));
    const btnBajar = crearBoton('↓', '');
    btnBajar.title = 'Bajar';
    btnBajar.addEventListener('click', () => aplicar(datos => M.bajar(datos, id)));
    botonesOrden.append(btnSubir, btnBajar);
    div.appendChild(botonesOrden);

    // Responsable (en todas las actividades, también las que tienen hijos).
    const campoResp = crearCampo('Responsable', 'po-editor-responsable');
    const selectResp = crearElemento('select', 'po-campo po-editor-select');
    selectResp.id = 'po-editor-responsable';
    const optSin = crearElemento('option', '', '— sin asignar —');
    optSin.value = '';
    selectResp.appendChild(optSin);
    for (const miembro of obtenerListaResponsables()) {
      const opt = crearElemento('option', '', miembro);
      opt.value = miembro;
      selectResp.appendChild(opt);
    }
    selectResp.value = nodo.responsable || '';
    selectResp.addEventListener('change', () => {
      aplicar(datos => {
        const val = selectResp.value;
        const base = (val && !datos.equipo.includes(val))
          ? { ...datos, equipo: [...datos.equipo, val] }
          : datos;
        return M.editarActividad(base, id, { responsable: val });
      });
    });
    campoResp.appendChild(selectResp);
    div.appendChild(campoResp);

    if (nodo.esHoja) {
      // Tipo de actividad (Tarea vs Entregable).
      const campoTipo = crearCampo('Tipo', 'po-editor-tipo');
      const selectTipo = crearElemento('select', 'po-campo po-editor-select');
      selectTipo.id = 'po-editor-tipo';
      const optTarea = crearElemento('option', '', 'Tarea');
      optTarea.value = 'tarea';
      const optEntregable = crearElemento('option', '', '📦 Entregable');
      optEntregable.value = 'entregable';
      selectTipo.append(optTarea, optEntregable);
      selectTipo.value = M.esEntregable(nodo) ? 'entregable' : 'tarea';
      selectTipo.addEventListener('change', () => {
        const nuevoTipo = selectTipo.value;
        aplicar(datos => {
          const cambios = { tipo: nuevoTipo };
          if (nuevoTipo === 'entregable' && (!nodo.inicio || !nodo.fin)) {
            cambios.inicio = nodo.inicio || '2026-10-19';
            cambios.fin = nodo.fin || cambios.inicio;
          }
          return M.editarActividad(datos, id, cambios);
        });
      });
      campoTipo.appendChild(selectTipo);
      div.appendChild(campoTipo);

      // Inicio y fin.
      const campoFechas = crearElemento('div', 'po-editor-fechas');
      const campoInicio = crearCampo('Inicio', 'po-editor-inicio');
      const inputInicio = crearElemento('input', 'po-campo po-editor-input');
      inputInicio.type = 'date';
      inputInicio.id = 'po-editor-inicio';
      inputInicio.value = nodo.inicio || '';
      inputInicio.addEventListener('change', () => {
        const nuevoInicio = inputInicio.value;
        if (nuevoInicio === '') {
          aplicar(datos => M.editarActividad(datos, id, { inicio: '', fin: '' }));
          return;
        }
        const inputFin = contenedor.querySelector('#po-editor-fin');
        const finActual = inputFin ? inputFin.value : '';
        const nuevoFin = !finActual || finActual < nuevoInicio ? nuevoInicio : finActual;
        aplicar(datos => M.editarActividad(datos, id, { inicio: nuevoInicio, fin: nuevoFin }));
      });
      campoInicio.appendChild(inputInicio);
      campoFechas.appendChild(campoInicio);

      const campoFin = crearCampo('Fin', 'po-editor-fin');
      const inputFin = crearElemento('input', 'po-campo po-editor-input');
      inputFin.type = 'date';
      inputFin.id = 'po-editor-fin';
      inputFin.value = nodo.fin || '';
      inputFin.addEventListener('change', () => {
        const nuevoFin = inputFin.value;
        if (nuevoFin === '') {
          aplicar(datos => M.editarActividad(datos, id, { inicio: '', fin: '' }));
          return;
        }
        const inputInicio = contenedor.querySelector('#po-editor-inicio');
        const inicioActual = inputInicio ? inputInicio.value : '';
        const nuevoInicio = !inicioActual || inicioActual > nuevoFin ? nuevoFin : inicioActual;
        aplicar(datos => M.editarActividad(datos, id, { inicio: nuevoInicio, fin: nuevoFin }));
      });
      campoFin.appendChild(inputFin);
      campoFechas.appendChild(campoFin);
      div.appendChild(campoFechas);

      // Estado.
      const campoEstado = crearCampo('Estado', 'po-editor-estado');
      const selectEstado = crearElemento('select', 'po-campo po-editor-select');
      selectEstado.id = 'po-editor-estado';
      for (const estado of M.ESTADOS) {
        const opt = crearElemento('option', '', estado);
        opt.value = estado;
        selectEstado.appendChild(opt);
      }
      selectEstado.value = nodo.estado || 'pendiente';
      selectEstado.addEventListener('change', () => {
        aplicar(datos => M.editarActividad(datos, id, { estado: selectEstado.value }));
      });
      campoEstado.appendChild(selectEstado);
      div.appendChild(campoEstado);

      // Notas.
      const campoNotas = crearCampo('Notas', 'po-editor-notas');
      const textareaNotas = crearElemento('textarea', 'po-campo po-editor-textarea');
      textareaNotas.id = 'po-editor-notas';
      textareaNotas.value = nodo.notas || '';
      textareaNotas.addEventListener('change', () => {
        aplicar(datos => M.editarActividad(datos, id, { notas: textareaNotas.value }));
      });
      conectarEdicionTexto(textareaNotas, nodo.notas || '');
      textareaNotas.addEventListener('keydown', ev => {
        if (ev.key === 'Enter' && !ev.shiftKey) {
          ev.preventDefault();
          textareaNotas.blur();
          if (campoEnEdicion === textareaNotas) textareaNotas.dispatchEvent(new Event('blur'));
        }
      });
      campoNotas.appendChild(textareaNotas);
      div.appendChild(campoNotas);
    } else {
      // No hoja: mostrar fechas calculadas y avance.
      const info = crearElemento(
        'p',
        'po-editor-fechas-calc',
        `Fechas calculadas: ${nodo.inicio || '—'} – ${nodo.fin || '—'} · avance ${Math.round((nodo.avance ?? 0) * 100)} %`
      );
      div.appendChild(info);
    }

    // Botones de acción.
    const botonesAcciones = crearElemento('div', 'po-editor-botones-acciones');
    const btnHijo = crearBoton('+ Hijo');
    btnHijo.addEventListener('click', () => {
      let idCreado = null;
      aplicar(datos => {
        const r = M.agregarActividad(datos, { padre: id, nombre: 'Nueva actividad' });
        idCreado = r.id;
        return r.datos;
      });
      if (idCreado) {
        alSeleccionar(idCreado);
        enfocarNombre();
      }
    });

    const btnHermano = crearBoton('+ Hermano');
    btnHermano.addEventListener('click', () => {
      let idCreado = null;
      aplicar(datos => {
        const r = M.agregarActividad(datos, { padre: nodo.padre, nombre: 'Nueva actividad', despuesDe: id });
        idCreado = r.id;
        return r.datos;
      });
      if (idCreado) {
        alSeleccionar(idCreado);
        enfocarNombre();
      }
    });

    const btnEliminar = crearBoton('Eliminar', 'po-peligro');
    btnEliminar.addEventListener('click', () => {
      const num = contarDescendientesModelo(id);
      const mensaje = num > 0
        ? `¿Eliminar esta actividad y sus ${num} subactividades?`
        : '¿Eliminar esta actividad?';
      if (confirm(mensaje)) {
        aplicar(datos => M.eliminarActividad(datos, id));
      }
    });

    botonesAcciones.append(btnHijo, btnHermano, btnEliminar);
    div.appendChild(botonesAcciones);

    contenedor.appendChild(div);
  }

  function dibujarHito(id) {
    const hito = hitoDe(id);
    if (!hito) return;

    const div = crearElemento('div', 'po-editor po-editor-hito');

    // Encabezado.
    const cabecera = crearElemento('div', 'po-editor-cabecera');
    cabecera.appendChild(crearElemento('span', 'po-editor-nombre', hito.nombre));
    div.appendChild(cabecera);

    // Nombre.
    const campoNombre = crearCampo('Nombre', 'po-editor-nombre');
    const inputNombre = crearElemento('input', 'po-campo po-editor-input');
    inputNombre.type = 'text';
    inputNombre.id = 'po-editor-nombre';
    inputNombre.value = hito.nombre;
    inputNombre.addEventListener('change', () => {
      aplicar(datos => M.editarHito(datos, id, { nombre: inputNombre.value }));
    });
    conectarEdicionTexto(inputNombre, hito.nombre);
    inputNombre.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') {
        inputNombre.blur();
        if (campoEnEdicion === inputNombre) inputNombre.dispatchEvent(new Event('blur'));
      }
    });
    campoNombre.appendChild(inputNombre);
    div.appendChild(campoNombre);

    // Inicio.
    const campoInicio = crearCampo('Inicio', 'po-editor-inicio');
    const inputInicio = crearElemento('input', 'po-campo po-editor-input');
    inputInicio.type = 'date';
    inputInicio.id = 'po-editor-inicio';
    inputInicio.value = hito.inicio || '';
    inputInicio.addEventListener('change', () => {
      const nuevoInicio = inputInicio.value;
      if (nuevoInicio === '') {
        inputInicio.value = hito.inicio || '';
        return;
      }
      const inputFin = contenedor.querySelector('#po-editor-fin');
      const finActual = inputFin ? inputFin.value : '';
      const nuevoFin = !finActual || finActual < nuevoInicio ? nuevoInicio : finActual;
      aplicar(datos => M.editarHito(datos, id, { inicio: nuevoInicio, fin: nuevoFin }));
    });
    campoInicio.appendChild(inputInicio);
    div.appendChild(campoInicio);

    // Fin.
    const campoFin = crearCampo('Fin', 'po-editor-fin');
    const inputFin = crearElemento('input', 'po-campo po-editor-input');
    inputFin.type = 'date';
    inputFin.id = 'po-editor-fin';
    inputFin.value = hito.fin || '';
    inputFin.addEventListener('change', () => {
      const nuevoFin = inputFin.value;
      if (nuevoFin === '') {
        inputFin.value = hito.fin || '';
        return;
      }
      const inputInicio = contenedor.querySelector('#po-editor-inicio');
      const inicioActual = inputInicio ? inputInicio.value : '';
      const nuevoInicio = !inicioActual || inicioActual > nuevoFin ? nuevoFin : inicioActual;
      aplicar(datos => M.editarHito(datos, id, { inicio: nuevoInicio, fin: nuevoFin }));
    });
    campoFin.appendChild(inputFin);
    div.appendChild(campoFin);

    // Responsable.
    const campoResp = crearCampo('Responsable', 'po-editor-responsable');
    const selectResp = crearElemento('select', 'po-campo po-editor-select');
    selectResp.id = 'po-editor-responsable';
    const optSin = crearElemento('option', '', '— sin asignar —');
    optSin.value = '';
    selectResp.appendChild(optSin);
    for (const miembro of obtenerListaResponsables()) {
      const opt = crearElemento('option', '', miembro);
      opt.value = miembro;
      selectResp.appendChild(opt);
    }
    selectResp.value = hito.responsable || '';
    selectResp.addEventListener('change', () => {
      aplicar(datos => {
        const val = selectResp.value;
        const base = (val && !datos.equipo.includes(val))
          ? { ...datos, equipo: [...datos.equipo, val] }
          : datos;
        return M.editarHito(base, id, { responsable: val });
      });
    });
    campoResp.appendChild(selectResp);
    div.appendChild(campoResp);

    // Eliminar hito.
    const botonesAcciones = crearElemento('div', 'po-editor-botones-acciones');
    const btnEliminar = crearBoton('Eliminar hito', 'po-peligro');
    btnEliminar.addEventListener('click', () => {
      if (confirm('¿Eliminar este hito?')) {
        aplicar(datos => M.eliminarHito(datos, id));
      }
    });
    botonesAcciones.appendChild(btnEliminar);
    div.appendChild(botonesAcciones);

    contenedor.appendChild(div);
  }

  return apiEditor;
}
