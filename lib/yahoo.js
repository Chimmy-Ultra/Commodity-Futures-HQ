const QUOTE_CACHE_TTL_MS = 45 * 1000;
const quoteCache = new Map();

function pickNumber() {
  for (let i = 0; i < arguments.length; i += 1) {
    if (typeof arguments[i] === 'number' && Number.isFinite(arguments[i])) {
      return arguments[i];
    }
  }
  return null;
}

function pickLastNumber(values) {
  if (!Array.isArray(values)) return null;
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (typeof values[i] === 'number' && Number.isFinite(values[i])) {
      return values[i];
    }
  }
  return null;
}

async function fetchYahooQuotes(instruments) {
  const url = new URL('https://query1.finance.yahoo.com/v7/finance/spark');
  url.searchParams.set('symbols', instruments.map((i) => i.symbol).join(','));
  url.searchParams.set('range', '1d');
  url.searchParams.set('interval', '1m');

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed (${response.status})`);
  }

  const payload = await response.json();
  const result = payload?.spark?.result;

  if (!Array.isArray(result)) {
    throw new Error('Malformed Yahoo Finance response.');
  }

  const quotesBySymbol = new Map(result.map((q) => [q.symbol, q.response?.[0]]));

  return instruments.map((instrument) => {
    const quote = quotesBySymbol.get(instrument.symbol);
    const meta = quote?.meta;
    const latestClose = pickLastNumber(quote?.indicators?.quote?.[0]?.close);
    const price = pickNumber(
      meta?.regularMarketPrice,
      latestClose,
      meta?.previousClose,
      meta?.chartPreviousClose
    );
    const previousClose = pickNumber(meta?.previousClose, meta?.chartPreviousClose);
    const change =
      typeof price === 'number' && typeof previousClose === 'number'
        ? price - previousClose
        : null;
    const changePercent =
      typeof change === 'number' && typeof previousClose === 'number' && previousClose !== 0
        ? (change / previousClose) * 100
        : null;
    const regularMarketTime = meta?.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : null;

    return {
      symbol: instrument.symbol,
      label: instrument.label,
      unit: instrument.unit,
      precision: instrument.precision,
      currency: meta?.currency || null,
      marketState: meta?.exchangeName || 'UNKNOWN',
      price,
      change,
      changePercent,
      updatedAt: regularMarketTime,
    };
  });
}

function getCachedQuotes(characterId) {
  const cached = quoteCache.get(characterId);
  if (cached && Date.now() - cached.fetchedAt < QUOTE_CACHE_TTL_MS) {
    return cached.payload;
  }
  return null;
}

function setCachedQuotes(characterId, payload) {
  quoteCache.set(characterId, { fetchedAt: Date.now(), payload });
}

// --- K-line (OHLCV) data ---

const klineCache = new Map();
const KLINE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchYahooKline(symbol, interval, range) {
  var cacheKey = symbol + ':' + interval + ':' + range;
  var cached = klineCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < KLINE_CACHE_TTL_MS) {
    return cached.data;
  }

  var url = new URL('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol));
  url.searchParams.set('interval', interval || '1d');
  url.searchParams.set('range', range || '6mo');

  var response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Yahoo Finance kline request failed (' + response.status + ')');
  }

  var payload = await response.json();
  var chart = payload?.chart?.result?.[0];
  if (!chart) throw new Error('No chart data returned');

  var timestamps = chart.timestamp || [];
  var quote = chart.indicators?.quote?.[0] || {};
  var opens = quote.open || [];
  var highs = quote.high || [];
  var lows = quote.low || [];
  var closes = quote.close || [];
  var volumes = quote.volume || [];

  var data = [];
  for (var i = 0; i < timestamps.length; i++) {
    if (closes[i] == null) continue;
    data.push({
      time: timestamps[i],
      open: opens[i] || closes[i],
      high: highs[i] || closes[i],
      low: lows[i] || closes[i],
      close: closes[i],
      volume: volumes[i] || 0,
    });
  }

  klineCache.set(cacheKey, { fetchedAt: Date.now(), data: data });
  return data;
}

module.exports = { fetchYahooQuotes, getCachedQuotes, setCachedQuotes, fetchYahooKline };
