// Pruebas de comun/modelo.js — ejecutar con: node --test pruebas/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../comun/modelo.js';

const base = () => ({
  version: 1,
  proyecto: { nombre: 'Demo', descripcion: '' },
  equipo: ['Ana', 'Luis'],
  actividades: [
    { id: 'g', padre: null, orden: 1, nombre: 'Gestión' },
    { id: 'g1', padre: 'g', orden: 1, nombre: 'Alcance', responsable: 'Ana', inicio: '2026-10-05', fin: '2026-10-09', estado: 'hecha' },
    { id: 'g2', padre: 'g', orden: 2, nombre: 'Cronograma', responsable: 'Luis', inicio: '2026-10-12', fin: '2026-10-16', estado: 'en curso' },
    { id: 'c', padre: null, orden: 2, nombre: 'Control' },
    { id: 'c1', padre: 'c', orden: 1, nombre: 'Sensores' },
    { id: 'c11', padre: 'c1', orden: 1, nombre: 'Elegir sensor', inicio: '2026-10-19', fin: '2026-10-23' },
    { id: 'c12', padre: 'c1', orden: 2, nombre: 'Cablear' },
  ],
  hitos: [{ id: 'h', nombre: 'Entrega', inicio: '2026-10-30', fin: '2026-10-30', responsable: '' }],
});

test('fechas: esFecha, diasEntre (inclusivo), sumarDias (cruza meses y años)', () => {
  assert.equal(M.esFecha('2026-10-05'), true);
  for (const f of ['2026-13-01', '2026-02-30', '05/10/2026', '', null, undefined, '2026-1-5']) assert.equal(M.esFecha(f), false, String(f));
  assert.equal(M.diasEntre('2026-10-05', '2026-10-05'), 1);
  assert.equal(M.diasEntre('2026-10-05', '2026-10-09'), 5);
  assert.equal(M.diasEntre('2026-02-27', '2026-03-02'), 4);
  assert.equal(M.sumarDias('2026-12-30', 3), '2027-01-02');
  assert.equal(M.sumarDias('2026-03-01', -1), '2026-02-28');
});

test('validar acepta datos correctos y proyectoVacio / plantillas', () => {
  assert.deepEqual(M.validar(base()), { ok: true, errores: [] });
  const v = M.proyectoVacio('Nuevo', ['A']);
  assert.equal(M.validar(v).ok, true);
  assert.equal(v.actividades.length, 0);
  assert.equal(v.proyecto.nombre, 'Nuevo');
  const b = M.proyectoDesdePlantilla('X', [], 'basica');
  assert.equal(M.validar(b).ok, true);
  assert.deepEqual(M.construir(b).lista.map(n => n.nombre), ['Planeación', 'Ejecución', 'Pruebas', 'Cierre']);
  assert.equal(M.proyectoDesdePlantilla('X', [], 'vacia').actividades.length, 0);
});

test('validar detecta errores concretos', () => {
  const casos = [
    d => { d.actividades[1].id = 'g'; },                       // id repetido
    d => { d.hitos[0].id = 'g1'; },                            // id repetido entre actividad e hito
    d => { d.actividades[1].padre = 'nope'; },                  // padre inexistente
    d => { d.actividades[0].padre = 'c11'; d.actividades[3].padre = 'g1'; }, // ciclo
    d => { d.actividades[1].fin = '2026-10-01'; },              // fin < inicio
    d => { delete d.actividades[1].fin; },                      // inicio sin fin
    d => { d.actividades[0].inicio = '2026-10-01'; d.actividades[0].fin = '2026-10-02'; }, // fechas en un padre
    d => { d.actividades[1].estado = 'listo'; },                // estado inválido
    d => { d.actividades[1].responsable = 'Pedro'; },           // responsable fuera del equipo
    d => { d.actividades[1].nombre = '  '; },                   // nombre vacío
    d => { d.proyecto.nombre = ''; },                           // proyecto sin nombre
    d => { d.version = 2; },                                    // versión desconocida
    d => { d.hitos[0].fin = '2026-10-01'; },                    // hito con fin < inicio
    d => { d.equipo = ['Ana', 'Ana']; },                        // equipo repetido
  ];
  casos.forEach((romper, i) => {
    const d = base(); romper(d);
    const r = M.validar(d);
    assert.equal(r.ok, false, `caso ${i} debería ser inválido`);
    assert.ok(r.errores.length > 0 && r.errores.every(e => typeof e === 'string' && e.length > 5), `caso ${i} sin mensaje`);
  });
  assert.equal(M.validar(null).ok, false);
  assert.equal(M.validar({}).ok, false);
});

test('construir: códigos, niveles, hojas, preorden', () => {
  const m = M.construir(base());
  const cod = Object.fromEntries(m.lista.map(n => [n.id, n.codigo]));
  assert.deepEqual(cod, { g: '1', g1: '1.1', g2: '1.2', c: '2', c1: '2.1', c11: '2.1.1', c12: '2.1.2' });
  assert.deepEqual(m.lista.map(n => n.id), ['g', 'g1', 'g2', 'c', 'c1', 'c11', 'c12']);
  assert.deepEqual(m.hojas.map(n => n.id), ['g1', 'g2', 'c11', 'c12']);
  assert.equal(m.porId.get('c11').nivel, 3);
  assert.equal(m.raiz.codigo, '');
  assert.equal(m.raiz.nivel, 0);
  assert.equal(m.raiz.hijos.length, 2);
  assert.equal(m.porId.get('c12').estado, 'pendiente');       // estado por defecto
});

test('construir: el orden sigue el campo orden, no la posición en el arreglo', () => {
  const d = base();
  d.actividades.reverse();
  d.actividades.find(a => a.id === 'g2').orden = 0.5;          // g2 antes que g1
  const m = M.construir(d);
  assert.equal(m.porId.get('g2').codigo, '1.1');
  assert.equal(m.porId.get('g1').codigo, '1.2');
  assert.equal(m.porId.get('g').codigo, '1');
});

test('construir: fechas de padres, avance y rango', () => {
  const m = M.construir(base());
  assert.deepEqual([m.porId.get('g').inicio, m.porId.get('g').fin], ['2026-10-05', '2026-10-16']);
  assert.deepEqual([m.porId.get('c1').inicio, m.porId.get('c1').fin], ['2026-10-19', '2026-10-23']); // c12 sin fechas se ignora
  assert.equal(m.porId.get('g1').avance, 1);
  assert.equal(m.porId.get('g').avance, 0.5);
  assert.equal(m.porId.get('c').avance, 0);
  assert.equal(m.raiz.avance, 0.25);
  assert.deepEqual(m.rango, { inicio: '2026-10-05', fin: '2026-10-30' }); // incluye el hito
  assert.equal(M.construir(M.proyectoVacio('x')).rango, null);
});

test('construir no modifica los datos', () => {
  const d = base(); const copia = JSON.stringify(d);
  M.construir(d);
  assert.equal(JSON.stringify(d), copia);
});

test('agregarActividad: al final, después de un hermano, en raíz; ids únicos', () => {
  const d0 = base(); const copia = JSON.stringify(d0);
  const { datos: d1, id } = M.agregarActividad(d0, { padre: 'g', nombre: 'Riesgos' });
  assert.equal(JSON.stringify(d0), copia, 'no debe mutar la entrada');
  assert.equal(M.construir(d1).porId.get(id).codigo, '1.3');
  const { datos: d2, id: id2 } = M.agregarActividad(d1, { padre: 'g', nombre: 'Medio', despuesDe: 'g1' });
  const m2 = M.construir(d2);
  assert.deepEqual(m2.porId.get('g').hijos.map(n => n.id), ['g1', id2, 'g2', id]);
  const { datos: d3, id: id3 } = M.agregarActividad(d2, { padre: null, nombre: 'Cierre' });
  assert.equal(M.construir(d3).porId.get(id3).codigo, '3');
  assert.equal(M.validar(d3).ok, true);
  const ids = new Set(); for (let i = 0; i < 300; i++) ids.add(M.nuevoId(d3));
  assert.ok([...ids].every(x => /^[a-z0-9]{4,6}$/.test(x) && !d3.actividades.some(a => a.id === x)));
});

test('agregar un hijo a una hoja le quita fechas/estado/responsable a esa hoja (ahora es padre)', () => {
  const { datos } = M.agregarActividad(base(), { padre: 'g1', nombre: 'Sub' });
  const g1 = datos.actividades.find(a => a.id === 'g1');
  assert.equal(g1.inicio, undefined); assert.equal(g1.fin, undefined); assert.equal(g1.estado, undefined);
  assert.equal(M.validar(datos).ok, true);
});

test('editarActividad valida y no muta', () => {
  const d0 = base();
  const d1 = M.editarActividad(d0, 'g2', { nombre: 'Gantt', estado: 'hecha', responsable: 'Ana' });
  const a = d1.actividades.find(x => x.id === 'g2');
  assert.deepEqual([a.nombre, a.estado, a.responsable], ['Gantt', 'hecha', 'Ana']);
  assert.equal(d0.actividades.find(x => x.id === 'g2').nombre, 'Cronograma');
  assert.throws(() => M.editarActividad(d0, 'g2', { fin: '2026-01-01' }));        // fin < inicio
  assert.throws(() => M.editarActividad(d0, 'g', { inicio: '2026-10-01', fin: '2026-10-02' })); // padre con fechas
  assert.throws(() => M.editarActividad(d0, 'g2', { estado: 'raro' }));
  assert.throws(() => M.editarActividad(d0, 'g2', { responsable: 'Pedro' }));
  assert.throws(() => M.editarActividad(d0, 'zzz', { nombre: 'x' }));
  // quitar fechas: inicio y fin vacíos
  const d2 = M.editarActividad(d0, 'g2', { inicio: '', fin: '' });
  const g2 = d2.actividades.find(x => x.id === 'g2');
  assert.ok(!g2.inicio && !g2.fin);
  assert.equal(M.validar(d2).ok, true);
});

test('moverActividad, subir, bajar, renormaliza orden e impide ciclos', () => {
  const d1 = M.moverActividad(base(), 'g2', 'c', 0);
  const m1 = M.construir(d1);
  assert.equal(m1.porId.get('g2').codigo, '2.1');
  assert.equal(m1.porId.get('c1').codigo, '2.2');
  const hermanos = d1.actividades.filter(a => a.padre === 'c').sort((a, b) => a.orden - b.orden).map(a => a.orden);
  assert.deepEqual(hermanos, [1, 2]);
  assert.throws(() => M.moverActividad(base(), 'c', 'c11', 0));   // ciclo
  assert.throws(() => M.moverActividad(base(), 'c', 'c', 0));     // sobre sí mismo
  const d2 = M.subir(base(), 'g2');
  assert.equal(M.construir(d2).porId.get('g2').codigo, '1.1');
  const d3 = M.bajar(base(), 'g');
  assert.equal(M.construir(d3).porId.get('g').codigo, '2');
  assert.equal(JSON.stringify(M.subir(base(), 'g')), JSON.stringify(base())); // ya es el primero: sin cambios
});

test('eliminarActividad borra descendientes; contarDescendientes', () => {
  assert.equal(M.contarDescendientes(base(), 'c'), 3);
  assert.equal(M.contarDescendientes(base(), 'g1'), 0);
  const d = M.eliminarActividad(base(), 'c');
  assert.deepEqual(d.actividades.map(a => a.id).sort(), ['g', 'g1', 'g2']);
  assert.equal(M.validar(d).ok, true);
  assert.throws(() => M.eliminarActividad(base(), 'nope'));
});

test('hitos, proyecto y equipo', () => {
  const { datos: d1, id } = M.agregarHito(base(), { nombre: 'Feria', inicio: '2026-11-01', fin: '2026-11-03', responsable: 'Luis' });
  assert.equal(d1.hitos.length, 2);
  const d2 = M.editarHito(d1, id, { nombre: 'Feria final' });
  assert.equal(d2.hitos.find(h => h.id === id).nombre, 'Feria final');
  assert.throws(() => M.editarHito(d1, id, { fin: '2026-10-01' }));
  assert.equal(M.eliminarHito(d2, id).hitos.length, 1);
  const d3 = M.editarProyecto(base(), { nombre: 'NEO' });
  assert.equal(d3.proyecto.nombre, 'NEO');
  assert.throws(() => M.editarProyecto(base(), { nombre: '' }));
  const d4 = M.editarEquipo(base(), ['Luis', 'Marta']);           // Ana sale del equipo
  assert.equal(d4.actividades.find(a => a.id === 'g1').responsable || '', '');
  assert.equal(M.validar(d4).ok, true);
});

test('actualizarEquipo: renombrar conserva asignaciones, quitar las limpia, agregar y repetidos', () => {
  const d = M.actualizarEquipo(base(), [{ antes: 'Ana', ahora: 'Paola' }, { antes: null, ahora: 'Marta' }, { antes: null, ahora: '  ' }]);
  assert.deepEqual(d.equipo, ['Paola', 'Marta']);                        // Luis salió, Marta entró, vacío ignorado
  assert.equal(d.actividades.find(a => a.id === 'g1').responsable, 'Paola'); // era de Ana → pasa a Paola
  assert.equal(d.actividades.find(a => a.id === 'g2').responsable || '', ''); // era de Luis → sin asignar
  assert.equal(M.validar(d).ok, true);
  assert.throws(() => M.actualizarEquipo(base(), [{ antes: 'Ana', ahora: 'X' }, { antes: 'Luis', ahora: 'X' }]));
});

test('P5: filtrarModelo conserva ancestros sin recalcular codigo, avance, inicio ni fin; filtro vacío es deepStrictEqual al original', () => {
  const original = M.construir(base());

  // Con filtro vacío, el modelo resultante es igual al original (deepStrictEqual)
  assert.deepStrictEqual(M.filtrarModelo(original, {}), original);
  assert.deepStrictEqual(M.filtrarModelo(original, { texto: '', responsable: '', estado: '' }), original);

  // Filtrar por responsable ('Ana' -> g1 coincide, su padre 'g' se conserva)
  const porResp = M.filtrarModelo(original, { responsable: 'Ana' });
  assert.deepEqual(porResp.lista.map(a => a.id), ['g', 'g1']);
  const gOrig = original.porId.get('g');
  const gFiltResp = porResp.porId.get('g');
  assert.equal(gFiltResp.codigo, gOrig.codigo);
  assert.equal(gFiltResp.avance, gOrig.avance); // 0.5 aunque g2 fue ocultada
  assert.equal(gFiltResp.inicio, gOrig.inicio); // '2026-10-05'
  assert.equal(gFiltResp.fin, gOrig.fin);       // '2026-10-16' aunque g1 termina el 09

  // Filtrar por estado ('en curso' -> g2 coincide, su padre 'g' se conserva con codigo, avance y fechas intactos)
  const porEstado = M.filtrarModelo(original, { estado: 'en curso' });
  assert.deepEqual(porEstado.lista.map(a => a.id), ['g', 'g2']);
  const gFiltEst = porEstado.porId.get('g');
  assert.equal(gFiltEst.codigo, gOrig.codigo);
  assert.equal(gFiltEst.avance, gOrig.avance);
  assert.equal(gFiltEst.inicio, gOrig.inicio);
  assert.equal(gFiltEst.fin, gOrig.fin);
  assert.equal(porEstado.porId.get('g2').codigo, '1.2'); // no se renumera a 1.1

  // Filtrar por texto en hoja profunda ('Cablear' -> c12 coincide, ancestros c y c1 se conservan)
  const porTexto = M.filtrarModelo(original, { texto: 'cablear' });
  assert.deepEqual(porTexto.lista.map(a => a.id), ['c', 'c1', 'c12']);
  for (const id of ['c', 'c1', 'c12']) {
    assert.equal(porTexto.porId.get(id).codigo, original.porId.get(id).codigo);
    assert.equal(porTexto.porId.get(id).avance, original.porId.get(id).avance);
    assert.equal(porTexto.porId.get(id).inicio, original.porId.get(id).inicio);
    assert.equal(porTexto.porId.get(id).fin, original.porId.get(id).fin);
  }
});

test('actividades tipo "entregable" y filtro por fecha (se entregan el / activas el)', () => {
  const { datos: d1, id } = M.agregarActividad(base(), {
    padre: 'g',
    nombre: 'Entregable lunes',
    tipo: 'entregable',
    inicio: '2026-10-19',
    fin: '2026-10-19',
    responsable: 'Ana',
  });
  assert.equal(M.validar(d1).ok, true);
  const m1 = M.construir(d1);
  assert.equal(M.esEntregable(m1.porId.get(id)), true);
  assert.equal(M.esEntregable(m1.porId.get('g1')), false);

  // Filtrar solo entregables conserva el ancestro 'g' y el entregable creado
  const soloEnt = M.filtrarModelo(m1, { tipo: 'entregable' });
  assert.deepEqual(soloEnt.lista.map(a => a.id), ['g', id]);

  // Filtrar por fecha de entrega ('fin' === '2026-10-19') encuentra el entregable del lunes
  const porFechaFin = M.filtrarModelo(m1, { fecha: '2026-10-19', modoFecha: 'fin' });
  assert.deepEqual(porFechaFin.lista.map(a => a.id), ['g', id]);

  // Filtrar por fecha activa ('activa' en '2026-10-20') encuentra c11 (2026-10-19 a 2026-10-21) y sus ancestros c, c1
  const porFechaActiva = M.filtrarModelo(m1, { fecha: '2026-10-20', modoFecha: 'activa' });
  assert.deepEqual(porFechaActiva.lista.map(a => a.id), ['c', 'c1', 'c11']);

  // Cambiar de entregable a tarea normal limpia el campo tipo
  const d2 = M.editarActividad(d1, id, { tipo: 'tarea' });
  assert.equal(M.esEntregable(M.construir(d2).porId.get(id)), false);
});

