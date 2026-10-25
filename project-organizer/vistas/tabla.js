// Clases: po-tabla, po-tabla-barra, po-tabla-filtro, po-campo, po-tabla-estado-filtro,
// po-tabla-casilla, po-boton, po-tabla-scroll, po-tabla-tabla, po-tabla-hitos,
// po-tabla-hitos-wrap, po-tabla-fila, po-tabla-hito-fila, po-tabla-seleccionada,
// po-tabla-cabecera, po-tabla-orden-asc, po-tabla-orden-desc, po-tabla-codigo,
// po-tabla-actividad, po-tabla-padre, po-tabla-estado-pendiente,
// po-tabla-estado-en-curso, po-tabla-estado-hecha, po-tabla-estado-bloqueada

import * as M from '../comun/modelo.js';

export function crearVista(contenedor, { alSeleccionar }) {
  const estado = {
    soloHojas: false,
    orden: 'edt',
    direccion: 1,
    seleccion: null,
  };

  let modeloActual = null;
  const control = new AbortController();
  const { signal } = control;

  // Construcción del DOM
  const root = document.createElement('div');
  root.className = 'po-tabla';

  const barra = document.createElement('div');
  barra.className = 'po-tabla-barra';

  const labelSoloHojas = document.createElement('label');
  labelSoloHojas.className = 'po-tabla-casilla';
  const checkboxSoloHojas = document.createElement('input');
  checkboxSoloHojas.type = 'checkbox';
  labelSoloHojas.append(checkboxSoloHojas, ' Solo hojas');
  barra.append(labelSoloHojas);

  const btnOrdenEDT = document.createElement('button');
  btnOrdenEDT.className = 'po-boton';
  btnOrdenEDT.textContent = 'Orden EDT';
  btnOrdenEDT.dataset.accion = 'orden-edt';
  barra.append(btnOrdenEDT);

  const btnExportar = document.createElement('button');
  btnExportar.className = 'po-boton';
  btnExportar.textContent = 'Exportar CSV';
  btnExportar.dataset.accion = 'exportar';
  barra.append(btnExportar);

  const btnCopiar = document.createElement('button');
  btnCopiar.className = 'po-boton';
  btnCopiar.textContent = 'Copiar para Docs';
  btnCopiar.dataset.accion = 'copiar';
  barra.append(btnCopiar);

  root.append(barra);

  const scroll = document.createElement('div');
  scroll.className = 'po-tabla-scroll';

  // Tabla de actividades
  const tablaAct = document.createElement('table');
  tablaAct.className = 'po-tabla-tabla';
  const theadAct = document.createElement('thead');
  const filaEncAct = document.createElement('tr');
  [
    { clave: 'codigo', texto: 'Código' },
    { clave: 'nombre', texto: 'Actividad' },
    { clave: 'responsable', texto: 'Responsable' },
    { clave: 'inicio', texto: 'Inicio' },
    { clave: 'fin', texto: 'Fin' },
    { clave: 'dias', texto: 'Días' },
    { clave: 'estado', texto: 'Estado' },
    { clave: 'avance', texto: 'Avance' },
  ].forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.texto;
    th.dataset.columna = col.clave;
    th.className = 'po-tabla-cabecera';
    th.setAttribute('role', 'button');
    filaEncAct.append(th);
  });
  theadAct.append(filaEncAct);
  tablaAct.append(theadAct);
  const tbodyAct = document.createElement('tbody');
  tablaAct.append(tbodyAct);
  scroll.append(tablaAct);

  // Sección de hitos
  const seccionHitos = document.createElement('div');
  seccionHitos.className = 'po-tabla-hitos-wrap';
  const tituloHitos = document.createElement('h3');
  tituloHitos.textContent = 'Hitos';
  seccionHitos.append(tituloHitos);
  const tablaHitos = document.createElement('table');
  tablaHitos.className = 'po-tabla-hitos';
  const theadHitos = document.createElement('thead');
  const filaEncHitos = document.createElement('tr');
  ['Nombre', 'Inicio', 'Fin', 'Responsable', 'Tipo'].forEach(txt => {
    const th = document.createElement('th');
    th.textContent = txt;
    filaEncHitos.append(th);
  });
  theadHitos.append(filaEncHitos);
  tablaHitos.append(theadHitos);
  const tbodyHitos = document.createElement('tbody');
  tablaHitos.append(tbodyHitos);
  seccionHitos.append(tablaHitos);
  scroll.append(seccionHitos);

  root.append(scroll);
  contenedor.append(root);

  // Utilidades internas
  const dias = nodo => (nodo.inicio && nodo.fin) ? M.diasEntre(nodo.inicio, nodo.fin) : null;

  function filtrarActividades() {
    let lista = modeloActual.lista;
    if (estado.soloHojas) lista = lista.filter(n => n.esHoja);
    return ordenarActividades(lista);
  }

  function ordenarActividades(lista) {
    if (estado.orden === 'edt') return [...lista];
    const col = estado.orden;
    const conValor = lista.filter(n => {
      if (col === 'dias') return dias(n) !== null;
      return n[col] !== null && n[col] !== undefined && n[col] !== '';
    });
    const sinValor = lista.filter(n => !conValor.includes(n));
    conValor.sort((a, b) => comparar(a, b, col) * estado.direccion);
    return [...conValor, ...sinValor];
  }

  function comparar(a, b, col) {
    switch (col) {
      case 'codigo': return String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true });
      case 'nombre': return a.nombre.localeCompare(b.nombre, 'es');
      case 'responsable': return (a.responsable || '').localeCompare(b.responsable || '', 'es');
      case 'inicio': return a.inicio.localeCompare(b.inicio);
      case 'fin': return a.fin.localeCompare(b.fin);
      case 'dias': return dias(a) - dias(b);
      case 'estado': return (a.estado || '').localeCompare(b.estado || '', 'es');
      case 'avance': return a.avance - b.avance;
      default: return 0;
    }
  }

  function filtrarHitos() {
    return [...(modeloActual.hitos || [])];
  }

  function crearFilaActividad(nodo) {
    const tr = document.createElement('tr');
    tr.className = 'po-tabla-fila';
    tr.dataset.id = nodo.id;
    tr.tabIndex = 0;

    const tdCodigo = document.createElement('td');
    tdCodigo.className = 'po-tabla-codigo';
    tdCodigo.textContent = nodo.codigo;

    const tdActividad = document.createElement('td');
    tdActividad.className = 'po-tabla-actividad';
    if (estado.orden === 'edt') {
      tdActividad.style.paddingLeft = `${nodo.nivel * 14 + 8}px`;
    }
    if (!nodo.esHoja) tdActividad.classList.add('po-tabla-padre');
    if (M.esEntregable(nodo)) {
      const badge = document.createElement('span');
      badge.className = 'po-tabla-badge-entregable';
      badge.textContent = '📦 ';
      badge.title = 'Entregable';
      tdActividad.append(badge, document.createTextNode(nodo.nombre));
    } else {
      tdActividad.textContent = nodo.nombre;
    }

    const tdResp = document.createElement('td');
    tdResp.textContent = nodo.responsable || '';

    const tdInicio = document.createElement('td');
    tdInicio.textContent = nodo.inicio || '';

    const tdFin = document.createElement('td');
    tdFin.textContent = nodo.fin || '';

    const tdDias = document.createElement('td');
    tdDias.textContent = dias(nodo) ?? '—';

    const tdEstado = document.createElement('td');
    const spanEstado = document.createElement('span');
    spanEstado.className = `po-tabla-estado-${(nodo.estado || 'pendiente').replace(/\s+/g, '-')}`;
    spanEstado.textContent = nodo.estado || 'pendiente';
    tdEstado.append(spanEstado);

    const tdAvance = document.createElement('td');
    tdAvance.textContent = `${Math.round(nodo.avance * 100)}%`;

    tr.append(tdCodigo, tdActividad, tdResp, tdInicio, tdFin, tdDias, tdEstado, tdAvance);
    return tr;
  }

  function crearFilaHito(hito) {
    const tr = document.createElement('tr');
    tr.className = 'po-tabla-hito-fila';
    tr.dataset.id = hito.id;
    tr.tabIndex = 0;

    const tdNombre = document.createElement('td');
    tdNombre.textContent = hito.nombre;
    const tdInicio = document.createElement('td');
    tdInicio.textContent = hito.inicio;
    const tdFin = document.createElement('td');
    tdFin.textContent = hito.fin;
    const tdResp = document.createElement('td');
    tdResp.textContent = hito.responsable || '';
    const tdTipo = document.createElement('td');
    tdTipo.textContent = hito.inicio === hito.fin ? 'Hito' : 'Periodo';

    tr.append(tdNombre, tdInicio, tdFin, tdResp, tdTipo);
    return tr;
  }

  function actualizarSeleccionYScroll() {
    const filas = contenedor.querySelectorAll('.po-tabla-fila, .po-tabla-hito-fila');
    let encontrada = false;
    for (const fila of filas) {
      fila.classList.remove('po-tabla-seleccionada');
      if (!encontrada && fila.dataset.id === String(estado.seleccion)) {
        fila.classList.add('po-tabla-seleccionada');
        fila.scrollIntoView({ block: 'nearest' });
        encontrada = true;
      }
    }
  }

  function actualizarCabeceras() {
    const ths = contenedor.querySelectorAll('th[data-columna]');
    ths.forEach(th => {
      th.classList.remove('po-tabla-orden-asc', 'po-tabla-orden-desc');
      if (th.dataset.columna === estado.orden && estado.orden !== 'edt') {
        th.classList.add(estado.direccion === 1 ? 'po-tabla-orden-asc' : 'po-tabla-orden-desc');
      }
    });
  }

  function renderTablas() {
    if (!modeloActual) return;
    const act = filtrarActividades();
    const hitos = filtrarHitos();

    tbodyAct.replaceChildren(...act.map(crearFilaActividad));
    tbodyHitos.replaceChildren(...hitos.map(crearFilaHito));
    seccionHitos.hidden = hitos.length === 0;

    actualizarCabeceras();
    actualizarSeleccionYScroll();
  }

  // Eventos con delegación
  contenedor.addEventListener('click', ev => {
    const fila = ev.target.closest('.po-tabla-fila, .po-tabla-hito-fila');
    if (fila?.dataset.id) {
      alSeleccionar(fila.dataset.id);
      return;
    }

    const btn = ev.target.closest('[data-accion]');
    if (btn) {
      switch (btn.dataset.accion) {
        case 'orden-edt':
          estado.orden = 'edt';
          estado.direccion = 1;
          renderTablas();
          break;
        case 'exportar':
          exportarCSV();
          break;
        case 'copiar':
          copiarDocs();
          break;
      }
      return;
    }

    const th = ev.target.closest('th[data-columna]');
    if (th) {
      const col = th.dataset.columna;
      if (estado.orden === col) {
        estado.direccion *= -1;
      } else {
        estado.orden = col;
        estado.direccion = 1;
      }
      renderTablas();
    }
  }, { signal });

  contenedor.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter') return;
    const fila = ev.target.closest('.po-tabla-fila, .po-tabla-hito-fila');
    if (fila?.dataset.id) alSeleccionar(fila.dataset.id);
  }, { signal });

  checkboxSoloHojas.addEventListener('change', () => {
    estado.soloHojas = checkboxSoloHojas.checked;
    renderTablas();
  }, { signal });

  // Exportar CSV
  function exportarCSV() {
    const act = filtrarActividades();
    const hitos = filtrarHitos();
    const esc = s => /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const lineas = [['codigo', 'actividad', 'responsable', 'inicio', 'fin', 'dias', 'estado', 'avance'].join(',')];

    act.forEach(n => {
      lineas.push([
        esc(n.codigo),
        esc(n.nombre),
        esc(n.responsable || ''),
        n.inicio || '',
        n.fin || '',
        dias(n) ?? '—',
        esc(n.estado || 'pendiente'),
        `${Math.round(n.avance * 100)}%`,
      ].join(','));
    });

    hitos.forEach(h => {
      lineas.push([
        '',
        esc(h.nombre),
        esc(h.responsable || ''),
        h.inicio,
        h.fin,
        M.diasEntre(h.inicio, h.fin),
        'hito',
        '',
      ].join(','));
    });

    const csv = '\uFEFF' + lineas.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const nombreArchivo = modeloActual.proyecto.nombre.replace(/[^\w\dáéíóúüñÁÉÍÓÚÜÑ _-]/g, '_') || 'proyecto';
    a.download = `${nombreArchivo}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Copiar para Docs (ClipboardItem + fallback)
  async function copiarDocs() {
    const act = filtrarActividades();
    const hitos = filtrarHitos();
    const html = generarHTML(act, hitos);
    const texto = generarTexto(act, hitos);

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([texto], { type: 'text/plain' }),
        }),
      ]);
    } catch {
      const div = document.createElement('div');
      div.innerHTML = html;
      div.contentEditable = 'true';
      div.style.position = 'fixed';
      div.style.left = '-9999px';
      document.body.append(div);
      const range = document.createRange();
      range.selectNodeContents(div);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('copy');
      sel.removeAllRanges();
      div.remove();
    }
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function generarHTML(act, hitos) {
    const base = 'font-family:Arial,sans-serif;font-size:10pt;color:#15202B;';
    const td = (extra = '') => `style="${base}border:1px solid #D3D9DF;padding:5pt 7pt;vertical-align:middle;${extra}"`;
    const th = `style="${base}color:#FFFFFF;background-color:#1B2A4A;font-weight:bold;border:1px solid #1B2A4A;padding:6pt 7pt;text-align:left;"`;
    let html = `<table style="border-collapse:collapse;width:100%;"><thead><tr>`
      + ['Código', 'Actividad', 'Responsable', 'Inicio', 'Fin', 'Días', 'Estado', 'Avance'].map(h => `<th ${th}>${h}</th>`).join('')
      + `</tr></thead><tbody>`;

    act.forEach((n, i) => {
      const bg = i % 2 ? 'background-color:#F5F7F9;' : 'background-color:#FFFFFF;';
      const bold = !n.esHoja ? 'font-weight:bold;' : '';
      html += `<tr><td ${td(bg + 'white-space:nowrap;')}>${escHtml(n.codigo)}</td>`
        + `<td ${td(bg + bold)}>${escHtml(n.nombre)}</td>`
        + `<td ${td(bg)}>${escHtml(n.responsable || '')}</td>`
        + `<td ${td(bg + 'white-space:nowrap;')}>${n.inicio ? escHtml(n.inicio) : '—'}</td>`
        + `<td ${td(bg + 'white-space:nowrap;')}>${n.fin ? escHtml(n.fin) : '—'}</td>`
        + `<td ${td(bg + 'text-align:center;')}>${dias(n) ?? '—'}</td>`
        + `<td ${td(bg)}>${escHtml(n.estado || 'pendiente')}</td>`
        + `<td ${td(bg + 'text-align:center;')}>${Math.round(n.avance * 100)}%</td></tr>`;
    });
    html += '</tbody></table>';

    if (hitos.length) {
      html += `<p style="${base}font-weight:bold;margin:12pt 0 4pt;">Hitos</p>`;
      html += `<table style="border-collapse:collapse;width:100%;"><thead><tr>`
        + ['Nombre', 'Inicio', 'Fin', 'Responsable', 'Tipo'].map(h => `<th ${th}>${h}</th>`).join('')
        + `</tr></thead><tbody>`;
      hitos.forEach((h, i) => {
        const bg = i % 2 ? 'background-color:#F5F7F9;' : 'background-color:#FFFFFF;';
        html += `<tr><td ${td(bg)}>${escHtml(h.nombre)}</td>`
          + `<td ${td(bg + 'white-space:nowrap;')}>${escHtml(h.inicio)}</td>`
          + `<td ${td(bg + 'white-space:nowrap;')}>${escHtml(h.fin)}</td>`
          + `<td ${td(bg)}>${escHtml(h.responsable || '')}</td>`
          + `<td ${td(bg)}>${h.inicio === h.fin ? 'Hito' : 'Periodo'}</td></tr>`;
      });
      html += '</tbody></table>';
    }
    return html;
  }

  function generarTexto(act, hitos) {
    const lineas = [['Código', 'Actividad', 'Responsable', 'Inicio', 'Fin', 'Días', 'Estado', 'Avance'].join('\t')];
    act.forEach(n => {
      lineas.push([
        n.codigo,
        n.nombre,
        n.responsable || '',
        n.inicio || '',
        n.fin || '',
        dias(n) ?? '—',
        n.estado || 'pendiente',
        `${Math.round(n.avance * 100)}%`,
      ].join('\t'));
    });
    if (hitos.length) {
      lineas.push('');
      lineas.push(['Hitos'].join('\t'));
      lineas.push(['Nombre', 'Inicio', 'Fin', 'Responsable', 'Tipo'].join('\t'));
      hitos.forEach(h => {
        lineas.push([
          h.nombre,
          h.inicio,
          h.fin,
          h.responsable || '',
          h.inicio === h.fin ? 'Hito' : 'Periodo',
        ].join('\t'));
      });
    }
    return lineas.join('\n');
  }

  return {
    mostrar(modelo, seleccionId) {
      modeloActual = modelo;
      estado.seleccion = seleccionId;
      renderTablas();
    },
    destruir() {
      control.abort();
      contenedor.replaceChildren();
    },
  };
}
