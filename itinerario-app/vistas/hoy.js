// vistas/hoy.js
// Vista Hoy: línea de tiempo vertical por horas, eventos fijos, bloques y entregas de hoy y mañana.
// Soporta arrastrar bloques para cambiar su hora (pasos de 15 min) y redimensionar desde el borde inferior con pointer events.

import {
  horaAMinutos,
  minutosAHora,
  formatearFecha,
  formatearHora12,
  formatearEntrega,
  sumarDias,
  diaDeLaSemana,
  aFechaIso,
  aHoraIso
} from '../comun/tiempo.js';
import { calcularUrgencia, agruparEntregas } from '../comun/modelo.js';

export class VistaHoy {
  /**
   * @param {HTMLElement} contenedorElemento
   * @param {{
   *   onSeleccionar: (tipo: string, id: string) => void,
   *   onCambiarFecha: (fechaIso: string) => void,
   *   onMarcarBloqueHecho: (id: string, hecho: boolean) => void,
   *   onActualizarBloque: (id: string, cambios: object) => void,
   *   onAceptarBloquePropuesto?: (id: string) => void,
   *   onDescartarBloquePropuesto?: (id: string) => void,
   *   onNuevoBloque?: (fecha: string, inicio: string, fin: string) => void
   * }} eventos
   */
  constructor(contenedorElemento, eventos) {
    this.contenedor = contenedorElemento;
    this.eventos = eventos;
    this.intervaloReloj = null;
    this.estadoArrastre = null; // Información de arrastre o redimensionado activo
  }

  destruir() {
    if (this.intervaloReloj) {
      clearInterval(this.intervaloReloj);
      this.intervaloReloj = null;
    }
  }

  renderizar(datos, fechaSeleccionada, avisosNoAlcanza = {}) {
    this.destruir();
    const hoyIso = aFechaIso();
    const mananaIso = sumarDias(fechaSeleccionada, 1);
    const esHoy = fechaSeleccionada === hoyIso;
    const hayPropuestos = (datos.bloques || []).some((b) => b.propuesto);

    const materiasMap = new Map(datos.materias.map((m) => [m.id, m]));
    const tareasMap = new Map(datos.tareas.map((t) => [t.id, t]));

    const inicioDiaStr = datos.config?.inicioDia || '06:00';
    const finDiaStr = datos.config?.finDia || '24:00';
    const minInicioDia = horaAMinutos(inicioDiaStr);
    const minFinDia = finDiaStr === '24:00' ? 1440 : horaAMinutos(finDiaStr);
    const totalMinutos = Math.max(60, minFinDia - minInicioDia);

    // Filtrar fijos para el día
    const diaSem = diaDeLaSemana(fechaSeleccionada);
    const fijosDelDia = datos.fijos.filter((f) => {
      if (!f.dias.includes(diaSem)) return false;
      if (f.desde && fechaSeleccionada < f.desde) return false;
      if (f.hasta && fechaSeleccionada > f.hasta) return false;
      return true;
    });

    // Filtrar bloques del día
    const bloquesDelDia = datos.bloques.filter((b) => b.fecha === fechaSeleccionada);

    // Entregas de este día para el timeline
    const entregasDelDia = datos.tareas.filter((t) => {
      return t.entrega && t.entrega.startsWith(fechaSeleccionada);
    }).map((t) => {
      const horaStr = t.entrega.split('T')[1] || '23:59';
      const urg = calcularUrgencia(t, `${hoyIso}T${aHoraIso()}`, datos.tareas);
      const mat = materiasMap.get(t.materia);
      return { tarea: t, horaStr, urg, mat };
    });
    const gruposEntregasHoy = agruparEntregas(entregasDelDia, 15);

    // Entregas de hoy y mañana
    const entregasProximas = datos.tareas.filter((t) => {
      if (t.estado === 'hecha' || !t.entrega) return false;
      const fechaEntrega = t.entrega.split('T')[0];
      return fechaEntrega === fechaSeleccionada || fechaEntrega === mananaIso;
    }).map((t) => {
      const urg = calcularUrgencia(t, `${hoyIso}T${aHoraIso()}`, datos.tareas);
      const materia = materiasMap.get(t.materia);
      return { tarea: t, urg, materia };
    }).sort((a, b) => a.urg.holguraH - b.urg.holguraH);

    // Generar horas de la cuadrícula
    const filasHoras = [];
    const horaInicial = Math.floor(minInicioDia / 60);
    const horaFinal = Math.ceil(minFinDia / 60);
    for (let h = horaInicial; h < horaFinal; h++) {
      const horaStr = `${String(h).padStart(2, '0')}:00`;
      filasHoras.push(horaStr);
    }

    this.contenedor.innerHTML = `
      <div class="vista-hoy-contenedor">
        <header class="hoy-cabecera-navegacion">
          <div class="navegacion-fechas">
            <button class="btn btn-secundario btn-icono btn-dia-ant" title="Día anterior">‹</button>
            <button class="btn btn-secundario btn-ir-hoy ${esHoy ? 'activo' : ''}">Hoy</button>
            <button class="btn btn-secundario btn-icono btn-dia-sig" title="Día siguiente">›</button>
            <span class="etiqueta-fecha-actual">${formatearFecha(fechaSeleccionada)} ${esHoy ? '(Hoy)' : ''}</span>
          </div>

          <div class="acciones-vista-hoy">
            <button class="btn btn-primario btn-planificar" title="Planificar bloques para hoy y mañana">⚡ Planificar</button>
            ${hayPropuestos ? `
              <button class="btn btn-exito btn-sm btn-aceptar-todos-propuestos" title="Aceptar todos los bloques propuestos">Aceptar todos</button>
              <button class="btn btn-peligro btn-sm btn-descartar-todos-propuestos" title="Descartar todos los bloques propuestos">Descartar todos</button>
            ` : ''}
            <button class="btn btn-secundario btn-nuevo-bloque">+ Bloque</button>
            <button class="btn btn-secundario btn-nuevo-fijo">+ Fijo</button>
          </div>
        </header>

        <div class="hoy-cuerpo">
          <div class="hoy-columna-itinerario">
            <div class="timeline-contenedor" id="timeline-contenedor">
              <!-- Cuadrícula de horas de fondo -->
              <div class="timeline-horas-fondo">
                ${filasHoras.map((horaStr) => `
                  <div class="timeline-fila-hora" data-hora="${horaStr}">
                    <span class="timeline-etiqueta-hora">${formatearHora12(horaStr)}</span>
                    <div class="timeline-linea-guia"></div>
                  </div>
                `).join('')}
              </div>

              <!-- Lienzo de elementos posicionado absolutamente -->
              <div class="timeline-lienzo" id="timeline-lienzo">
                <!-- Indicador flotante de tiempo durante arrastre -->
                <div class="indicador-tiempo-arrastre" id="indicador-tiempo-arrastre" style="display: none;"></div>

                <!-- Línea de ahora -->
                ${esHoy ? '<div class="timeline-linea-ahora" id="linea-ahora"><span class="ahora-etiqueta">ahora</span></div>' : ''}

                <!-- Fijos (no se arrastran) -->
                ${fijosDelDia.map((f) => {
                  const inicioMin = Math.max(minInicioDia, horaAMinutos(f.inicio));
                  const finMin = Math.min(minFinDia, horaAMinutos(f.fin));
                  const durMin = Math.max(15, finMin - inicioMin);
                  const topPct = ((inicioMin - minInicioDia) / totalMinutos) * 100;
                  const heightPct = (durMin / totalMinutos) * 100;
                  const mat = f.materia ? materiasMap.get(f.materia) : null;
                  const color = mat?.color || '#8a8984';
                  const esPequeno = durMin <= 35;

                  return `
                    <div
                      class="elemento-fijo ${esPequeno ? 'bloque-compacto' : ''}"
                      data-id="${f.id}"
                      style="top: ${topPct}%; height: ${heightPct}%; border-left-color: ${color};"
                      title="${this.escapar(f.titulo)} (${f.inicio} - ${f.fin})"
                    >
                      <div class="fijo-contenido">
                        <span class="fijo-titulo">${this.escapar(f.titulo)}</span>
                        <span class="fijo-hora">${formatearHora12(f.inicio)} - ${formatearHora12(f.fin)}${f.lugar && !esPequeno ? ` · ${this.escapar(f.lugar)}` : ''}</span>
                      </div>
                    </div>
                  `;
                }).join('')}

                <!-- Bloques (arrastrables y redimensionables) -->
                ${bloquesDelDia.map((b) => {
                  const inicioMin = Math.max(minInicioDia, horaAMinutos(b.inicio));
                  const finMin = Math.min(minFinDia, horaAMinutos(b.fin));
                  const durMin = Math.max(15, finMin - inicioMin);
                  const topPct = ((inicioMin - minInicioDia) / totalMinutos) * 100;
                  const heightPct = (durMin / totalMinutos) * 100;

                  const tarea = b.tarea ? tareasMap.get(b.tarea) : null;
                  const mat = tarea ? materiasMap.get(tarea.materia) : null;
                  const color = mat?.color || '#4f46e5';
                  const titulo = tarea ? tarea.titulo : (b.titulo || 'Bloque libre');

                  // Ajuste de texto según el tamaño del bloque
                  const esMuyPequeno = durMin <= 25;
                  const esPequeno = durMin <= 40;

                  const clases = [
                    'elemento-bloque',
                    b.hecho ? 'hecho' : '',
                    b.propuesto ? 'propuesto' : '',
                    esMuyPequeno ? 'bloque-muy-compacto' : (esPequeno ? 'bloque-compacto' : '')
                  ].filter(Boolean).join(' ');

                  return `
                    <div
                      class="${clases}"
                      data-id="${b.id}"
                      data-inicio="${b.inicio}"
                      data-fin="${b.fin}"
                      style="top: ${topPct}%; height: ${heightPct}%; border-left-color: ${color};"
                    >
                      <button
                        type="button"
                        class="btn-check-bloque ${b.hecho ? 'activo' : ''}"
                        data-id="${b.id}"
                        title="${b.hecho ? 'Completado' : 'Marcar completado'}"
                      >
                        ✓
                      </button>

                      <div class="bloque-info" data-id="${b.id}">
                        <div class="bloque-titulo-fila">
                          <span class="bloque-titulo" title="${this.escapar(titulo)}">${this.escapar(titulo)}</span>
                          <span class="bloque-horas">${b.inicio} - ${b.fin}</span>
                        </div>
                        ${tarea?.notas && !esPequeno ? `<span class="bloque-notas">${this.escapar(tarea.notas)}</span>` : ''}
                      </div>

                      ${b.propuesto ? `
                        <div class="bloque-acciones-propuesto">
                          <button type="button" class="btn btn-micro btn-exito btn-aceptar-propuesto" data-id="${b.id}" title="Aceptar bloque">Aceptar</button>
                          <button type="button" class="btn btn-micro btn-peligro btn-descartar-propuesto" data-id="${b.id}" title="Descartar bloque">Descartar</button>
                        </div>
                      ` : ''}

                      <!-- Manija para arrastrar el borde inferior y redimensionar la duración -->
                      <div class="manija-redimensionar" data-id="${b.id}" title="Arrastra para cambiar duración (pasos de 15 min)"></div>
                    </div>
                  `;
                }).join('')}

                <!-- Entregas en la línea de tiempo de hoy (con agrupación y anclaje superior si es última hora) -->
                ${gruposEntregasHoy.map((g, idxG) => {
                  const minEntrega = g.minBase;
                  const minClampeado = Math.max(minInicioDia, Math.min(minFinDia, minEntrega));
                  const topPct = ((minClampeado - minInicioDia) / totalMinutos) * 100;
                  const esUltimaHora = minClampeado >= (minFinDia - 60);

                  if (g.esGrupo) {
                    return `
                      <div
                        class="hoy-marcador-entrega grupo-entregas nivel-${g.urgenciaMayor} ${esUltimaHora ? 'marcador-arriba' : ''}"
                        data-grupo-idx="${idxG}"
                        style="top: ${topPct}%;"
                        title="${g.conteo} entregas a las ${formatearHora12(g.horaStr)}"
                      >
                        <span class="marcador-pin">🎯</span>
                        <span class="marcador-etiqueta">
                          <strong>${g.conteo} entregas</strong> · ${formatearHora12(g.horaStr)}
                        </span>

                        <div class="popover-lista-entregas ${esUltimaHora ? 'popover-arriba' : ''}">
                          <div class="popover-cabecera">
                            <span>${g.conteo} entrega${g.conteo === 1 ? '' : 's'} · ${formatearHora12(g.horaStr)}</span>
                          </div>
                          <div class="popover-items">
                            ${(g.itemsPrincipales || g.items).map((it) => `
                              <div class="popover-item-entrega" data-id="${it.tarea.id}">
                                <span class="punto-materia" style="background-color: ${it.mat?.color || '#6b6a66'};"></span>
                                <span class="popover-item-titulo">${this.escapar(it.tarea.titulo)}</span>
                                <span class="etiqueta-urgencia nivel-${it.urg?.nivel || 'con-tiempo'}">${it.urg?.textoUrgencia || ''}</span>
                                ${avisosNoAlcanza && avisosNoAlcanza[it.tarea.id] ? `<span class="etiqueta-no-alcanza">⚠️ ${this.escapar(avisosNoAlcanza[it.tarea.id].texto)}</span>` : ''}
                              </div>
                              ${(it.hijas || []).map((h) => `
                                <div class="popover-item-entrega popover-subitem" data-id="${h.tarea.id}" style="padding-left: 24px;">
                                  <span class="punto-materia" style="background-color: ${h.mat?.color || '#6b6a66'};"></span>
                                  <span class="popover-item-titulo">↳ ${this.escapar(h.tarea.titulo)}</span>
                                  <span class="etiqueta-urgencia nivel-${h.urg?.nivel || 'con-tiempo'}">${h.urg?.textoUrgencia || ''}</span>
                                  ${avisosNoAlcanza && avisosNoAlcanza[h.tarea.id] ? `<span class="etiqueta-no-alcanza">⚠️ ${this.escapar(avisosNoAlcanza[h.tarea.id].texto)}</span>` : ''}
                                </div>
                              `).join('')}
                            `).join('')}
                          </div>
                        </div>
                      </div>
                    `;
                  }

                  const item = g.items[0];
                  return `
                    <div
                      class="hoy-marcador-entrega nivel-${item.urg.nivel} ${esUltimaHora ? 'marcador-arriba' : ''}"
                      data-id="${item.tarea.id}"
                      style="top: ${topPct}%;"
                      title="Entrega: ${this.escapar(item.tarea.titulo)} a las ${formatearHora12(item.horaStr)}"
                    >
                      <span class="marcador-pin">🎯</span>
                      <span class="marcador-etiqueta">
                        <strong>${formatearHora12(item.horaStr)}</strong> ${this.escapar(item.tarea.titulo)}
                        ${avisosNoAlcanza[item.tarea.id] ? `<span class="etiqueta-no-alcanza">⚠️ ${this.escapar(avisosNoAlcanza[item.tarea.id].texto)}</span>` : ''}
                      </span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>

          <!-- Columna lateral: Entregas de hoy y mañana -->
          <aside class="hoy-columna-entregas">
            <h4 class="entregas-titulo">Entregas de hoy y mañana</h4>
            ${entregasProximas.length === 0 ? `
              <p class="texto-suave texto-vacio">No hay entregas pendientes para hoy ni mañana.</p>
            ` : `
              <div class="lista-entregas-proximas">
                ${entregasProximas.map(({ tarea, urg, materia }) => `
                  <div class="tarjeta-entrega nivel-${urg.nivel}" data-id="${tarea.id}">
                    <div class="entrega-cabecera">
                      <span class="punto-materia" style="background-color: ${materia?.color || '#6b6a66'};"></span>
                      <span class="materia-nombre">${this.escapar(materia?.nombre || '')}</span>
                      <span class="etiqueta-urgencia nivel-${urg.nivel}">${urg.textoUrgencia}</span>
                      ${avisosNoAlcanza[tarea.id] ? `<span class="etiqueta-no-alcanza">⚠️ ${this.escapar(avisosNoAlcanza[tarea.id].texto)}</span>` : ''}
                    </div>
                    <div class="entrega-titulo">${this.escapar(tarea.titulo)}</div>
                    <div class="entrega-pie">
                      <span class="entrega-fecha">📅 ${formatearEntrega(tarea.entrega)}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </aside>
        </div>
      </div>
    `;

    this.conectarEventos(fechaSeleccionada, minInicioDia, minFinDia, totalMinutos, esHoy);
  }

  conectarEventos(fechaSeleccionada, minInicioDia, minFinDia, totalMinutos, esHoy) {
    // Botones de planificación
    this.contenedor.querySelector('.btn-planificar')?.addEventListener('click', () => {
      if (this.eventos.onPlanificar) this.eventos.onPlanificar();
    });

    this.contenedor.querySelector('.btn-aceptar-todos-propuestos')?.addEventListener('click', () => {
      if (this.eventos.onAceptarTodosPropuestos) this.eventos.onAceptarTodosPropuestos();
    });

    this.contenedor.querySelector('.btn-descartar-todos-propuestos')?.addEventListener('click', () => {
      if (this.eventos.onDescartarTodosPropuestos) this.eventos.onDescartarTodosPropuestos();
    });
    // Navegación de fechas
    this.contenedor.querySelector('.btn-dia-ant')?.addEventListener('click', () => {
      this.eventos.onCambiarFecha(sumarDias(fechaSeleccionada, -1));
    });

    this.contenedor.querySelector('.btn-dia-sig')?.addEventListener('click', () => {
      this.eventos.onCambiarFecha(sumarDias(fechaSeleccionada, 1));
    });

    this.contenedor.querySelector('.btn-ir-hoy')?.addEventListener('click', () => {
      this.eventos.onCambiarFecha(aFechaIso());
    });

    // Nuevo bloque
    this.contenedor.querySelector('.btn-nuevo-bloque')?.addEventListener('click', () => {
      if (this.eventos.onNuevoBloque) {
        this.eventos.onNuevoBloque(fechaSeleccionada, '08:00', '09:30');
      }
    });

    // Nuevo fijo
    this.contenedor.querySelector('.btn-nuevo-fijo')?.addEventListener('click', () => {
      if (this.eventos.onNuevoFijo) {
        this.eventos.onNuevoFijo();
      }
    });

    // Clic en fijo abre editor
    this.contenedor.querySelectorAll('.elemento-fijo[data-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        if (id) this.eventos.onSeleccionar('fijo', id);
      });
    });

    // Marcar bloque hecho
    this.contenedor.querySelectorAll('.btn-check-bloque').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.getAttribute('data-id');
        const estaActivo = el.classList.contains('activo');
        if (id) this.eventos.onMarcarBloqueHecho(id, !estaActivo);
      });
    });

    // Botones de bloques propuestos
    this.contenedor.querySelectorAll('.btn-aceptar-propuesto').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.getAttribute('data-id');
        if (id && this.eventos.onAceptarBloquePropuesto) {
          this.eventos.onAceptarBloquePropuesto(id);
        }
      });
    });

    this.contenedor.querySelectorAll('.btn-descartar-propuesto').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.getAttribute('data-id');
        if (id && this.eventos.onDescartarBloquePropuesto) {
          this.eventos.onDescartarBloquePropuesto(id);
        }
      });
    });

    // Clic en entrega de columna lateral
    this.contenedor.querySelectorAll('.tarjeta-entrega').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        if (id) this.eventos.onSeleccionar('tarea', id);
      });
    });

    // Clic en entrega individual de timeline
    this.contenedor.querySelectorAll('.hoy-marcador-entrega:not(.grupo-entregas)').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        if (id) this.eventos.onSeleccionar('tarea', id);
      });
    });

    // Clic en grupo de entregas de timeline para desplegar popover
    this.contenedor.querySelectorAll('.hoy-marcador-entrega.grupo-entregas').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const estabaActivo = el.classList.contains('activo');
        this.contenedor.querySelectorAll('.hoy-marcador-entrega.grupo-entregas.activo').forEach((g) => {
          g.classList.remove('activo');
        });
        if (!estabaActivo) {
          el.classList.add('activo');
        }
      });
    });

    // Clic en item dentro del popover en Hoy
    this.contenedor.querySelectorAll('.hoy-marcador-entrega .popover-item-entrega').forEach((itemEl) => {
      itemEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = itemEl.getAttribute('data-id');
        itemEl.closest('.grupo-entregas')?.classList.remove('activo');
        if (id) this.eventos.onSeleccionar('tarea', id);
      });
    });

    // Cerrar popovers al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.grupo-entregas')) {
        this.contenedor.querySelectorAll('.hoy-marcador-entrega.grupo-entregas.activo').forEach((g) => {
          g.classList.remove('activo');
        });
      }
    });

    // Configurar arrastrar y redimensionar con pointer events
    this.conectarArrastreYRedimension(minInicioDia, minFinDia, totalMinutos);

    // Actualización de la línea "ahora"
    if (esHoy) {
      this.actualizarLineaAhora(minInicioDia, totalMinutos);
      this.intervaloReloj = setInterval(() => {
        this.actualizarLineaAhora(minInicioDia, totalMinutos);
      }, 60000);
    }
  }

  conectarArrastreYRedimension(minInicioDia, minFinDia, totalMinutos) {
    const lienzo = this.contenedor.querySelector('#timeline-lienzo');
    const indicadorFlotante = this.contenedor.querySelector('#indicador-tiempo-arrastre');
    if (!lienzo) return;

    const bloques = this.contenedor.querySelectorAll('.elemento-bloque');

    bloques.forEach((bloqueEl) => {
      const bloqueId = bloqueEl.getAttribute('data-id');
      const manija = bloqueEl.querySelector('.manija-redimensionar');

      // 1. Redimensionar desde borde inferior
      manija?.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        manija.setPointerCapture(e.pointerId);

        const rectLienzo = lienzo.getBoundingClientRect();
        const inicioOriginal = bloqueEl.getAttribute('data-inicio') || '08:00';
        const finOriginal = bloqueEl.getAttribute('data-fin') || '09:00';
        const minInicio = horaAMinutos(inicioOriginal);
        const minFinOriginal = horaAMinutos(finOriginal);
        const duracionOriginal = Math.max(15, minFinOriginal - minInicio);

        this.estadoArrastre = {
          tipo: 'redimensionar',
          bloqueId,
          bloqueEl,
          pointerId: e.pointerId,
          startY: e.clientY,
          rectLienzo,
          minInicio,
          duracionOriginal,
          nuevaDuracion: duracionOriginal,
          nuevoFin: finOriginal,
          haCambiado: false
        };

        bloqueEl.classList.add('arrastrando');
        if (indicadorFlotante) {
          indicadorFlotante.style.display = 'block';
          indicadorFlotante.textContent = `${inicioOriginal} - ${finOriginal} (${duracionOriginal} min)`;
        }
      });

      // 2. Mover bloque completo
      bloqueEl.addEventListener('pointerdown', (e) => {
        // Ignorar si pulsó el botón de check o la manija
        if (e.target.closest('.btn-check-bloque') || e.target.closest('.manija-redimensionar') || e.target.closest('.bloque-acciones-propuesto')) {
          return;
        }

        e.preventDefault();
        bloqueEl.setPointerCapture(e.pointerId);

        const rectLienzo = lienzo.getBoundingClientRect();
        const inicioOriginal = bloqueEl.getAttribute('data-inicio') || '08:00';
        const finOriginal = bloqueEl.getAttribute('data-fin') || '09:00';
        const minInicioOriginal = horaAMinutos(inicioOriginal);
        const duracion = Math.max(15, horaAMinutos(finOriginal) - minInicioOriginal);

        this.estadoArrastre = {
          tipo: 'mover',
          bloqueId,
          bloqueEl,
          pointerId: e.pointerId,
          startY: e.clientY,
          startX: e.clientX,
          rectLienzo,
          minInicioOriginal,
          duracion,
          nuevoInicioMin: minInicioOriginal,
          nuevoInicio: inicioOriginal,
          nuevoFin: finOriginal,
          haCambiado: false,
          distanciaTotal: 0
        };

        bloqueEl.classList.add('arrastrando');
      });

      // Pointermove para este bloque
      const onPointerMove = (e) => {
        if (!this.estadoArrastre || this.estadoArrastre.bloqueId !== bloqueId || this.estadoArrastre.pointerId !== e.pointerId) {
          return;
        }

        const deltaY = e.clientY - this.estadoArrastre.startY;
        const deltaX = (e.clientX - (this.estadoArrastre.startX || e.clientX));
        this.estadoArrastre.distanciaTotal = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        const alturaPx = this.estadoArrastre.rectLienzo.height;
        if (alturaPx <= 0) return;

        // Minutos de desplazamiento según pixeles
        const deltaMinutosBruto = (deltaY / alturaPx) * totalMinutos;

        if (this.estadoArrastre.tipo === 'mover') {
          // Ajustar a pasos de 15 minutos
          const deltaMinutos15 = Math.round(deltaMinutosBruto / 15) * 15;
          let nuevoMinInicio = this.estadoArrastre.minInicioOriginal + deltaMinutos15;

          // Limitar dentro del horario del día
          nuevoMinInicio = Math.max(minInicioDia, Math.min(minFinDia - this.estadoArrastre.duracion, nuevoMinInicio));
          const nuevoMinFin = nuevoMinInicio + this.estadoArrastre.duracion;

          this.estadoArrastre.nuevoInicioMin = nuevoMinInicio;
          this.estadoArrastre.nuevoInicio = minutosAHora(nuevoMinInicio);
          this.estadoArrastre.nuevoFin = minutosAHora(nuevoMinFin);

          // Actualizar visualmente la posición top
          const topPct = ((nuevoMinInicio - minInicioDia) / totalMinutos) * 100;
          bloqueEl.style.top = `${topPct}%`;

          if (nuevoMinInicio !== this.estadoArrastre.minInicioOriginal) {
            this.estadoArrastre.haCambiado = true;
          }

          if (indicadorFlotante) {
            indicadorFlotante.style.display = 'block';
            indicadorFlotante.style.top = `${topPct}%`;
            indicadorFlotante.textContent = `${this.estadoArrastre.nuevoInicio} - ${this.estadoArrastre.nuevoFin}`;
          }
        } else if (this.estadoArrastre.tipo === 'redimensionar') {
          // Ajustar duración a pasos de 15 minutos (mínimo 15 minutos)
          const deltaDuracion15 = Math.round(deltaMinutosBruto / 15) * 15;
          let nuevaDuracion = Math.max(15, this.estadoArrastre.duracionOriginal + deltaDuracion15);

          // Limitar que no pase del fin del día
          if (this.estadoArrastre.minInicio + nuevaDuracion > minFinDia) {
            nuevaDuracion = minFinDia - this.estadoArrastre.minInicio;
          }

          this.estadoArrastre.nuevaDuracion = nuevaDuracion;
          const nuevoMinFin = this.estadoArrastre.minInicio + nuevaDuracion;
          this.estadoArrastre.nuevoFin = minutosAHora(nuevoMinFin);

          // Actualizar visualmente la altura
          const heightPct = (nuevaDuracion / totalMinutos) * 100;
          bloqueEl.style.height = `${heightPct}%`;

          if (nuevaDuracion !== this.estadoArrastre.duracionOriginal) {
            this.estadoArrastre.haCambiado = true;
          }

          if (indicadorFlotante) {
            indicadorFlotante.style.display = 'block';
            const topPct = ((nuevoMinFin - minInicioDia) / totalMinutos) * 100;
            indicadorFlotante.style.top = `${topPct}%`;
            indicadorFlotante.textContent = `Hasta las ${this.estadoArrastre.nuevoFin} (${nuevaDuracion} min)`;
          }
        }
      };

      const onPointerUp = (e) => {
        if (!this.estadoArrastre || this.estadoArrastre.bloqueId !== bloqueId || this.estadoArrastre.pointerId !== e.pointerId) {
          return;
        }

        const estado = this.estadoArrastre;
        this.estadoArrastre = null;
        bloqueEl.classList.remove('arrastrando');

        if (indicadorFlotante) {
          indicadorFlotante.style.display = 'none';
        }

        try {
          bloqueEl.releasePointerCapture(e.pointerId);
        } catch (_) {}

        if (estado.haCambiado) {
          if (estado.tipo === 'mover') {
            this.eventos.onActualizarBloque(estado.bloqueId, {
              inicio: estado.nuevoInicio,
              fin: estado.nuevoFin
            });
          } else if (estado.tipo === 'redimensionar') {
            this.eventos.onActualizarBloque(estado.bloqueId, {
              fin: estado.nuevoFin
            });
          }
        } else {
          // Si apenas se movió (< 6px), tratar como clic para abrir el editor
          if (estado.tipo === 'mover' && (estado.distanciaTotal || 0) < 6) {
            this.eventos.onSeleccionar('bloque', estado.bloqueId);
          }
        }
      };

      bloqueEl.addEventListener('pointermove', onPointerMove);
      bloqueEl.addEventListener('pointerup', onPointerUp);
      bloqueEl.addEventListener('pointercancel', onPointerUp);

      manija?.addEventListener('pointermove', onPointerMove);
      manija?.addEventListener('pointerup', onPointerUp);
      manija?.addEventListener('pointercancel', onPointerUp);
    });
  }

  actualizarLineaAhora(minInicioDia, totalMinutos) {
    const elLinea = this.contenedor.querySelector('#linea-ahora');
    if (!elLinea) return;

    const ahora = new Date();
    const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
    if (minAhora >= minInicioDia && minAhora <= minInicioDia + totalMinutos) {
      const topPct = ((minAhora - minInicioDia) / totalMinutos) * 100;
      elLinea.style.display = 'block';
      elLinea.style.top = `${topPct}%`;
    } else {
      elLinea.style.display = 'none';
    }
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
