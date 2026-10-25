// Pruebas de cliente (Fase B2 + B3 + B4): P1, P2, P3, P4, P5, P6
// Ejecutar con: node --test pruebas/*.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { register } from 'node:module';

// Interceptar la importación ESM desde CDN de D3 (usada en vistas/edt.js) para pruebas en Node
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('https://cdn.jsdelivr.net/npm/d3')) {
      return { url: specifier, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  }
  export async function load(url, context, nextLoad) {
    if (url.startsWith('https://cdn.jsdelivr.net/npm/d3')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: \`
          function crearSeleccionLista(nodos, padre) {
            const sel = {
              _nodos: nodos,
              append(tag) {
                const doc = globalThis.document;
                const nuevos = nodos.map(dOrEl => {
                  const h = doc ? doc.createElement(tag) : {};
                  if (dOrEl && dOrEl.__isData__) {
                    h.__data__ = dOrEl.valor;
                    if (padre && padre.appendChild) padre.appendChild(h);
                  } else if (dOrEl && dOrEl.appendChild) {
                    h.__data__ = dOrEl.__data__;
                    dOrEl.appendChild(h);
                  }
                  return h;
                });
                return crearSeleccionLista(nuevos, padre);
              },
              attr(k, v) {
                for (const n of nodos) {
                  if (n && n.setAttribute) {
                    n.setAttribute(k, typeof v === 'function' ? v(n.__data__) : v);
                  }
                }
                return sel;
              },
              style(k, v) {
                for (const n of nodos) {
                  if (n && n.style) {
                    n.style[k] = typeof v === 'function' ? v(n.__data__) : v;
                  }
                }
                return sel;
              },
              text(v) {
                for (const n of nodos) {
                  if (n) {
                    n.textContent = String(typeof v === 'function' ? v(n.__data__) : (v ?? ''));
                  }
                }
                return sel;
              },
              classed(c, b) {
                for (const n of nodos) {
                  if (n && n.classList) {
                    n.classList.toggle(c, Boolean(typeof b === 'function' ? b(n.__data__) : b));
                  }
                }
                return sel;
              },
              on(t, fn) {
                const tipo = String(t).split('.')[0];
                for (const n of nodos) {
                  if (n && n.addEventListener && fn) {
                    n.addEventListener(tipo, (ev) => fn(ev, n.__data__));
                  }
                }
                return sel;
              },
              call() { return sel; },
              transition() { return sel; },
              duration() { return sel; },
              each(fn) {
                for (const n of nodos) {
                  if (n) fn.call(n, n.__data__);
                }
                return sel;
              },
              merge(otra) {
                return sel;
              },
              remove() {
                for (const n of nodos) {
                  if (n && n.remove) n.remove();
                }
                return sel;
              },
              select(subSel) {
                const sub = [];
                for (const n of nodos) {
                  const hallado = n && n.querySelector ? n.querySelector(subSel) : null;
                  if (hallado) sub.push(hallado);
                }
                return crearSeleccionLista(sub, padre);
              },
              selectAll(subSel) {
                const elPadre = nodos[0] || padre;
                const existentes = subSel === '*'
                  ? [...(elPadre?.children || [])]
                  : (elPadre?.querySelectorAll ? elPadre.querySelectorAll(subSel) : []);
                const subSeleccion = crearSeleccionLista(existentes, elPadre);
                subSeleccion.data = (arr) => {
                  if (elPadre && elPadre.replaceChildren) elPadre.replaceChildren();
                  const envueltos = (arr || []).map(valor => ({ __isData__: true, valor }));
                  return {
                    enter() { return crearSeleccionLista(envueltos, elPadre); },
                    attr() { return this; },
                    exit() { return crearSeleccionLista([], elPadre); },
                  };
                };
                return subSeleccion;
              },
              node() { return nodos[0] || null; }
            };
            return sel;
          }
          export function select(el) { return crearSeleccionLista([el], el); }
          export function hierarchy(raiz, fnHijos) {
            function construirNodo(datos, depth = 0, parent = null, idx = 0) {
              const nodo = { data: datos, depth, x: idx * 200, y: depth * 120, parent, children: null };
              const hijos = fnHijos ? fnHijos(datos) : datos.hijos;
              if (hijos && hijos.length) {
                nodo.children = hijos.map((c, i) => construirNodo(c, depth + 1, nodo, i));
              }
              return nodo;
            }
            const h = construirNodo(raiz);
            h.descendants = () => {
              const res = [];
              (function rec(n) { res.push(n); for (const c of (n.children || [])) rec(c); })(h);
              return res;
            };
            h.links = () => {
              const res = [];
              (function rec(n) { for (const c of (n.children || [])) { res.push({ source: n, target: c }); rec(c); } })(h);
              return res;
            };
            return h;
          }
          export function tree() {
            const t = (root) => root;
            t.nodeSize = () => t;
            t.separation = () => t;
            return t;
          }
          export function zoom() {
            const z = () => {};
            z.scaleExtent = () => z;
            z.filter = () => z;
            z.on = () => z;
            z.transform = () => {};
            z.scaleBy = () => {};
            return z;
          }
          export const zoomIdentity = {
            translate() { return this; },
            scale() { return this; }
          };
          export function min(arr, fn) {
            return Math.min(...(arr || []).map(x => fn ? fn(x) : x));
          }
          export function max(arr, fn) {
            return Math.max(...(arr || []).map(x => fn ? fn(x) : x));
          }
        \`,
      };
    }
    return nextLoad(url, context);
  }
`));

import * as M from '../comun/modelo.js';
import * as A from '../comun/archivo.js';
import { crearVista as crearVistaGantt } from '../vistas/gantt.js';
import { crearVista as crearVistaTabla } from '../vistas/tabla.js';

// --- DOM ligero para pruebas en Node (sin dependencias externas) ---
class NodoDOM {
  constructor(tagName) {
    this.tagName = String(tagName || 'DIV').toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.className = '';
    this.id = '';
    this.textContent = '';
    this.value = '';
    this.type = '';
    this.placeholder = '';
    this.title = '';
    this.disabled = false;
    this.checked = false;
    this.required = false;
    this.style = {};
    this.dataset = {};
    this.attributes = new Map();
    this._listeners = new Map();
    const self = this;
    this.classList = {
      add(...clases) {
        const set = new Set(self.className.split(/\s+/).filter(Boolean));
        for (const c of clases) if (c) set.add(c);
        self.className = [...set].join(' ');
      },
      remove(...clases) {
        const set = new Set(self.className.split(/\s+/).filter(Boolean));
        for (const c of clases) set.delete(c);
        self.className = [...set].join(' ');
      },
      toggle(clase, forzar) {
        const set = new Set(self.className.split(/\s+/).filter(Boolean));
        const activo = forzar !== undefined ? Boolean(forzar) : !set.has(clase);
        if (activo) set.add(clase);
        else set.delete(clase);
        self.className = [...set].join(' ');
        return activo;
      },
      contains(clase) {
        return self.className.split(/\s+/).filter(Boolean).includes(clase);
      },
    };
  }

  set innerHTML(val) {
    this._innerHTML = String(val);
    this.replaceChildren();
    if (String(val).includes('po-edt-barra')) {
      const barra = new NodoDOM('DIV');
      barra.className = 'po-edt-barra';
      for (const acc of ['desplegar-todo', 'plegar-nivel1', 'centrar', 'exportar']) {
        const b = new NodoDOM('BUTTON');
        b.className = 'po-boton';
        b.setAttribute('data-accion', acc);
        barra.appendChild(b);
      }
      const inp = new NodoDOM('INPUT');
      inp.className = 'po-campo';
      inp.setAttribute('data-accion', 'buscar');
      barra.appendChild(inp);
      const lienzo = new NodoDOM('DIV');
      lienzo.className = 'po-edt-lienzo';
      this.appendChild(barra);
      this.appendChild(lienzo);
    } else if (String(val).includes('po-cohete-svg')) {
      const svg = new NodoDOM('SVG');
      svg.className = 'po-cohete-svg';
      for (const p of ['ojiva', 'fsup', 'carga', 'acople', 'finf', 'para', 'motor', 'doc', 'redes']) {
        const g = new NodoDOM('G');
        g.className = 'part';
        g.setAttribute('data-part', p);
        const tspan = new NodoDOM('TSPAN');
        tspan.className = 'prog';
        tspan.setAttribute('data-prog', p);
        g.appendChild(tspan);
        svg.appendChild(g);
      }
      this.appendChild(svg);
    }
  }

  get innerHTML() {
    return this._innerHTML || '';
  }

  setAttribute(k, v) {
    this.attributes.set(k, String(v));
    if (k === 'id') this.id = String(v);
    if (k === 'class') this.className = String(v);
  }

  getAttribute(k) {
    if (k === 'id') return this.id || null;
    if (k === 'class') return this.className || null;
    return this.attributes.has(k) ? this.attributes.get(k) : null;
  }

  appendChild(hijo) {
    if (!hijo) return hijo;
    if (hijo.parentNode) {
      const idx = hijo.parentNode.children.indexOf(hijo);
      if (idx !== -1) hijo.parentNode.children.splice(idx, 1);
    }
    hijo.parentNode = this;
    this.children.push(hijo);
    return hijo;
  }

  append(...nodos) {
    for (const n of nodos) {
      if (typeof n === 'string') {
        const span = new NodoDOM('SPAN');
        span.textContent = n;
        this.appendChild(span);
      } else if (n) {
        this.appendChild(n);
      }
    }
  }

  remove() {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx !== -1) this.parentNode.children.splice(idx, 1);
      this.parentNode = null;
    }
  }

  replaceChildren(...nuevos) {
    for (const h of this.children) h.parentNode = null;
    this.children = [];
    this.append(...nuevos);
  }

  replaceWith(nuevo) {
    if (!this.parentNode) return;
    const idx = this.parentNode.children.indexOf(this);
    if (idx !== -1) {
      nuevo.parentNode = this.parentNode;
      this.parentNode.children[idx] = nuevo;
      this.parentNode = null;
    }
  }

  contains(nodo) {
    if (!nodo) return false;
    if (nodo === this) return true;
    for (const h of this.children) {
      if (h.contains && h.contains(nodo)) return true;
    }
    return false;
  }

  addEventListener(tipo, fn) {
    if (!this._listeners.has(tipo)) this._listeners.set(tipo, []);
    this._listeners.get(tipo).push(fn);
  }

  removeEventListener(tipo, fn) {
    const arr = this._listeners.get(tipo);
    if (!arr) return;
    const idx = arr.indexOf(fn);
    if (idx !== -1) arr.splice(idx, 1);
  }

  dispatchEvent(evento) {
    if (!evento.target) evento.target = this;
    if (!evento.currentTarget) evento.currentTarget = this;
    if (!evento.preventDefault) evento.preventDefault = () => {};
    if (!evento.stopPropagation) evento.stopPropagation = () => {};
    const arr = [...(this._listeners.get(evento.type) || [])];
    for (const fn of arr) {
      fn.call(this, evento);
    }
    return true;
  }

  click() {
    this.dispatchEvent({ type: 'click', target: this });
  }

  focus() {
    if (globalThis.document) globalThis.document.activeElement = this;
    this.dispatchEvent({ type: 'focus', target: this });
  }

  blur() {
    if (globalThis.document && globalThis.document.activeElement === this) {
      globalThis.document.activeElement = null;
    }
    this.dispatchEvent({ type: 'blur', target: this });
  }

  select() {}

  getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      width: this._rectWidth || 900,
      height: this._rectHeight || 500,
    };
  }

  get clientWidth() {
    return this._rectWidth || 900;
  }

  get clientHeight() {
    return this._rectHeight || 500;
  }

  getContext() {
    return {
      setTransform() {},
      clearRect() {},
      fillRect() {},
      strokeRect() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      fill() {},
      stroke() {},
      arc() {},
      fillText() {},
      save() {},
      restore() {},
      clip() {},
      rect() {},
      roundRect() {},
      translate() {},
      rotate() {},
      scale() {},
      setLineDash() {},
      measureText(txt) {
        return { width: String(txt || '').length * 7 };
      },
    };
  }

  _coincideSelector(sel) {
    const s = sel.trim();
    if (s.startsWith('[') && s.endsWith(']')) {
      const m = /^\[([a-zA-Z0-9_-]+)=["']?([^"'\]]+)["']?\]$/.exec(s);
      if (m) return this.getAttribute(m[1]) === m[2];
    }
    if (s.startsWith('#')) return this.id === s.slice(1);
    if (s.startsWith('.')) {
      const clases = s.slice(1).split('.');
      return clases.every(c => this.classList.contains(c));
    }
    return this.tagName === s.toUpperCase();
  }

  querySelector(selector) {
    const resultados = this.querySelectorAll(selector);
    return resultados[0] || null;
  }

  querySelectorAll(selector) {
    const partes = selector.trim().split(/\s+/);
    const buscar = (raiz, idxParte) => {
      const encontrados = [];
      const rec = (n) => {
        for (const h of n.children || []) {
          if (h._coincideSelector && h._coincideSelector(partes[idxParte])) {
            if (idxParte === partes.length - 1) {
              encontrados.push(h);
            } else {
              encontrados.push(...buscar(h, idxParte + 1));
            }
          }
          rec(h);
        }
      };
      rec(raiz);
      return encontrados;
    };
    return buscar(this, 0);
  }
}

function instalarEntornoDOM() {
  globalThis.__PO_NO_AUTO_INIT__ = true;
  const body = new NodoDOM('BODY');
  const appEl = new NodoDOM('DIV');
  appEl.id = 'app';
  body.appendChild(appEl);

  const almacen = new Map();
  globalThis.localStorage = {
    getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
    setItem: (k, v) => almacen.set(k, String(v)),
    removeItem: (k) => almacen.delete(k),
    clear: () => almacen.clear(),
  };

  globalThis.Event = class {
    constructor(type, opts = {}) {
      this.type = type;
      Object.assign(this, opts);
    }
  };

  globalThis.Option = class extends NodoDOM {
    constructor(text = '', value = '') {
      super('OPTION');
      this.textContent = String(text);
      this.value = String(value);
    }
  };

  const htmlEl = new NodoDOM('HTML');
  htmlEl.appendChild(body);

  globalThis.document = {
    documentElement: htmlEl,
    body,
    activeElement: null,
    createElement: (tag) => new NodoDOM(tag),
    createTextNode: (txt) => {
      const n = new NodoDOM('#TEXT');
      n.textContent = String(txt ?? '');
      return n;
    },
    getElementById: (id) => (id === 'app' ? appEl : body.querySelector(`#${id}`)),
    querySelector: (sel) => body.querySelector(sel),
    querySelectorAll: (sel) => body.querySelectorAll(sel),
    addEventListener: (t, fn) => body.addEventListener(t, fn),
    removeEventListener: (t, fn) => body.removeEventListener(t, fn),
  };

  globalThis.getComputedStyle = () => ({
    getPropertyValue: () => '#1F4FD1',
  });

  globalThis.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });

  globalThis.devicePixelRatio = 1;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  globalThis.ResizeObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() {}
    disconnect() {}
  };

  globalThis.confirm = () => true;
  return { body, appEl, almacen };
}

function datosProyectoBase(nombre = 'Proyecto Base') {
  return {
    version: 1,
    proyecto: { nombre, descripcion: 'Desc' },
    equipo: ['Ana', 'Luis'],
    actividades: [
      { id: 'g', padre: null, orden: 1, nombre: 'Gestión' },
      { id: 'g1', padre: 'g', orden: 1, nombre: 'Alcance', responsable: 'Ana', inicio: '2026-10-05', fin: '2026-10-09', estado: 'hecha' },
      { id: 'g2', padre: 'g', orden: 2, nombre: 'Cronograma', responsable: 'Luis', inicio: '2026-10-12', fin: '2026-10-16', estado: 'en curso' },
      { id: 'c', padre: null, orden: 2, nombre: 'Control' },
      { id: 'c1', padre: 'c', orden: 1, nombre: 'Sensores', responsable: 'Ana', inicio: '2026-10-19', fin: '2026-10-23', estado: 'pendiente' },
    ],
    hitos: [
      { id: 'h1', nombre: 'Entrega', inicio: '2026-10-30', fin: '2026-10-30', responsable: 'Luis' },
    ],
  };
}

function calcularEtag(datos) {
  const bytes = Buffer.from(JSON.stringify(datos));
  return `"${crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16)}"`;
}

/**
 * Crea un servidor simulado en memoria con ETag, If-Match, 409 y difusión SSE
 * idéntico al comportamiento de servidor.py.
 */
function crearServidorSimulado(datosIniciales) {
  let datosActuales = structuredClone(datosIniciales);
  let etagActual = calcularEtag(datosActuales);
  const suscriptoresSSE = new Set();
  const historialPosts = [];

  class MockEventSource {
    constructor(url) {
      this.url = url;
      this.listeners = new Map();
      this.onopen = null;
      this.onerror = null;
      suscriptoresSSE.add(this);
    }
    addEventListener(tipo, fn) {
      if (!this.listeners.has(tipo)) this.listeners.set(tipo, []);
      this.listeners.get(tipo).push(fn);
    }
    emitir(tipo, dataObj) {
      const fns = this.listeners.get(tipo) || [];
      const ev = { data: JSON.stringify(dataObj) };
      for (const fn of fns) fn(ev);
    }
    close() {
      suscriptoresSSE.delete(this);
    }
  }

  globalThis.EventSource = MockEventSource;

  globalThis.fetch = async (url, opciones = {}) => {
    const metodo = (opciones.method || 'GET').toUpperCase();
    if (metodo === 'GET' && String(url).includes('datos.json')) {
      return {
        ok: true,
        status: 200,
        headers: { get: (h) => (h.toLowerCase() === 'etag' ? etagActual : null) },
        text: async () => JSON.stringify(datosActuales),
        json: async () => structuredClone(datosActuales),
      };
    }
    if (metodo === 'POST' && String(url).includes('/api/guardar')) {
      const ifMatch = opciones.headers?.['If-Match'] || opciones.headers?.['if-match'] || '';
      const cuerpo = JSON.parse(opciones.body);
      historialPosts.push({ ifMatch, cuerpo });

      if (!ifMatch) {
        return {
          ok: false,
          status: 428,
          headers: { get: () => null },
          json: async () => ({ ok: false, error: 'Falta If-Match' }),
        };
      }
      if (ifMatch !== etagActual) {
        return {
          ok: false,
          status: 409,
          headers: { get: (h) => (h.toLowerCase() === 'etag' ? etagActual : null) },
          json: async () => ({
            ok: false,
            error: 'Conflicto de versión',
            etagActual,
          }),
        };
      }

      datosActuales = structuredClone(cuerpo);
      etagActual = calcularEtag(datosActuales);

      // Emitir evento SSE 'cambio' a todos los clientes conectados
      for (const sub of [...suscriptoresSSE]) {
        sub.emitir('cambio', { etag: etagActual });
      }

      return {
        ok: true,
        status: 200,
        headers: { get: (h) => (h.toLowerCase() === 'etag' ? etagActual : null) },
        json: async () => ({ ok: true, archivo: 'actual.json', etag: etagActual }),
      };
    }
    return { ok: false, status: 404, headers: { get: () => null }, json: async () => ({}) };
  };

  return {
    obtenerDatos: () => structuredClone(datosActuales),
    obtenerEtag: () => etagActual,
    establecerEnServidor: (nuevosDatos) => {
      datosActuales = structuredClone(nuevosDatos);
      etagActual = calcularEtag(datosActuales);
      for (const sub of [...suscriptoresSSE]) {
        sub.emitir('cambio', { etag: etagActual });
      }
      return etagActual;
    },
    historialPosts,
    suscriptoresSSE,
  };
}

// Cargamos comun/app.js después de preparar el entorno DOM inicial
instalarEntornoDOM();
const App = await import('../comun/app.js');

test('P1: dos clientes simulados; A guarda -> B recibe SSE y recarga conservando estado; A ignora su propio eco', async () => {
  instalarEntornoDOM();
  const inicial = datosProyectoBase('Proyecto Compartido');
  const servidor = crearServidorSimulado(inicial);

  // Cliente B carga el proyecto y selecciona 'g1' en la pestaña 'tabla'
  const datosCargadosB = await A.cargarDesdeServidor();
  App.estado.pestana = 'tabla';
  App.establecerDatos(datosCargadosB, { sinGuardar: false, guardarBorrador: false });
  App.manejarSeleccion('g1');

  // B hace un cambio local o tiene historial previo para comprobar que no se pierde
  App.estado.historial.push(datosProyectoBase('Historial previo B'));
  const vistaInstanciaAntes = App.estado.vista;
  const recargasAntesB = App.estado.recargasExternas;

  // Simular Cliente A: primero verificamos que cuando A guarda, el evento SSE con el mismo ETag de A es ignorado por A (eco propio)
  const etagAntes = servidor.obtenerEtag();
  assert.equal(M.esEcoPropio(etagAntes, A.obtenerUltimoEtag()), true);

  // Si llega un evento SSE con el mismo ETag que ya tiene el cliente (su propio eco), NO recarga
  const recargoEco = await App.manejarCambioExterno(etagAntes);
  assert.equal(recargoEco, false);
  assert.equal(App.estado.recargasExternas, recargasAntesB);

  // Ahora Cliente A modifica el proyecto en el servidor y el servidor emite event: cambio con el nuevo ETag
  const datosDeA = datosProyectoBase('Proyecto Editado por A');
  datosDeA.actividades.find(a => a.id === 'g1').nombre = 'Alcance actualizado por A';
  servidor.establecerEnServidor(datosDeA);

  // Esperar a que la promesa asíncrona del listener SSE de B termine
  await new Promise(r => setTimeout(r, 20));

  // B recargó automáticamente los datos de A
  assert.equal(App.estado.recargasExternas, recargasAntesB + 1);
  assert.equal(App.estado.datos.proyecto.nombre, 'Proyecto Editado por A');
  assert.equal(App.estado.modelo.porId.get('g1').nombre, 'Alcance actualizado por A');

  // B conservó su selección, pestaña, instancia de vista e historial
  assert.equal(App.estado.seleccion, 'g1');
  assert.equal(App.estado.pestana, 'tabla');
  assert.equal(App.estado.vista, vistaInstanciaAntes);
  assert.equal(App.estado.historial.length, 1);

  App.desconectarEventosServidor();
});

test('P2: B edita con ETag viejo -> 409 -> "Mantener lo mío" -> 200 y queda lo de B; "Cargar lo del otro" -> queda lo de A', async () => {
  instalarEntornoDOM();
  const inicial = datosProyectoBase('Original');
  const servidor = crearServidorSimulado(inicial);

  // B carga con ETag inicial
  const datosB = await A.cargarDesdeServidor();
  App.estado.intervaloAutoguardadoMs = 60000; // evitar autoguardado durante el test manual
  App.establecerDatos(datosB, { sinGuardar: false, guardarBorrador: false });

  // Desconectar SSE de B un momento para simular que A guardó mientras B tenía un ETag viejo
  App.desconectarEventosServidor();
  const datosA = datosProyectoBase('Versión de A');
  servidor.establecerEnServidor(datosA);

  // B edita localmente (tiene el ETag viejo)
  App.aplicar(d => M.editarProyecto(d, { nombre: 'Versión de B' }));
  assert.ok(A.leerBorrador(), 'debe existir borrador antes de confirmar guardado');

  // B intenta guardar -> recibe 409 Conflict
  const res409 = await App.guardarInmediato({ esAuto: false });
  assert.equal(res409.conflicto, true);
  assert.equal(App.estado.estadoGuardado, 'conflicto');
  assert.equal(App.dom.singuardar.textContent, 'Conflicto');

  // Se muestra el banner con los dos botones: "Cargar lo del otro" y "Mantener lo mío"
  const btnMantener = App.dom.contenedorConflicto.querySelector('.po-boton-mantener-mio');
  const btnCargarOtro = App.dom.contenedorConflicto.querySelector('.po-boton-cargar-otro');
  assert.ok(btnMantener, 'debe existir botón "Mantener lo mío"');
  assert.ok(btnCargarOtro, 'debe existir botón "Cargar lo del otro"');

  // Caso 1: B pulsa "Mantener lo mío" -> reintenta con etagActual -> 200 OK y queda lo de B
  btnMantener.click();
  await new Promise(r => setTimeout(r, 25));

  assert.equal(servidor.obtenerDatos().proyecto.nombre, 'Versión de B');
  assert.equal(App.estado.estadoGuardado, 'guardado');
  assert.equal(App.dom.singuardar.textContent, 'Guardado');
  assert.equal(A.leerBorrador(), null, 'el borrador de localStorage se borra al confirmar 200');

  // Caso 2: Ahora A vuelve a guardar otra versión en el servidor y B edita con ETag viejo -> 409 -> "Cargar lo del otro"
  A.establecerUltimoEtag('"etag-viejo-forzado"');
  const datosA2 = datosProyectoBase('Segunda versión de A');
  servidor.establecerEnServidor(datosA2);

  App.aplicar(d => M.editarProyecto(d, { nombre: 'Intento descartable de B' }));
  const res409Segunda = await App.guardarInmediato({ esAuto: false });
  assert.equal(res409Segunda.conflicto, true);

  const btnCargarOtro2 = App.dom.contenedorConflicto.querySelector('.po-boton-cargar-otro');
  assert.ok(btnCargarOtro2);
  btnCargarOtro2.click();
  await new Promise(r => setTimeout(r, 25));

  assert.equal(App.estado.datos.proyecto.nombre, 'Segunda versión de A');
  assert.equal(servidor.obtenerDatos().proyecto.nombre, 'Segunda versión de A');
  assert.equal(App.estado.estadoGuardado, 'guardado');
});

test('P3: cambio llega mientras se edita un campo del editor -> no recarga hasta salir del campo y no se pierde el texto escrito', async () => {
  instalarEntornoDOM();
  const inicial = datosProyectoBase('Proyecto P3');
  const servidor = crearServidorSimulado(inicial);

  const datosB = await A.cargarDesdeServidor();
  App.estado.intervaloAutoguardadoMs = 60000;
  App.establecerDatos(datosB, { sinGuardar: false, guardarBorrador: false });

  // Seleccionar la actividad 'g1' para que el editor muestre sus campos
  App.manejarSeleccion('g1');
  const inputNombre = App.dom.editorContenedor.querySelector('#po-editor-nombre');
  assert.ok(inputNombre, 'debe existir el campo #po-editor-nombre en el editor');

  // El usuario entra al campo y empieza a escribir
  inputNombre.focus();
  inputNombre.value = 'Alcance escrito por B en vivo';
  inputNombre.dispatchEvent(new Event('input'));
  assert.equal(App.estado.editor.enEdicion, true);

  // Mientras B escribe, A guarda un cambio en otra actividad ('g2') y llega el SSE 'cambio'
  const datosA = servidor.obtenerDatos();
  datosA.actividades.find(a => a.id === 'g2').nombre = 'Cronograma cambiado por A';
  servidor.establecerEnServidor(datosA);

  await new Promise(r => setTimeout(r, 20));

  // Mientras B sigue en el campo: NO se ha recargado y el input conserva el texto de B
  assert.ok(App.estado.cambioExternoPendiente, 'el cambio externo debe quedar pendiente mientras se escribe');
  assert.equal(inputNombre.value, 'Alcance escrito por B en vivo');
  assert.equal(App.estado.datos.actividades.find(a => a.id === 'g2').nombre, 'Cronograma');

  // Ahora el usuario sale del campo (blur / Enter)
  inputNombre.blur();
  await new Promise(r => setTimeout(r, 30));

  // Ya se aplicó la recarga diferida Y se conservó el texto que escribió B
  assert.equal(App.estado.cambioExternoPendiente, null);
  assert.equal(App.estado.datos.actividades.find(a => a.id === 'g2').nombre, 'Cronograma cambiado por A');
  assert.equal(App.estado.datos.actividades.find(a => a.id === 'g1').nombre, 'Alcance escrito por B en vivo');

  App.desconectarEventosServidor();
});

test('P4: 10 cambios en menos de 1 s -> 1 solo POST (con debounce) y borra borrador al recibir 200', async () => {
  instalarEntornoDOM();
  const inicial = datosProyectoBase('Proyecto Debounce');
  const servidor = crearServidorSimulado(inicial);

  const datos = await A.cargarDesdeServidor();
  // Usamos ventana de debounce corta (120 ms) para probar 10 cambios rápidos en < 1 s
  App.estado.intervaloAutoguardadoMs = 120;
  App.establecerDatos(datos, { sinGuardar: false, guardarBorrador: false });

  servidor.historialPosts.length = 0;

  // Hacer 10 cambios seguidos
  for (let i = 1; i <= 10; i++) {
    App.aplicar(d => M.editarProyecto(d, { nombre: `Cambio ${i}` }));
  }

  assert.equal(App.dom.singuardar.textContent, 'Sin guardar…');
  assert.ok(A.leerBorrador(), 'mientras no se confirme el guardado, existe borrador en localStorage');
  assert.equal(servidor.historialPosts.length, 0, 'no debe haber enviado POST antes del debounce');

  // Esperar a que venza el debounce
  await new Promise(r => setTimeout(r, 200));

  assert.equal(servidor.historialPosts.length, 1, '10 cambios rápidos deben producir 1 solo POST');
  assert.equal(servidor.obtenerDatos().proyecto.nombre, 'Cambio 10');
  assert.equal(App.dom.singuardar.textContent, 'Guardado');
  assert.equal(A.leerBorrador(), null, 'el borrador de localStorage se borra al confirmar 200');

  App.desconectarEventosServidor();
});

test('P5 (integración barra única): filtra en las 3 vistas, el editor recibe el modelo completo, Quitar filtros restaura y no se guarda en datos.json', async () => {
  instalarEntornoDOM();
  const inicial = datosProyectoBase('Proyecto Filtros');
  const servidor = crearServidorSimulado(inicial);
  const datos = await A.cargarDesdeServidor();
  App.estado.intervaloAutoguardadoMs = 60000;
  App.estado.pestana = 'tabla';
  App.establecerDatos(datos, { sinGuardar: false, guardarBorrador: false });

  // Seleccionar 'g1'
  App.manejarSeleccion('g1');

  // Filtrar por responsable = 'Luis' (solo coincide 'g2' y su padre 'g', más el hito 'h1')
  App.dom.filtroResponsable.value = 'Luis';
  App.dom.filtroResponsable.dispatchEvent(new Event('change'));

  // En la vista Tabla solo aparecen 'g' y 'g2' (no 'c' ni 'c1' ni 'g1')
  const filasTabla = App.dom.vistaContenedor.querySelectorAll('.po-tabla-fila');
  assert.equal(filasTabla.length, 2);

  // Pero el editor sigue recibiendo el modelo completo (puede seguir editando 'g1' que es de Ana)
  const inputEditor = App.dom.editorContenedor.querySelector('#po-editor-nombre');
  assert.ok(inputEditor);
  assert.equal(inputEditor.value, 'Alcance');

  // Los filtros NO se guardan en datos.json
  assert.equal('filtros' in App.estado.datos, false);

  // Botón "Quitar filtros" limpia los filtros y vuelve a mostrar las 5 actividades
  App.dom.btnQuitarFiltros.click();
  const filasTrasLimpiar = App.dom.vistaContenedor.querySelectorAll('.po-tabla-fila');
  assert.equal(filasTrasLimpiar.length, 5);

  App.desconectarEventosServidor();
});

test('P6: Gantt con eventos pointer — toque (< 6 px) selecciona o pliega en zona >= 36 px; arrastre (>= 6 px) no selecciona', () => {
  instalarEntornoDOM();
  const contenedor = new NodoDOM('DIV');
  const selecciones = [];
  const vista = crearVistaGantt(contenedor, {
    alSeleccionar: (id) => selecciones.push(id),
  });

  const modelo = M.construir(datosProyectoBase('Proyecto Gantt Touch'));
  vista.mostrar(modelo, null);

  const canvas = contenedor.querySelector('.po-gantt-canvas');
  assert.ok(canvas, 'debe existir el canvas del Gantt');

  // Fila 0 corresponde a 'g' (padre), fila 1 corresponde a 'g1' (hoja)
  // ALTO_CABECERA = 48, ALTO_FILA = 32 -> fila 1 está en y = 48 + 32*1 + 16 = 96
  // X fuera de la zona de plegado (ej. x = 80)

  // 1) Arrastre de 20 px (pointerdown en x=80, y=96 -> pointerup en x=100, y=96): NO debe seleccionar
  canvas.dispatchEvent({ type: 'pointerdown', clientX: 80, clientY: 96, button: 0, pointerId: 1 });
  canvas.dispatchEvent({ type: 'pointerup', clientX: 100, clientY: 96, button: 0, pointerId: 1 });
  assert.equal(selecciones.length, 0, 'movimiento de 20 px no debe seleccionar');

  // 2) Toque de 3 px (pointerdown en x=80, y=96 -> pointerup en x=83, y=96): SÍ debe seleccionar 'g1'
  canvas.dispatchEvent({ type: 'pointerdown', clientX: 80, clientY: 96, button: 0, pointerId: 1 });
  canvas.dispatchEvent({ type: 'pointerup', clientX: 83, clientY: 96, button: 0, pointerId: 1 });
  assert.deepEqual(selecciones, ['g1'], 'movimiento de 3 px debe seleccionar la actividad');

  // 3) Zona de plegado de al menos 36 px en fila 0 ('g', y = 48 + 16 = 64, x = 30 < 36): pliega 'g' sin seleccionarlo
  selecciones.length = 0;
  canvas.dispatchEvent({ type: 'pointerdown', clientX: 30, clientY: 64, button: 0, pointerId: 1 });
  canvas.dispatchEvent({ type: 'pointerup', clientX: 32, clientY: 64, button: 0, pointerId: 1 });
  assert.equal(selecciones.length, 0, 'toque en la zona de plegado (0..36 px) pliega y no selecciona');
});

test('EDT botón (+/−), botón "Guardar ahora" y revalidación de ETag al reconectar SSE', async () => {
  instalarEntornoDOM();
  const inicial = datosProyectoBase('Proyecto EDT y Reconexión');
  const servidor = crearServidorSimulado(inicial);

  const datos = await A.cargarDesdeServidor();
  App.estado.pestana = 'edt';
  App.establecerDatos(datos, { sinGuardar: false, guardarBorrador: false });

  // El botón de guardado inmediato se llama "Guardar ahora"
  assert.equal(App.dom.btnGuardar.textContent, 'Guardar ahora');

  // En la vista EDT, los nodos con hijos ('g' y 'c') tienen botón visible (+/−) (.po-edt-plegar)
  const botonesPlegar = App.dom.vistaContenedor.querySelectorAll('.po-edt-plegar');
  assert.equal(botonesPlegar.length, 2, 'los 2 nodos padre (g y c) tienen botón (+/−)');
  const simboloAntes = botonesPlegar[0].querySelector('text');
  assert.equal(simboloAntes.textContent, '−');

  // Tocar el botón (+/−) pliega el nodo y el símbolo pasa a '+'
  botonesPlegar[0].click();
  const botonesDespues = App.dom.vistaContenedor.querySelectorAll('.po-edt-plegar');
  assert.equal(botonesDespues[0].querySelector('text').textContent, '+');

  // Simular caída de conexión SSE (onerror) + cambio en el servidor sin evento + reconexión (onopen)
  const es = App.estado.eventSource;
  assert.ok(es);
  es.onerror();

  // Cambiar datos en el servidor silenciosamente (sin emitir SSE porque estaba desconectado)
  const nuevos = datosProyectoBase('Actualizado durante corte SSE');
  es.close(); // que no reciba el evento SSE directo
  servidor.establecerEnServidor(nuevos);

  // Al reconectar (onopen), revalida el ETag y recarga automáticamente
  await es.onopen();
  assert.equal(App.estado.datos.proyecto.nombre, 'Actualizado durante corte SSE');

  App.desconectarEventosServidor();
});

test('Pestaña Cohete: muestra tareas y entregables juntos en una sola lista unificada y permite filtrar por cualquier fecha (ej. Lunes 19/10)', async (t) => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const dir = path.dirname(fileURLToPath(import.meta.url));
  // guardados/ no se versiona: en un clon recién bajado no hay datos que leer.
  const rutaDatos = path.join(dir, '../guardados/actual.json');
  if (!fs.existsSync(rutaDatos)) {
    t.skip('guardados/actual.json no existe en este clon (no se versiona)');
    return;
  }
  const datosReales = JSON.parse(fs.readFileSync(rutaDatos, 'utf-8'));

  // Los conteos por sección salen de los datos, no de números fijos: el EDT
  // cambia cada semana y antes la prueba fallaba sola al editarlo.
  const hijosDe = (id) => datosReales.actividades.filter(a => a.padre === id);
  const hojasDe = (id) => {
    const hijos = hijosDe(id);
    return hijos.length === 0 ? [id] : hijos.flatMap(h => hojasDe(h.id));
  };
  const totalSeccion = (idEdt) => hojasDe(idEdt).filter(x => x !== idEdt).length;
  const IDS_PARTES = ['ojiva', 'fsup', 'uhv3', 'ssoi', 'finf', 'mee1', '8111', 'fh9r', 'tpnh'];
  const hojasConFin = (fecha) => datosReales.actividades
    .filter(a => hijosDe(a.id).length === 0 && a.fin === fecha);
  const entregablesConFin = (fecha) => hojasConFin(fecha).filter(a => a.tipo === 'entregable');

  const val = M.validar(datosReales);
  assert.equal(val.ok, true, `actual.json debe ser válido: ${val.errores.join(' | ')}`);

  instalarEntornoDOM();
  crearServidorSimulado(datosReales);
  const datos = await A.cargarDesdeServidor();
  App.estado.intervaloAutoguardadoMs = 60000;
  App.estado.pestana = 'cohete';
  App.establecerDatos(datos, { sinGuardar: false, guardarBorrador: false });

  // Existen las 4 pestañas: EDT, Gantt, Tabla, Cohete
  assert.deepEqual(Object.keys(App.dom.pestanas), ['edt', 'gantt', 'tabla', 'cohete']);
  assert.equal(App.dom.pestanas.cohete.textContent, 'Cohete');

  // El diagrama tiene las 7 partes del cohete + los 2 iconos inferiores (doc y redes)
  const partesSvg = App.dom.vistaContenedor.querySelectorAll('.part');
  assert.equal(partesSvg.length, 9);

  // Sin filtro de fecha ("Todas las fechas"): al tocar Soporte del motor ('motor'),
  // aparecen JUNTAS las 6 tareas normales + los 4 entregables del lunes = 10 actividades
  const iconoMotor = partesSvg.find(g => g.getAttribute('data-part') === 'motor');
  assert.ok(iconoMotor);
  iconoMotor.click();
  const itemsMotorTodos = App.dom.vistaContenedor.querySelectorAll('.po-cohete-item');
  assert.equal(
    itemsMotorTodos.length,
    totalSeccion('8111'),
    'Soporte del motor muestra todas sus actividades (tareas y entregables juntos)',
  );

  // Seleccionar el icono de Redes sociales ('redes') y verificar sus tareas
  const iconoRedes = partesSvg.find(g => g.getAttribute('data-part') === 'redes');
  assert.ok(iconoRedes);
  iconoRedes.click();
  const itemsRedes = App.dom.vistaContenedor.querySelectorAll('.po-cohete-item');
  assert.equal(
    itemsRedes.length,
    totalSeccion('tpnh'),
    'Redes sociales y videos muestra todas sus actividades',
  );

  // Filtrar por fecha pulsando el botón rápido "📅 Lunes 19/10" (2026-10-19)
  const botonesFecha = App.dom.vistaContenedor.querySelectorAll('.po-cohete-modo-btn');
  const btnLunes = botonesFecha.find(b => b.dataset.fecha === '2026-10-19');
  assert.ok(btnLunes);
  btnLunes.click();

  // Al pulsar "📅 Lunes 19/10", sincroniza el filtro de fecha global y activa "Ver todos":
  // muestra TODAS las tareas y entregables que se entregan el 2026-10-19 (15 tareas + 12 entregables = 27)
  assert.equal(App.estado.filtros.fecha, '2026-10-19');
  const todosItemsLunes = App.dom.vistaContenedor.querySelectorAll('.po-cohete-item');
  assert.equal(
    todosItemsLunes.length,
    hojasConFin('2026-10-19').length,
    'Ver todos para 2026-10-19 muestra todas las actividades que se entregan ese día',
  );

  // Y si además filtramos por Tipo = "entregable" en la barra superior, muestra exactamente los 12 entregables del lunes en sus 7 secciones
  App.dom.filtroTipo.value = 'entregable';
  App.dom.filtroTipo.dispatchEvent({ type: 'change' });
  const soloEntregablesLunes = App.dom.vistaContenedor.querySelectorAll('.po-cohete-item');
  const cabecerasGrupo = App.dom.vistaContenedor.querySelectorAll('.po-cohete-grupo-hdr');
  assert.equal(
    soloEntregablesLunes.length,
    entregablesConFin('2026-10-19').length,
    'Con filtro tipo=entregable y fecha=2026-10-19 muestra solo los entregables de ese día',
  );
  const idsEntregablesLunes = new Set(entregablesConFin('2026-10-19').map(a => a.id));
  const seccionesConEntregable = IDS_PARTES
    .filter(p => hojasDe(p).some(id => idsEntregablesLunes.has(id)));
  assert.equal(
    cabecerasGrupo.length,
    seccionesConEntregable.length,
    'Agrupados en las secciones del cohete que tienen entregables ese día',
  );

  // Y si tocamos Soporte del motor ('motor'), muestra solo los 4 de esa sección
  const partesSvgFiltradas = App.dom.vistaContenedor.querySelectorAll('.part');
  const iconoMotorFiltrado = partesSvgFiltradas.find(g => g.getAttribute('data-part') === 'motor');
  iconoMotorFiltrado.click();
  const itemsMotorLunes = App.dom.vistaContenedor.querySelectorAll('.po-cohete-item');
  assert.equal(
    itemsMotorLunes.length,
    hojasDe('8111').filter(id => idsEntregablesLunes.has(id)).length,
    'Soporte del motor en 2026-10-19 muestra solo sus entregables de ese día',
  );

  // Volver a "Todas las fechas" limpia el filtro de fecha
  const botonesFechaDespues = App.dom.vistaContenedor.querySelectorAll('.po-cohete-modo-btn');
  const btnTodasFechas = botonesFechaDespues.find(b => b.dataset.fecha === '');
  btnTodasFechas.click();
  assert.equal(App.estado.filtros.fecha, '');

  App.desconectarEventosServidor();
});
