const container = document.getElementById("tree-container");
const detailsEl = document.getElementById("nodeDetails");
const totalNodesEl = document.getElementById("totalNodes");
const treeDepthEl = document.getElementById("treeDepth");
const breadcrumbEl = document.getElementById("breadcrumb");
const searchInput = document.getElementById("searchInput");
const searchStatus = document.getElementById("searchStatus");

let width = container.clientWidth;
let height = container.clientHeight;

const svg = d3
  .select("#tree-container")
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g");
const linksGroup = g.append("g").attr("class", "links");
const nodesGroup = g.append("g").attr("class", "nodes");

const zoom = d3
  .zoom()
  .scaleExtent([0.2, 2.2])
  .on("zoom", (event) => {
    g.attr("transform", event.transform);
  });

svg.call(zoom);

let root;
let selectedNode = null;

// ========== CONSTANTES AJUSTADAS PARA TEXTO COMPLETO ==========
const NODE_WIDTH = 225;          // antes 170 → más ancho para texto
const NODE_HEIGHT = 68;          // se mantiene
const ROOT_Y = 0;
const MAIN_Y = 150;
const MAIN_GAP_X = 310;          // ya no se usa fijo, pero se deja por compatibilidad
const CHILD_GAP_Y = 92;
const DEPTH_INDENT_X = 180;      // antes 120 → más separación horizontal entre niveles
const HORIZONTAL_MARGIN = 80;    // mismo margen entre ramas
// ==============================================================

loadTree();

async function loadTree() {
  try {
    const response = await fetch("./data.json");
    if (!response.ok) {
      throw new Error(`No se pudo cargar data.json (${response.status})`);
    }

    const data = await response.json();
    initializeTree(data);
  } catch (error) {
    console.error(error);
    detailsEl.classList.remove("empty");
    detailsEl.innerHTML = `
      <h3>Error al cargar datos</h3>
      <p>${error.message}</p>
      <p>Verifica que el archivo <strong>data.json</strong> exista y que estés sirviendo esta carpeta desde un servidor local.</p>
    `;
  }
}

function initializeTree(data) {
  root = d3.hierarchy(data);
  root.x0 = 0;
  root.y0 = 0;

  if (root.children) {
    root.children.forEach(collapseFromDepthOne);
  }

  updateStats(root);
  update(root);
  centerTree();
}

function collapseFromDepthOne(node) {
  if (node.depth >= 1 && node.children) {
    node._children = node.children;
    node._children.forEach(collapseAll);
    node.children = null;
  }
}

function collapseAll(node) {
  if (node.children) {
    node._children = node.children;
    node._children.forEach(collapseAll);
    node.children = null;
  }
}

function expandAll(node) {
  if (node._children) {
    node.children = node._children;
    node._children = null;
  }
  if (node.children) {
    node.children.forEach(expandAll);
  }
}

// ========== NUEVAS FUNCIONALIDADES ==========
function expandBranch(node) {
  if (!node) return;
  expandAll(node);
  update(node);
  selectNode(node);
  centerOnNode(node);
}

function collapseBranch(node) {
  if (!node) return;
  collapseAll(node);
  update(node);
  selectNode(node);
  centerOnNode(node);
}

function centerOnNode(node) {
  setTimeout(() => {
    const scale = 0.8;
    const tx = width / 2 - node.x * scale;
    const ty = height / 2 - node.y * scale;
    svg.transition().duration(500)
      .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }, 100);
}

function searchNode(text) {
  if (!root || !text.trim()) return;
  const lowerText = text.toLowerCase();
  let found = null;
  function searchRecursive(node) {
    if (node.data.name.toLowerCase().includes(lowerText)) {
      found = node;
      return true;
    }
    if (node.children) {
      for (let child of node.children) if (searchRecursive(child)) return true;
    } else if (node._children) {
      for (let child of node._children) if (searchRecursive(child)) return true;
    }
    return false;
  }
  searchRecursive(root);
  if (found) {
    let ancestor = found;
    while (ancestor) {
      if (ancestor._children && !ancestor.children) {
        ancestor.children = ancestor._children;
        ancestor._children = null;
      }
      ancestor = ancestor.parent;
    }
    update(found);
    selectNode(found);
    centerOnNode(found);
    searchStatus.innerHTML = `Encontrado: "${found.data.name}"`;
  } else {
    searchStatus.innerHTML = `No se encontró "${text}"`;
  }
}
// =========================================

function update(source) {
  width = container.clientWidth;
  height = container.clientHeight;
  svg.attr("width", width).attr("height", height);

  layoutColumnsDynamic();   // layout con espaciado horizontal dinámico

  const nodes = root.descendants();
  const links = root.links();

  const nodeSelection = nodesGroup
    .selectAll("g.node")
    .data(nodes, (d) => d.id || (d.id = crypto.randomUUID()));

  const nodeEnter = nodeSelection
    .enter()
    .append("g")
    .attr("class", "node")
    .attr("transform", `translate(${source.x0},${source.y0})`)
    .on("click", (_, d) => selectNode(d))
    .on("dblclick", (_, d) => {
      toggleNode(d);
    });

  nodeEnter
    .append("rect")
    .attr("x", -NODE_WIDTH / 2)
    .attr("y", -NODE_HEIGHT / 2)
    .attr("width", NODE_WIDTH)
    .attr("height", NODE_HEIGHT)
    .attr("fill", (d) => colorByDepth(d.depth));

  nodeEnter
    .append("text")
    .attr("dy", 1)
    .each(function (d) {
      wrapText(d3.select(this), d.data.name, NODE_WIDTH - 28);
    });

  const nodeMerge = nodeEnter.merge(nodeSelection);

  nodeMerge
    .transition()
    .duration(400)
    .attr("transform", (d) => `translate(${d.x},${d.y})`)
    .attr("class", (d) => `node${selectedNode && selectedNode.id === d.id ? " selected" : ""}`);

  nodeSelection
    .exit()
    .transition()
    .duration(300)
    .attr("transform", `translate(${source.x},${source.y})`)
    .remove();

  const linkSelection = linksGroup
    .selectAll("path.link")
    .data(links, (d) => d.target.id);

  linkSelection
    .enter()
    .append("path")
    .attr("class", "link")
    .attr("d", () => {
      const o = { x: source.x0, y: source.y0, depth: source.depth || 0 };
      return branchConnector({ source: o, target: o });
    })
    .merge(linkSelection)
    .transition()
    .duration(400)
    .attr("d", branchConnector);

  linkSelection
    .exit()
    .transition()
    .duration(300)
    .attr("d", () => {
      const o = { x: source.x, y: source.y, depth: source.depth || 0 };
      return branchConnector({ source: o, target: o });
    })
    .remove();

  nodes.forEach((d) => {
    d.x0 = d.x;
    d.y0 = d.y;
  });

  updateStats(root);
}

// ========== LAYOUT CON ESPACIADO HORIZONTAL DINÁMICO ==========
function layoutColumnsDynamic() {
  root.x = 0;
  root.y = ROOT_Y;

  const mainNodes = root.children || [];
  if (mainNodes.length === 0) return;

  // Calcular la profundidad máxima (número de niveles) de cada rama principal
  function getMaxDepth(node) {
    if (!node.children || node.children.length === 0) return 0;
    let maxChildDepth = 0;
    for (let child of node.children) {
      maxChildDepth = Math.max(maxChildDepth, getMaxDepth(child) + 1);
    }
    return maxChildDepth;
  }

  // Calcular el ancho total que ocupará cada rama en horizontal (en píxeles)
  // = profundidad_max * DEPTH_INDENT_X + NODE_WIDTH
  const branchWidths = mainNodes.map(branch => {
    const depth = getMaxDepth(branch);
    return depth * DEPTH_INDENT_X + NODE_WIDTH;
  });

  // Posicionar ramas horizontalmente una tras otra, con un margen extra
  let currentX = 0;
  const branchPositionsX = [];
  for (let i = 0; i < mainNodes.length; i++) {
    branchPositionsX.push(currentX);
    currentX += branchWidths[i] + HORIZONTAL_MARGIN;
  }

  // Centrar todo el conjunto horizontalmente
  const totalWidth = currentX - HORIZONTAL_MARGIN;
  const offsetX = -totalWidth / 2;

  // Posicionar cada rama principal (todas a la misma Y = MAIN_Y)
  for (let i = 0; i < mainNodes.length; i++) {
    const branch = mainNodes[i];
    branch.x = offsetX + branchPositionsX[i] + (branchWidths[i] / 2);
    branch.y = MAIN_Y;

    // Posicionar descendientes de esta rama (uso de layoutBranch original)
    const startY = branch.y + CHILD_GAP_Y;
    layoutBranch(branch, branch.x - (branchWidths[i] / 2) + NODE_WIDTH / 2, startY, 1);
  }
}
// ============================================================================

function layoutBranch(node, baseX, currentY, depth) {
  const children = node.children || [];

  children.forEach((child) => {
    child.x = baseX + depth * DEPTH_INDENT_X;
    child.y = currentY;
    currentY += CHILD_GAP_Y;

    if (child.children && child.children.length > 0) {
      currentY = layoutBranch(child, baseX, currentY, depth + 1);
    }
  });

  return currentY;
}

function branchConnector(d) {
  const sourceBottom = d.source.y + NODE_HEIGHT / 2;
  const targetCenterY = d.target.y;
  const targetLeftX = d.target.x - NODE_WIDTH / 2;

  if ((d.target.depth || 0) >= 2) {
    return `M${d.source.x},${sourceBottom}
            V${targetCenterY}
            H${targetLeftX}`;
  }

  const midY = (d.source.y + d.target.y) / 2;
  return `M${d.source.x},${d.source.y}
          V${midY}
          H${d.target.x}
          V${d.target.y}`;
}

function toggleNode(node) {
  if (node.children) {
    node._children = node.children;
    node.children = null;
  } else {
    node.children = node._children;
    node._children = null;
  }

  update(node);
  selectNode(node);
}

function selectNode(node) {
  selectedNode = node;
  nodesGroup
    .selectAll("g.node")
    .attr("class", (d) => `node${d.id === node.id ? " selected" : ""}`);

  const visibleChildren = node.children ? node.children.length : 0;
  const hiddenChildren = node._children ? node._children.length : 0;
  const totalChildren = visibleChildren + hiddenChildren;

  detailsEl.classList.remove("empty");
  detailsEl.innerHTML = `
    <h3>${node.data.name}</h3>
    <p><span class="badge">Nivel ${node.depth}</span></p>
    <p><strong>Tipo:</strong> ${node.depth === 0 ? "Objetivo principal" : `Elemento jerárquico ${node.depth}`}</p>
    <p><strong>Padre:</strong> ${node.parent ? node.parent.data.name : "Sin padre"}</p>
    <p><strong>Hijos:</strong> ${totalChildren}</p>
    <p><strong>Estado:</strong> ${hiddenChildren > 0 ? "Colapsado" : "Expandido o sin hijos"}</p>
  `;

  // Breadcrumb
  const ancestors = node.ancestors().reverse();
  const breadcrumbPath = ancestors.map(n => n.data.name).join(" → ");
  breadcrumbEl.innerHTML = `<strong>Ruta:</strong> ${breadcrumbPath}`;
}

function updateStats(rootNode) {
  totalNodesEl.textContent = rootNode.descendants().length;
  treeDepthEl.textContent = rootNode.height;
}

function centerTree(scale = 0.95) {
  const nodes = root.descendants();
  const minX = d3.min(nodes, (d) => d.x);
  const maxX = d3.max(nodes, (d) => d.x);
  const minY = d3.min(nodes, (d) => d.y);
  const maxY = d3.max(nodes, (d) => d.y);

  const contentWidth = maxX - minX + NODE_WIDTH + 180;
  const contentHeight = maxY - minY + NODE_HEIGHT + 180;

  const boundedScale = Math.min(
    1,
    Math.max(0.22, Math.min(width / contentWidth, height / contentHeight) * scale)
  );

  const translateX = (width - contentWidth * boundedScale) / 2 - minX * boundedScale + NODE_WIDTH / 2;
  const translateY = 40 - minY * boundedScale;

  svg
    .transition()
    .duration(600)
    .call(zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(boundedScale));
}

function colorByDepth(depth) {
  if (depth === 0) return "#1f3b57";
  if (depth === 1) return "#35627f";
  if (depth === 2) return "#4d7c73";
  if (depth === 3) return "#6d8f8b";
  return "#8fa7a3";
}

// ========== WRAP TEXT MEJORADO: permite hasta 8 líneas ==========
function wrapText(textSelection, textValue, widthLimit) {
  const words = textValue.split(/\s+/);
  const lines = [];
  let line = [];

  words.forEach((word) => {
    const testLine = [...line, word].join(" ");
    const estimatedWidth = testLine.length * 7;

    if (estimatedWidth > widthLimit && line.length > 0) {
      lines.push(line.join(" "));
      line = [word];
    } else {
      line.push(word);
    }
  });

  if (line.length) lines.push(line.join(" "));

  // Mostrar hasta 8 líneas (antes 3) para cubrir textos muy largos
  const visibleLines = lines.slice(0, 8);
  const startY = -((visibleLines.length - 1) * 9);

  visibleLines.forEach((lineText, index) => {
    textSelection
      .append("tspan")
      .attr("x", 0)
      .attr("y", startY + index * 18)
      .text(lineText);
  });
}
// ================================================================

// ========== EVENTOS ==========
document.getElementById("centerView").addEventListener("click", () => {
  if (root) centerTree();
});

document.getElementById("expandAll").addEventListener("click", () => {
  if (!root) return;
  expandAll(root);
  update(root);
  centerTree(0.9);
});

document.getElementById("collapseAll").addEventListener("click", () => {
  if (!root) return;
  if (root.children) {
    root.children.forEach(collapseFromDepthOne);
  }
  update(root);
  centerTree();
});

document.getElementById("expandBranch").addEventListener("click", () => {
  if (selectedNode) expandBranch(selectedNode);
  else alert("Selecciona un nodo primero.");
});

document.getElementById("collapseBranch").addEventListener("click", () => {
  if (selectedNode) collapseBranch(selectedNode);
  else alert("Selecciona un nodo primero.");
});

document.getElementById("exportPNG").addEventListener("click", async () => {
  const canvas = await html2canvas(document.querySelector(".workspace"), {
    backgroundColor: "#eef3f9",
    scale: 2
  });
  const link = document.createElement("a");
  link.download = "edt.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

document.getElementById("exportPDF").addEventListener("click", async () => {
  const canvas = await html2canvas(document.querySelector(".workspace"), {
    backgroundColor: "#eef3f9",
    scale: 2
  });

  const imgData = canvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [canvas.width, canvas.height]
  });

  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save("edt.pdf");
});

searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") searchNode(e.target.value);
});

window.addEventListener("resize", () => {
  width = container.clientWidth;
  height = container.clientHeight;
  svg.attr("width", width).attr("height", height);
  if (root) {
    update(root);
    centerTree(0.92);
  }
});