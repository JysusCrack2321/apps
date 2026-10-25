// comun/modelo.js
// Lógica pura de datos para el organizador de proyectos (sin DOM).
// Funciona en navegador y Node 22. No muta los datos de entrada.

export const ESTADOS = ['pendiente', 'en curso', 'hecha', 'bloqueada'];
export const TIPOS_ACTIVIDAD = ['tarea', 'entregable'];
export const VERSION = 1;

export function esEntregable(nodoOActividad) {
  if (!nodoOActividad || typeof nodoOActividad !== 'object') return false;
  const tipo = nodoOActividad.datos ? nodoOActividad.datos.tipo : nodoOActividad.tipo;
  return tipo === 'entregable';
}

// ---------------------------------------------------------------------------
// Utilidades de fechas (texto AAAA-MM-DD, aritmética en UTC)
// ---------------------------------------------------------------------------
export function esFecha(texto) {
  if (typeof texto !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return false;
  const año = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12) return false;
  const esBisiesto = (año % 4 === 0 && año % 100 !== 0) || año % 400 === 0;
  const diasPorMes = [31, esBisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dia >= 1 && dia <= diasPorMes[mes - 1];
}

export function diasEntre(inicio, fin) {
  const [ai, mi, di] = inicio.split('-').map(Number);
  const [af, mf, df] = fin.split('-').map(Number);
  const msInicio = Date.UTC(ai, mi - 1, di);
  const msFin = Date.UTC(af, mf - 1, df);
  return Math.floor((msFin - msInicio) / 86400000) + 1;
}

export function sumarDias(fecha, n) {
  const [año, mes, dia] = fecha.split('-').map(Number);
  const ms = Date.UTC(año, mes - 1, dia) + n * 86400000;
  const d = new Date(ms);
  const añoRes = d.getUTCFullYear();
  const mesRes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const diaRes = String(d.getUTCDate()).padStart(2, '0');
  return `${añoRes}-${mesRes}-${diaRes}`;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------
function clonar(datos) {
  return structuredClone(datos);
}

function buscarActividad(datos, id) {
  return datos.actividades.find(a => a.id === id);
}

function buscarHito(datos, id) {
  return datos.hitos.find(h => h.id === id);
}

function tieneHijos(datos, id) {
  return datos.actividades.some(a => a.padre === id);
}

function obtenerHijosIdsOrdenados(datos, padreId) {
  return datos.actividades
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.padre === padreId)
    .sort((x, y) => {
      if (x.a.orden !== y.a.orden) return x.a.orden - y.a.orden;
      return x.i - y.i;
    })
    .map(({ a }) => a.id);
}

function establecerOrden(datos, padreId, listaIds) {
  listaIds.forEach((id, idx) => {
    const a = buscarActividad(datos, id);
    if (a) a.orden = idx + 1;
  });
}

function esDescendiente(datos, ancestroId, id) {
  if (ancestroId === id) return true;
  for (const a of datos.actividades) {
    if (a.padre === ancestroId) {
      if (esDescendiente(datos, a.id, id)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Crear proyectos
// ---------------------------------------------------------------------------
export function proyectoVacio(nombre, equipo = []) {
  const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
  if (!nombreLimpio) throw new Error('El nombre del proyecto no puede estar vacío.');
  if (nombreLimpio.length > 120) throw new Error('El nombre del proyecto supera 120 caracteres.');

  const equipoLimpio = [];
  const vistos = new Set();
  for (const nombreEquipo of equipo) {
    if (typeof nombreEquipo === 'string') {
      const limpio = nombreEquipo.trim();
      if (limpio && !vistos.has(limpio)) {
        vistos.add(limpio);
        equipoLimpio.push(limpio);
      }
    }
  }

  const datos = {
    version: 1,
    proyecto: { nombre: nombreLimpio, descripcion: '' },
    equipo: equipoLimpio,
    actividades: [],
    hitos: []
  };

  const validacion = validar(datos);
  if (!validacion.ok) throw new Error(validacion.errores.join(' | '));
  return datos;
}

export function proyectoDesdePlantilla(nombre, equipo, plantilla) {
  if (!['vacia', 'basica'].includes(plantilla)) {
    throw new Error(`Plantilla desconocida '${plantilla}'.`);
  }

  let datos = proyectoVacio(nombre, equipo);

  if (plantilla === 'basica') {
    for (const nombreActividad of ['Planeación', 'Ejecución', 'Pruebas', 'Cierre']) {
      const resultado = agregarActividad(datos, { padre: null, nombre: nombreActividad });
      datos = resultado.datos;
    }
  }

  return datos;
}

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------
export function validar(datos) {
  if (typeof datos !== 'object' || datos === null || Array.isArray(datos)) {
    return { ok: false, errores: ['Los datos deben ser un objeto.'] };
  }

  const errores = [];

  // Versión
  if (datos.version !== 1) {
    errores.push(`Versión desconocida: ${String(datos.version)}.`);
  }

  // Proyecto
  if (typeof datos.proyecto !== 'object' || datos.proyecto === null) {
    errores.push('Proyecto: falta el objeto proyecto.');
  } else {
    const nombre = datos.proyecto.nombre;
    if (typeof nombre !== 'string' || nombre.trim() === '') {
      errores.push('Proyecto: nombre vacío.');
    } else if (nombre.trim().length > 120) {
      errores.push('Proyecto: nombre supera 120 caracteres.');
    }
    if (datos.proyecto.descripcion !== undefined && typeof datos.proyecto.descripcion !== 'string') {
      errores.push('Proyecto: descripcion debe ser texto.');
    }
  }

  // Equipo
  if (!Array.isArray(datos.equipo)) {
    errores.push('Equipo: debe ser una lista.');
  } else {
    const vistos = new Set();
    for (const nombre of datos.equipo) {
      if (typeof nombre !== 'string' || nombre.trim() === '') {
        errores.push('Equipo: nombre vacío.');
      } else {
        const limpio = nombre.trim();
        if (vistos.has(limpio)) {
          errores.push(`Equipo: nombre repetido '${limpio}'.`);
        } else {
          vistos.add(limpio);
        }
      }
    }
  }

  const equipo = Array.isArray(datos.equipo)
    ? datos.equipo.map(n => (typeof n === 'string' ? n.trim() : n))
    : [];
  const setEquipo = new Set(equipo.filter(n => typeof n === 'string' && n !== ''));

  if (!Array.isArray(datos.actividades)) {
    errores.push('Actividades: debe ser una lista.');
  }
  if (!Array.isArray(datos.hitos)) {
    errores.push('Hitos: debe ser una lista.');
  }

  const actividades = Array.isArray(datos.actividades) ? datos.actividades : [];
  const hitos = Array.isArray(datos.hitos) ? datos.hitos : [];

  // Ids únicos
  const ids = new Map();
  for (const a of actividades) {
    if (!a || typeof a !== 'object') {
      errores.push('Actividad: elemento inválido.');
      continue;
    }
    const id = a.id;
    if (typeof id !== 'string' || id === '') {
      errores.push('Actividad: id vacío.');
    } else if (ids.has(id)) {
      errores.push(`Id '${id}' repetido.`);
    } else {
      ids.set(id, 'actividad');
    }
  }
  for (const h of hitos) {
    if (!h || typeof h !== 'object') {
      errores.push('Hito: elemento inválido.');
      continue;
    }
    const id = h.id;
    if (typeof id !== 'string' || id === '') {
      errores.push('Hito: id vacío.');
    } else if (ids.has(id)) {
      errores.push(`Id '${id}' repetido.`);
    } else {
      ids.set(id, 'hito');
    }
  }

  const idActividades = new Set(
    actividades
      .filter(a => a && typeof a.id === 'string' && a.id !== '')
      .map(a => a.id)
  );

  // Validar actividades
  for (const a of actividades) {
    if (!a || typeof a !== 'object') continue;
    const ctx = `Actividad '${a.id}'`;

    if (typeof a.nombre !== 'string' || a.nombre.trim() === '') {
      errores.push(`${ctx}: nombre vacío.`);
    } else if (a.nombre.trim().length > 200) {
      errores.push(`${ctx}: nombre supera 200 caracteres.`);
    }

    if (typeof a.orden !== 'number' || Number.isNaN(a.orden)) {
      errores.push(`${ctx}: orden debe ser un número.`);
    }

    // Padre
    if (a.padre !== null && typeof a.padre !== 'string') {
      errores.push(`${ctx}: padre inválido.`);
    } else if (typeof a.padre === 'string') {
      if (!idActividades.has(a.padre)) {
        errores.push(`${ctx}: padre '${a.padre}' no existe.`);
      }
    }

    // Responsable
    if (a.responsable !== undefined && a.responsable !== null && a.responsable !== '') {
      if (typeof a.responsable !== 'string') {
        errores.push(`${ctx}: responsable inválido.`);
      } else if (!setEquipo.has(a.responsable)) {
        errores.push(`${ctx}: responsable '${a.responsable}' no está en el equipo.`);
      }
    }

    // Inicio / fin
    const tieneInicio = a.inicio !== undefined && a.inicio !== null && a.inicio !== '';
    const tieneFin = a.fin !== undefined && a.fin !== null && a.fin !== '';
    if (tieneInicio !== tieneFin) {
      errores.push(`${ctx}: debe tener inicio y fin juntos.`);
    } else if (tieneInicio && tieneFin) {
      if (!esFecha(a.inicio)) errores.push(`${ctx}: inicio '${a.inicio}' no es una fecha válida.`);
      if (!esFecha(a.fin)) errores.push(`${ctx}: fin '${a.fin}' no es una fecha válida.`);
      if (esFecha(a.inicio) && esFecha(a.fin) && a.fin < a.inicio) {
        errores.push(`${ctx}: fin (${a.fin}) es anterior a inicio (${a.inicio}).`);
      }
    }

    // Estado
    if (a.estado !== undefined && a.estado !== null && a.estado !== '') {
      if (!ESTADOS.includes(a.estado)) {
        errores.push(`${ctx}: estado inválido ('${a.estado}').`);
      }
    }

    // Tipo (opcional: 'tarea' | 'entregable')
    if (a.tipo !== undefined && a.tipo !== null && a.tipo !== '') {
      if (!TIPOS_ACTIVIDAD.includes(a.tipo)) {
        errores.push(`${ctx}: tipo inválido ('${a.tipo}').`);
      }
    }

    // Notas
    if (a.notas !== undefined && a.notas !== null && typeof a.notas !== 'string') {
      errores.push(`${ctx}: notas debe ser texto.`);
    }
  }

  // Comprobar que fechas, estado y tipo entregable solo están en hojas
  const padresIds = new Set();
  for (const a of actividades) {
    if (a && typeof a === 'object' && typeof a.padre === 'string') {
      padresIds.add(a.padre);
    }
  }
  for (const a of actividades) {
    if (!a || typeof a !== 'object') continue;
    const ctx = `Actividad '${a.id}'`;
    const esPadre = padresIds.has(a.id);

    if (esPadre) {
      if (a.inicio !== undefined && a.inicio !== null) {
        errores.push(`${ctx}: las fechas solo se permiten en hojas.`);
      } else if (a.fin !== undefined && a.fin !== null) {
        errores.push(`${ctx}: las fechas solo se permiten en hojas.`);
      } else if (a.estado !== undefined && a.estado !== null) {
        errores.push(`${ctx}: el estado solo se permite en hojas.`);
      } else if (a.tipo !== undefined && a.tipo !== null) {
        errores.push(`${ctx}: el tipo solo se permite en hojas.`);
      }
    }
  }

  // Detectar ciclos
  const estadoVisitados = new Map();
  function dfs(id) {
    if (estadoVisitados.get(id) === 1) return true;
    if (estadoVisitados.get(id) === 2) return false;
    estadoVisitados.set(id, 1);
    const a = actividades.find(x => x && x.id === id);
    if (a && typeof a.padre === 'string') {
      if (dfs(a.padre)) return true;
    }
    estadoVisitados.set(id, 2);
    return false;
  }
  for (const a of actividades) {
    if (a && a.id && dfs(a.id)) {
      errores.push(`Actividad '${a.id}': ciclo detectado en la jerarquía.`);
      break;
    }
  }

  // Validar hitos
  for (const h of hitos) {
    if (!h || typeof h !== 'object') continue;
    const ctx = `Hito '${h.id}'`;

    if (typeof h.nombre !== 'string' || h.nombre.trim() === '') {
      errores.push(`${ctx}: nombre vacío.`);
    } else if (h.nombre.trim().length > 200) {
      errores.push(`${ctx}: nombre supera 200 caracteres.`);
    }

    const tieneInicio = h.inicio !== undefined && h.inicio !== null && h.inicio !== '';
    const tieneFin = h.fin !== undefined && h.fin !== null && h.fin !== '';
    if (!tieneInicio || !tieneFin) {
      errores.push(`${ctx}: inicio y fin son obligatorios.`);
    } else {
      if (!esFecha(h.inicio)) errores.push(`${ctx}: inicio '${h.inicio}' no es una fecha válida.`);
      if (!esFecha(h.fin)) errores.push(`${ctx}: fin '${h.fin}' no es una fecha válida.`);
      if (esFecha(h.inicio) && esFecha(h.fin) && h.fin < h.inicio) {
        errores.push(`${ctx}: fin (${h.fin}) es anterior a inicio (${h.inicio}).`);
      }
    }

    if (h.responsable !== undefined && h.responsable !== null && h.responsable !== '') {
      if (typeof h.responsable !== 'string') {
        errores.push(`${ctx}: responsable inválido.`);
      } else if (!setEquipo.has(h.responsable)) {
        errores.push(`${ctx}: responsable '${h.responsable}' no está en el equipo.`);
      }
    }
  }

  return { ok: errores.length === 0, errores };
}

// ---------------------------------------------------------------------------
// Construir modelo calculado
// ---------------------------------------------------------------------------
export function construir(datos) {
  const proyecto = structuredClone(datos.proyecto);
  const equipo = [...datos.equipo];
  const hitos = structuredClone(datos.hitos);

  const nodos = new Map();
  const porId = new Map();
  const lista = [];
  const hojas = [];

  const raiz = {
    id: null,
    padre: null,
    nombre: proyecto.nombre,
    codigo: '',
    nivel: 0,
    hijos: [],
    esHoja: false,
    responsable: '',
    estado: 'pendiente',
    notas: '',
    inicio: undefined,
    fin: undefined,
    avance: 0,
    datos: null
  };
  nodos.set(null, raiz);

  const indiceOriginal = new Map();
  datos.actividades.forEach((a, i) => {
    indiceOriginal.set(a.id, i);
    const nodo = {
      id: a.id,
      padre: a.padre,
      nombre: a.nombre,
      codigo: '',
      nivel: 0,
      hijos: [],
      esHoja: false,
      responsable: a.responsable || '',
      estado: a.estado || 'pendiente',
      notas: a.notas || '',
      inicio: a.inicio || undefined,
      fin: a.fin || undefined,
      avance: 0,
      datos: a
    };
    nodos.set(a.id, nodo);
    porId.set(a.id, nodo);
  });

  // Enlazar hijos
  for (const a of datos.actividades) {
    const nodo = nodos.get(a.id);
    const padre = nodos.get(a.padre);
    if (padre) {
      padre.hijos.push(nodo);
    }
  }

  // Ordenar hermanos por orden, con desempate estable por posición original
  for (const nodo of nodos.values()) {
    nodo.hijos.sort((x, y) => {
      const ox = x.datos.orden;
      const oy = y.datos.orden;
      if (ox !== oy) return ox - oy;
      return indiceOriginal.get(x.id) - indiceOriginal.get(y.id);
    });
  }

  // Asignar nivel, código, lista y hojas en preorden
  function recorrer(nodo, codigoPadre, nivel) {
    nodo.nivel = nivel;
    nodo.codigo = codigoPadre;
    nodo.esHoja = nodo.hijos.length === 0;
    lista.push(nodo);
    if (nodo.esHoja) hojas.push(nodo);
    nodo.hijos.forEach((hijo, i) => {
      const codigo = codigoPadre ? `${codigoPadre}.${i + 1}` : `${i + 1}`;
      recorrer(hijo, codigo, nivel + 1);
    });
  }

  raiz.esHoja = raiz.hijos.length === 0;
  raiz.hijos.forEach((hijo, i) => {
    const codigo = `${i + 1}`;
    recorrer(hijo, codigo, 1);
  });

  // Avance (0–1)
  function calcularAvance(nodo) {
    if (nodo.esHoja) {
      nodo.avance = nodo.estado === 'hecha' ? 1 : 0;
      return { suma: nodo.avance, total: 1 };
    } else {
      let suma = 0;
      let total = 0;
      for (const hijo of nodo.hijos) {
        const r = calcularAvance(hijo);
        suma += r.suma;
        total += r.total;
      }
      nodo.avance = total ? suma / total : 0;
      return { suma, total };
    }
  }

  // Fechas de padres (mín/máx de hojas descendientes con fechas)
  function calcularFechas(nodo) {
    if (nodo.esHoja) return;
    let inicio;
    let fin;
    for (const hijo of nodo.hijos) {
      calcularFechas(hijo);
      if (hijo.inicio && hijo.fin) {
        if (!inicio || hijo.inicio < inicio) inicio = hijo.inicio;
        if (!fin || hijo.fin > fin) fin = hijo.fin;
      }
    }
    nodo.inicio = inicio;
    nodo.fin = fin;
  }

  calcularAvance(raiz);
  calcularFechas(raiz);

  // Rango del proyecto (hojas con fechas + hitos)
  let rango = null;
  const fechas = [];
  for (const nodo of hojas) {
    if (nodo.inicio && nodo.fin) {
      fechas.push({ inicio: nodo.inicio, fin: nodo.fin });
    }
  }
  for (const h of hitos) {
    fechas.push({ inicio: h.inicio, fin: h.fin });
  }
  if (fechas.length > 0) {
    let inicioMin = fechas[0].inicio;
    let finMax = fechas[0].fin;
    for (const f of fechas) {
      if (f.inicio < inicioMin) inicioMin = f.inicio;
      if (f.fin > finMax) finMax = f.fin;
    }
    rango = { inicio: inicioMin, fin: finMax };
  }

  return {
    proyecto,
    equipo,
    hitos,
    raiz,
    porId,
    lista,
    hojas,
    rango
  };
}

// ---------------------------------------------------------------------------
// Utilidades de edición
// ---------------------------------------------------------------------------
export function nuevoId(datos) {
  const existentes = new Set([
    ...(datos.actividades || []).map(a => a.id),
    ...(datos.hitos || []).map(h => h.id)
  ]);
  const caracteres = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let longitud = 4;

  for (let intento = 0; intento < 20; intento++) {
    let id = '';
    for (let i = 0; i < longitud; i++) {
      id += caracteres[Math.floor(Math.random() * caracteres.length)];
    }
    if (!existentes.has(id)) return id;
    if (intento === 9) longitud = 6;
  }

  // Fallback de 6 caracteres
  while (true) {
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += caracteres[Math.floor(Math.random() * caracteres.length)];
    }
    if (!existentes.has(id)) return id;
  }
}

export function agregarActividad(datos, { padre, nombre, despuesDe, tipo, inicio, fin, responsable, estado, notas }) {
  const copia = clonar(datos);

  const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
  if (!nombreLimpio) throw new Error('El nombre de la actividad no puede estar vacío.');
  if (nombreLimpio.length > 200) throw new Error('El nombre de la actividad supera 200 caracteres.');

  let padreId = padre;
  if (padreId !== null && padreId !== undefined) {
    if (typeof padreId !== 'string') throw new Error('El padre debe ser un id o null.');
    if (!buscarActividad(copia, padreId)) {
      throw new Error(`La actividad padre '${padreId}' no existe.`);
    }
  } else {
    padreId = null;
  }

  if (despuesDe !== undefined && despuesDe !== null) {
    const hermano = buscarActividad(copia, despuesDe);
    if (!hermano || hermano.padre !== padreId) {
      throw new Error(`La actividad '${despuesDe}' no es un hermano válido.`);
    }
  }

  // Si el padre era hoja, al recibir un hijo deja de ser hoja: limpiar fechas/estado/tipo
  const padreAct = padreId ? buscarActividad(copia, padreId) : null;
  if (padreAct && !tieneHijos(copia, padreId)) {
    delete padreAct.inicio;
    delete padreAct.fin;
    delete padreAct.estado;
    delete padreAct.tipo;
  }

  const hermanos = obtenerHijosIdsOrdenados(copia, padreId);
  let insertarEn;
  if (despuesDe) {
    const idx = hermanos.findIndex(id => id === despuesDe);
    insertarEn = idx + 1;
  } else {
    insertarEn = hermanos.length;
  }

  const id = nuevoId(copia);
  const nueva = {
    id,
    padre: padreId,
    orden: 0,
    nombre: nombreLimpio
  };
  if (tipo === 'entregable') nueva.tipo = 'entregable';
  if (inicio && fin) {
    nueva.inicio = inicio;
    nueva.fin = fin;
  }
  if (responsable) nueva.responsable = responsable;
  if (estado) nueva.estado = estado;
  if (notas) nueva.notas = notas;
  copia.actividades.push(nueva);

  hermanos.splice(insertarEn, 0, id);
  establecerOrden(copia, padreId, hermanos);

  const validacion = validar(copia);
  if (!validacion.ok) throw new Error(validacion.errores.join(' | '));
  return { datos: copia, id };
}

export function editarActividad(datos, id, cambios) {
  const copia = clonar(datos);
  const actividad = buscarActividad(copia, id);
  if (!actividad) throw new Error(`La actividad '${id}' no existe.`);

  const esPadre = tieneHijos(copia, id);

  if (cambios.nombre !== undefined) {
    if (typeof cambios.nombre !== 'string') throw new Error('El nombre debe ser texto.');
    const nombreLimpio = cambios.nombre.trim();
    if (!nombreLimpio) throw new Error('El nombre de la actividad no puede estar vacío.');
    if (nombreLimpio.length > 200) throw new Error('El nombre de la actividad supera 200 caracteres.');
    actividad.nombre = nombreLimpio;
  }

  if (cambios.responsable !== undefined) {
    const responsable = cambios.responsable;
    if (responsable === '' || responsable === null) {
      delete actividad.responsable;
    } else {
      const responsableLimpio = typeof responsable === 'string' ? responsable.trim() : responsable;
      if (!responsableLimpio || !copia.equipo.includes(responsableLimpio)) {
        throw new Error(`El responsable '${responsable}' no está en el equipo.`);
      }
      actividad.responsable = responsableLimpio;
    }
  }

  if (cambios.inicio !== undefined || cambios.fin !== undefined) {
    if (esPadre) {
      throw new Error('No se pueden asignar fechas a una actividad con hijos.');
    }
    if (cambios.inicio === '' || cambios.inicio === null || cambios.fin === '' || cambios.fin === null) {
      delete actividad.inicio;
      delete actividad.fin;
    } else {
      const inicio = cambios.inicio !== undefined ? cambios.inicio : actividad.inicio;
      const fin = cambios.fin !== undefined ? cambios.fin : actividad.fin;
      if (!inicio || !fin) {
        throw new Error('Debe establecer inicio y fin juntos.');
      }
      if (!esFecha(inicio)) throw new Error(`La fecha de inicio '${inicio}' no es válida.`);
      if (!esFecha(fin)) throw new Error(`La fecha de fin '${fin}' no es válida.`);
      if (fin < inicio) throw new Error(`El fin (${fin}) es anterior al inicio (${inicio}).`);
      actividad.inicio = inicio;
      actividad.fin = fin;
    }
  }

  if (cambios.estado !== undefined) {
    if (esPadre) {
      throw new Error('No se puede asignar estado a una actividad con hijos.');
    }
    const estado = cambios.estado;
    if (estado === '' || estado === null) {
      delete actividad.estado;
    } else {
      if (!ESTADOS.includes(estado)) {
        throw new Error(`Estado inválido: '${estado}'.`);
      }
      actividad.estado = estado;
    }
  }

  if (cambios.tipo !== undefined) {
    if (esPadre) {
      throw new Error('No se puede asignar tipo a una actividad con hijos.');
    }
    const tipo = cambios.tipo;
    if (tipo === '' || tipo === null || tipo === 'tarea') {
      delete actividad.tipo;
    } else if (tipo === 'entregable') {
      actividad.tipo = 'entregable';
    } else {
      throw new Error(`Tipo inválido: '${tipo}'.`);
    }
  }

  if (cambios.notas !== undefined) {
    if (cambios.notas === '' || cambios.notas === null) {
      delete actividad.notas;
    } else {
      if (typeof cambios.notas !== 'string') throw new Error('Las notas deben ser texto.');
      actividad.notas = cambios.notas;
    }
  }

  const validacion = validar(copia);
  if (!validacion.ok) throw new Error(validacion.errores.join(' | '));
  return copia;
}

export function moverActividad(datos, id, nuevoPadre, posicion) {
  const copia = clonar(datos);
  const actividad = buscarActividad(copia, id);
  if (!actividad) throw new Error(`La actividad '${id}' no existe.`);

  let nuevoPadreId = nuevoPadre;
  if (nuevoPadreId !== null && nuevoPadreId !== undefined) {
    if (typeof nuevoPadreId !== 'string') throw new Error('El padre debe ser un id o null.');
    if (!buscarActividad(copia, nuevoPadreId)) {
      throw new Error(`La actividad padre '${nuevoPadreId}' no existe.`);
    }
  } else {
    nuevoPadreId = null;
  }

  if (nuevoPadreId === id) {
    throw new Error('No se puede mover una actividad bajo sí misma.');
  }
  if (nuevoPadreId !== null && esDescendiente(copia, id, nuevoPadreId)) {
    throw new Error('No se puede mover una actividad bajo un descendiente (ciclo).');
  }

  const padreOriginal = actividad.padre;

  // Si el nuevo padre era hoja, al recibir un hijo debe limpiar fechas/estado/tipo
  if (nuevoPadreId !== null) {
    const nuevoPadreAct = buscarActividad(copia, nuevoPadreId);
    if (nuevoPadreAct && !tieneHijos(copia, nuevoPadreId)) {
      delete nuevoPadreAct.inicio;
      delete nuevoPadreAct.fin;
      delete nuevoPadreAct.estado;
      delete nuevoPadreAct.tipo;
    }
  }

  // Reordenar padre original sin la actividad
  if (padreOriginal !== null) {
    const hermanosOriginales = obtenerHijosIdsOrdenados(copia, padreOriginal).filter(x => x !== id);
    establecerOrden(copia, padreOriginal, hermanosOriginales);
  } else {
    const hermanosOriginales = obtenerHijosIdsOrdenados(copia, null).filter(x => x !== id);
    establecerOrden(copia, null, hermanosOriginales);
  }

  // Cambiar padre
  actividad.padre = nuevoPadreId;

  // Insertar en nueva posición
  const hermanosNuevos = obtenerHijosIdsOrdenados(copia, nuevoPadreId).filter(x => x !== id);
  let insertarEn;
  if (posicion === undefined || posicion === null || !Number.isInteger(posicion)) {
    insertarEn = hermanosNuevos.length;
  } else {
    insertarEn = Math.max(0, Math.min(posicion, hermanosNuevos.length));
  }
  hermanosNuevos.splice(insertarEn, 0, id);
  establecerOrden(copia, nuevoPadreId, hermanosNuevos);

  const validacion = validar(copia);
  if (!validacion.ok) throw new Error(validacion.errores.join(' | '));
  return copia;
}

export function subir(datos, id) {
  const copia = clonar(datos);
  const actividad = buscarActividad(copia, id);
  if (!actividad) throw new Error(`La actividad '${id}' no existe.`);

  const padreId = actividad.padre;
  const hermanos = obtenerHijosIdsOrdenados(copia, padreId);
  const idx = hermanos.indexOf(id);

  if (idx <= 0) {
    const validacion = validar(copia);
    if (!validacion.ok) throw new Error(validacion.errores.join(' | '));
    return copia;
  }

  [hermanos[idx - 1], hermanos[idx]] = [hermanos[idx], hermanos[idx - 1]];
  establecerOrden(copia, padreId, hermanos);

  const validacion = validar(copia);
  if (!validacion.ok) throw new Error(validacion.errores.join(' | '));
  return copia;
}

export function bajar(datos, id) {
  const copia = clonar(datos);
  const actividad = buscarActividad(copia, id);
  if (!actividad) throw new Error(`La actividad '${id}' no existe.`);

  const padreId = actividad.padre;
  const hermanos = obtenerHijosIdsOrdenados(copia, padreId);
  const idx = hermanos.indexOf(id);

  if (idx >= hermanos.length - 1) {
    const validacion = validar(copia);
    if (!validacion.ok) throw new Error(validacion.errores.join(' | '));
    return copia;
  }

  [hermanos[idx + 1], hermanos[idx]] = [hermanos[idx], hermanos[idx + 1]];
  establecerOrden(copia, padreId, hermanos);

  const validacion = validar(copia);
  if (!validacion.ok) throw new Error(validacion.errores.join(' | '));
  return copia;
}

export function eliminarActividad(datos, id) {
  const copia = clonar(datos);
  const actividad = buscarActividad(copia, id);
  if (!actividad) throw new Error(`La actividad '${id}' no existe.`);

  const idsEliminar = new Set();
  function recolectar(pid) {
    for (const a of copia.actividades) {
      if (a.padre === pid) {
        idsEliminar.add(a.id);
        recolectar(a.id);
      }
    }
  }
  idsEliminar.add(id);
  recolectar(id);

  const padreOriginal = actividad.padre;
  copia.actividades = copia.actividades.filter(a => !idsEliminar.has(a.id));

  if (padreOriginal !== null) {
    const hermanosRestantes = obtenerHijosIdsOrdenados(copia, padreOriginal);
    establecerOrden(copia, padreOriginal, hermanosRestantes);
  } else {
    const hermanosRestantes = obtenerHijosIdsOrdenados(copia, null);
    establecerOrden(copia, null, hermanosRestantes);
  }

  const validacion = validar(copia);
  if (!validacion.ok) throw new Error(validacion.errores.join(' | '));
  return copia;
}

export function contarDescendientes(datos, id) {
  if (!buscarActividad(datos, id)) {
    throw new Error(`La actividad '${id}' no existe.`);
  }

  function rec(pid) {
    let total = 0;
    for (const a of datos.actividades) {
      if (a.padre === pid) {
        total += 1 + rec(a.id);
      }
    }
    return total;
  }
  return rec(id);
}

export function agregarHito(datos, { nombre, inicio, fin, responsable }) {
  const copia = clonar(datos);

  const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
  if (!nombreLimpio) throw new Error('El nombre del hito no puede estar vacío.');
  if (nombreLimpio.length > 200) throw new Error('El nombre del hito supera 200 caracteres.');

  if (!esFecha(inicio)) throw new Error(`La fecha de inicio '${inicio}' no es válida.`);
  if (!esFecha(fin)) throw new Error(`La fecha de fin '${fin}' no es válida.`);
  if (fin < inicio) throw new Error(`El fin (${fin}) es anterior al inicio (${inicio}).`);

  const responsableLimpio = typeof responsable === 'string' ? responsable.trim() : '';
  if (responsableLimpio && !copia.equipo.includes(responsableLimpio)) {
    throw new Error(`El responsable '${responsableLimpio}' no está en el equipo.`);
  }

  const id = nuevoId(copia);
  copia.hitos.push({
    id,
    nombre: nombreLimpio,
    inicio,
    fin,
    responsable: responsableLimpio
  });

  const validacion = validar(copia);
  if (!validacion.ok) throw new Error(validacion.errores.join(' | '));
  return { datos: copia, id };
}

export function editarHito(datos, id, cambios) {
  const copia = clonar(datos);
  const hito = buscarHito(copia, id);
  if (!hito) throw new Error(`El hito '${id}' no existe.`);

  if (cambios.nombre !== undefined) {
    if (typeof cambios.nombre !== 'string') throw new Error('El nombre debe ser texto.');
    const nombreLimpio = cambios.nombre.trim();
    if (!nombreLimpio) throw new Error('El nombre del hito no puede estar vacío.');
    if (nombreLimpio.length > 200) throw new Error('El nombre del hito supera 200 caracteres.');
    hito.nombre = nombreLimpio;
  }

  if (cambios.inicio !== undefined || cambios.fin !== undefined) {
    const inicio = cambios.inicio !== undefined ? cambios.inicio : hito.inicio;
    const fin = cambios.fin !== undefined ? cambios.fin : hito.fin;
    if (!inicio || !fin) throw new Error('El hito debe tener inicio y fin.');
    if (!esFecha(inicio)) throw new Error(`La fecha de inicio '${inicio}' no es válida.`);
    if (!esFecha(fin)) throw new Error(`La fecha de fin '${fin}' no es válida.`);
    if (fin < inicio) throw new Error(`El fin (${fin}) es anterior al inicio (${inicio}).`);
    hito.inicio = inicio;
    hito.fin = fin;
  }

  if (cambios.responsable !== undefined) {
    const responsableLimpio =
      cambios.responsable === null || cambios.responsable === ''
        ? ''
        : cambios.responsable.trim();
    if (responsableLimpio && !copia.equipo.includes(responsableLimpio)) {
      throw new Error(`El responsable '${responsableLimpio}' no está en el equipo.`);
    }
    hito.responsable = responsableLimpio;
  }

  const validacion = validar(copia);
  if (!validacion.ok) throw new Error(validacion.errores.join(' | '));
  return copia;
}

export function eliminarHito(datos, id) {
  const copia = clonar(datos);
  if (!buscarHito(copia, id)) {
    throw new Error(`El hito '${id}' no existe.`);
  }

  copia.hitos = copia.hitos.filter(h => h.id !== id);

  const validacion = validar(copia);
  if (!validacion.ok) throw new Error(validacion.errores.join(' | '));
  return copia;
}

export function editarProyecto(datos, { nombre, descripcion }) {
  const copia = clonar(datos);

  if (nombre !== undefined) {
    if (typeof nombre !== 'string') throw new Error('El nombre debe ser texto.');
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) throw new Error('El nombre del proyecto no puede estar vacío.');
    if (nombreLimpio.length > 120) throw new Error('El nombre del proyecto supera 120 caracteres.');
    copia.proyecto.nombre = nombreLimpio;
  }

  if (descripcion !== undefined) {
    if (typeof descripcion !== 'string') throw new Error('La descripción debe ser texto.');
    copia.proyecto.descripcion = descripcion;
  }

  const validacion = validar(copia);
  if (!validacion.ok) throw new Error(validacion.errores.join(' | '));
  return copia;
}

export function editarEquipo(datos, equipo) {
  const copia = clonar(datos);

  if (!Array.isArray(equipo)) throw new Error('El equipo debe ser una lista.');

  const limpios = [];
  const vistos = new Set();
  for (const nombre of equipo) {
    if (typeof nombre !== 'string' || nombre.trim() === '') {
      throw new Error('El equipo no puede tener nombres vacíos.');
    }
    const limpio = nombre.trim();
    if (vistos.has(limpio)) {
      throw new Error(`El equipo no puede tener nombres repetidos ('${limpio}').`);
    }
    vistos.add(limpio);
    limpios.push(limpio);
  }

  copia.equipo = limpios;
  const setEquipo = new Set(limpios);

  for (const a of copia.actividades) {
    if (a.responsable && !setEquipo.has(a.responsable)) {
      a.responsable = '';
    }
  }
  for (const h of copia.hitos) {
    if (h.responsable && !setEquipo.has(h.responsable)) {
      h.responsable = '';
    }
  }

  const validacion = validar(copia);
  if (!validacion.ok) throw new Error(validacion.errores.join(' | '));
  return copia;
}

/**
 * Actualiza el equipo desde una lista editada en la interfaz.
 * filas: [{ antes, ahora }] — `antes` es el nombre original (null si es una persona nueva) y `ahora` el nombre final.
 * Renombrar conserva las asignaciones; las personas que ya no están quedan como "sin asignar".
 */
export function actualizarEquipo(datos, filas) {
  if (!Array.isArray(filas)) throw new Error('El equipo debe ser una lista.');
  const copia = clonar(datos);
  const renombres = new Map();
  const equipo = [];
  for (const { antes, ahora } of filas) {
    const nombre = (ahora || '').trim();
    if (!nombre) continue;                       // filas vacías se ignoran
    equipo.push(nombre);
    if (antes && antes !== nombre) renombres.set(antes, nombre);
  }
  for (const item of [...copia.actividades, ...copia.hitos]) {
    if (item.responsable && renombres.has(item.responsable)) item.responsable = renombres.get(item.responsable);
  }
  return editarEquipo(copia, equipo);           // valida repetidos y limpia a quienes salieron
}

/**
 * Compara dos ETags para determinar si un evento SSE corresponde al último guardado propio.
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
 * Filtra un modelo construido de forma pura por responsable, estado y texto.
 * Conserva todos los ancestros de los nodos que coinciden y no recalcula
 * códigos, avances ni fechas.
 *
 * @param {object} modelo - Modelo devuelto por construir(datos)
 * @param {object} [filtros] - { responsable, estado, texto }
 * @returns {object} Nuevo modelo filtrado
 */
export function filtrarModelo(modelo, filtros = {}) {
  if (!modelo) return null;
  const f = filtros || {};
  const resp = (f.responsable && f.responsable !== 'todos') ? String(f.responsable).trim() : '';
  const estRaw = (f.estado && f.estado !== 'todos') ? String(f.estado).trim() : '';
  const mapaEstado = {
    en_progreso: 'en curso',
    'en-curso': 'en curso',
    completada: 'hecha',
    cancelada: 'bloqueada',
  };
  const est = mapaEstado[estRaw] || estRaw;
  const tipoFiltro = (f.tipo && f.tipo !== 'todos') ? String(f.tipo).trim() : '';
  const fechaFiltro = f.fecha ? String(f.fecha).trim() : '';
  const modoFecha = f.modoFecha === 'activa' ? 'activa' : 'fin';
  const q = f.texto ? String(f.texto).trim().toLowerCase() : '';
  const hayFiltro = Boolean(resp || est || tipoFiltro || fechaFiltro || q);

  function coincideDirecto(nodo) {
    if (!hayFiltro) return true;
    if (fechaFiltro) {
      if (!nodo.esHoja) return false;
      if (modoFecha === 'activa') {
        const activa = (nodo.inicio && nodo.fin && nodo.inicio <= fechaFiltro && nodo.fin >= fechaFiltro) ||
          nodo.inicio === fechaFiltro ||
          nodo.fin === fechaFiltro;
        if (!activa) return false;
      } else {
        const terminaEseDia = nodo.fin === fechaFiltro || (!nodo.fin && nodo.inicio === fechaFiltro);
        if (!terminaEseDia) return false;
      }
    }
    if (tipoFiltro) {
      if (!nodo.esHoja) return false;
      const tipoReal = esEntregable(nodo) ? 'entregable' : 'tarea';
      if (tipoReal !== tipoFiltro) return false;
    }
    if (resp) {
      if (resp === '__sin_asignar__') {
        if (nodo.responsable) return false;
      } else if ((nodo.responsable || '') !== resp) {
        return false;
      }
    }
    if (est) {
      if (!nodo.esHoja) return false;
      const estadoReal = mapaEstado[nodo.estado] || nodo.estado;
      if (estadoReal !== est) return false;
    }
    if (q) {
      const textoNodo = `${nodo.codigo || ''} ${nodo.nombre || ''} ${nodo.responsable || ''} ${nodo.notas || ''}`.toLowerCase();
      if (!textoNodo.includes(q)) return false;
    }
    return true;
  }

  function clonarSubarbolFiltrado(nodoOriginal) {
    const hijosFiltrados = [];
    for (const hijo of (nodoOriginal.hijos || [])) {
      const hijoClon = clonarSubarbolFiltrado(hijo);
      if (hijoClon) {
        hijosFiltrados.push(hijoClon);
      }
    }

    const esRaiz = nodoOriginal.id === null;
    const conservar = esRaiz || coincideDirecto(nodoOriginal) || hijosFiltrados.length > 0;
    if (!conservar) return null;

    return {
      id: nodoOriginal.id,
      padre: nodoOriginal.padre,
      nombre: nodoOriginal.nombre,
      codigo: nodoOriginal.codigo,
      nivel: nodoOriginal.nivel,
      hijos: hijosFiltrados,
      esHoja: nodoOriginal.esHoja,
      responsable: nodoOriginal.responsable,
      estado: nodoOriginal.estado,
      notas: nodoOriginal.notas,
      inicio: nodoOriginal.inicio,
      fin: nodoOriginal.fin,
      avance: nodoOriginal.avance,
      datos: nodoOriginal.datos ? structuredClone(nodoOriginal.datos) : null,
    };
  }

  const raiz = clonarSubarbolFiltrado(modelo.raiz);
  const porId = new Map();
  const lista = [];
  const hojas = [];

  function registrarPreorden(nodo) {
    if (nodo.id !== null) {
      porId.set(nodo.id, nodo);
      lista.push(nodo);
      if (nodo.esHoja) {
        hojas.push(nodo);
      }
    }
    for (const hijo of nodo.hijos) {
      registrarPreorden(hijo);
    }
  }
  registrarPreorden(raiz);

  const hitos = structuredClone(modelo.hitos || []).filter((h) => {
    if (resp) {
      if (resp === '__sin_asignar__' && h.responsable) return false;
      if (resp !== '__sin_asignar__' && (h.responsable || '') !== resp) return false;
    }
    if (q) {
      const textoHito = `${h.nombre || ''} ${h.responsable || ''}`.toLowerCase();
      if (!textoHito.includes(q)) return false;
    }
    return true;
  });

  return {
    proyecto: structuredClone(modelo.proyecto),
    equipo: [...(modelo.equipo || [])],
    hitos,
    raiz,
    porId,
    lista,
    hojas,
    rango: modelo.rango ? { ...modelo.rango } : null,
  };
}

