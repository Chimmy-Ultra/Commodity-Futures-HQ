/* bscalc.js — Black-Scholes Options Calculator panel */

var BSCalcManager = (function () {
  /* ---- state ---- */
  var model = 'european';   // 'european' | 'american'
  var optType = 'call';     // 'call' | 'put'
  var spotFetched = null;   // last fetched spot price

  var SYMBOLS = [
    { symbol: 'GC=F', label: 'Gold', tick: 10 },
    { symbol: 'SI=F', label: 'Silver', tick: 0.5 },
    { symbol: 'CL=F', label: 'WTI Crude', tick: 1 },
    { symbol: 'NG=F', label: 'Natural Gas', tick: 0.05 },
    { symbol: 'ZC=F', label: 'Corn', tick: 5 },
    { symbol: 'ZS=F', label: 'Soybeans', tick: 10 },
    { symbol: 'ZW=F', label: 'Wheat', tick: 5 },
    { symbol: 'KC=F', label: 'Coffee', tick: 5 },
    { symbol: 'SB=F', label: 'Sugar', tick: 0.25 },
    { symbol: 'CT=F', label: 'Cotton', tick: 1 },
    { symbol: 'PA=F', label: 'Palladium', tick: 10 },
    { symbol: 'JPY=X', label: 'USD/JPY', tick: 0.5 },
    { symbol: 'DX-Y.NYB', label: 'DXY Index', tick: 0.5 }
  ];

  function el(id) { return document.getElementById(id); }

  function getSymbolTick() {
    var sym = el('bs-symbol').value;
    for (var i = 0; i < SYMBOLS.length; i++) {
      if (SYMBOLS[i].symbol === sym) return SYMBOLS[i].tick;
    }
    return 1;
  }

  // Populate strike dropdown with standard strikes around spot
  function populateStrikes(spotPrice) {
    var sel = el('bs-strike');
    if (!sel) return;
    var tick = getSymbolTick();
    var atm = Math.round(spotPrice / tick) * tick;
    sel.innerHTML = '';

    // Generate ±15 strikes around ATM
    var atmIdx = 0;
    for (var i = -15; i <= 15; i++) {
      var k = atm + i * tick;
      if (k <= 0) continue;
      var opt = document.createElement('option');
      var decimals = tick < 1 ? 2 : 0;
      opt.value = k;
      opt.textContent = k.toFixed(decimals);
      if (i === 0) { opt.textContent += ' (ATM)'; atmIdx = sel.options.length; }
      sel.appendChild(opt);
    }
    sel.selectedIndex = atmIdx;
  }

  /* ================================================================
     MATH — Normal distribution
     ================================================================ */
  function normPDF(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  // Abramowitz & Stegun approximation (|error| < 7.5e-8)
  function normCDF(x) {
    if (x > 8) return 1;
    if (x < -8) return 0;
    var neg = x < 0;
    if (neg) x = -x;
    var k = 1 / (1 + 0.2316419 * x);
    var k2 = k * k;
    var k3 = k2 * k;
    var k4 = k3 * k;
    var k5 = k4 * k;
    var cdf = 1 - normPDF(x) * (0.319381530 * k - 0.356563782 * k2 + 1.781477937 * k3 - 1.821255978 * k4 + 1.330274429 * k5);
    return neg ? 1 - cdf : cdf;
  }

  /* ================================================================
     MATH — European Black-Scholes
     ================================================================ */
  function bsEuropean(S, K, T, r, sigma, type) {
    if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) return { price: 0, delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 };

    var sqrtT = Math.sqrt(T);
    var d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
    var d2 = d1 - sigma * sqrtT;
    var Nd1 = normCDF(d1);
    var Nd2 = normCDF(d2);
    var Nnd1 = normCDF(-d1);
    var Nnd2 = normCDF(-d2);
    var nd1 = normPDF(d1);
    var disc = Math.exp(-r * T);

    var price, delta, theta, rho;
    if (type === 'call') {
      price = S * Nd1 - K * disc * Nd2;
      delta = Nd1;
      theta = (-S * nd1 * sigma / (2 * sqrtT) - r * K * disc * Nd2) / 365;
      rho = K * T * disc * Nd2 / 100;
    } else {
      price = K * disc * Nnd2 - S * Nnd1;
      delta = Nd1 - 1;
      theta = (-S * nd1 * sigma / (2 * sqrtT) + r * K * disc * Nnd2) / 365;
      rho = -K * T * disc * Nnd2 / 100;
    }

    var gamma = nd1 / (S * sigma * sqrtT);
    var vega = S * nd1 * sqrtT / 100;

    return { price: price, delta: delta, gamma: gamma, vega: vega, theta: theta, rho: rho };
  }

  /* ================================================================
     MATH — American (CRR Binomial Tree, 200 steps)
     ================================================================ */
  function bsAmerican(S, K, T, r, sigma, type) {
    if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) return { price: 0, delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 };

    var N = 200;
    var dt = T / N;
    var u = Math.exp(sigma * Math.sqrt(dt));
    var d = 1 / u;
    var p = (Math.exp(r * dt) - d) / (u - d);
    var disc = Math.exp(-r * dt);
    var isCall = type === 'call';

    // Build price tree at maturity
    var prices = new Array(N + 1);
    for (var i = 0; i <= N; i++) {
      var ST = S * Math.pow(u, N - i) * Math.pow(d, i);
      prices[i] = isCall ? Math.max(ST - K, 0) : Math.max(K - ST, 0);
    }

    // Backward induction
    // Save values at step 1 and 2 for Greeks
    var step2 = null;
    var step1 = null;
    for (var j = N - 1; j >= 0; j--) {
      for (var i = 0; i <= j; i++) {
        var hold = disc * (p * prices[i] + (1 - p) * prices[i + 1]);
        var ST2 = S * Math.pow(u, j - i) * Math.pow(d, i);
        var exercise = isCall ? Math.max(ST2 - K, 0) : Math.max(K - ST2, 0);
        prices[i] = Math.max(hold, exercise);
      }
      if (j === 2) step2 = [prices[0], prices[1], prices[2]];
      if (j === 1) step1 = [prices[0], prices[1]];
    }

    var price = prices[0];

    // Greeks from tree
    var Su = S * u;
    var Sd = S * d;
    var delta = (step1[0] - step1[1]) / (Su - Sd);

    var Suu = S * u * u;
    var Sdd = S * d * d;
    var deltaUp = (step2[0] - step2[1]) / (Suu - S);
    var deltaDn = (step2[1] - step2[2]) / (S - Sdd);
    var gamma = (deltaUp - deltaDn) / (0.5 * (Suu - Sdd));

    var theta = (step2[1] - price) / (2 * dt) / 365;

    // Vega & Rho by finite difference
    var bumpSig = 0.01;
    var priceUp = bsAmerican_price(S, K, T, r, sigma + bumpSig, type, N);
    var priceDn = bsAmerican_price(S, K, T, r, sigma - bumpSig, type, N);
    var vega = (priceUp - priceDn) / (2 * bumpSig) / 100;

    var bumpR = 0.0001;
    var priceRUp = bsAmerican_price(S, K, T, r + bumpR, sigma, type, N);
    var priceRDn = bsAmerican_price(S, K, T, r - bumpR, sigma, type, N);
    var rho = (priceRUp - priceRDn) / (2 * bumpR) / 100;

    return { price: price, delta: delta, gamma: gamma, vega: vega, theta: theta, rho: rho };
  }

  // Simplified binomial for bump calculations (price only, fewer steps)
  function bsAmerican_price(S, K, T, r, sigma, type, N) {
    if (!N) N = 100;
    var dt = T / N;
    var u = Math.exp(sigma * Math.sqrt(dt));
    var d = 1 / u;
    var p = (Math.exp(r * dt) - d) / (u - d);
    var disc = Math.exp(-r * dt);
    var isCall = type === 'call';

    var prices = new Array(N + 1);
    for (var i = 0; i <= N; i++) {
      var ST = S * Math.pow(u, N - i) * Math.pow(d, i);
      prices[i] = isCall ? Math.max(ST - K, 0) : Math.max(K - ST, 0);
    }
    for (var j = N - 1; j >= 0; j--) {
      for (var i = 0; i <= j; i++) {
        var hold = disc * (p * prices[i] + (1 - p) * prices[i + 1]);
        var ST2 = S * Math.pow(u, j - i) * Math.pow(d, i);
        var exercise = isCall ? Math.max(ST2 - K, 0) : Math.max(K - ST2, 0);
        prices[i] = Math.max(hold, exercise);
      }
    }
    return prices[0];
  }

  /* ================================================================
     CALCULATE — main entry
     ================================================================ */
  function getParams() {
    var S = parseFloat(el('bs-spot').value) || 0;
    var K = parseFloat(el('bs-strike').value) || 0;
    var sigma = (parseFloat(el('bs-vol').value) || 0) / 100;
    var r = (parseFloat(el('bs-rate').value) || 0) / 100;

    // Time from expiry date
    var expiryStr = el('bs-expiry').value;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var expiry = new Date(expiryStr);
    var diffDays = Math.max((expiry - today) / (1000 * 60 * 60 * 24), 0);
    var T = diffDays / 365;

    return { S: S, K: K, T: T, r: r, sigma: sigma, diffDays: diffDays };
  }

  function calculate() {
    var p = getParams();
    if (p.S <= 0 || p.K <= 0 || p.T <= 0 || p.sigma <= 0) {
      renderResult({ price: 0, delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 }, p);
      drawChart();
      return;
    }

    var result;
    if (model === 'european') {
      result = bsEuropean(p.S, p.K, p.T, p.r, p.sigma, optType);
    } else {
      result = bsAmerican(p.S, p.K, p.T, p.r, p.sigma, optType);
    }

    renderResult(result, p);
    drawChart();
  }

  /* ================================================================
     RENDER RESULT
     ================================================================ */
  function renderResult(res, params) {
    el('bs-price-val').textContent = res.price.toFixed(4);

    // Distance from spot
    var pct = params.S > 0 ? ((params.K - params.S) / params.S * 100) : 0;
    var pctEl = el('bs-dist-val');
    var sign = pct >= 0 ? '+' : '';
    pctEl.textContent = sign + pct.toFixed(2) + '%';
    pctEl.className = 'bs-dist-value ' + (pct > 0 ? 'otm' : pct < 0 ? 'itm' : '');

    // Moneyness label
    var moneyLabel = '';
    if (optType === 'call') {
      moneyLabel = params.K < params.S ? 'ITM' : params.K > params.S ? 'OTM' : 'ATM';
    } else {
      moneyLabel = params.K > params.S ? 'ITM' : params.K < params.S ? 'OTM' : 'ATM';
    }
    el('bs-moneyness').textContent = moneyLabel;

    // Greeks
    el('bs-delta').textContent = res.delta.toFixed(4);
    el('bs-gamma').textContent = res.gamma.toFixed(4);
    el('bs-vega').textContent = res.vega.toFixed(4);
    el('bs-theta').textContent = res.theta.toFixed(4);
    el('bs-rho').textContent = res.rho.toFixed(4);

    // DTE
    el('bs-dte').textContent = Math.round(params.diffDays) + ' days';
  }

  /* ================================================================
     FETCH SPOT PRICE
     ================================================================ */
  async function fetchSpot() {
    var sym = el('bs-symbol').value;
    if (!sym) return;
    var btn = el('bs-fetch-spot');
    btn.textContent = '...';
    btn.disabled = true;
    try {
      var res = await fetch('/api/kline/' + encodeURIComponent(sym) + '?interval=1d&range=1mo');
      if (!res.ok) throw new Error('Failed');
      var data = await res.json();
      var arr = data.data || data.candles || [];
      if (arr.length > 0) {
        var last = arr[arr.length - 1];
        var price = last.close;
        spotFetched = price;
        el('bs-spot').value = price.toFixed(2);
        populateStrikes(price);
        calculate();
      }
    } catch (e) {
      // silently fail
    } finally {
      btn.textContent = 'Fetch';
      btn.disabled = false;
    }
  }

  /* ================================================================
     CHART DRAWING — Canvas 2D
     ================================================================ */
  function drawChart() {
    drawPayoff();
    drawGreeks();
    drawHeatmap();
  }

  function getCanvas(canvasId) {
    var c = el(canvasId);
    if (!c) return null;
    var w = c.clientWidth;
    var h = c.clientHeight;
    if (w <= 0 || h <= 0) return null;
    var dpr = window.devicePixelRatio || 1;
    c.width = w * dpr;
    c.height = h * dpr;
    var ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  // --- Grid helper ---
  function drawGrid(ctx, pad, w, h, xMin, xMax, yMin, yMax, xTicks, yTicks) {
    ctx.save();
    ctx.strokeStyle = 'rgba(150,150,150,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    var pw = w - pad.left - pad.right;
    var ph = h - pad.top - pad.bottom;
    // Vertical grid lines
    for (var i = 0; i <= xTicks; i++) {
      var x = pad.left + i * pw / xTicks;
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, h - pad.bottom);
      ctx.stroke();
    }
    // Horizontal grid lines
    for (var i = 0; i <= yTicks; i++) {
      var y = pad.top + i * ph / yTicks;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // --- Payoff diagram ---
  function drawPayoff() {
    var cv = getCanvas('bs-canvas-payoff');
    if (!cv) return;
    var ctx = cv.ctx, w = cv.w, h = cv.h;
    var p = getParams();
    if (p.S <= 0 || p.K <= 0) return;

    var pad = { top: 30, right: 30, bottom: 40, left: 60 };
    var pw = w - pad.left - pad.right;
    var ph = h - pad.top - pad.bottom;

    // X range: ±2.5 std deviations (dynamic, based on σ and T)
    var stdMove = p.S * p.sigma * Math.sqrt(Math.max(p.T, 1/365)) * 2.5;
    var xMin = Math.max(p.K - stdMove, p.K * 0.5);
    var xMax = p.K + stdMove;
    var steps = 200;
    var dx = (xMax - xMin) / steps;

    // Compute payoff and theoretical values
    var payoffs = [];
    var theories = [];
    var yMin = Infinity, yMax = -Infinity;

    for (var i = 0; i <= steps; i++) {
      var sx = xMin + i * dx;
      // Payoff at expiry
      var pf;
      if (optType === 'call') pf = Math.max(sx - p.K, 0);
      else pf = Math.max(p.K - sx, 0);
      // Subtract premium
      var premium;
      if (model === 'european') premium = bsEuropean(p.S, p.K, p.T, p.r, p.sigma, optType).price;
      else premium = bsAmerican(p.S, p.K, p.T, p.r, p.sigma, optType).price;
      payoffs.push(pf - premium);

      // Current theoretical value
      var tv;
      if (model === 'european') tv = bsEuropean(sx, p.K, p.T, p.r, p.sigma, optType).price;
      else tv = bsAmerican_price(sx, p.K, p.T, p.r, p.sigma, optType);
      theories.push(tv - premium);

      yMin = Math.min(yMin, pf - premium, tv - premium);
      yMax = Math.max(yMax, pf - premium, tv - premium);
    }

    // Add margin
    var yRange = yMax - yMin || 1;
    yMin -= yRange * 0.1;
    yMax += yRange * 0.1;

    function toX(v) { return pad.left + (v - xMin) / (xMax - xMin) * pw; }
    function toY(v) { return pad.top + (1 - (v - yMin) / (yMax - yMin)) * ph; }

    // Grid
    drawGrid(ctx, pad, w, h, xMin, xMax, yMin, yMax, 3, 4);
    // Zero line
    if (yMin < 0 && yMax > 0) {
      ctx.strokeStyle = 'rgba(150,150,150,0.4)';
      ctx.beginPath();
      ctx.moveTo(pad.left, toY(0));
      ctx.lineTo(w - pad.right, toY(0));
      ctx.stroke();
    }
    // Strike line
    ctx.strokeStyle = 'rgba(150,150,150,0.3)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(toX(p.K), pad.top);
    ctx.lineTo(toX(p.K), h - pad.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = '#999';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    // X axis labels
    var xTicks = 3;
    for (var i = 0; i <= xTicks; i++) {
      var v = xMin + (xMax - xMin) * i / xTicks;
      ctx.fillText(v.toFixed(0), toX(v), h - pad.bottom + 16);
    }
    // Y axis labels
    ctx.textAlign = 'right';
    var yTicks = 4;
    for (var i = 0; i <= yTicks; i++) {
      var v = yMin + (yMax - yMin) * i / yTicks;
      ctx.fillText(v.toFixed(1), pad.left - 8, toY(v) + 4);
    }

    // Strike label
    ctx.textAlign = 'center';
    ctx.fillStyle = '#888';
    ctx.fillText('K=' + p.K.toFixed(0), toX(p.K), pad.top - 8);

    // Draw payoff line (at expiry)
    ctx.strokeStyle = 'rgba(255,107,107,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var i = 0; i <= steps; i++) {
      var x = toX(xMin + i * dx);
      var y = toY(payoffs[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw theoretical value (before expiry)
    ctx.strokeStyle = 'rgba(78,205,196,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (var i = 0; i <= steps; i++) {
      var x = toX(xMin + i * dx);
      var y = toY(theories[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Spot marker
    if (p.S >= xMin && p.S <= xMax) {
      ctx.fillStyle = '#ffd93d';
      ctx.beginPath();
      ctx.arc(toX(p.S), toY(theories[Math.round((p.S - xMin) / dx)] || 0), 5, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Legend
    ctx.font = '11px Inter, sans-serif';
    var lx = pad.left + 10;
    var ly = pad.top + 14;
    ctx.fillStyle = 'rgba(78,205,196,0.9)';
    ctx.fillRect(lx, ly - 8, 16, 3);
    ctx.fillStyle = '#ccc';
    ctx.textAlign = 'left';
    ctx.fillText('Theoretical P&L', lx + 22, ly);
    ly += 18;
    ctx.fillStyle = 'rgba(255,107,107,0.8)';
    ctx.fillRect(lx, ly - 8, 16, 3);
    ctx.fillStyle = '#ccc';
    ctx.fillText('Payoff at Expiry', lx + 22, ly);

    // Axis titles
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.fillText('Underlying Price', pad.left + pw / 2, h - 4);
  }

  // --- Greeks charts (2x2 grid) ---
  function drawGreeks() {
    var cv = getCanvas('bs-canvas-greeks');
    if (!cv) return;
    var ctx = cv.ctx, w = cv.w, h = cv.h;
    var p = getParams();
    if (p.S <= 0 || p.K <= 0 || p.T <= 0 || p.sigma <= 0) return;

    var greekList = ['delta', 'gamma', 'vega', 'theta'];
    var colors = ['#4ecdc4', '#ff6b6b', '#ffd93d', '#a78bfa'];
    var cols = 2, rows = 2;
    var cellW = w / cols;
    var cellH = h / rows;
    var pad = { top: 28, right: 14, bottom: 28, left: 50 };

    var stdMove2 = p.S * p.sigma * Math.sqrt(Math.max(p.T, 1/365)) * 2.5;
    var xMin = Math.max(p.K - stdMove2, p.K * 0.5);
    var xMax = p.K + stdMove2;
    var steps = 100;
    var dx = (xMax - xMin) / steps;

    for (var gi = 0; gi < greekList.length; gi++) {
      var gname = greekList[gi];
      var col = gi % cols;
      var row = Math.floor(gi / cols);
      var ox = col * cellW;
      var oy = row * cellH;
      var pw2 = cellW - pad.left - pad.right;
      var ph2 = cellH - pad.top - pad.bottom;

      // Compute values
      var vals = [];
      var yMin2 = Infinity, yMax2 = -Infinity;
      for (var i = 0; i <= steps; i++) {
        var sx = xMin + i * dx;
        var res2;
        if (model === 'european') res2 = bsEuropean(sx, p.K, p.T, p.r, p.sigma, optType);
        else res2 = bsAmerican(sx, p.K, p.T, p.r, p.sigma, optType);
        var v = res2[gname];
        vals.push(v);
        if (v < yMin2) yMin2 = v;
        if (v > yMax2) yMax2 = v;
      }

      var yRange2 = yMax2 - yMin2 || 0.01;
      yMin2 -= yRange2 * 0.1;
      yMax2 += yRange2 * 0.1;

      function toX2(v) { return ox + pad.left + (v - xMin) / (xMax - xMin) * pw2; }
      function toY2(v) { return oy + pad.top + (1 - (v - yMin2) / (yMax2 - yMin2)) * ph2; }

      // Border
      ctx.strokeStyle = 'rgba(150,150,150,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(ox + 0.5, oy + 0.5, cellW - 1, cellH - 1);

      // Sub-chart grid
      ctx.save();
      ctx.strokeStyle = 'rgba(150,150,150,0.12)';
      ctx.setLineDash([4, 4]);
      for (var gi2 = 1; gi2 < 3; gi2++) {
        var gx = ox + pad.left + gi2 * pw2 / 3;
        ctx.beginPath(); ctx.moveTo(gx, oy + pad.top); ctx.lineTo(gx, oy + cellH - pad.bottom); ctx.stroke();
        var gy = oy + pad.top + gi2 * ph2 / 3;
        ctx.beginPath(); ctx.moveTo(ox + pad.left, gy); ctx.lineTo(ox + cellW - pad.right, gy); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();

      // Title
      ctx.fillStyle = colors[gi];
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(gname.charAt(0).toUpperCase() + gname.slice(1), ox + pad.left, oy + 16);

      // Zero line
      if (yMin2 < 0 && yMax2 > 0) {
        ctx.strokeStyle = 'rgba(150,150,150,0.3)';
        ctx.beginPath();
        ctx.moveTo(ox + pad.left, toY2(0));
        ctx.lineTo(ox + cellW - pad.right, toY2(0));
        ctx.stroke();
      }

      // Y axis labels
      ctx.fillStyle = '#888';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      for (var ti = 0; ti <= 2; ti++) {
        var v2 = yMin2 + (yMax2 - yMin2) * ti / 2;
        ctx.fillText(v2.toFixed(3), ox + pad.left - 4, toY2(v2) + 3);
      }

      // X axis labels
      ctx.textAlign = 'center';
      ctx.font = '9px JetBrains Mono, monospace';
      for (var ti = 0; ti <= 2; ti++) {
        var v3 = xMin + (xMax - xMin) * ti / 2;
        ctx.fillText(v3.toFixed(0), toX2(v3), oy + cellH - pad.bottom + 12);
      }

      // Draw line
      ctx.strokeStyle = colors[gi];
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (var i = 0; i <= steps; i++) {
        var x2 = toX2(xMin + i * dx);
        var y2 = toY2(vals[i]);
        if (i === 0) ctx.moveTo(x2, y2);
        else ctx.lineTo(x2, y2);
      }
      ctx.stroke();

      // Spot marker
      if (p.S >= xMin && p.S <= xMax) {
        var idx = Math.round((p.S - xMin) / dx);
        if (idx >= 0 && idx <= steps) {
          ctx.fillStyle = '#ffd93d';
          ctx.beginPath();
          ctx.arc(toX2(p.S), toY2(vals[idx]), 4, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
  }

  // --- P&L Heatmap ---
  function drawHeatmap() {
    var cv = getCanvas('bs-canvas-heatmap');
    if (!cv) return;
    var ctx = cv.ctx, w = cv.w, h = cv.h;
    var p = getParams();
    if (p.S <= 0 || p.K <= 0 || p.T <= 0 || p.sigma <= 0) return;

    var pad = { top: 30, right: 70, bottom: 40, left: 60 };
    var pw3 = w - pad.left - pad.right;
    var ph3 = h - pad.top - pad.bottom;

    // X: spot price range based on ±2.5 std deviations
    var stdMove3 = p.S * p.sigma * Math.sqrt(Math.max(p.T, 1/365)) * 2.5;
    var xMin3 = Math.max(p.K - stdMove3, p.K * 0.5);
    var xMax3 = p.K + stdMove3;
    var yMin3 = Math.max(p.sigma * 0.3, 0.01);
    var yMax3 = p.sigma * 2;

    var xSteps = 60;
    var ySteps = 40;
    var cellW = pw3 / xSteps;
    var cellH = ph3 / ySteps;

    // Current option price (premium paid)
    var premium;
    if (model === 'european') premium = bsEuropean(p.S, p.K, p.T, p.r, p.sigma, optType).price;
    else premium = bsAmerican_price(p.S, p.K, p.T, p.r, p.sigma, optType);

    // Compute P&L grid
    var pnlMin = Infinity, pnlMax = -Infinity;
    var grid = [];
    for (var yi = 0; yi < ySteps; yi++) {
      grid[yi] = [];
      var vol = yMin3 + (yMax3 - yMin3) * (ySteps - 1 - yi) / (ySteps - 1);
      for (var xi = 0; xi < xSteps; xi++) {
        var spot = xMin3 + (xMax3 - xMin3) * xi / (xSteps - 1);
        var val;
        if (model === 'european') val = bsEuropean(spot, p.K, p.T, p.r, vol, optType).price;
        else val = bsAmerican_price(spot, p.K, p.T, p.r, vol, optType);
        var pnl = val - premium;
        grid[yi][xi] = pnl;
        if (pnl < pnlMin) pnlMin = pnl;
        if (pnl > pnlMax) pnlMax = pnl;
      }
    }

    // Draw cells
    for (var yi = 0; yi < ySteps; yi++) {
      for (var xi = 0; xi < xSteps; xi++) {
        var pnl = grid[yi][xi];
        var color = heatmapColor(pnl, pnlMin, pnlMax);
        ctx.fillStyle = color;
        ctx.fillRect(pad.left + xi * cellW, pad.top + yi * cellH, cellW + 1, cellH + 1);
      }
    }

    // Grid overlay on heatmap
    drawGrid(ctx, pad, w, h, xMin3, xMax3, yMin3, yMax3, 3, 3);

    // Axes labels
    ctx.fillStyle = '#999';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    var xTicks3 = 3;
    for (var i = 0; i <= xTicks3; i++) {
      var v = xMin3 + (xMax3 - xMin3) * i / xTicks3;
      ctx.fillText(v.toFixed(0), pad.left + i * pw3 / xTicks3, h - pad.bottom + 14);
    }
    ctx.textAlign = 'right';
    var yTicks3 = 3;
    for (var i = 0; i <= yTicks3; i++) {
      var vol = yMin3 + (yMax3 - yMin3) * i / yTicks3;
      ctx.fillText((vol * 100).toFixed(0) + '%', pad.left - 6, pad.top + (1 - i / yTicks3) * ph3 + 4);
    }

    // Current position marker
    var curX = pad.left + (p.S - xMin3) / (xMax3 - xMin3) * pw3;
    var curY = pad.top + (1 - (p.sigma - yMin3) / (yMax3 - yMin3)) * ph3;
    if (curX >= pad.left && curX <= w - pad.right && curY >= pad.top && curY <= h - pad.bottom) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(curX, curY, 6, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(curX - 8, curY);
      ctx.lineTo(curX + 8, curY);
      ctx.moveTo(curX, curY - 8);
      ctx.lineTo(curX, curY + 8);
      ctx.stroke();
    }

    // Color bar
    var barX = w - pad.right + 14;
    var barW = 14;
    var barH = ph3;
    for (var i = 0; i < barH; i++) {
      var val = pnlMax - (pnlMax - pnlMin) * i / barH;
      ctx.fillStyle = heatmapColor(val, pnlMin, pnlMax);
      ctx.fillRect(barX, pad.top + i, barW, 1);
    }
    ctx.fillStyle = '#999';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('+' + pnlMax.toFixed(1), barX + barW + 4, pad.top + 10);
    ctx.fillText(pnlMin.toFixed(1), barX + barW + 4, pad.top + barH);
    ctx.fillText('0', barX + barW + 4, pad.top + (1 - (0 - pnlMin) / (pnlMax - pnlMin)) * barH + 4);

    // Axis titles
    ctx.fillStyle = '#888';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Underlying Price', pad.left + pw3 / 2, h - 4);
    ctx.save();
    ctx.translate(12, pad.top + ph3 / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Volatility', 0, 0);
    ctx.restore();
  }

  function heatmapColor(val, min, max) {
    if (max === min) return 'rgb(50,50,50)';
    // Normalize to [-1, 1] where 0 = breakeven
    var range = Math.max(Math.abs(min), Math.abs(max));
    var norm = range > 0 ? val / range : 0;
    norm = Math.max(-1, Math.min(1, norm));

    if (norm >= 0) {
      // Green gradient
      var t = norm;
      var r = Math.round(30 + (1 - t) * 30);
      var g = Math.round(80 + t * 150);
      var b = Math.round(30 + (1 - t) * 30);
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    } else {
      // Red gradient
      var t = -norm;
      var r = Math.round(80 + t * 150);
      var g = Math.round(30 + (1 - t) * 30);
      var b = Math.round(30 + (1 - t) * 30);
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }
  }

  /* ================================================================
     SHOW / HIDE
     ================================================================ */
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
    var cp = document.getElementById('corr-panel');
    if (cp) cp.classList.remove('visible');
    var calp = document.getElementById('calendar-panel');
    if (calp) calp.classList.remove('visible');
    var gcp = document.getElementById('groupchat-panel');
    if (gcp) gcp.classList.remove('visible');

    el('bscalc-panel').classList.add('visible');
    calculate();
    // Redraw chart after panel is visible (so canvas gets correct size)
    setTimeout(function () { drawChart(); }, 50);
  }

  function hide() {
    el('bscalc-panel').classList.remove('visible');
  }

  /* ================================================================
     INIT — DOMContentLoaded
     ================================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    // Populate symbol dropdown
    var sel = el('bs-symbol');
    if (sel) {
      SYMBOLS.forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s.symbol;
        opt.textContent = s.symbol.replace('=F', '').replace('=X', '') + ' — ' + s.label;
        sel.appendChild(opt);
      });
    }

    // Populate initial strikes for default spot
    populateStrikes(100);

    // Set default expiry to +30 days
    var expInput = el('bs-expiry');
    if (expInput) {
      var d30 = new Date();
      d30.setDate(d30.getDate() + 30);
      expInput.value = d30.toISOString().split('T')[0];
    }

    // Expiry slider
    var slider = el('bs-expiry-slider');
    if (slider && expInput) {
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      slider.min = 1;
      slider.max = 365;
      slider.value = 30;
      slider.addEventListener('input', function () {
        var d = new Date(today);
        d.setDate(d.getDate() + parseInt(slider.value));
        expInput.value = d.toISOString().split('T')[0];
        el('bs-dte').textContent = slider.value + ' days';
        calculate();
      });
      expInput.addEventListener('change', function () {
        var ed = new Date(expInput.value);
        var diff = Math.max(Math.round((ed - today) / (1000 * 60 * 60 * 24)), 1);
        slider.value = Math.min(diff, 365);
        calculate();
      });
    }

    // Model toggle
    document.querySelectorAll('.bs-model-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        model = btn.dataset.model;
        document.querySelectorAll('.bs-model-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        calculate();
      });
    });

    // Type toggle
    document.querySelectorAll('.bs-type-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        optType = btn.dataset.type;
        document.querySelectorAll('.bs-type-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        calculate();
      });
    });

    // Input listeners — recalculate on change
    ['bs-spot', 'bs-vol', 'bs-rate'].forEach(function (id) {
      var inp = el(id);
      if (inp) inp.addEventListener('input', calculate);
    });
    // Strike is a select — use change event
    var strikeEl = el('bs-strike');
    if (strikeEl) strikeEl.addEventListener('change', calculate);

    // When spot changes manually, repopulate strikes
    var spotEl = el('bs-spot');
    if (spotEl) spotEl.addEventListener('change', function () {
      var v = parseFloat(spotEl.value);
      if (v > 0) populateStrikes(v);
      calculate();
    });

    // Fetch spot button
    var fetchBtn = el('bs-fetch-spot');
    if (fetchBtn) fetchBtn.addEventListener('click', fetchSpot);

    // Symbol change
    if (sel) sel.addEventListener('change', fetchSpot);

    // Close button
    var closeBtn = el('bscalc-close');
    if (closeBtn) closeBtn.addEventListener('click', function () {
      hide();
      document.getElementById('welcome').style.display = '';
    });

    // Resize handler
    window.addEventListener('resize', function () {
      if (el('bscalc-panel').classList.contains('visible')) {
        drawChart();
      }
    });
  });

  return { show: show, hide: hide };
})();
