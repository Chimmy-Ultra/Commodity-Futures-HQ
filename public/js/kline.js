/* kline.js — Candlestick chart panel using Lightweight Charts */

var KlineManager = (function () {
  var chart = null;
  var candleSeries = null;
  var volumeSeries = null;
  var currentSymbol = 'ZC=F';
  var currentInterval = '1d';
  var currentRange = '6mo';
  var isLoading = false;

  // Common commodity futures symbols
  var SYMBOLS = [
    { value: 'ZC=F', label: 'Corn (ZC)' },
    { value: 'ZS=F', label: 'Soybeans (ZS)' },
    { value: 'ZW=F', label: 'Wheat (ZW)' },
    { value: 'KC=F', label: 'Coffee (KC)' },
    { value: 'SB=F', label: 'Sugar (SB)' },
    { value: 'CT=F', label: 'Cotton (CT)' },
    { value: 'NG=F', label: 'Natural Gas (NG)' },
    { value: 'CL=F', label: 'WTI Crude (CL)' },
    { value: 'GC=F', label: 'Gold (GC)' },
    { value: 'SI=F', label: 'Silver (SI)' },
    { value: 'PA=F', label: 'Palladium (PA)' },
    { value: 'JPY=X', label: 'USD/JPY' },
    { value: 'DX-Y.NYB', label: 'DXY Index' },
  ];

  var INTERVALS = [
    { value: '1d', label: '1D' },
    { value: '1wk', label: '1W' },
    { value: '1mo', label: '1M' },
  ];

  var RANGES = [
    { value: '1mo', label: '1M' },
    { value: '3mo', label: '3M' },
    { value: '6mo', label: '6M' },
    { value: '1y', label: '1Y' },
    { value: '2y', label: '2Y' },
    { value: '5y', label: '5Y' },
  ];

  function el(id) { return document.getElementById(id); }

  function initChart() {
    if (chart) return;
    var container = el('kline-chart');
    if (!container || typeof LightweightCharts === 'undefined') return;

    chart = LightweightCharts.createChart(container, {
      layout: {
        background: { type: 'solid', color: '#FFFFFF' },
        textColor: '#6B6560',
        fontFamily: 'Inter, sans-serif',
      },
      grid: {
        vertLines: { color: '#F0EDE8' },
        horzLines: { color: '#F0EDE8' },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#E8E5DE',
      },
      timeScale: {
        borderColor: '#E8E5DE',
        timeVisible: false,
      },
    });

    // Lightweight Charts v4+ API
    var addSeries = chart.addCandlestickSeries ? chart.addCandlestickSeries.bind(chart) : function (opts) {
      return chart.addSeries(LightweightCharts.CandlestickSeries, opts);
    };
    var addHistogram = chart.addHistogramSeries ? chart.addHistogramSeries.bind(chart) : function (opts) {
      return chart.addSeries(LightweightCharts.HistogramSeries, opts);
    };

    candleSeries = addSeries({
      upColor: '#2D8A4E',
      downColor: '#C15F3C',
      borderUpColor: '#2D8A4E',
      borderDownColor: '#C15F3C',
      wickUpColor: '#2D8A4E',
      wickDownColor: '#C15F3C',
    });

    volumeSeries = addHistogram({
      color: '#B1ADA1',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // Auto-resize
    var observer = new ResizeObserver(function () {
      if (chart && container.clientWidth > 0) {
        chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
      }
    });
    observer.observe(container);
  }

  function setLoading(v) {
    isLoading = v;
    var loader = el('kline-loader');
    if (loader) loader.style.display = v ? 'flex' : 'none';
  }

  async function fetchData() {
    setLoading(true);
    try {
      var resp = await fetch('/api/kline/' + encodeURIComponent(currentSymbol) + '?interval=' + currentInterval + '&range=' + currentRange);
      var json = await resp.json();
      if (json.error) throw new Error(json.error);

      var candles = (json.data || []).map(function (d) {
        return {
          time: d.time,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        };
      });

      var volumes = (json.data || []).map(function (d) {
        return {
          time: d.time,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(45, 138, 78, 0.3)' : 'rgba(193, 95, 60, 0.3)',
        };
      });

      if (candleSeries) candleSeries.setData(candles);
      if (volumeSeries) volumeSeries.setData(volumes);
      if (chart) chart.timeScale().fitContent();

      el('kline-status').textContent = '';
    } catch (err) {
      el('kline-status').textContent = 'Error: ' + err.message;
    }
    setLoading(false);
  }

  function populateSelects() {
    var symSelect = el('kline-symbol');
    if (!symSelect) return;
    symSelect.innerHTML = '';
    SYMBOLS.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s.value;
      opt.textContent = s.label;
      if (s.value === currentSymbol) opt.selected = true;
      symSelect.appendChild(opt);
    });
  }

  function renderIntervalBtns() {
    var cont = el('kline-intervals');
    if (!cont) return;
    cont.innerHTML = '';
    INTERVALS.forEach(function (iv) {
      var btn = document.createElement('button');
      btn.className = 'kline-interval-btn' + (iv.value === currentInterval ? ' active' : '');
      btn.textContent = iv.label;
      btn.addEventListener('click', function () {
        currentInterval = iv.value;
        renderIntervalBtns();
        fetchData();
      });
      cont.appendChild(btn);
    });
  }

  function renderRangeBtns() {
    var cont = el('kline-ranges');
    if (!cont) return;
    cont.innerHTML = '';
    RANGES.forEach(function (r) {
      var btn = document.createElement('button');
      btn.className = 'kline-interval-btn' + (r.value === currentRange ? ' active' : '');
      btn.textContent = r.label;
      btn.addEventListener('click', function () {
        currentRange = r.value;
        renderRangeBtns();
        fetchData();
      });
      cont.appendChild(btn);
    });
  }

  function show() {
    // Hide other panels
    document.getElementById('welcome').style.display = 'none';
    var chatArea = document.getElementById('chat-area');
    if (chatArea) chatArea.classList.remove('visible');
    var analysisPanel = document.getElementById('analysis-panel');
    if (analysisPanel) analysisPanel.classList.remove('visible');
    var reportPanel = document.getElementById('report-panel');
    if (reportPanel) reportPanel.classList.remove('visible');
    var quotePanel = document.getElementById('quote-panel');
    if (quotePanel) quotePanel.classList.remove('visible');
    var databentoPanel = document.getElementById('databento-panel');
    if (databentoPanel) databentoPanel.classList.remove('visible');

    var panel = document.getElementById('kline-panel');
    if (panel) panel.classList.add('visible');

    initChart();
    populateSelects();
    renderIntervalBtns();
    renderRangeBtns();
    fetchData();
  }

  function hide() {
    var panel = document.getElementById('kline-panel');
    if (panel) panel.classList.remove('visible');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var symSelect = el('kline-symbol');
    if (symSelect) {
      symSelect.addEventListener('change', function () {
        currentSymbol = symSelect.value;
        fetchData();
      });
    }
    var closeBtn = el('kline-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        hide();
        document.getElementById('welcome').style.display = '';
      });
    }
  });

  return { show: show, hide: hide };
})();
