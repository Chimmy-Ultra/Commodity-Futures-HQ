/* bscalc.js — Options Strategy Calculator panel */

var BSCalcManager = (function () {
  /* ---- state ---- */
  var model = 'european';        // 'european' | 'american'
  var strategy = 'single_call';  // current strategy key
  var legs = [];                 // [{type:'call'|'put', K:number, dir:1|-1, qty:1}]
  var spotFetched = null;

  var SYMBOLS = [
    { symbol: 'GC=F',      label: 'Gold',        tick: 0.10,  decimals: 2 },
    { symbol: 'SI=F',      label: 'Silver',       tick: 0.005, decimals: 2 },
    { symbol: 'CL=F',      label: 'WTI Crude',    tick: 0.01,  decimals: 2 },
    { symbol: 'NG=F',      label: 'Natural Gas',  tick: 0.001, decimals: 4 },
    { symbol: 'ZC=F',      label: 'Corn',         tick: 0.25,  decimals: 2 },
    { symbol: 'ZS=F',      label: 'Soybeans',     tick: 0.25,  decimals: 2 },
    { symbol: 'ZW=F',      label: 'Wheat',        tick: 0.25,  decimals: 2 },
    { symbol: 'KC=F',      label: 'Coffee',       tick: 0.05,  decimals: 2 },
    { symbol: 'SB=F',      label: 'Sugar',        tick: 0.01,  decimals: 2 },
    { symbol: 'CT=F',      label: 'Cotton',       tick: 0.01,  decimals: 2 },
    { symbol: 'PA=F',      label: 'Palladium',    tick: 0.50,  decimals: 2 },
    { symbol: 'JPY=X',     label: 'USD/JPY',      tick: 0.01,  decimals: 4 },
    { symbol: 'DX-Y.NYB',  label: 'DXY Index',    tick: 0.005, decimals: 2 },
    { symbol: '^TWII',     label: 'TAIEX 台指',   tick: 50,    decimals: 0 }
  ];

  var STRATEGIES = {
    /* --- Single Legs --- */
    single_call:    { label: 'Long Call',           fn: function(a,t){ return [{type:'call', K:a, dir:1, qty:1}]; }},
    single_put:     { label: 'Long Put',            fn: function(a,t){ return [{type:'put',  K:a, dir:1, qty:1}]; }},
    short_call:     { label: 'Short Call',           fn: function(a,t){ return [{type:'call', K:a, dir:-1, qty:1}]; }},
    short_put:      { label: 'Short Put',            fn: function(a,t){ return [{type:'put',  K:a, dir:-1, qty:1}]; }},
    /* --- Vertical Spreads --- */
    bull_call:      { label: 'Bull Call Spread',   fn: function(a,t){ return [{type:'call', K:a, dir:1, qty:1},{type:'call', K:a+2*t, dir:-1, qty:1}]; }},
    bear_put:       { label: 'Bear Put Spread',    fn: function(a,t){ return [{type:'put',  K:a, dir:1, qty:1},{type:'put',  K:a-2*t, dir:-1, qty:1}]; }},
    bear_call:      { label: 'Bear Call Spread',   fn: function(a,t){ return [{type:'call', K:a, dir:-1, qty:1},{type:'call', K:a+2*t, dir:1, qty:1}]; }},
    bull_put:       { label: 'Bull Put Spread',    fn: function(a,t){ return [{type:'put',  K:a, dir:-1, qty:1},{type:'put',  K:a-2*t, dir:1, qty:1}]; }},
    /* --- Straddles & Strangles --- */
    straddle:       { label: 'Long Straddle',      fn: function(a,t){ return [{type:'call', K:a, dir:1, qty:1},{type:'put',  K:a, dir:1, qty:1}]; }},
    short_straddle: { label: 'Short Straddle',     fn: function(a,t){ return [{type:'call', K:a, dir:-1, qty:1},{type:'put', K:a, dir:-1, qty:1}]; }},
    strangle:       { label: 'Long Strangle',      fn: function(a,t){ return [{type:'call', K:a+2*t, dir:1, qty:1},{type:'put', K:a-2*t, dir:1, qty:1}]; }},
    short_strangle: { label: 'Short Strangle',     fn: function(a,t){ return [{type:'call', K:a+2*t, dir:-1, qty:1},{type:'put', K:a-2*t, dir:-1, qty:1}]; }},
    /* --- Iron & Butterfly --- */
    iron_condor:    { label: 'Iron Condor',        fn: function(a,t){ return [
      {type:'put', K:a-4*t, dir:1, qty:1},{type:'put', K:a-2*t, dir:-1, qty:1},
      {type:'call', K:a+2*t, dir:-1, qty:1},{type:'call', K:a+4*t, dir:1, qty:1}
    ]; }},
    iron_butterfly: { label: 'Iron Butterfly',     fn: function(a,t){ return [
      {type:'put', K:a-2*t, dir:1, qty:1},{type:'put', K:a, dir:-1, qty:1},
      {type:'call', K:a, dir:-1, qty:1},{type:'call', K:a+2*t, dir:1, qty:1}
    ]; }},
    butterfly:      { label: 'Butterfly',          fn: function(a,t){ return [
      {type:'call', K:a-2*t, dir:1, qty:1},{type:'call', K:a, dir:-1, qty:2},
      {type:'call', K:a+2*t, dir:1, qty:1}
    ]; }},
    /* --- With Underlying --- */
    covered_call:   { label: 'Covered Call',       fn: function(a,t){ return [{type:'call', K:a+2*t, dir:-1, qty:1}]; }, hasUnderlying: true },
    protective_put: { label: 'Protective Put',     fn: function(a,t){ return [{type:'put',  K:a-2*t, dir:1, qty:1}]; }, hasUnderlying: true },
    collar:         { label: 'Collar',             fn: function(a,t){ return [{type:'put', K:a-2*t, dir:1, qty:1},{type:'call', K:a+2*t, dir:-1, qty:1}]; }, hasUnderlying: true }
  };

  function el(id) { return document.getElementById(id); }

  function getSymbolTick() {
    var sym = el('bs-symbol').value;
    for (var i = 0; i < SYMBOLS.length; i++) {
      if (SYMBOLS[i].symbol === sym) return SYMBOLS[i].tick;
    }
    return 1;
  }

  function getATM() {
    var spot = parseFloat(el('bs-spot').value) || 100;
    var tick = getSymbolTick();
    return Math.round(spot / tick) * tick;
  }

  /* ================================================================
     STRATEGY & LEGS
     ================================================================ */
  function applyStrategy() {
    var tick = getSymbolTick();
    var atm = getATM();
    var strat = STRATEGIES[strategy];
    if (!strat) return;
    legs = strat.fn(atm, tick);
    // Auto-fill BS premium for each leg (user can override)
    var p = getParams();
    if (p.S > 0 && p.T > 0 && p.sigma > 0) {
      for (var i = 0; i < legs.length; i++) {
        legs[i].premium = priceOnly(p.S, legs[i].K, p.T, p.r, p.sigma, legs[i].type);
        legs[i].premiumManual = false;
      }
    }
    renderLegsTable();
    calculate();
  }

  function renderLegsTable() {
    var container = el('bs-legs-container');
    if (!container) return;
    var tick = getSymbolTick();
    var decimals = tick < 1 ? 2 : 0;
    var spot = parseFloat(el('bs-spot').value) || 100;
    var atm = Math.round(spot / tick) * tick;

    var html = '';
    for (var i = 0; i < legs.length; i++) {
      var leg = legs[i];
      var typeCls = leg.type === 'call' ? 'bs-leg-call' : 'bs-leg-put';
      var dirCls = leg.dir > 0 ? 'bs-leg-long' : 'bs-leg-short';
      var dirLabel = leg.dir > 0 ? '\u25B2 Long' : '\u25BC Short';

      // Build datalist options (suggestions)
      var dlId = 'bs-strike-dl-' + i;
      var opts = '';
      for (var j = -15; j <= 15; j++) {
        var k = atm + j * tick;
        if (k <= 0) continue;
        opts += '<option value="' + k.toFixed(decimals) + '">';
      }

      var premVal = (leg.premium != null) ? leg.premium.toFixed(2) : '';
      var premDecimals = tick < 1 ? 4 : 2;

      html += '<div class="bs-leg-card">' +
        '<div class="bs-leg-header">' +
          '<span class="bs-leg-num">#' + (i + 1) + '</span>' +
          '<span class="bs-leg-badge ' + typeCls + '">' + leg.type.toUpperCase() + '</span>' +
          '<span class="bs-leg-badge ' + dirCls + '">' + dirLabel + '</span>' +
          '<span class="bs-leg-qty">\u00D7' + leg.qty + '</span>' +
        '</div>' +
        '<div class="bs-leg-strike-row">' +
          '<span class="bs-leg-strike-label">Strike</span>' +
          '<datalist id="' + dlId + '">' + opts + '</datalist>' +
          '<input type="number" class="bscalc-input bs-leg-strike" list="' + dlId + '"' +
            ' data-leg="' + i + '" value="' + leg.K.toFixed(decimals) + '"' +
            ' step="' + tick + '">' +
        '</div>' +
        '<div class="bs-leg-strike-row bs-leg-premium-row">' +
          '<span class="bs-leg-strike-label">Premium</span>' +
          '<input type="number" class="bscalc-input bs-leg-premium" min="0" step="0.01"' +
            ' data-leg="' + i + '" value="' + premVal + '" placeholder="BS auto">' +
        '</div>' +
      '</div>';
    }

    if (STRATEGIES[strategy].hasUnderlying) {
      html += '<div class="bs-leg-underlying">+ Long Underlying</div>';
    }

    container.innerHTML = html;

    // Strike listeners
    container.querySelectorAll('.bs-leg-strike').forEach(function (inp) {
      function applyStrike() {
        var v = parseFloat(inp.value);
        if (v > 0) {
          var idx = parseInt(inp.dataset.leg);
          legs[idx].K = v;
          // If premium not manually locked, refresh BS premium for new strike
          if (!legs[idx].premiumManual) {
            var p = getParams();
            if (p.S > 0 && p.T > 0 && p.sigma > 0) {
              legs[idx].premium = priceOnly(p.S, v, p.T, p.r, p.sigma, legs[idx].type);
              var premInp = container.querySelector('.bs-leg-premium[data-leg="' + idx + '"]');
              if (premInp) premInp.value = legs[idx].premium.toFixed(2);
            }
          }
          calculate();
        }
      }
      inp.addEventListener('change', applyStrike);
      inp.addEventListener('input', function () { var v = parseFloat(inp.value); if (v > 0) applyStrike(); });
    });

    // Premium listeners
    container.querySelectorAll('.bs-leg-premium').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var idx = parseInt(inp.dataset.leg);
        var v = parseFloat(inp.value);
        if (!isNaN(v) && v >= 0) {
          legs[idx].premium = v;
          legs[idx].premiumManual = true;
        }
        calculate();
      });
    });
  }

  /* ================================================================
     MATH — Normal distribution
     ================================================================ */
  function normPDF(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  function normCDF(x) {
    if (x > 8) return 1;
    if (x < -8) return 0;
    var neg = x < 0;
    if (neg) x = -x;
    var k = 1 / (1 + 0.2316419 * x);
    var k2 = k * k, k3 = k2 * k, k4 = k3 * k, k5 = k4 * k;
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
    var Nd1 = normCDF(d1), Nd2 = normCDF(d2);
    var Nnd1 = normCDF(-d1), Nnd2 = normCDF(-d2);
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
    return { price: price, delta: delta, gamma: nd1 / (S * sigma * sqrtT), vega: S * nd1 * sqrtT / 100, theta: theta, rho: rho };
  }

  /* ================================================================
     MATH — American (CRR Binomial Tree)
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
    var prices = new Array(N + 1);
    for (var i = 0; i <= N; i++) {
      var ST = S * Math.pow(u, N - i) * Math.pow(d, i);
      prices[i] = isCall ? Math.max(ST - K, 0) : Math.max(K - ST, 0);
    }
    var step2 = null, step1 = null;
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
    var Su = S * u, Sd = S * d;
    var delta = (step1[0] - step1[1]) / (Su - Sd);
    var Suu = S * u * u, Sdd = S * d * d;
    var gamma = ((step2[0] - step2[1]) / (Suu - S) - (step2[1] - step2[2]) / (S - Sdd)) / (0.5 * (Suu - Sdd));
    var theta = (step2[1] - price) / (2 * dt) / 365;
    var bumpSig = 0.01;
    var vega = (bsAmerican_price(S, K, T, r, sigma + bumpSig, type, N) - bsAmerican_price(S, K, T, r, sigma - bumpSig, type, N)) / (2 * bumpSig) / 100;
    var bumpR = 0.0001;
    var rho = (bsAmerican_price(S, K, T, r + bumpR, sigma, type, N) - bsAmerican_price(S, K, T, r - bumpR, sigma, type, N)) / (2 * bumpR) / 100;
    return { price: price, delta: delta, gamma: gamma, vega: vega, theta: theta, rho: rho };
  }

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
     PRICING HELPERS — for multi-leg
     ================================================================ */
  function priceFn(S, K, T, r, sigma, type) {
    if (model === 'european') return bsEuropean(S, K, T, r, sigma, type);
    return bsAmerican(S, K, T, r, sigma, type);
  }

  function priceOnly(S, K, T, r, sigma, type) {
    if (model === 'european') return bsEuropean(S, K, T, r, sigma, type).price;
    // Use fewer steps for heatmap performance with multi-leg
    var steps = legs.length > 2 ? 50 : 100;
    return bsAmerican_price(S, K, T, r, sigma, type, steps);
  }

  /* ================================================================
     CALCULATE
     ================================================================ */
  function getParams() {
    var S = parseFloat(el('bs-spot').value) || 0;
    var sigma = (parseFloat(el('bs-vol').value) || 0) / 100;
    var r = (parseFloat(el('bs-rate').value) || 0) / 100;
    var expiryStr = el('bs-expiry').value;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var expiry = new Date(expiryStr);
    var diffDays = Math.max((expiry - today) / (1000 * 60 * 60 * 24), 0);
    var T = diffDays / 365;
    return { S: S, T: T, r: r, sigma: sigma, diffDays: diffDays };
  }

  function calculate() {
    var p = getParams();
    if (p.S <= 0 || p.T <= 0 || p.sigma <= 0 || legs.length === 0) {
      renderResult({ price: 0, delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 }, p);
      drawChart();
      return;
    }

    // Update auto premiums (non-manual legs) and sync input fields
    var container = el('bs-legs-container');
    for (var i = 0; i < legs.length; i++) {
      if (!legs[i].premiumManual) {
        legs[i].premium = priceOnly(p.S, legs[i].K, p.T, p.r, p.sigma, legs[i].type);
        if (container) {
          var pi = container.querySelector('.bs-leg-premium[data-leg="' + i + '"]');
          if (pi && document.activeElement !== pi) pi.value = legs[i].premium.toFixed(2);
        }
      }
    }

    var net = { price: 0, delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 };
    for (var i = 0; i < legs.length; i++) {
      var leg = legs[i];
      var res = priceFn(p.S, leg.K, p.T, p.r, p.sigma, leg.type);
      var sign = leg.dir * leg.qty;
      net.price += res.price * sign;
      net.delta += res.delta * sign;
      net.gamma += res.gamma * sign;
      net.vega  += res.vega  * sign;
      net.theta += res.theta * sign;
      net.rho   += res.rho   * sign;
    }
    if (STRATEGIES[strategy].hasUnderlying) net.delta += 1;

    renderResult(net, p);
    drawChart();
  }

  /* ================================================================
     RENDER RESULT
     ================================================================ */
  function renderResult(res, params) {
    var isMulti = legs.length > 1 || STRATEGIES[strategy].hasUnderlying;
    el('bs-price-label').textContent = isMulti ? 'Net Premium' : 'Theoretical Price';
    el('bs-price-val').textContent = res.price.toFixed(4);

    // Update header subtitle
    var subtitleEl = el('bs-strategy-label');
    if (subtitleEl) subtitleEl.textContent = STRATEGIES[strategy].label;

    // Price card border color
    var priceCard = document.getElementById('bs-price-card');
    if (priceCard) priceCard.style.borderLeftColor = res.price > 0 ? '#4ecdc4' : res.price < 0 ? '#ff6b6b' : 'var(--accent)';

    // Moneyness / strategy label
    var distEl = el('bs-dist-val');
    var distCard = document.getElementById('bs-dist-card');
    if (isMulti) {
      distEl.textContent = STRATEGIES[strategy].label;
      distEl.className = 'bscalc-result-card-sub';
      if (distCard) distCard.style.borderLeftColor = 'var(--border)';
      el('bs-moneyness').textContent = legs.length + ' legs';
    } else if (legs.length === 1) {
      var K = legs[0].K;
      var pct = params.S > 0 ? ((K - params.S) / params.S * 100) : 0;
      var sign = pct >= 0 ? '+' : '';
      distEl.textContent = sign + pct.toFixed(2) + '%';
      var isItm = pct < 0;
      var isOtm = pct > 0;
      distEl.className = 'bscalc-result-card-sub ' + (isOtm ? 'otm' : isItm ? 'itm' : '');
      if (distCard) distCard.style.borderLeftColor = isItm ? '#4ecdc4' : isOtm ? '#ff6b6b' : 'var(--border)';
      var type = legs[0].type;
      var moneyLabel = '';
      if (type === 'call') moneyLabel = K < params.S ? 'ITM' : K > params.S ? 'OTM' : 'ATM';
      else moneyLabel = K > params.S ? 'ITM' : K < params.S ? 'OTM' : 'ATM';
      el('bs-moneyness').textContent = moneyLabel;
    }

    el('bs-delta').textContent = res.delta.toFixed(4);
    el('bs-gamma').textContent = res.gamma.toFixed(4);
    el('bs-vega').textContent = res.vega.toFixed(4);
    el('bs-theta').textContent = res.theta.toFixed(4);
    el('bs-rho').textContent = res.rho.toFixed(4);
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
        spotFetched = last.close;
        var symInfo = SYMBOLS.find(function(s){ return s.symbol === sym; });
        var decimals = symInfo ? symInfo.decimals : 2;
        el('bs-spot').value = spotFetched.toFixed(decimals);
        applyStrategy();
      }
    } catch (e) { /* silently fail */ }
    finally { btn.textContent = 'Fetch'; btn.disabled = false; }
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
    var w = c.clientWidth, h = c.clientHeight;
    if (w <= 0 || h <= 0) return null;
    var dpr = window.devicePixelRatio || 1;
    c.width = w * dpr;
    c.height = h * dpr;
    var ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  function drawGrid(ctx, pad, w, h, xTicks, yTicks) {
    ctx.save();
    ctx.strokeStyle = 'rgba(150,150,150,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    var pw = w - pad.left - pad.right, ph = h - pad.top - pad.bottom;
    for (var i = 0; i <= xTicks; i++) { var x = pad.left + i * pw / xTicks; ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, h - pad.bottom); ctx.stroke(); }
    for (var i = 0; i <= yTicks; i++) { var y = pad.top + i * ph / yTicks; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // --- Smart chart x-range: adapts to vol, DTE, and strike spread ---
  function getXRange(p) {
    var kMin = Infinity, kMax = -Infinity;
    for (var i = 0; i < legs.length; i++) {
      if (legs[i].K < kMin) kMin = legs[i].K;
      if (legs[i].K > kMax) kMax = legs[i].K;
    }
    if (kMin === Infinity) { kMin = p.S; kMax = p.S; }
    var mid = (kMin + kMax) / 2;
    var spread = kMax - kMin;

    // 1) Vol-based: ~0.5 standard deviations — tight for detail, widens with vol & DTE
    var stdMove = p.S * p.sigma * Math.sqrt(Math.max(p.T, 1 / 365));
    var volRange = stdMove * 0.5;

    // 2) Strike-based: cover all legs with 30% padding beyond outermost strikes
    var strikeRange = spread > 0 ? spread * 1.3 : 0;

    // 3) Use the larger of vol-based and strike-based
    var range = Math.max(volRange, strikeRange);

    // 4) Floor: at least show ATM ± 10 ticks so chart is never too zoomed in
    range = Math.max(range, getSymbolTick() * 10);

    return { xMin: Math.max(mid - range, 0.01), xMax: mid + range };
  }

  // --- Payoff diagram ---
  function drawPayoff() {
    var cv = getCanvas('bs-canvas-payoff');
    if (!cv) return;
    var ctx = cv.ctx, w = cv.w, h = cv.h;
    var p = getParams();
    if (p.S <= 0 || legs.length === 0) return;

    var pad = { top: 30, right: 30, bottom: 40, left: 60 };
    var pw = w - pad.left - pad.right, ph = h - pad.top - pad.bottom;
    var xr = getXRange(p);
    var xMin = xr.xMin, xMax = xr.xMax;
    var steps = 200, dx = (xMax - xMin) / steps;
    var hasUnd = STRATEGIES[strategy].hasUnderlying;

    // Net premium at entry (use leg.premium if set, else BS)
    var netPremium = 0;
    for (var li = 0; li < legs.length; li++) {
      var legPrem = (legs[li].premium != null) ? legs[li].premium : priceOnly(p.S, legs[li].K, p.T, p.r, p.sigma, legs[li].type);
      netPremium += legPrem * legs[li].dir * legs[li].qty;
    }

    // Compute combined payoff and theoretical
    var payoffs = [], theories = [];
    var yMin = Infinity, yMax = -Infinity;
    for (var i = 0; i <= steps; i++) {
      var sx = xMin + i * dx;
      var combinedPayoff = 0, combinedTheory = 0;
      for (var li = 0; li < legs.length; li++) {
        var leg = legs[li];
        var intrinsic = leg.type === 'call' ? Math.max(sx - leg.K, 0) : Math.max(leg.K - sx, 0);
        combinedPayoff += intrinsic * leg.dir * leg.qty;
        combinedTheory += priceOnly(sx, leg.K, p.T, p.r, p.sigma, leg.type) * leg.dir * leg.qty;
      }
      if (hasUnd) { combinedPayoff += sx - p.S; combinedTheory += sx - p.S; }
      var pf = combinedPayoff - netPremium;
      var tv = combinedTheory - netPremium;
      payoffs.push(pf);
      theories.push(tv);
      yMin = Math.min(yMin, pf, tv);
      yMax = Math.max(yMax, pf, tv);
    }

    var yRange = yMax - yMin || 1;
    yMin -= yRange * 0.1; yMax += yRange * 0.1;
    function toX(v) { return pad.left + (v - xMin) / (xMax - xMin) * pw; }
    function toY(v) { return pad.top + (1 - (v - yMin) / (yMax - yMin)) * ph; }

    drawGrid(ctx, pad, w, h, 3, 4);

    // Zero line
    if (yMin < 0 && yMax > 0) {
      ctx.strokeStyle = 'rgba(150,150,150,0.4)';
      ctx.beginPath(); ctx.moveTo(pad.left, toY(0)); ctx.lineTo(w - pad.right, toY(0)); ctx.stroke();
    }

    // Strike lines
    ctx.strokeStyle = 'rgba(150,150,150,0.25)';
    ctx.setLineDash([4, 4]);
    for (var li = 0; li < legs.length; li++) {
      var kx = toX(legs[li].K);
      if (kx > pad.left && kx < w - pad.right) {
        ctx.beginPath(); ctx.moveTo(kx, pad.top); ctx.lineTo(kx, h - pad.bottom); ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // Axis labels
    ctx.fillStyle = '#999'; ctx.font = '9px Inter, sans-serif'; ctx.textAlign = 'center';
    for (var i = 0; i <= 3; i++) { var v = xMin + (xMax - xMin) * i / 3; ctx.fillText(v.toFixed(0), toX(v), h - pad.bottom + 14); }
    ctx.textAlign = 'right';
    for (var i = 0; i <= 4; i++) { var v = yMin + (yMax - yMin) * i / 4; ctx.fillText(v.toFixed(1), pad.left - 6, toY(v) + 3); }

    // Payoff at expiry
    ctx.strokeStyle = 'rgba(255,107,107,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (var i = 0; i <= steps; i++) { var x = toX(xMin + i * dx), y = toY(payoffs[i]); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();

    // Theoretical P&L
    ctx.strokeStyle = 'rgba(78,205,196,0.9)'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (var i = 0; i <= steps; i++) { var x = toX(xMin + i * dx), y = toY(theories[i]); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();

    // Spot marker
    if (p.S >= xMin && p.S <= xMax) {
      var idx = Math.round((p.S - xMin) / dx);
      if (idx >= 0 && idx <= steps) {
        ctx.fillStyle = '#ffd93d';
        ctx.beginPath(); ctx.arc(toX(p.S), toY(theories[idx]), 5, 0, 2 * Math.PI); ctx.fill();
      }
    }

    // Break-even points: zero crossings in At Expiry payoffs
    var bePoints = [];
    for (var i = 0; i < steps; i++) {
      var y0 = payoffs[i], y1 = payoffs[i + 1];
      if (y0 !== y1 && ((y0 <= 0 && y1 >= 0) || (y0 >= 0 && y1 <= 0))) {
        var bex = (xMin + i * dx) + (-y0 / (y1 - y0)) * dx; // linear interpolate
        bePoints.push(bex);
      }
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(255,211,77,0.7)';
    ctx.fillStyle = '#ffd93d';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.5;
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    bePoints.forEach(function (bex) {
      var bx = toX(bex);
      if (bx < pad.left || bx > w - pad.right) return;
      ctx.beginPath(); ctx.moveTo(bx, pad.top); ctx.lineTo(bx, h - pad.bottom); ctx.stroke();
      // Dot on zero line
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(bx, toY(0), 3.5, 0, 2 * Math.PI); ctx.fill();
      ctx.setLineDash([3, 3]);
      // Label (alternate above/below to avoid overlap)
      var labelY = pad.top + 10;
      ctx.fillText('B/E ' + bex.toFixed(0), bx, labelY);
    });
    ctx.restore();

    // Legend
    ctx.font = '10px Inter, sans-serif';
    var lx = pad.left + 8, ly = pad.top + 12;
    ctx.fillStyle = 'rgba(78,205,196,0.9)'; ctx.fillRect(lx, ly - 6, 14, 3);
    ctx.fillStyle = '#ccc'; ctx.textAlign = 'left'; ctx.fillText('Theoretical', lx + 18, ly);
    ly += 14;
    ctx.fillStyle = 'rgba(255,107,107,0.8)'; ctx.fillRect(lx, ly - 6, 14, 3);
    ctx.fillStyle = '#ccc'; ctx.fillText('At Expiry', lx + 18, ly);

    ctx.fillStyle = '#888'; ctx.textAlign = 'center';
    ctx.fillText('Underlying Price', pad.left + pw / 2, h - 4);
  }

  // --- Greeks charts (2x2 grid) ---
  function drawGreeks() {
    var cv = getCanvas('bs-canvas-greeks');
    if (!cv) return;
    var ctx = cv.ctx, w = cv.w, h = cv.h;
    var p = getParams();
    if (p.S <= 0 || p.T <= 0 || p.sigma <= 0 || legs.length === 0) return;

    var greekList = ['delta', 'gamma', 'vega', 'theta'];
    var colors = ['#4ecdc4', '#ff6b6b', '#ffd93d', '#a78bfa'];
    var cols = 4, rows = 1;
    var cellW = w / cols, cellH = h / rows;
    var pad = { top: 28, right: 14, bottom: 28, left: 50 };
    var xr = getXRange(p);
    var xMin = xr.xMin, xMax = xr.xMax;
    var steps = 80, dx = (xMax - xMin) / steps;
    var hasUnd = STRATEGIES[strategy].hasUnderlying;

    for (var gi = 0; gi < greekList.length; gi++) {
      var gname = greekList[gi];
      var col = gi % cols, row = 0;
      var ox = col * cellW, oy = row * cellH;
      var pw2 = cellW - pad.left - pad.right, ph2 = cellH - pad.top - pad.bottom;

      var vals = [];
      var yMin2 = Infinity, yMax2 = -Infinity;
      for (var i = 0; i <= steps; i++) {
        var sx = xMin + i * dx;
        var v = 0;
        for (var li = 0; li < legs.length; li++) {
          var res2 = priceFn(sx, legs[li].K, p.T, p.r, p.sigma, legs[li].type);
          v += res2[gname] * legs[li].dir * legs[li].qty;
        }
        if (hasUnd && gname === 'delta') v += 1;
        vals.push(v);
        if (v < yMin2) yMin2 = v;
        if (v > yMax2) yMax2 = v;
      }

      var yRange2 = yMax2 - yMin2 || 0.01;
      yMin2 -= yRange2 * 0.1; yMax2 += yRange2 * 0.1;
      function toX2(v) { return ox + pad.left + (v - xMin) / (xMax - xMin) * pw2; }
      function toY2(v) { return oy + pad.top + (1 - (v - yMin2) / (yMax2 - yMin2)) * ph2; }

      // Border
      ctx.strokeStyle = 'rgba(150,150,150,0.15)'; ctx.lineWidth = 1;
      ctx.strokeRect(ox + 0.5, oy + 0.5, cellW - 1, cellH - 1);

      // Sub-chart grid
      ctx.save(); ctx.strokeStyle = 'rgba(150,150,150,0.12)'; ctx.setLineDash([4, 4]);
      for (var gi2 = 1; gi2 < 3; gi2++) {
        var gx = ox + pad.left + gi2 * pw2 / 3;
        ctx.beginPath(); ctx.moveTo(gx, oy + pad.top); ctx.lineTo(gx, oy + cellH - pad.bottom); ctx.stroke();
        var gy = oy + pad.top + gi2 * ph2 / 3;
        ctx.beginPath(); ctx.moveTo(ox + pad.left, gy); ctx.lineTo(ox + cellW - pad.right, gy); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.restore();

      // Title
      ctx.fillStyle = colors[gi]; ctx.font = 'bold 12px Inter, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(gname.charAt(0).toUpperCase() + gname.slice(1), ox + pad.left, oy + 16);

      // Zero line
      if (yMin2 < 0 && yMax2 > 0) {
        ctx.strokeStyle = 'rgba(150,150,150,0.3)';
        ctx.beginPath(); ctx.moveTo(ox + pad.left, toY2(0)); ctx.lineTo(ox + cellW - pad.right, toY2(0)); ctx.stroke();
      }

      // Y axis labels
      ctx.fillStyle = '#888'; ctx.font = '9px JetBrains Mono, monospace'; ctx.textAlign = 'right';
      for (var ti = 0; ti <= 2; ti++) { var v2 = yMin2 + (yMax2 - yMin2) * ti / 2; ctx.fillText(v2.toFixed(3), ox + pad.left - 4, toY2(v2) + 3); }
      // X axis labels
      ctx.textAlign = 'center'; ctx.font = '9px JetBrains Mono, monospace';
      for (var ti = 0; ti <= 2; ti++) { var v3 = xMin + (xMax - xMin) * ti / 2; ctx.fillText(v3.toFixed(0), toX2(v3), oy + cellH - pad.bottom + 12); }

      // Draw line
      ctx.strokeStyle = colors[gi]; ctx.lineWidth = 2;
      ctx.beginPath();
      for (var i = 0; i <= steps; i++) { var x2 = toX2(xMin + i * dx), y2 = toY2(vals[i]); i === 0 ? ctx.moveTo(x2, y2) : ctx.lineTo(x2, y2); }
      ctx.stroke();

      // Spot marker
      if (p.S >= xMin && p.S <= xMax) {
        var idx = Math.round((p.S - xMin) / dx);
        if (idx >= 0 && idx <= steps) { ctx.fillStyle = '#ffd93d'; ctx.beginPath(); ctx.arc(toX2(p.S), toY2(vals[idx]), 4, 0, 2 * Math.PI); ctx.fill(); }
      }
    }
  }

  // --- P&L Heatmap ---
  function drawHeatmap() {
    var cv = getCanvas('bs-canvas-heatmap');
    if (!cv) return;
    var ctx = cv.ctx, w = cv.w, h = cv.h;
    var p = getParams();
    if (p.S <= 0 || p.T <= 0 || p.sigma <= 0 || legs.length === 0) return;

    var pad = { top: 30, right: 70, bottom: 40, left: 60 };
    var pw3 = w - pad.left - pad.right, ph3 = h - pad.top - pad.bottom;
    var xr = getXRange(p);
    var xMin3 = xr.xMin, xMax3 = xr.xMax;
    var yMin3 = Math.max(p.sigma * 0.3, 0.01), yMax3 = p.sigma * 2;
    var hasUnd = STRATEGIES[strategy].hasUnderlying;

    var xSteps = 50, ySteps = 35;
    var cellW2 = pw3 / xSteps, cellH2 = ph3 / ySteps;

    // Net premium at entry (use leg.premium if set, else BS)
    var netPremium = 0;
    for (var li = 0; li < legs.length; li++) {
      var legPrem2 = (legs[li].premium != null) ? legs[li].premium : priceOnly(p.S, legs[li].K, p.T, p.r, p.sigma, legs[li].type);
      netPremium += legPrem2 * legs[li].dir * legs[li].qty;
    }

    var pnlMin = Infinity, pnlMax = -Infinity;
    var grid = [];
    for (var yi = 0; yi < ySteps; yi++) {
      grid[yi] = [];
      var vol = yMin3 + (yMax3 - yMin3) * (ySteps - 1 - yi) / (ySteps - 1);
      for (var xi = 0; xi < xSteps; xi++) {
        var spot = xMin3 + (xMax3 - xMin3) * xi / (xSteps - 1);
        var val = 0;
        for (var li = 0; li < legs.length; li++) {
          val += priceOnly(spot, legs[li].K, p.T, p.r, vol, legs[li].type) * legs[li].dir * legs[li].qty;
        }
        if (hasUnd) val += spot - p.S;
        var pnl = val - netPremium;
        grid[yi][xi] = pnl;
        if (pnl < pnlMin) pnlMin = pnl;
        if (pnl > pnlMax) pnlMax = pnl;
      }
    }

    // Draw cells
    for (var yi = 0; yi < ySteps; yi++) {
      for (var xi = 0; xi < xSteps; xi++) {
        ctx.fillStyle = heatmapColor(grid[yi][xi], pnlMin, pnlMax);
        ctx.fillRect(pad.left + xi * cellW2, pad.top + yi * cellH2, cellW2 + 1, cellH2 + 1);
      }
    }

    drawGrid(ctx, pad, w, h, 3, 3);

    // Axes labels
    ctx.fillStyle = '#999'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center';
    for (var i = 0; i <= 3; i++) { var v = xMin3 + (xMax3 - xMin3) * i / 3; ctx.fillText(v.toFixed(0), pad.left + i * pw3 / 3, h - pad.bottom + 14); }
    ctx.textAlign = 'right';
    for (var i = 0; i <= 3; i++) { var vol = yMin3 + (yMax3 - yMin3) * i / 3; ctx.fillText((vol * 100).toFixed(0) + '%', pad.left - 6, pad.top + (1 - i / 3) * ph3 + 4); }

    // Current position marker
    var curX = pad.left + (p.S - xMin3) / (xMax3 - xMin3) * pw3;
    var curY = pad.top + (1 - (p.sigma - yMin3) / (yMax3 - yMin3)) * ph3;
    if (curX >= pad.left && curX <= w - pad.right && curY >= pad.top && curY <= h - pad.bottom) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(curX, curY, 6, 0, 2 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(curX - 8, curY); ctx.lineTo(curX + 8, curY); ctx.moveTo(curX, curY - 8); ctx.lineTo(curX, curY + 8); ctx.stroke();
    }

    // Color bar
    var barX = w - pad.right + 14, barW = 14, barH = ph3;
    for (var i = 0; i < barH; i++) { ctx.fillStyle = heatmapColor(pnlMax - (pnlMax - pnlMin) * i / barH, pnlMin, pnlMax); ctx.fillRect(barX, pad.top + i, barW, 1); }
    ctx.fillStyle = '#999'; ctx.font = '10px JetBrains Mono, monospace'; ctx.textAlign = 'left';
    ctx.fillText('+' + pnlMax.toFixed(1), barX + barW + 4, pad.top + 10);
    ctx.fillText(pnlMin.toFixed(1), barX + barW + 4, pad.top + barH);
    if (pnlMin < 0 && pnlMax > 0) ctx.fillText('0', barX + barW + 4, pad.top + (1 - (0 - pnlMin) / (pnlMax - pnlMin)) * barH + 4);

    ctx.fillStyle = '#888'; ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Underlying Price', pad.left + pw3 / 2, h - 4);
    ctx.save(); ctx.translate(12, pad.top + ph3 / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('Volatility', 0, 0); ctx.restore();
  }

  function heatmapColor(val, min, max) {
    if (max === min) return 'rgb(50,50,50)';
    var range = Math.max(Math.abs(min), Math.abs(max));
    var norm = range > 0 ? val / range : 0;
    norm = Math.max(-1, Math.min(1, norm));
    if (norm >= 0) { var t = norm; return 'rgb(' + Math.round(30 + (1 - t) * 30) + ',' + Math.round(80 + t * 150) + ',' + Math.round(30 + (1 - t) * 30) + ')'; }
    else { var t = -norm; return 'rgb(' + Math.round(80 + t * 150) + ',' + Math.round(30 + (1 - t) * 30) + ',' + Math.round(30 + (1 - t) * 30) + ')'; }
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
    var panels = ['kline-panel', 'databento-panel', 'corr-panel', 'calendar-panel', 'groupchat-panel'];
    panels.forEach(function (id) { var p = document.getElementById(id); if (p) p.classList.remove('visible'); });
    el('bscalc-panel').classList.add('visible');
    calculate();
    setTimeout(function () { drawChart(); }, 50);
  }

  function hide() { el('bscalc-panel').classList.remove('visible'); }

  /* ================================================================
     INIT
     ================================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    // Symbol dropdown
    var sel = el('bs-symbol');
    if (sel) {
      SYMBOLS.forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s.symbol;
        opt.textContent = s.symbol.replace('=F', '').replace('=X', '').replace('.TW', '') + ' — ' + s.label;
        sel.appendChild(opt);
      });
    }

    // Strategy dropdown
    var stratSel = el('bs-strategy');
    if (stratSel) {
      Object.keys(STRATEGIES).forEach(function (key) {
        var opt = document.createElement('option');
        opt.value = key;
        opt.textContent = STRATEGIES[key].label;
        stratSel.appendChild(opt);
      });
      stratSel.addEventListener('change', function () {
        strategy = stratSel.value;
        applyStrategy();
      });
    }

    // Default expiry +30 days
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
      slider.min = 1; slider.max = 365; slider.value = 30;
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

    // Input listeners
    ['bs-spot', 'bs-vol', 'bs-rate'].forEach(function (id) {
      var inp = el(id);
      if (inp) inp.addEventListener('input', calculate);
    });

    // Spot change → re-apply strategy (re-center strikes around new ATM)
    var spotEl = el('bs-spot');
    if (spotEl) spotEl.addEventListener('change', function () {
      applyStrategy();
    });

    // Fetch & symbol
    var fetchBtn = el('bs-fetch-spot');
    if (fetchBtn) fetchBtn.addEventListener('click', fetchSpot);
    if (sel) sel.addEventListener('change', fetchSpot);

    // Close
    var closeBtn = el('bscalc-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { hide(); document.getElementById('welcome').style.display = ''; });

    // Resize
    window.addEventListener('resize', function () { if (el('bscalc-panel').classList.contains('visible')) drawChart(); });

    // Initialize default strategy
    applyStrategy();
  });

  return { show: show, hide: hide };
})();
