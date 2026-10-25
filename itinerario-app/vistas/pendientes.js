// vistas/pendientes.js
// Vista Pendientes: lista jerárquica de tareas agrupadas por urgencia y ordenadas por holguraH ascendente.
// Recuerda el estado de subtareas plegadas en localStorage.

import { formatearEntrega, aFechaIso, aHoraIso } from '../comun/tiempo.js';
import { calcularUrgencia, obtenerHijas } from '../comun/modelo.js';

const CLAVE_STORAGE_PLEGADAS = 'itinerario_madres_plegadas';

export class VistaPendientes {
  /**
   * @param {HTMLElement} contenedorElemento
   * @param {{
   *   onSeleccionar: (tipo: string, id: string) => void,
   *   onNuevaTarea: (padreId?: string) => void,
   *   onCapturaRapida: (titulo: string, materiaId: string) => void,
   *   onMarcarHecha: (id: string, hecha: boolean) => void,
   *   onCambiarFiltroMateria: (materiaId: string | null) => void,
   *   onCambiarMostrarHechas: (mostrar: boolean) => void,
   *   onActualizarVista?: () => void
   * }} eventos
   */
  constructor(contenedorElemento, eventos) {
    this.contenedor = contenedorElemento;
    this.eventos = eventos;

    // Cargar estado de plegado persistente
    try {
      const guardadas = localStorage.getItem(CLAVE_STORAGE_PLEGADAS);
      this.madresPlegadas = new Set(guardadas ? JSON.parse(guardadas) : []);
    } catch (_) {
      this.madresPlegadas = new Set();
    }
  }

  guardarPlegadas() {
    try {
      localStorage.setItem(CLAVE_STORAGE_PLEGADAS, JSON.stringify([...this.madresPlegadas]));
    } catch (_) {}
  }

  renderizar(datos, filtroMateria = null, mostrarHechas = false, avisosNoAlcanza = {}) {
    this.avisosNoAlcanza = avisosNoAlcanza || {};
    const ahoraIso = `${aFechaIso()}T${aHoraIso()}`;
    const materiasMap = new Map(datos.materias.map((m) => [m.id, m]));

    // Calcular urgencia para todas las tareas
    const tareasConUrgencia = datos.tareas.map((t) => {
      const urg = calcularUrgencia(t, ahoraIso, datos.tareas);
      const hijas = obtenerHijas(datos.tareas, t.id);
      return {
        ...t,
        urg,
        hijas,
        materiaInfo: materiasMap.get(t.materia)
      };
    });

    const mapaTareasConUrgencia = new Map(tareasConUrgencia.map((t) => [t.id, t]));

    // Filtrar tareas según materia y si se muestran hechas
    let tareasFiltradas = tareasConUrgencia.filter((t) => {
      if (filtroMateria && t.materia !== filtroMateria) return false;
      if (!mostrarHechas && t.estado === 'hecha') return false;
      return true;
    });

    // Identificar raíces (sin padre o cuyo padre no está en la lista de tareas)
    const todasIds = new Set(datos.tareas.map((t) => t.id));
    const tareasRaiz = tareasFiltradas.filter((t) => !t.padre || !todasIds.has(t.padre));

    // Definición de grupos de urgencia
    const GRUPOS = [
      { clave: 'vencida', titulo: 'Vencidas', colorBadge: 'rojo-intenso' },
      { clave: 'urgente', titulo: 'Urgentes (< 24 h de holgura)', colorBadge: 'rojo' },
      { clave: 'pronto', titulo: 'Pronto (< 72 h de holgura)', colorBadge: 'ambar' },
      { clave: 'con-tiempo', titulo: 'Con tiempo', colorBadge: 'gris' },
      { clave: 'hecha', titulo: 'Completadas', colorBadge: 'verde' }
    ];

    // Clasificar tareas raíz en grupos
    const gruposMapeados = GRUPOS.map((g) => {
      const tareasDelGrupo = tareasRaiz
        .filter((t) => t.urg.nivel === g.clave)
        .sort((a, b) => a.urg.holguraH - b.urg.holguraH);
      return { ...g, tareas: tareasDelGrupo };
    }).filter((g) => g.tareas.length > 0);

    this.contenedor.innerHTML = `
      <div class="vista-pendientes-contenedor">
        <!-- Barra superior de filtros y captura rápida -->
        <header class="pendientes-cabecera">
          <div class="pendientes-filtros">
            <div class="filtro-materia-selector">
              <label for="select-filtro-materia">Materia:</label>
              <select id="select-filtro-materia" class="select-filtro">
                <option value="">Todas las materias</option>
                ${datos.materias.map((m) => `
                  <option value="${m.id}" ${m.id === filtroMateria ? 'selected' : ''}>${m.nombre}</option>
                `).join('')}
              </select>
            </div>

            <label class="check-mostrar-hechas">
              <input type="checkbox" id="check-hechas" ${mostrarHechas ? 'checked' : ''} />
              <span>Mostrar completadas</span>
            </label>

            <button class="btn btn-primario btn-nueva-tarea">+ Tarea</button>
          </div>

          <!-- Captura rápida -->
          <form class="form-captura-rapida" id="form-captura-rapida">
            <input
              type="text"
              id="input-captura-rapida"
              class="input-captura"
              placeholder="+ Captura rápida: escribe el título de una tarea y presiona Enter..."
              autocomplete="off"
            />
          </form>
        </header>

        <!-- Contenido: Lista agrupada de tareas -->
        <main class="pendientes-lista-grupos">
          ${gruposMapeados.length === 0 ? `
            <div class="estado-vacio">
              <p class="texto-suave">No hay tareas pendientes en este filtro.</p>
            </div>
          ` : gruposMapeados.map((g) => `
            <section class="grupo-urgencia grupo-${g.clave}">
              <div class="grupo-cabecera">
                <span class="grupo-titulo">${g.titulo}</span>
                <span class="grupo-conteo">${g.tareas.length}</span>
              </div>
              <div class="grupo-items">
                ${g.tareas.map((t) => this.renderizarFilaTarea(t, mapaTareasConUrgencia, 0)).join('')}
              </div>
            </section>
          `).join('')}
        </main>
      </div>
    `;

    this.conectarEventos(filtroMateria);
  }

  renderizarFilaTarea(tarea, mapaTareas, nivelIndentacion) {
    const hijas = tarea.hijas || [];
    const tieneHijas = hijas.length > 0;
    const plegada = this.madresPlegadas.has(tarea.id);
    const esHecha = tarea.estado === 'hecha';

    const colorMateria = tarea.materiaInfo?.color || '#6b6a66';
    const nombreMateria = tarea.materiaInfo?.nombre || '';

    let hijasHtml = '';
    if (tieneHijas && !plegada) {
      hijasHtml = `
        <div class="subtareas-lista">
          ${hijas.map((hija) => {
            const hijaCalculada = mapaTareas.get(hija.id) || hija;
            return this.renderizarFilaTarea(hijaCalculada, mapaTareas, nivelIndentacion + 1);
          }).join('')}
        </div>
      `;
    }

    const indentacionPx = nivelIndentacion * 24;

    return `
      <div class="tarea-item-arbol" style="margin-left: ${indentacionPx}px;">
        <div class="tarea-fila ${esHecha ? 'hecha' : ''}" data-id="${tarea.id}">
          <button
            type="button"
            class="btn-check-tarea ${esHecha ? 'activo' : ''}"
            data-id="${tarea.id}"
            title="${esHecha ? 'Marcar pendiente' : 'Marcar hecha'}"
          >
            ✓
          </button>

          ${tieneHijas ? `
            <button
              type="button"
              class="btn-plegar-subtareas ${plegada ? 'plegada' : ''}"
              data-id="${tarea.id}"
              title="${plegada ? 'Expandir subtareas' : 'Plegar subtareas'}"
            >
              ▾
            </button>
          ` : `
            <span class="espaciador-plegar"></span>
          `}

          <div class="tarea-cuerpo" data-id="${tarea.id}">
            <div class="tarea-linea-superior">
              <span class="punto-materia" style="background-color: ${colorMateria};" title="${nombreMateria}"></span>
              <span class="tarea-materia-nombre">${this.escapar(nombreMateria)}</span>
              <span class="tarea-titulo ${esHecha ? 'tachado' : ''}">${this.escapar(tarea.titulo)}</span>
              <span class="etiqueta-urgencia nivel-${tarea.urg.nivel}">${tarea.urg.textoUrgencia}</span>
              ${this.avisosNoAlcanza?.[tarea.id] ? `
                <span class="etiqueta-no-alcanza">⚠️ ${this.escapar(this.avisosNoAlcanza[tarea.id].texto)}</span>
              ` : ''}
            </div>

            <div class="tarea-linea-inferior">
              ${tarea.entrega ? `
                <span class="tarea-entrega">📅 ${formatearEntrega(tarea.entrega)}</span>
              ` : `
                <span class="tarea-entrega texto-suave">Sin entrega</span>
              `}

              ${tarea.urg.duracionMin ? `
                <span class="tarea-duracion">⏱ ${Math.round(tarea.urg.duracionMin / 60 * 10) / 10} h</span>
              ` : ''}

              <!-- Barra de avance -->
              <div class="barra-avance-contenedor" title="Avance: ${tarea.urg.avance}%">
                <div class="barra-avance-progreso" style="width: ${tarea.urg.avance}%;"></div>
              </div>
              <span class="tarea-avance-texto">${tarea.urg.avance}%</span>
            </div>
          </div>
        </div>

        ${hijasHtml}
      </div>
    `;
  }

  conectarEventos(filtroMateriaActual) {
    // Cambio en filtro materia
    const selectMateria = this.contenedor.querySelector('#select-filtro-materia');
    selectMateria?.addEventListener('change', (e) => {
      this.eventos.onCambiarFiltroMateria(e.target.value || null);
    });

    // Checkbox mostrar hechas
    const checkHechas = this.contenedor.querySelector('#check-hechas');
    checkHechas?.addEventListener('change', (e) => {
      this.eventos.onCambiarMostrarHechas(e.target.checked);
    });

    // Botón nueva tarea
    this.contenedor.querySelector('.btn-nueva-tarea')?.addEventListener('click', () => {
      this.eventos.onNuevaTarea();
    });

    // Captura rápida
    const formCaptura = this.contenedor.querySelector('#form-captura-rapida');
    const inputCaptura = this.contenedor.querySelector('#input-captura-rapida');
    formCaptura?.addEventListener('submit', (e) => {
      e.preventDefault();
      const titulo = inputCaptura?.value.trim();
      if (titulo) {
        this.eventos.onCapturaRapida(titulo, filtroMateriaActual || '');
        if (inputCaptura) inputCaptura.value = '';
      }
    });

    // Marcar hecha / desmarcar
    this.contenedor.querySelectorAll('.btn-check-tarea').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const estabaActivo = btn.classList.contains('activo');
        if (id) this.eventos.onMarcarHecha(id, !estabaActivo);
      });
    });

    // Plegar / desplegar subtareas con persistencia en localStorage
    this.contenedor.querySelectorAll('.btn-plegar-subtareas').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (!id) return;
        if (this.madresPlegadas.has(id)) {
          this.madresPlegadas.delete(id);
        } else {
          this.madresPlegadas.add(id);
        }
        this.guardarPlegadas();
        this.eventos.onActualizarVista?.();
      });
    });

    // Abrir tarea en editor
    this.contenedor.querySelectorAll('.tarea-cuerpo').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        if (id) this.eventos.onSeleccionar('tarea', id);
      });
    });
  }

  escapar(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
