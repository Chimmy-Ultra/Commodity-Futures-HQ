require('dotenv').config();
const express = require('express');
const path = require('path');
const { GLOBAL_RESPONSE_STYLE, PROMPTS } = require('./config/prompts');
const { LIVE_MARKETS } = require('./config/markets');
const { fetchYahooQuotes, getCachedQuotes, setCachedQuotes, fetchYahooKline } = require('./lib/yahoo');
const { queryDatabento } = require('./lib/databento');
const { COMMODITY_LABELS } = require('./config/commodities');
const { runAnalysis } = require('./lib/orchestrator');
const { callClaude, formatChatHistory } = require('./lib/claude-runner');
const { AGENT_MODELS } = require('./config/models');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Security middleware ---
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory rate limiter (no extra dependency)
const rateLimitMap = new Map();
function rateLimit(windowMs, maxReqs) {
  return function (req, res, next) {
    var ip = req.ip || req.connection.remoteAddress;
    var now = Date.now();
    var entry = rateLimitMap.get(ip);
    if (!entry || now - entry.start > windowMs) {
      rateLimitMap.set(ip, { start: now, count: 1 });
      return next();
    }
    entry.count++;
    if (entry.count > maxReqs) {
      return res.status(429).json({ error: 'Too many requests. Please wait.' });
    }
    next();
  };
}
// Clean up rate limit map periodically
setInterval(function () {
  var now = Date.now();
  rateLimitMap.forEach(function (v, k) { if (now - v.start > 60000) rateLimitMap.delete(k); });
}, 60000);

// --- Live Quotes (Yahoo Finance) ---

app.get('/api/quotes/:characterId', async (req, res) => {
  const { characterId } = req.params;
  const instruments = LIVE_MARKETS[characterId];

  if (!instruments || !instruments.length) {
    return res.status(404).json({ error: `No live market panel configured for ${characterId}.` });
  }

  const cached = getCachedQuotes(characterId);
  if (cached) return res.json(cached);

  try {
    const quotes = await fetchYahooQuotes(instruments);
    const updatedAt =
      quotes.reduce((latest, q) => {
        if (!q.updatedAt) return latest;
        return !latest || q.updatedAt > latest ? q.updatedAt : latest;
      }, null) || new Date().toISOString();

    const payload = {
      characterId,
      source: 'Yahoo Finance',
      updatedAt,
      stale: false,
      quotes,
    };

    setCachedQuotes(characterId, payload);
    res.json(payload);
  } catch (error) {
    console.error('Quote Error:', error.message);
    if (cached) {
      return res.json({ ...cached, stale: true, note: 'Showing cached market data because the upstream quote request failed.' });
    }
    res.status(502).json({ error: error.message || 'Unable to fetch live market data.' });
  }
});

// --- Chat (powered by Claude CLI / Max subscription) ---

app.post('/api/chat', rateLimit(60000, 30), async (req, res) => {
  try {
    const { characterId, messages } = req.body;
    if (!characterId || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request. Need characterId and messages[].' });
    }

    // Input validation: cap messages and content length
    if (messages.length > 50) {
      return res.status(400).json({ error: 'Too many messages. Maximum 50.' });
    }
    for (var i = 0; i < messages.length; i++) {
      if (typeof messages[i].content === 'string' && messages[i].content.length > 8000) {
        return res.status(400).json({ error: 'Message too long. Maximum 8000 characters.' });
      }
    }

    const system = PROMPTS[characterId];
    if (!system) {
      return res.status(400).json({ error: `Unknown character: ${characterId}` });
    }

    // Format conversation history for claude -p
    var chatPrompt = formatChatHistory(messages);
    chatPrompt += '\n\nRespond as the assistant to the user\'s latest message above.';

    const response = await callClaude({
      systemPrompt: GLOBAL_RESPONSE_STYLE + '\n\n' + system,
      userMessage: chatPrompt,
      webSearch: true,
      model: AGENT_MODELS[characterId],
    });

    res.json({ response });
  } catch (error) {
    console.error('Chat Error:', error.message);
    res.status(500).json({ error: 'AI service temporarily unavailable. Please try again.' });
  }
});

// --- Commodities list ---

app.get('/api/commodities', (req, res) => {
  res.json(COMMODITY_LABELS);
});

// --- Analysis Pipeline (powered by Claude CLI / Max subscription) ---

app.post('/api/analyze', rateLimit(60000, 5), async (req, res) => {
  const { mode, commodity, question } = req.body;

  if (mode === 'commodity' && !require('./config/commodities').COMMODITY_AGENTS[commodity]) {
    return res.status(400).json({ error: `Unknown commodity: ${commodity}` });
  }
  if (mode === 'question' && (!question || !question.trim())) {
    return res.status(400).json({ error: 'Question is required.' });
  }
  if (mode !== 'commodity' && mode !== 'question') {
    return res.status(400).json({ error: 'mode must be "commodity" or "question".' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await runAnalysis({
      mode,
      commodity,
      question,
      onEvent: send,
    });
  } catch (error) {
    console.error('Analysis Error:', error.message);
    send('error', { message: error.message });
  }

  res.end();
});

// --- K-line (candlestick) data ---

app.get('/api/kline/:symbol', async (req, res) => {
  try {
    var symbol = req.params.symbol;
    var interval = req.query.interval || '1d';
    var range = req.query.range || '6mo';
    var data = await fetchYahooKline(symbol, interval, range);
    res.json({ symbol: symbol, interval: interval, range: range, data: data });
  } catch (error) {
    console.error('Kline Error:', error.message);
    res.status(502).json({ error: 'Failed to fetch market data. Please try again.' });
  }
});

// --- Databento Historical Data ---

app.post('/api/databento/query', async (req, res) => {
  try {
    var { dataset, symbols, start, end, schema } = req.body;
    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates are required.' });
    }
    var data = await queryDatabento({ dataset, symbols, start, end, schema });
    res.json({ dataset: dataset, symbols: symbols, schema: schema, count: data.length, data: data });
  } catch (error) {
    console.error('Databento Error:', error.message);
    var isConfig = error.message && error.message.includes('not configured');
    res.status(isConfig ? 503 : 502).json({ error: isConfig ? 'Databento API key not configured.' : 'Failed to query Databento. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`Commodity HQ running on http://localhost:${PORT}`);
  console.log('AI backend: Claude CLI (Max subscription)');
});
