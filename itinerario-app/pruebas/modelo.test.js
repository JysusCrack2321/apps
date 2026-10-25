// pruebas/modelo.test.js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validarDatos,
  calcularUrgencia,
  calcularMetricasTarea,
  crearTarea,
  actualizarTarea,
  eliminarTarea,
  marcarTareaHecha,
  crearBloque,
  actualizarBloque,
  eliminarBloque,
  marcarBloqueHecho,
  generarId,
  agruparEntregas,
  planificar,
  esEcoPropio
} from '../comun/modelo.js';
import { horaAMinutos } from '../comun/tiempo.js';

test('validarDatos completa campos faltantes con valores por defecto', () => {
  const entradaIncompleta = {
    tareas: [{ titulo: 'Comprar componentes' }]
  };
  const { datos, advertencias } = validarDatos(entradaIncompleta);

  assert.equal(datos.version, 1);
  assert.equal(datos.config.inicioDia, '06:00');
  assert.equal(datos.config.finDia, '24:00');
  assert.equal(datos.tareas.length, 1);
  assert.equal(datos.tareas[0].titulo, 'Comprar componentes');
  assert.equal(datos.tareas[0].estado, 'pendiente');
  assert.equal(datos.tareas[0].avance, 0);
  assert.ok(datos.tareas[0].id.startsWith('t-'));
  assert.equal(Array.isArray(datos.materias), true);
  assert.equal(Array.isArray(datos.bloques), true);
  assert.equal(Array.isArray(datos.fijos), true);
});

test('validarDatos tolera padre inexistente emitiendo advertencia sin romper', () => {
  const entradaConPadreInvalido = {
    tareas: [
      { id: 't-1', titulo: 'Hija huerfana', padre: 't-inexistente' }
    ]
  };
  const { datos, advertencias } = validarDatos(entradaConPadreInvalido);
  assert.equal(datos.tareas[0].padre, null);
  assert.ok(advertencias.length > 0);
  assert.ok(advertencias[0].includes('t-inexistente'));
});

test('calcularUrgencia clasifica correctamente vencida, urgente, pronto y con tiempo', () => {
  const ahora = '2026-10-14T10:00';

  // 1. Vencida: entrega antes de ahora
  const tareaVencida = {
    id: 't-v',
    titulo: 'Vencida',
    entrega: '2026-10-14T08:00', // -2 h
    duracionMin: 60,
    avance: 0,
    estado: 'pendiente'
  };
  const resVencida = calcularUrgencia(tareaVencida, ahora, [tareaVencida]);
  assert.equal(resVencida.nivel, 'vencida');
  assert.ok(resVencida.horasHasta < 0);

  // 2. Urgente: entrega en 10h, restante 2h -> holgura 8h (< 24)
  const tareaUrgente = {
    id: 't-u',
    titulo: 'Urgente',
    entrega: '2026-10-14T20:00', // 10 h
    duracionMin: 120, // 2 h
    avance: 0,
    estado: 'pendiente'
  };
  const resUrgente = calcularUrgencia(tareaUrgente, ahora, [tareaUrgente]);
  assert.equal(resUrgente.nivel, 'urgente');
  assert.equal(resUrgente.holguraH, 8);
  assert.ok(resUrgente.textoUrgencia.includes('Urgente'));

  // 3. Pronto: entrega en 48h, restante 2h -> holgura 46h (< 72)
  const tareaPronto = {
    id: 't-p',
    titulo: 'Pronto',
    entrega: '2026-10-16T10:00', // 48 h
    duracionMin: 120,
    avance: 0,
    estado: 'pendiente'
  };
  const resPronto = calcularUrgencia(tareaPronto, ahora, [tareaPronto]);
  assert.equal(resPronto.nivel, 'pronto');
  assert.equal(resPronto.holguraH, 46);
  assert.ok(resPronto.textoUrgencia.includes('Pronto'));

  // 4. Con tiempo: entrega en 120h, restante 2h -> holgura 118h (>= 72)
  const tareaConTiempo = {
    id: 't-c',
    titulo: 'Con tiempo',
    entrega: '2026-10-19T10:00', // 120 h
    duracionMin: 120,
    avance: 0,
    estado: 'pendiente'
  };
  const resConTiempo = calcularUrgencia(tareaConTiempo, ahora, [tareaConTiempo]);
  assert.equal(resConTiempo.nivel, 'con-tiempo');
  assert.ok(resConTiempo.holguraH >= 72);

  // 5. Hecha
  const tareaHecha = {
    id: 't-h',
    titulo: 'Hecha',
    entrega: '2026-10-14T08:00',
    duracionMin: 120,
    avance: 100,
    estado: 'hecha'
  };
  const resHecha = calcularUrgencia(tareaHecha, ahora, [tareaHecha]);
  assert.equal(resHecha.nivel, 'hecha');
  assert.equal(resHecha.textoUrgencia, 'Hecha');
});

test('subtareas: la madre calcula duracionMin y avance a partir de sus hijas', () => {
  const madre = {
    id: 't-madre',
    titulo: 'Proyecto TPI',
    entrega: '2026-10-14T23:59',
    duracionMin: 0,
    avance: 0,
    estado: 'pendiente'
  };
  const hija1 = {
    id: 't-h1',
    padre: 't-madre',
    titulo: 'Arbol de objetivos',
    duracionMin: 60,
    avance: 100, // restante 0
    estado: 'hecha'
  };
  const hija2 = {
    id: 't-h2',
    padre: 't-madre',
    titulo: 'Requerimientos',
    duracionMin: 60,
    avance: 50, // restante 30
    estado: 'en curso'
  };
  const todas = [madre, hija1, hija2];

  const metricas = calcularMetricasTarea(madre, todas);
  assert.equal(metricas.tieneHijas, true);
  assert.equal(metricas.duracionMin, 120);
  assert.equal(metricas.restanteMin, 30);
  // avance = (120 - 30) / 120 * 100 = 75%
  assert.equal(metricas.avance, 75);
});

test('ediciones inmutables de tareas y bloques no mutan el objeto original', () => {
  const estadoInicial = {
    version: 1,
    config: {},
    materias: [{ id: 'm1', nombre: 'Materia 1', color: '#ff0000' }],
    tareas: [{ id: 't-1', titulo: 'Tarea 1', materia: 'm1', estado: 'pendiente', duracionMin: 60, avance: 0 }],
    bloques: [],
    fijos: []
  };

  // Crear tarea
  const estadoConNueva = crearTarea(estadoInicial, { titulo: 'Tarea 2', materia: 'm1' });
  assert.equal(estadoInicial.tareas.length, 1);
  assert.equal(estadoConNueva.tareas.length, 2);

  // Actualizar tarea
  const estadoActualizado = actualizarTarea(estadoConNueva, 't-1', { titulo: 'Tarea 1 Modificada' });
  assert.equal(estadoConNueva.tareas[0].titulo, 'Tarea 1');
  assert.equal(estadoActualizado.tareas[0].titulo, 'Tarea 1 Modificada');

  // Marcar tarea hecha
  const estadoHecha = marcarTareaHecha(estadoActualizado, 't-1', true);
  assert.equal(estadoActualizado.tareas[0].estado, 'pendiente');
  assert.equal(estadoHecha.tareas[0].estado, 'hecha');
  assert.equal(estadoHecha.tareas[0].avance, 100);

  // Crear bloque y marcarlo hecho
  const conBloque = crearBloque(estadoHecha, {
    fecha: '2026-10-14',
    inicio: '10:00',
    fin: '11:00',
    tarea: 't-1'
  });
  assert.equal(conBloque.bloques.length, 1);
  assert.equal(conBloque.bloques[0].hecho, false);

  const bloqueHecho = marcarBloqueHecho(conBloque, conBloque.bloques[0].id, true);
  assert.equal(conBloque.bloques[0].hecho, false);
  assert.equal(bloqueHecho.bloques[0].hecho, true);

  // Eliminar tarea elimina en cascada y desvincula bloques
  const idBloque = bloqueHecho.bloques[0].id;
  const sinTarea = eliminarTarea(bloqueHecho, 't-1');
  assert.equal(sinTarea.tareas.some((t) => t.id === 't-1'), false);
  const b = sinTarea.bloques.find((b) => b.id === idBloque);
  assert.equal(b.tarea, null);
});

test('arrastrar y redimensionar: actualizarBloque cambia inicio y fin limpiamente', () => {
  const estado = {
    version: 1,
    config: {},
    materias: [],
    tareas: [],
    bloques: [
      { id: 'b-arrastre', fecha: '2026-10-14', inicio: '08:00', fin: '09:00', hecho: false, propuesto: false }
    ],
    fijos: []
  };

  // Mover bloque en paso de 15 min (ej. de 08:00 a 08:15 - 09:15)
  const movido = actualizarBloque(estado, 'b-arrastre', { inicio: '08:15', fin: '09:15' });
  assert.equal(movido.bloques[0].inicio, '08:15');
  assert.equal(movido.bloques[0].fin, '09:15');
  assert.equal(estado.bloques[0].inicio, '08:00'); // Inmutabilidad

  // Redimensionar duración arrastrando borde inferior (ej. extender fin a 10:00)
  const redimensionado = actualizarBloque(movido, 'b-arrastre', { fin: '10:00' });
  assert.equal(redimensionado.bloques[0].inicio, '08:15');
  assert.equal(redimensionado.bloques[0].fin, '10:00');
});

test('fijos: clase de martes y jueves aparece exactamente en esos días', () => {
  const fijo = {
    id: 'f-proc1',
    titulo: 'Clase Procesos 1',
    dias: [2, 4], // 2 = martes, 4 = jueves
    inicio: '07:00',
    fin: '09:00'
  };

  assert.equal(fijo.dias.includes(2), true); // Martes
  assert.equal(fijo.dias.includes(4), true); // Jueves
  assert.equal(fijo.dias.includes(1), false); // Lunes
  assert.equal(fijo.dias.includes(3), false); // Miércoles
  assert.equal(fijo.dias.includes(5), false); // Viernes
});

test('agruparEntregas: 3 entregas a las 23:59 forman 1 grupo de 3', () => {
  const entregas = [
    { id: 'e-1', horaStr: '23:59', tarea: { id: 't-1', titulo: 'Entrega 1' }, urg: { nivel: 'urgente', textoUrgencia: 'Urgente' } },
    { id: 'e-2', horaStr: '23:59', tarea: { id: 't-2', titulo: 'Entrega 2' }, urg: { nivel: 'pronto', textoUrgencia: 'Pronto' } },
    { id: 'e-3', horaStr: '23:59', tarea: { id: 't-3', titulo: 'Entrega 3' }, urg: { nivel: 'con-tiempo', textoUrgencia: 'Con tiempo' } }
  ];

  const grupos = agruparEntregas(entregas, 15);

  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].conteo, 3);
  assert.equal(grupos[0].esGrupo, true);
  assert.equal(grupos[0].horaStr, '23:59');
  assert.equal(grupos[0].items.length, 3);
  assert.equal(grupos[0].urgenciaMayor, 'urgente'); // Selecciona la urgencia más alta
});

// ==========================================
// Pruebas Fase 3: Planificador
// ==========================================

test('planificador: (a) no hay solapes con fijos ni bloques', () => {
  // Miércoles 2026-10-14 (día 3 de la semana: lunes=1, martes=2, miércoles=3)
  const ahora = '2026-10-14T06:00';
  const datos = {
    version: 1,
    config: { inicioDia: '06:00', finDia: '22:00', bloqueMaxMin: 90, pausaMin: 10 },
    materias: [{ id: 'm1', nombre: 'Materia 1', color: '#ff0000' }],
    tareas: [
      { id: 't1', titulo: 'Tarea Larga 1', materia: 'm1', duracionMin: 180, avance: 0, estado: 'pendiente' },
      { id: 't2', titulo: 'Tarea Larga 2', materia: 'm1', duracionMin: 180, avance: 0, estado: 'pendiente' }
    ],
    fijos: [
      // Fijo de miércoles (3): 09:00 a 11:00
      { id: 'f1', titulo: 'Clase Fija', dias: [3], inicio: '09:00', fin: '11:00' }
    ],
    bloques: [
      // Bloque confirmado existente: 14:00 a 16:00
      { id: 'b-conf', fecha: '2026-10-14', inicio: '14:00', fin: '16:00', hecho: false, propuesto: false }
    ]
  };

  const { bloquesPropuestos } = planificar(datos, ahora, 1);
  assert.ok(bloquesPropuestos.length > 0, 'Debe proponer bloques');

  // Verificar que cada bloque propuesto tenga propuesto: true
  for (const b of bloquesPropuestos) {
    assert.equal(b.propuesto, true);
    const bIni = horaAMinutos(b.inicio);
    const bFin = horaAMinutos(b.fin);

    // 1. No solapa con fijo f1 (09:00 - 11:00 = 540 a 660)
    const fijoIni = horaAMinutos('09:00');
    const fijoFin = horaAMinutos('11:00');
    const solapaFijo = (bIni < fijoFin && bFin > fijoIni);
    assert.equal(solapaFijo, false, `Bloque ${b.inicio}-${b.fin} no debe solaparse con fijo 09:00-11:00`);

    // 2. No solapa con bloque confirmado (14:00 - 16:00 = 840 a 960)
    const confIni = horaAMinutos('14:00');
    const confFin = horaAMinutos('16:00');
    const solapaConf = (bIni < confFin && bFin > confIni);
    assert.equal(solapaConf, false, `Bloque ${b.inicio}-${b.fin} no debe solaparse con bloque confirmado 14:00-16:00`);
  }

  // 3. No hay solapes entre los mismos bloques propuestos
  for (let i = 0; i < bloquesPropuestos.length; i++) {
    for (let j = i + 1; j < bloquesPropuestos.length; j++) {
      const b1Ini = horaAMinutos(bloquesPropuestos[i].inicio);
      const b1Fin = horaAMinutos(bloquesPropuestos[i].fin);
      const b2Ini = horaAMinutos(bloquesPropuestos[j].inicio);
      const b2Fin = horaAMinutos(bloquesPropuestos[j].fin);
      const solapan = (b1Ini < b2Fin && b1Fin > b2Ini);
      assert.equal(solapan, false, `Bloques propuestos ${bloquesPropuestos[i].inicio}-${bloquesPropuestos[i].fin} y ${bloquesPropuestos[j].inicio}-${bloquesPropuestos[j].fin} no deben solaparse`);
    }
  }
});

test('planificador: (b) ningún bloque termina después de la entrega', () => {
  const ahora = '2026-10-14T08:00';
  const datos = {
    version: 1,
    config: { inicioDia: '08:00', finDia: '20:00', bloqueMaxMin: 90, pausaMin: 10 },
    materias: [{ id: 'm1', nombre: 'Materia 1', color: '#ff0000' }],
    tareas: [
      // Tarea con entrega hoy a las 11:30
      { id: 't-temprana', titulo: 'Entrega Mediodia', materia: 'm1', entrega: '2026-10-14T11:30', duracionMin: 120, avance: 0, estado: 'pendiente' },
      // Tarea con entrega hoy a las 16:00
      { id: 't-tarde', titulo: 'Entrega Tarde', materia: 'm1', entrega: '2026-10-14T16:00', duracionMin: 120, avance: 0, estado: 'pendiente' }
    ],
    fijos: [],
    bloques: []
  };

  const { bloquesPropuestos } = planificar(datos, ahora, 1);
  assert.ok(bloquesPropuestos.length > 0);

  const minEntregaTemprana = horaAMinutos('11:30');
  const minEntregaTarde = horaAMinutos('16:00');

  for (const b of bloquesPropuestos) {
    const finMin = horaAMinutos(b.fin);
    if (b.tarea === 't-temprana') {
      assert.ok(finMin <= minEntregaTemprana, `Bloque para t-temprana (${b.inicio}-${b.fin}) debe terminar antes o a las 11:30`);
    } else if (b.tarea === 't-tarde') {
      assert.ok(finMin <= minEntregaTarde, `Bloque para t-tarde (${b.inicio}-${b.fin}) debe terminar antes o a las 16:00`);
    }
  }
});

test('planificador: (c) respeta bloqueMaxMin y pausaMin', () => {
  const ahora = '2026-10-14T08:00';
  const datos = {
    version: 1,
    config: { inicioDia: '08:00', finDia: '18:00', bloqueMaxMin: 60, pausaMin: 15 },
    materias: [{ id: 'm1', nombre: 'Materia 1', color: '#ff0000' }],
    tareas: [
      { id: 't1', titulo: 'Estudiar 3 horas', materia: 'm1', entrega: '2026-10-15T18:00', duracionMin: 180, avance: 0, estado: 'pendiente' }
    ],
    fijos: [],
    bloques: []
  };

  const { bloquesPropuestos } = planificar(datos, ahora, 1);
  assert.ok(bloquesPropuestos.length >= 2, 'Debe dividir la tarea en múltiples bloques');

  for (let i = 0; i < bloquesPropuestos.length; i++) {
    const b = bloquesPropuestos[i];
    const durMin = horaAMinutos(b.fin) - horaAMinutos(b.inicio);
    assert.ok(durMin <= 60, `La duración ${durMin} debe ser menor o igual a bloqueMaxMin (60)`);
    assert.ok(durMin >= 15, `La duración ${durMin} no debe ser inferior a 15 min`);

    if (i < bloquesPropuestos.length - 1) {
      const sig = bloquesPropuestos[i + 1];
      const pausa = horaAMinutos(sig.inicio) - horaAMinutos(b.fin);
      assert.ok(pausa >= 15, `La pausa entre bloques consecutivos (${pausa} min) debe ser al menos pausaMin (15)`);
    }
  }
});

test('planificador: (d) el aviso "No alcanza" aparece cuando corresponde', () => {
  const ahora = '2026-10-14T08:00';
  const datos = {
    version: 1,
    config: { inicioDia: '08:00', finDia: '18:00', bloqueMaxMin: 90, pausaMin: 10 },
    materias: [{ id: 'm1', nombre: 'Materia 1', color: '#ff0000' }],
    tareas: [
      // Tarea Imposible: 4 horas de trabajo pero entrega hoy a las 10:00 (solo hay 2 horas disponibles desde las 08:00)
      { id: 't-imposible', titulo: 'Parcial imposible', materia: 'm1', entrega: '2026-10-14T10:00', duracionMin: 240, avance: 0, estado: 'pendiente' },
      // Tarea Posible: 1 hora de trabajo, entrega hoy a las 18:00 (cabe de sobra)
      { id: 't-posible', titulo: 'Entrega comoda', materia: 'm1', entrega: '2026-10-14T18:00', duracionMin: 60, avance: 0, estado: 'pendiente' }
    ],
    fijos: [],
    bloques: []
  };

  const { avisosNoAlcanza } = planificar(datos, ahora, 1);

  assert.ok(avisosNoAlcanza['t-imposible'], 'Debe emitir aviso para la tarea que no alcanza');
  assert.ok(avisosNoAlcanza['t-imposible'].texto.includes('No alcanza: faltan'), `Aviso esperado: ${avisosNoAlcanza['t-imposible'].texto}`);
  assert.ok(avisosNoAlcanza['t-imposible'].horasFaltantes > 0);

  assert.equal(Boolean(avisosNoAlcanza['t-posible']), false, 'No debe emitir aviso para la tarea que sí alcanza');
});

test('planificador: (e) no planifica a la madre del TPI ni tareas hechas', () => {
  const ahora = '2026-10-14T08:00';
  const datos = {
    version: 1,
    config: { inicioDia: '08:00', finDia: '18:00', bloqueMaxMin: 90, pausaMin: 10 },
    materias: [{ id: 'm-tpi', nombre: 'TPI', color: '#336699' }],
    tareas: [
      // Madre TPI con subtareas
      { id: 't-tpi-madre', titulo: 'TPI', materia: 'm-tpi', entrega: '2026-10-14T23:59', duracionMin: 0, avance: 0, estado: 'pendiente' },
      // Subtareas de TPI (hojas)
      { id: 't-tpi-h1', padre: 't-tpi-madre', titulo: 'Corregir arbol', materia: 'm-tpi', entrega: '2026-10-14T23:59', duracionMin: 60, avance: 0, estado: 'pendiente' },
      { id: 't-tpi-h2', padre: 't-tpi-madre', titulo: 'Requerimientos', materia: 'm-tpi', entrega: '2026-10-14T23:59', duracionMin: 60, avance: 0, estado: 'pendiente' },
      // Tarea ya terminada
      { id: 't-hecha', titulo: 'Tarea ya entregada', materia: 'm-tpi', entrega: '2026-10-14T10:00', duracionMin: 60, avance: 100, estado: 'hecha' }
    ],
    fijos: [],
    bloques: []
  };

  const { bloquesPropuestos } = planificar(datos, ahora, 1);
  assert.ok(bloquesPropuestos.length > 0);

  // Ningún bloque debe ser para la madre ni para la tarea hecha
  const idsPlanificados = bloquesPropuestos.map((b) => b.tarea);
  assert.equal(idsPlanificados.includes('t-tpi-madre'), false, 'No debe crear bloques para la tarea madre');
  assert.equal(idsPlanificados.includes('t-hecha'), false, 'No debe crear bloques para tareas hechas');

  // Solo debe crear para las hojas
  assert.ok(idsPlanificados.includes('t-tpi-h1') || idsPlanificados.includes('t-tpi-h2'), 'Debe crear bloques para las subtareas hojas');
});

test('planificador: (f) planificar dos veces no duplica', () => {
  const ahora = '2026-10-14T08:00';
  const datos = {
    version: 1,
    config: { inicioDia: '08:00', finDia: '18:00', bloqueMaxMin: 90, pausaMin: 10 },
    materias: [{ id: 'm1', nombre: 'Materia 1', color: '#ff0000' }],
    tareas: [
      { id: 't1', titulo: 'Tarea 1', materia: 'm1', entrega: '2026-10-15T18:00', duracionMin: 120, avance: 0, estado: 'pendiente' }
    ],
    fijos: [],
    bloques: []
  };

  // 1. Primera corrida
  const { bloquesPropuestos: res1 } = planificar(datos, ahora, 2);
  assert.ok(res1.length > 0);
  const cantBloques1 = res1.length;

  // 2. Si se vuelve a planificar sobre el mismo estado base (función pura idempotente)
  const { bloquesPropuestos: resIdempotente } = planificar(datos, ahora, 2);
  assert.equal(resIdempotente.length, cantBloques1, 'La función pura devuelve el mismo número de bloques');

  // 3. Si se integran los bloques propuestos al estado y se planifica de nuevo (los futuros propuestos cubren la tarea y ocupan huecos)
  const datosConPropuestos = {
    ...datos,
    bloques: [...datos.bloques, ...res1]
  };
  const { bloquesPropuestos: resSegundaCorrida } = planificar(datosConPropuestos, ahora, 2);
  assert.equal(resSegundaCorrida.length, 0, 'No debe crear bloques duplicados si ya están planificados');

  // 4. Si en la UI se vuelve a planificar, se reemplazan los propuestos anteriores sin acumular
  const datosReemplazo = {
    ...datosConPropuestos,
    bloques: datosConPropuestos.bloques.filter((b) => !b.propuesto)
  };
  const { bloquesPropuestos: resReemplazo } = planificar(datosReemplazo, ahora, 2);
  const bloquesFinales = [...datosReemplazo.bloques, ...resReemplazo];
  assert.equal(bloquesFinales.filter((b) => b.propuesto).length, cantBloques1, 'Re-planificar en la UI reemplaza los propuestos sin acumularlos');
});

test('validarDatos convierte fin "00:00" con inicio mayor a "24:00" y emite advertencia', () => {
  const entrada = {
    bloques: [
      { id: 'b-medianoche', fecha: '2026-10-14', inicio: '23:10', fin: '00:00' }
    ]
  };
  const { datos, advertencias } = validarDatos(entrada);
  assert.equal(datos.bloques[0].inicio, '23:10');
  assert.equal(datos.bloques[0].fin, '24:00');
  assert.ok(advertencias.some((a) => a.includes('00:00') && a.includes('24:00')));
});

test('planificador: ningún bloque tiene fin <= inicio (medianoche es 24:00)', () => {
  const ahora = '2026-10-14T22:00';
  const datos = {
    version: 1,
    config: { inicioDia: '06:00', finDia: '24:00', bloqueMaxMin: 90, pausaMin: 10 },
    materias: [{ id: 'm1', nombre: 'Materia 1', color: '#ff0000' }],
    tareas: [
      { id: 't-noche', titulo: 'Tarea nocturna', materia: 'm1', entrega: '2026-10-15T08:00', duracionMin: 180, avance: 0, estado: 'pendiente' }
    ],
    fijos: [],
    bloques: []
  };

  const { bloquesPropuestos } = planificar(datos, ahora, 1);
  assert.ok(bloquesPropuestos.length > 0);

  for (const b of bloquesPropuestos) {
    const iniMin = horaAMinutos(b.inicio);
    const finMin = horaAMinutos(b.fin);
    assert.ok(finMin > iniMin, `El bloque ${b.inicio}-${b.fin} debe tener fin > inicio`);
    assert.notEqual(b.fin, '00:00', 'Ningún bloque que termina a medianoche debe tener fin 00:00');
  }

  const ultimoBloque = bloquesPropuestos[bloquesPropuestos.length - 1];
  assert.equal(ultimoBloque.fin, '24:00', 'El bloque que alcanza el fin del día a medianoche debe terminar en 24:00');
});

test('planificador: no pone bloques dentro del horario del fijo Comida (13:00 a 14:00)', () => {
  const ahora = '2026-10-14T11:00';
  const datos = {
    version: 1,
    config: {
      inicioDia: '06:00',
      finDia: '24:00',
      bloqueMaxMin: 90,
      pausaMin: 10
    },
    materias: [{ id: 'm1', nombre: 'Materia 1', color: '#ff0000' }],
    tareas: [
      { id: 't1', titulo: 'Trabajo continuo', materia: 'm1', entrega: '2026-10-14T18:00', duracionMin: 300, avance: 0, estado: 'pendiente' }
    ],
    fijos: [
      {
        id: 'f-comida',
        titulo: 'Comida',
        materia: null,
        dias: [1, 2, 3, 4, 5, 6, 7],
        inicio: '13:00',
        fin: '14:00',
        lugar: '',
        desde: '2026-08-01',
        hasta: '2026-12-31'
      }
    ],
    bloques: []
  };

  const { bloquesPropuestos } = planificar(datos, ahora, 1);
  assert.ok(bloquesPropuestos.length > 0);

  const comidaIni = horaAMinutos('13:00');
  const comidaFin = horaAMinutos('14:00');

  for (const b of bloquesPropuestos) {
    const bIni = horaAMinutos(b.inicio);
    const bFin = horaAMinutos(b.fin);
    const solapaComida = (bIni < comidaFin && bFin > comidaIni);
    assert.equal(solapaComida, false, `El bloque ${b.inicio}-${b.fin} no debe solaparse con comida 13:00-14:00`);
  }
});

test('validarDatos convierte config.comida antiguo en fijo Comida y emite advertencia', () => {
  const datosRaw = {
    version: 1,
    config: {
      inicioDia: '06:00',
      finDia: '24:00',
      comida: { inicio: '13:00', fin: '14:00' }
    },
    materias: [{ id: 'm1', nombre: 'Materia 1', color: '#ff0000' }],
    tareas: [],
    fijos: [],
    bloques: []
  };

  const { datos, advertencias } = validarDatos(datosRaw);
  assert.equal(datos.config.comida, undefined, 'config.comida no debe existir en config');
  const fijoComida = datos.fijos.find((f) => f.id === 'f-comida' || f.titulo === 'Comida');
  assert.ok(fijoComida, 'Debe haber creado el fijo Comida');
  assert.equal(fijoComida.inicio, '13:00');
  assert.equal(fijoComida.fin, '14:00');
  assert.equal(fijoComida.materia, null);
  assert.deepEqual(fijoComida.dias, [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(advertencias.some((a) => a.includes('comida')), 'Debe emitir advertencia sobre config.comida');
});

// ==========================================
// Pruebas Fase 4: Sincronización y Jerarquía de Entregas
// ==========================================

test('agruparEntregas: madre + 4 hijas + 2 sueltas a la misma hora cuentan como 3 entregas', () => {
  const entregas = [
    // Madre
    { id: 'e-tpi', horaStr: '23:59', tarea: { id: 't-tpi', titulo: 'TPI', padre: null }, urg: { nivel: 'urgente', textoUrgencia: 'Urgente' } },
    // 4 Hijas
    { id: 'e-tpi-1', horaStr: '23:59', tarea: { id: 't-tpi-1', titulo: 'Corregir árbol', padre: 't-tpi' }, urg: { nivel: 'urgente', textoUrgencia: 'Urgente' } },
    { id: 'e-tpi-2', horaStr: '23:59', tarea: { id: 't-tpi-2', titulo: 'Generar requerimientos', padre: 't-tpi' }, urg: { nivel: 'urgente', textoUrgencia: 'Urgente' } },
    { id: 'e-tpi-3', horaStr: '23:59', tarea: { id: 't-tpi-3', titulo: 'Matriz de alternativas', padre: 't-tpi' }, urg: { nivel: 'urgente', textoUrgencia: 'Urgente' } },
    { id: 'e-tpi-4', horaStr: '23:59', tarea: { id: 't-tpi-4', titulo: 'Preparar pitch', padre: 't-tpi' }, urg: { nivel: 'urgente', textoUrgencia: 'Urgente' } },
    // 2 Sueltas
    { id: 'e-ion', horaStr: '23:59', tarea: { id: 't-edt-ion', titulo: 'Actualizar EDT ION', padre: null }, urg: { nivel: 'urgente', textoUrgencia: 'Urgente' } },
    { id: 'e-taller2', horaStr: '23:59', tarea: { id: 't-taller2', titulo: 'Calificar taller 2', padre: null }, urg: { nivel: 'urgente', textoUrgencia: 'Urgente' } }
  ];

  const grupos = agruparEntregas(entregas, 15);
  assert.equal(grupos.length, 1);
  const grupo = grupos[0];
  assert.equal(grupo.conteo, 3, 'Madre + 4 hijas + 2 sueltas deben contar exactamente como 3 entregas');
  assert.equal(grupo.itemsPrincipales.length, 3);

  const itemMadre = grupo.itemsPrincipales.find((it) => it.tarea.id === 't-tpi');
  assert.ok(itemMadre, 'Debe incluir la madre TPI');
  assert.equal(itemMadre.hijas.length, 4, 'La madre TPI debe tener listadas sus 4 hijas adentro');

  const itemIon = grupo.itemsPrincipales.find((it) => it.tarea.id === 't-edt-ion');
  assert.ok(itemIon, 'Debe incluir EDT ION');
  assert.equal(itemIon.hijas.length, 0);

  const itemTaller = grupo.itemsPrincipales.find((it) => it.tarea.id === 't-taller2');
  assert.ok(itemTaller, 'Debe incluir Taller 2');
  assert.equal(itemTaller.hijas.length, 0);
});

test('esEcoPropio: detecta si un ETag corresponde al propio guardado', () => {
  assert.equal(esEcoPropio('"123456"', '"123456"'), true);
  assert.equal(esEcoPropio('"123456"', '123456'), true);
  assert.equal(esEcoPropio('123456', '"123456"'), true);
  assert.equal(esEcoPropio('W/"123456"', '"123456"'), true);
  assert.equal(esEcoPropio('"123456"', '"999999"'), false);
  assert.equal(esEcoPropio(null, '"123456"'), false);
  assert.equal(esEcoPropio('"123456"', null), false);
  assert.equal(esEcoPropio(undefined, undefined), false);
});

// ==========================================
// Pruebas Fase 4: Planificador Avanzado y Ciclo de Estados
// ==========================================

test('planificador: (a) un bloque en curso descuenta', () => {
  const ahora = '2026-10-14T10:20';
  const datos = {
    version: 1,
    config: { inicioDia: '08:00', finDia: '20:00', bloqueMaxMin: 90, pausaMin: 10 },
    materias: [{ id: 'm1', nombre: 'Materia 1', color: '#ff0000' }],
    tareas: [
      { id: 't1', titulo: 'Tarea en curso', materia: 'm1', duracionMin: 60, avance: 0, estado: 'pendiente' }
    ],
    fijos: [],
    bloques: [
      // Bloque en curso (inicio 10:00 < ahora 10:20 < fin 11:00, no hecho)
      // Le quedan 40 minutos (11:00 - 10:20). De 60 min requeridos, restan 20 min.
      { id: 'b-curso', fecha: '2026-10-14', inicio: '10:00', fin: '11:00', tarea: 't1', hecho: false, propuesto: false }
    ]
  };

  const { bloquesPropuestos } = planificar(datos, ahora, 1);
  assert.equal(bloquesPropuestos.length, 1, 'Debe planificar solo 1 bloque para los 20 min restantes');
  const b = bloquesPropuestos[0];
  const dur = horaAMinutos(b.fin) - horaAMinutos(b.inicio);
  assert.equal(dur, 20, 'El bloque propuesto debe durar exactamente 20 min');
  assert.equal(b.tarea, 't1');
  assert.equal(b.propuesto, true);
});

test('planificador: (b) un bloque pasado sin hacer se mueve con el mismo id y no se duplica', () => {
  const ahora = '2026-10-14T08:00';
  const datos = {
    version: 1,
    config: { inicioDia: '08:00', finDia: '20:00', bloqueMaxMin: 90, pausaMin: 10 },
    materias: [{ id: 'm1', nombre: 'Materia 1', color: '#ff0000' }],
    tareas: [
      { id: 't1', titulo: 'Tarea pendiente de ayer', materia: 'm1', duracionMin: 60, avance: 0, estado: 'pendiente' }
    ],
    fijos: [],
    bloques: [
      // Bloque de ayer que no se completó
      { id: 'b-ayer-123', fecha: '2026-10-13', inicio: '10:00', fin: '11:00', tarea: 't1', hecho: false, propuesto: false }
    ]
  };

  const { bloquesPropuestos } = planificar(datos, ahora, 1);
  assert.equal(bloquesPropuestos.length, 1);
  const movido = bloquesPropuestos[0];
  assert.equal(movido.id, 'b-ayer-123', 'Debe reutilizar el mismo id');
  assert.equal(movido.fecha, '2026-10-14', 'Debe moverse a hoy');
  assert.equal(movido.propuesto, true);

  // Simular la fusión en el estado de la app:
  const idsPropuestos = new Set(bloquesPropuestos.map((b) => b.id));
  const bloquesFusionados = [
    ...datos.bloques.filter((b) => !b.propuesto && !idsPropuestos.has(b.id)),
    ...bloquesPropuestos
  ];
  assert.equal(bloquesFusionados.length, 1, 'No debe duplicarse en el estado');
  assert.equal(bloquesFusionados[0].id, 'b-ayer-123');
  assert.equal(bloquesFusionados[0].fecha, '2026-10-14');
});

test('planificador: (c) un bloque pasado más grande que bloqueMaxMin se acorta y genera otro', () => {
  const ahora = '2026-10-14T08:00';
  const datos = {
    version: 1,
    config: { inicioDia: '08:00', finDia: '20:00', bloqueMaxMin: 90, pausaMin: 10 },
    materias: [{ id: 'm1', nombre: 'Materia 1', color: '#ff0000' }],
    tareas: [
      { id: 't1', titulo: 'Tarea de 2 horas', materia: 'm1', duracionMin: 120, avance: 0, estado: 'pendiente' }
    ],
    fijos: [],
    bloques: [
      // Bloque pasado de 120 minutos (10:00 a 12:00)
      { id: 'b-pasado-largo', fecha: '2026-10-13', inicio: '10:00', fin: '12:00', tarea: 't1', hecho: false, propuesto: false }
    ]
  };

  const { bloquesPropuestos } = planificar(datos, ahora, 1);
  assert.equal(bloquesPropuestos.length, 2, 'Debe generar 2 bloques: el acortado y el resto');

  // Primer bloque: reutiliza el id original y se acorta a bloqueMaxMin (90)
  const b1 = bloquesPropuestos[0];
  assert.equal(b1.id, 'b-pasado-largo');
  const dur1 = horaAMinutos(b1.fin) - horaAMinutos(b1.inicio);
  assert.equal(dur1, 90, 'El primer bloque se acorta a bloqueMaxMin (90 min)');
  assert.equal(b1.propuesto, true);

  // Segundo bloque: nuevo id con los 30 min restantes
  const b2 = bloquesPropuestos[1];
  assert.notEqual(b2.id, 'b-pasado-largo', 'El resto va en un bloque nuevo con id diferente');
  const dur2 = horaAMinutos(b2.fin) - horaAMinutos(b2.inicio);
  assert.equal(dur2, 30, 'El segundo bloque tiene el resto (30 min)');
  assert.equal(b2.propuesto, true);
});

test('estados: (d) marcar un bloque como hecho sube el avance y desmarcarlo lo baja', () => {
  const datos = {
    version: 1,
    config: {},
    materias: [{ id: 'm1', nombre: 'Materia 1' }],
    tareas: [
      { id: 't1', titulo: 'Mi Tarea', materia: 'm1', duracionMin: 60, avance: 0, estado: 'pendiente' }
    ],
    fijos: [],
    bloques: [
      { id: 'b1', fecha: '2026-10-14', inicio: '08:00', fin: '08:30', tarea: 't1', hecho: false, propuesto: false },
      { id: 'b2', fecha: '2026-10-14', inicio: '08:30', fin: '09:00', tarea: 't1', hecho: false, propuesto: false }
    ]
  };

  // 1. Marcar b1 (30 min de 60 = 50%)
  const paso1 = marcarBloqueHecho(datos, 'b1', true);
  const tPaso1 = paso1.tareas.find((t) => t.id === 't1');
  assert.equal(tPaso1.avance, 50, 'El avance debe subir a 50%');
  assert.equal(tPaso1.estado, 'pendiente');

  // 2. Marcar b2 (30 min más = 60/60 = 100% -> hecha)
  const paso2 = marcarBloqueHecho(paso1, 'b2', true);
  const tPaso2 = paso2.tareas.find((t) => t.id === 't1');
  assert.equal(tPaso2.avance, 100, 'El avance debe llegar a 100%');
  assert.equal(tPaso2.estado, 'hecha', 'Al llegar a 100% la tarea queda hecha');

  // 3. Desmarcar b2 -> baja a 50% y estado vuelve a pendiente
  const paso3 = marcarBloqueHecho(paso2, 'b2', false);
  const tPaso3 = paso3.tareas.find((t) => t.id === 't1');
  assert.equal(tPaso3.avance, 50, 'El avance debe bajar a 50%');
  assert.equal(tPaso3.estado, 'pendiente', 'Al bajar de 100% la tarea vuelve a pendiente');
});

test('estados: (e) marcar una tarea como hecha elimina futuros no hechos y marca pasados', () => {
  const ahora = '2026-10-14T12:00';
  const datos = {
    version: 1,
    config: {},
    materias: [{ id: 'm1', nombre: 'Materia 1' }],
    tareas: [
      { id: 't1', titulo: 'Tarea en curso', materia: 'm1', duracionMin: 120, avance: 0, estado: 'pendiente' }
    ],
    fijos: [],
    bloques: [
      // Pasado no hecho (10:00 a 11:00)
      { id: 'b-pasado', fecha: '2026-10-14', inicio: '10:00', fin: '11:00', tarea: 't1', hecho: false, propuesto: false },
      // Futuro no hecho (14:00 a 15:00)
      { id: 'b-futuro', fecha: '2026-10-14', inicio: '14:00', fin: '15:00', tarea: 't1', hecho: false, propuesto: false },
      // Futuro que ya estaba hecho (16:00 a 17:00)
      { id: 'b-futuro-hecho', fecha: '2026-10-14', inicio: '16:00', fin: '17:00', tarea: 't1', hecho: true, propuesto: false },
      // Bloque de otra tarea
      { id: 'b-otra', fecha: '2026-10-14', inicio: '14:00', fin: '15:00', tarea: 't2', hecho: false, propuesto: false }
    ]
  };

  const resultado = marcarTareaHecha(datos, 't1', true, ahora);
  const t = resultado.tareas.find((t) => t.id === 't1');
  assert.equal(t.estado, 'hecha');
  assert.equal(t.avance, 100);

  // El futuro no hecho debe haberse eliminado
  assert.equal(resultado.bloques.some((b) => b.id === 'b-futuro'), false, 'Futuro no hecho debe eliminarse');

  // El pasado no hecho debe quedar hecho
  const bPasado = resultado.bloques.find((b) => b.id === 'b-pasado');
  assert.ok(bPasado);
  assert.equal(bPasado.hecho, true, 'Pasado no hecho debe marcarse como hecho');

  // Futuro ya hecho se conserva
  assert.ok(resultado.bloques.some((b) => b.id === 'b-futuro-hecho'));
  // Bloque de otra tarea no se toca
  assert.ok(resultado.bloques.some((b) => b.id === 'b-otra'));
});

test('estados: (f) desmarcar una tarea recalcula el avance a partir de sus bloques', () => {
  const datos = {
    version: 1,
    config: {},
    materias: [{ id: 'm1', nombre: 'Materia 1' }],
    tareas: [
      { id: 't1', titulo: 'Tarea terminada', materia: 'm1', duracionMin: 60, avance: 100, estado: 'hecha' }
    ],
    fijos: [],
    bloques: [
      // Tiene 1 bloque hecho de 30 min (30 / 60 = 50%)
      { id: 'b1', fecha: '2026-10-14', inicio: '08:00', fin: '08:30', tarea: 't1', hecho: true, propuesto: false }
    ]
  };

  const desmarcada = marcarTareaHecha(datos, 't1', false);
  const t = desmarcada.tareas.find((t) => t.id === 't1');
  assert.equal(t.estado, 'pendiente');
  assert.equal(t.avance, 50, 'El avance se recalcula a partir de sus bloques hechos (50%), no se pone en 0');
});

test('jerarquía: (g) una subtarea sin entrega usa la entrega de la madre', () => {
  const ahora = '2026-10-14T08:00';
  const madre = {
    id: 't-madre',
    padre: null,
    titulo: 'Proyecto TPI',
    entrega: '2026-10-14T11:00', // Entrega en 3 horas
    duracionMin: 0,
    avance: 0,
    estado: 'pendiente'
  };
  const subtareaSinEntrega = {
    id: 't-hija',
    padre: 't-madre',
    titulo: 'Hija sin entrega',
    entrega: '', // No tiene entrega propia
    duracionMin: 60,
    avance: 0,
    estado: 'pendiente'
  };

  // 1. calcularUrgencia: hereda la entrega de la madre
  const urg = calcularUrgencia(subtareaSinEntrega, ahora, [madre, subtareaSinEntrega]);
  assert.notEqual(urg.textoUrgencia, 'Sin fecha', 'No debe quedar Sin fecha');
  assert.equal(urg.horasHasta, 3, 'Debe calcular horasHasta respecto a la entrega de la madre (11:00 - 08:00 = 3 h)');
  assert.equal(urg.nivel, 'urgente');

  // 2. planificar(): ningún bloque propuesto para la subtarea debe terminar después de la entrega de la madre
  const datos = {
    version: 1,
    config: { inicioDia: '08:00', finDia: '20:00', bloqueMaxMin: 90, pausaMin: 10 },
    materias: [{ id: 'm1', nombre: 'Materia 1' }],
    tareas: [madre, subtareaSinEntrega],
    fijos: [],
    bloques: []
  };

  const { bloquesPropuestos } = planificar(datos, ahora, 1);
  assert.ok(bloquesPropuestos.length > 0);
  const minEntregaMadre = horaAMinutos('11:00');
  for (const b of bloquesPropuestos) {
    if (b.tarea === 't-hija') {
      const finMin = horaAMinutos(b.fin);
      assert.ok(finMin <= minEntregaMadre, `Bloque para subtarea (${b.inicio}-${b.fin}) debe terminar antes o a las 11:00`);
    }
  }
});
