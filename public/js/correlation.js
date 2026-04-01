/* correlation.js — Correlation Matrix heatmap panel */

var CorrelationManager = (function () {
  var currentRange = '6mo';
  var isLoading = false;

  function el(id) { return document.getElementById(id); }

  function setLoading(v) {
    isLoading = v;
    var loader = el('corr-loader');
    if (loader) loader.style.display = v ? 'flex' : 'none';
  }

  function getColor(val) {
    if (val == null) return '#eee';
    // Red (+1) → White (0) → Blue (-1)
    var r, g, b;
    if (val >= 0) {
      // white to red
      r = 255;
      g = Math.round(255 * (1 - val));
      b = Math.round(255 * (1 - val));
    } else {
      // white to green
      var abs = Math.abs(val);
      r = Math.round(255 * (1 - abs));
      g = Math.round(255 * (1 - abs * 0.3));
      b = Math.round(255 * (1 - abs));
    }
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function getTextColor(val) {
    if (val == null) return '#999';
    var abs = Math.abs(val);
    return abs > 0.6 ? '#fff' : '#333';
  }

  function renderMatrix(data) {
    var container = el('corr-matrix');
    if (!container) return;

    var symbols = data.symbols;
    var matrix = data.matrix;
    var n = symbols.length;

    var html = '<table class="corr-table"><thead><tr><th></th>';
    for (var i = 0; i < n; i++) {
      html += '<th title="' + symbols[i].label + ' (' + symbols[i].labelZh + ')">' + symbols[i].label + '</th>';
    }
    html += '</tr></thead><tbody>';

    for (var i = 0; i < n; i++) {
      html += '<tr><th title="' + symbols[i].label + ' (' + symbols[i].labelZh + ')">' + symbols[i].label + '</th>';
      for (var j = 0; j < n; j++) {
        var val = matrix[i][j];
        var display = val != null ? val.toFixed(2) : '—';
        var bg = getColor(val);
        var fg = getTextColor(val);
        html += '<td style="background:' + bg + ';color:' + fg + '" title="' + symbols[i].label + ' vs ' + symbols[j].label + ': ' + display + '">' + display + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';

    container.innerHTML = html;

    var status = el('corr-status');
    if (status) status.textContent = data.dataPoints + ' trading days (' + data.range + ')';
  }

  async function fetchMatrix() {
    if (isLoading) return;
    setLoading(true);
    el('corr-matrix').innerHTML = '';

    try {
      var res = await fetch('/api/correlation?range=' + currentRange);
      if (!res.ok) throw new Error('Failed (' + res.status + ')');
      var data = await res.json();
      renderMatrix(data);
    } catch (err) {
      el('corr-matrix').innerHTML = '<div class="databento-empty">Failed to load correlation data: ' + err.message + '</div>';
    } finally {
      setLoading(false);
    }
  }

  function setRange(range) {
    currentRange = range;
    var btns = document.querySelectorAll('.corr-range-btn');
    btns.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.range === range);
    });
    fetchMatrix();
  }

  function show() {
    document.getElementById('welcome').style.display = 'none';
    document.getElementById('chat-area').classList.remove('visible');
    document.getElementById('analysis-panel').classList.remove('visible');
    document.getElementById('report-panel').classList.remove('visible');
    document.getElementById('quote-panel').classList.remove('visible');
    var kp = document.getElementById('kline-panel');
    if (kp) kp.classList.remove('visible');
    var dp = document.getElementById('databento-panel');
    if (dp) dp.classList.remove('visible');
    var gcp = document.getElementById('groupchat-panel');
    if (gcp) gcp.classList.remove('visible');
    var calp = document.getElementById('calendar-panel');
    if (calp) calp.classList.remove('visible');

    el('corr-panel').classList.add('visible');
    fetchMatrix();
  }

  function hide() {
    el('corr-panel').classList.remove('visible');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var closeBtn = el('corr-close');
    if (closeBtn) closeBtn.addEventListener('click', function () {
      hide();
      document.getElementById('welcome').style.display = '';
    });

    // Range buttons
    document.querySelectorAll('.corr-range-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setRange(btn.dataset.range);
      });
    });
  });

  return { show: show, hide: hide };
})();
