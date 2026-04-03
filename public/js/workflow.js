/* workflow.js — Visual Workflow Editor: LabVIEW-style block & wire pipeline designer */

var WorkflowManager = (function () {
  /* ---- Constants ---- */
  var STORAGE_KEY = 'commodity-hq-workflows-v1';
  var ANALYSIS_AGENTS = ['fx', 'news', 'wasde', 'soft', 'energy', 'cot', 'tech', 'quant'];
  var COMMODITY_LIST = [
    { value: 'corn', label: 'Corn' }, { value: 'soybeans', label: 'Soybeans' },
    { value: 'wheat', label: 'Wheat' }, { value: 'coffee', label: 'Coffee' },
    { value: 'sugar', label: 'Sugar' }, { value: 'cotton', label: 'Cotton' },
    { value: 'natgas', label: 'Nat Gas' }, { value: 'wti', label: 'WTI Crude' },
    { value: 'gold', label: 'Gold' }, { value: 'silver', label: 'Silver' },
    { value: 'palladium', label: 'Palladium' }, { value: 'usdjpy', label: 'USD/JPY' },
  ];
  // Same mapping as config/commodities.js COMMODITY_AGENTS
  var COMMODITY_AGENTS = {
    corn: ['fx','news','wasde','cot','tech','quant'], soybeans: ['fx','news','wasde','cot','tech','quant'],
    wheat: ['fx','news','wasde','cot','tech','quant'], coffee: ['fx','news','soft','cot','tech','quant'],
    sugar: ['fx','news','soft','cot','tech','quant'], cotton: ['fx','news','soft','cot','tech','quant'],
    natgas: ['fx','news','energy','cot','tech','quant'], wti: ['fx','news','energy','cot','tech','quant'],
    gold: ['fx','news','energy','cot','tech','quant'], silver: ['fx','news','energy','cot','tech','quant'],
    palladium: ['fx','news','energy','cot','tech','quant'], usdjpy: ['fx','news','tech'],
  };
  var PHASE_MAP = { fx: 1, news: 1, wasde: 2, soft: 2, energy: 2, cot: 3, tech: 3, quant: 4 };

  /* ---- State ---- */
  var editor = null;
  var tabs = [];
  var activeTabId = null;
  var isRunning = false;
  var initialized = false;

  function el(id) { return document.getElementById(id); }

  /* ---- Agent Lookup ---- */
  function getChar(id) {
    for (var i = 0; i < CHARS.length; i++) {
      if (CHARS[i].id === id) return CHARS[i];
    }
    return null;
  }

  /* ============================================================
     NODE DEFINITIONS
     ============================================================ */
  var NODE_DEFS = {};

  // Input nodes
  NODE_DEFS.commodity_source = {
    label: 'Commodity', icon: '\uD83C\uDF3E', category: 'input',
    inputs: 0, outputs: 1,
    html: function () {
      var opts = COMMODITY_LIST.map(function (c) {
        return '<option value="' + c.value + '">' + c.label + '</option>';
      }).join('');
      return '<div class="wf-node"><div class="wf-node-icon">\uD83C\uDF3E</div>' +
        '<select class="wf-commodity-select">' + opts + '</select></div>';
    }
  };

  NODE_DEFS.question_input = {
    label: 'Question', icon: '\u2753', category: 'input',
    inputs: 0, outputs: 1,
    html: function () {
      return '<div class="wf-node"><div class="wf-node-icon">\u2753</div>' +
        '<input type="text" class="wf-question-input" placeholder="Enter question..."></div>';
    }
  };

  // Agent nodes — built from CHARS
  ANALYSIS_AGENTS.forEach(function (id) {
    var c = null;
    // Lookup from CHARS global
    if (typeof CHARS !== 'undefined') {
      for (var i = 0; i < CHARS.length; i++) {
        if (CHARS[i].id === id) { c = CHARS[i]; break; }
      }
    }
    if (!c) return;
    NODE_DEFS[id] = {
      label: c.name, role: c.role, icon: '', category: 'agent',
      avatar: c.avatar, model: c.model, color: c.color,
      inputs: 1, outputs: 1,
      html: function () {
        var badge = (c.model || 'SONNET').toLowerCase();
        return '<div class="wf-node"><div class="wf-node-header">' +
          '<img src="' + c.avatar + '" class="wf-node-avatar" alt="' + c.name + '">' +
          '<div class="wf-node-info"><div class="wf-node-name">' + c.name + '</div>' +
          '<div class="wf-node-role">' + c.role + '</div></div>' +
          '<span class="wf-node-badge ' + badge + '">' + c.model + '</span>' +
          '</div></div>';
      }
    };
  });

  // Synthesizer
  NODE_DEFS.synthesizer = {
    label: 'Synthesizer', icon: '\uD83E\uDDE0', category: 'output',
    inputs: 1, outputs: 1,
    html: function () {
      return '<div class="wf-node"><div class="wf-node-icon">\uD83E\uDDE0</div>' +
        '<div class="wf-node-label">Synthesizer</div></div>';
    }
  };

  // Report output
  NODE_DEFS.report_output = {
    label: 'Report', icon: '\uD83D\uDCCB', category: 'output',
    inputs: 1, outputs: 0,
    html: function () {
      return '<div class="wf-node"><div class="wf-node-icon">\uD83D\uDCCB</div>' +
        '<div class="wf-node-label">Report Output</div></div>';
    }
  };

  /* ============================================================
     PALETTE
     ============================================================ */
  function buildPalette() {
    var palette = el('wf-palette');
    if (!palette) return;

    var sections = { input: [], agent: [], output: [] };
    Object.keys(NODE_DEFS).forEach(function (key) {
      var def = NODE_DEFS[key];
      if (!sections[def.category]) sections[def.category] = [];
      sections[def.category].push({ type: key, def: def });
    });

    var sectionLabels = { input: 'Input', agent: 'Agents', output: 'Output' };
    var html = '';

    ['input', 'agent', 'output'].forEach(function (cat) {
      html += '<div class="wf-palette-section">';
      html += '<div class="wf-palette-section-title">' + sectionLabels[cat] + '</div>';
      sections[cat].forEach(function (item) {
        var icon;
        if (item.def.avatar) {
          icon = '<img src="' + item.def.avatar + '" alt="' + item.def.label + '">';
        } else {
          icon = '<div class="wf-pi-icon">' + (item.def.icon || '\u25A0') + '</div>';
        }
        html += '<div class="wf-palette-item" draggable="true" data-node-type="' + item.type + '">';
        html += icon;
        html += '<span class="wf-pi-name">' + item.def.label + '</span>';
        html += '</div>';
      });
      html += '</div>';
    });

    palette.innerHTML = html;

    // Attach drag listeners
    palette.querySelectorAll('.wf-palette-item').forEach(function (item) {
      item.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('node-type', item.dataset.nodeType);
        e.dataTransfer.effectAllowed = 'move';
      });
    });
  }

  /* ============================================================
     DRAWFLOW INITIALIZATION
     ============================================================ */
  function initEditor() {
    if (editor) return;
    var container = el('wf-canvas');
    if (!container) return;

    editor = new Drawflow(container);
    editor.reroute = true;
    editor.reroute_fix_curvature = true;
    editor.force_first_input = false;

    editor.start();

    // Drop handler
    container.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    container.addEventListener('drop', function (e) {
      e.preventDefault();
      var nodeType = e.dataTransfer.getData('node-type');
      if (!nodeType || !NODE_DEFS[nodeType]) return;

      var def = NODE_DEFS[nodeType];
      var rect = container.getBoundingClientRect();
      // Account for canvas zoom/translate
      var zoom = editor.zoom;
      var canvasX = editor.canvas_x;
      var canvasY = editor.canvas_y;
      var posX = (e.clientX - rect.left - canvasX) / zoom;
      var posY = (e.clientY - rect.top - canvasY) / zoom;

      addNodeToCanvas(nodeType, posX, posY);
    });

    // Auto-save on changes
    editor.on('nodeCreated', autoSave);
    editor.on('nodeRemoved', autoSave);
    editor.on('nodeMoved', autoSave);
    editor.on('connectionCreated', function () { autoSave(); updateRunButton(); });
    editor.on('connectionRemoved', function () { autoSave(); updateRunButton(); });

    // Zoom controls
    var zoomIn = el('wf-zoom-in');
    var zoomOut = el('wf-zoom-out');
    var zoomReset = el('wf-zoom-reset');
    if (zoomIn) zoomIn.addEventListener('click', function () { editor.zoom_in(); });
    if (zoomOut) zoomOut.addEventListener('click', function () { editor.zoom_out(); });
    if (zoomReset) zoomReset.addEventListener('click', function () { editor.zoom_reset(); });

    // Delete key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Delete' && el('workflow-panel').classList.contains('visible')) {
        if (editor.node_selected) {
          editor.removeNodeId(editor.node_selected.id);
        }
      }
    });
  }

  function addNodeToCanvas(nodeType, x, y) {
    var def = NODE_DEFS[nodeType];
    if (!def) return null;
    var nodeId = editor.addNode(
      nodeType,          // name
      def.inputs,        // number of inputs
      def.outputs,       // number of outputs
      x, y,              // position
      nodeType,          // CSS class
      { type: nodeType },// data
      def.html()         // HTML content
    );
    return nodeId;
  }

  /* ============================================================
     DEFAULT PIPELINE
     ============================================================ */
  function createDefaultPipeline(commodity) {
    if (!editor) return;
    commodity = commodity || 'corn';
    editor.clear();

    var agents = COMMODITY_AGENTS[commodity] || COMMODITY_AGENTS.corn;
    var phase2Agent = agents.find(function (a) { return PHASE_MAP[a] === 2; }) || 'wasde';

    // Layout positions (left to right)
    var cols = { input: 60, p1: 300, p2: 540, p3: 780, p4: 1020, synth: 1260, report: 1480 };
    var midY = 200;

    // Column 1: Commodity source
    var nInput = addNodeToCanvas('commodity_source', cols.input, midY);

    // Column 2: Phase 1 (fx, news)
    var nFx = addNodeToCanvas('fx', cols.p1, midY - 80);
    var nNews = addNodeToCanvas('news', cols.p1, midY + 80);

    // Column 3: Phase 2 (commodity-dependent)
    var nP2 = addNodeToCanvas(phase2Agent, cols.p2, midY);

    // Column 4: Phase 3 (cot, tech)
    var nCot = addNodeToCanvas('cot', cols.p3, midY - 80);
    var nTech = addNodeToCanvas('tech', cols.p3, midY + 80);

    // Column 5: Phase 4 (quant) — skip if not in agent list (e.g. usdjpy)
    var nQuant = null;
    if (agents.indexOf('quant') >= 0) {
      nQuant = addNodeToCanvas('quant', cols.p4, midY);
    }

    // Column 6: Synthesizer
    var synthX = nQuant ? cols.synth : cols.p4;
    var nSynth = addNodeToCanvas('synthesizer', synthX, midY);

    // Column 7: Report
    var reportX = nQuant ? cols.report : cols.synth;
    var nReport = addNodeToCanvas('report_output', reportX, midY);

    // === WIRING ===
    // Input → Phase 1
    editor.addConnection(nInput, nFx, 'output_1', 'input_1');
    editor.addConnection(nInput, nNews, 'output_1', 'input_1');

    // Phase 1 → Phase 2
    editor.addConnection(nFx, nP2, 'output_1', 'input_1');
    editor.addConnection(nNews, nP2, 'output_1', 'input_1');

    // Phase 1+2 → Phase 3
    editor.addConnection(nFx, nCot, 'output_1', 'input_1');
    editor.addConnection(nNews, nCot, 'output_1', 'input_1');
    editor.addConnection(nP2, nCot, 'output_1', 'input_1');
    editor.addConnection(nFx, nTech, 'output_1', 'input_1');
    editor.addConnection(nNews, nTech, 'output_1', 'input_1');
    editor.addConnection(nP2, nTech, 'output_1', 'input_1');

    if (nQuant) {
      // Phase 1+2+3 → Phase 4
      editor.addConnection(nFx, nQuant, 'output_1', 'input_1');
      editor.addConnection(nNews, nQuant, 'output_1', 'input_1');
      editor.addConnection(nP2, nQuant, 'output_1', 'input_1');
      editor.addConnection(nCot, nQuant, 'output_1', 'input_1');
      editor.addConnection(nTech, nQuant, 'output_1', 'input_1');

      // All → Synthesizer
      editor.addConnection(nFx, nSynth, 'output_1', 'input_1');
      editor.addConnection(nNews, nSynth, 'output_1', 'input_1');
      editor.addConnection(nP2, nSynth, 'output_1', 'input_1');
      editor.addConnection(nCot, nSynth, 'output_1', 'input_1');
      editor.addConnection(nTech, nSynth, 'output_1', 'input_1');
      editor.addConnection(nQuant, nSynth, 'output_1', 'input_1');
    } else {
      // No quant → Phase 3 feeds directly to Synth
      editor.addConnection(nFx, nSynth, 'output_1', 'input_1');
      editor.addConnection(nNews, nSynth, 'output_1', 'input_1');
      editor.addConnection(nP2, nSynth, 'output_1', 'input_1');
      editor.addConnection(nCot, nSynth, 'output_1', 'input_1');
      editor.addConnection(nTech, nSynth, 'output_1', 'input_1');
    }

    // Synthesizer → Report
    editor.addConnection(nSynth, nReport, 'output_1', 'input_1');

    // Set commodity in the input node dropdown
    setTimeout(function () {
      var sel = document.querySelector('#node-' + nInput + ' .wf-commodity-select');
      if (sel) sel.value = commodity;
    }, 50);

    updateRunButton();
  }

  /* ============================================================
     TAB MANAGEMENT
     ============================================================ */
  function renderTabs() {
    var container = el('wf-tabs');
    if (!container) return;

    var html = '';
    tabs.forEach(function (tab) {
      var active = tab.id === activeTabId ? ' active' : '';
      html += '<div class="wf-tab' + active + '" data-tab-id="' + tab.id + '">';
      html += '<span class="wf-tab-name">' + tab.name + '</span>';
      if (!tab.isDefault) {
        html += '<button class="wf-tab-close" data-tab-id="' + tab.id + '" title="Close tab">\u2715</button>';
      }
      html += '</div>';
    });
    html += '<button class="wf-tab-add" id="wf-tab-add" title="New workflow">+</button>';
    container.innerHTML = html;

    // Tab click handlers
    container.querySelectorAll('.wf-tab').forEach(function (tabEl) {
      tabEl.addEventListener('click', function (e) {
        if (e.target.classList.contains('wf-tab-close')) return;
        switchTab(tabEl.dataset.tabId);
      });
    });

    // Close tab handlers
    container.querySelectorAll('.wf-tab-close').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteTab(btn.dataset.tabId);
      });
    });

    // Add tab button
    var addBtn = el('wf-tab-add');
    if (addBtn) addBtn.addEventListener('click', function () {
      createTab('Workflow ' + (tabs.length));
    });
  }

  function switchTab(tabId) {
    if (tabId === activeTabId) return;
    // Save current tab
    saveCurrentTab();
    // Switch
    activeTabId = tabId;
    var tab = tabs.find(function (t) { return t.id === tabId; });
    if (tab && tab.data && Object.keys(tab.data).length > 0) {
      editor.import(tab.data);
    } else if (tab && tab.isDefault) {
      createDefaultPipeline(tab.commodity || 'corn');
    } else {
      editor.clear();
    }
    renderTabs();
    updateRunButton();
  }

  function createTab(name) {
    var tab = { id: 'wf-' + Date.now(), name: name, isDefault: false, data: null };
    tabs.push(tab);
    saveCurrentTab();
    activeTabId = tab.id;
    editor.clear();
    renderTabs();
    saveToStorage();
    updateRunButton();
  }

  function deleteTab(tabId) {
    var idx = tabs.findIndex(function (t) { return t.id === tabId; });
    if (idx < 0 || tabs[idx].isDefault) return;
    tabs.splice(idx, 1);
    if (activeTabId === tabId) {
      activeTabId = tabs[Math.min(idx, tabs.length - 1)].id;
      var tab = tabs.find(function (t) { return t.id === activeTabId; });
      if (tab && tab.data) editor.import(tab.data);
      else if (tab && tab.isDefault) createDefaultPipeline(tab.commodity || 'corn');
      else editor.clear();
    }
    renderTabs();
    saveToStorage();
    updateRunButton();
  }

  function saveCurrentTab() {
    if (!editor || !activeTabId) return;
    var tab = tabs.find(function (t) { return t.id === activeTabId; });
    if (tab) tab.data = editor.export();
  }

  function autoSave() {
    saveCurrentTab();
    saveToStorage();
  }

  /* ============================================================
     PERSISTENCE
     ============================================================ */
  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs: tabs, activeTabId: activeTabId }));
    } catch (e) { /* quota exceeded */ }
  }

  function loadFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        if (data.tabs && data.tabs.length > 0) {
          tabs = data.tabs;
          activeTabId = data.activeTabId || tabs[0].id;
          return true;
        }
      }
    } catch (e) { /* parse error */ }
    return false;
  }

  function initTabs() {
    if (!loadFromStorage()) {
      // Create default tab
      tabs = [{ id: 'default', name: 'Default Pipeline', isDefault: true, commodity: 'corn', data: null }];
      activeTabId = 'default';
    }
    renderTabs();
    // Load active tab
    var tab = tabs.find(function (t) { return t.id === activeTabId; });
    if (tab && tab.data && Object.keys(tab.data).length > 0) {
      editor.import(tab.data);
    } else if (tab && tab.isDefault) {
      createDefaultPipeline(tab.commodity || 'corn');
      // Save immediately so we have the default stored
      saveCurrentTab();
      saveToStorage();
    }
  }

  /* ============================================================
     DAG EXTRACTION & VALIDATION
     ============================================================ */
  function extractDAG() {
    if (!editor) return null;
    var exp = editor.export();
    var drawflowData = exp.drawflow.Home.data;
    var nodes = [];
    var edges = [];

    Object.keys(drawflowData).forEach(function (nodeId) {
      var n = drawflowData[nodeId];
      var nodeData = { id: parseInt(nodeId), type: n.data.type || n.name };

      // Extract input values from DOM
      var domNode = document.querySelector('#node-' + nodeId);
      if (domNode) {
        var sel = domNode.querySelector('.wf-commodity-select');
        if (sel) nodeData.commodity = sel.value;
        var inp = domNode.querySelector('.wf-question-input');
        if (inp) nodeData.question = inp.value;
      }
      nodes.push(nodeData);

      // Extract edges from outputs
      Object.keys(n.outputs || {}).forEach(function (outKey) {
        var conns = n.outputs[outKey].connections || [];
        conns.forEach(function (conn) {
          edges.push({ from: parseInt(nodeId), to: parseInt(conn.node) });
        });
      });
    });

    return { nodes: nodes, edges: edges };
  }

  function validateDAG() {
    var dag = extractDAG();
    if (!dag) return { valid: false, errors: ['No graph data'] };
    var errors = [];

    if (dag.nodes.length === 0) { errors.push('Graph is empty'); return { valid: false, errors: errors }; }

    // Check for at least one input and one agent
    var hasInput = dag.nodes.some(function (n) { return n.type === 'commodity_source' || n.type === 'question_input'; });
    var hasAgent = dag.nodes.some(function (n) { return ANALYSIS_AGENTS.indexOf(n.type) >= 0; });
    if (!hasInput) errors.push('Missing input node (Commodity or Question)');
    if (!hasAgent) errors.push('Missing at least one agent node');

    // Cycle detection (Kahn's algorithm)
    var inDegree = {};
    var adj = {};
    dag.nodes.forEach(function (n) { inDegree[n.id] = 0; adj[n.id] = []; });
    dag.edges.forEach(function (e) {
      inDegree[e.to] = (inDegree[e.to] || 0) + 1;
      adj[e.from] = adj[e.from] || [];
      adj[e.from].push(e.to);
    });
    var queue = [];
    Object.keys(inDegree).forEach(function (id) { if (inDegree[id] === 0) queue.push(parseInt(id)); });
    var processed = 0;
    while (queue.length > 0) {
      var curr = queue.shift();
      processed++;
      (adj[curr] || []).forEach(function (next) {
        inDegree[next]--;
        if (inDegree[next] === 0) queue.push(next);
      });
    }
    if (processed < dag.nodes.length) errors.push('Graph contains a cycle');

    return { valid: errors.length === 0, errors: errors };
  }

  function updateRunButton() {
    var btn = el('wf-run');
    if (!btn) return;
    if (isRunning) { btn.disabled = true; btn.textContent = '\u23F3 Running...'; return; }

    var result = validateDAG();
    btn.disabled = !result.valid;
    btn.textContent = '\u25B6 Run Pipeline';

    var status = el('wf-status');
    if (status) {
      var dag = extractDAG();
      var nodeCount = dag ? dag.nodes.length : 0;
      var edgeCount = dag ? dag.edges.length : 0;
      status.textContent = nodeCount + ' nodes, ' + edgeCount + ' connections' +
        (result.valid ? ' \u2014 Ready' : ' \u2014 ' + result.errors[0]);
    }
  }

  /* ============================================================
     EXECUTION
     ============================================================ */
  async function runWorkflow() {
    if (isRunning) return;
    var dag = extractDAG();
    var validation = validateDAG();
    if (!validation.valid) return;

    isRunning = true;
    updateRunButton();
    var btn = el('wf-run');
    if (btn) btn.classList.add('running');

    // Find commodity/question from input nodes
    var commodity = null, question = null;
    dag.nodes.forEach(function (n) {
      if (n.type === 'commodity_source') commodity = n.commodity;
      if (n.type === 'question_input') question = n.question;
    });

    // Set all agent & synth nodes to pending
    dag.nodes.forEach(function (n) {
      if (ANALYSIS_AGENTS.indexOf(n.type) >= 0 || n.type === 'synthesizer') {
        setNodeState(n.id, 'pending');
      }
    });

    try {
      var res = await fetch('/api/workflow/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: dag.nodes, edges: dag.edges, commodity: commodity, question: question }),
      });

      if (!res.ok) {
        var errData = await res.json().catch(function () { return {}; });
        throw new Error(errData.error || 'Request failed (' + res.status + ')');
      }

      // SSE stream
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      while (true) {
        var result = await reader.read();
        if (result.done) break;
        buffer += decoder.decode(result.value, { stream: true });

        var boundary;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          var block = buffer.substring(0, boundary);
          buffer = buffer.substring(boundary + 2);

          var evt = null, dataStr = null;
          var lines = block.split('\n');
          for (var i = 0; i < lines.length; i++) {
            if (lines[i].indexOf('event: ') === 0) evt = lines[i].substring(7).trim();
            if (lines[i].indexOf('data: ') === 0) dataStr = lines[i].substring(6);
          }
          if (evt && dataStr) {
            try { handleRunEvent(evt, JSON.parse(dataStr)); } catch (e) { /* skip */ }
          }
        }
      }
    } catch (err) {
      var status = el('wf-status');
      if (status) status.textContent = 'Error: ' + err.message;
    } finally {
      isRunning = false;
      updateRunButton();
      if (btn) btn.classList.remove('running');
    }
  }

  function handleRunEvent(event, data) {
    var status = el('wf-status');

    if (event === 'agent_start') {
      setNodeState(data.nodeId, 'running');
      if (status) status.textContent = '\u23F3 ' + (data.name || data.agentId) + ' is analyzing...';
    } else if (event === 'agent_done') {
      setNodeState(data.nodeId, 'done');
      if (status) status.textContent = '\u2705 ' + (data.name || data.agentId) + ' complete';
    } else if (event === 'agent_error') {
      setNodeState(data.nodeId, 'error');
      if (status) status.textContent = '\u274C ' + (data.name || data.agentId) + ' failed: ' + (data.error || '');
    } else if (event === 'synthesis_start') {
      dag_findNodesByType('synthesizer').forEach(function (id) { setNodeState(id, 'running'); });
      if (status) status.textContent = '\u23F3 Synthesizing final report...';
    } else if (event === 'synthesis') {
      dag_findNodesByType('synthesizer').forEach(function (id) { setNodeState(id, 'done'); });
      dag_findNodesByType('report_output').forEach(function (id) { setNodeState(id, 'done'); });
      if (status) status.textContent = '\u2705 Pipeline complete \u2014 Report generated';
      // Save report using AnalysisManager if available
      if (data.report && typeof AnalysisManager !== 'undefined' && AnalysisManager.saveReport) {
        AnalysisManager.saveReport(data.report);
      }
    } else if (event === 'complete') {
      if (status) status.textContent = '\u2705 Pipeline execution complete';
    } else if (event === 'error') {
      if (status) status.textContent = '\u274C ' + (data.message || 'Pipeline error');
    }
  }

  function setNodeState(nodeId, state) {
    var domNode = document.querySelector('#node-' + nodeId);
    if (!domNode) return;
    domNode.classList.remove('wf-pending', 'wf-running', 'wf-done', 'wf-error');
    if (state) domNode.classList.add('wf-' + state);
  }

  function dag_findNodesByType(type) {
    var exp = editor.export();
    var data = exp.drawflow.Home.data;
    var ids = [];
    Object.keys(data).forEach(function (id) {
      if (data[id].data.type === type || data[id].name === type) ids.push(parseInt(id));
    });
    return ids;
  }

  /* ============================================================
     SHOW / HIDE
     ============================================================ */
  function show() {
    hideAllPanels();
    el('workflow-panel').classList.add('visible');
    if (!initialized) {
      initialized = true;
      initEditor();
      buildPalette();
      initTabs();
    }
    // Trigger resize for Drawflow to recalculate
    setTimeout(function () {
      if (editor) {
        editor.zoom_reset();
        updateRunButton();
      }
    }, 100);
  }

  function hide() {
    el('workflow-panel').classList.remove('visible');
  }

  /* ============================================================
     INIT
     ============================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    var closeBtn = el('wf-close');
    if (closeBtn) closeBtn.addEventListener('click', function () {
      hide();
      document.getElementById('welcome').style.display = '';
    });

    var runBtn = el('wf-run');
    if (runBtn) runBtn.addEventListener('click', runWorkflow);
  });

  return { show: show, hide: hide };
})();
