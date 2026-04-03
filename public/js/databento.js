/* databento.js — Databento historical data query panel */

var DatabentoManager = (function () {
  var isLoading = false;
  var lastData = [];

  var DATASETS = [
    { value: 'GLBX.MDP3', label: 'CME Globex' },
    { value: 'XNAS.ITCH', label: 'NASDAQ' },
    { value: 'XNYS.TRADES', label: 'NYSE' },
    { value: 'OPRA.PILLAR', label: 'Options (OPRA)' },
    { value: 'DBEQ.BASIC', label: 'US Equities' },
  ];

  var SCHEMAS = [
    { value: 'ohlcv-1d', label: 'Daily OHLCV' },
    { value: 'ohlcv-1h', label: 'Hourly OHLCV' },
    { value: 'ohlcv-1m', label: '1-Min OHLCV' },
    { value: 'trades', label: 'Trades' },
    { value: 'tbbo', label: 'Top of Book' },
  ];

  function el(id) { return document.getElementById(id); }

  function populateSelects() {
    var ds = el('db-dataset');
    if (ds && ds.options.length === 0) {
      DATASETS.forEach(function (d) {
        var opt = document.createElement('option');
        opt.value = d.value;
        opt.textContent = d.label;
        ds.appendChild(opt);
      });
    }
    var sc = el('db-schema');
    if (sc && sc.options.length === 0) {
      SCHEMAS.forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s.value;
        opt.textContent = s.label;
        sc.appendChild(opt);
      });
    }
  }

  function setLoading(v) {
    isLoading = v;
    var btn = el('db-query-btn');
    if (btn) {
      btn.disabled = v;
      btn.textContent = v ? 'Loading...' : 'Query';
    }
  }

  async function runQuery() {
    if (isLoading) return;
    var dataset = el('db-dataset').value;
    var symbols = el('db-symbols').value.trim();
    var start = el('db-start').value;
    var end = el('db-end').value;
    var schema = el('db-schema').value;

    if (!symbols || !start || !end) {
      el('db-status').textContent = 'Please fill in all required fields.';
      return;
    }

    setLoading(true);
    el('db-status').textContent = '';

    try {
      var resp = await fetch('/api/databento/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset: dataset, symbols: symbols, start: start, end: end, schema: schema }),
      });
      var json = await resp.json();
      if (json.error) throw new Error(json.error);

      lastData = json.data || [];
      el('db-status').textContent = json.count + ' records returned.';
      renderTable(lastData, schema);
    } catch (err) {
      el('db-status').textContent = 'Error: ' + err.message;
      renderTable([], schema);
    }
    setLoading(false);
  }

  function esc(t) {
    if (t === null || t === undefined) return '-';
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderTable(data, schema) {
    var container = el('db-results');
    if (!container) return;

    if (!data.length) {
      container.innerHTML = '<div class="databento-empty">No data. Run a query to see results.</div>';
      return;
    }

    // Determine columns from first record
    var keys = Object.keys(data[0]).filter(function (k) {
      return k !== 'hd' && k !== 'rtype' && k !== 'publisher_id' && k !== 'instrument_id';
    });

    var html = '<table class="databento-table"><thead><tr>';
    keys.forEach(function (k) {
      html += '<th>' + esc(k) + '</th>';
    });
    html += '</tr></thead><tbody>';

    var maxRows = Math.min(data.length, 500); // Cap at 500 rows for performance
    for (var i = 0; i < maxRows; i++) {
      html += '<tr>';
      keys.forEach(function (k) {
        var val = data[i][k];
        // Format timestamps
        if (k === 'ts_event' || k === 'ts_recv') {
          try {
            val = new Date(val / 1000000).toISOString().replace('T', ' ').substring(0, 19);
          } catch (e) {}
        }
        // Format prices (Databento uses fixed-point integers for some schemas)
        if (typeof val === 'number' && (k === 'open' || k === 'high' || k === 'low' || k === 'close' || k === 'price')) {
          if (val > 1000000000) val = (val / 1000000000).toFixed(2); // fixed-point conversion
          else val = val.toFixed(2);
        }
        html += '<td>' + esc(val) + '</td>';
      });
      html += '</tr>';
    }
    html += '</tbody></table>';

    if (data.length > maxRows) {
      html += '<div style="text-align:center;padding:10px;color:var(--text-hint);font-size:12px;">Showing ' + maxRows + ' of ' + data.length + ' records.</div>';
    }

    container.innerHTML = html;
  }

  function exportCSV() {
    if (!lastData.length) return;
    var keys = Object.keys(lastData[0]);
    var csv = keys.join(',') + '\n';
    lastData.forEach(function (row) {
      csv += keys.map(function (k) {
        var v = row[k];
        if (v === null || v === undefined) return '';
        if (typeof v === 'string' && v.indexOf(',') >= 0) return '"' + v + '"';
        return v;
      }).join(',') + '\n';
    });

    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'databento_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function show() {
    hideAllPanels();
    var panel = document.getElementById('databento-panel');
    if (panel) panel.classList.add('visible');

    populateSelects();
  }

  function hide() {
    var panel = document.getElementById('databento-panel');
    if (panel) panel.classList.remove('visible');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var queryBtn = el('db-query-btn');
    if (queryBtn) queryBtn.addEventListener('click', runQuery);
    var exportBtn = el('db-export-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportCSV);
    var closeBtn = el('db-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        hide();
        document.getElementById('welcome').style.display = '';
      });
    }
  });

  return { show: show, hide: hide };
})();
