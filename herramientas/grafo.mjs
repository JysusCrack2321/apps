#!/usr/bin/env node
/**
 * herramientas/grafo.mjs
 * Extrae y mantiene el grafo de código (nodos, aristas de imports, llamadas, api y externas).
 * Sin dependencias, solo Node.js estándar.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APPS_DIR = path.resolve(__dirname, '..');

// Palabras reservadas que NO son llamadas a funciones
const JS_KEYWORDS = new Set([
  'if', 'for', 'while', 'do', 'switch', 'case', 'catch', 'function', 'constructor',
  'return', 'throw', 'typeof', 'delete', 'super', 'import', 'await', 'async',
  'new', 'void', 'yield', 'export', 'default', 'class', 'extends', 'break', 'continue',
  'let', 'const', 'var', 'in', 'of', 'instanceof'
]);

// Objetos y funciones globales nativas
const JS_BUILTIN_GLOBALS = new Set([
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURI', 'decodeURI',
  'encodeURIComponent', 'decodeURIComponent', 'setTimeout', 'clearTimeout',
  'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
  'alert', 'confirm', 'prompt', 'structuredClone',
  'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'Math', 'JSON',
  'RegExp', 'Error', 'Promise', 'Set', 'Map', 'WeakSet', 'WeakMap',
  'console', 'document', 'window', 'localStorage', 'sessionStorage',
  'Event', 'CustomEvent', 'FileReader', 'Blob', 'URL', 'URLSearchParams',
  'FormData', 'Headers', 'Response', 'Request', 'Intl', 'Symbol', 'Proxy',
  'Reflect', 'EventSource', 'd3', 'ctx', 'canvas', 'Option', 'ResizeObserver'
]);

// Métodos estándar de prototipos (Array, String, Object, DOM, Canvas, D3, etc.)
const EXTERNAL_METHODS = new Set([
  // Array & iterables
  'push', 'pop', 'shift', 'unshift', 'slice', 'splice', 'indexOf', 'lastIndexOf',
  'includes', 'join', 'concat', 'forEach', 'map', 'filter', 'reduce', 'reduceRight',
  'find', 'findIndex', 'findLast', 'findLastIndex', 'some', 'every', 'sort', 'reverse',
  'flat', 'flatMap', 'fill', 'keys', 'values', 'entries', 'at',
  // String
  'split', 'trim', 'trimStart', 'trimEnd', 'toLowerCase', 'toUpperCase',
  'toLocaleLowerCase', 'toLocaleUpperCase', 'startsWith', 'endsWith', 'substring',
  'substr', 'match', 'matchAll', 'search', 'charAt', 'charCodeAt', 'codePointAt',
  'replace', 'replaceAll', 'padStart', 'padEnd', 'repeat', 'localeCompare',
  // Object, Map, Set
  'has', 'add', 'get', 'set', 'delete', 'clear', 'assign', 'freeze', 'fromEntries',
  'hasOwn', 'hasOwnProperty', 'isPrototypeOf',
  // Promise & async
  'then', 'catch', 'finally', 'resolve', 'reject', 'all', 'race', 'allSettled',
  // DOM / Node / EventTarget
  'addEventListener', 'removeEventListener', 'dispatchEvent', 'preventDefault',
  'stopPropagation', 'stopImmediatePropagation', 'querySelector', 'querySelectorAll',
  'getElementById', 'getElementsByClassName', 'getElementsByTagName', 'createElement',
  'appendChild', 'removeChild', 'replaceChild', 'replaceChildren', 'insertBefore',
  'setAttribute', 'getAttribute', 'removeAttribute', 'hasAttribute', 'contains',
  'closest', 'matches', 'append', 'prepend', 'remove', 'focus', 'blur', 'click',
  'select', 'reset', 'submit', 'close', 'open', 'scrollIntoView', 'scrollTo',
  'scrollBy', 'getBoundingClientRect', 'insertAdjacentHTML', 'insertAdjacentElement',
  'cloneNode', 'showModal', 'observe', 'unobserve', 'disconnect',
  'setPointerCapture', 'releasePointerCapture', 'toggle',
  // Canvas 2D
  'fillRect', 'strokeRect', 'clearRect', 'beginPath', 'closePath', 'moveTo', 'lineTo',
  'arc', 'fill', 'stroke', 'fillText', 'strokeText', 'measureText', 'save', 'restore',
  'translate', 'scale', 'rotate', 'drawImage', 'setLineDash', 'getLineDash',
  'createLinearGradient', 'clip', 'roundRect', 'getContext', 'toBlob',
  // D3
  'select', 'selectAll', 'attr', 'style', 'classed', 'text', 'html', 'data',
  'enter', 'exit', 'datum', 'call', 'transition', 'duration', 'ease', 'node',
  'zoom', 'scaleTime', 'scaleLinear', 'axisBottom', 'axisLeft', 'timeFormat',
  'drag', 'descendants', 'links', 'on', 'each',
  // Math & Date
  'now', 'abs', 'min', 'max', 'floor', 'ceil', 'round', 'sqrt', 'random', 'trunc',
  'getTime', 'getFullYear', 'getMonth', 'getDate', 'getDay', 'getHours', 'getMinutes',
  'getSeconds', 'getMilliseconds', 'getUTCFullYear', 'getUTCMonth', 'getUTCDate',
  'getUTCDay', 'getUTCHours', 'getUTCMinutes', 'getUTCSeconds', 'toISOString',
  'toDateString', 'toLocaleDateString', 'toLocaleTimeString', 'toLocaleString', 'UTC',
  'setDate', 'setMonth', 'setFullYear', 'setHours', 'setMinutes', 'setSeconds',
  // Console & util
  'log', 'warn', 'error', 'info', 'table', 'dir', 'time', 'timeEnd', 'test', 'exec',
  'toString', 'valueOf', 'json', 'blob', 'arrayBuffer', 'formData', 'readAsText',
  'readAsDataURL', 'readAsArrayBuffer', 'getItem', 'setItem', 'removeItem',
  'matchMedia', 'createObjectURL', 'revokeObjectURL'
]);

/**
 * Reemplaza comentarios y cadenas (fuera de ${...} en plantillas) por espacios,
 * preservando exactamente la longitud y los saltos de línea (\n).
 */
function limpiarComentariosYStrings(src) {
  let res = '';
  let i = 0;
  const n = src.length;
  let estado = 'CODE'; // CODE, LINE_COMMENT, BLOCK_COMMENT, STRING_SINGLE, STRING_DOUBLE, TEMPLATE_TEXT
  const templateStack = [];

  while (i < n) {
    const ch = src[i];
    const sig = src[i + 1];

    if (estado === 'CODE') {
      if (ch === '/' && sig === '/') {
        estado = 'LINE_COMMENT';
        res += '  ';
        i += 2;
      } else if (ch === '/' && sig === '*') {
        estado = 'BLOCK_COMMENT';
        res += '  ';
        i += 2;
      } else if (ch === '/') {
        const previoNoEspacio = res.trimEnd().slice(-1);
        const operadoresRegex = '(=:[,!&|?{;~^%<>';
        if (operadoresRegex.includes(previoNoEspacio) || !previoNoEspacio) {
          estado = 'REGEX';
          res += ' ';
          i++;
        } else {
          res += ch;
          i++;
        }
      } else if (ch === "'") {
        estado = 'STRING_SINGLE';
        res += ' ';
        i++;
      } else if (ch === '"') {
        estado = 'STRING_DOUBLE';
        res += ' ';
        i++;
      } else if (ch === '`') {
        estado = 'TEMPLATE_TEXT';
        res += ' ';
        i++;
      } else {
        if (templateStack.length > 0) {
          if (ch === '{') {
            templateStack[templateStack.length - 1]++;
          } else if (ch === '}') {
            templateStack[templateStack.length - 1]--;
            if (templateStack[templateStack.length - 1] === 0) {
              templateStack.pop();
              estado = 'TEMPLATE_TEXT';
              res += ' ';
              i++;
              continue;
            }
          }
        }
        res += ch;
        i++;
      }
    } else if (estado === 'LINE_COMMENT') {
      if (ch === '\n') {
        estado = 'CODE';
        res += '\n';
      } else {
        res += ' ';
      }
      i++;
    } else if (estado === 'BLOCK_COMMENT') {
      if (ch === '*' && sig === '/') {
        estado = 'CODE';
        res += '  ';
        i += 2;
      } else if (ch === '\n') {
        res += '\n';
        i++;
      } else {
        res += ' ';
        i++;
      }
    } else if (estado === 'STRING_SINGLE') {
      if (ch === '\\') {
        res += (sig === '\n' ? '\\\n' : '  ');
        i += 2;
      } else if (ch === "'") {
        estado = 'CODE';
        res += ' ';
        i++;
      } else if (ch === '\n') {
        res += '\n';
        i++;
      } else {
        res += ' ';
        i++;
      }
    } else if (estado === 'STRING_DOUBLE') {
      if (ch === '\\') {
        res += (sig === '\n' ? '\\\n' : '  ');
        i += 2;
      } else if (ch === '"') {
        estado = 'CODE';
        res += ' ';
        i++;
      } else if (ch === '\n') {
        res += '\n';
        i++;
      } else {
        res += ' ';
        i++;
      }
    } else if (estado === 'REGEX') {
      if (ch === '\\') {
        res += (sig === '\n' ? '\\\n' : '  ');
        i += 2;
      } else if (ch === '[') {
        estado = 'REGEX_CLASS';
        res += ' ';
        i++;
      } else if (ch === '/') {
        estado = 'CODE';
        res += ' ';
        i++;
      } else if (ch === '\n') {
        estado = 'CODE';
        res += '\n';
        i++;
      } else {
        res += ' ';
        i++;
      }
    } else if (estado === 'REGEX_CLASS') {
      if (ch === '\\') {
        res += (sig === '\n' ? '\\\n' : '  ');
        i += 2;
      } else if (ch === ']') {
        estado = 'REGEX';
        res += ' ';
        i++;
      } else if (ch === '\n') {
        estado = 'CODE';
        res += '\n';
        i++;
      } else {
        res += ' ';
        i++;
      }
    } else if (estado === 'TEMPLATE_TEXT') {
      if (ch === '\\') {
        res += (sig === '\n' ? '\\\n' : '  ');
        i += 2;
      } else if (ch === '$' && sig === '{') {
        templateStack.push(1);
        estado = 'CODE';
        res += '  ';
        i += 2;
      } else if (ch === '`') {
        estado = 'CODE';
        res += ' ';
        i++;
      } else if (ch === '\n') {
        res += '\n';
        i++;
      } else {
        res += ' ';
        i++;
      }
    }
  }
  return res;
}

/**
 * Obtiene el número de línea (1-based) a partir del índice de caracter.
 */
function indiceALinea(codigo, indice) {
  let linea = 1;
  for (let i = 0; i < indice && i < codigo.length; i++) {
    if (codigo[i] === '\n') linea++;
  }
  return linea;
}

/**
 * Encuentra el índice del delimitador de cierre correspondiente respetando el anidamiento.
 */
function encontrarCierre(codigo, inicio, abre = '{', cierra = '}') {
  let nivel = 0;
  for (let i = inicio; i < codigo.length; i++) {
    const ch = codigo[i];
    if (ch === abre) nivel++;
    else if (ch === cierra) {
      nivel--;
      if (nivel === 0) return i;
    }
  }
  return -1;
}

/**
 * Extrae imports de un archivo JavaScript antes de limpiar strings.
 */
function extraerImports(codigoOriginal, relPath) {
  const imports = [];
  const patronImport = /import\s+(?:([\s\S]*?)\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;

  while ((match = patronImport.exec(codigoOriginal)) !== null) {
    const clausula = match[1] ? match[1].trim() : '';
    const rutaOrigen = match[2];

    let rutaNormalizada = rutaOrigen;
    if (rutaOrigen.startsWith('.')) {
      const dir = path.dirname(relPath);
      rutaNormalizada = path.normalize(path.join(dir, rutaOrigen)).replace(/\\/g, '/');
    }

    const especificaciones = [];
    if (clausula) {
      if (clausula.startsWith('* as ')) {
        const alias = clausula.slice(5).trim();
        especificaciones.push({ importado: '*', alias, esNamespace: true });
      } else if (clausula.startsWith('{') && clausula.endsWith('}')) {
        const partes = clausula.slice(1, -1).split(',');
        for (const parte of partes) {
          const p = parte.trim();
          if (!p) continue;
          if (p.includes(' as ')) {
            const [orig, alias] = p.split(/\s+as\s+/);
            especificaciones.push({ importado: orig.trim(), alias: alias.trim(), esNamespace: false });
          } else {
            especificaciones.push({ importado: p, alias: p, esNamespace: false });
          }
        }
      } else {
        especificaciones.push({ importado: 'default', alias: clausula, esNamespace: false });
      }
    }

    imports.push({
      modulo: rutaNormalizada,
      rutaOrigen,
      especificaciones
    });
  }

  return imports;
}

/**
 * Extrae llamadas a fetch('/api/...') desde el código original.
 */
function extraerFetchesOriginales(codigoOriginal, relPath) {
  const fetches = [];
  const patronFetch = /\bfetch\s*\(\s*(['"`])([^'"`]+)\1(?:\s*,\s*(\{[\s\S]*?\}))?\s*\)/g;
  let mFetch;

  while ((mFetch = patronFetch.exec(codigoOriginal)) !== null) {
    let url = mFetch[2];
    const opciones = mFetch[3] || '';
    let metodo = 'GET';
    const mMetodo = opciones.match(/method\s*:\s*['"](GET|POST|PUT|DELETE|HEAD|PATCH)['"]/i);
    if (mMetodo) {
      metodo = mMetodo[1].toUpperCase();
    }

    if (url.startsWith('/') || url.startsWith('api/')) {
      fetches.push({
        ruta: url.startsWith('/') ? url : '/' + url,
        metodo,
        indice: mFetch.index,
        linea: indiceALinea(codigoOriginal, mFetch.index)
      });
    }
  }

  return fetches;
}

/**
 * Extrae nodos (funciones y métodos) con sus rangos de cuerpo en JavaScript.
 */
function extraerNodosJS(codigoLimpio, relPath) {
  const nodos = [];
  const clases = new Map();

  // 1. Clases y métodos
  const patronClase = /(?:export\s+)?class\s+([a-zA-Z0-9_$]+)(?:\s+extends\s+[a-zA-Z0-9_$]+)?\s*\{/g;
  let match;
  while ((match = patronClase.exec(codigoLimpio)) !== null) {
    const nombreClase = match[1];
    const inicioLlave = match.index + match[0].length - 1;
    const finLlave = encontrarCierre(codigoLimpio, inicioLlave, '{', '}');
    const linea = indiceALinea(codigoLimpio, match.index);

    const infoClase = {
      nombre: nombreClase,
      linea,
      inicio: inicioLlave,
      fin: finLlave !== -1 ? finLlave : codigoLimpio.length,
      metodos: []
    };
    clases.set(nombreClase, infoClase);

    // Métodos dentro de la clase (manejando parámetros anidados)
    if (finLlave !== -1) {
      const cuerpoClase = codigoLimpio.slice(inicioLlave + 1, finLlave);
      const patronInicioMetodo = /(?:(?:static|async|get|set)\s+)*([a-zA-Z0-9_$]+)\s*\(/g;
      let mMetodo;
      while ((mMetodo = patronInicioMetodo.exec(cuerpoClase)) !== null) {
        const nombreMetodo = mMetodo[1];
        if (JS_KEYWORDS.has(nombreMetodo)) continue;

        const posAbsoluta = inicioLlave + 1 + mMetodo.index;
        const posAbrePar = posAbsoluta + mMetodo[0].length - 1;
        const posCierraPar = encontrarCierre(codigoLimpio, posAbrePar, '(', ')');
        if (posCierraPar === -1) continue;

        const despuesPar = codigoLimpio.slice(posCierraPar + 1).search(/\S/);
        if (despuesPar === -1 || codigoLimpio[posCierraPar + 1 + despuesPar] !== '{') continue;

        const inicioCuerpoMetodo = posCierraPar + 1 + despuesPar;
        const finCuerpoMetodo = encontrarCierre(codigoLimpio, inicioCuerpoMetodo, '{', '}');
        const lineaMetodo = indiceALinea(codigoLimpio, posAbsoluta);

        const idNodo = `${relPath}:${nombreClase}.${nombreMetodo}`;
        const nodo = {
          id: idNodo,
          nombre: `${nombreClase}.${nombreMetodo}`,
          nombreSimple: nombreMetodo,
          archivo: relPath,
          linea: lineaMetodo,
          tipo: 'metodo',
          clase: nombreClase,
          cuerpoInicio: inicioCuerpoMetodo,
          cuerpoFin: finCuerpoMetodo !== -1 ? finCuerpoMetodo : inicioCuerpoMetodo + 1,
          exportada: codigoLimpio.slice(Math.max(0, match.index - 10), match.index).includes('export')
        };
        nodos.push(nodo);
        infoClase.metodos.push(nodo);
      }
    }
  }

  // 2. Funciones estándar (function foo(params) { ... })
  const patronFuncion = /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(/g;
  while ((match = patronFuncion.exec(codigoLimpio)) !== null) {
    const nombre = match[1];
    const pos = match.index;

    // Saltar si está dentro de una clase
    let dentroDeClase = false;
    for (const info of clases.values()) {
      if (pos >= info.inicio && pos <= info.fin) {
        dentroDeClase = true;
        break;
      }
    }
    if (dentroDeClase) continue;

    const posAbrePar = pos + match[0].length - 1;
    const posCierraPar = encontrarCierre(codigoLimpio, posAbrePar, '(', ')');
    if (posCierraPar === -1) continue;

    const despuesPar = codigoLimpio.slice(posCierraPar + 1).search(/\S/);
    if (despuesPar === -1 || codigoLimpio[posCierraPar + 1 + despuesPar] !== '{') continue;

    const inicioLlave = posCierraPar + 1 + despuesPar;
    const finLlave = encontrarCierre(codigoLimpio, inicioLlave, '{', '}');
    const linea = indiceALinea(codigoLimpio, pos);
    const esExportada = match[0].startsWith('export');

    nodos.push({
      id: `${relPath}:${nombre}`,
      nombre,
      nombreSimple: nombre,
      archivo: relPath,
      linea,
      tipo: 'funcion',
      cuerpoInicio: inicioLlave,
      cuerpoFin: finLlave !== -1 ? finLlave : inicioLlave + 1,
      exportada: esExportada
    });
  }

  // 3. Funciones flecha y expresiones asignadas: const foo = (...) => { ... } o const foo = (...) => expr;
  const patronAsignacion = /(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:\(([^)]*)\)|([a-zA-Z0-9_$]+))\s*=>/g;
  while ((match = patronAsignacion.exec(codigoLimpio)) !== null) {
    const nombre = match[1];
    const pos = match.index;

    let dentroDeClase = false;
    for (const info of clases.values()) {
      if (pos >= info.inicio && pos <= info.fin) {
        dentroDeClase = true;
        break;
      }
    }
    if (dentroDeClase) continue;

    const linea = indiceALinea(codigoLimpio, pos);
    const esExportada = match[0].startsWith('export');

    const resto = codigoLimpio.slice(match.index + match[0].length);
    const primerCharPos = resto.search(/\S/);
    if (primerCharPos !== -1) {
      const idxGlobal = match.index + match[0].length + primerCharPos;
      if (codigoLimpio[idxGlobal] === '{') {
        const finLlave = encontrarCierre(codigoLimpio, idxGlobal, '{', '}');
        nodos.push({
          id: `${relPath}:${nombre}`,
          nombre,
          nombreSimple: nombre,
          archivo: relPath,
          linea,
          tipo: 'funcion',
          cuerpoInicio: idxGlobal,
          cuerpoFin: finLlave !== -1 ? finLlave : idxGlobal + 1,
          exportada: esExportada
        });
      } else {
        // Flecha concisa (sin llave): termina en punto y coma o fin de línea
        let finConciso = codigoLimpio.indexOf(';', idxGlobal);
        const finLinea = codigoLimpio.indexOf('\n', idxGlobal);
        if (finConciso === -1 || (finLinea !== -1 && finLinea < finConciso)) {
          finConciso = finLinea !== -1 ? finLinea : codigoLimpio.length;
        }
        nodos.push({
          id: `${relPath}:${nombre}`,
          nombre,
          nombreSimple: nombre,
          archivo: relPath,
          linea,
          tipo: 'funcion',
          cuerpoInicio: idxGlobal,
          cuerpoFin: finConciso,
          exportada: esExportada
        });
      }
    }
  }

  return { nodos, clases };
}

/**
 * Encuentra el nodo función o método más interno que contiene una posición de caracter.
 */
function encontrarNodoContenedor(nodos, pos) {
  let candidato = null;
  let menorTamano = Infinity;

  for (const n of nodos) {
    if (pos >= n.cuerpoInicio && pos <= n.cuerpoFin) {
      const tamano = n.cuerpoFin - n.cuerpoInicio;
      if (tamano < menorTamano) {
        menorTamano = tamano;
        candidato = n;
      }
    }
  }

  return candidato;
}

/**
 * Escanea llamadas que pasan objetos como argumentos: func(..., { prop: valor })
 * para resolver inyección de dependencias o funciones pasadas como parámetros.
 */
function escanearFuncionesEnObjetos(archivosInfo) {
  const mapaResolucion = new Map(); // "archivoDestino:nombreParam" -> "archivoOrigen:nombreFuncion"

  for (const info of archivosInfo) {
    const patronLlamadaSimple = /(?:new\s+)?([a-zA-Z0-9_$]+)\s*\(/g;
    let match;

    while ((match = patronLlamadaSimple.exec(info.codigoLimpio)) !== null) {
      const funcLlamada = match[1];
      const idxAbrePar = match.index + match[0].length - 1;
      const idxCierraPar = encontrarCierre(info.codigoLimpio, idxAbrePar, '(', ')');
      if (idxCierraPar === -1) continue;

      const argsStr = info.codigoLimpio.slice(idxAbrePar + 1, idxCierraPar);
      const idxObjAbre = argsStr.indexOf('{');
      if (idxObjAbre === -1) continue;
      const idxObjCierre = encontrarCierre(argsStr, idxObjAbre, '{', '}');
      if (idxObjCierre === -1) continue;

      const contenidoObj = argsStr.slice(idxObjAbre + 1, idxObjCierre);

      // Determinar a qué archivos apunta funcLlamada
      const archivosDestino = [];
      if (funcLlamada === 'creador') {
        // En app.js creador toma valores de vistaEdt, vistaGantt, vistaTabla
        for (const imp of info.imports) {
          if (imp.modulo.includes('vistas/')) {
            archivosDestino.push(imp.modulo);
          }
        }
      } else {
        let arch = null;
        for (const imp of info.imports) {
          for (const esp of imp.especificaciones) {
            if (!esp.esNamespace && esp.alias === funcLlamada) {
              arch = imp.modulo;
              break;
            }
          }
          if (arch) break;
        }

        if (!arch) {
          const local = info.nodos.find(n => n.nombreSimple === funcLlamada);
          if (local) arch = info.relPath;
        }

        if (arch) archivosDestino.push(arch);
      }

      if (archivosDestino.length === 0) continue;

      // Parsear las propiedades del objeto: { aplicar: aplicar, alSeleccionar: manejarSeleccion }
      const pares = contenidoObj.split(',');
      for (const par of pares) {
        const p = par.trim();
        if (!p) continue;
        let clave = p;
        let valor = p;
        if (p.includes(':')) {
          const partes = p.split(':');
          clave = partes[0].trim();
          valor = partes[1].trim();
        }

        // Resolver valor en el archivo llamador
        let idResuelto = null;
        const matchThisMetodo = valor.match(/this\.([a-zA-Z0-9_$]+)\s*\(/);
        if (matchThisMetodo) {
          const metNom = matchThisMetodo[1];
          const nodoMet = info.nodos.find(n => n.nombreSimple === metNom);
          if (nodoMet) idResuelto = nodoMet.id;
        }

        if (!idResuelto) {
          for (const imp of info.imports) {
            for (const esp of imp.especificaciones) {
              if (!esp.esNamespace && esp.alias === valor) {
                idResuelto = `${imp.modulo}:${esp.importado}`;
                break;
              }
            }
            if (idResuelto) break;
          }
        }

        if (!idResuelto) {
          const nodoLocal = info.nodos.find(n => n.nombreSimple === valor);
          if (nodoLocal) idResuelto = nodoLocal.id;
        }

        if (idResuelto) {
          for (const ad of archivosDestino) {
            mapaResolucion.set(`${ad}:${clave}`, idResuelto);
          }
          if (clave === 'alSeleccionar') {
            mapaResolucion.set('*:alSeleccionar', idResuelto);
          }
        }
      }
    }
  }

  return mapaResolucion;
}

/**
 * Extrae llamadas dentro de un archivo JavaScript.
 */
function extraerLlamadasArchivoJS(info, todosLosNodosMap, mapaContextoObjetos) {
  const aristas = [];
  const codigo = info.codigoLimpio;

  // 1. fetch('/api/...')
  for (const f of info.fetches) {
    const contenedor = encontrarNodoContenedor(info.nodos, f.indice);
    if (!contenedor) continue;

    aristas.push({
      tipo: 'api',
      origen: contenedor.id,
      destino: null, // se resuelve luego con servidor.py
      ruta: f.ruta,
      metodo: f.metodo,
      linea: f.linea
    });
  }

  // 2. Llamadas a funciones y métodos
  const patronLlamada = /(?:(\bthis\b|[a-zA-Z0-9_$]+)\.)?([a-zA-Z0-9_$]+)\s*\(/g;
  let match;

  while ((match = patronLlamada.exec(codigo)) !== null) {
    const objeto = match[1];
    const func = match[2];
    const pos = match.index;
    const linea = indiceALinea(codigo, pos);

    if (JS_KEYWORDS.has(func)) continue;
    if (func === 'fetch') continue;

    const contenedor = encontrarNodoContenedor(info.nodos, pos);
    if (!contenedor) continue;

    // Caso A: Llamada a método (objeto.metodo(...) o this.metodo(...))
    if (objeto) {
      if (objeto === 'this') {
        if (contenedor.clase) {
          const targetId = `${info.relPath}:${contenedor.clase}.${func}`;
          if (todosLosNodosMap.has(targetId)) {
            aristas.push({
              tipo: 'llama',
              origen: contenedor.id,
              destino: targetId,
              dudosa: false,
              linea
            });
            continue;
          }
        }
        if (EXTERNAL_METHODS.has(func)) {
          aristas.push({
            tipo: 'externa',
            origen: contenedor.id,
            destino: `this.${func}`,
            dudosa: false,
            linea
          });
          continue;
        }
        aristas.push({
          tipo: 'llama',
          origen: contenedor.id,
          destino: `this.${func}`,
          dudosa: true,
          linea
        });
        continue;
      }

      // Métodos de la clase Editor: editor.abrir, editor.cerrar, editor.mostrar
      if (objeto === 'editor' && (func === 'abrir' || func === 'cerrar')) {
        const nodoMetodo = todosLosNodosMap.get(`comun/editor.js:Editor.${func}`) ||
          Array.from(todosLosNodosMap.values()).find(n => n.clase === 'Editor' && n.nombreSimple === func);
        if (nodoMetodo) {
          aristas.push({
            tipo: 'llama',
            origen: contenedor.id,
            destino: nodoMetodo.id,
            dudosa: false,
            linea
          });
          continue;
        }
      }

      if (objeto === 'editor' && func === 'mostrar') {
        const nodoMostrar = todosLosNodosMap.get('comun/editor.js:mostrar');
        if (nodoMostrar) {
          aristas.push({
            tipo: 'llama',
            origen: contenedor.id,
            destino: nodoMostrar.id,
            dudosa: false,
            linea
          });
          continue;
        }
      }

      // Callbacks pasados en objeto eventos: this.eventos.onSeleccionar(...)
      if (objeto === 'eventos') {
        const claveInyectada = `${info.relPath}:${func}`;
        if (mapaContextoObjetos.has(claveInyectada)) {
          const idDestino = mapaContextoObjetos.get(claveInyectada);
          aristas.push({
            tipo: 'llama',
            origen: contenedor.id,
            destino: idDestino,
            dudosa: false,
            linea
          });
          continue;
        }
      }

      // Bibliotecas externas explícitas: d3.*, ctx.*, canvas.*
      if (objeto === 'd3' || objeto === 'ctx' || objeto === 'canvas') {
        aristas.push({
          tipo: 'externa',
          origen: contenedor.id,
          destino: `${objeto}.${func}`,
          dudosa: false,
          linea
        });
        continue;
      }

      // Namespace import: import * as M from './modelo.js'; M.editarActividad(...)
      let namespaceResuelto = false;
      for (const imp of info.imports) {
        for (const esp of imp.especificaciones) {
          if (esp.esNamespace && esp.alias === objeto) {
            if (imp.modulo.startsWith('http://') || imp.modulo.startsWith('https://') || imp.modulo === 'd3') {
              aristas.push({
                tipo: 'externa',
                origen: contenedor.id,
                destino: `${objeto}.${func}`,
                dudosa: false,
                linea
              });
              namespaceResuelto = true;
              break;
            }
            const candidatoId = `${imp.modulo}:${func}`;
            const target = todosLosNodosMap.get(candidatoId);
            aristas.push({
              tipo: 'llama',
              origen: contenedor.id,
              destino: target ? target.id : candidatoId,
              dudosa: !target,
              linea
            });
            namespaceResuelto = true;
            break;
          }
        }
        if (namespaceResuelto) break;
      }
      if (namespaceResuelto) continue;

      // Métodos y objetos nativos / DOM / Canvas / D3 -> externa
      if (JS_BUILTIN_GLOBALS.has(objeto) || EXTERNAL_METHODS.has(func)) {
        aristas.push({
          tipo: 'externa',
          origen: contenedor.id,
          destino: `${objeto}.${func}`,
          dudosa: false,
          linea
        });
        continue;
      }

      // Llamada sobre objeto no resoluble con certeza
      aristas.push({
        tipo: 'llama',
        origen: contenedor.id,
        destino: `${objeto}.${func}`,
        dudosa: true,
        linea
      });
      continue;
    }

    // Caso B: Llamada directa a función: func(...)
    // 1. ¿Es función/global nativa? (parseInt, setTimeout, etc.)
    if (JS_BUILTIN_GLOBALS.has(func) || EXTERNAL_METHODS.has(func)) {
      aristas.push({
        tipo: 'externa',
        origen: contenedor.id,
        destino: func,
        dudosa: false,
        linea
      });
      continue;
    }

    // 2. ¿Viene inyectada como propiedad de objeto pasado al módulo? (ej. { aplicar, alSeleccionar })
    const claveInyectada = `${info.relPath}:${func}`;
    if (mapaContextoObjetos.has(claveInyectada) || (func === 'alSeleccionar' && mapaContextoObjetos.has('*:alSeleccionar'))) {
      const idDestino = mapaContextoObjetos.get(claveInyectada) || mapaContextoObjetos.get('*:alSeleccionar');
      aristas.push({
        tipo: 'llama',
        origen: contenedor.id,
        destino: idDestino,
        dudosa: false,
        linea
      });
      continue;
    }

    // 3. ¿Es una función importada?
    let resueltoImport = false;
    for (const imp of info.imports) {
      for (const esp of imp.especificaciones) {
        if (!esp.esNamespace && esp.alias === func) {
          const nombreOriginal = esp.importado;
          const targetId = `${imp.modulo}:${nombreOriginal}`;
          const target = todosLosNodosMap.get(targetId);
          aristas.push({
            tipo: 'llama',
            origen: contenedor.id,
            destino: target ? target.id : targetId,
            dudosa: !target,
            linea
          });
          resueltoImport = true;
          break;
        }
      }
      if (resueltoImport) break;
    }
    if (resueltoImport) continue;

    // 4. ¿Es una función local en este archivo?
    const local = info.nodos.find(n => n.nombreSimple === func && n.id !== contenedor.id);
    if (local) {
      aristas.push({
        tipo: 'llama',
        origen: contenedor.id,
        destino: local.id,
        dudosa: false,
        linea
      });
      continue;
    }

    // 5. Llamada no resoluble con certeza -> marcar como dudosa
    aristas.push({
      tipo: 'llama',
      origen: contenedor.id,
      destino: func,
      dudosa: true,
      linea
    });
  }

  return aristas;
}

/**
 * Extrae nodos y rutas HTTP de un servidor Python (servidor.py).
 */
function extraerNodosPython(codigoFuente, relPath) {
  const lineas = codigoFuente.split('\n');
  const nodos = [];
  const rutas = []; // { metodo, ruta, handlerId, linea }
  let claseActual = null;
  let claseIndent = 0;

  for (let idx = 0; idx < lineas.length; idx++) {
    const numLinea = idx + 1;
    const linea = lineas[idx];
    const trimmed = linea.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = linea.search(/\S/);

    // Detección de clases
    const mClase = trimmed.match(/^class\s+([a-zA-Z0-9_]+)/);
    if (mClase) {
      claseActual = mClase[1];
      claseIndent = indent;
      continue;
    }

    if (claseActual && indent <= claseIndent) {
      claseActual = null;
    }

    // Detección de funciones / métodos
    const mDef = trimmed.match(/^def\s+([a-zA-Z0-9_]+)\s*\(/);
    if (mDef) {
      const nombreDef = mDef[1];
      const nombreCompleto = claseActual ? `${claseActual}.${nombreDef}` : nombreDef;
      nodos.push({
        id: `${relPath}:${nombreCompleto}`,
        nombre: nombreCompleto,
        nombreSimple: nombreDef,
        archivo: relPath,
        linea: numLinea,
        tipo: claseActual ? 'metodo' : 'funcion',
        clase: claseActual
      });
    }

    // Detección de rutas /api en handlers
    const mRuta = trimmed.match(/(?:if|elif)\s+.*?(?:ruta|ruta_limpia|self\.path)\s*(?:==|\.startswith\()\s*['"](\/?[a-zA-Z0-9_\-\/]+)['"]/);
    if (mRuta) {
      let ruta = mRuta[1];
      if (!ruta.startsWith('/')) ruta = '/' + ruta;

      // Buscar llamada auxiliar en las siguientes líneas indentadas
      let handlerNombre = null;
      for (let j = idx + 1; j < Math.min(lineas.length, idx + 8); j++) {
        const lineaSig = lineas[j].trim();
        if (!lineaSig || lineaSig.startsWith('#')) continue;
        const indentSig = lineas[j].search(/\S/);
        if (indentSig <= indent) break;

        const mHandler = lineaSig.match(/(?:self\.)?([a-zA-Z0-9_]+)\s*\(/);
        if (mHandler) {
          const candidato = mHandler[1];
          if (!['send_response', 'send_header', 'end_headers', 'responder_error', 'enviar_json', 'responder_json'].includes(candidato)) {
            handlerNombre = candidato;
            break;
          }
        }
      }

      // Determinar método HTTP (GET o POST) según en qué def estamos
      let metodoHttp = 'GET';
      for (let k = idx; k >= 0; k--) {
        if (lineas[k].includes('def do_POST')) {
          metodoHttp = 'POST';
          break;
        } else if (lineas[k].includes('def do_GET')) {
          metodoHttp = 'GET';
          break;
        }
      }

      rutas.push({
        ruta,
        metodo: metodoHttp,
        handlerSimple: handlerNombre,
        linea: numLinea
      });
    }
  }

  // Asignar handler ID completo
  for (const r of rutas) {
    if (r.handlerSimple) {
      const nodoH = nodos.find(n => n.nombreSimple === r.handlerSimple);
      r.handlerId = nodoH ? nodoH.id : `${relPath}:${r.handlerSimple}`;
    } else {
      const nodoDo = nodos.find(n => n.nombreSimple === (r.metodo === 'POST' ? 'do_POST' : 'do_GET'));
      r.handlerId = nodoDo ? nodoDo.id : `${relPath}:${r.metodo === 'POST' ? 'do_POST' : 'do_GET'}`;
    }
  }

  return { nodos, rutas };
}

/**
 * Extrae llamadas dentro de funciones en Python (servidor.py).
 */
function extraerLlamadasPython(codigoFuente, relPath, nodosPython) {
  const lineas = codigoFuente.split('\n');
  const aristas = [];
  let nodoActual = null;
  let indentActual = 0;

  for (let idx = 0; idx < lineas.length; idx++) {
    const numLinea = idx + 1;
    const linea = lineas[idx];
    const trimmed = linea.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = linea.search(/\S/);

    const mDef = trimmed.match(/^def\s+([a-zA-Z0-9_]+)\s*\(/);
    if (mDef) {
      nodoActual = nodosPython.find(n => n.linea === numLinea);
      indentActual = indent;
      continue;
    }

    if (nodoActual && indent <= indentActual && !trimmed.startsWith('def ')) {
      nodoActual = null;
    }

    if (nodoActual) {
      const patronLlamada = /(?:self\.)?([a-zA-Z0-9_]+)\s*\(/g;
      let match;
      while ((match = patronLlamada.exec(trimmed)) !== null) {
        const func = match[1];
        if (func === nodoActual.nombreSimple) continue;
        const destinoNodo = nodosPython.find(n => n.nombreSimple === func);
        if (destinoNodo) {
          aristas.push({
            tipo: 'llama',
            origen: nodoActual.id,
            destino: destinoNodo.id,
            dudosa: false,
            linea: numLinea
          });
        }
      }
    }
  }

  return aristas;
}

/**
 * Escanea recursivamente un proyecto y construye el grafo de dependencias completo.
 */
export function construirGrafoProyecto(dirProyecto, nombreProyecto) {
  const archivos = [];

  function explorar(dir) {
    const entradas = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entradas) {
      const nombre = ent.name;
      if (nombre.startsWith('.') || nombre === 'respaldos' || nombre === 'guardados' ||
          nombre === 'pruebas' || nombre === 'node_modules' || nombre === '__pycache__') {
        continue;
      }
      const rutaCompleta = path.join(dir, nombre);
      if (ent.isDirectory()) {
        explorar(rutaCompleta);
      } else if (ent.isFile()) {
        const ext = path.extname(nombre).toLowerCase();
        if (['.js', '.mjs', '.py'].includes(ext)) {
          archivos.push(rutaCompleta);
        }
      }
    }
  }

  explorar(dirProyecto);

  const todosLosNodos = [];
  const todosLosNodosMap = new Map();
  const aristasImporta = [];
  const aristasPendientes = [];
  const rutasServidor = [];
  const infoArchivosJS = [];

  // Fase 1: Extracción de nodos y metadatos de archivos
  for (const archivo of archivos) {
    const relPath = path.relative(dirProyecto, archivo).replace(/\\/g, '/');
    const ext = path.extname(archivo).toLowerCase();
    const contenidoOriginal = fs.readFileSync(archivo, 'utf-8');

    if (ext === '.py') {
      const { nodos, rutas } = extraerNodosPython(contenidoOriginal, relPath);
      rutasServidor.push(...rutas);
      for (const n of nodos) {
        todosLosNodos.push(n);
        todosLosNodosMap.set(n.id, n);
      }
      const llamadasPy = extraerLlamadasPython(contenidoOriginal, relPath, nodos);
      aristasPendientes.push(...llamadasPy);
    } else {
      const imports = extraerImports(contenidoOriginal, relPath);
      const fetches = extraerFetchesOriginales(contenidoOriginal, relPath);
      const codigoLimpio = limpiarComentariosYStrings(contenidoOriginal);

      for (const imp of imports) {
        aristasImporta.push({
          tipo: 'importa',
          origen: relPath,
          destino: imp.modulo,
          especificaciones: imp.especificaciones
        });
      }

      const { nodos, clases } = extraerNodosJS(codigoLimpio, relPath);
      for (const n of nodos) {
        todosLosNodos.push(n);
        todosLosNodosMap.set(n.id, n);
      }

      infoArchivosJS.push({
        relPath,
        codigoOriginal: contenidoOriginal,
        codigoLimpio,
        imports,
        fetches,
        nodos,
        clases
      });
    }
  }

  // Fase 2: Escanear inyección de funciones en objetos ({ aplicar: aplicar })
  const mapaContextoObjetos = escanearFuncionesEnObjetos(infoArchivosJS);

  // Fase 3: Extraer llamadas en JavaScript
  for (const info of infoArchivosJS) {
    const llamadas = extraerLlamadasArchivoJS(info, todosLosNodosMap, mapaContextoObjetos);
    aristasPendientes.push(...llamadas);
  }

  // Fase 4: Resolver aristas de tipo 'api' según ruta y método HTTP (GET vs POST)
  const todasLasAristas = [...aristasImporta];
  for (const arista of aristasPendientes) {
    if (arista.tipo === 'api') {
      const rutaNormalizada = arista.ruta.split('?')[0];
      const matchRuta = rutasServidor.find(r => {
        const metodoCoincide = !arista.metodo || r.metodo === arista.metodo;
        const rutaCoincide = r.ruta === rutaNormalizada ||
                             (r.ruta.endsWith('/') && rutaNormalizada.startsWith(r.ruta)) ||
                             rutaNormalizada.startsWith(r.ruta + '/');
        return metodoCoincide && rutaCoincide;
      });

      if (matchRuta && matchRuta.handlerId) {
        arista.destino = matchRuta.handlerId;
        arista.dudosa = false;
      } else {
        arista.destino = `servidor:${arista.ruta}`;
        arista.dudosa = true;
      }
    }
    todasLasAristas.push(arista);
  }

  // Deduplicación por clave completa incluyendo la línea del call site
  const aristasMap = new Map();
  for (const a of todasLasAristas) {
    const lineaClave = a.linea || 0;
    const clave = `${a.tipo}|${a.origen}|${a.destino}|${lineaClave}|${a.dudosa ? 1 : 0}`;
    if (!aristasMap.has(clave)) {
      aristasMap.set(clave, a);
    }
  }
  const aristasFinales = Array.from(aristasMap.values());

  const aristasDudosas = aristasFinales.filter(a => a.dudosa).length;
  const aristasExternas = aristasFinales.filter(a => a.tipo === 'externa').length;
  const aristasResueltas = aristasFinales.filter(a => !a.dudosa && a.tipo !== 'externa').length;
  const aristasInternas = aristasResueltas + aristasDudosas;
  const porcentajeDudosas = aristasInternas > 0
    ? ((aristasDudosas / aristasInternas) * 100).toFixed(1) + '%'
    : '0%';

  return {
    proyecto: nombreProyecto,
    generado: new Date().toISOString(),
    resumen: {
      totalNodos: todosLosNodos.length,
      totalAristas: aristasFinales.length,
      aristasResueltas,
      aristasDudosas,
      aristasExternas,
      porcentajeDudosas
    },
    nodos: todosLosNodos,
    aristas: aristasFinales
  };
}

/**
 * Genera el documento GRAFO.md con diagrama Mermaid y tablas por módulo.
 */
export function generarMarkdownGrafo(grafo) {
  let md = `# Grafo de Código — ${grafo.proyecto}\n\n`;
  md += `Generado automáticamente por \`herramientas/grafo.mjs\`.\n\n`;
  md += `## Resumen\n\n`;
  md += `- **Nodos:** ${grafo.resumen.totalNodos} (funciones y métodos)\n`;
  md += `- **Aristas totales:** ${grafo.resumen.totalAristas}\n`;
  md += `  - **Resueltas:** ${grafo.resumen.aristasResueltas}\n`;
  md += `  - **Dudosas:** ${grafo.resumen.aristasDudosas} (${grafo.resumen.porcentajeDudosas})\n`;
  md += `  - **Externas (nativas/DOM/D3):** ${grafo.resumen.aristasExternas}\n\n`;

  // 1. Diagrama Mermaid de módulos
  md += `## Diagrama de Módulos\n\n`;
  md += `\`\`\`mermaid\ngraph TD\n`;

  const modulosSet = new Set();
  for (const n of grafo.nodos) modulosSet.add(n.archivo);

  function idMermaid(nombre) {
    return nombre.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  for (const mod of modulosSet) {
    md += `  ${idMermaid(mod)}["${mod}"]\n`;
  }

  const aristasModulares = new Set();
  for (const a of grafo.aristas) {
    if (a.tipo === 'externa') continue; // No ensuciar el diagrama modular con nativas
    let origenMod = a.origen.includes(':') ? a.origen.split(':')[0] : a.origen;
    let destinoMod = a.destino && a.destino.includes(':') ? a.destino.split(':')[0] : a.destino;

    if (origenMod && destinoMod && origenMod !== destinoMod && modulosSet.has(origenMod) && modulosSet.has(destinoMod)) {
      const estilo = a.tipo === 'api' ? `-. "api" .->` : `-->`;
      const key = `${idMermaid(origenMod)} ${estilo} ${idMermaid(destinoMod)}`;
      if (!aristasModulares.has(key)) {
        aristasModulares.add(key);
        md += `  ${key}\n`;
      }
    }
  }
  md += `\`\`\`\n\n`;

  // 2. Módulos y tablas de funciones
  md += `## Módulos y Funciones\n\n`;

  const porArchivo = new Map();
  for (const n of grafo.nodos) {
    if (!porArchivo.has(n.archivo)) porArchivo.set(n.archivo, []);
    porArchivo.get(n.archivo).push(n);
  }

  const nodosMap = new Map(grafo.nodos.map(n => [n.id, n]));

  for (const [archivo, nodos] of porArchivo.entries()) {
    md += `### \`${archivo}\`\n\n`;
    md += `| Función / Método | Archivo:Línea | Llamada por | Llama a |\n`;
    md += `|---|---|---|---|\n`;

    for (const nodo of nodos) {
      // Buscar quién llama a este nodo
      const llamadores = [];
      for (const a of grafo.aristas) {
        if ((a.tipo === 'llama' || a.tipo === 'api') && a.destino === nodo.id) {
          const llamadorNodo = nodosMap.get(a.origen);
          const sufijoLinea = a.linea ? ` (L${a.linea})` : '';
          if (llamadorNodo) {
            llamadores.push(`\`${llamadorNodo.nombre}\` (${llamadorNodo.archivo})${sufijoLinea}`);
          } else {
            llamadores.push(`\`${a.origen}\`${sufijoLinea}`);
          }
        }
      }

      // Buscar a quién llama este nodo (ocultando externas de la tabla principal para claridad)
      const llamados = [];
      for (const a of grafo.aristas) {
        if (a.origen === nodo.id) {
          if (a.tipo === 'externa') continue;
          const destinoNodo = nodosMap.get(a.destino);
          const sufijo = a.dudosa ? ' *(dudosa)*' : (a.tipo === 'api' ? ` *(API ${a.metodo} ${a.ruta})*` : '');
          const sufijoLinea = a.linea ? ` (L${a.linea})` : '';
          if (destinoNodo) {
            llamados.push(`\`${destinoNodo.nombre}\` (${destinoNodo.archivo})${sufijoLinea}${sufijo}`);
          } else {
            llamados.push(`\`${a.destino}\`${sufijoLinea}${sufijo}`);
          }
        }
      }

      const strLlamadores = llamadores.length > 0 ? llamadores.join('<br>') : '—';
      const strLlamados = llamados.length > 0 ? llamados.join('<br>') : '—';

      md += `| \`${nodo.nombre}\` | \`${nodo.archivo}:${nodo.linea}\` | ${strLlamadores} | ${strLlamados} |\n`;
    }
    md += `\n`;
  }

  return md;
}

/**
 * Guarda grafo.json y GRAFO.md en la raíz del proyecto.
 */
export function guardarArchivosGrafo(dirProyecto, grafo) {
  const rutaJson = path.join(dirProyecto, 'grafo.json');
  const rutaMd = path.join(dirProyecto, 'GRAFO.md');

  fs.writeFileSync(rutaJson, JSON.stringify(grafo, null, 2) + '\n', 'utf-8');
  const contenidoMd = generarMarkdownGrafo(grafo);
  fs.writeFileSync(rutaMd, contenidoMd, 'utf-8');
}

/**
 * Consulta quién llama a una función.
 */
export function consultarQuienLlama(grafos, funcionBuscada, incluirExternas = false) {
  const resultados = [];

  for (const grafo of grafos) {
    const nodosMap = new Map(grafo.nodos.map(n => [n.id, n]));
    const nodosCoincidentes = grafo.nodos.filter(n =>
      n.nombre === funcionBuscada ||
      n.nombreSimple === funcionBuscada ||
      n.id.endsWith(':' + funcionBuscada) ||
      n.nombre.endsWith('.' + funcionBuscada)
    );

    for (const nodo of nodosCoincidentes) {
      for (const a of grafo.aristas) {
        if (!incluirExternas && a.tipo === 'externa') continue;
        if ((a.tipo === 'llama' || a.tipo === 'api' || a.tipo === 'externa') && a.destino === nodo.id) {
          const llamador = nodosMap.get(a.origen);
          const arch = llamador ? llamador.archivo : (a.origen.includes(':') ? a.origen.split(':')[0] : a.origen);
          resultados.push({
            proyecto: grafo.proyecto,
            archivo: arch,
            linea: a.linea || (llamador ? llamador.linea : 0),
            nombre: llamador ? llamador.nombre : a.origen,
            destino: nodo.nombre,
            tipo: a.tipo,
            dudosa: a.dudosa || false
          });
        }
      }
    }
  }

  return resultados;
}

/**
 * Consulta a qué funciones llama una función.
 */
export function consultarLlamaA(grafos, funcionBuscada, incluirExternas = false) {
  const resultados = [];

  for (const grafo of grafos) {
    const nodosMap = new Map(grafo.nodos.map(n => [n.id, n]));
    const nodosCoincidentes = grafo.nodos.filter(n =>
      n.nombre === funcionBuscada ||
      n.nombreSimple === funcionBuscada ||
      n.id.endsWith(':' + funcionBuscada) ||
      n.nombre.endsWith('.' + funcionBuscada)
    );

    for (const nodo of nodosCoincidentes) {
      for (const a of grafo.aristas) {
        if (!incluirExternas && a.tipo === 'externa') continue;
        if (a.origen === nodo.id) {
          const destino = nodosMap.get(a.destino);
          resultados.push({
            proyecto: grafo.proyecto,
            origenArchivo: nodo.archivo,
            lineaLlamada: a.linea || 0,
            destinoArchivo: destino ? destino.archivo : (a.destino.includes(':') ? a.destino.split(':')[0] : 'externo'),
            lineaDefinicion: destino ? destino.linea : 0,
            archivo: destino ? destino.archivo : (a.destino.includes(':') ? a.destino.split(':')[0] : 'externo'),
            linea: a.linea || (destino ? destino.linea : 0),
            nombre: destino ? (destino.nombreSimple || destino.nombre) : a.destino,
            nombreCompleto: destino ? destino.nombre : a.destino,
            origen: nodo.nombre,
            tipo: a.tipo,
            dudosa: a.dudosa || false
          });
        }
      }
    }
  }

  return resultados;
}

/**
 * Encuentra la cadena de llamadas entre dos funciones (BFS).
 */
export function consultarRuta(grafos, origenBuscado, destinoBuscado, incluirExternas = false) {
  for (const grafo of grafos) {
    const nodosMap = new Map(grafo.nodos.map(n => [n.id, n]));

    const origenes = grafo.nodos.filter(n =>
      n.nombre === origenBuscado || n.nombreSimple === origenBuscado || n.id.endsWith(':' + origenBuscado)
    );
    const destinos = grafo.nodos.filter(n =>
      n.nombre === destinoBuscado || n.nombreSimple === destinoBuscado || n.id.endsWith(':' + destinoBuscado)
    );

    if (origenes.length === 0 || destinos.length === 0) continue;

    const destinosIds = new Set(destinos.map(d => d.id));

    // Construir adyacencia
    const adyacencia = new Map();
    for (const a of grafo.aristas) {
      if (!incluirExternas && a.tipo === 'externa') continue;
      if (a.tipo === 'llama' || a.tipo === 'api') {
        if (!adyacencia.has(a.origen)) adyacencia.set(a.origen, []);
        adyacencia.get(a.origen).push({ destino: a.destino, linea: a.linea, tipo: a.tipo });
      }
    }

    for (const nodoIni of origenes) {
      const cola = [[{ id: nodoIni.id, lineaLlamada: nodoIni.linea, origenId: null }]];
      const visitados = new Set([nodoIni.id]);

      while (cola.length > 0) {
        const camino = cola.shift();
        const ultimoPaso = camino[camino.length - 1];

        if (destinosIds.has(ultimoPaso.id)) {
          return {
            proyecto: grafo.proyecto,
            camino: camino.map((paso, idx) => {
              const nodo = nodosMap.get(paso.id);
              if (idx === 0) {
                return {
                  id: paso.id,
                  archivo: nodo ? nodo.archivo : 'desconocido',
                  linea: nodo ? nodo.linea : paso.lineaLlamada || 0,
                  nombre: nodo ? (nodo.nombreSimple || nodo.nombre) : paso.id
                };
              }
              const nodoOrigen = nodosMap.get(paso.origenId);
              return {
                id: paso.id,
                origenArchivo: nodoOrigen ? nodoOrigen.archivo : 'desconocido',
                lineaLlamada: paso.lineaLlamada || 0,
                destinoArchivo: nodo ? nodo.archivo : 'desconocido',
                lineaDefinicion: nodo ? nodo.linea : 0,
                archivo: nodo ? nodo.archivo : 'desconocido',
                linea: nodo ? nodo.linea : 0,
                nombre: nodo ? (nodo.nombreSimple || nodo.nombre) : paso.id
              };
            })
          };
        }

        const vecinos = adyacencia.get(ultimoPaso.id) || [];
        for (const vecino of vecinos) {
          if (!visitados.has(vecino.destino)) {
            visitados.add(vecino.destino);
            cola.push([...camino, { id: vecino.destino, lineaLlamada: vecino.linea, origenId: ultimoPaso.id }]);
          }
        }
      }
    }
  }

  return null;
}

/**
 * Compara en profundidad el contenido de grafo.json con el código actual.
 */
export function verificarGrafo(dirProyecto, nombreProyecto) {
  const rutaJson = path.join(dirProyecto, 'grafo.json');
  if (!fs.existsSync(rutaJson)) {
    return { ok: false, razon: `Falta archivo ${rutaJson}` };
  }

  const jsonDisco = JSON.parse(fs.readFileSync(rutaJson, 'utf-8'));
  const grafoCodigo = construirGrafoProyecto(dirProyecto, nombreProyecto);

  // 1. Comparar Nodos por ID y archivo:línea
  const nodosDiscoMap = new Map(jsonDisco.nodos.map(n => [n.id, n]));
  const nodosCodigoMap = new Map(grafoCodigo.nodos.map(n => [n.id, n]));

  if (nodosDiscoMap.size !== nodosCodigoMap.size) {
    return {
      ok: false,
      razon: `Cantidad de nodos diferente: ${nodosDiscoMap.size} en disco vs ${nodosCodigoMap.size} en código`
    };
  }

  for (const [id, nodoCod] of nodosCodigoMap.entries()) {
    const nodoDisc = nodosDiscoMap.get(id);
    if (!nodoDisc) {
      return { ok: false, razon: `Nodo nuevo en código no registrado en grafo.json: ${id}` };
    }
    if (nodoCod.linea !== nodoDisc.linea || nodoCod.archivo !== nodoDisc.archivo) {
      return {
        ok: false,
        razon: `Línea desplazada en nodo ${id}: disco=${nodoDisc.archivo}:${nodoDisc.linea}, código=${nodoCod.archivo}:${nodoCod.linea}`
      };
    }
  }

  // 2. Comparar Aristas con archivo:línea
  function claveArista(a) {
    return `${a.tipo}|${a.origen}|${a.destino}|${a.linea || 0}|${a.dudosa ? 1 : 0}`;
  }

  const aristasDiscoSet = new Set(jsonDisco.aristas.map(claveArista));
  const aristasCodigoSet = new Set(grafoCodigo.aristas.map(claveArista));

  if (aristasDiscoSet.size !== aristasCodigoSet.size) {
    return {
      ok: false,
      razon: `Cantidad de aristas diferente: ${aristasDiscoSet.size} en disco vs ${aristasCodigoSet.size} en código`
    };
  }

  for (const clave of aristasCodigoSet) {
    if (!aristasDiscoSet.has(clave)) {
      return { ok: false, razon: `Arista modificada o desfasada: ${clave}` };
    }
  }

  return { ok: true };
}

/**
 * Función principal CLI.
 */
async function principal() {
  const args = process.argv.slice(2);
  const incluirExternas = args.includes('--externas');

  const proyectosCandidatos = ['itinerario-app', 'project-organizer', 'portal'];
  const proyectos = [];
  for (const nombre of proyectosCandidatos) {
    const dir = path.join(APPS_DIR, nombre);
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      proyectos.push({ nombre, dir });
    }
  }

  // 1. Modo --verificar
  if (args.includes('--verificar')) {
    let hayFallas = false;

    for (const p of proyectos) {
      const resultado = verificarGrafo(p.dir, p.nombre);
      if (!resultado.ok) {
        console.error(`[DESACTUALIZADO] ${p.nombre}: ${resultado.razon}`);
        hayFallas = true;
      }
    }

    if (hayFallas) {
      console.error('\nPara actualizar los grafos, ejecuta: node herramientas/grafo.mjs');
      process.exit(1);
    } else {
      console.log('✓ Todos los grafos están actualizados respecto al código.');
      process.exit(0);
    }
  }

  // 2. Modos de consulta
  const comando = args[0];

  if (comando === 'quien-llama') {
    const funcion = args[1];
    if (!funcion) {
      console.error('Uso: node herramientas/grafo.mjs quien-llama <función> [--externas]');
      process.exit(1);
    }

    const grafos = proyectos.map(p => construirGrafoProyecto(p.dir, p.nombre));
    const resultados = consultarQuienLlama(grafos, funcion, incluirExternas);

    if (resultados.length === 0) {
      console.log(`Ninguna función llama a "${funcion}".`);
    } else {
      console.log(`Funciones que llaman a "${funcion}" (${resultados.length} lugares):`);
      for (const r of resultados) {
        const marca = r.dudosa ? ' [dudosa]' : (r.tipo === 'externa' ? ' [externa]' : '');
        console.log(`- ${r.archivo}:${r.linea} (${r.nombre})${marca} [${r.proyecto}]`);
      }
    }
    return;
  }

  if (comando === 'llama-a') {
    const funcion = args[1];
    if (!funcion) {
      console.error('Uso: node herramientas/grafo.mjs llama-a <función> [--externas]');
      process.exit(1);
    }

    const grafos = proyectos.map(p => construirGrafoProyecto(p.dir, p.nombre));
    const resultados = consultarLlamaA(grafos, funcion, incluirExternas);

    if (resultados.length === 0) {
      console.log(`"${funcion}" no realiza llamadas registradas.`);
    } else {
      console.log(`"${funcion}" llama a (${resultados.length} llamadas):`);
      for (const r of resultados) {
        const marca = r.dudosa ? ' [dudosa]' : (r.tipo === 'externa' ? ' [externa]' : '');
        if (r.destinoArchivo && r.destinoArchivo !== 'externo' && r.lineaDefinicion) {
          console.log(`- ${r.origenArchivo}:${r.lineaLlamada} → ${r.destinoArchivo}:${r.lineaDefinicion} (${r.nombre})${marca} [${r.proyecto}]`);
        } else {
          console.log(`- ${r.origenArchivo}:${r.lineaLlamada} → ${r.nombre}${marca} [${r.proyecto}]`);
        }
      }
    }
    return;
  }

  if (comando === 'ruta') {
    const origen = args[1];
    const destino = args[2];
    if (!origen || !destino) {
      console.error('Uso: node herramientas/grafo.mjs ruta <origen> <destino> [--externas]');
      process.exit(1);
    }

    const grafos = proyectos.map(p => construirGrafoProyecto(p.dir, p.nombre));
    const ruta = consultarRuta(grafos, origen, destino, incluirExternas);

    if (!ruta) {
      console.log(`No se encontró ruta de llamadas entre "${origen}" y "${destino}".`);
    } else {
      console.log(`Ruta de llamadas entre "${origen}" y "${destino}" [${ruta.proyecto}]:`);
      for (let i = 0; i < ruta.camino.length; i++) {
        const paso = ruta.camino[i];
        if (i === 0) {
          console.log(`  1. ${paso.archivo}:${paso.linea} (${paso.nombre})`);
        } else {
          console.log(`  ${i + 1}. ${paso.origenArchivo}:${paso.lineaLlamada} → ${paso.destinoArchivo}:${paso.lineaDefinicion} (${paso.nombre})`);
        }
      }
    }
    return;
  }

  // 3. Generación / Regeneración por defecto
  console.log('Generando grafos de código para los proyectos...');
  for (const p of proyectos) {
    const grafo = construirGrafoProyecto(p.dir, p.nombre);
    guardarArchivosGrafo(p.dir, grafo);
    console.log(`✓ [${p.nombre}] ${grafo.resumen.totalNodos} nodos, ${grafo.resumen.totalAristas} aristas totales:`);
    console.log(`    - Resueltas: ${grafo.resumen.aristasResueltas}`);
    console.log(`    - Dudosas:   ${grafo.resumen.aristasDudosas} (${grafo.resumen.porcentajeDudosas})`);
    console.log(`    - Externas:  ${grafo.resumen.aristasExternas}`);
    console.log(`  -> ${path.join(p.dir, 'grafo.json')}`);
    console.log(`  -> ${path.join(p.dir, 'GRAFO.md')}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  principal().catch(err => {
    console.error('Error al procesar el grafo:', err);
    process.exit(1);
  });
}
