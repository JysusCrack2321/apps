// vistas/semana.js
// Vista Semana: 7 columnas con línea de tiempo horaria.
// Incluye fijos, bloques y entregas ubicadas como marcadores a su hora exacta.

import {
  sumarDias,
  diaDeLaSemana,
  formatearFecha,
  formatearHora12,
  aFechaIso,
  horaAMinutos,
  aHoraIso
} from '../comun/tiempo.js';
import { calcularUrgencia, agruparEntregas } from '../comun/modelo.js';

export class VistaSemana {
  /**
   * @param {HTMLElement} contenedorElemento
   * @param {{
   *   onSeleccionar: (tipo: string, id: string) => void,
   *   onCambiarFecha: (fechaIso: string) => void
   * }} eventos
   */
  constructor(contenedorElemento, eventos) {
    this.contenedor = contenedorElemento;
    this.eventos = eventos;
  }

  renderizar(datos, fechaReferencia) {
    // Calcular el lunes y domingo de la semana
    const diaSemRef = diaDeLaSemana(fechaReferencia);
    const offsetLunes = 1 - diaSemRef;
    const lunesIso = sumarDias(fechaReferencia, offsetLunes);
    const domingoIso = sumarDias(lunesIso, 6);

    const diasSemana = [];
    for (let i = 0; i < 7; i++) {
      diasSemana.push(sumarDias(lunesIso, i));
    }

    const materiasMap = new Map(datos.materias.map((m) => [m.id, m]));
    const tareasMap = new Map(datos.tareas.map((t) => [t.id, t]));
    const hoyIso = aFechaIso();
    const ahoraIso = `${hoyIso}T${aHoraIso()}`;

    const inicioDiaStr = datos.config?.inicioDia || '06:00';
    const finDiaStr = datos.config?.finDia || '24:00';
    const minInicioDia = horaAMinutos(inicioDiaStr);
    const minFinDia = finDiaStr === '24:00' ? 1440 : horaAMinutos(finDiaStr);
    const totalMinutos = Math.max(60, minFinDia - minInicioDia);

    // Horas guía en el eje lateral
    const horasGuia = [];
    const horaInicial = Math.floor(minInicioDia / 60);
    const horaFinal = Math.ceil(minFinDia / 60);
    for (let h = horaInicial; h < horaFinal; h += 2) {
      horasGuia.push(`${String(h).padStart(2, '0')}:00`);
    }

    const NOMBRES_DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    this.contenedor.innerHTML = `
      <div class="vista-semana-contenedor">
        <header class="semana-cabecera-navegacion">
          <div class="navegacion-fechas">
            <button class="btn btn-secundario btn-icono btn-sem-ant" title="Semana anterior">‹</button>
            <button class="btn btn-secundario btn-ir-hoy-sem">Esta semana</button>
            <button class="btn btn-secundario btn-icono btn-sem-sig" title="Semana siguiente">›</button>
            <span class="etiqueta-fecha-actual">
              ${formatearFecha(lunesIso)} — ${formatearFecha(domingoIso)}
            </span>
          </div>

          <div class="acciones-vista-semana">
            <button class="btn btn-secundario btn-nuevo-bloque">+ Bloque</button>
            <button class="btn btn-secundario btn-nuevo-fijo">+ Fijo</button>
          </div>
        </header>

        <div class="semana-scroll-contenedor">
          <div class="semana-tabla-horario">
            <!-- Columna izquierda de horas -->
            <div class="semana-columna-horas">
              <div class="semana-cabecera-vacia"></div>
              <div class="semana-timeline-horas">
                ${horasGuia.map((hStr) => {
                  const topPct = ((horaAMinutos(hStr) - minInicioDia) / totalMinutos) * 100;
                  return `
                    <div class="semana-hora-marca" style="top: ${topPct}%;">
                      <span>${formatearHora12(hStr)}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- 7 Columnas de días -->
            <div class="semana-cuadricula-dias">
              ${diasSemana.map((diaIso) => {
                const numDiaSem = diaDeLaSemana(diaIso);
                const esHoy = diaIso === hoyIso;

                // 1. Fijos que aplican este día
                const fijosDelDia = datos.fijos.filter((f) => {
                  if (!f.dias.includes(numDiaSem)) return false;
                  if (f.desde && diaIso < f.desde) return false;
                  if (f.hasta && diaIso > f.hasta) return false;
                  return true;
                });

                // 2. Bloques de este día
                const bloquesDelDia = datos.bloques.filter((b) => b.fecha === diaIso);

                // 3. Entregas de este día (agrupadas si caen con menos de 15 min de diferencia)
                const entregasDelDia = datos.tareas.filter((t) => {
                  return t.entrega && t.entrega.startsWith(diaIso);
                }).map((t) => {
                  const horaStr = t.entrega.split('T')[1] || '23:59';
                  const urg = calcularUrgencia(t, ahoraIso, datos.tareas);
                  const mat = materiasMap.get(t.materia);
                  return { tarea: t, horaStr, urg, mat };
                });

                const gruposEntregas = agruparEntregas(entregasDelDia, 15);

                return `
                  <div class="semana-dia-columna ${esHoy ? 'columna-hoy' : ''}" data-fecha="${diaIso}">
                    <!-- Encabezado de la columna del día -->
                    <div class="semana-dia-cabecera">
                      <span class="dia-nombre">${NOMBRES_DIAS[numDiaSem]}</span>
                      <span class="dia-numero">${diaIso.split('-')[2]}</span>
                      ${esHoy ? '<span class="insignia-hoy">Hoy</span>' : ''}
                    </div>

                    <!-- Lienzo con línea de tiempo del día -->
                    <div class="semana-dia-lienzo">
                      <!-- Líneas guía horizontales cada 2 horas -->
                      ${horasGuia.map((hStr) => {
                        const topPct = ((horaAMinutos(hStr) - minInicioDia) / totalMinutos) * 100;
                        return `<div class="semana-guia-horizontal" style="top: ${topPct}%;"></div>`;
                      }).join('')}

                      <!-- Fijos (fondo rayado) -->
                      ${fijosDelDia.map((f) => {
                        const iniMin = Math.max(minInicioDia, horaAMinutos(f.inicio));
                        const finMin = Math.min(minFinDia, horaAMinutos(f.fin));
                        const durMin = Math.max(15, finMin - iniMin);
                        const topPct = ((iniMin - minInicioDia) / totalMinutos) * 100;
                        const heightPct = (durMin / totalMinutos) * 100;
                        const mat = f.materia ? materiasMap.get(f.materia) : null;
                        const color = mat?.color || '#8a8984';

                        return `
                          <div
                            class="semana-item-fijo"
                            data-id="${f.id}"
                            style="top: ${topPct}%; height: ${heightPct}%; border-left-color: ${color};"
                            title="${this.escapar(f.titulo)} (${f.inicio} - ${f.fin})"
                          >
                            <span class="item-titulo">${this.escapar(f.titulo)}</span>
                            <span class="item-hora">${f.inicio} - ${f.fin}</span>
                          </div>
                        `;
                      }).join('')}

                      <!-- Bloques -->
                      ${bloquesDelDia.map((b) => {
                        const iniMin = Math.max(minInicioDia, horaAMinutos(b.inicio));
                        const finMin = Math.min(minFinDia, horaAMinutos(b.fin));
                        const durMin = Math.max(15, finMin - iniMin);
                        const topPct = ((iniMin - minInicioDia) / totalMinutos) * 100;
                        const heightPct = (durMin / totalMinutos) * 100;

                        const tarea = b.tarea ? tareasMap.get(b.tarea) : null;
                        const mat = tarea ? materiasMap.get(tarea.materia) : null;
                        const color = mat?.color || '#2f6fde';
                        const titulo = tarea ? tarea.titulo : (b.titulo || 'Bloque libre');

                        return `
                          <div
                            class="semana-item-bloque ${b.hecho ? 'hecho' : ''}"
                            data-id="${b.id}"
                            style="top: ${topPct}%; height: ${heightPct}%; border-left-color: ${color};"
                            title="${this.escapar(titulo)} (${b.inicio} - ${b.fin})"
                          >
                            <span class="item-titulo">${this.escapar(titulo)}</span>
                            <span class="item-hora">${b.inicio} - ${b.fin}</span>
                          </div>
                        `;
                      }).join('')}

                      <!-- Entregas como marcador a su hora exacta o grupo -->
                      ${gruposEntregas.map((g, idxG) => {
                        const minEntrega = g.minBase;
                        const minClampeado = Math.max(minInicioDia, Math.min(minFinDia, minEntrega));
                        const topPct = ((minClampeado - minInicioDia) / totalMinutos) * 100;
                        // Si cae en la última hora visible del día, anclar hacia arriba
                        const esUltimaHora = minClampeado >= (minFinDia - 60);

                        if (g.esGrupo) {
                          return `
                            <div
                              class="semana-marcador-entrega grupo-entregas nivel-${g.urgenciaMayor} ${esUltimaHora ? 'marcador-arriba' : ''}"
                              data-grupo-idx="${idxG}"
                              style="top: ${topPct}%;"
                              title="${g.conteo} entregas a las ${formatearHora12(g.horaStr)}"
                            >
                              <span class="marcador-pin">🎯</span>
                              <span class="marcador-etiqueta">
                                <strong>${g.conteo} entregas</strong> · ${formatearHora12(g.horaStr)}
                              </span>

                              <!-- Lista desplegable al tocar -->
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
                                    </div>
                                    ${(it.hijas || []).map((h) => `
                                      <div class="popover-item-entrega popover-subitem" data-id="${h.tarea.id}" style="padding-left: 24px;">
                                        <span class="punto-materia" style="background-color: ${h.mat?.color || '#6b6a66'};"></span>
                                        <span class="popover-item-titulo">↳ ${this.escapar(h.tarea.titulo)}</span>
                                        <span class="etiqueta-urgencia nivel-${h.urg?.nivel || 'con-tiempo'}">${h.urg?.textoUrgencia || ''}</span>
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
                            class="semana-marcador-entrega nivel-${item.urg.nivel} ${esUltimaHora ? 'marcador-arriba' : ''}"
                            data-id="${item.tarea.id}"
                            style="top: ${topPct}%;"
                            title="Entrega: ${this.escapar(item.tarea.titulo)} a las ${formatearHora12(item.horaStr)}"
                          >
                            <span class="marcador-pin">🎯</span>
                            <span class="marcador-etiqueta">
                              <strong>${formatearHora12(item.horaStr)}</strong> ${this.escapar(item.tarea.titulo)}
                            </span>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.conectarEventos(lunesIso);
  }

  conectarEventos(lunesIso) {
    this.contenedor.querySelector('.btn-sem-ant')?.addEventListener('click', () => {
      this.eventos.onCambiarFecha(sumarDias(lunesIso, -7));
    });

    this.contenedor.querySelector('.btn-sem-sig')?.addEventListener('click', () => {
      this.eventos.onCambiarFecha(sumarDias(lunesIso, 7));
    });

    this.contenedor.querySelector('.btn-ir-hoy-sem')?.addEventListener('click', () => {
      this.eventos.onCambiarFecha(aFechaIso());
    });

    // Nuevo bloque
    this.contenedor.querySelector('.btn-nuevo-bloque')?.addEventListener('click', () => {
      if (this.eventos.onNuevoBloque) {
        this.eventos.onNuevoBloque(lunesIso, '08:00', '09:30');
      }
    });

    // Nuevo fijo
    this.contenedor.querySelector('.btn-nuevo-fijo')?.addEventListener('click', () => {
      if (this.eventos.onNuevoFijo) {
        this.eventos.onNuevoFijo();
      }
    });

    // Clic en bloque abre editor
    this.contenedor.querySelectorAll('.semana-item-bloque').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        if (id) this.eventos.onSeleccionar('bloque', id);
      });
    });

    // Clic en fijo abre editor
    this.contenedor.querySelectorAll('.semana-item-fijo').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        if (id) this.eventos.onSeleccionar('fijo', id);
      });
    });

    // Clic en entrega individual abre editor de tarea
    this.contenedor.querySelectorAll('.semana-marcador-entrega:not(.grupo-entregas)').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        if (id) this.eventos.onSeleccionar('tarea', id);
      });
    });

    // Clic/toque en grupo de entregas despliega lista
    this.contenedor.querySelectorAll('.semana-marcador-entrega.grupo-entregas').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const estabaActivo = el.classList.contains('activo');
        // Cerrar otros abiertos
        this.contenedor.querySelectorAll('.semana-marcador-entrega.grupo-entregas.activo').forEach((g) => {
          g.classList.remove('activo');
        });
        if (!estabaActivo) {
          el.classList.add('activo');
        }
      });
    });

    // Clic en item dentro del popover
    this.contenedor.querySelectorAll('.popover-item-entrega').forEach((itemEl) => {
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
        this.contenedor.querySelectorAll('.semana-marcador-entrega.grupo-entregas.activo').forEach((g) => {
          g.classList.remove('activo');
        });
      }
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
