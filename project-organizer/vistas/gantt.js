// Clases usadas: .po-gantt, .po-gantt-barra, .po-gantt-scroll, .po-gantt-canvas,
// .po-gantt-leyenda, .po-gantt-leyenda-item, .po-gantt-leyenda-icono, .po-boton, .po-campo
import * as M from '../comun/modelo.js';

const DAY = 86400000;
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sept','oct','nov','dic'];
const MESES_L = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const PALETA = ['#2F55CF','#1B7A4B','#C2572F','#7B5BD6','#2B8FA3','#9E6310','#A23B72','#5B6B7A'];
const PALETA_D = ['#7A9BFF','#4CC38A','#F08A5D','#A98BF0','#4CB8CC','#E3A948','#E07AB0','#95A3B0'];

const TEMA_LIGHT = {
  bg: '#FFFFFF', surface: '#FFFFFF', surface2: '#F5F7F9',
  ink: '#15202B', muted: '#5A6774', line: '#D3D9DF',
  accent: '#1F4FD1', chip: '#E2E7EC', bad: '#BA2F27'
};

const cssVar = (nombre) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
const esOscuro = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};
const aTs = (fecha) => {
  const [a, m, d] = fecha.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
const fmt = (ts) => {
  const d = new Date(ts);
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
};
const clave = (ts) => new Date(ts).toISOString().slice(0, 7);
const recortar = (ctx, s, max) => {
  if (ctx.measureText(s).width <= max) return s;
  while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
};
const rombo = (ctx, cx, cy, r) => {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy);
  ctx.closePath();
};
const F = (peso, px) => `${peso} ${px}px Archivo, system-ui, sans-serif`;
const FMono = (peso, px) => `${peso} ${px}px IBM Plex Mono, ui-monospace, monospace`;

function contarActividades(nodo) {
  let total = 0;
  const pila = [...nodo.hijos];
  while (pila.length) {
    const actual = pila.pop();
    total++;
    pila.push(...actual.hijos);
  }
  return total;
}

export function crearVista(contenedor, { alSeleccionar }) {
  let modelo = null;
  let seleccionId = null;
  let filasActuales = [];
  let posiciones = [];
  const plegados = new Set();
  let desde = '';
  let hasta = '';

  // DOM
  const raiz = document.createElement('div');
  raiz.className = 'po-gantt';
  contenedor.append(raiz);

  const barra = document.createElement('div');
  barra.className = 'po-gantt-barra';
  raiz.append(barra);

  const labelDesde = document.createElement('label');
  labelDesde.textContent = 'Desde ';
  const selectDesde = document.createElement('select');
  selectDesde.className = 'po-campo';
  labelDesde.append(selectDesde);
  barra.append(labelDesde);

  const labelHasta = document.createElement('label');
  labelHasta.textContent = 'Hasta ';
  const selectHasta = document.createElement('select');
  selectHasta.className = 'po-campo';
  labelHasta.append(selectHasta);
  barra.append(labelHasta);

  const btnMes = document.createElement('button');
  btnMes.type = 'button';
  btnMes.className = 'po-boton';
  btnMes.textContent = 'Desde hace un mes';
  barra.append(btnMes);

  const btnTodo = document.createElement('button');
  btnTodo.type = 'button';
  btnTodo.className = 'po-boton';
  btnTodo.textContent = 'Todo';
  barra.append(btnTodo);

  const btnPlegar = document.createElement('button');
  btnPlegar.type = 'button';
  btnPlegar.className = 'po-boton';
  barra.append(btnPlegar);

  const btnExportar = document.createElement('button');
  btnExportar.type = 'button';
  btnExportar.className = 'po-boton';
  btnExportar.textContent = 'Exportar imagen';
  barra.append(btnExportar);

  const wrap = document.createElement('div');
  wrap.className = 'po-gantt-scroll';
  raiz.append(wrap);

  const canvas = document.createElement('canvas');
  canvas.className = 'po-gantt-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Diagrama de Gantt');
  wrap.append(canvas);

  const leyenda = document.createElement('div');
  leyenda.className = 'po-gantt-leyenda';
  raiz.append(leyenda);

  const ctx = canvas.getContext('2d');

  // helpers de tema
  function temaColores(dark) {
    return {
      bg: cssVar('--bg') || (dark ? '#0F161D' : '#ECEFF2'),
      surface: cssVar('--surface') || (dark ? '#17212B' : '#FFFFFF'),
      surface2: cssVar('--surface2') || (dark ? '#1C2733' : '#F5F7F9'),
      ink: cssVar('--ink') || (dark ? '#E5EBF0' : '#15202B'),
      muted: cssVar('--muted') || (dark ? '#95A3B0' : '#5A6774'),
      line: cssVar('--line') || (dark ? '#2B3947' : '#D3D9DF'),
      accent: cssVar('--accent') || (dark ? '#7C9CFF' : '#1F4FD1'),
      chip: cssVar('--chip') || (dark ? '#23303D' : '#E2E7EC'),
      bad: cssVar('--bad') || (dark ? '#F0736B' : '#BA2F27')
    };
  }

  function colorResponsable(responsable, dark) {
    const indice = modelo ? modelo.equipo.indexOf(responsable) : -1;
    return (dark ? PALETA_D : PALETA)[Math.max(indice, 0) % PALETA.length];
  }

  function solapaConRango(inicio, fin) {
    if (!inicio || !fin) return true;
    if (!desde && !hasta) return true;
    const iniTs = aTs(inicio);
    const finTs = aTs(fin);
    const desdeTs = desde ? Date.UTC(+desde.slice(0, 4), +desde.slice(5) - 1, 1) : -Infinity;
    const hastaTs = hasta ? Date.UTC(+hasta.slice(0, 4), +hasta.slice(5), 1) - DAY : Infinity;
    return finTs >= desdeTs && iniTs <= hastaTs;
  }

  function construirFilas() {
    if (!modelo) return [];
    const filas = [];
    const visitar = (nodo) => {
      filas.push({ tipo: 'actividad', id: nodo.id, nodo, inicio: nodo.inicio, fin: nodo.fin });
      if (!plegados.has(nodo.id)) nodo.hijos.forEach(visitar);
    };
    modelo.raiz.hijos.forEach(visitar);

    const filtradas = filas.filter(f => solapaConRango(f.nodo.inicio, f.nodo.fin));
    const hitosVisibles = modelo.hitos.filter(h => solapaConRango(h.inicio, h.fin));
    const resultado = [...filtradas];

    if (hitosVisibles.length) {
      resultado.push({ tipo: 'grupo', nombre: 'Hitos' });
      hitosVisibles.forEach(h => resultado.push({ tipo: 'hito', id: h.id, ...h }));
    }
    return resultado;
  }

  function calcularLabelW(ctx, filas) {
    const anchos = filas.map(f => {
      if (f.tipo === 'grupo') return ctx.measureText('HITOS').width;
      if (f.tipo === 'hito') {
        ctx.font = F(650, 13);
        return ctx.measureText(f.nombre).width;
      }
      const nodo = f.nodo;
      const sangria = nodo.nivel * 14 + (nodo.hijos.length ? 16 : 0);
      ctx.font = F(650, 13);
      const anchoNombre = ctx.measureText(nodo.nombre).width;
      let total = sangria + anchoNombre;
      if (nodo.codigo) {
        ctx.font = FMono(600, 11);
        total += ctx.measureText(nodo.codigo).width + 8;
      }
      return total;
    });
    const maxAncho = anchos.length ? Math.max(...anchos) : 0;
    return Math.min(Math.max(maxAncho + 32, 220), 340);
  }

  function dibujarEtiqueta(ctx, fila, y, h, labelW, T) {
    if (fila.tipo === 'grupo') {
      ctx.fillStyle = T.ink;
      ctx.font = F(800, 12);
      ctx.fillText(fila.nombre.toUpperCase(), 16, y + h / 2 + 0.5);
      return;
    }

    if (fila.tipo === 'hito') {
      ctx.fillStyle = T.ink;
      ctx.font = F(650, 13);
      ctx.fillText(recortar(ctx, fila.nombre, labelW - 28), 16, y + 15);
      ctx.fillStyle = T.muted;
      ctx.font = F(500, 11.5);
      const sub = `${fila.responsable || 'Sin responsable'} · ${fila.inicio === fila.fin ? 'Hito' : 'Periodo'}`;
      ctx.fillText(recortar(ctx, sub, labelW - 28), 16, y + 30);
      return;
    }

    const nodo = fila.nodo;
    const esPadre = nodo.hijos.length > 0;
    const sangria = nodo.nivel * 14;
    let x = 16 + sangria + (esPadre ? 16 : 0);

    if (esPadre) {
      const cx = 16, cy = y + h / 2;
      ctx.fillStyle = T.muted;
      if (plegados.has(nodo.id)) {
        ctx.beginPath();
        ctx.moveTo(cx - 4, cy - 6); ctx.lineTo(cx + 4, cy); ctx.lineTo(cx - 4, cy + 6);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy - 4); ctx.lineTo(cx + 6, cy - 4); ctx.lineTo(cx, cy + 4);
        ctx.closePath(); ctx.fill();
      }
    }

    if (nodo.codigo) {
      ctx.font = FMono(600, 11);
      ctx.fillStyle = T.muted;
      ctx.fillText(nodo.codigo, x, y + 15);
      x += ctx.measureText(nodo.codigo).width + 8;
    }

    ctx.font = F(650, 13);
    ctx.fillStyle = T.ink;
    const esEnt = nodo.esHoja && nodo.datos && nodo.datos.tipo === 'entregable';
    const nombreEtiqueta = esEnt ? `📦 ${nodo.nombre}` : nodo.nombre;
    ctx.fillText(recortar(ctx, nombreEtiqueta, labelW - x - 12), x, y + 15);

    ctx.fillStyle = T.muted;
    ctx.font = F(500, 11.5);
    const numSub = contarActividades(nodo);
    const sub = esPadre
      ? `${numSub} ${numSub === 1 ? 'actividad' : 'actividades'}${nodo.responsable ? ' · ' + nodo.responsable : ''}`
      : `${esEnt ? 'Entregable · ' : ''}${nodo.responsable || 'Sin responsable'}`;
    ctx.fillText(recortar(ctx, sub, labelW - 16), 16, y + 30);
  }

  function dibujarLeyendaExportar(ctx, T, dark, yLeyenda) {
    let lx = 16;
    ctx.font = F(500, 12.5);
    ctx.fillStyle = T.muted;

    for (const r of modelo.equipo) {
      ctx.fillStyle = colorResponsable(r, dark);
      ctx.beginPath(); ctx.roundRect(lx, yLeyenda - 5, 11, 11, 2); ctx.fill();
      ctx.fillStyle = T.muted;
      ctx.fillText(r, lx + 18, yLeyenda);
      lx += 18 + ctx.measureText(r).width + 22;
    }

    if (modelo.hitos.some(h => h.inicio === h.fin)) {
      ctx.fillStyle = T.bad;
      rombo(ctx, lx + 6, yLeyenda, 6);
      ctx.fill();
      ctx.fillStyle = T.muted;
      const txt = 'Hito';
      ctx.fillText(txt, lx + 18, yLeyenda);
      lx += 18 + ctx.measureText(txt).width + 22;
    }

    if (modelo.hitos.some(h => h.inicio !== h.fin)) {
      ctx.strokeStyle = T.bad;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(lx, yLeyenda - 5, 14, 11, 3); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = T.muted;
      const txt = 'Periodo';
      ctx.fillText(txt, lx + 18, yLeyenda);
      lx += 18 + ctx.measureText(txt).width + 22;
    }
  }

  function dibujarCanvas(canvas, opts) {
    const dark = opts.dark;
    const T = opts.exportar ? TEMA_LIGHT : temaColores(dark);
    const s = opts.escala || 1;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'middle';

    if (!filasActuales.length) {
      const W = Math.min(opts.exportar ? 800 : (wrap.clientWidth || 800), 1200);
      const H = 140;
      canvas.width = W * s;
      canvas.height = H * s;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      ctx.fillStyle = T.surface;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = T.muted;
      ctx.font = F(500, 14);
      ctx.textAlign = 'center';
      ctx.fillText('No hay actividades en ese rango de meses.', W / 2, H / 2);
      ctx.textAlign = 'left';
      if (!opts.exportar) {
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
      }
      posiciones = [];
      return;
    }

    const labelW = calcularLabelW(ctx, filasActuales);
    const filasConFechas = filasActuales.filter(f => (f.tipo === 'actividad' || f.tipo === 'hito') && f.inicio && f.fin);
    const conFechas = filasConFechas.length > 0;

    if (conFechas) {
      dibujarConFechas(ctx, canvas, opts, T, labelW, filasConFechas);
    } else {
      dibujarSinFechas(ctx, canvas, opts, T, labelW);
    }
  }

  function dibujarConFechas(ctx, canvas, opts, T, labelW, filasConFechas) {
    const dark = opts.dark;
    const s = opts.escala || 1;
    const rowH = 42;
    const grpH = filasActuales.some(f => f.tipo === 'grupo') ? 30 : 0;
    const mesH = 26, semH = 24;
    const titH = opts.exportar ? 66 : 0;
    const legH = opts.exportar ? 50 : 0;

    let a = Math.min(...filasConFechas.map(f => aTs(f.inicio)));
    let b = Math.max(...filasConFechas.map(f => aTs(f.fin)));
    a -= ((new Date(a).getUTCDay() + 6) % 7) * DAY;
    b += (6 - (new Date(b).getUTCDay() + 6) % 7) * DAY;
    const t0 = a;
    const dias = Math.round((b - a) / DAY) + 1;
    const dayW = opts.exportar
      ? Math.max(5, Math.min(18, 2200 / dias))
      : Math.max(3, Math.min(30, (opts.ancho - labelW) / dias));

    const top = titH + mesH + semH;
    const cuerpo = filasActuales.reduce((suma, f) => suma + (f.tipo === 'grupo' ? grpH : rowH), 0);
    const W = Math.ceil(labelW + dias * dayW);
    const H = top + cuerpo + legH + 1;

    canvas.width = W * s;
    canvas.height = H * s;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    if (!opts.exportar) {
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
    }
    ctx.fillStyle = T.surface;
    ctx.fillRect(0, 0, W, H);

    const x = t => labelW + ((t - t0) / DAY) * dayW;
    const hoy = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());

    // posiciones
    const pos = [];
    let y = top;
    filasActuales.forEach(f => {
      const h = f.tipo === 'grupo' ? grpH : rowH;
      pos.push({ ...f, y, h });
      y += h;
    });

    // fondos alternos y grupos
    pos.forEach((p, i) => {
      if (p.tipo === 'grupo') {
        ctx.fillStyle = T.surface2;
        ctx.fillRect(0, p.y, W, p.h);
      } else if (i % 2) {
        ctx.fillStyle = T.surface2;
        ctx.fillRect(0, p.y, W, p.h);
      }
    });

    // fines de semana
    if (dayW >= 8) {
      ctx.fillStyle = T.chip;
      ctx.globalAlpha = 0.5;
      for (let d = 0; d < dias; d++) {
        if ((new Date(t0 + d * DAY).getUTCDay() + 6) % 7 >= 5) {
          ctx.fillRect(labelW + d * dayW, top - semH, dayW, semH + cuerpo);
        }
      }
      ctx.globalAlpha = 1;
    }

    // semanas
    const semW = 7 * dayW;
    ctx.font = F(500, 11);
    for (let d = 0; d < dias; d += 7) {
      const x0 = labelW + d * dayW;
      ctx.strokeStyle = T.line;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(x0 + 0.5, titH + mesH);
      ctx.lineTo(x0 + 0.5, top + cuerpo);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const dt = new Date(t0 + d * DAY);
      const txt = semW >= 44 ? fmt(t0 + d * DAY) : semW >= 16 ? String(dt.getUTCDate()) : '';
      if (txt) {
        ctx.fillStyle = T.muted;
        ctx.textAlign = 'center';
        ctx.fillText(txt, x0 + semW / 2, titH + mesH + semH / 2);
        ctx.textAlign = 'left';
      }
    }

    // meses
    ctx.font = F(700, 12.5);
    for (let d = 0; d < dias;) {
      const m = new Date(t0 + d * DAY).getUTCMonth();
      const yr = new Date(t0 + d * DAY).getUTCFullYear();
      let e = d;
      while (e < dias && new Date(t0 + e * DAY).getUTCMonth() === m) e++;
      const x0 = labelW + d * dayW;
      const x1 = labelW + e * dayW;
      ctx.strokeStyle = T.line;
      ctx.beginPath();
      ctx.moveTo(x0 + 0.5, titH);
      ctx.lineTo(x0 + 0.5, top + cuerpo);
      ctx.stroke();
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, titH, x1 - x0, mesH);
      ctx.clip();
      ctx.fillStyle = T.ink;
      const nombre = x1 - x0 > 120 ? `${MESES_L[m]} ${yr}` : x1 - x0 > 70 ? MESES_L[m] : MESES[m];
      ctx.fillText(nombre, x0 + 8, titH + mesH / 2);
      ctx.restore();
      d = e;
    }

    // líneas de cabecera
    ctx.strokeStyle = T.line;
    [titH, titH + mesH, top, top + cuerpo].forEach(yy => {
      ctx.beginPath();
      ctx.moveTo(0, yy + 0.5);
      ctx.lineTo(W, yy + 0.5);
      ctx.stroke();
    });
    ctx.fillStyle = T.muted;
    ctx.font = F(700, 11);
    ctx.fillText('ACTIVIDAD', 16, titH + (mesH + semH) / 2);

    // hoy
    const hayHoy = hoy >= t0 && hoy < t0 + dias * DAY;
    const hx = Math.round(x(hoy) + dayW / 2) + 0.5;
    if (hayHoy) {
      ctx.strokeStyle = T.accent;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(hx, top);
      ctx.lineTo(hx, top + cuerpo);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1;
    }

    // selección
    pos.forEach(p => {
      if (p.id === seleccionId) {
        ctx.fillStyle = T.accent;
        ctx.globalAlpha = 0.1;
        ctx.fillRect(0, p.y, W, p.h);
        ctx.globalAlpha = 1;
      }
    });

    // filas: etiqueta + barra
    pos.forEach(p => {
      dibujarEtiqueta(ctx, p, p.y, p.h, labelW, T);
      if (p.tipo === 'grupo') return;
      if (!p.inicio || !p.fin) {
        ctx.fillStyle = T.muted;
        ctx.font = F(500, 12);
        ctx.fillText('sin fechas', labelW + 16, p.y + p.h / 2);
        return;
      }

      const bx = x(aTs(p.inicio));
      const bw = x(aTs(M.sumarDias(p.fin, 1))) - bx;
      const cy = p.y + p.h / 2;

      ctx.save();
      ctx.beginPath();
      ctx.rect(labelW + 1, p.y, W - labelW, p.h);
      ctx.clip();

      if (p.tipo === 'hito') {
        if (p.inicio === p.fin) {
          const cx = bx + dayW / 2;
          ctx.fillStyle = T.bad;
          rombo(ctx, cx, cy, 8);
          ctx.fill();
          ctx.strokeStyle = T.surface;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.lineWidth = 1;
          ctx.fillStyle = T.ink;
          ctx.font = F(650, 11);
          ctx.fillText(fmt(aTs(p.inicio)), cx + 13, cy + 0.5);
        } else {
          const bh = p.h - 20;
          ctx.fillStyle = T.bad;
          ctx.globalAlpha = 0.16;
          ctx.beginPath(); ctx.roundRect(bx + 0.5, cy - bh / 2, Math.max(bw - 1, 4), bh, 5); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = T.bad;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.lineWidth = 1;
          ctx.fillStyle = T.ink;
          ctx.font = F(650, 11);
          const txt = `${fmt(aTs(p.inicio))} – ${fmt(aTs(p.fin))}`;
          if (ctx.measureText(txt).width + 14 < bw) ctx.fillText(txt, bx + 7, cy + 0.5);
          else if (bx + bw + 6 + ctx.measureText(txt).width < W) ctx.fillText(txt, bx + bw + 6, cy + 0.5);
          else {
            ctx.textAlign = 'right';
            ctx.fillText(txt, bx - 6, cy + 0.5);
            ctx.textAlign = 'left';
          }
        }
      } else {
        const nodo = p.nodo;
        const esPadre = nodo.hijos.length > 0;
        if (esPadre) {
          ctx.fillStyle = T.line;
          ctx.beginPath(); ctx.roundRect(bx + 1, cy - 2, Math.max(bw - 2, 3), 5, 2); ctx.fill();
          if (nodo.avance > 0) {
            ctx.fillStyle = T.accent;
            ctx.beginPath(); ctx.roundRect(bx + 1, cy - 2, Math.max((bw - 2) * nodo.avance, 1), 5, 2); ctx.fill();
          }
        } else {
          const responsable = nodo.responsable;
          const estado = nodo.estado;
          const color = responsable ? colorResponsable(responsable, dark) : T.chip;
          const nd = M.diasEntre(p.inicio, p.fin);
          const txtDias = `${nd} ${nd === 1 ? 'día' : 'días'}`;
          const extra = estado === 'hecha' ? ' ✓' : '';
          const textoBarra = recortar(ctx, txtDias + extra, bw - 10);
          if (estado === 'hecha') ctx.globalAlpha = 0.55;
          ctx.fillStyle = color;
          const bh = p.h - 20;
          ctx.beginPath(); ctx.roundRect(bx + 1, cy - bh / 2, Math.max(bw - 2, 3), bh, 5); ctx.fill();
          if (estado === 'bloqueada') {
            ctx.strokeStyle = T.bad;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.lineWidth = 1;
          }
          ctx.fillStyle = responsable ? (dark ? '#0F161D' : '#FFFFFF') : T.ink;
          ctx.font = F(650, 11);
          if (bw > 24) ctx.fillText(textoBarra, Math.max(bx, labelW) + 8, cy + 0.5);
        }
      }
      ctx.restore();
    });

    // separador de etiquetas
    ctx.strokeStyle = T.line;
    ctx.beginPath();
    ctx.moveTo(labelW + 0.5, titH);
    ctx.lineTo(labelW + 0.5, top + cuerpo);
    ctx.stroke();

    // etiqueta HOY
    if (hayHoy) {
      ctx.font = F(800, 10);
      const tw = ctx.measureText('HOY').width + 10;
      ctx.fillStyle = T.accent;
      ctx.beginPath(); ctx.roundRect(hx - tw / 2, top - semH + 4, tw, 15, 7); ctx.fill();
      ctx.fillStyle = dark ? '#0F161D' : '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText('HOY', hx, top - semH + 12);
      ctx.textAlign = 'left';
    }

    // título y subtítulo exportación
    if (opts.exportar) {
      const ahora = new Date();
      ctx.fillStyle = T.ink;
      ctx.font = F(800, 26);
      ctx.fillText(modelo.proyecto.nombre || 'Proyecto', 16, 28);
      ctx.fillStyle = T.muted;
      ctx.font = F(500, 13);
      const rangoTxt = (desde || hasta)
        ? ` · ${desde ? nombreMes(desde) : 'inicio'} – ${hasta ? nombreMes(hasta) : 'final'}`
        : '';
      ctx.fillText(
        `Cronograma${rangoTxt} · actualizado ${ahora.getDate()} de ${MESES[ahora.getMonth()]} de ${ahora.getFullYear()}`,
        16, 51
      );
      dibujarLeyendaExportar(ctx, T, dark, top + cuerpo + 25);
    }

    posiciones = pos;
  }

  function dibujarSinFechas(ctx, canvas, opts, T, labelW) {
    const dark = opts.dark;
    const s = opts.escala || 1;
    const rowH = 42;
    const titH = opts.exportar ? 66 : 0;
    const legH = opts.exportar ? 50 : 0;
    const top = titH;
    const cuerpo = filasActuales.reduce((suma) => suma + rowH, 0);
    const W = Math.ceil(labelW + 360);
    const H = top + cuerpo + legH + 1;

    canvas.width = W * s;
    canvas.height = H * s;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    if (!opts.exportar) {
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
    }
    ctx.fillStyle = T.surface;
    ctx.fillRect(0, 0, W, H);

    const pos = [];
    let y = top;
    filasActuales.forEach(f => {
      pos.push({ ...f, y, h: rowH });
      y += rowH;
    });

    pos.forEach((p, i) => {
      if (i % 2) {
        ctx.fillStyle = T.surface2;
        ctx.fillRect(0, p.y, W, p.h);
      }
      if (p.id === seleccionId) {
        ctx.fillStyle = T.accent;
        ctx.globalAlpha = 0.1;
        ctx.fillRect(0, p.y, W, p.h);
        ctx.globalAlpha = 1;
      }
    });

    pos.forEach(p => {
      dibujarEtiqueta(ctx, p, p.y, p.h, labelW, T);
      if (p.tipo === 'actividad') {
        ctx.fillStyle = T.muted;
        ctx.font = F(500, 12);
        ctx.fillText('sin fechas', labelW + 16, p.y + p.h / 2);
      }
    });

    ctx.strokeStyle = T.line;
    ctx.beginPath();
    ctx.moveTo(labelW + 0.5, titH);
    ctx.lineTo(labelW + 0.5, top + cuerpo);
    ctx.stroke();

    if (opts.exportar) {
      const ahora = new Date();
      ctx.fillStyle = T.ink;
      ctx.font = F(800, 26);
      ctx.fillText(modelo.proyecto.nombre || 'Proyecto', 16, 28);
      ctx.fillStyle = T.muted;
      ctx.font = F(500, 13);
      ctx.fillText(
        `Cronograma · actualizado ${ahora.getDate()} de ${MESES[ahora.getMonth()]} de ${ahora.getFullYear()}`,
        16, 51
      );
      dibujarLeyendaExportar(ctx, T, dark, top + cuerpo + 25);
    }

    posiciones = pos;
  }

  function nombreMes(k) {
    const d = new Date(Date.UTC(+k.slice(0, 4), +k.slice(5) - 1, 1));
    return `${MESES_L[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  function llenarMeses() {
    const vaciar = (sel, texto) => sel.replaceChildren(new Option(texto, ''));
    if (!modelo || !modelo.rango) {
      vaciar(selectDesde, 'Sin fechas');
      vaciar(selectHasta, 'Sin fechas');
      selectDesde.disabled = selectHasta.disabled = btnMes.disabled = btnTodo.disabled = true;
      return;
    }
    selectDesde.disabled = selectHasta.disabled = btnMes.disabled = btnTodo.disabled = false;

    const a = clave(aTs(modelo.rango.inicio));
    const b = clave(aTs(modelo.rango.fin));
    const meses = [];
    for (let t = Date.UTC(+a.slice(0, 4), +a.slice(5) - 1, 1); clave(t) <= b; t = Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth() + 1, 1)) {
      meses.push(clave(t));
    }
    const opciones = (textoVacio) => [
      new Option(textoVacio, ''),
      ...meses.map(k => {
        const d = new Date(Date.UTC(+k.slice(0, 4), +k.slice(5) - 1, 1));
        return new Option(`${MESES_L[d.getUTCMonth()]} ${d.getUTCFullYear()}`, k);
      })
    ];
    selectDesde.replaceChildren(...opciones('El inicio'));
    selectHasta.replaceChildren(...opciones('El final'));

    if (!meses.includes(desde)) desde = '';
    if (!meses.includes(hasta)) hasta = '';
    selectDesde.value = desde;
    selectHasta.value = hasta;
  }

  function actualizarBotonPlegar() {
    if (!modelo) {
      btnPlegar.hidden = true;
      return;
    }
    const padres = [...modelo.porId.values()].filter(n => n.hijos.length);
    btnPlegar.hidden = padres.length === 0;
    if (padres.length) {
      const hayPlegables = padres.some(n => !plegados.has(n.id));
      btnPlegar.textContent = hayPlegables ? 'Plegar todo' : 'Desplegar todo';
    }
  }

  function actualizarLeyenda() {
    leyenda.replaceChildren();
    if (!modelo) {
      leyenda.hidden = true;
      return;
    }
    const dark = esOscuro();
    const T = temaColores(dark);
    const items = [];

    for (const r of modelo.equipo) {
      const item = document.createElement('span');
      item.className = 'po-gantt-leyenda-item';
      const icono = document.createElement('i');
      icono.className = 'po-gantt-leyenda-icono';
      Object.assign(icono.style, {
        display: 'inline-block', width: '10px', height: '10px',
        borderRadius: '2px', marginRight: '6px', verticalAlign: '-1px',
        background: colorResponsable(r, dark)
      });
      item.append(icono, document.createTextNode(r));
      items.push(item);
    }

    if (modelo.hitos.some(h => h.inicio === h.fin)) {
      const item = document.createElement('span');
      item.className = 'po-gantt-leyenda-item';
      const icono = document.createElement('i');
      icono.className = 'po-gantt-leyenda-icono';
      Object.assign(icono.style, {
        display: 'inline-block', width: '10px', height: '10px',
        marginRight: '6px', verticalAlign: '-1px',
        background: T.bad, transform: 'rotate(45deg) scale(.85)'
      });
      item.append(icono, document.createTextNode('Hito'));
      items.push(item);
    }

    if (modelo.hitos.some(h => h.inicio !== h.fin)) {
      const item = document.createElement('span');
      item.className = 'po-gantt-leyenda-item';
      const icono = document.createElement('i');
      icono.className = 'po-gantt-leyenda-icono';
      Object.assign(icono.style, {
        display: 'inline-block', width: '14px', height: '10px',
        marginRight: '6px', verticalAlign: '-1px',
        border: `1.5px solid ${T.bad}`, borderRadius: '2px'
      });
      item.append(icono, document.createTextNode('Periodo'));
      items.push(item);
    }

    leyenda.append(...items);
    leyenda.hidden = items.length === 0;
  }

  function redibujar() {
    if (!modelo) {
      filasActuales = [];
      posiciones = [];
      llenarMeses();
      actualizarLeyenda();
      actualizarBotonPlegar();
      canvas.width = 0;
      canvas.height = 0;
      return;
    }
    filasActuales = construirFilas();
    actualizarBotonPlegar();
    const ancho = wrap.clientWidth || 800;
    dibujarCanvas(canvas, { exportar: false, dark: esOscuro(), escala: devicePixelRatio || 1, ancho });
    actualizarLeyenda();
  }

  function exportarPNG() {
    if (!modelo || !filasActuales.length) return;
    const temp = document.createElement('canvas');
    dibujarCanvas(temp, { exportar: true, dark: false, escala: 3, ancho: 0 });
    temp.toBlob(blob => {
      if (!blob) return;
      const base = (modelo.proyecto.nombre || 'proyecto').trim().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'gantt';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `gantt-${base}.png`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  }

  // eventos
  selectDesde.addEventListener('change', () => {
    desde = selectDesde.value;
    if (hasta && hasta < desde) {
      hasta = '';
      selectHasta.value = '';
    }
    redibujar();
  });

  selectHasta.addEventListener('change', () => {
    hasta = selectHasta.value;
    if (desde && hasta && hasta < desde) {
      desde = '';
      selectDesde.value = '';
    }
    redibujar();
  });

  btnMes.addEventListener('click', () => {
    if (!modelo?.rango) return;
    const n = new Date();
    desde = clave(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - 1, 1));
    hasta = '';
    selectDesde.value = desde;
    selectHasta.value = '';
    redibujar();
  });

  btnTodo.addEventListener('click', () => {
    desde = '';
    hasta = '';
    selectDesde.value = '';
    selectHasta.value = '';
    redibujar();
  });

  btnPlegar.addEventListener('click', () => {
    const padres = [...modelo.porId.values()].filter(n => n.hijos.length);
    const hayPlegables = padres.some(n => !plegados.has(n.id));
    if (hayPlegables) padres.forEach(n => plegados.add(n.id));
    else plegados.clear();
    redibujar();
  });

  btnExportar.addEventListener('click', exportarPNG);

  let punteroInicio = null;

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    punteroInicio = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      pointerType: e.pointerType,
    };
  });

  canvas.addEventListener('pointercancel', () => {
    punteroInicio = null;
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!punteroInicio) return;
    if (
      e.pointerId !== undefined &&
      punteroInicio.pointerId !== undefined &&
      e.pointerId !== punteroInicio.pointerId
    ) {
      return;
    }
    const dx = e.clientX - punteroInicio.x;
    const dy = e.clientY - punteroInicio.y;
    const distancia = Math.hypot(dx, dy);
    punteroInicio = null;

    if (distancia >= 6) return;

    if (!posiciones.length) {
      alSeleccionar(null);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const fila = posiciones.find(p => p.tipo !== 'grupo' && y >= p.y && y < p.y + p.h);
    if (!fila) {
      alSeleccionar(null);
      return;
    }
    const anchoZonaPlegado = 36;
    if (fila.tipo === 'actividad' && fila.nodo.hijos.length && x >= 0 && x < anchoZonaPlegado) {
      if (plegados.has(fila.id)) plegados.delete(fila.id);
      else plegados.add(fila.id);
      redibujar();
      return;
    }
    alSeleccionar(fila.id);
  });

  const resizeObserver = new ResizeObserver(() => {
    if (modelo) redibujar();
  });
  resizeObserver.observe(wrap);

  const media = matchMedia('(prefers-color-scheme: dark)');
  const onDarkChange = () => {
    if (modelo) redibujar();
  };
  media.addEventListener('change', onDarkChange);

  return {
    mostrar(modeloNuevo, seleccionIdNuevo) {
      modelo = modeloNuevo || null;
      seleccionId = seleccionIdNuevo || null;

      if (!modelo) {
        filasActuales = [];
        posiciones = [];
        llenarMeses();
        actualizarLeyenda();
        actualizarBotonPlegar();
        canvas.width = 0;
        canvas.height = 0;
        return;
      }

      for (const id of [...plegados]) {
        const nodo = modelo.porId.get(id);
        if (!nodo || !nodo.hijos.length) plegados.delete(id);
      }
      llenarMeses();
      redibujar();
    },

    destruir() {
      resizeObserver.disconnect();
      media.removeEventListener('change', onDarkChange);
      contenedor.replaceChildren();
    }
  };
}
