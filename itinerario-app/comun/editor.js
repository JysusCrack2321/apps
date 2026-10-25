// comun/editor.js
// Panel lateral / hoja inferior para ver y editar tareas, bloques y fijos.
// No modifica datos directamente: emite eventos a app.js.

import { calcularMetricasTarea } from './modelo.js';

export class Editor {
  /**
   * @param {HTMLElement} contenedorElemento
   * @param {{
   *   onActualizar: (tipo: string, id: string, cambios: object) => void,
   *   onEliminar: (tipo: string, id: string) => void,
   *   onDuplicar: (tipo: string, id: string) => void,
   *   onCerrar: () => void
   * }} eventos
   */
  constructor(contenedorElemento, eventos) {
    this.contenedor = contenedorElemento;
    this.eventos = eventos;
    this.seleccionActual = null; // { tipo: 'tarea'|'bloque'|'fijo', id: string, esNuevo?: boolean, datosIniciales?: object }
    this.confirmandoEliminar = false;
  }

  /**
   * Abre el editor con un elemento seleccionado.
   * @param {{ tipo: string, id: string, esNuevo?: boolean, datosIniciales?: object } | null} seleccion
   * @param {object} datosGlobales
   */
  abrir(seleccion, datosGlobales) {
    this.seleccionActual = seleccion;
    this.confirmandoEliminar = false;
    this.renderizar(datosGlobales);
  }

  cerrar() {
    this.seleccionActual = null;
    this.confirmandoEliminar = false;
    this.contenedor.innerHTML = '';
    this.contenedor.classList.remove('abierto');
    if (this.eventos.onCerrar) {
      this.eventos.onCerrar();
    }
  }

  renderizar(datosGlobales) {
    if (!this.seleccionActual) {
      this.contenedor.innerHTML = '';
      this.contenedor.classList.remove('abierto');
      return;
    }

    this.contenedor.classList.add('abierto');
    const { tipo, id, esNuevo, datosIniciales } = this.seleccionActual;

    let item = null;
    if (esNuevo) {
      item = datosIniciales || {};
    } else if (tipo === 'tarea') {
      item = datosGlobales.tareas.find((t) => t.id === id);
    } else if (tipo === 'bloque') {
      item = datosGlobales.bloques.find((b) => b.id === id);
    } else if (tipo === 'fijo') {
      item = datosGlobales.fijos.find((f) => f.id === id);
    } else if (tipo === 'config') {
      item = datosGlobales.config || {};
    }

    if (!item && !esNuevo) {
      this.contenedor.innerHTML = `
        <div class="editor-cabecera">
          <h3>Elemento no encontrado</h3>
          <button class="btn-icono btn-cerrar-editor" title="Cerrar">✕</button>
        </div>
        <p class="texto-suave">Este elemento pudo haber sido eliminado.</p>
      `;
      this.contenedor.querySelector('.btn-cerrar-editor')?.addEventListener('click', () => this.cerrar());
      return;
    }

    const tituloTipo = tipo === 'tarea' ? (esNuevo ? 'Nueva tarea' : 'Editar tarea')
      : tipo === 'bloque' ? (esNuevo ? 'Nuevo bloque' : 'Editar bloque')
      : tipo === 'fijo' ? (esNuevo ? 'Nueva clase / fijo' : 'Editar clase / fijo')
      : 'Ajustes (Configuración)';

    let cuerpoFormularioHtml = '';
    if (tipo === 'tarea') {
      cuerpoFormularioHtml = this.generarHtmlTarea(item, datosGlobales);
    } else if (tipo === 'bloque') {
      cuerpoFormularioHtml = this.generarHtmlBloque(item, datosGlobales);
    } else if (tipo === 'fijo') {
      cuerpoFormularioHtml = this.generarHtmlFijo(item, datosGlobales);
    } else if (tipo === 'config') {
      cuerpoFormularioHtml = this.generarHtmlConfig(item);
    }

    const esConfig = tipo === 'config';

    this.contenedor.innerHTML = `
      <div class="editor-contenido">
        <div class="editor-cabecera">
          <h3>${tituloTipo}</h3>
          <button class="btn-icono btn-cerrar-editor" title="Cerrar (Esc)">✕</button>
        </div>

        <form class="editor-formulario" id="form-editor">
          ${cuerpoFormularioHtml}

          <div class="editor-acciones">
            <button type="submit" class="btn btn-primario">
              ${esConfig ? 'Guardar ajustes' : (esNuevo ? 'Crear' : 'Guardar cambios')}
            </button>

            ${!esNuevo && !esConfig ? `
              <button type="button" class="btn btn-secundario btn-duplicar">
                Duplicar
              </button>
            ` : ''}

            ${!esNuevo && !esConfig ? `
              <div class="zona-eliminar">
                ${!this.confirmandoEliminar ? `
                  <button type="button" class="btn btn-peligro btn-iniciar-eliminar">
                    Eliminar
                  </button>
                ` : `
                  <div class="aviso-confirmar-eliminar">
                    <span>¿Seguro de eliminar?</span>
                    <button type="button" class="btn btn-peligro btn-confirmar-eliminar">Sí, eliminar</button>
                    <button type="button" class="btn btn-secundario btn-cancelar-eliminar">Cancelar</button>
                  </div>
                `}
              </div>
            ` : ''}
          </div>
        </form>
      </div>
    `;

    this.conectarEventos(tipo, id, esNuevo, item, datosGlobales);
  }

  generarHtmlTarea(tarea, datosGlobales) {
    const metricas = tarea?.id ? calcularMetricasTarea(tarea, datosGlobales.tareas) : { tieneHijas: false, duracionMin: 60, avance: 0 };
    const duracion = metricas.tieneHijas ? metricas.duracionMin : (tarea?.duracionMin ?? 60);
    const avance = metricas.tieneHijas ? metricas.avance : (tarea?.avance ?? 0);

    // Opciones de materias
    const opcionesMaterias = datosGlobales.materias.map((m) => {
      const selected = m.id === tarea?.materia ? 'selected' : '';
      return `<option value="${m.id}" ${selected}>${m.nombre}</option>`;
    }).join('');

    // Opciones de tareas madre posibles (excluyendo la tarea actual y sus hijas directas)
    const opcionesPadre = datosGlobales.tareas
      .filter((t) => t.id !== tarea?.id && t.padre !== tarea?.id)
      .map((t) => {
        const selected = t.id === tarea?.padre ? 'selected' : '';
        return `<option value="${t.id}" ${selected}>${t.titulo}</option>`;
      }).join('');

    return `
      <div class="campo-grupo">
        <label for="campo-titulo">Título *</label>
        <input type="text" id="campo-titulo" name="titulo" required value="${this.escaparHtml(tarea?.titulo || '')}" placeholder="Ej. Estudiar parcial..." />
      </div>

      <div class="campo-fila">
        <div class="campo-grupo">
          <label for="campo-materia">Materia</label>
          <select id="campo-materia" name="materia">
            ${opcionesMaterias}
          </select>
        </div>

        <div class="campo-grupo">
          <label for="campo-estado">Estado</label>
          <select id="campo-estado" name="estado">
            <option value="pendiente" ${tarea?.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
            <option value="en curso" ${tarea?.estado === 'en curso' ? 'selected' : ''}>En curso</option>
            <option value="hecha" ${tarea?.estado === 'hecha' ? 'selected' : ''}>Hecha</option>
          </select>
        </div>
      </div>

      <div class="campo-grupo">
        <label for="campo-entrega">Fecha y hora de entrega</label>
        <input type="datetime-local" id="campo-entrega" name="entrega" value="${tarea?.entrega || ''}" />
      </div>

      <div class="campo-fila">
        <div class="campo-grupo">
          <label for="campo-duracion">
            Duración (minutos)
            ${metricas.tieneHijas ? '<span class="etiqueta-info">(suma de subtareas)</span>' : ''}
          </label>
          <input
            type="number"
            id="campo-duracion"
            name="duracionMin"
            min="5"
            step="5"
            value="${duracion}"
            ${metricas.tieneHijas ? 'disabled class="deshabilitado"' : ''}
          />
        </div>

        <div class="campo-grupo">
          <label for="campo-avance">
            Avance: <span id="valor-avance">${avance}%</span>
            ${metricas.tieneHijas ? '<span class="etiqueta-info">(calculado)</span>' : ''}
          </label>
          <input
            type="range"
            id="campo-avance"
            name="avance"
            min="0"
            max="100"
            step="5"
            value="${avance}"
            ${metricas.tieneHijas ? 'disabled class="deshabilitado"' : ''}
          />
        </div>
      </div>

      <div class="campo-grupo">
        <label for="campo-padre">Tarea madre (opcional para subtareas)</label>
        <select id="campo-padre" name="padre">
          <option value="">Ninguna (tarea principal)</option>
          ${opcionesPadre}
        </select>
      </div>

      <div class="campo-grupo">
        <label for="campo-notas">Notas</label>
        <textarea id="campo-notas" name="notas" rows="3" placeholder="Detalles, enlaces o requerimientos...">${this.escaparHtml(tarea?.notas || '')}</textarea>
      </div>
    `;
  }

  generarHtmlBloque(bloque, datosGlobales) {
    const opcionesTareas = datosGlobales.tareas.map((t) => {
      const selected = t.id === bloque?.tarea ? 'selected' : '';
      return `<option value="${t.id}" ${selected}>${t.titulo}</option>`;
    }).join('');

    const esLibre = !bloque?.tarea;

    return `
      <div class="campo-grupo">
        <label for="campo-bloque-tarea">Tarea asociada</label>
        <select id="campo-bloque-tarea" name="tarea">
          <option value="">Bloque libre (sin tarea)</option>
          ${opcionesTareas}
        </select>
      </div>

      <div class="campo-grupo" id="grupo-bloque-titulo" style="${esLibre ? '' : 'display: none;'}">
        <label for="campo-bloque-titulo">Título del bloque libre</label>
        <input type="text" id="campo-bloque-titulo" name="titulo" value="${this.escaparHtml(bloque?.titulo || '')}" placeholder="Ej. Almuerzo, Descanso..." />
      </div>

      <div class="campo-grupo">
        <label for="campo-bloque-fecha">Fecha</label>
        <input type="date" id="campo-bloque-fecha" name="fecha" required value="${bloque?.fecha || ''}" />
      </div>

      <div class="campo-fila">
        <div class="campo-grupo">
          <label for="campo-bloque-inicio">Inicio</label>
          <input type="time" id="campo-bloque-inicio" name="inicio" required value="${bloque?.inicio || '08:00'}" />
        </div>

        <div class="campo-grupo">
          <label for="campo-bloque-fin">Fin</label>
          <input type="time" id="campo-bloque-fin" name="fin" required value="${bloque?.fin || '09:00'}" />
        </div>
      </div>

      <div class="campo-check">
        <label>
          <input type="checkbox" id="campo-bloque-hecho" name="hecho" ${bloque?.hecho ? 'checked' : ''} />
          <span>Marcar bloque como completado</span>
        </label>
      </div>
    `;
  }

  generarHtmlFijo(fijo, datosGlobales) {
    const opcionSinMateria = `<option value="" ${!fijo?.materia ? 'selected' : ''}>Sin materia (General)</option>`;
    const opcionesMaterias = datosGlobales.materias.map((m) => {
      const selected = m.id === fijo?.materia ? 'selected' : '';
      return `<option value="${m.id}" ${selected}>${m.nombre}</option>`;
    }).join('');

    const diasSeleccionados = new Set(fijo?.dias || [1]);
    const nombresDias = [
      { id: 1, nom: 'L' },
      { id: 2, nom: 'M' },
      { id: 3, nom: 'X' },
      { id: 4, nom: 'J' },
      { id: 5, nom: 'V' },
      { id: 6, nom: 'S' },
      { id: 7, nom: 'D' }
    ];

    const checksDiasHtml = nombresDias.map((d) => `
      <label class="etiqueta-dia-check">
        <input type="checkbox" name="dia_${d.id}" value="${d.id}" ${diasSeleccionados.has(d.id) ? 'checked' : ''} />
        <span>${d.nom}</span>
      </label>
    `).join('');

    return `
      <div class="campo-grupo">
        <label for="campo-fijo-titulo">Título de la clase o evento fijo *</label>
        <input type="text" id="campo-fijo-titulo" name="titulo" required value="${this.escaparHtml(fijo?.titulo || '')}" placeholder="Ej. Comida, Técnicas de control..." />
      </div>

      <div class="campo-grupo">
        <label for="campo-fijo-materia">Materia (opcional)</label>
        <select id="campo-fijo-materia" name="materia">
          ${opcionSinMateria}
          ${opcionesMaterias}
        </select>
      </div>

      <div class="campo-grupo">
        <label>Días de la semana</label>
        <div class="dias-checkboxes">
          ${checksDiasHtml}
        </div>
      </div>

      <div class="campo-fila">
        <div class="campo-grupo">
          <label for="campo-fijo-inicio">Inicio</label>
          <input type="time" id="campo-fijo-inicio" name="inicio" required value="${fijo?.inicio || '07:00'}" />
        </div>

        <div class="campo-grupo">
          <label for="campo-fijo-fin">Fin</label>
          <input type="time" id="campo-fijo-fin" name="fin" required value="${fijo?.fin || '09:00'}" />
        </div>
      </div>

      <div class="campo-grupo">
        <label for="campo-fijo-lugar">Lugar / Salón</label>
        <input type="text" id="campo-fijo-lugar" name="lugar" value="${this.escaparHtml(fijo?.lugar || '')}" placeholder="Ej. Edificio 401 Salón 202, Virtual..." />
      </div>

      <div class="campo-fila">
        <div class="campo-grupo">
          <label for="campo-fijo-desde">Válido desde</label>
          <input type="date" id="campo-fijo-desde" name="desde" value="${fijo?.desde || ''}" />
        </div>

        <div class="campo-grupo">
          <label for="campo-fijo-hasta">Válido hasta</label>
          <input type="date" id="campo-fijo-hasta" name="hasta" value="${fijo?.hasta || ''}" />
        </div>
      </div>
    `;
  }

  generarHtmlConfig(config) {
    return `
      <div class="campo-fila">
        <div class="campo-grupo">
          <label for="campo-config-iniciodia">Inicio del día</label>
          <input type="time" id="campo-config-iniciodia" name="inicioDia" required value="${config?.inicioDia || '06:00'}" />
        </div>

        <div class="campo-grupo">
          <label for="campo-config-findia">Fin del día</label>
          <input type="time" id="campo-config-findia" name="finDia" required value="${config?.finDia || '24:00'}" />
        </div>
      </div>

      <div class="campo-fila">
        <div class="campo-grupo">
          <label for="campo-config-bloquemax">Duración máxima de bloque (min)</label>
          <input type="number" id="campo-config-bloquemax" name="bloqueMaxMin" min="15" max="360" step="5" required value="${config?.bloqueMaxMin ?? 90}" />
        </div>

        <div class="campo-grupo">
          <label for="campo-config-pausa">Pausa entre bloques (min)</label>
          <input type="number" id="campo-config-pausa" name="pausaMin" min="0" max="60" step="5" required value="${config?.pausaMin ?? 10}" />
        </div>
      </div>
    `;
  }

  conectarEventos(tipo, id, esNuevo, itemOriginal, datosGlobales) {
    const btnCerrar = this.contenedor.querySelector('.btn-cerrar-editor');
    btnCerrar?.addEventListener('click', () => this.cerrar());

    // Actualización visual del slider de avance
    const inputAvance = this.contenedor.querySelector('#campo-avance');
    const valorAvance = this.contenedor.querySelector('#valor-avance');
    inputAvance?.addEventListener('input', (e) => {
      if (valorAvance) valorAvance.textContent = `${e.target.value}%`;
    });

    // Mostrar/ocultar título libre en bloque
    const selectBloqueTarea = this.contenedor.querySelector('#campo-bloque-tarea');
    const grupoBloqueTitulo = this.contenedor.querySelector('#grupo-bloque-titulo');
    selectBloqueTarea?.addEventListener('change', (e) => {
      if (grupoBloqueTitulo) {
        grupoBloqueTitulo.style.display = e.target.value ? 'none' : 'block';
      }
    });

    // Envío del formulario
    const form = this.contenedor.querySelector('#form-editor');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const cambios = this.extraerDatosFormulario(tipo, formData, itemOriginal);
      this.eventos.onActualizar(tipo, id, cambios, esNuevo);
      this.cerrar();
    });

    // Duplicar
    const btnDuplicar = this.contenedor.querySelector('.btn-duplicar');
    btnDuplicar?.addEventListener('click', () => {
      this.eventos.onDuplicar(tipo, id);
    });

    // Iniciar eliminación
    const btnIniciarEliminar = this.contenedor.querySelector('.btn-iniciar-eliminar');
    btnIniciarEliminar?.addEventListener('click', () => {
      this.confirmandoEliminar = true;
      this.renderizar(datosGlobales);
    });

    // Cancelar eliminación
    const btnCancelarEliminar = this.contenedor.querySelector('.btn-cancelar-eliminar');
    btnCancelarEliminar?.addEventListener('click', () => {
      this.confirmandoEliminar = false;
      this.renderizar(datosGlobales);
    });

    // Confirmar eliminación
    const btnConfirmarEliminar = this.contenedor.querySelector('.btn-confirmar-eliminar');
    btnConfirmarEliminar?.addEventListener('click', () => {
      this.eventos.onEliminar(tipo, id);
      this.cerrar();
    });
  }

  extraerDatosFormulario(tipo, formData, itemOriginal) {
    if (tipo === 'tarea') {
      const cambios = {
        titulo: String(formData.get('titulo') || '').trim(),
        materia: String(formData.get('materia') || ''),
        padre: formData.get('padre') ? String(formData.get('padre')) : null,
        entrega: String(formData.get('entrega') || ''),
        estado: String(formData.get('estado') || 'pendiente'),
        notas: String(formData.get('notas') || '')
      };

      if (formData.has('duracionMin')) {
        cambios.duracionMin = Number(formData.get('duracionMin')) || 60;
      }
      if (formData.has('avance')) {
        cambios.avance = Number(formData.get('avance')) || 0;
      }
      return cambios;
    }

    if (tipo === 'bloque') {
      const tareaVal = formData.get('tarea') ? String(formData.get('tarea')) : null;
      return {
        fecha: String(formData.get('fecha') || ''),
        inicio: String(formData.get('inicio') || '08:00'),
        fin: String(formData.get('fin') || '09:00'),
        tarea: tareaVal,
        titulo: tareaVal ? '' : String(formData.get('titulo') || 'Bloque libre').trim(),
        hecho: formData.get('hecho') === 'on'
      };
    }

    if (tipo === 'fijo') {
      const dias = [];
      for (let i = 1; i <= 7; i++) {
        if (formData.get(`dia_${i}`)) {
          dias.push(i);
        }
      }
      const mat = formData.get('materia');
      return {
        titulo: String(formData.get('titulo') || '').trim(),
        materia: mat ? String(mat) : null,
        dias: dias.length ? dias : [1],
        inicio: String(formData.get('inicio') || '07:00'),
        fin: String(formData.get('fin') || '09:00'),
        lugar: String(formData.get('lugar') || '').trim(),
        desde: String(formData.get('desde') || ''),
        hasta: String(formData.get('hasta') || '')
      };
    }

    if (tipo === 'config') {
      return {
        inicioDia: String(formData.get('inicioDia') || '06:00'),
        finDia: String(formData.get('finDia') || '24:00'),
        bloqueMaxMin: Number(formData.get('bloqueMaxMin')) || 90,
        pausaMin: Number(formData.get('pausaMin')) || 10
      };
    }

    return {};
  }

  escaparHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
