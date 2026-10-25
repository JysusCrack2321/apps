import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  construirGrafoProyecto,
  consultarQuienLlama,
  consultarLlamaA,
  consultarRuta,
  guardarArchivosGrafo,
  verificarGrafo
} from '../grafo.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIR_MINI = path.join(__dirname, 'mini-proyecto');

test('Grafo mini-proyecto: extrae nodos de funciones, métodos y rutas de servidor', () => {
  const grafo = construirGrafoProyecto(DIR_MINI, 'mini-proyecto');

  const nombresNodos = grafo.nodos.map(n => n.nombre);
  assert.ok(nombresNodos.includes('sumar'), 'Debe incluir la función sumar de matematicas.js');
  assert.ok(nombresNodos.includes('Calculadora.acumular'), 'Debe incluir el método acumular de Calculadora');
  assert.ok(nombresNodos.includes('procesarDatos'), 'Debe incluir la función procesarDatos de cliente.js');
  assert.ok(nombresNodos.includes('accionInterna'), 'Debe incluir la función accionInterna de cliente.js');
  assert.ok(nombresNodos.includes('ejecutarOperacion'), 'Debe incluir la función ejecutarOperacion de modulo_contexto.js');
  assert.ok(nombresNodos.includes('ManejadorServidor.manejar_saludo_get'), 'Debe incluir el handler GET manejar_saludo_get');
  assert.ok(nombresNodos.includes('ManejadorServidor.manejar_saludo_post'), 'Debe incluir el handler POST manejar_saludo_post');
});

test('Grafo mini-proyecto: resuelve import con alias (sumar as sumaConAlias)', () => {
  const grafo = construirGrafoProyecto(DIR_MINI, 'mini-proyecto');

  const aristaImporta = grafo.aristas.find(
    a => a.tipo === 'importa' && a.origen === 'cliente.js' && a.destino.includes('matematicas.js')
  );
  assert.ok(aristaImporta, 'Debe existir arista importa cliente.js -> matematicas.js');

  const aristaLlamaAlias = grafo.aristas.find(
    a => a.tipo === 'llama' &&
         a.origen.includes('procesarDatos') &&
         a.destino.includes('sumar') &&
         a.dudosa === false
  );
  assert.ok(aristaLlamaAlias, 'Debe resolver la llamada de sumaConAlias a sumar con dudosa: false');
});

test('Grafo mini-proyecto: llamada dentro de flecha en addEventListener pertenece a función contenedora', () => {
  const grafo = construirGrafoProyecto(DIR_MINI, 'mini-proyecto');

  const aristaFlecha = grafo.aristas.find(
    a => a.tipo === 'llama' &&
         a.origen.includes('procesarDatos') &&
         a.destino.includes('accionInterna') &&
         a.dudosa === false
  );
  assert.ok(aristaFlecha, 'Debe atribuir la llamada accionInterna dentro de addEventListener a procesarDatos');
});

test('Grafo mini-proyecto: función pasada en un objeto se resuelve en el módulo receptor', () => {
  const grafo = construirGrafoProyecto(DIR_MINI, 'mini-proyecto');

  // En modulo_contexto.js, operacion(...) debe resolverse a matematicas.js:sumar
  const aristaInyectada = grafo.aristas.find(
    a => a.tipo === 'llama' &&
         a.origen.includes('ejecutarOperacion') &&
         a.destino.includes('sumar') &&
         a.dudosa === false
  );
  assert.ok(aristaInyectada, 'operacion(...) en modulo_contexto.js debe resolverse a matematicas.js:sumar con dudosa: false');
});

test('Grafo mini-proyecto: diferencia GET y POST a la misma ruta hacia sus manejadores correspondientes', () => {
  const grafo = construirGrafoProyecto(DIR_MINI, 'mini-proyecto');

  const aristaGet = grafo.aristas.find(
    a => a.tipo === 'api' &&
         a.origen.includes('procesarDatos') &&
         a.metodo === 'GET' &&
         a.ruta === '/api/saludo'
  );
  assert.ok(aristaGet, 'Debe existir arista api GET para /api/saludo');
  assert.ok(aristaGet.destino.includes('manejar_saludo_get'), `Destino GET debe ser manejar_saludo_get, fue: ${aristaGet.destino}`);

  const aristaPost = grafo.aristas.find(
    a => a.tipo === 'api' &&
         a.origen.includes('procesarDatos') &&
         a.metodo === 'POST' &&
         a.ruta === '/api/saludo'
  );
  assert.ok(aristaPost, 'Debe existir arista api POST para /api/saludo');
  assert.ok(aristaPost.destino.includes('manejar_saludo_post'), `Destino POST debe ser manejar_saludo_post, fue: ${aristaPost.destino}`);
});

test('Grafo mini-proyecto: llamadas nativas ([].map) se clasifican como tipo externa, no dudosa', () => {
  const grafo = construirGrafoProyecto(DIR_MINI, 'mini-proyecto');

  const aristaExterna = grafo.aristas.find(
    a => a.tipo === 'externa' &&
         a.origen.includes('procesarDatos') &&
         a.destino === 'map'
  );
  assert.ok(aristaExterna, 'La llamada a map debe ser de tipo externa');
  assert.equal(aristaExterna.dudosa, false, 'Las llamadas externas no deben ser dudosas');
});

test('Grafo mini-proyecto: marca como dudosa una llamada no resoluble', () => {
  const grafo = construirGrafoProyecto(DIR_MINI, 'mini-proyecto');

  const aristaDudosa = grafo.aristas.find(
    a => a.tipo === 'llama' &&
         a.origen.includes('procesarDatos') &&
         a.destino.includes('llamadaMisteriosa')
  );
  assert.ok(aristaDudosa, 'Debe existir la arista hacia llamadaMisteriosa');
  assert.equal(aristaDudosa.dudosa, true, 'llamadaMisteriosa debe ser dudosa: true');
});

test('Consultas: quien-llama, llama-a y ruta respetan --externas', () => {
  const grafo = construirGrafoProyecto(DIR_MINI, 'mini-proyecto');
  const grafos = [grafo];

  // quien-llama sumar
  const llamadores = consultarQuienLlama(grafos, 'sumar');
  assert.ok(llamadores.some(l => l.nombre.includes('procesarDatos')), 'procesarDatos debe llamar a sumar');
  assert.ok(llamadores.some(l => l.nombre.includes('ejecutarOperacion')), 'ejecutarOperacion debe llamar a sumar');

  // llama-a procesarDatos sin --externas no debe incluir map
  const llamadosSinExt = consultarLlamaA(grafos, 'procesarDatos', false);
  assert.ok(!llamadosSinExt.some(l => l.nombre === 'map'), 'Sin --externas no debe listar map');

  // llama-a procesarDatos con --externas sí debe incluir map
  const llamadosConExt = consultarLlamaA(grafos, 'procesarDatos', true);
  assert.ok(llamadosConExt.some(l => l.nombre === 'map'), 'Con --externas debe listar map');

  // ruta entre procesarDatos y el handler POST
  const rutaPost = consultarRuta(grafos, 'procesarDatos', 'ManejadorServidor.manejar_saludo_post');
  assert.ok(rutaPost, 'Debe encontrar ruta hasta manejar_saludo_post');
  assert.equal(rutaPost.camino.length, 2);
});

test('--verificar detecta líneas corridas (desfase en archivo:línea)', () => {
  // Guardar grafo inicial del mini-proyecto
  const grafoInicial = construirGrafoProyecto(DIR_MINI, 'mini-proyecto');
  guardarArchivosGrafo(DIR_MINI, grafoInicial);

  // Inicialmente debe estar OK
  const check1 = verificarGrafo(DIR_MINI, 'mini-proyecto');
  assert.equal(check1.ok, true, 'Grafo recién generado debe verificar OK');

  // Modificar temporalmente cliente.js agregando una línea en blanco arriba
  const rutaCliente = path.join(DIR_MINI, 'cliente.js');
  const contenidoOriginal = fs.readFileSync(rutaCliente, 'utf-8');
  fs.writeFileSync(rutaCliente, '\n' + contenidoOriginal, 'utf-8');

  try {
    const check2 = verificarGrafo(DIR_MINI, 'mini-proyecto');
    assert.equal(check2.ok, false, '--verificar debe fallar cuando hay líneas corridas');
    assert.ok(check2.razon.includes('Línea desplazada'), `Debe indicar línea desplazada, fue: ${check2.razon}`);
  } finally {
    // Restaurar archivo original
    fs.writeFileSync(rutaCliente, contenidoOriginal, 'utf-8');
  }

  // Verificar que restaurado vuelve a estar OK
  const check3 = verificarGrafo(DIR_MINI, 'mini-proyecto');
  assert.equal(check3.ok, true, 'Grafo restaurado debe verificar OK');
});

test('Consultas: llama-a y ruta retornan origen y destino con archivo:linea separados', () => {
  const grafoItinerario = construirGrafoProyecto(path.join(__dirname, '../../itinerario-app'), 'itinerario-app');
  const grafos = [grafoItinerario];
  const nodoPost = grafoItinerario.nodos.find(n => n.nombreSimple === 'manejar_post_datos');
  assert.ok(nodoPost, 'El nodo manejar_post_datos debe existir');

  // llama-a guardarDatos debe apuntar a manejar_post_datos
  const llamadas = consultarLlamaA(grafos, 'guardarDatos');
  const llamadaPost = llamadas.find(l => l.nombre === 'manejar_post_datos');
  assert.ok(llamadaPost, 'guardarDatos debe llamar a manejar_post_datos');
  assert.equal(llamadaPost.origenArchivo, 'comun/archivo.js');
  assert.equal(llamadaPost.lineaLlamada, 31);
  assert.equal(llamadaPost.destinoArchivo, 'servidor.py');
  assert.equal(llamadaPost.lineaDefinicion, nodoPost.linea);

  // ruta guardarDatos -> manejar_post_datos
  const ruta = consultarRuta(grafos, 'guardarDatos', 'manejar_post_datos');
  assert.ok(ruta, 'Debe existir ruta entre guardarDatos y manejar_post_datos');
  assert.equal(ruta.camino.length, 2);
  assert.equal(ruta.camino[0].archivo, 'comun/archivo.js');
  assert.equal(ruta.camino[0].linea, 29);
  assert.equal(ruta.camino[1].origenArchivo, 'comun/archivo.js');
  assert.equal(ruta.camino[1].lineaLlamada, 31);
  assert.equal(ruta.camino[1].destinoArchivo, 'servidor.py');
  assert.equal(ruta.camino[1].lineaDefinicion, nodoPost.linea);
});

test('Python: funciones sin sangría después de una clase son funciones y no métodos', () => {
  const grafoItinerario = construirGrafoProyecto(path.join(__dirname, '../../itinerario-app'), 'itinerario-app');
  const parsear = grafoItinerario.nodos.find(n => n.nombreSimple === 'parsear_argumentos');
  const principal = grafoItinerario.nodos.find(n => n.nombreSimple === 'principal');

  assert.ok(parsear, 'parsear_argumentos debe existir');
  assert.equal(parsear.tipo, 'funcion');
  assert.equal(parsear.clase, null);

  assert.ok(principal, 'principal debe existir');
  assert.equal(principal.tipo, 'funcion');
  assert.equal(principal.clase, null);
});

test('Porcentaje de dudosas: menor al 10% en itinerario-app y project-organizer', () => {
  const gItinerario = construirGrafoProyecto(path.join(__dirname, '../../itinerario-app'), 'itinerario-app');
  const gProject = construirGrafoProyecto(path.join(__dirname, '../../project-organizer'), 'project-organizer');

  const pctItinerario = parseFloat(gItinerario.resumen.porcentajeDudosas);
  const pctProject = parseFloat(gProject.resumen.porcentajeDudosas);

  assert.ok(pctItinerario < 10, `itinerario-app dudosas (${pctItinerario}%) debe ser < 10%`);
  assert.ok(pctProject < 10, `project-organizer dudosas (${pctProject}%) debe ser < 10%`);
});
