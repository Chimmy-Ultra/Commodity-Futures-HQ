/**
 * correlation.js — Fetch Yahoo Finance data and compute Pearson correlation matrix
 */

const CORR_SYMBOLS = [
  { symbol: 'ZC=F', label: 'Corn', labelZh: '玉米' },
  { symbol: 'ZS=F', label: 'Soybeans', labelZh: '黃豆' },
  { symbol: 'ZW=F', label: 'Wheat', labelZh: '小麥' },
  { symbol: 'KC=F', label: 'Coffee', labelZh: '咖啡' },
  { symbol: 'SB=F', label: 'Sugar', labelZh: '糖' },
  { symbol: 'CL=F', label: 'WTI Oil', labelZh: '原油' },
  { symbol: 'NG=F', label: 'Nat Gas', labelZh: '天然氣' },
  { symbol: 'GC=F', label: 'Gold', labelZh: '黃金' },
  { symbol: 'SI=F', label: 'Silver', labelZh: '白銀' },
  { symbol: 'DX-Y.NYB', label: 'DXY', labelZh: '美元指數' },
];

const corrCache = new Map();
const CORR_CACHE_TTL = 60 * 60 * 1000; // 1 hour

function pearson(x, y) {
  var n = Math.min(x.length, y.length);
  if (n < 5) return null;
  var mx = 0, my = 0;
  for (var i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
  mx /= n; my /= n;
  var num = 0, dx = 0, dy = 0;
  for (var i = 0; i < n; i++) {
    var xi = x[i] - mx;
    var yi = y[i] - my;
    num += xi * yi;
    dx += xi * xi;
    dy += yi * yi;
  }
  var denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

async function fetchCloses(symbol, range) {
  var url = new URL('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol));
  url.searchParams.set('interval', '1d');
  url.searchParams.set('range', range);

  var res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
  });

  if (!res.ok) throw new Error('Yahoo request failed for ' + symbol + ' (' + res.status + ')');

  var payload = await res.json();
  var chart = payload?.chart?.result?.[0];
  if (!chart) return { timestamps: [], closes: [] };

  var ts = chart.timestamp || [];
  var closes = chart.indicators?.quote?.[0]?.close || [];

  // Build aligned arrays, skip null
  var timestamps = [];
  var values = [];
  for (var i = 0; i < ts.length; i++) {
    if (closes[i] != null && Number.isFinite(closes[i])) {
      timestamps.push(ts[i]);
      values.push(closes[i]);
    }
  }

  return { timestamps, closes: values };
}

function computeReturns(closes) {
  var returns = [];
  for (var i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return returns;
}

function alignSeries(allData) {
  // Find common timestamps across all symbols
  var tsSets = allData.map(function (d) {
    return new Set(d.timestamps);
  });
  var commonTs = [];
  var first = allData[0];
  for (var i = 0; i < first.timestamps.length; i++) {
    var t = first.timestamps[i];
    var inAll = true;
    for (var j = 1; j < tsSets.length; j++) {
      if (!tsSets[j].has(t)) { inAll = false; break; }
    }
    if (inAll) commonTs.push(t);
  }
  var commonSet = new Set(commonTs);

  // Extract aligned closes
  return allData.map(function (d) {
    var aligned = [];
    for (var i = 0; i < d.timestamps.length; i++) {
      if (commonSet.has(d.timestamps[i])) aligned.push(d.closes[i]);
    }
    return aligned;
  });
}

async function getCorrelationMatrix(range) {
  range = range || '6mo';

  var cached = corrCache.get(range);
  if (cached && Date.now() - cached.fetchedAt < CORR_CACHE_TTL) {
    return cached.data;
  }

  // Fetch all symbols in parallel
  var allData = await Promise.all(CORR_SYMBOLS.map(function (s) {
    return fetchCloses(s.symbol, range);
  }));

  // Align by common timestamps
  var aligned = alignSeries(allData);

  // Convert to daily returns
  var allReturns = aligned.map(computeReturns);

  // Compute NxN correlation matrix
  var n = CORR_SYMBOLS.length;
  var matrix = [];
  for (var i = 0; i < n; i++) {
    var row = [];
    for (var j = 0; j < n; j++) {
      if (i === j) {
        row.push(1);
      } else if (j < i) {
        row.push(matrix[j][i]); // symmetric
      } else {
        var r = pearson(allReturns[i], allReturns[j]);
        row.push(r != null ? Math.round(r * 100) / 100 : null);
      }
    }
    matrix.push(row);
  }

  var result = {
    symbols: CORR_SYMBOLS.map(function (s) {
      return { symbol: s.symbol, label: s.label, labelZh: s.labelZh };
    }),
    matrix: matrix,
    range: range,
    dataPoints: aligned[0] ? aligned[0].length : 0,
  };

  corrCache.set(range, { fetchedAt: Date.now(), data: result });
  return result;
}

module.exports = { getCorrelationMatrix, CORR_SYMBOLS };
