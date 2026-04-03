// claude-backend.js — Dual-mode Claude backend
// Supports two modes, selected via CLAUDE_MODE env var:
//   cli (default) — uses local claude.exe CLI (Claude Max subscription, no API key needed)
//   api           — uses @anthropic-ai/sdk (requires ANTHROPIC_API_KEY, deployable anywhere)

var MODE = (process.env.CLAUDE_MODE || 'cli').toLowerCase();
var API_KEY = process.env.ANTHROPIC_API_KEY || '';

// ── CLI mode: re-export claude-runner.js unchanged ──────────────────────────
if (MODE !== 'api') {
  console.log('[claude-backend] Mode: CLI (Claude Max subscription)');
  module.exports = require('./claude-runner');

// ── API mode: use @anthropic-ai/sdk ─────────────────────────────────────────
} else {
  if (!API_KEY) {
    throw new Error('[claude-backend] CLAUDE_MODE=api but ANTHROPIC_API_KEY is not set in .env');
  }

  console.log('[claude-backend] Mode: API (Anthropic API key)');

  var Anthropic = require('@anthropic-ai/sdk');
  var client = new Anthropic.Anthropic({ apiKey: API_KEY });

  var DEFAULT_MODEL = 'claude-sonnet-4-6';
  var MAX_TOKENS = 8192;

  // Build messages array from system prompt + user message
  function buildMessages(systemPrompt, userMessage) {
    return [{ role: 'user', content: userMessage }];
  }

  /**
   * Single-turn call — returns full response text as a Promise<string>
   */
  function callClaude(opts) {
    var systemPrompt = opts.systemPrompt || '';
    var userMessage  = opts.userMessage  || '';
    var model        = opts.model        || DEFAULT_MODEL;

    return client.messages.create({
      model:      model,
      max_tokens: MAX_TOKENS,
      system:     systemPrompt || undefined,
      messages:   buildMessages(systemPrompt, userMessage),
    }).then(function (msg) {
      var text = '';
      for (var i = 0; i < msg.content.length; i++) {
        if (msg.content[i].type === 'text') text += msg.content[i].text;
      }
      return text;
    });
  }

  /**
   * Streaming call — fires onChunk(delta), onDone(fullText), onError(err)
   * Returns the stream object (can be ignored).
   */
  function streamClaude(opts) {
    var systemPrompt = opts.systemPrompt || '';
    var userMessage  = opts.userMessage  || '';
    var model        = opts.model        || DEFAULT_MODEL;
    var onChunk      = opts.onChunk      || function () {};
    var onDone       = opts.onDone       || function () {};
    var onError      = opts.onError      || function () {};

    var stream = client.messages.stream({
      model:      model,
      max_tokens: MAX_TOKENS,
      system:     systemPrompt || undefined,
      messages:   buildMessages(systemPrompt, userMessage),
    });

    var fullText = '';

    stream.on('text', function (delta) {
      fullText += delta;
      onChunk(delta);
    });

    stream.on('error', function (err) {
      onError(err);
    });

    stream.finalMessage().then(function () {
      onDone(fullText);
    }).catch(function (err) {
      onError(err);
    });

    return stream;
  }

  /**
   * Format multi-turn chat history into a single string prompt.
   * Identical to the CLI version so server.js doesn't need to change.
   */
  function formatChatHistory(messages) {
    if (!messages || !messages.length) return '';
    return messages.map(function (m) {
      var prefix = m.role === 'user' ? 'User' : 'Assistant';
      return prefix + ': ' + m.content;
    }).join('\n\n');
  }

  module.exports = { callClaude, streamClaude, formatChatHistory };
}
