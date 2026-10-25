// comun/modelo.js
// Lógica pura de datos, validación, cálculo de urgencia y operaciones inmutables.

import { aFechaIso, aHoraIso, diferenciaHoras, horaAMinutos, minutosAHora, sumarDias, diaDeLaSemana } from './tiempo.js';

/**
 * Genera un identificador único con prefijo ('t-', 'b-', 'f-', 'm-').
 * @param {string} prefijo
 * @returns {string}
 */
export function generarId(prefijo = 'id') {
  const aleatorio = Math.random().toString(36).substring(2, 7);
  const tiempo = Date.now().toString(36).slice(-4);
  return `${prefijo}-${aleatorio}${tiempo}`;
}

/**
 * Clona profundamente un objeto JSON serializable.
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function clonar(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Determina si el ETag recibido en un evento SSE o respuesta corresponde al mismo
 * ETag que la aplicación ya tiene (es decir, es un eco de su propio guardado).
 * Tolera diferencias en prefijo débil W/ o presencia/ausencia de comillas.
 *
 * @param {string|null|undefined} etagEvento
 * @param {string|null|undefined} etagActual
 * @returns {boolean}
 */
export function esEcoPropio(etagEvento, etagActual) {
  if (!etagEvento || !etagActual) return false;
  const normalizar = (s) => String(s).trim().replace(/^W\//, '');
  const a = normalizar(etagEvento);
  const b = normalizar(etagActual);
  if (a === b) return true;
  const sinComillasA = a.replace(/^"+|"+$/g, '');
  const sinComillasB = b.replace(/^"+|"+$/g, '');
  return sinComillasA === sinComillasB;
}

/**
 * Valida de forma tolerante la estructura de datos.json.
 * Rellena campos faltantes con valores por defecto y reporta advertencias no bloqueantes.
 * @param {any} datosRaw
 * @returns {{ datos: object, advertencias: string[] }}
 */
export function validarDatos(datosRaw) {
  const advertencias = [];
  const base = (datosRaw && typeof datosRaw === 'object') ? clonar(datosRaw) : {};

  const config = Object.assign(
    {
      inicioDia: '06:00',
      finDia: '24:00',
      bloqueMaxMin: 90,
      pausaMin: 10
    },
    base.config || {}
  );
  delete config.comida;

  const fijosRaw = Array.isArray(base.fijos) ? base.fijos.slice() : [];
  if (base.config && base.config.comida) {
    const inicioComida = String(base.config.comida.inicio || '13:00');
    const finComida = String(base.config.comida.fin || '14:00');
    const yaExiste = fijosRaw.some((f) => f.id === 'f-comida' || f.titulo === 'Comida');
    if (!yaExiste) {
      fijosRaw.push({
        id: 'f-comida',
        titulo: 'Comida',
        materia: null,
        dias: [1, 2, 3, 4, 5, 6, 7],
        inicio: inicioComida,
        fin: finComida,
        lugar: '',
        desde: '2026-08-01',
        hasta: '2026-12-31'
      });
    }
    advertencias.push('config.comida obsoleto convertido a fijo.');
  }

  const materias = Array.isArray(base.materias) ? base.materias : [];
  const materiasMap = new Map();
  const materiasLimpias = materias.map((m, idx) => {
    const id = m.id || generarId('m');
    const materia = {
      id,
      nombre: String(m.nombre || `Materia ${idx + 1}`).trim(),
      color: String(m.color || '#6b6a66')
    };
    materiasMap.set(id, materia);
    return materia;
  });

  const tareas = Array.isArray(base.tareas) ? base.tareas : [];
  const tareasIds = new Set(tareas.map((t) => t.id).filter(Boolean));

  const tareasLimpias = tareas.map((t, idx) => {
    const id = t.id || generarId('t');
    let padre = t.padre || null;
    if (padre && !tareasIds.has(padre)) {
      advertencias.push(`La tarea "${t.titulo || id}" referencia un padre inexistente "${padre}".`);
      padre = null;
    }
    if (padre === id) {
      advertencias.push(`La tarea "${t.titulo || id}" no puede ser su propio padre.`);
      padre = null;
    }
    if (t.materia && !materiasMap.has(t.materia)) {
      advertencias.push(`La tarea "${t.titulo || id}" referencia una materia desconocida "${t.materia}".`);
    }

    const duracionMin = typeof t.duracionMin === 'number' && !isNaN(t.duracionMin) ? Math.max(0, t.duracionMin) : 60;
    const avance = typeof t.avance === 'number' && !isNaN(t.avance) ? Math.min(100, Math.max(0, t.avance)) : 0;
    const estado = ['pendiente', 'en curso', 'hecha'].includes(t.estado) ? t.estado : 'pendiente';

    return {
      id,
      titulo: String(t.titulo || `Tarea ${idx + 1}`).trim(),
      materia: t.materia || (materiasLimpias[0]?.id || ''),
      padre,
      entrega: typeof t.entrega === 'string' ? t.entrega : '',
      duracionMin,
      avance,
      estado,
      notas: typeof t.notas === 'string' ? t.notas : ''
    };
  });

  const tareasMapFinal = new Map(tareasLimpias.map((t) => [t.id, t]));

  const bloques = Array.isArray(base.bloques) ? base.bloques : [];
  const bloquesLimpios = bloques.map((b) => {
    const id = b.id || generarId('b');
    let tareaId = b.tarea || null;
    if (tareaId && !tareasMapFinal.has(tareaId)) {
      advertencias.push(`El bloque "${id}" referencia una tarea inexistente "${tareaId}".`);
      tareaId = null;
    }
    const inicio = String(b.inicio || '08:00');
    let fin = String(b.fin || '09:00');
    if (fin === '00:00' && (inicio > '00:00' || horaAMinutos(inicio) > 0)) {
      advertencias.push(`El bloque "${id}" tenía fin "00:00" con inicio "${inicio}". Se convirtió a "24:00".`);
      fin = '24:00';
    }
    return {
      id,
      fecha: String(b.fecha || ''),
      inicio,
      fin,
      tarea: tareaId,
      titulo: typeof b.titulo === 'string' ? b.titulo : '',
      hecho: Boolean(b.hecho),
      propuesto: Boolean(b.propuesto)
    };
  });

  const fijosLimpios = fijosRaw.map((f, idx) => {
    const id = f.id || generarId('f');
    const dias = Array.isArray(f.dias)
      ? f.dias.map(Number).filter((d) => d >= 1 && d <= 7)
      : [1];
    const materiaVal = (f.materia !== undefined && f.materia !== null && f.materia !== '')
      ? String(f.materia)
      : null;
    return {
      id,
      titulo: String(f.titulo || `Clase ${idx + 1}`).trim(),
      materia: materiaVal,
      dias: dias.length ? dias : [1],
      inicio: String(f.inicio || '07:00'),
      fin: String(f.fin || '09:00'),
      lugar: typeof f.lugar === 'string' ? f.lugar : '',
      desde: String(f.desde || ''),
      hasta: String(f.hasta || '')
    };
  });

  const datosValidados = {
    version: 1,
    config,
    materias: materiasLimpias,
    tareas: tareasLimpias,
    bloques: bloquesLimpios,
    fijos: fijosLimpios
  };

  return { datos: datosValidados, advertencias };
}

/**
 * Obtiene las subtareas directas de una tarea madre.
 * @param {Array<object>} tareas
 * @param {string} padreId
 * @returns {Array<object>}
 */
export function obtenerHijas(tareas, padreId) {
  if (!padreId) return [];
  return tareas.filter((t) => t.padre === padreId);
}

/**
 * Calcula la métrica acumulada de duración y avance si la tarea tiene hijas.
 * @param {object} tarea
 * @param {Array<object>} todasLasTareas
 * @returns {{ duracionMin: number, avance: number, restanteMin: number, tieneHijas: boolean }}
 */
export function calcularMetricasTarea(tarea, todasLasTareas) {
  const hijas = obtenerHijas(todasLasTareas, tarea.id);
  if (hijas.length === 0) {
    const duracionMin = typeof tarea.duracionMin === 'number' ? tarea.duracionMin : 60;
    const avance = typeof tarea.avance === 'number' ? tarea.avance : 0;
    const restanteMin = duracionMin * (1 - avance / 100);
    return { duracionMin, avance, restanteMin, tieneHijas: false };
  }

  let totalDuracion = 0;
  let totalRestante = 0;

  for (const hija of hijas) {
    const metricaHija = calcularMetricasTarea(hija, todasLasTareas);
    totalDuracion += metricaHija.duracionMin;
    totalRestante += metricaHija.restanteMin;
  }

  const avance = totalDuracion > 0 ? Math.round(((totalDuracion - totalRestante) / totalDuracion) * 100) : 0;
  return {
    duracionMin: totalDuracion,
    avance,
    restanteMin: totalRestante,
    tieneHijas: true
  };
}

/**
 * Sincroniza las métricas acumuladas (duracionMin, avance, estado) de una tarea madre a partir de sus hijas.
 * @param {object} datos
 * @param {string} madreId
 */
export function sincronizarMadre(datos, madreId) {
  if (!madreId || !datos || !datos.tareas) return;
  const madre = datos.tareas.find((t) => t.id === madreId);
  if (!madre) return;
  const metricas = calcularMetricasTarea(madre, datos.tareas);
  madre.duracionMin = metricas.duracionMin;
  madre.avance = metricas.avance;
  if (metricas.avance >= 100) {
    madre.estado = 'hecha';
  } else if (madre.estado === 'hecha') {
    madre.estado = 'pendiente';
  }
}

/**
 * Calcula la urgencia de una tarea según la especificación del contrato.
 * @param {object} tarea
 * @param {string} ahoraIso Fecha-hora ISO de referencia ('YYYY-MM-DDTHH:MM')
 * @param {Array<object>} todasLasTareas Lista completa para calcular subtareas
 * @returns {{
 *   nivel: 'vencida' | 'urgente' | 'pronto' | 'con-tiempo' | 'hecha',
 *   holguraH: number,
 *   horasHasta: number,
 *   restanteMin: number,
 *   duracionMin: number,
 *   avance: number,
 *   textoUrgencia: string,
 *   tieneHijas: boolean
 * }}
 */
export function calcularUrgencia(tarea, ahoraIso, todasLasTareas = []) {
  const metricas = calcularMetricasTarea(tarea, todasLasTareas);
  const duracionMin = metricas.duracionMin;
  const avance = metricas.avance;
  const restanteMin = metricas.restanteMin;

  if (tarea.estado === 'hecha' || (metricas.tieneHijas && avance >= 100)) {
    return {
      nivel: 'hecha',
      holguraH: Infinity,
      horasHasta: 0,
      restanteMin: 0,
      duracionMin,
      avance: 100,
      textoUrgencia: 'Hecha',
      tieneHijas: metricas.tieneHijas
    };
  }

  // 5. Subtareas sin entrega heredan la de la madre (si la madre tiene)
  const entregaEfectiva = tarea.entrega || (tarea.padre ? todasLasTareas.find((t) => t.id === tarea.padre)?.entrega : '') || '';

  if (!entregaEfectiva) {
    return {
      nivel: 'con-tiempo',
      holguraH: 999999,
      horasHasta: 999999,
      restanteMin,
      duracionMin,
      avance,
      textoUrgencia: 'Sin fecha',
      tieneHijas: metricas.tieneHijas
    };
  }

  const horasHasta = diferenciaHoras(ahoraIso, entregaEfectiva);
  const holguraH = horasHasta - restanteMin / 60;

  let nivel = 'con-tiempo';
  let textoUrgencia = '';

  if (horasHasta < 0) {
    nivel = 'vencida';
    const hVencida = Math.abs(Math.round(horasHasta));
    textoUrgencia = hVencida >= 24 ? `Vencida · hace ${Math.round(hVencida / 24)} d` : `Vencida · hace ${hVencida} h`;
  } else if (holguraH < 24) {
    nivel = 'urgente';
    const hFaltan = Math.max(0, Math.round(holguraH));
    textoUrgencia = `Urgente · holgura ${hFaltan} h`;
  } else if (holguraH < 72) {
    nivel = 'pronto';
    const hFaltan = Math.round(holguraH);
    textoUrgencia = `Pronto · holgura ${hFaltan} h`;
  } else {
    nivel = 'con-tiempo';
    const dFaltan = Math.round(holguraH / 24);
    textoUrgencia = dFaltan > 1 ? `Con tiempo · ${dFaltan} d` : `Con tiempo · ${Math.round(holguraH)} h`;
  }

  return {
    nivel,
    holguraH,
    horasHasta,
    restanteMin,
    duracionMin,
    avance,
    textoUrgencia,
    tieneHijas: metricas.tieneHijas
  };
}

/**
 * Agrupa entregas que caen a la misma hora o con menos de ventanaMin de diferencia.
 * @param {Array<object>} entregas
 * @param {number} [ventanaMin=15]
 * @returns {Array<{
 *   minBase: number,
 *   horaStr: string,
 *   items: Array<object>,
 *   conteo: number,
 *   esGrupo: boolean,
 *   urgenciaMayor: string
 * }>}
 */
export function agruparEntregas(entregas, ventanaMin = 15) {
  if (!Array.isArray(entregas) || entregas.length === 0) return [];

  const prioridadUrgencia = {
    'vencida': 5,
    'urgente': 4,
    'pronto': 3,
    'con-tiempo': 2,
    'hecha': 1
  };

  const elementos = entregas.map((item) => {
    let hora = item.horaStr;
    if (!hora) {
      if (typeof item.entrega === 'string' && item.entrega.includes('T')) {
        hora = item.entrega.split('T')[1];
      } else if (typeof item.tarea?.entrega === 'string' && item.tarea.entrega.includes('T')) {
        hora = item.tarea.entrega.split('T')[1];
      } else {
        hora = '23:59';
      }
    }
    return {
      ...item,
      horaStr: hora,
      minutos: horaAMinutos(hora)
    };
  }).sort((a, b) => a.minutos - b.minutos);

  const grupos = [];
  let grupoActual = null;

  for (const el of elementos) {
    if (!grupoActual) {
      grupoActual = {
        minBase: el.minutos,
        horaStr: el.horaStr,
        items: [el]
      };
    } else if (el.minutos - grupoActual.minBase < ventanaMin) {
      grupoActual.items.push(el);
    } else {
      grupos.push(grupoActual);
      grupoActual = {
        minBase: el.minutos,
        horaStr: el.horaStr,
        items: [el]
      };
    }
  }
  if (grupoActual) {
    grupos.push(grupoActual);
  }

  return grupos.map((g) => {
    let maxNivel = 'con-tiempo';
    let maxPuntos = 0;
    for (const it of g.items) {
      const nivel = it.urg?.nivel || it.nivel || 'con-tiempo';
      const pts = prioridadUrgencia[nivel] || 0;
      if (pts > maxPuntos) {
        maxPuntos = pts;
        maxNivel = nivel;
      }
    }

    // Estructurar jerarquía: una tarea madre y sus hijas en el grupo cuentan como 1 sola entrega
    const idsEnGrupo = new Set(g.items.map((it) => (it.tarea || it).id).filter(Boolean));
    const hijasPorMadre = new Map();
    const itemsHijas = new Set();

    for (const it of g.items) {
      const tarea = it.tarea || it;
      const padreId = tarea.padre;
      if (padreId && idsEnGrupo.has(padreId)) {
        itemsHijas.add(it);
        if (!hijasPorMadre.has(padreId)) {
          hijasPorMadre.set(padreId, []);
        }
        hijasPorMadre.get(padreId).push(it);
      }
    }

    const itemsPrincipales = g.items.filter((it) => !itemsHijas.has(it)).map((it) => {
      const id = (it.tarea || it).id;
      const hijas = hijasPorMadre.get(id) || [];
      return {
        ...it,
        hijas
      };
    });

    const conteo = itemsPrincipales.length;

    return {
      minBase: g.minBase,
      horaStr: g.horaStr,
      items: g.items,
      itemsPrincipales,
      conteo,
      esGrupo: conteo > 1 || g.items.length > 1,
      urgenciaMayor: maxNivel
    };
  });
}

/**
 * Planificador puro de tareas.
 * Calcula huecos libres descontando fijos y bloques existentes desde "ahora" redondeado a 15 min.
 * Genera bloques propuestos (propuesto: true) respetando bloqueMaxMin, pausaMin y fecha de entrega.
 * Detecta tareas que no alcanzan a completarse antes de su entrega.
 *
 * @param {object} datos
 * @param {string} ahoraIso Fecha-hora ISO de referencia ('YYYY-MM-DDTHH:MM')
 * @param {number} [dias=2] Cantidad de días a planificar (hoy y mañana)
 * @returns {Array<object> & { bloquesPropuestos: Array<object>, avisos: object, avisosNoAlcanza: object }}
 */
export function planificar(datos, ahoraIso, dias = 2) {
  if (!datos || !datos.tareas) {
    return {
      bloquesPropuestos: [],
      avisosNoAlcanza: {}
    };
  }

  const fechaHoy = ahoraIso.split('T')[0];
  const horaAhoraStr = ahoraIso.split('T')[1] || '06:00';
  const minAhora = horaAMinutos(horaAhoraStr);

  const inicioDiaStr = datos.config?.inicioDia || '06:00';
  const finDiaStr = datos.config?.finDia || '24:00';
  const minInicioDia = horaAMinutos(inicioDiaStr);
  const minFinDia = finDiaStr === '24:00' ? 1440 : horaAMinutos(finDiaStr);
  const bloqueMaxMin = Math.max(15, datos.config?.bloqueMaxMin || 90);
  const pausaMin = typeof datos.config?.pausaMin === 'number' ? Math.max(0, datos.config.pausaMin) : 10;

  // Bloques existentes: se consideran todos los bloques en el estado (incluidos los propuestos)
  const bloquesExistentes = datos.bloques || [];

  // Seleccionar tareas candidatas: solo hojas (sin hijas) y no hechas
  const tareasCandidatas = [];
  for (const t of datos.tareas) {
    if (t.estado === 'hecha') continue;
    const hijas = obtenerHijas(datos.tareas, t.id);
    if (hijas.length > 0) continue; // No planifica tareas madre

    // 5. Subtareas sin entrega heredan la de la madre
    const entregaEfectiva = t.entrega || (t.padre ? datos.tareas.find((p) => p.id === t.padre)?.entrega : '') || '';
    const urg = calcularUrgencia(t, ahoraIso, datos.tareas);
    const duracion = typeof t.duracionMin === 'number' ? t.duracionMin : 60;
    const avance = typeof t.avance === 'number' ? t.avance : 0;
    const restanteBase = duracion * (1 - avance / 100);

    // Restar lo que ya tengan en bloques futuros no hechos o en curso
    let minutosEnBloquesFuturos = 0;
    for (const b of bloquesExistentes) {
      if (b.tarea === t.id && !b.hecho) {
        const bInicioIso = `${b.fecha}T${b.inicio}`;
        const bFinIso = `${b.fecha}T${b.fin}`;
        if (bInicioIso >= ahoraIso) {
          // Futuro no hecho
          const iniB = horaAMinutos(b.inicio);
          const finB = horaAMinutos(b.fin);
          minutosEnBloquesFuturos += Math.max(0, finB - iniB);
        } else if (bInicioIso < ahoraIso && bFinIso > ahoraIso) {
          // 1. Bloque en curso (inicio < ahora < fin, no hecho): descuenta los minutos que le quedan (fin - ahora)
          const finB = horaAMinutos(b.fin);
          minutosEnBloquesFuturos += Math.max(0, finB - minAhora);
        }
      }
    }

    const minutosPendientes = Math.max(0, restanteBase - minutosEnBloquesFuturos);

    // 2. Bloques pasados sin hacer: cada bloque con fin < ahora y hecho: false se reutiliza con el mismo id
    const colaPasados = [];
    for (const b of bloquesExistentes) {
      if (b.tarea === t.id && !b.hecho && !b.propuesto) {
        const bFinIso = `${b.fecha}T${b.fin}`;
        if (bFinIso < ahoraIso) {
          const dur = Math.max(0, horaAMinutos(b.fin) - horaAMinutos(b.inicio));
          if (dur > 0) {
            colaPasados.push({
              id: b.id,
              duracionOriginal: dur,
              minutosRestantes: dur,
              idUsado: false,
              bloqueOriginal: b
            });
          }
        }
      }
    }
    colaPasados.sort((a, b) => {
      return `${a.bloqueOriginal.fecha}T${a.bloqueOriginal.inicio}`.localeCompare(
        `${b.bloqueOriginal.fecha}T${b.bloqueOriginal.inicio}`
      );
    });

    if (minutosPendientes > 0 || colaPasados.length > 0) {
      tareasCandidatas.push({
        ...t,
        urg,
        entregaEfectiva,
        minutosPendientes,
        minutosInicialesPendientes: minutosPendientes,
        colaPasados,
        tieneBloquesPasados: colaPasados.length > 0
      });
    }
  }

  // Ordenar tareas por holguraH ascendente
  tareasCandidatas.sort((a, b) => a.urg.holguraH - b.urg.holguraH);

  const bloquesPropuestos = [];

  // Recorrer los días de planificación (por defecto hoy y mañana)
  for (let diaIdx = 0; diaIdx < dias; diaIdx++) {
    const fechaDia = sumarDias(fechaHoy, diaIdx);
    const esHoy = (diaIdx === 0);

    // Determinar inicio disponible del día
    let inicioDisponibilidad = minInicioDia;
    if (esHoy) {
      // Redondear el inicio al siguiente múltiplo de 15 min desde ahora
      const minRedondeado = Math.ceil(minAhora / 15) * 15;
      inicioDisponibilidad = Math.max(minInicioDia, minRedondeado);
    }

    if (inicioDisponibilidad >= minFinDia) continue;

    // Recolectar intervalos ocupados por fijos y bloques existentes (incluidos los propuestos)
    const ocupados = [];

    // Fijos del día
    const numDiaSem = diaDeLaSemana(fechaDia);
    for (const f of (datos.fijos || [])) {
      if (f.dias && f.dias.includes(numDiaSem)) {
        if ((!f.desde || fechaDia >= f.desde) && (!f.hasta || fechaDia <= f.hasta)) {
          const iniF = horaAMinutos(f.inicio);
          const finF = horaAMinutos(f.fin);
          if (finF > iniF) {
            ocupados.push([iniF, finF]);
          }
        }
      }
    }

    // Bloques existentes del día (incluidos los propuestos)
    for (const b of bloquesExistentes) {
      if (b.fecha === fechaDia) {
        const iniB = horaAMinutos(b.inicio);
        const finB = horaAMinutos(b.fin);
        if (finB > iniB) {
          ocupados.push([iniB, finB]);
        }
      }
    }

    // Clampear ocupados dentro de [inicioDisponibilidad, minFinDia]
    const ocupadosFiltrados = [];
    for (const [ini, fin] of ocupados) {
      const iniC = Math.max(inicioDisponibilidad, Math.min(minFinDia, ini));
      const finC = Math.max(inicioDisponibilidad, Math.min(minFinDia, fin));
      if (finC > iniC) {
        ocupadosFiltrados.push([iniC, finC]);
      }
    }

    ocupadosFiltrados.sort((a, b) => a[0] - b[0]);

    // Unir intervalos ocupados solapados
    const ocupadosUnidos = [];
    for (const [ini, fin] of ocupadosFiltrados) {
      if (ocupadosUnidos.length === 0) {
        ocupadosUnidos.push([ini, fin]);
      } else {
        const ult = ocupadosUnidos[ocupadosUnidos.length - 1];
        if (ini <= ult[1]) {
          ult[1] = Math.max(ult[1], fin);
        } else {
          ocupadosUnidos.push([ini, fin]);
        }
      }
    }

    // Invertir para obtener huecos libres
    const huecos = [];
    let cursor = inicioDisponibilidad;
    for (const [ocIni, ocFin] of ocupadosUnidos) {
      if (ocIni > cursor) {
        huecos.push([cursor, ocIni]);
      }
      cursor = Math.max(cursor, ocFin);
    }
    if (cursor < minFinDia) {
      huecos.push([cursor, minFinDia]);
    }

    // Llenar huecos libres con bloques
    for (const [huecoIni, huecoFin] of huecos) {
      let curInicio = huecoIni;

      while (curInicio < huecoFin) {
        const espacioHueco = huecoFin - curInicio;
        if (espacioHueco < 15) break;

        // Buscar la siguiente tarea que aún requiera minutos y cuya entrega lo permita
        let tareaSeleccionada = null;
        let maxFinPorEntrega = huecoFin;

        for (const t of tareasCandidatas) {
          if (t.minutosPendientes < 15) continue;

          if (t.entregaEfectiva) {
            const partes = t.entregaEfectiva.split('T');
            const entregaFecha = partes[0];
            const entregaHora = partes[1] || '23:59';
            const minEntrega = horaAMinutos(entregaHora);

            // Nunca colocar después de la fecha de entrega
            if (fechaDia > entregaFecha) continue;

            if (fechaDia === entregaFecha) {
              if (curInicio >= minEntrega) continue;
              const limite = Math.min(huecoFin, minEntrega);
              if (limite - curInicio < 15) continue;
              tareaSeleccionada = t;
              maxFinPorEntrega = limite;
              break;
            }
          }

          // Entrega es en fecha futura o sin fecha
          tareaSeleccionada = t;
          maxFinPorEntrega = huecoFin;
          break;
        }

        if (!tareaSeleccionada) {
          break; // Ninguna tarea disponible cabe en este hueco
        }

        const espacioDisponible = maxFinPorEntrega - curInicio;
        if (espacioDisponible < 15) break;

        let idBloque = null;
        let tituloBloque = '';

        if (tareaSeleccionada.colaPasados && tareaSeleccionada.colaPasados.length > 0) {
          const pbActual = tareaSeleccionada.colaPasados[0];
          const duracionDeseada = Math.min(bloqueMaxMin, pbActual.minutosRestantes);
          tituloBloque = pbActual.bloqueOriginal?.titulo || '';

          const duracionBloque = Math.min(duracionDeseada, tareaSeleccionada.minutosPendientes, espacioDisponible);
          if (duracionBloque < 15) break;

          if (!pbActual.idUsado) {
            idBloque = pbActual.id;
            pbActual.idUsado = true;
          } else {
            // Si no cabe entero, se acorta y el resto va en un bloque nuevo
            idBloque = generarId('b');
          }

          pbActual.minutosRestantes -= duracionBloque;
          if (pbActual.minutosRestantes <= 0) {
            tareaSeleccionada.colaPasados.shift();
          }

          const curFin = curInicio + duracionBloque;
          bloquesPropuestos.push({
            id: idBloque,
            fecha: fechaDia,
            inicio: minutosAHora(curInicio),
            fin: minutosAHora(curFin),
            tarea: tareaSeleccionada.id,
            titulo: tituloBloque,
            hecho: false,
            propuesto: true
          });

          tareaSeleccionada.minutosPendientes -= duracionBloque;
          curInicio = curFin + pausaMin;
        } else {
          const duracionBloque = Math.min(bloqueMaxMin, tareaSeleccionada.minutosPendientes, espacioDisponible);
          if (duracionBloque < 15) break;

          idBloque = generarId('b');
          const curFin = curInicio + duracionBloque;
          bloquesPropuestos.push({
            id: idBloque,
            fecha: fechaDia,
            inicio: minutosAHora(curInicio),
            fin: minutosAHora(curFin),
            tarea: tareaSeleccionada.id,
            titulo: '',
            hecho: false,
            propuesto: true
          });

          tareaSeleccionada.minutosPendientes -= duracionBloque;
          curInicio = curFin + pausaMin;
        }
      }
    }
  }

  // Detectar tareas que no alcanzan antes de su entrega o bloques pasados que no cupieron en el horizonte
  const ultimaFecha = sumarDias(fechaHoy, dias - 1);
  const avisos = {};
  for (const t of tareasCandidatas) {
    if (t.minutosPendientes > 0) {
      const entregaFecha = t.entregaEfectiva ? t.entregaEfectiva.split('T')[0] : null;
      const noCabeEnHorizonte = t.tieneBloquesPasados && t.colaPasados.some((pb) => !pb.idUsado || pb.minutosRestantes > 0);
      const porEntrega = t.entregaEfectiva && (entregaFecha <= ultimaFecha || t.urg.holguraH < 0);

      if (porEntrega || noCabeEnHorizonte) {
        let hFaltan = Math.round((t.minutosPendientes / 60) * 10) / 10;
        if (hFaltan <= 0) hFaltan = Math.ceil(t.minutosPendientes / 60);
        avisos[t.id] = {
          tareaId: t.id,
          horasFaltantes: hFaltan,
          texto: `No alcanza: faltan ${hFaltan} h`
        };
      }
    }
  }

  return {
    bloquesPropuestos,
    avisosNoAlcanza: avisos
  };
}

// ==========================================
// Operaciones inmutables sobre el estado
// ==========================================

export function crearTarea(datos, tareaNueva) {
  const d = clonar(datos);
  const id = tareaNueva.id || generarId('t');
  const tarea = {
    id,
    titulo: String(tareaNueva.titulo || 'Nueva tarea').trim(),
    materia: tareaNueva.materia || (d.materias[0]?.id || ''),
    padre: tareaNueva.padre || null,
    entrega: tareaNueva.entrega || '',
    duracionMin: typeof tareaNueva.duracionMin === 'number' ? tareaNueva.duracionMin : 60,
    avance: typeof tareaNueva.avance === 'number' ? tareaNueva.avance : 0,
    estado: tareaNueva.estado || 'pendiente',
    notas: tareaNueva.notas || ''
  };
  d.tareas.push(tarea);
  return d;
}

export function actualizarTarea(datos, id, cambios) {
  const d = clonar(datos);
  const idx = d.tareas.findIndex((t) => t.id === id);
  if (idx === -1) return d;

  const actual = d.tareas[idx];
  const actualizada = Object.assign({}, actual, cambios);
  // No permitir que el id cambie
  actualizada.id = actual.id;

  // Si tiene hijas, duracionMin y avance se calculan de las hijas
  const hijas = d.tareas.filter((t) => t.padre === id);
  if (hijas.length > 0) {
    delete actualizada.duracionMin;
    delete actualizada.avance;
    actualizada.duracionMin = actual.duracionMin;
    actualizada.avance = actual.avance;
  }

  d.tareas[idx] = actualizada;
  return d;
}

export function eliminarTarea(datos, id) {
  const d = clonar(datos);
  // Buscar todas las descendientes para eliminarlas en cascada
  const idsAEliminar = new Set([id]);
  let agregados = true;
  while (agregados) {
    agregados = false;
    for (const t of d.tareas) {
      if (t.padre && idsAEliminar.has(t.padre) && !idsAEliminar.has(t.id)) {
        idsAEliminar.add(t.id);
        agregados = true;
      }
    }
  }

  d.tareas = d.tareas.filter((t) => !idsAEliminar.has(t.id));

  // Desvincular bloques asociados
  d.bloques = d.bloques.map((b) => {
    if (b.tarea && idsAEliminar.has(b.tarea)) {
      return Object.assign({}, b, { tarea: null, titulo: b.titulo || 'Bloque libre' });
    }
    return b;
  });

  return d;
}

export function marcarTareaHecha(datos, id, hecha = true, ahoraIso = null) {
  const d = clonar(datos);
  const ahora = ahoraIso || `${aFechaIso()}T${aHoraIso()}`;

  const idx = d.tareas.findIndex((t) => t.id === id);
  if (idx === -1) return d;

  const tareaPrincipal = d.tareas[idx];
  const hijas = d.tareas.filter((t) => t.padre === id);
  const esMadre = hijas.length > 0;

  const tareasAfectadas = [tareaPrincipal, ...hijas];
  const setIds = new Set(tareasAfectadas.map((t) => t.id));

  if (hecha) {
    // 4. Marcar una tarea como hecha:
    // sus bloques futuros no hechos se eliminan y los pasados no hechos se marcan como hechos.
    for (const t of tareasAfectadas) {
      t.estado = 'hecha';
      t.avance = 100;
    }

    // Filtrar bloques: futuros no hechos se eliminan
    d.bloques = d.bloques.filter((b) => {
      if (!setIds.has(b.tarea)) return true;
      const bInicioIso = `${b.fecha}T${b.inicio}`;
      if (!b.hecho && bInicioIso >= ahora) {
        return false;
      }
      return true;
    });

    // Pasados no hechos se marcan como hechos
    for (const b of d.bloques) {
      if (setIds.has(b.tarea)) {
        const bInicioIso = `${b.fecha}T${b.inicio}`;
        if (!b.hecho && bInicioIso < ahora) {
          b.hecho = true;
        }
      }
    }
  } else {
    // Al desmarcarla, recalcula su avance a partir de sus bloques hechos, no se pone en 0.
    // La madre sigue funcionando igual con sus hijas.
    if (esMadre) {
      tareaPrincipal.estado = 'pendiente';
      for (const hija of hijas) {
        let minHechosHija = 0;
        for (const b of d.bloques) {
          if (b.tarea === hija.id && b.hecho) {
            minHechosHija += Math.max(0, horaAMinutos(b.fin) - horaAMinutos(b.inicio));
          }
        }
        const durHija = (typeof hija.duracionMin === 'number' && hija.duracionMin > 0) ? hija.duracionMin : 60;
        hija.avance = Math.min(100, Math.round((minHechosHija / durHija) * 100));
        hija.estado = hija.avance >= 100 ? 'hecha' : 'pendiente';
      }
      sincronizarMadre(d, tareaPrincipal.id);
      tareaPrincipal.estado = 'pendiente';
    } else {
      let minutosHechos = 0;
      for (const b of d.bloques) {
        if (b.tarea === tareaPrincipal.id && b.hecho) {
          minutosHechos += Math.max(0, horaAMinutos(b.fin) - horaAMinutos(b.inicio));
        }
      }
      const dur = (typeof tareaPrincipal.duracionMin === 'number' && tareaPrincipal.duracionMin > 0) ? tareaPrincipal.duracionMin : 60;
      tareaPrincipal.avance = Math.min(100, Math.round((minutosHechos / dur) * 100));
      tareaPrincipal.estado = 'pendiente';

      if (tareaPrincipal.padre) {
        sincronizarMadre(d, tareaPrincipal.padre);
      }
    }
  }

  // Si la tarea original tenía madre y no era madre ella misma:
  if (!esMadre && tareaPrincipal.padre) {
    sincronizarMadre(d, tareaPrincipal.padre);
  }

  return d;
}

export function crearBloque(datos, bloqueNuevo) {
  const d = clonar(datos);
  const id = bloqueNuevo.id || generarId('b');
  const bloque = {
    id,
    fecha: bloqueNuevo.fecha || '',
    inicio: bloqueNuevo.inicio || '08:00',
    fin: bloqueNuevo.fin || '09:00',
    tarea: bloqueNuevo.tarea || null,
    titulo: bloqueNuevo.titulo || '',
    hecho: Boolean(bloqueNuevo.hecho),
    propuesto: Boolean(bloqueNuevo.propuesto)
  };
  d.bloques.push(bloque);
  return d;
}

export function actualizarBloque(datos, id, cambios) {
  const d = clonar(datos);
  const idx = d.bloques.findIndex((b) => b.id === id);
  if (idx === -1) return d;
  d.bloques[idx] = Object.assign({}, d.bloques[idx], cambios, { id });
  if (cambios.hecho !== undefined) {
    return marcarBloqueHecho(d, id, cambios.hecho);
  }
  return d;
}

export function eliminarBloque(datos, id) {
  const d = clonar(datos);
  d.bloques = d.bloques.filter((b) => b.id !== id);
  return d;
}

export function marcarBloqueHecho(datos, id, hecho = true) {
  const d = clonar(datos);
  const idx = d.bloques.findIndex((b) => b.id === id);
  if (idx === -1) return d;
  d.bloques[idx].hecho = Boolean(hecho);

  const tareaId = d.bloques[idx].tarea;
  if (tareaId) {
    const tarea = d.tareas.find((t) => t.id === tareaId);
    if (tarea) {
      let minutosHechos = 0;
      for (const bloq of d.bloques) {
        if (bloq.tarea === tarea.id && bloq.hecho) {
          minutosHechos += Math.max(0, horaAMinutos(bloq.fin) - horaAMinutos(bloq.inicio));
        }
      }
      const dur = (typeof tarea.duracionMin === 'number' && tarea.duracionMin > 0) ? tarea.duracionMin : 60;
      const nuevoAvance = Math.min(100, Math.round((minutosHechos / dur) * 100));
      tarea.avance = nuevoAvance;
      if (nuevoAvance >= 100) {
        tarea.estado = 'hecha';
      } else if (tarea.estado === 'hecha') {
        tarea.estado = 'pendiente';
      }

      if (tarea.padre) {
        sincronizarMadre(d, tarea.padre);
      }
    }
  }

  return d;
}

export function crearFijo(datos, fijoNuevo) {
  const d = clonar(datos);
  const id = fijoNuevo.id || generarId('f');
  const materia = (fijoNuevo.materia !== undefined && fijoNuevo.materia !== null && fijoNuevo.materia !== '')
    ? String(fijoNuevo.materia)
    : null;
  const fijo = {
    id,
    titulo: String(fijoNuevo.titulo || 'Clase').trim(),
    materia,
    dias: Array.isArray(fijoNuevo.dias) && fijoNuevo.dias.length ? fijoNuevo.dias : [1],
    inicio: fijoNuevo.inicio || '07:00',
    fin: fijoNuevo.fin || '09:00',
    lugar: fijoNuevo.lugar || '',
    desde: fijoNuevo.desde || '',
    hasta: fijoNuevo.hasta || ''
  };
  d.fijos.push(fijo);
  return d;
}

export function actualizarFijo(datos, id, cambios) {
  const d = clonar(datos);
  const idx = d.fijos.findIndex((f) => f.id === id);
  if (idx === -1) return d;
  const materia = cambios.materia !== undefined
    ? ((cambios.materia !== null && cambios.materia !== '') ? String(cambios.materia) : null)
    : d.fijos[idx].materia;
  d.fijos[idx] = Object.assign({}, d.fijos[idx], cambios, { id, materia });
  return d;
}

export function eliminarFijo(datos, id) {
  const d = clonar(datos);
  d.fijos = d.fijos.filter((f) => f.id !== id);
  return d;
}
