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
const { getCorrelationMatrix } = require('./lib/correlation');
const { CALENDAR_EVENTS, CALENDAR_PROMPT } = require('./config/calendar');

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

// --- Correlation Matrix ---

app.get('/api/correlation', async (req, res) => {
  try {
    var range = req.query.range || '6mo';
    if (!['3mo', '6mo', '1y'].includes(range)) range = '6mo';
    var data = await getCorrelationMatrix(range);
    res.json(data);
  } catch (error) {
    console.error('Correlation Error:', error.message);
    res.status(502).json({ error: 'Failed to compute correlation matrix. Please try again.' });
  }
});

// --- Economic Calendar ---

var calendarCache = { data: null, fetchedAt: 0 };
var CALENDAR_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

app.get('/api/calendar', async (req, res) => {
  var forceRefresh = req.query.refresh === '1';

  if (!forceRefresh && calendarCache.data && Date.now() - calendarCache.fetchedAt < CALENDAR_CACHE_TTL) {
    return res.json(calendarCache.data);
  }

  try {
    var today = new Date().toISOString().split('T')[0];
    var prompt = CALENDAR_PROMPT + '\n\nToday is: ' + today;

    var raw = await callClaude({
      systemPrompt: 'You are a financial calendar data provider. Return only valid JSON.',
      userMessage: prompt,
      webSearch: true,
    });

    // Parse the JSON from Claude's response
    var jsonMatch = raw.match(/\[[\s\S]*\]/);
    var dates = [];
    if (jsonMatch) {
      try { dates = JSON.parse(jsonMatch[0]); } catch (e) { dates = []; }
    }

    // Merge with event definitions
    var eventMap = {};
    CALENDAR_EVENTS.forEach(function (e) { eventMap[e.id] = e; });

    var events = [];
    dates.forEach(function (d) {
      var def = eventMap[d.id];
      if (def && d.date) {
        events.push({
          id: def.id,
          name: def.name,
          nameZh: def.nameZh,
          category: def.category,
          impact: def.impact,
          icon: def.icon,
          description: def.description,
          date: d.date,
        });
      }
    });

    // Sort by date
    events.sort(function (a, b) { return a.date.localeCompare(b.date); });

    var result = { events: events, updatedAt: new Date().toISOString() };
    calendarCache = { data: result, fetchedAt: Date.now() };
    res.json(result);
  } catch (error) {
    console.error('Calendar Error:', error.message);
    // Return cached if available
    if (calendarCache.data) {
      return res.json(calendarCache.data);
    }
    res.status(502).json({ error: 'Failed to fetch calendar data.' });
  }
});

// --- Group Discussion (SSE) ---

app.post('/api/group-chat', rateLimit(60000, 10), async (req, res) => {
  var { characterIds, topic } = req.body;

  if (!Array.isArray(characterIds) || characterIds.length < 2 || characterIds.length > 5) {
    return res.status(400).json({ error: 'Select 2-5 characters.' });
  }
  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    return res.status(400).json({ error: 'Topic is required.' });
  }
  if (topic.length > 2000) {
    return res.status(400).json({ error: 'Topic too long. Maximum 2000 characters.' });
  }

  // Verify all character IDs are valid
  for (var i = 0; i < characterIds.length; i++) {
    if (!PROMPTS[characterIds[i]]) {
      return res.status(400).json({ error: 'Unknown character: ' + characterIds[i] });
    }
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  var send = function (event, data) {
    res.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n');
  };

  var discussion = [];

  for (var i = 0; i < characterIds.length; i++) {
    var charId = characterIds[i];
    var charPrompt = PROMPTS[charId];

    send('agent_start', { characterId: charId });

    try {
      // Build context with previous speakers
      var context = 'Discussion topic: ' + topic + '\n\n';
      if (discussion.length > 0) {
        context += 'Previous speakers in this discussion:\n';
        discussion.forEach(function (d) {
          context += '--- ' + d.name + ' ---\n' + d.response + '\n\n';
        });
        context += 'Now it is your turn. Respond to the topic and reference what others have said when relevant. Keep your response concise (2-4 paragraphs). Do not repeat what others already said.';
      } else {
        context += 'You are the first to speak. Share your perspective on this topic. Keep it concise (2-4 paragraphs).';
      }

      var response = await callClaude({
        systemPrompt: GLOBAL_RESPONSE_STYLE + '\n\n' + charPrompt,
        userMessage: context,
        webSearch: true,
        model: AGENT_MODELS[charId],
      });

      // Find character name from CHARS-like lookup
      var charName = charId;
      discussion.push({ characterId: charId, name: charName, response: response });
      send('agent_done', { characterId: charId, response: response });
    } catch (error) {
      console.error('Group Chat Error (' + charId + '):', error.message);
      send('agent_error', { characterId: charId, error: 'Failed to get response.' });
    }
  }

  send('complete', {});
  res.end();
});

app.listen(PORT, () => {
  console.log(`Commodity HQ running on http://localhost:${PORT}`);
  console.log('AI backend: Claude CLI (Max subscription)');
});
