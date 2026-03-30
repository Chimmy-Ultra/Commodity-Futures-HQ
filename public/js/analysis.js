/* analysis.js — Multi-agent layered analysis UI */

var AnalysisManager = (function () {
  var abortController = null;
  var isRunning = false;
  var agentResponses = {};
  var REPORTS_KEY = 'commodity-hq-reports-v1';
  var currentTitle = '';

  // Safe markdown rendering with DOMPurify
  function safeMd(t) {
    var html = safeMd(t);
    return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(html) : html;
  }

  var PHASE_LABELS = {
    1: 'Phase 1: Macro & News',
    2: 'Phase 2: Fundamentals',
    3: 'Phase 3: Positioning & Technicals',
    4: 'Phase 4: Quant Validation',
  };

  function el(id) { return document.getElementById(id); }

  function esc(t) {
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* --- Report Storage --- */
  function loadReports() {
    try { return JSON.parse(localStorage.getItem(REPORTS_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveReport(title, markdown) {
    var reports = loadReports();
    reports.unshift({ id: Date.now(), title: title, markdown: markdown, date: new Date().toISOString() });
    if (reports.length > 50) reports = reports.slice(0, 50);
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    renderReportList();
  }
  function deleteReport(id) {
    var reports = loadReports().filter(function (r) { return r.id !== id; });
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    renderReportList();
  }
  function deleteAllReports() {
    localStorage.removeItem(REPORTS_KEY);
    renderReportList();
  }
  function renderReportList() {
    var container = el('report-list');
    if (!container) return;
    var reports = loadReports();
    if (!reports.length) {
      container.innerHTML = '<div class="report-empty">No saved reports yet.</div>';
      return;
    }
    container.innerHTML = '';
    reports.forEach(function (r) {
      var item = document.createElement('div');
      item.className = 'report-item';
      var d = new Date(r.date);
      var dateStr = d.toLocaleDateString('zh-TW') + ' ' + d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
      item.innerHTML =
        '<div class="report-item-info">' +
          '<div class="report-item-title">' + esc(r.title) + '</div>' +
          '<div class="report-item-date">' + dateStr + '</div>' +
        '</div>' +
        '<div class="report-item-actions">' +
          '<button class="report-item-btn view" title="View">&#x1F4C4;</button>' +
          '<button class="report-item-btn del" title="Delete">&#x2715;</button>' +
        '</div>';
      item.querySelector('.view').addEventListener('click', function () { viewReport(r); });
      item.querySelector('.del').addEventListener('click', function (e) {
        e.stopPropagation();
        deleteReport(r.id);
      });
      container.appendChild(item);
    });
  }
  function viewReport(r) {
    show();
    el('analysis-title').textContent = r.title;
    var d = new Date(r.date);
    el('analysis-subtitle').textContent = d.toLocaleDateString('zh-TW') + ' ' + d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    el('analysis-agents').innerHTML = '';
    el('analysis-detail').innerHTML = '';
    el('analysis-detail').classList.remove('expanded');
    el('analysis-report').innerHTML = '<div class="report-content">' + safeMd(r.markdown) + '</div>';
  }
  function showReportPanel() {
    el('welcome').style.display = 'none';
    el('chat-area').classList.remove('visible');
    el('quote-panel').classList.remove('visible');
    el('analysis-panel').classList.remove('visible');
    el('report-panel').classList.add('visible');
    renderReportList();
  }
  function hideReportPanel() {
    el('report-panel').classList.remove('visible');
  }

  function show() {
    el('welcome').style.display = 'none';
    el('chat-area').classList.remove('visible');
    el('quote-panel').classList.remove('visible');
    el('report-panel').classList.remove('visible');
    el('analysis-panel').classList.add('visible');
  }

  function hide() {
    if (abortController) { abortController.abort(); abortController = null; }
    isRunning = false;
    el('analysis-panel').classList.remove('visible');
    agentResponses = {};
  }

  function setButtons(disabled) {
    el('btn-quick-analyze').disabled = disabled;
    el('btn-custom-analyze').disabled = disabled;
    isRunning = disabled;
  }

  function getCharAvatar(agentId) {
    for (var i = 0; i < CHARS.length; i++) {
      if (CHARS[i].id === agentId && CHARS[i].avatar) {
        return '<img src="' + CHARS[i].avatar + '" alt="" width="22" height="22">';
      }
    }
    return '';
  }

  function renderAgentCards(agents) {
    var container = el('analysis-agents');
    container.innerHTML = '';

    // Group by phase
    var phases = {};
    agents.forEach(function (a) {
      var p = a.phase || 1;
      if (!phases[p]) phases[p] = [];
      phases[p].push(a);
    });

    Object.keys(phases).sort().forEach(function (phase) {
      var group = document.createElement('div');
      group.className = 'phase-group';
      group.id = 'phase-group-' + phase;
      group.dataset.step = phase;

      var label = document.createElement('div');
      label.className = 'phase-label';
      label.textContent = PHASE_LABELS[phase] || 'Phase ' + phase;
      group.appendChild(label);

      var row = document.createElement('div');
      row.className = 'phase-agents';

      phases[phase].forEach(function (a) {
        var card = document.createElement('div');
        card.className = 'agent-card pending';
        card.id = 'agent-' + a.agentId;
        card.dataset.id = a.agentId;
        card.style.position = 'relative';
        var avatarSvg = getCharAvatar(a.agentId);
        card.innerHTML =
          '<div class="agent-card-top">' +
            (avatarSvg ? '<div class="agent-card-avatar">' + avatarSvg + '</div>' : '') +
            '<div class="agent-card-name">' + esc(a.name) + '</div>' +
            '<div class="agent-card-status"></div>' +
          '</div>' +
          '<div class="agent-card-sub">' + esc(a.subQuestion).substring(0, 60) + '</div>';
        card.addEventListener('click', function () { toggleDetail(a.agentId); });
        row.appendChild(card);
      });

      group.appendChild(row);
      container.appendChild(group);
    });

    // Synthesis node at the bottom
    var synthNode = document.createElement('div');
    synthNode.className = 'synthesis-node';
    synthNode.id = 'synthesis-node';
    synthNode.innerHTML = '<div class="synthesis-node-label">Synthesis</div>';
    container.appendChild(synthNode);
  }

  function setAgentState(agentId, state) {
    var card = el('agent-' + agentId);
    if (!card) return;
    card.className = 'agent-card ' + state;
  }

  function toggleDetail(agentId) {
    var detail = el('analysis-detail');
    var resp = agentResponses[agentId];
    if (!resp) return;

    if (detail.dataset.active === agentId) {
      detail.innerHTML = '';
      detail.dataset.active = '';
      detail.classList.remove('expanded');
      return;
    }

    detail.dataset.active = agentId;
    detail.innerHTML =
      '<div class="detail-header">' + esc(resp.name) + ' (Phase ' + resp.phase + ')</div>' +
      '<div class="msg assistant">' + safeMd(resp.response) + '</div>';
    detail.classList.add('expanded');
  }

  function handleEvent(name, data) {
    switch (name) {
      case 'plan':
        renderAgentCards(data.agents);
        el('analysis-subtitle').textContent =
          (data.commodity ? data.commodity.toUpperCase() + ' — ' : '') +
          data.agents.length + ' agents, layered pipeline' +
          (data.source === 'router' ? ' (AI routed)' : '');
        break;

      case 'phase_start':
        var group = el('phase-group-' + data.phase);
        if (group) group.classList.add('active');
        break;

      case 'agent_start':
        setAgentState(data.agentId, 'loading');
        break;

      case 'agent_done':
        setAgentState(data.agentId, 'done');
        agentResponses[data.agentId] = data;
        break;

      case 'agent_error':
        setAgentState(data.agentId, 'error');
        break;

      case 'synthesis_start':
        var sn = el('synthesis-node');
        if (sn) sn.classList.add('active');
        el('analysis-report').innerHTML =
          '<div class="synthesis-loading"><div class="loading-dots"><span></span><span></span><span></span></div><span>Synthesizing final report from all phases...</span></div>';
        break;

      case 'synthesis':
        el('analysis-report').innerHTML =
          '<div class="report-content">' + safeMd(data.report) + '</div>';
        saveReport(currentTitle, data.report);
        break;

      case 'error':
        el('analysis-report').innerHTML =
          '<div class="report-error">Error: ' + esc(data.message) + '</div>';
        break;

      case 'complete':
        setButtons(false);
        break;
    }
  }

  async function readSSE(response) {
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';

    while (true) {
      var result = await reader.read();
      if (result.done) break;

      buffer += decoder.decode(result.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop() || '';

      var currentEvent = null;
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.indexOf('event: ') === 0) {
          currentEvent = line.substring(7).trim();
        } else if (line.indexOf('data: ') === 0 && currentEvent) {
          try {
            var eventData = JSON.parse(line.substring(6));
            handleEvent(currentEvent, eventData);
          } catch (e) { /* skip malformed */ }
          currentEvent = null;
        }
      }
    }
  }

  async function start(mode, commodity, question) {
    if (isRunning) return;

    agentResponses = {};
    show();
    setButtons(true);

    currentTitle = mode === 'commodity' ? commodity.toUpperCase() + ' Analysis' : 'Custom Analysis';
    el('analysis-title').textContent = currentTitle;
    el('analysis-subtitle').textContent = 'Planning analysis pipeline...';
    el('analysis-agents').innerHTML = '';
    el('analysis-detail').innerHTML = '';
    el('analysis-detail').classList.remove('expanded');
    el('analysis-report').innerHTML = '';

    abortController = new AbortController();

    try {
      var body = mode === 'commodity'
        ? { mode: 'commodity', commodity: commodity }
        : { mode: 'question', question: question };

      var response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortController.signal,
      });

      if (!response.ok) {
        var err = await response.json().catch(function () { return {}; });
        handleEvent('error', { message: err.error || 'Request failed.' });
        setButtons(false);
        return;
      }

      await readSSE(response);
    } catch (e) {
      if (e.name !== 'AbortError') {
        handleEvent('error', { message: e.message });
      }
      setButtons(false);
    }
  }

  // Wire up events on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function () {
    fetch('/api/commodities')
      .then(function (r) { return r.json(); })
      .then(function (labels) {
        var select = el('commodity-select');
        Object.keys(labels).forEach(function (key) {
          var opt = document.createElement('option');
          opt.value = key;
          opt.textContent = labels[key];
          select.appendChild(opt);
        });
      })
      .catch(function () {});

    el('btn-quick-analyze').addEventListener('click', function () {
      var commodity = el('commodity-select').value;
      if (commodity) start('commodity', commodity);
    });

    el('btn-custom-analyze').addEventListener('click', function () {
      var q = el('custom-question').value.trim();
      if (q) start('question', null, q);
    });

    el('custom-question').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var q = el('custom-question').value.trim();
        if (q) start('question', null, q);
      }
    });

    el('analysis-close').addEventListener('click', function () {
      hide();
      el('welcome').style.display = '';
    });

    // Report panel buttons
    var rpClose = el('report-panel-close');
    if (rpClose) rpClose.addEventListener('click', function () {
      hideReportPanel();
      el('welcome').style.display = '';
    });
    var rpClearAll = el('report-clear-all');
    if (rpClearAll) rpClearAll.addEventListener('click', function () {
      if (!window.confirm('Delete ALL saved reports?')) return;
      deleteAllReports();
    });
  });

  return { start: start, hide: hide, showReportPanel: showReportPanel, hideReportPanel: hideReportPanel };
})();
