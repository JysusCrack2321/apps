// vistas/edt.js
// Clases CSS generadas: po-edt-contenedor, po-edt-barra, po-edt-lienzo, po-edt-fondo,
// po-edt-link, po-edt-nodo, po-edt-avance, po-edt-codigo, po-edt-nombre, po-edt-estado.
// Además usa po-boton y po-campo (definidas globalmente).

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

// Constantes de diseño
const NODE_WIDTH = 225;
const NODE_HEIGHT = 68;
const ROOT_Y = 0;
const MAIN_Y = 140;
const CHILD_GAP_Y = 92;
const DEPTH_INDENT_X = 180;
const HORIZONTAL_MARGIN = 80;

// Colores por nivel
const COLOR_RAIZ = '#1f3b57';
const COLOR_NIVEL1 = '#35627f';
const COLOR_NIVEL2 = '#4d7c73';
const COLOR_NIVEL3 = '#6b8f71';

// Colores de estado y avance (tema claro)
const COLOR_AVANCE = '#1B7A4B';
const COLOR_ESTADO_PENDIENTE = '#888888';
const COLOR_ESTADO_EN_CURSO = '#1F4FD1';
const COLOR_ESTADO_HECHA = '#1B7A4B';
const COLOR_ESTADO_BLOQUEADA = '#BA2F27';

export function crearVista(contenedor, { alSeleccionar }) {
  // Estado interno de la vista
  let modeloActual = null;
  let seleccionId = null;
  let expandidos = new Set(); // IDs de nodos expandidos (excepto la raíz siempre visible)
  let terminoBusqueda = '';
  let transformacion = d3.zoomIdentity;
  let jerarquiaRaiz = null; // d3.hierarchy actual
  let nodosVisibles = []; // para exportar (coordenadas)

  // Construir DOM de la vista
  contenedor.classList.add('po-edt-contenedor');
  contenedor.innerHTML = `
    <div class="po-edt-barra">
      <button class="po-boton" data-accion="desplegar-todo">Desplegar todo</button>
      <button class="po-boton" data-accion="plegar-nivel1">Plegar a nivel 1</button>
      <button class="po-boton" data-accion="centrar">Centrar</button>
      <input type="text" class="po-campo" placeholder="Buscar código o nombre" data-accion="buscar">
      <button class="po-boton" data-accion="exportar">Exportar imagen</button>
    </div>
    <div class="po-edt-lienzo"></div>
  `;

  const barra = contenedor.querySelector('.po-edt-barra');
  const lienzo = contenedor.querySelector('.po-edt-lienzo');

  // Crear SVG
  const svg = d3.select(lienzo)
    .append('svg')
    .attr('width', lienzo.clientWidth)
    .attr('height', lienzo.clientHeight)
    .style('display', 'block');

  // Fondo para deseleccionar
  svg.append('rect')
    .attr('class', 'po-edt-fondo')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('fill', 'transparent')
    .style('pointer-events', 'all')
    .on('click', () => alSeleccionar(null));

  // Grupo principal que se transforma con el zoom
  const g = svg.append('g');
  const linksGroup = g.append('g').attr('class', 'po-edt-links');
  const nodesGroup = g.append('g').attr('class', 'po-edt-nodes');

  // Configurar zoom
  const zoom = d3.zoom()
    .scaleExtent([0.2, 2.5])
    .on('zoom', (event) => {
      transformacion = event.transform;
      g.attr('transform', transformacion);
    });
  svg.call(zoom).on('dblclick.zoom', null); // desactivar doble clic de zoom

  // Observer para resize
  const observer = new ResizeObserver(() => {
    svg.attr('width', lienzo.clientWidth)
       .attr('height', lienzo.clientHeight);
  });
  observer.observe(lienzo);

  // ----- Funciones internas -----

  // Construir jerarquía D3 aplicando estado de expansión
  function construirJerarquia(modelo) {
    // Inicializar expandidos la primera vez: desplegar nivel 1 (raíz siempre expandida)
    if (expandidos.size === 0) {
      modelo.raiz.hijos.forEach(h => expandidos.add(h.id));
    }
    // Desplegar ancestros si la selección está en una rama plegada
    if (seleccionId && modelo.porId.has(seleccionId)) {
      let nodo = modelo.porId.get(seleccionId);
      while (nodo.padre) {
        expandidos.add(nodo.padre);
        nodo = modelo.porId.get(nodo.padre);
      }
    }

    // Crear jerarquía
    const raizD3 = d3.hierarchy(modelo.raiz, d => d.hijos);

    // Función para plegar/desplegar según el set
    const aplicarExpansion = (nodo) => {
      const expandido = nodo.depth === 0 || expandidos.has(nodo.data.id);
      if (nodo.children) {
        if (!expandido) {
          nodo._children = nodo.children;
          nodo.children = null;
        }
      }
      // Recurrir sobre hijos visibles u ocultos
      if (nodo.children) nodo.children.forEach(aplicarExpansion);
      else if (nodo._children) nodo._children.forEach(aplicarExpansion);
    };
    aplicarExpansion(raizD3);
    return raizD3;
  }

  // Layout de columnas: raíz arriba, ramas nivel1 en fila, descendientes apilados
  function calcularLayout(raizD3) {
    raizD3.x = 0;
    raizD3.y = ROOT_Y;

    const nodosNivel1 = raizD3.children || [];
    if (nodosNivel1.length === 0) return;

    // Profundidad máxima de cada rama (solo hijos visibles)
    function maxProfundidad(nodo) {
      if (!nodo.children || nodo.children.length === 0) return 0;
      let max = 0;
      for (const hijo of nodo.children) {
        max = Math.max(max, maxProfundidad(hijo) + 1);
      }
      return max;
    }

    const anchosRamas = nodosNivel1.map(rama => maxProfundidad(rama) * DEPTH_INDENT_X + NODE_WIDTH);
    let currentX = 0;
    const posicionesRamas = [];
    for (let i = 0; i < nodosNivel1.length; i++) {
      posicionesRamas.push(currentX);
      currentX += anchosRamas[i] + HORIZONTAL_MARGIN;
    }
    const totalWidth = currentX - HORIZONTAL_MARGIN;
    const offsetX = -totalWidth / 2;

    // Posicionar cada rama de nivel 1
    for (let i = 0; i < nodosNivel1.length; i++) {
      const rama = nodosNivel1[i];
      rama.x = offsetX + posicionesRamas[i] + anchosRamas[i] / 2;
      rama.y = MAIN_Y;
      const baseX = rama.x - anchosRamas[i] / 2 + NODE_WIDTH / 2;
      let startY = rama.y + CHILD_GAP_Y;
      posicionarSubarbol(rama, baseX, startY, 1);
    }
  }

  // Posiciona recursivamente hijos de un nodo
  function posicionarSubarbol(nodo, baseX, currentY, depth) {
    const hijos = nodo.children || [];
    for (const hijo of hijos) {
      hijo.x = baseX + depth * DEPTH_INDENT_X;
      hijo.y = currentY;
      currentY += CHILD_GAP_Y;
      if (hijo.children && hijo.children.length > 0) {
        currentY = posicionarSubarbol(hijo, baseX, currentY, depth + 1);
      }
    }
    return currentY;
  }

  // Genera el path para un enlace
  function connectorPath(d) {
    const source = d.source;
    const target = d.target;
    const sourceBottom = source.y + NODE_HEIGHT / 2;
    const targetCenterY = target.y;
    const targetLeftX = target.x - NODE_WIDTH / 2;

    if (target.depth >= 2) {
      return `M${source.x},${sourceBottom} V${targetCenterY} H${targetLeftX}`;
    }
    const midY = (source.y + target.y) / 2;
    return `M${source.x},${source.y} V${midY} H${target.x} V${target.y}`;
  }

  // Envuelve texto en tspans con límite de líneas, centrando dentro de un área vertical.
  // Ajusta el tamaño de fuente a 12px si el bloque no cabe en el área.
  function wrapText(selection, texto, maxWidth, maxLines, yInicio, yFin) {
    const lineHeight = 15;
    const words = texto.split(/\s+/);
    const lines = [];
    let line = [];
    for (const word of words) {
      const test = [...line, word].join(' ');
      if (test.length * 7 > maxWidth && line.length > 0) {
        lines.push(line.join(' '));
        line = [word];
      } else {
        line.push(word);
      }
    }
    if (line.length) lines.push(line.join(' '));

    let displayLines = lines.slice(0, maxLines);
    if (lines.length > maxLines) {
      displayLines[maxLines - 1] = displayLines[maxLines - 1].slice(0, -1) + '…';
    }

    // Determinar tamaño de fuente: 13px por defecto, 12px si no cabe en el área
    let fontSize = 13;
    const areaHeight = yFin - yInicio;
    const requiredHeight = (displayLines.length - 1) * lineHeight + fontSize;
    if (requiredHeight > areaHeight) {
      fontSize = 12;
    }

    selection.attr('font-size', fontSize);

    selection.selectAll('tspan').remove();

    // Centrar verticalmente el bloque de líneas base dentro del área
    const centroArea = (yInicio + yFin) / 2;
    const startY = centroArea - (displayLines.length - 1) * lineHeight / 2 + 4.5; // ajuste línea base

    displayLines.forEach((lineText, i) => {
      selection.append('tspan')
        .attr('x', 0)
        .attr('y', startY + i * lineHeight)
        .text(lineText);
    });
  }

  function colorPorNivel(depth) {
    if (depth === 0) return COLOR_RAIZ;
    if (depth === 1) return COLOR_NIVEL1;
    if (depth === 2) return COLOR_NIVEL2;
    return COLOR_NIVEL3;
  }

  function colorEstado(estado) {
    switch (estado) {
      case 'pendiente': return COLOR_ESTADO_PENDIENTE;
      case 'en curso': return COLOR_ESTADO_EN_CURSO;
      case 'hecha': return COLOR_ESTADO_HECHA;
      case 'bloqueada': return COLOR_ESTADO_BLOQUEADA;
      default: return COLOR_ESTADO_PENDIENTE;
    }
  }

  // Dibuja el contenido interno de un nodo (rect, código, nombre, estado, avance)
  // Se llama en cada actualización para reutilizar nodos correctamente.
  function dibujarContenidoNodo(grupo, d) {
    grupo.selectAll('*').remove();

    const color = colorPorNivel(d.depth);

    // Rect principal
    grupo.append('rect')
      .attr('x', -NODE_WIDTH / 2)
      .attr('y', -NODE_HEIGHT / 2)
      .attr('width', NODE_WIDTH)
      .attr('height', NODE_HEIGHT)
      .attr('rx', 6)
      .attr('ry', 6)
      .attr('fill', color)
      .attr('stroke', 'rgba(255,255,255,0.2)')
      .attr('stroke-width', 1);

    // Franja de avance
    const avanceWidth = NODE_WIDTH * (d.data.avance || 0);
    grupo.append('rect')
      .attr('class', 'po-edt-avance')
      .attr('x', -NODE_WIDTH / 2)
      .attr('y', NODE_HEIGHT / 2 - 4)
      .attr('width', avanceWidth)
      .attr('height', 4)
      .attr('fill', COLOR_AVANCE)
      .attr('rx', 2);

    // Código (si no es raíz), línea base en y = -NODE_HEIGHT/2 + 15
    if (d.depth > 0) {
      const esEnt = d.data.esHoja && d.data.datos && d.data.datos.tipo === 'entregable';
      grupo.append('text')
        .attr('class', 'po-edt-codigo')
        .attr('x', 0)
        .attr('y', -NODE_HEIGHT / 2 + 15)
        .attr('text-anchor', 'middle')
        .attr('fill', esEnt ? '#fde68a' : 'rgba(255,255,255,0.8)')
        .attr('font-family', '"IBM Plex Mono", monospace')
        .attr('font-size', 11)
        .text(esEnt ? `📦 ${d.data.codigo} · Entregable` : d.data.codigo);
    }

    // Nombre: área debajo del código (o todo el nodo para la raíz)
    const yInicioNombre = d.depth > 0 ? -NODE_HEIGHT / 2 + 22 : -NODE_HEIGHT / 2 + 6;
    const yFinNombre = NODE_HEIGHT / 2 - 6;
    const textEl = grupo.append('text')
      .attr('class', 'po-edt-nombre')
      .attr('x', 0)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fff')
      .attr('font-family', '"Archivo", sans-serif')
      .attr('font-weight', 600);
    wrapText(textEl, d.data.nombre, NODE_WIDTH - 20, 3, yInicioNombre, yFinNombre);

    // Punto de estado para hojas
    if (d.data.esHoja && d.data.estado) {
      grupo.append('circle')
        .attr('class', 'po-edt-estado')
        .attr('cx', NODE_WIDTH / 2 - 12)
        .attr('cy', -NODE_HEIGHT / 2 + 12)
        .attr('r', 5)
        .attr('fill', colorEstado(d.data.estado))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);
    }

    // Botón visible (+/−) para nodos con hijos (celular / táctil y escritorio)
    const tieneHijos = d.depth > 0 && (
      (d.children && d.children.length > 0) ||
      (d._children && d._children.length > 0)
    );
    if (tieneHijos) {
      const estaExpandido = Boolean(d.children && d.children.length > 0);
      const bx = NODE_WIDTH / 2 - 15;
      const by = -NODE_HEIGHT / 2 + 15;
      const btnPlegar = grupo.append('g')
        .attr('class', 'po-edt-plegar')
        .attr('data-accion', 'plegar-nodo')
        .attr('data-id', d.data.id)
        .attr('transform', `translate(${bx},${by})`)
        .style('cursor', 'pointer')
        .on('click', (event) => {
          event.stopPropagation();
          alternarNodo(d);
        })
        .on('dblclick', (event) => {
          event.stopPropagation();
        });

      // Zona táctil amplia e icono circular
      btnPlegar.append('rect')
        .attr('x', -14)
        .attr('y', -14)
        .attr('width', 28)
        .attr('height', 28)
        .attr('fill', 'transparent');

      btnPlegar.append('circle')
        .attr('r', 10)
        .attr('fill', 'rgba(15, 22, 29, 0.35)')
        .attr('stroke', 'rgba(255, 255, 255, 0.85)')
        .attr('stroke-width', 1.2);

      btnPlegar.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('fill', '#fff')
        .attr('font-family', '"IBM Plex Mono", monospace')
        .attr('font-size', 14)
        .attr('font-weight', 700)
        .text(estaExpandido ? '−' : '+');
    }
  }

  // Pliega o despliega un nodo con hijos
  function alternarNodo(d) {
    if (d.depth === 0) return; // la raíz no se pliega
    if (d.children) {
      d._children = d.children;
      d.children = null;
      expandidos.delete(d.data.id);
    } else if (d._children) {
      d.children = d._children;
      d._children = null;
      expandidos.add(d.data.id);
    }
    dibujar();
  }

  // Dibuja enlaces y nodos según la jerarquía actual
  function dibujar() {
    if (!jerarquiaRaiz) return;

    calcularLayout(jerarquiaRaiz);

    // Guardar coordenadas de nodos visibles para exportación
    nodosVisibles = jerarquiaRaiz.descendants().map(d => ({
      id: d.data.id,
      x: d.x,
      y: d.y,
      depth: d.depth,
      esHoja: d.data.esHoja,
      nombre: d.data.nombre,
      codigo: d.data.codigo,
      avance: d.data.avance,
      estado: d.data.estado,
      color: colorPorNivel(d.depth)
    }));

    // ----- Enlaces -----
    const enlaces = jerarquiaRaiz.links();
    const linkSelection = linksGroup.selectAll('path')
      .data(enlaces, d => d.target.data.id);

    linkSelection.enter()
      .append('path')
      .attr('class', 'po-edt-link')
      .attr('fill', 'none')
      .attr('stroke', '#95A3B0')
      .attr('stroke-width', 1.5)
      .attr('d', connectorPath);

    linkSelection.attr('d', connectorPath);
    linkSelection.exit().remove();

    // ----- Nodos -----
    const nodesSelection = nodesGroup.selectAll('g.po-edt-nodo')
      .data(jerarquiaRaiz.descendants(), d => d.data.id || 'raiz');

    const nodeEnter = nodesSelection.enter()
      .append('g')
      .attr('class', 'po-edt-nodo')
      .on('click', (event, d) => {
        event.stopPropagation();
        const id = d.depth === 0 ? null : d.data.id;
        seleccionId = id;
        alSeleccionar(id);
        aplicarEstilos();
      })
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        alternarNodo(d);
      });

    // Actualizar transformación y contenido de todos los nodos (enter + update)
    nodeEnter.merge(nodesSelection)
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .each(function(d) {
        dibujarContenidoNodo(d3.select(this), d);
      });

    // Eliminar nodos salientes
    nodesSelection.exit().remove();

    // Aplicar estilos de selección y búsqueda
    aplicarEstilos();
  }

  // Aplica estilos de borde según selección y término de búsqueda
  function aplicarEstilos() {
    nodesGroup.selectAll('g.po-edt-nodo').each(function(d) {
      const esSeleccionado = (d.depth === 0 && seleccionId === null) ||
                             (d.depth > 0 && seleccionId === d.data.id);
      const coincide = terminoBusqueda &&
        (d.data.nombre.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
         (d.data.codigo && d.data.codigo.toLowerCase().includes(terminoBusqueda.toLowerCase())));

      const rect = d3.select(this).select('rect');
      if (coincide) {
        rect.attr('stroke', '#FFA500').attr('stroke-width', 3);
      } else if (esSeleccionado) {
        rect.attr('stroke', '#1F4FD1').attr('stroke-width', 3);
      } else {
        rect.attr('stroke', 'rgba(255,255,255,0.2)').attr('stroke-width', 1);
      }
    });
  }

  // Centrar toda la vista
  function centrarVista() {
    if (!jerarquiaRaiz) return;
    const nodos = jerarquiaRaiz.descendants();
    if (nodos.length === 0) return;

    const minX = d3.min(nodos, d => d.x - NODE_WIDTH / 2);
    const maxX = d3.max(nodos, d => d.x + NODE_WIDTH / 2);
    const minY = d3.min(nodos, d => d.y - NODE_HEIGHT / 2);
    const maxY = d3.max(nodos, d => d.y + NODE_HEIGHT / 2);

    const widthTotal = maxX - minX;
    const heightTotal = maxY - minY;
    const anchoCont = lienzo.clientWidth;
    const altoCont = lienzo.clientHeight;

    // Ajusta a la vista, pero sin bajar de 0.65 para que el texto siga legible
    // (si no cabe, se navega con zoom y arrastre). El árbol se alinea arriba.
    const escala = Math.min(1, Math.max(0.65,
      Math.min(anchoCont / (widthTotal + 160), altoCont / (heightTotal + 160))
    ));
    const tx = anchoCont / 2 - (minX + maxX) / 2 * escala;
    const ty = 40 - minY * escala;

    transformacion = d3.zoomIdentity.translate(tx, ty).scale(escala);
    svg.transition().duration(500).call(zoom.transform, transformacion);
  }

  // Centrar en un nodo específico
  function centrarEnNodo(id) {
    if (!jerarquiaRaiz) return;
    const nodo = jerarquiaRaiz.descendants().find(d => d.data.id === id);
    if (!nodo) return;

    const escala = Math.max(0.5, Math.min(1.5, transformacion.k || 1));
    const tx = lienzo.clientWidth / 2 - nodo.x * escala;
    const ty = lienzo.clientHeight / 2 - nodo.y * escala;

    transformacion = d3.zoomIdentity.translate(tx, ty).scale(escala);
    svg.transition().duration(500).call(zoom.transform, transformacion);
  }

  // Expandir todos los nodos
  function expandirTodo() {
    if (!modeloActual) return;
    modeloActual.lista.forEach(n => expandidos.add(n.id));
    jerarquiaRaiz = construirJerarquia(modeloActual);
    dibujar();
  }

  // Plegar todos excepto nivel 1
  function plegarANivel1() {
    if (!modeloActual) return;
    expandidos.clear();
    modeloActual.raiz.hijos.forEach(h => expandidos.add(h.id));
    jerarquiaRaiz = construirJerarquia(modeloActual);
    dibujar();
  }

  // Buscar y centrar en la primera coincidencia
  function buscar(texto) {
    if (!modeloActual || !texto) return;
    const lower = texto.toLowerCase();
    let encontrado = null;
    for (const nodo of modeloActual.lista) {
      if (nodo.nombre.toLowerCase().includes(lower) ||
          (nodo.codigo && nodo.codigo.toLowerCase().includes(lower))) {
        encontrado = nodo;
        break;
      }
    }
    if (!encontrado) return;

    // Desplegar ancestros
    let current = encontrado;
    while (current.padre) {
      expandidos.add(current.padre);
      current = modeloActual.porId.get(current.padre);
    }

    seleccionId = encontrado.id;
    alSeleccionar(seleccionId);
    jerarquiaRaiz = construirJerarquia(modeloActual);
    dibujar();
    centrarEnNodo(encontrado.id);
  }

  // Exportar PNG del árbol actual (desplegado como está)
  async function exportarPNG() {
    if (!jerarquiaRaiz || !modeloActual) return;
    const nodos = jerarquiaRaiz.descendants();
    if (nodos.length === 0) return;

    const minX = d3.min(nodos, d => d.x - NODE_WIDTH / 2);
    const maxX = d3.max(nodos, d => d.x + NODE_WIDTH / 2);
    const minY = d3.min(nodos, d => d.y - NODE_HEIGHT / 2);
    const maxY = d3.max(nodos, d => d.y + NODE_HEIGHT / 2);
    const margen = 60;
    const espacioTitulo = 80;
    const width = maxX - minX + margen * 2;
    const height = maxY - minY + margen * 2 + espacioTitulo;

    // Clonar SVG y preparar para exportación
    const svgClone = svg.node().cloneNode(true);
    // Limpiar transformación del grupo principal (primer g)
    const grupos = svgClone.querySelectorAll('g');
    if (grupos.length > 0) grupos[0].setAttribute('transform', '');
    // Remover fondo transparente
    const fondo = svgClone.querySelector('.po-edt-fondo');
    if (fondo) fondo.remove();

    // Añadir título
    const NS = 'http://www.w3.org/2000/svg';
    const titulo = document.createElementNS(NS, 'text');
    titulo.setAttribute('x', '0');
    titulo.setAttribute('y', (minY - margen - 30).toString());
    titulo.setAttribute('text-anchor', 'middle');
    titulo.setAttribute('font-family', 'Archivo, sans-serif');
    titulo.setAttribute('font-size', '24');
    titulo.setAttribute('font-weight', 'bold');
    titulo.setAttribute('fill', '#15202B');
    titulo.textContent = modeloActual.proyecto.nombre;
    svgClone.appendChild(titulo);

    // Establecer viewBox y dimensiones para 2x
    svgClone.setAttribute('width', width * 2);
    svgClone.setAttribute('height', height * 2);
    svgClone.setAttribute('viewBox', `${minX - margen} ${minY - margen - espacioTitulo} ${width} ${height}`);

    // Serializar a imagen
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgClone);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      link.download = 'edt.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      alert('No se pudo exportar la imagen.');
    };
    img.src = url;
  }

  // ----- Eventos de la barra -----
  barra.querySelector('[data-accion="desplegar-todo"]').addEventListener('click', expandirTodo);
  barra.querySelector('[data-accion="plegar-nivel1"]').addEventListener('click', plegarANivel1);
  barra.querySelector('[data-accion="centrar"]').addEventListener('click', centrarVista);
  barra.querySelector('[data-accion="exportar"]').addEventListener('click', exportarPNG);

  const inputBuscar = barra.querySelector('[data-accion="buscar"]');
  inputBuscar.addEventListener('input', (e) => {
    terminoBusqueda = e.target.value.trim();
    if (modeloActual) aplicarEstilos();
  });
  inputBuscar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') buscar(terminoBusqueda);
  });

  // ----- API pública -----
  function mostrar(modelo, idSeleccion) {
    modeloActual = modelo;
    seleccionId = idSeleccion;
    jerarquiaRaiz = construirJerarquia(modelo);
    dibujar();

    if (transformacion === d3.zoomIdentity) {
      centrarVista();
    } else {
      g.attr('transform', transformacion);
    }
  }

  function destruir() {
    observer.disconnect();
    svg.on('.zoom', null);
    contenedor.innerHTML = '';
  }

  return { mostrar, destruir };
}
