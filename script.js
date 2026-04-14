const stateInput = document.getElementById('states');
const alphabetInput = document.getElementById('alphabet');
const startInput = document.getElementById('startState');
const acceptInput = document.getElementById('acceptStates');
const transitionRows = document.getElementById('transitionRows');
const addTransition = document.getElementById('addTransition');
const generateBtn = document.getElementById('generateBtn');
const resetBtn = document.getElementById('resetBtn');
const messageBox = document.getElementById('message');
const stepsList = document.getElementById('stepsList');
const currentStep = document.getElementById('currentStep');
const totalSteps = document.getElementById('totalSteps');
const stepDescription = document.getElementById('stepDescription');
const prevStep = document.getElementById('prevStep');
const nextStep = document.getElementById('nextStep');
const prevStepGraph = document.getElementById('prevStepGraph');
const nextStepGraph = document.getElementById('nextStepGraph');
const nfaTable = document.getElementById('nfaTable');
const dfaTable = document.getElementById('dfaTable');
const nfaGraph = document.getElementById('nfaGraph');
const dfaGraph = document.getElementById('dfaGraph');

const exampleTransitions = [
  { from: 'q0', symbol: 'ε', to: 'q1,q2' },
  { from: 'q0', symbol: '0', to: 'q0' },
  { from: 'q0', symbol: '1', to: 'q1' },
  { from: 'q1', symbol: '0', to: 'q2' },
  { from: 'q1', symbol: '1', to: 'q1' },
  { from: 'q2', symbol: '0', to: 'q0' },
  { from: 'q2', symbol: '1', to: 'q2' }
];

let construction = null;
let currentStepIndex = 0;
let currentNfaDefinition = null;
let currentDfaDefinition = null;

function createTransitionRow(values = { from: '', symbol: '', to: '' }) {
  const row = document.createElement('div');
  row.className = 'transition-row';
  row.innerHTML = `
    <input class="transition-from" placeholder="from" value="${values.from}" />
    <input class="transition-symbol" placeholder="symbol" value="${values.symbol}" />
    <input class="transition-to" placeholder="to" value="${values.to}" />
    <button type="button" class="remove-transition" aria-label="Remove transition">×</button>
  `;
  row.querySelector('.remove-transition').addEventListener('click', () => row.remove());
  transitionRows.appendChild(row);
}

function setMessage(text, type = 'info') {
  messageBox.textContent = text;
  messageBox.style.color = type === 'error' ? '#ff9a9a' : 'var(--accent)';
}

function parseList(value) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeSymbol(symbol) {
  const trimmed = symbol.trim();
  if (!trimmed) return '';
  if (trimmed.toLowerCase() === 'epsilon' || trimmed === 'ε') return 'ε';
  return trimmed;
}

function buildNfaDefinition() {
  const states = Array.from(new Set(parseList(stateInput.value)));
  const alphabet = Array.from(new Set(parseList(alphabetInput.value).map(normalizeSymbol))).filter(s => s !== 'ε');
  const start = startInput.value.trim();
  const accept = Array.from(new Set(parseList(acceptInput.value)));
  const transitions = [];

  transitionRows.querySelectorAll('.transition-row').forEach(row => {
    const from = row.querySelector('.transition-from').value.trim();
    const symbol = normalizeSymbol(row.querySelector('.transition-symbol').value);
    const to = row.querySelector('.transition-to').value;
    if (!from && !symbol && !to) return;
    transitions.push({
      from,
      symbol,
      to: parseList(to)
    });
  });

  if (!states.length) throw new Error('Enter at least one state.');
  if (!alphabet.length) throw new Error('Enter at least one alphabet symbol.');
  if (!start) throw new Error('Enter the start state.');
  if (!states.includes(start)) throw new Error('Start state must appear in the states list.');
  if (!accept.length) throw new Error('Enter at least one accept state.');

  // Build transition map for NFA
  const transitionMap = {};
  states.forEach(state => {
    transitionMap[state] = {};
  });

  transitions.forEach(({ from, symbol, to }) => {
    if (!transitionMap[from]) transitionMap[from] = {};
    if (!transitionMap[from][symbol]) transitionMap[from][symbol] = new Set();
    to.forEach(target => {
      if (states.includes(target)) {
        transitionMap[from][symbol].add(target);
      }
    });
  });

  return {
    states,
    alphabet,
    start,
    accept,
    transitionMap
  };
}

function renderTable(container, header, rows) {
  if (!rows.length) {
    container.innerHTML = '<p class="hint">No data to display.</p>';
    return;
  }

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  const headerRow = document.createElement('tr');
  header.forEach(column => {
    const th = document.createElement('th');
    th.textContent = column;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  rows.forEach(row => {
    const tr = document.createElement('tr');
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  container.innerHTML = '';
  container.appendChild(table);
}

function renderNfaTable(nfa) {
  const { states, alphabet, transitionMap } = nfa;
  const header = ['State', ...alphabet.map(sym => sym === 'ε' ? 'ε' : sym), 'ε'];
  const rows = states.map(state => {
    return [
      state,
      ...alphabet.map(symbol => {
        const targets = transitionMap[state]?.[symbol];
        return targets ? [...targets].sort().join(', ') : '∅';
      }),
      (() => {
        const targets = transitionMap[state]?.['ε'];
        return targets ? [...targets].sort().join(', ') : '∅';
      })()
    ];
  });

  renderTable(nfaTable, header, rows);
}

function renderDfaTable(dfa) {
  const header = ['DFA State', ...dfa.alphabet, 'Accept'];
  const rows = dfa.dfaStates.map(state => {
    return [
      state,
      ...dfa.alphabet.map(symbol => dfa.transitions[state]?.[symbol] || '∅'),
      dfa.dfaAccept.has(state) ? 'Yes' : 'No'
    ];
  });

  renderTable(dfaTable, header, rows);
}

function makeGraphSvg(nodes, edges, startState, acceptStates, type) {

  // Canvas dimensions with better scaling
  const width = 900;
  const height = 680;
  const radius = 42;
  const padding = 96; // Space for start arrow and edges
  const centerX = width / 2;
  const centerY = height * 0.58;
  const nodeCount = nodes.length;
  const positions = {};
  
  const theme = type === 'dfa' ? {
    nodeFill: '#a78bfa',
    nodeStroke: '#7c3aed',
    edgeColor: '#000',
    accent: '#f5d0fe',
    bg: '#181f2a'
  } : {
    nodeFill: '#38bdf8',
    nodeStroke: '#0ea5e9',
    edgeColor: '#000',
    accent: '#f0fdfa',
    bg: '#17212b'
  };

  // Better node positioning with improved spacing and fewer overlapping paths
  if (nodeCount === 1) {
    positions[nodes[0]] = { x: centerX, y: centerY };
  } else if (nodeCount === 2) {
    positions[nodes[0]] = { x: centerX - 140, y: centerY };
    positions[nodes[1]] = { x: centerX + 140, y: centerY };
  } else if (nodeCount === 3) {
    positions[nodes[0]] = { x: centerX, y: centerY - 160 };
    positions[nodes[1]] = { x: centerX + 180, y: centerY + 80 };
    positions[nodes[2]] = { x: centerX - 180, y: centerY + 80 };
  } else if (nodeCount === 4) {
    positions[nodes[0]] = { x: centerX, y: centerY - 170 };
    positions[nodes[1]] = { x: centerX + 190, y: centerY };
    positions[nodes[2]] = { x: centerX, y: centerY + 170 };
    positions[nodes[3]] = { x: centerX - 190, y: centerY };
  } else {
    const availableRadius = Math.min(centerX, centerY) - padding;
    const angleStep = (2 * Math.PI) / nodeCount;
    nodes.forEach((label, i) => {
      const angle = angleStep * i - Math.PI / 2;
      positions[label] = {
        x: centerX + availableRadius * Math.cos(angle),
        y: centerY + availableRadius * Math.sin(angle)
      };
    });
  }

  const svgParts = [
    `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMin meet" xmlns="http://www.w3.org/2000/svg" aria-label="Automation graph" style="z-index: 1000; position: relative;">`,
    `<defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <marker id="arrow-${type}" markerWidth="18" markerHeight="18" refX="16" refY="9" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M0,0 L18,9 L0,18 Z" fill="#000" />
      </marker>
      <marker id="arrow-${type}-red" markerWidth="18" markerHeight="18" refX="16" refY="9" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M0,0 L18,9 L0,18 Z" fill="#ff3333" />
      </marker>
    </defs>`
  ];

  svgParts.push(`<rect width="100%" height="100%" rx="28" fill="${theme.bg}" />`);
  svgParts.push(`<text x="32" y="48" fill="${theme.accent}" font-size="22" font-weight="700">${type === 'nfa' ? 'Original NFA' : 'Equivalent DFA'}</text>`);

  // Draw edges (arrows) last so they are on top of everything else
  const edgeSvgs = [];
  let loopIndices = {};

  // Count self-loops to distribute them
  const loopCounts = {};
  edges.forEach(edge => {
    if (edge.source === edge.target) {
      loopCounts[edge.source] = (loopCounts[edge.source] || 0) + 1;
    }
  });

  const edgeCountMap = new Map();
  edges.forEach(edge => {
    const key = edge.source === edge.target ? `${edge.source}` : `${edge.source}|${edge.target}`;
    edgeCountMap.set(key, (edgeCountMap.get(key) || 0) + 1);
  });

  const outgoingEdges = new Map();
  edges.forEach((edge, idx) => {
    if (edge.source === edge.target) return;
    const from = positions[edge.source];
    const to = positions[edge.target];
    if (!from || !to) return;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const list = outgoingEdges.get(edge.source) || [];
    list.push({ ...edge, idx, angle });
    outgoingEdges.set(edge.source, list);
  });

  const outgoingAngle = new Map();
  outgoingEdges.forEach((list, state) => {
    let sumX = 0;
    let sumY = 0;
    list.forEach(edge => {
      sumX += Math.cos(edge.angle);
      sumY += Math.sin(edge.angle);
    });
    if (sumX !== 0 || sumY !== 0) {
      outgoingAngle.set(state, Math.atan2(sumY, sumX));
    }
    list.sort((a, b) => a.angle - b.angle);
  });

  const edgeFanOffset = new Map();
  outgoingEdges.forEach(list => {
    const count = list.length;
    list.forEach((edge, listIndex) => {
      const centeredIndex = listIndex - (count - 1) / 2;
      edgeFanOffset.set(edge.idx, { centeredIndex });
    });
  });

  const edgePairIndex = new Map();

  edges.forEach(({ source, target, label: edgeLabel }, idx) => {
    const from = positions[source];
    const to = positions[target];
    if (!from || !to) return;
    const isLoop = source === target;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy) || 1;
    const offset = radius + 8;

    let startX, startY, endX, endY;
    let path, labelX, labelY;

    if (isLoop) {
      loopIndices[source] = (loopIndices[source] || 0) + 1;
      const loopIndex = loopIndices[source];
      const totalLoops = loopCounts[source];
      
      const preferredAngle = outgoingAngle.get(source);
      const baseDirection = typeof preferredAngle === 'number' ? preferredAngle + Math.PI : Math.PI / 2;
      const stepAngle = Math.PI / (totalLoops + 1);
      const baseAngle = baseDirection - (totalLoops - 1) * stepAngle / 2 + (loopIndex - 1) * stepAngle;

      const loopRadius = 44;
      const nodeOffsetRadius = radius + 10;
      
      startX = from.x + Math.cos(baseAngle) * nodeOffsetRadius;
      startY = from.y + Math.sin(baseAngle) * nodeOffsetRadius;
      endX = from.x + Math.cos(baseAngle + 0.16) * nodeOffsetRadius;
      endY = from.y + Math.sin(baseAngle + 0.16) * nodeOffsetRadius;
      
      path = `M${startX},${startY} A${loopRadius},${loopRadius} 0 1,1 ${endX},${endY}`;
      labelX = from.x + Math.cos(baseAngle) * (nodeOffsetRadius + loopRadius + 10);
      labelY = from.y + Math.sin(baseAngle) * (nodeOffsetRadius + loopRadius + 10);

      edgeSvgs.push(`<path d="${path}" fill="none" stroke="#ff3333" stroke-width="5" marker-end="url(#arrow-${type}-red)" stroke-linecap="round" style="z-index:1000;" />`);
      edgeSvgs.push(`<rect x="${labelX - 32}" y="${labelY - 18}" width="64" height="26" rx="13" fill="rgba(0,0,0,0.82)" style="z-index:1000;" />`);
      edgeSvgs.push(`<text x="${labelX}" y="${labelY + 2}" fill="${theme.accent}" font-size="16" font-weight="700" text-anchor="middle" style="z-index:1000;">${edgeLabel}</text>`);
    } else {
      startX = from.x + (dx / distance) * offset;
      startY = from.y + (dy / distance) * offset;
      endX = to.x - (dx / distance) * offset;
      endY = to.y - (dy / distance) * offset;

      const edgeKey = `${source}|${target}`;
      const pairIndex = edgePairIndex.get(edgeKey) || 0;
      edgePairIndex.set(edgeKey, pairIndex + 1);
      const pairCount = edgeCountMap.get(edgeKey) || 1;
      const pairOffset = pairCount > 1 ? (pairIndex - (pairCount - 1) / 2) * 18 : 0;

      const fan = edgeFanOffset.get(idx);
      const perpX = -dy / distance;
      const perpY = dx / distance;
      const fanStrength = fan ? 36 + Math.abs(fan.centeredIndex) * 20 : 24;
      const fanSign = fan ? Math.sign(fan.centeredIndex) || 1 : 1;
      const curveOffsetX = perpX * (fanStrength * fanSign + pairOffset);
      const curveOffsetY = perpY * (fanStrength * fanSign + pairOffset);

      const mx = (startX + endX) / 2 + curveOffsetX;
      const my = (startY + endY) / 2 + curveOffsetY;
      path = `M${startX},${startY} Q${mx},${my} ${endX},${endY}`;
      labelX = mx;
      labelY = my - 12;

      edgeSvgs.push(`<path d="${path}" fill="none" stroke="${theme.edgeColor}" stroke-width="5" marker-end="url(#arrow-${type})" stroke-linecap="round" style="z-index:1000;" />`);
      const textWidth = Math.max(40, edgeLabel.length * 12 + 18);
      edgeSvgs.push(`<rect x="${labelX - textWidth / 2}" y="${labelY - 16}" width="${textWidth}" height="24" rx="12" fill="rgba(0,0,0,0.82)" style="z-index:1000;" />`);
      edgeSvgs.push(`<text x="${labelX}" y="${labelY + 2}" fill="${theme.accent}" font-size="16" font-weight="700" text-anchor="middle" style="z-index:1000;">${edgeLabel}</text>`);
    }
  });

  // Start state arrow (distinct, outside node) - also on top
  let startArrowSvgs = [];
  if (startState && positions[startState]) {
    const { x, y } = positions[startState];
    const startArrowLen = 70;
    const startArrowPad = radius + 16;
    const startX = Math.max(20, x - startArrowLen - startArrowPad);
    const startY = Math.max(30, y - 70);
    const tipX = x - radius * 0.8;
    const tipY = y - radius * 0.9;
    const ctrlX = startX + (tipX - startX) * 0.56;
    const ctrlY = startY - 30;
    startArrowSvgs.push(`<path d="M${startX},${startY} Q${ctrlX},${ctrlY} ${tipX},${tipY}" fill="none" stroke="#000" stroke-width="5" marker-end="url(#arrow-${type})" stroke-linecap="round" style="z-index:1000;" />`);
    startArrowSvgs.push(`<rect x="${startX - 26}" y="${startY - 36}" width="62" height="28" rx="14" fill="rgba(0,0,0,0.82)" style="z-index:1000;" />`);
    startArrowSvgs.push(`<text x="${startX + 7}" y="${startY - 18}" fill="${theme.accent}" font-size="15" font-weight="700" text-anchor="middle" style="z-index:1000;">start</text>`);
  }

  nodes.forEach(label => {
    const { x, y } = positions[label];
    if (acceptStates && acceptStates.has(label)) {
      svgParts.push(`<circle cx="${x}" cy="${y}" r="${radius + 13}" fill="none" stroke="#fff" stroke-width="8" filter="url(#glow)" />`);
    }
    svgParts.push(`<circle cx="${x}" cy="${y}" r="${radius}" fill="${theme.nodeFill}" stroke="${theme.nodeStroke}" stroke-width="7" filter="url(#glow)" />`);
    // Dynamic font size and white outline for readability
    let fontSize = 22;
    if (label.length > 10) fontSize = 12;
    else if (label.length > 7) fontSize = 14;
    else if (label.length > 4) fontSize = 17;
    svgParts.push(`<text x="${x}" y="${y + 8}" fill="#fff" font-size="${fontSize}" font-weight="900" text-anchor="middle" stroke="#181f2a" stroke-width="3" paint-order="stroke">${label}</text>`);
  });

  // Add arrows and start arrow last so they are on top
  svgParts.push(...edgeSvgs);
  svgParts.push(...startArrowSvgs);

  return `${svgParts.join('')}</svg>`;
}

function drawGraph(container, nodes, edges, startState, acceptStates, type) {
  if (!nodes.length) {
    container.innerHTML = '<p class="hint">No states defined yet.</p>';
    return;
  }
  const svg = makeGraphSvg(nodes, edges, startState, acceptStates, type);
  container.innerHTML = svg;
}

function buildGraphEdges(transitions) {
  // For DFA: collapse edges with same source/target, for NFA: show all transitions
  // Detect if this is an NFA (values are arrays/sets or strings)
  let isNfa = false;
  for (const source of Object.keys(transitions)) {
    for (const symbol of Object.keys(transitions[source])) {
      const target = transitions[source][symbol];
      if (Array.isArray(target) || target instanceof Set) {
        isNfa = true;
        break;
      }
    }
  }

  if (isNfa) {
    // NFA: show all transitions (including parallel edges)
    const edges = [];
    Object.keys(transitions).forEach(source => {
      Object.keys(transitions[source]).forEach(symbol => {
        const targets = transitions[source][symbol];
        (Array.isArray(targets) ? targets : Array.from(targets)).forEach(target => {
          edges.push({ source, target, label: symbol });
        });
      });
    });
    return edges;
  } else {
    // DFA: collapse edges with same source/target
    const edgeMap = new Map();
    Object.keys(transitions).forEach(source => {
      Object.keys(transitions[source]).forEach(symbol => {
        const target = transitions[source][symbol];
        const key = `${source}|${target}`;
        const existing = edgeMap.get(key);
        if (existing) {
          existing.label = `${existing.label}, ${symbol}`;
        } else {
          edgeMap.set(key, { source, target, label: symbol });
        }
      });
    });
    return Array.from(edgeMap.values());
  }
}

function epsilonClosure(states, transitionMap) {
  const closure = new Set(states);
  const queue = Array.from(states);
  while (queue.length > 0) {
    const state = queue.shift();
    const epsilonTransitions = transitionMap[state]?.['ε'] || new Set();
    epsilonTransitions.forEach(target => {
      if (!closure.has(target)) {
        closure.add(target);
        queue.push(target);
      }
    });
  }
  return closure;
}

function move(states, symbol, transitionMap) {
  const result = new Set();
  states.forEach(state => {
    const targets = transitionMap[state]?.[symbol];
    if (targets) {
      targets.forEach(target => result.add(target));
    }
  });
  return result;
}

function subsetKey(subset) {
  const label = Array.from(subset).sort().join(',');
  return label || '∅';
}

function buildDfa(nfa) {
  const { states: nfaStates, alphabet, start, accept: acceptStates, transitionMap } = nfa;
  const dfaStates = [];
  const dfaMap = new Map();
  const transitions = {};
  const steps = [];

  const startClosure = epsilonClosure(new Set([start]), transitionMap);
  const startKey = subsetKey(startClosure);

  dfaMap.set(startKey, 0);
  dfaStates.push(startClosure);
  transitions[startKey] = {};

  for (let index = 0; index < dfaStates.length; index += 1) {
    const subset = dfaStates[index];
    const stateLabel = subsetKey(subset);

    alphabet.forEach(symbol => {
      const moved = move(subset, symbol, transitionMap);
      const nfaEdgesUsed = [];
      subset.forEach(sourceState => {
        const targets = transitionMap[sourceState]?.[symbol];
        if (!targets) return;
        targets.forEach(targetState => {
          nfaEdgesUsed.push({ source: sourceState, target: targetState, label: symbol });
        });
      });
      const targetClosure = epsilonClosure(moved, transitionMap);
      const targetKey = subsetKey(targetClosure);
      const isNew = !dfaMap.has(targetKey);

      if (isNew) {
        dfaMap.set(targetKey, dfaStates.length);
        dfaStates.push(targetClosure);
        transitions[targetKey] = {};
      }
      transitions[stateLabel][symbol] = targetKey;

      steps.push({
        from: stateLabel,
        symbol,
        to: targetKey,
        isNew,
        newStateLabel: isNew ? targetKey : null,
        nfaEdges: nfaEdgesUsed
      });
    });
  }

  const dfaAccept = new Set();
  dfaStates.forEach((subset, index) => {
    const label = subsetKey(subset);
    if ([...subset].some(state => acceptStates.includes(state))) {
      dfaAccept.add(label);
    }
  });

  return {
    dfaStates: dfaStates.map(subset => subsetKey(subset)),
    dfaAccept,
    transitions,
    steps,
    startState: startKey,
    alphabet
  };
}

function updateStepView() {
  if (!construction) return;
  const stepList = construction.steps;
  const total = stepList.length;
  totalSteps.textContent = total;
  currentStep.textContent = currentStepIndex + 1;
  prevStep.disabled = currentStepIndex <= 0;
  nextStep.disabled = currentStepIndex >= total - 1;
  prevStepGraph.disabled = currentStepIndex <= 0;
  nextStepGraph.disabled = currentStepIndex >= total - 1;

  const current = stepList[currentStepIndex];
  stepDescription.textContent = `Process DFA transition from ${current.from} on '${current.symbol}' → ${current.to}. ${current.isNew ? 'New DFA state created.' : 'Existing state reused.'}`;

  stepsList.innerHTML = '';
  stepList.forEach((step, index) => {
    const li = document.createElement('li');
    const displayText = `${step.from} —[${step.symbol}]→ ${step.to}${step.isNew ? ' (new state)' : ''}`;
    li.textContent = displayText;
    li.title = displayText;
    if (index === currentStepIndex) {
      li.style.color = 'var(--accent)';
      li.style.fontWeight = '600';
    }
    stepsList.appendChild(li);
  });

  renderAutomataStep(currentStepIndex);
}

function renderAutomataTables(nfa, dfa) {
  renderNfaTable(nfa);
  renderDfaTable(dfa);
}

function getRevealCount(totalEdges, totalSteps, stepIndex) {
  if (totalEdges <= 0) return 0;
  if (totalSteps <= 1) return totalEdges;
  const count = 1 + Math.floor((stepIndex * (totalEdges - 1)) / (totalSteps - 1));
  return Math.max(1, Math.min(totalEdges, count));
}

function renderAutomataStep(stepIndex) {
  if (!currentNfaDefinition || !currentDfaDefinition || !construction) return;

  const totalSteps = construction.steps.length;
  const fullNfaEdges = buildGraphEdges(currentNfaDefinition.transitionMap);
  const fullDfaEdges = buildGraphEdges(currentDfaDefinition.transitions);

  const nfaRevealCount = getRevealCount(fullNfaEdges.length, totalSteps, stepIndex);
  const dfaRevealCount = getRevealCount(fullDfaEdges.length, totalSteps, stepIndex);

  const nfaEdgesToShow = fullNfaEdges.slice(0, nfaRevealCount);
  const dfaEdgesToShow = fullDfaEdges.slice(0, dfaRevealCount);

  drawGraph(
    nfaGraph,
    currentNfaDefinition.states,
    nfaEdgesToShow,
    currentNfaDefinition.start,
    new Set(currentNfaDefinition.accept),
    'nfa'
  );
  drawGraph(
    dfaGraph,
    currentDfaDefinition.dfaStates,
    dfaEdgesToShow,
    currentDfaDefinition.startState,
    currentDfaDefinition.dfaAccept,
    'dfa'
  );
}

function generateDfa() {
  try {
    construction = null;
    currentStepIndex = 0;
    currentNfaDefinition = null;
    currentDfaDefinition = null;
    setMessage('Working...', 'info');
    const nfa = buildNfaDefinition();
    const dfa = buildDfa(nfa);
    construction = dfa;
    currentNfaDefinition = nfa;
    currentDfaDefinition = dfa;
    renderAutomataTables(nfa, dfa);
    updateStepView();
    setMessage('DFA generated successfully. Navigate through the subset construction steps.', 'info');
    prevStep.disabled = false;
    nextStep.disabled = false;
    prevStepGraph.disabled = false;
    nextStepGraph.disabled = false;
  } catch (error) {
    setMessage(error.message, 'error');
    nfaTable.innerHTML = '';
    dfaTable.innerHTML = '';
    nfaGraph.innerHTML = '';
    dfaGraph.innerHTML = '';
    stepsList.innerHTML = '';
    currentStep.textContent = '0';
    totalSteps.textContent = '0';
    stepDescription.textContent = 'Generate the DFA to see construction details.';
    prevStep.disabled = true;
    nextStep.disabled = true;
    prevStepGraph.disabled = true;
    nextStepGraph.disabled = true;
  }
}

function resetForm() {
  stateInput.value = 'q0, q1, q2';
  alphabetInput.value = '0, 1';
  startInput.value = 'q0';
  acceptInput.value = 'q2';
  transitionRows.innerHTML = '';
  exampleTransitions.forEach(values => createTransitionRow(values));
  messageBox.textContent = '';
  nfaTable.innerHTML = '';
  dfaTable.innerHTML = '';
  stepsList.innerHTML = '';
  nfaGraph.innerHTML = '';
  dfaGraph.innerHTML = '';
  construction = null;
  currentStepIndex = 0;
  currentNfaDefinition = null;
  currentDfaDefinition = null;
  currentStep.textContent = '0';
  totalSteps.textContent = '0';
  stepDescription.textContent = 'Generate the DFA to see construction details.';
  prevStep.disabled = true;
  nextStep.disabled = true;
  prevStepGraph.disabled = true;
  nextStepGraph.disabled = true;
}

addTransition.addEventListener('click', () => createTransitionRow());
generateBtn.addEventListener('click', generateDfa);
resetBtn.addEventListener('click', resetForm);
prevStep.addEventListener('click', () => {
  if (currentStepIndex > 0) {
    currentStepIndex -= 1;
    updateStepView();
  }
});
nextStep.addEventListener('click', () => {
  if (currentStepIndex < construction.steps.length - 1) {
    currentStepIndex += 1;
    updateStepView();
  }
});

prevStepGraph.addEventListener('click', () => {
  if (currentStepIndex > 0) {
    currentStepIndex -= 1;
    updateStepView();
  }
});

nextStepGraph.addEventListener('click', () => {
  if (currentStepIndex < construction.steps.length - 1) {
    currentStepIndex += 1;
    updateStepView();
  }
});

resetForm();
