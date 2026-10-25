// vistas/cohete.js
// Vista interactiva del cohete por partes + iconos de Documentación y Redes Sociales (Instagram),
// sincronizada en vivo con las actividades del EDT y con modo de Entregables del lunes 19/10.

import * as M from '../comun/modelo.js';

export const PARTES_COHETE = [
  {
    clave: 'ojiva',
    idEdt: 'ojiva',
    nombre: 'Ojiva',
    color: 'var(--c-ojiva)',
    ubicacion: 'Punta del cohete; su hombro entra en el fuselaje superior',
    interna: false,
    esExtra: false,
  },
  {
    clave: 'fsup',
    idEdt: 'fsup',
    nombre: 'Fuselaje superior',
    color: 'var(--c-fsup)',
    ubicacion: 'Tubo que contiene ojiva (hombro), carga útil y acople',
    interna: false,
    esExtra: false,
  },
  {
    clave: 'carga',
    idEdt: 'uhv3',
    nombre: 'Carga útil',
    color: 'var(--c-carga)',
    ubicacion: 'Dentro del fuselaje superior, entre la ojiva y el acople',
    interna: true,
    esExtra: false,
  },
  {
    clave: 'acople',
    idEdt: 'ssoi',
    nombre: 'Acople',
    color: 'var(--c-acople)',
    ubicacion: 'Une el fuselaje superior con el inferior',
    interna: true,
    esExtra: false,
  },
  {
    clave: 'finf',
    idEdt: 'finf',
    nombre: 'Fuselaje inferior',
    color: 'var(--c-finf)',
    ubicacion: 'Tubo con aletas; contiene paracaídas y soporte del motor',
    interna: false,
    esExtra: false,
  },
  {
    clave: 'para',
    idEdt: 'mee1',
    nombre: 'Paracaídas y cordón de choque',
    color: 'var(--c-para)',
    ubicacion: 'Dentro del fuselaje inferior; el cordón une fuselaje superior e inferior',
    interna: true,
    esExtra: false,
  },
  {
    clave: 'motor',
    idEdt: '8111',
    nombre: 'Soporte del motor',
    color: 'var(--c-motor)',
    ubicacion: 'Dentro del fuselaje inferior',
    interna: true,
    esExtra: false,
  },
  {
    clave: 'doc',
    idEdt: 'fh9r',
    nombre: 'Documentación',
    color: 'var(--c-doc)',
    ubicacion: 'Documentos de la competencia, CDR, simulaciones, listados y gestión',
    interna: false,
    esExtra: true,
  },
  {
    clave: 'redes',
    idEdt: 'tpnh',
    nombre: 'Redes sociales y videos',
    color: 'var(--c-redes)',
    ubicacion: 'Videos, reels, guion e infografías exigidos por la competencia',
    interna: false,
    esExtra: true,
  },
];

export const FECHA_ENTREGA_LUNES = '2026-10-19';

export const ENTREGABLES_BASE = {
  ojiva: [
    { nombre: 'Ojiva', responsable: 'Duvan', fecha: FECHA_ENTREGA_LUNES },
  ],
  fsup: [
    { nombre: 'Tubo del fuselaje superior', responsable: 'equipo Aeroestructura', fecha: FECHA_ENTREGA_LUNES },
  ],
  carga: [
    { nombre: 'Estructura de la carga útil acoplada con los tornillos', responsable: 'jesus acosta', fecha: FECHA_ENTREGA_LUNES },
    { nombre: 'Aviónica funcionando por fuera (telemetría, etc.), aún sin la PCB', responsable: 'Jhon Vargas', fecha: FECHA_ENTREGA_LUNES },
    { nombre: 'PCB o avances de la PCB', responsable: 'Paola Bello', fecha: FECHA_ENTREGA_LUNES },
  ],
  acople: [
    { nombre: 'Acople con el disco de sujeción superior y el cáncamo puesto', responsable: 'Jesús Aragón', fecha: FECHA_ENTREGA_LUNES },
  ],
  finf: [
    { nombre: 'Tubo del fuselaje inferior', responsable: 'equipo Aeroestructura', fecha: FECHA_ENTREGA_LUNES },
  ],
  para: [
    { nombre: 'Ensamble del paracaídas: paracaídas + cordón de choque unido a los dos cáncamos (superior e inferior)', responsable: 'Jesús Aragón', fecha: FECHA_ENTREGA_LUNES },
  ],
  motor: [
    { nombre: 'Disco de sujeción inferior con el cáncamo puesto', responsable: 'Sebastián Cespedes', fecha: FECHA_ENTREGA_LUNES },
    { nombre: 'Anillos de centrado', responsable: 'Sebastián Cespedes', fecha: FECHA_ENTREGA_LUNES },
    { nombre: 'Tubo de cartón prensado en el centro (porta el motor G80-7T)', responsable: 'Godot y juan ruiz', fecha: FECHA_ENTREGA_LUNES },
    { nombre: 'Si hay tiempo: poner las eles (sujetan el motor al tubo) y ensamblar el soporte', responsable: 'equipo Aeroestructura', fecha: FECHA_ENTREGA_LUNES },
  ],
  doc: [],
  redes: [],
};

function normalizarTexto(txt) {
  return String(txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Busca el nodo contenedor en el modelo EDT correspondiente a una parte del cohete.
 */
export function encontrarNodoSeccion(modelo, parte) {
  if (!modelo || !modelo.porId) return null;
  if (modelo.porId.has(parte.idEdt)) {
    return modelo.porId.get(parte.idEdt);
  }
  const nombreBuscado = normalizarTexto(parte.nombre);
  const todos = modelo.lista || [];
  for (const n of todos) {
    if (normalizarTexto(n.nombre) === nombreBuscado) {
      return n;
    }
  }
  const palabrasClave = {
    ojiva: ['ojiva'],
    fsup: ['fuselaje superior'],
    carga: ['carga util'],
    acople: ['acople'],
    finf: ['fuselaje inferior', 'union del fuselaje'],
    para: ['paracaidas', 'sistema de recuperacion'],
    motor: ['soporte del motor'],
    doc: ['documentacion'],
    redes: ['redes sociales', 'videos'],
  }[parte.clave] || [];

  for (const palabra of palabrasClave) {
    const hallado = todos.find(n => normalizarTexto(n.nombre).includes(palabra));
    if (hallado) return hallado;
  }
  return null;
}

/**
 * Verifica si una actividad hoja coincide con un filtro de fecha.
 */
function coincideConFecha(h, fecha, modoFecha = 'fin') {
  if (!fecha) return true;
  if (modoFecha === 'activa') {
    return Boolean(h.inicio && h.fin && h.inicio <= fecha && h.fin >= fecha);
  }
  return (h.fin || h.inicio) === fecha;
}

/**
 * Obtiene las actividades hoja descendientes de la sección correspondiente en el modelo.
 * Por defecto devuelve tanto tareas normales como entregables en una sola lista unificada.
 * - Si modoFiltro es un objeto `{ fecha, modoFecha }`, filtra por esa fecha.
 * - Si modoFiltro === 'entrega', devuelve solo entregables.
 * - Si modoFiltro === 'tareas', devuelve solo tareas normales.
 */
export function obtenerTareasSeccion(modelo, parte, modoFiltro = null) {
  const nodoSeccion = encontrarNodoSeccion(modelo, parte);
  if (!nodoSeccion || nodoSeccion.esHoja) return [];
  const hojas = [];
  function recolectar(n) {
    for (const h of (n.hijos || [])) {
      if (h.esHoja) {
        if (modoFiltro && typeof modoFiltro === 'object') {
          if (coincideConFecha(h, modoFiltro.fecha, modoFiltro.modoFecha)) {
            hojas.push(h);
          }
        } else if (modoFiltro === 'entrega') {
          if (M.esEntregable(h)) hojas.push(h);
        } else if (modoFiltro === 'tareas') {
          if (!M.esEntregable(h)) hojas.push(h);
        } else {
          hojas.push(h);
        }
      } else {
        recolectar(h);
      }
    }
  }
  recolectar(nodoSeccion);
  return hojas;
}

/**
 * Determina a qué parte del cohete pertenece un id de actividad seleccionada.
 */
function determinarParteDeActividad(modelo, seleccionId) {
  if (!modelo || !seleccionId) return null;
  for (const p of PARTES_COHETE) {
    const nodoSec = encontrarNodoSeccion(modelo, p);
    if (!nodoSec) continue;
    if (nodoSec.id === seleccionId) return p.clave;
    let cursor = modelo.porId.get(seleccionId);
    while (cursor && cursor.padre) {
      if (cursor.padre === nodoSec.id) return p.clave;
      cursor = modelo.porId.get(cursor.padre);
    }
  }
  return null;
}

function construirSvgDiagrama() {
  return `
    <svg class="po-cohete-svg" viewBox="0 0 420 1015" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diagrama interactivo del cohete Xundwa, documentación y redes sociales">
      <defs>
        <linearGradient id="bodyShade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stop-color="#ffffff" stop-opacity=".10"/>
          <stop offset="35%" stop-color="#ffffff" stop-opacity=".22"/>
          <stop offset="100%" stop-color="#000000" stop-opacity=".25"/>
        </linearGradient>
        <pattern id="carbon" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#1b2236"/>
          <path d="M0 0L6 6M6 0L0 6" stroke="#26304c" stroke-width=".7"/>
        </pattern>
      </defs>

      <!-- Líneas guía de separación entre fuselajes -->
      <line x1="28" y1="190" x2="152" y2="190" stroke="#252c44" stroke-dasharray="2 3"/>
      <line x1="28" y1="455" x2="152" y2="455" stroke="#252c44" stroke-dasharray="2 3"/>
      <line x1="28" y1="535" x2="152" y2="535" stroke="#252c44" stroke-dasharray="2 3"/>
      <line x1="28" y1="860" x2="152" y2="860" stroke="#252c44" stroke-dasharray="2 3"/>

      <!-- ==================== 2. FUSELAJE SUPERIOR (tubo exterior) ==================== -->
      <g class="part outer-tube" data-part="fsup" style="--part-color: var(--c-fsup)">
        <rect class="shape" x="155" y="190" width="90" height="265" rx="2"
              fill="url(#bodyShade)" stroke="#5b9bff" stroke-width="2"/>
        <line x1="155" y1="240" x2="245" y2="240" stroke="#5b9bff" stroke-opacity=".35" stroke-dasharray="3 3"/>
        <line x1="155" y1="415" x2="245" y2="415" stroke="#5b9bff" stroke-opacity=".35" stroke-dasharray="3 3"/>
        <line class="callout" x1="245" y1="295" x2="292" y2="295" stroke="#5b9bff" stroke-width="1.2"/>
        <circle cx="245" cy="295" r="2.5" fill="#5b9bff"/>
        <text class="part-label" x="296" y="292">Fuselaje superior <tspan class="prog" data-prog="fsup">0/0</tspan></text>
        <text class="part-sub" x="296" y="306">tubo exterior</text>
      </g>

      <!-- ==================== 5. FUSELAJE INFERIOR + ALETAS ==================== -->
      <g class="part outer-tube" data-part="finf" style="--part-color: var(--c-finf)">
        <polygon class="shape" points="155,735 102,805 102,870 155,852"
                 fill="#261c3d" stroke="#a78bfa" stroke-width="2" stroke-linejoin="round"/>
        <polygon class="shape" points="245,735 298,805 298,870 245,852"
                 fill="#261c3d" stroke="#a78bfa" stroke-width="2" stroke-linejoin="round"/>
        <rect class="shape" x="196" y="742" width="8" height="112" rx="2"
              fill="#352654" stroke="#a78bfa" stroke-width="1.5"/>
        <rect class="shape" x="155" y="535" width="90" height="325" rx="2"
              fill="url(#bodyShade)" stroke="#a78bfa" stroke-width="2"/>
        <line class="callout" x1="245" y1="665" x2="292" y2="665" stroke="#a78bfa" stroke-width="1.2"/>
        <circle cx="245" cy="665" r="2.5" fill="#a78bfa"/>
        <text class="part-label" x="296" y="662">Fuselaje inferior <tspan class="prog" data-prog="finf">0/0</tspan></text>
        <text class="part-sub" x="296" y="676">tubo + aletas</text>
      </g>

      <!-- ==================== 1. OJIVA (con hombro dentro de fsup) ==================== -->
      <g class="part" data-part="ojiva" style="--part-color: var(--c-ojiva)">
        <rect class="shape inner" x="163" y="190" width="74" height="46" rx="2"
              fill="#3b2617" fill-opacity=".85" stroke="#ff7a45" stroke-width="1.6" stroke-dasharray="4 2"/>
        <path class="shape" d="M 155 190 Q 158 82 200 24 Q 242 82 245 190 Z"
              fill="#2f1f18" stroke="#ff7a45" stroke-width="2"/>
        <path d="M 176 184 Q 180 96 200 38" stroke="#ffb089" stroke-width="1.2" fill="none" opacity=".5"/>
        <line class="callout" x1="228" y1="115" x2="292" y2="115" stroke="#ff7a45" stroke-width="1.2"/>
        <circle cx="228" cy="115" r="2.5" fill="#ff7a45"/>
        <text class="part-label" x="296" y="112">Ojiva <tspan class="prog" data-prog="ojiva">0/0</tspan></text>
        <text class="part-sub" x="296" y="126">+ hombro en F. sup.</text>
      </g>

      <!-- ==================== 3. CARGA ÚTIL (interna en fsup) ==================== -->
      <g class="part inner" data-part="carga" style="--part-color: var(--c-carga)">
        <rect class="shape" x="165" y="250" width="70" height="155" rx="5"
              fill="#112b28" fill-opacity=".92" stroke="#2dd4bf" stroke-width="2"/>
        <rect x="173" y="264" width="54" height="22" rx="2" fill="#173f3a" stroke="#2dd4bf" stroke-width="1"/>
        <text x="200" y="279" text-anchor="middle" fill="#8ff3e3" font-size="8.5" font-family="monospace">TELEMETRÍA</text>
        <rect x="173" y="294" width="54" height="62" rx="2" fill="#0d2220" stroke="#2dd4bf" stroke-width="1"/>
        <circle cx="183" cy="306" r="2.2" fill="#2dd4bf"/>
        <circle cx="217" cy="306" r="2.2" fill="#2dd4bf"/>
        <rect x="186" y="314" width="28" height="18" rx="1" fill="#2dd4bf" fill-opacity=".25" stroke="#2dd4bf" stroke-width=".9"/>
        <text x="200" y="326" text-anchor="middle" fill="#a7f3d0" font-size="7.5" font-family="monospace">PCB</text>
        <line x1="179" y1="342" x2="221" y2="342" stroke="#2dd4bf" stroke-width="1"/>
        <line x1="179" y1="348" x2="212" y2="348" stroke="#2dd4bf" stroke-width="1"/>
        <rect x="173" y="364" width="54" height="30" rx="2" fill="#173f3a" stroke="#2dd4bf" stroke-width="1"/>
        <text x="200" y="382" text-anchor="middle" fill="#8ff3e3" font-size="8" font-family="monospace">115 × 6.5</text>
        <circle cx="169" cy="256" r="1.6" fill="#8ff3e3"/>
        <circle cx="231" cy="256" r="1.6" fill="#8ff3e3"/>
        <circle cx="169" cy="399" r="1.6" fill="#8ff3e3"/>
        <circle cx="231" cy="399" r="1.6" fill="#8ff3e3"/>
        <line class="callout" x1="165" y1="335" x2="128" y2="335" stroke="#2dd4bf" stroke-width="1.2"/>
        <circle cx="165" cy="335" r="2.5" fill="#2dd4bf"/>
        <text class="part-label" x="124" y="332" text-anchor="end">Carga útil <tspan class="prog" data-prog="carga">0/0</tspan></text>
        <text class="part-sub" x="124" y="346" text-anchor="end">dentro de F. sup.</text>
      </g>

      <!-- ==================== 4. ACOPLE (une fsup y finf) ==================== -->
      <g class="part inner" data-part="acople" style="--part-color: var(--c-acople)">
        <rect class="shape" x="161" y="420" width="78" height="150" rx="3"
              fill="#33260f" fill-opacity=".92" stroke="#fbbf24" stroke-width="2"/>
        <rect x="155" y="455" width="90" height="80" fill="#fbbf24" fill-opacity=".18" stroke="#fbbf24" stroke-width="1.5"/>
        <rect x="163" y="546" width="74" height="5" fill="#fbbf24"/>
        <rect x="163" y="553" width="74" height="5" fill="#fbbf24"/>
        <rect x="163" y="560" width="74" height="5" fill="#fbbf24"/>
        <circle cx="171" cy="540" r="2" fill="#fde68a"/>
        <circle cx="229" cy="540" r="2" fill="#fde68a"/>
        <circle cx="200" cy="574" r="6" fill="none" stroke="#fbbf24" stroke-width="2.2"/>
        <line x1="200" y1="565" x2="200" y2="568" stroke="#fbbf24" stroke-width="2.2"/>
        <line class="callout" x1="245" y1="495" x2="292" y2="495" stroke="#fbbf24" stroke-width="1.2"/>
        <circle cx="245" cy="495" r="2.5" fill="#fbbf24"/>
        <text class="part-label" x="296" y="492">Acople <tspan class="prog" data-prog="acople">0/0</tspan></text>
        <text class="part-sub" x="296" y="506">+ disco sup. (3×4 mm) y cáncamo</text>
      </g>

      <!-- ==================== 6. PARACAÍDAS + CORDÓN DE CHOQUE ==================== -->
      <g class="part inner" data-part="para" style="--part-color: var(--c-para)">
        <path class="shape" d="M 200 580 C 175 595, 225 612, 198 628 C 172 645, 224 670, 200 715 C 182 726, 218 730, 200 740"
              fill="none" stroke="#f472b6" stroke-width="2.4" stroke-linecap="round"/>
        <path class="shape" d="M 166 648 Q 200 605 234 648 L 226 656 Q 200 638 174 656 Z"
              fill="#3b1630" stroke="#f472b6" stroke-width="2"/>
        <ellipse cx="200" cy="624" rx="9" ry="3.2" fill="#0f1220" stroke="#f9a8d4" stroke-width="1.3"/>
        <line x1="170" y1="652" x2="196" y2="692" stroke="#f9a8d4" stroke-width="1.1"/>
        <line x1="184" y1="654" x2="198" y2="692" stroke="#f9a8d4" stroke-width="1.1"/>
        <line x1="216" y1="654" x2="202" y2="692" stroke="#f9a8d4" stroke-width="1.1"/>
        <line x1="230" y1="652" x2="204" y2="692" stroke="#f9a8d4" stroke-width="1.1"/>
        <rect x="195" y="690" width="10" height="7" rx="3" fill="none" stroke="#fbcfe8" stroke-width="1.5"/>
        <line class="callout" x1="166" y1="648" x2="128" y2="648" stroke="#f472b6" stroke-width="1.2"/>
        <circle cx="166" cy="648" r="2.5" fill="#f472b6"/>
        <text class="part-label" x="124" y="644" text-anchor="end">Paracaídas <tspan class="prog" data-prog="para">0/0</tspan></text>
        <text class="part-sub" x="124" y="658" text-anchor="end">y cordón de choque</text>
      </g>

      <!-- ==================== 7. SOPORTE DEL MOTOR ==================== -->
      <g class="part inner" data-part="motor" style="--part-color: var(--c-motor)">
        <circle cx="200" cy="744" r="5.5" fill="none" stroke="#34d399" stroke-width="2.2"/>
        <line x1="200" y1="750" x2="200" y2="755" stroke="#34d399" stroke-width="2.2"/>
        <rect class="shape" x="161" y="754" width="78" height="8" rx="1.5"
              fill="#11352a" stroke="#34d399" stroke-width="1.8"/>
        <rect class="shape" x="161" y="782" width="78" height="7" rx="1.5"
              fill="#11352a" stroke="#34d399" stroke-width="1.6"/>
        <rect class="shape" x="161" y="838" width="78" height="7" rx="1.5"
              fill="#11352a" stroke="#34d399" stroke-width="1.6"/>
        <rect class="shape" x="182" y="754" width="36" height="114" rx="2"
              fill="#143d31" stroke="#34d399" stroke-width="2"/>
        <rect x="186" y="766" width="28" height="96" rx="1"
              fill="#0c261f" stroke="#6ee7b7" stroke-width="1" stroke-dasharray="3 2"/>
        <text x="200" y="816" text-anchor="middle" fill="#a7f3d0" font-size="8.5" font-family="monospace" transform="rotate(-90 200 816)">G80-7T</text>
        <path d="M 176 860 L 176 872 L 186 872" fill="none" stroke="#6ee7b7" stroke-width="2.2"/>
        <path d="M 224 860 L 224 872 L 214 872" fill="none" stroke="#6ee7b7" stroke-width="2.2"/>
        <polygon points="188,868 212,868 218,886 182,886"
                 fill="#1f2937" stroke="#34d399" stroke-width="1.5"/>
        <line class="callout" x1="239" y1="824" x2="292" y2="824" stroke="#34d399" stroke-width="1.2"/>
        <circle cx="239" cy="824" r="2.5" fill="#34d399"/>
        <text class="part-label" x="296" y="820">Soporte del motor <tspan class="prog" data-prog="motor">0/0</tspan></text>
        <text class="part-sub" x="296" y="834">anillos + tubo G80-7T + eles</text>
      </g>

      <!-- Etiquetas de cota a la izquierda -->
      <g fill="#6c7596" font-size="9.5" font-family="monospace">
        <text x="26" y="112">OJIVA</text>
        <text x="26" y="325">F. SUP.</text>
        <text x="26" y="500">UNIÓN</text>
        <text x="26" y="705">F. INF.</text>
      </g>

      <!-- ==================== SECCIÓN INFERIOR: ICONOS DE DOCUMENTACIÓN Y REDES ==================== -->
      <line x1="24" y1="906" x2="396" y2="906" stroke="#252c44" stroke-dasharray="4 4"/>
      <text x="210" y="922" text-anchor="middle" fill="#8f98b2" font-size="9.5" font-weight="700" letter-spacing="0.08em">COMPETENCIA · DOCUMENTACIÓN Y REDES SOCIALES</text>

      <!-- 8. ICONO DOCUMENTO (Documentación) -->
      <g class="part extra-card" data-part="doc" style="--part-color: var(--c-doc)">
        <rect class="shape" x="24" y="932" width="180" height="68" rx="12"
              fill="#17243a" stroke="#38bdf8" stroke-width="2"/>
        <!-- Icono de documento -->
        <g transform="translate(38, 944)">
          <path d="M6 2 H24 L32 10 V38 a3 3 0 0 1 -3 3 H6 a3 3 0 0 1 -3 -3 V5 a3 3 0 0 1 3 -3 Z"
                fill="#0f1b2d" stroke="#38bdf8" stroke-width="2" stroke-linejoin="round"/>
          <path d="M23 2 V11 H32" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linejoin="round"/>
          <line x1="9" y1="18" x2="25" y2="18" stroke="#7dd3fc" stroke-width="2" stroke-linecap="round"/>
          <line x1="9" y1="25" x2="25" y2="25" stroke="#7dd3fc" stroke-width="2" stroke-linecap="round"/>
          <line x1="9" y1="32" x2="19" y2="32" stroke="#7dd3fc" stroke-width="2" stroke-linecap="round"/>
        </g>
        <text class="part-label" x="82" y="960">Documentación <tspan class="prog" data-prog="doc">0/0</tspan></text>
        <text class="part-sub" x="82" y="976">CDR, listados, CFD, Drive</text>
      </g>

      <!-- 9. ICONO INSTAGRAM (Videos y Redes Sociales) -->
      <g class="part extra-card" data-part="redes" style="--part-color: var(--c-redes)">
        <rect class="shape" x="216" y="932" width="180" height="68" rx="12"
              fill="#2d162c" stroke="#e879f9" stroke-width="2"/>
        <!-- Icono estilo Instagram -->
        <g transform="translate(230, 944)">
          <rect x="3" y="3" width="34" height="34" rx="9"
                fill="#1d0d1d" stroke="#e879f9" stroke-width="2.2"/>
          <circle cx="20" cy="20" r="8" fill="none" stroke="#f0abfc" stroke-width="2.2"/>
          <circle cx="29.5" cy="10.5" r="2" fill="#f0abfc"/>
        </g>
        <text class="part-label" x="274" y="960">Redes y Videos <tspan class="prog" data-prog="redes">0/0</tspan></text>
        <text class="part-sub" x="274" y="976">Instagram, videos, guion</text>
      </g>
    </svg>
  `;
}

export function crearVista(contenedor, { alSeleccionar, aplicar, filtros = null, alCambiarFiltroFecha = null }) {
  let modeloActual = null;
  let seleccionActual = null;
  let parteActiva = 'carga';
  let verTodasSecciones = false;
  let filtroFecha = filtros?.fecha || '';
  let modoFecha = filtros?.modoFecha || 'fin';

  const control = new AbortController();
  const { signal } = control;

  const raiz = document.createElement('div');
  raiz.className = 'po-cohete';

  // Cabecera superior de la vista Cohete
  const cabecera = document.createElement('div');
  cabecera.className = 'po-cohete-cabecera';

  const bloqueTitulo = document.createElement('div');
  bloqueTitulo.className = 'po-cohete-titulo-bloque';
  const titulo = document.createElement('h2');
  titulo.className = 'po-cohete-titulo';
  titulo.textContent = 'Cohete por partes · Actividades y Entregables del EDT';
  const subtitulo = document.createElement('p');
  subtitulo.className = 'po-cohete-subtitulo';
  subtitulo.textContent = 'Tareas y entregables viven juntos en el EDT. Filtra por fecha arriba o toca una parte del cohete.';
  bloqueTitulo.append(titulo, subtitulo);

  // Barra de filtro por fecha (sustituye la separación artificial entre Tareas y Entregables)
  const barraFecha = document.createElement('div');
  barraFecha.className = 'po-cohete-switch po-cohete-barra-fecha';

  const btnTodasFechas = document.createElement('button');
  btnTodasFechas.type = 'button';
  btnTodasFechas.className = 'po-cohete-modo-btn active';
  btnTodasFechas.dataset.fecha = '';
  btnTodasFechas.textContent = 'Todas las fechas ';
  const pillTodas = document.createElement('span');
  pillTodas.className = 'po-cohete-pill';
  btnTodasFechas.append(pillTodas);

  const btnLunes = document.createElement('button');
  btnLunes.type = 'button';
  btnLunes.className = 'po-cohete-modo-btn';
  btnLunes.dataset.fecha = FECHA_ENTREGA_LUNES;
  btnLunes.textContent = '📅 Lunes 19/10 ';
  const pillLunes = document.createElement('span');
  pillLunes.className = 'po-cohete-pill';
  btnLunes.append(pillLunes);

  const selectModoFecha = document.createElement('select');
  selectModoFecha.className = 'po-campo po-cohete-modo-fecha';
  selectModoFecha.title = 'Cómo filtrar por la fecha elegida';
  const optFin = document.createElement('option');
  optFin.value = 'fin';
  optFin.textContent = 'Se entregan el…';
  const optActiva = document.createElement('option');
  optActiva.value = 'activa';
  optActiva.textContent = 'Activas el…';
  selectModoFecha.append(optFin, optActiva);
  selectModoFecha.value = modoFecha;

  const inputFiltroFecha = document.createElement('input');
  inputFiltroFecha.type = 'date';
  inputFiltroFecha.className = 'po-campo po-cohete-filtro-fecha';
  inputFiltroFecha.title = 'Seleccionar fecha para ver tareas y entregables de ese día';
  inputFiltroFecha.value = filtroFecha;

  barraFecha.append(btnTodasFechas, btnLunes, selectModoFecha, inputFiltroFecha);

  // Progreso global
  const bloqueProgreso = document.createElement('div');
  bloqueProgreso.className = 'po-cohete-progreso';
  const barraFondo = document.createElement('div');
  barraFondo.className = 'po-cohete-barra';
  const barraRelleno = document.createElement('div');
  barraRelleno.className = 'po-cohete-barra-fill';
  barraFondo.append(barraRelleno);
  const textoProgreso = document.createElement('span');
  textoProgreso.className = 'po-cohete-progreso-txt';
  bloqueProgreso.append(barraFondo, textoProgreso);

  cabecera.append(bloqueTitulo, barraFecha, bloqueProgreso);

  // Layout de 2 columnas: Diagrama SVG (izquierda) + Panel de parte seleccionada (derecha)
  const cuerpo = document.createElement('div');
  cuerpo.className = 'po-cohete-layout';

  // Tarjeta izquierda: Diagrama SVG
  const tarjetaDiagrama = document.createElement('div');
  tarjetaDiagrama.className = 'po-cohete-card po-cohete-diagrama';

  const barraDiagrama = document.createElement('div');
  barraDiagrama.className = 'po-cohete-diagrama-top';
  const hintDiagrama = document.createElement('span');
  hintDiagrama.className = 'po-cohete-hint';
  hintDiagrama.textContent = '7 partes del cohete + 2 iconos de competencia';

  const labelRayosX = document.createElement('label');
  labelRayosX.className = 'po-cohete-xray';
  const checkRayosX = document.createElement('input');
  checkRayosX.type = 'checkbox';
  checkRayosX.checked = true;
  labelRayosX.append(checkRayosX, ' Vista interna');
  barraDiagrama.append(hintDiagrama, labelRayosX);

  const contenedorSvg = document.createElement('div');
  contenedorSvg.className = 'po-cohete-svg-wrap';
  contenedorSvg.innerHTML = construirSvgDiagrama();

  const leyenda = document.createElement('div');
  leyenda.className = 'po-cohete-leyenda';

  const btnLeyendaTodas = document.createElement('button');
  btnLeyendaTodas.type = 'button';
  btnLeyendaTodas.className = 'po-cohete-leyenda-item po-cohete-leyenda-todas';
  btnLeyendaTodas.dataset.part = '__todas__';
  btnLeyendaTodas.textContent = '📋 Ver todas las secciones';
  leyenda.append(btnLeyendaTodas);

  for (const p of PARTES_COHETE) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'po-cohete-leyenda-item';
    item.dataset.part = p.clave;
    const sw = document.createElement('span');
    sw.className = 'po-cohete-sw';
    sw.style.background = p.color;
    item.append(sw, p.nombre);
    leyenda.append(item);
  }

  tarjetaDiagrama.append(barraDiagrama, contenedorSvg, leyenda);

  // Tarjeta derecha: Checklist de la parte activa (o de todas las secciones)
  const tarjetaPanel = document.createElement('div');
  tarjetaPanel.className = 'po-cohete-card po-cohete-panel';

  const cabeceraParte = document.createElement('div');
  cabeceraParte.className = 'po-cohete-parte-hdr';
  const puntoColor = document.createElement('span');
  puntoColor.className = 'po-cohete-dot';
  const infoParte = document.createElement('div');
  infoParte.className = 'po-cohete-parte-info';
  const nombreParte = document.createElement('h3');
  nombreParte.className = 'po-cohete-parte-nombre';
  const ubicacionParte = document.createElement('div');
  ubicacionParte.className = 'po-cohete-parte-loc';
  infoParte.append(nombreParte, ubicacionParte);

  // Botones de alcance: "Por sección" vs "Ver todos"
  const switchAlcance = document.createElement('div');
  switchAlcance.className = 'po-cohete-alcance';
  const btnAlcanceSeccion = document.createElement('button');
  btnAlcanceSeccion.type = 'button';
  btnAlcanceSeccion.className = 'po-cohete-alcance-btn active';
  btnAlcanceSeccion.dataset.alcance = 'seccion';
  btnAlcanceSeccion.textContent = 'Por sección';
  const btnAlcanceTodas = document.createElement('button');
  btnAlcanceTodas.type = 'button';
  btnAlcanceTodas.className = 'po-cohete-alcance-btn';
  btnAlcanceTodas.dataset.alcance = 'todas';
  btnAlcanceTodas.textContent = 'Ver todos';
  switchAlcance.append(btnAlcanceSeccion, btnAlcanceTodas);

  const contadorParte = document.createElement('span');
  contadorParte.className = 'po-cohete-parte-cnt';
  cabeceraParte.append(puntoColor, infoParte, switchAlcance, contadorParte);

  const bannerModo = document.createElement('div');
  bannerModo.className = 'po-cohete-banner-modo';

  const listaItems = document.createElement('ul');
  listaItems.className = 'po-cohete-lista';

  const filaAgregar = document.createElement('form');
  filaAgregar.className = 'po-cohete-agregar';
  const selectParteAgregar = document.createElement('select');
  selectParteAgregar.className = 'po-campo po-cohete-parte-select';
  selectParteAgregar.title = 'Sección donde se agregará';
  for (const p of PARTES_COHETE) {
    const opt = document.createElement('option');
    opt.value = p.clave;
    opt.textContent = p.nombre;
    selectParteAgregar.append(opt);
  }
  selectParteAgregar.hidden = true;

  const selectTipoAgregar = document.createElement('select');
  selectTipoAgregar.className = 'po-campo po-cohete-tipo-select';
  selectTipoAgregar.title = 'Tipo de actividad a crear';
  const optTipoTarea = document.createElement('option');
  optTipoTarea.value = 'tarea';
  optTipoTarea.textContent = 'Tarea';
  const optTipoEntregable = document.createElement('option');
  optTipoEntregable.value = 'entregable';
  optTipoEntregable.textContent = '📦 Entregable';
  selectTipoAgregar.append(optTipoTarea, optTipoEntregable);

  const inputNuevo = document.createElement('input');
  inputNuevo.type = 'text';
  inputNuevo.className = 'po-campo po-cohete-input';
  inputNuevo.placeholder = 'Nueva tarea o entregable en esta sección…';
  const inputFechaNuevo = document.createElement('input');
  inputFechaNuevo.type = 'date';
  inputFechaNuevo.className = 'po-campo po-cohete-fecha-input';
  inputFechaNuevo.value = filtroFecha || '';
  inputFechaNuevo.title = 'Fecha (opcional para tarea; por defecto lunes 19/10 para entregable)';
  const btnAgregar = document.createElement('button');
  btnAgregar.type = 'submit';
  btnAgregar.className = 'po-boton po-primario';
  btnAgregar.textContent = '+ Agregar';
  filaAgregar.append(selectParteAgregar, selectTipoAgregar, inputNuevo, inputFechaNuevo, btnAgregar);

  const piePanel = document.createElement('div');
  piePanel.className = 'po-cohete-pie';
  const notaPie = document.createElement('span');
  notaPie.className = 'po-cohete-nota-pie';
  const btnRestaurarEntrega = document.createElement('button');
  btnRestaurarEntrega.type = 'button';
  btnRestaurarEntrega.className = 'po-boton';
  btnRestaurarEntrega.textContent = 'Restaurar entregables del lunes';
  piePanel.append(notaPie, btnRestaurarEntrega);

  tarjetaPanel.append(cabeceraParte, bannerModo, listaItems, filaAgregar, piePanel);

  cuerpo.append(tarjetaDiagrama, tarjetaPanel);
  raiz.append(cabecera, cuerpo);
  contenedor.append(raiz);

  function obtenerInfoParte(clave) {
    return PARTES_COHETE.find(p => p.clave === clave) || PARTES_COHETE[0];
  }

  function obtenerItemsParteActual(p) {
    const filtro = filtroFecha ? { fecha: filtroFecha, modoFecha } : null;
    return obtenerTareasSeccion(modeloActual, p, filtro);
  }

  function calcularConteosParte(p) {
    const items = obtenerItemsParteActual(p);
    const hechas = items.filter(t => t.estado === 'hecha').length;
    return { hechas, total: items.length };
  }

  function calcularTotalesActuales() {
    let hechas = 0;
    let total = 0;
    for (const p of PARTES_COHETE) {
      const c = calcularConteosParte(p);
      hechas += c.hechas;
      total += c.total;
    }
    return { hechas, total };
  }

  function aplicarCambioFecha(nuevaFecha, nuevoModoFecha = modoFecha) {
    filtroFecha = nuevaFecha || '';
    modoFecha = nuevoModoFecha || 'fin';
    inputFiltroFecha.value = filtroFecha;
    selectModoFecha.value = modoFecha;
    if (filtroFecha) {
      inputFechaNuevo.value = filtroFecha;
    }
    if (alCambiarFiltroFecha) {
      alCambiarFiltroFecha(filtroFecha, modoFecha);
    } else {
      renderizarPanel();
    }
  }

  function alternarTareaEdt(tarea) {
    if (!aplicar) return;
    const nuevoEstado = tarea.estado === 'hecha' ? 'pendiente' : 'hecha';
    aplicar(datos => M.editarActividad(datos, tarea.id, { estado: nuevoEstado }));
  }

  function eliminarTareaEdt(tareaId) {
    if (!aplicar) return;
    aplicar(datos => M.eliminarActividad(datos, tareaId));
  }

  function agregarActividadEnSeccion(parte, texto, opciones = {}) {
    if (!aplicar) return;
    const limpio = texto.trim();
    if (!limpio) return;
    let idCreado = null;
    aplicar(datos => {
      const m = M.construir(datos);
      const nodoSec = encontrarNodoSeccion(m, parte);
      let d = datos;
      let padreId = nodoSec ? nodoSec.id : null;
      if (!padreId) {
        const creado = M.agregarActividad(d, { padre: null, nombre: parte.nombre });
        d = creado.datos;
        padreId = creado.id;
      }
      const esEnt = opciones.tipo === 'entregable';
      const fechaElegida = opciones.fecha || filtroFecha || (esEnt ? FECHA_ENTREGA_LUNES : '');
      const res = M.agregarActividad(d, {
        padre: padreId,
        nombre: limpio,
        tipo: esEnt ? 'entregable' : 'tarea',
        inicio: fechaElegida,
        fin: fechaElegida,
      });
      idCreado = res.id;
      return res.datos;
    });
    if (idCreado && alSeleccionar) {
      alSeleccionar(idCreado);
    }
  }

  function restaurarEntregablesBaseEnModelo() {
    if (!aplicar) return;
    aplicar(datos => {
      let d = datos;
      for (const p of PARTES_COHETE) {
        const listaBase = ENTREGABLES_BASE[p.clave] || [];
        if (!listaBase.length) continue;
        const m = M.construir(d);
        const nodoSec = encontrarNodoSeccion(m, p);
        let padreId = nodoSec ? nodoSec.id : null;
        if (!padreId) {
          const creado = M.agregarActividad(d, { padre: null, nombre: p.nombre });
          d = creado.datos;
          padreId = creado.id;
        }
        const mActual = M.construir(d);
        const existentes = obtenerTareasSeccion(mActual, p);
        for (const base of listaBase) {
          const yaExiste = existentes.some(
            e => normalizarTexto(e.nombre) === normalizarTexto(base.nombre)
          );
          if (!yaExiste) {
            const fecha = base.fecha || FECHA_ENTREGA_LUNES;
            if (base.responsable && !d.equipo.includes(base.responsable)) {
              d = { ...d, equipo: [...d.equipo, base.responsable] };
            }
            d = M.agregarActividad(d, {
              padre: padreId,
              nombre: base.nombre,
              tipo: 'entregable',
              inicio: fecha,
              fin: fecha,
              responsable: base.responsable || '',
              estado: 'pendiente',
            }).datos;
          }
        }
      }
      return d;
    });
  }

  function renderizarItemEdt(t) {
    const li = document.createElement('li');
    li.className = 'po-cohete-item';
    if (t.estado === 'hecha') li.classList.add('done');
    if (t.id === seleccionActual) li.classList.add('selected');
    li.dataset.id = t.id;

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'po-cohete-chk';
    chk.checked = t.estado === 'hecha';
    chk.addEventListener('change', (ev) => {
      ev.stopPropagation();
      alternarTareaEdt(t);
    });

    const cuerpoItem = document.createElement('div');
    cuerpoItem.className = 'po-cohete-item-cuerpo';

    const txt = document.createElement('span');
    txt.className = 'po-cohete-txt';
    txt.textContent = t.nombre;
    cuerpoItem.append(txt);

    const meta = document.createElement('div');
    meta.className = 'po-cohete-meta';
    if (M.esEntregable(t)) {
      const chipTipo = document.createElement('span');
      chipTipo.className = 'po-cohete-badge po-cohete-tipo-entregable';
      chipTipo.textContent = '📦 Entregable';
      meta.append(chipTipo);
    }
    if (t.estado && t.estado !== 'pendiente' && t.estado !== 'hecha') {
      const chipEstado = document.createElement('span');
      chipEstado.className = `po-cohete-badge po-cohete-estado-${t.estado.replace(/\s+/g, '-')}`;
      chipEstado.textContent = t.estado;
      meta.append(chipEstado);
    }
    if (t.responsable) {
      const chipResp = document.createElement('span');
      chipResp.className = 'po-cohete-badge po-cohete-resp';
      chipResp.textContent = `👤 ${t.responsable}`;
      meta.append(chipResp);
    }
    if (t.inicio && t.fin) {
      const chipFecha = document.createElement('span');
      chipFecha.className = 'po-cohete-badge po-cohete-fecha';
      chipFecha.textContent = t.inicio === t.fin ? `📅 ${t.inicio}` : `📅 ${t.inicio} → ${t.fin}`;
      meta.append(chipFecha);
    }
    if (meta.children.length > 0) {
      cuerpoItem.append(meta);
    }

    cuerpoItem.addEventListener('click', () => {
      alSeleccionar(t.id);
    });

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'po-cohete-del';
    btnDel.title = M.esEntregable(t) ? 'Eliminar entregable' : 'Eliminar tarea';
    btnDel.textContent = '×';
    btnDel.addEventListener('click', (ev) => {
      ev.stopPropagation();
      eliminarTareaEdt(t.id);
    });

    li.append(chk, cuerpoItem, btnDel);
    return li;
  }

  function renderizarListaSeccionOCompleta(mensajeVacio) {
    if (!verTodasSecciones) {
      const parte = obtenerInfoParte(parteActiva);
      const items = obtenerItemsParteActual(parte);
      if (items.length === 0) {
        const vacio = document.createElement('li');
        vacio.className = 'po-cohete-vacio';
        vacio.textContent = mensajeVacio;
        listaItems.append(vacio);
      } else {
        for (const item of items) {
          listaItems.append(renderizarItemEdt(item));
        }
      }
      return;
    }

    // Modo "Ver todos": agrupa por cada sección de PARTES_COHETE
    let totalMostrados = 0;
    for (const p of PARTES_COHETE) {
      const items = obtenerItemsParteActual(p);
      if (items.length === 0) continue;
      totalMostrados += items.length;

      const sep = document.createElement('li');
      sep.className = 'po-cohete-grupo-hdr';
      const dot = document.createElement('span');
      dot.className = 'po-cohete-sw';
      dot.style.background = p.color;
      const tit = document.createElement('span');
      tit.className = 'po-cohete-grupo-tit';
      tit.textContent = p.nombre;
      const hechas = items.filter(t => t.estado === 'hecha').length;
      const cnt = document.createElement('span');
      cnt.className = 'po-cohete-grupo-cnt';
      cnt.textContent = `${hechas}/${items.length}`;
      sep.append(dot, tit, cnt);
      sep.addEventListener('click', () => {
        verTodasSecciones = false;
        seleccionarParte(p.clave);
      });
      listaItems.append(sep);

      for (const item of items) {
        listaItems.append(renderizarItemEdt(item));
      }
    }

    if (totalMostrados === 0) {
      const vacio = document.createElement('li');
      vacio.className = 'po-cohete-vacio';
      vacio.textContent = mensajeVacio;
      listaItems.append(vacio);
    }
  }

  function renderizarPanel() {
    if (!modeloActual) return;

    const parte = obtenerInfoParte(parteActiva);
    if (verTodasSecciones) {
      puntoColor.style.background = 'linear-gradient(135deg, #ff7a45, #2dd4bf, #a78bfa)';
      nombreParte.textContent = 'Todas las secciones del cohete';
      ubicacionParte.textContent = 'Vista completa agrupada por cada parte del cohete (haz clic en una parte del dibujo para ver solo esa sección)';
    } else {
      puntoColor.style.background = parte.color;
      nombreParte.textContent = parte.nombre;
      ubicacionParte.textContent = parte.ubicacion;
    }

    btnAlcanceSeccion.classList.toggle('active', !verTodasSecciones);
    btnAlcanceTodas.classList.toggle('active', verTodasSecciones);
    selectParteAgregar.hidden = !verTodasSecciones;
    selectParteAgregar.value = parteActiva;

    // Estado de los controles de fecha
    btnTodasFechas.classList.toggle('active', !filtroFecha);
    btnLunes.classList.toggle('active', filtroFecha === FECHA_ENTREGA_LUNES);
    if (inputFiltroFecha.value !== filtroFecha) {
      inputFiltroFecha.value = filtroFecha;
    }
    if (selectModoFecha.value !== modoFecha) {
      selectModoFecha.value = modoFecha;
    }

    const totActivo = calcularTotalesActuales();
    pillTodas.textContent = !filtroFecha ? `${totActivo.hechas}/${totActivo.total}` : 'ver todas';
    pillLunes.textContent = filtroFecha === FECHA_ENTREGA_LUNES ? `${totActivo.hechas}/${totActivo.total}` : '19/10';

    const pct = totActivo.total ? Math.round((totActivo.hechas / totActivo.total) * 100) : 0;
    barraRelleno.style.width = `${pct}%`;
    const descFecha = filtroFecha
      ? (modoFecha === 'activa' ? `activas el ${filtroFecha}` : `para el ${filtroFecha}`)
      : 'en todas las fechas';
    textoProgreso.textContent = `${totActivo.hechas} / ${totActivo.total} actividades ${descFecha} (${pct}%)`;

    // Actualizar contadores y clases sobre el SVG y la leyenda
    const gruposSvg = contenedorSvg.querySelectorAll('.part');
    for (const g of gruposSvg) {
      const clave = g.getAttribute('data-part');
      const p = obtenerInfoParte(clave);
      const c = calcularConteosParte(p);
      g.classList.toggle('active', !verTodasSecciones && clave === parteActiva);
      g.classList.toggle('done', c.total > 0 && c.hechas === c.total);
      const tspan = g.querySelector(`[data-prog="${clave}"]`);
      if (tspan) {
        tspan.textContent = `${c.hechas}/${c.total}`;
      }
    }

    const botonesLeyenda = leyenda.querySelectorAll('.po-cohete-leyenda-item');
    for (const b of botonesLeyenda) {
      if (b.dataset.part === '__todas__') {
        b.classList.toggle('active', verTodasSecciones);
      } else {
        b.classList.toggle('active', !verTodasSecciones && b.dataset.part === parteActiva);
      }
    }

    const conteoMostrado = verTodasSecciones ? totActivo : calcularConteosParte(parte);
    contadorParte.textContent = `${conteoMostrado.hechas} / ${conteoMostrado.total} completadas`;

    listaItems.replaceChildren();

    if (filtroFecha) {
      const verbo = modoFecha === 'activa' ? 'están activas el' : 'se entregan / terminan el';
      bannerModo.textContent = `📅 Mostrando tareas y entregables del EDT que ${verbo} ${filtroFecha}. Usa "Ver todos" o toca una parte del cohete.`;
      inputNuevo.placeholder = verTodasSecciones
        ? `Nueva actividad para el ${filtroFecha}…`
        : `Nueva actividad en ${parte.nombre} (${filtroFecha})…`;
      notaPie.textContent = `Filtro de fecha activo: ${filtroFecha} (${modoFecha === 'activa' ? 'activas ese día' : 'fecha de entrega'}).`;
    } else {
      bannerModo.textContent = 'Sincronizado con el EDT: aquí ves juntas las tareas y los 📦 entregables de cada sección. Selecciona una fecha arriba para ver qué hay para un día en particular.';
      inputNuevo.placeholder = verTodasSecciones
        ? 'Nueva tarea o entregable…'
        : `Nueva tarea o entregable en ${parte.nombre}…`;
      notaPie.textContent = 'Los cambios se guardan automáticamente en el servidor y actualizan EDT, Gantt y Tabla.';
    }

    const mensajeVacio = filtroFecha
      ? `No hay tareas ni entregables que ${modoFecha === 'activa' ? 'estén activos' : 'se entreguen'} el ${filtroFecha} en esta vista.`
      : 'Sin actividades en esta sección (o filtradas por la barra superior).';
    renderizarListaSeccionOCompleta(mensajeVacio);
  }

  // Eventos de selección de parte en el SVG o en la leyenda
  function seleccionarParte(clave) {
    if (clave === '__todas__') {
      verTodasSecciones = true;
      renderizarPanel();
      return;
    }
    verTodasSecciones = false;
    parteActiva = clave;
    if (modeloActual) {
      const parte = obtenerInfoParte(clave);
      const nodoSec = encontrarNodoSeccion(modeloActual, parte);
      if (nodoSec) {
        alSeleccionar(nodoSec.id);
        return;
      }
    }
    renderizarPanel();
  }

  for (const g of contenedorSvg.querySelectorAll('.part')) {
    g.addEventListener('click', () => {
      const clave = g.getAttribute('data-part');
      if (clave) seleccionarParte(clave);
    }, { signal });
  }

  for (const btn of leyenda.querySelectorAll('.po-cohete-leyenda-item')) {
    btn.addEventListener('click', () => {
      if (btn.dataset.part) seleccionarParte(btn.dataset.part);
    }, { signal });
  }

  btnAlcanceSeccion.addEventListener('click', () => {
    verTodasSecciones = false;
    renderizarPanel();
  }, { signal });

  btnAlcanceTodas.addEventListener('click', () => {
    verTodasSecciones = true;
    renderizarPanel();
  }, { signal });

  btnTodasFechas.addEventListener('click', () => {
    aplicarCambioFecha('', modoFecha);
  }, { signal });

  btnLunes.addEventListener('click', () => {
    verTodasSecciones = true;
    aplicarCambioFecha(FECHA_ENTREGA_LUNES, modoFecha);
  }, { signal });

  selectModoFecha.addEventListener('change', () => {
    modoFecha = selectModoFecha.value || 'fin';
    if (filtroFecha) {
      aplicarCambioFecha(filtroFecha, modoFecha);
    } else {
      renderizarPanel();
    }
  }, { signal });

  inputFiltroFecha.addEventListener('change', () => {
    if (inputFiltroFecha.value) {
      verTodasSecciones = true;
    }
    aplicarCambioFecha(inputFiltroFecha.value || '', modoFecha);
  }, { signal });

  checkRayosX.addEventListener('change', () => {
    const svg = contenedorSvg.querySelector('svg');
    if (svg) {
      svg.classList.toggle('hide-inner', !checkRayosX.checked);
    }
  }, { signal });

  filaAgregar.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const texto = inputNuevo.value.trim();
    if (!texto) return;
    const claveDestino = verTodasSecciones ? (selectParteAgregar.value || parteActiva) : parteActiva;
    const parte = obtenerInfoParte(claveDestino);
    const tipoElegido = selectTipoAgregar.value || (filtroFecha ? 'entregable' : 'tarea');
    const fechaElegida = inputFechaNuevo.value || filtroFecha || (tipoElegido === 'entregable' ? FECHA_ENTREGA_LUNES : '');
    inputNuevo.value = '';
    agregarActividadEnSeccion(parte, texto, { tipo: tipoElegido, fecha: fechaElegida });
  }, { signal });

  btnRestaurarEntrega.addEventListener('click', () => {
    restaurarEntregablesBaseEnModelo();
  }, { signal });

  return {
    mostrar(modelo, seleccionId) {
      modeloActual = modelo;
      seleccionActual = seleccionId;
      if (filtros) {
        filtroFecha = filtros.fecha || '';
        modoFecha = filtros.modoFecha || 'fin';
      }
      if (seleccionId && modelo) {
        const parteDet = determinarParteDeActividad(modelo, seleccionId);
        if (parteDet) {
          parteActiva = parteDet;
        }
      }
      renderizarPanel();
    },
    destruir() {
      control.abort();
      contenedor.replaceChildren();
    },
  };
}
