// claude-runner.js — Invoke Claude Code CLI as the AI backend
// Uses the user's Claude Max subscription instead of a paid API.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Find the claude CLI executable
function findClaudeBinary() {
  // 1) Check if 'claude' is available on PATH (npm global install)
  //    We'll try the desktop app path first since we know the user has it
  // 2) Claude Desktop app bundled CLI (Windows Store package)
  var appDataLocal = process.env.LOCALAPPDATA || '';
  if (appDataLocal) {
    var codeDir = path.join(appDataLocal, 'Packages', 'Claude_pzs8sxrjxfjjc', 'LocalCache', 'Roaming', 'Claude', 'claude-code');
    if (fs.existsSync(codeDir)) {
      // Find the latest version directory
      try {
        var versions = fs.readdirSync(codeDir).filter(function (d) {
          return fs.statSync(path.join(codeDir, d)).isDirectory();
        }).sort().reverse();
        if (versions.length) {
          var exe = path.join(codeDir, versions[0], 'claude.exe');
          if (fs.existsSync(exe)) return exe;
        }
      } catch (e) { /* continue */ }
    }
  }

  // 3) Fallback: assume 'claude' is on PATH
  return 'claude';
}

var CLAUDE_BIN = findClaudeBinary();
console.log('Claude CLI binary:', CLAUDE_BIN);

/**
 * Call Claude via the CLI in non-interactive mode.
 * @param {object} opts
 * @param {string} opts.systemPrompt  — system instructions
 * @param {string} opts.userMessage   — the user-facing prompt
 * @param {boolean} [opts.webSearch]  — allow WebSearch/WebFetch tools (default true)
 * @param {string} [opts.model]       — model override
 * @returns {Promise<string>} response text
 */
function callClaude({ systemPrompt, userMessage, webSearch = true, model }) {
  return new Promise(function (resolve, reject) {
    var prompt = systemPrompt
      ? '<instructions>\n' + systemPrompt + '\n</instructions>\n\n' + userMessage
      : userMessage;

    // Pipe prompt via stdin (no temp files — avoids leaking prompts to disk)
    var args = ['-p', '-', '--output-format', 'json'];

    if (model) {
      args.push('--model', model);
    }

    if (webSearch) {
      args.push('--allowedTools', 'WebSearch,WebFetch');
    }

    var proc = spawn(CLAUDE_BIN, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    var stdout = '';
    var stderr = '';
    var timedOut = false;

    // Timeout: kill the process if it takes too long (3 minutes)
    var TIMEOUT_MS = 3 * 60 * 1000;
    var timer = setTimeout(function () {
      timedOut = true;
      proc.kill('SIGTERM');
      setTimeout(function () { try { proc.kill('SIGKILL'); } catch(e) {} }, 5000);
    }, TIMEOUT_MS);

    proc.stdout.on('data', function (data) { stdout += data.toString(); });
    proc.stderr.on('data', function (data) { stderr += data.toString(); });

    // Feed the prompt via stdin
    proc.stdin.write(prompt);
    proc.stdin.end();

    proc.on('error', function (err) {
      clearTimeout(timer);
      reject(new Error('Failed to spawn claude CLI: ' + err.message));
    });

    proc.on('close', function (code) {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error('Claude CLI timed out after ' + (TIMEOUT_MS / 1000) + 's'));
        return;
      }

      if (code !== 0) {
        // Try to extract error detail from stdout JSON
        var detail = stderr;
        if (!detail && stdout) {
          try { detail = JSON.parse(stdout).result || stdout; } catch(e) { detail = stdout.substring(0, 300); }
        }
        reject(new Error(detail || 'claude exited with code ' + code));
        return;
      }

      try {
        var parsed = JSON.parse(stdout);
        resolve(parsed.result || stdout);
      } catch (e) {
        // If JSON parsing fails, return raw stdout (text mode fallback)
        resolve(stdout.trim());
      }
    });
  });
}

/**
 * Format a multi-turn chat history into a single prompt for claude -p.
 * @param {Array} messages — [{role: 'user'|'assistant', content: '...'}]
 * @returns {string}
 */
function formatChatHistory(messages) {
  if (!messages.length) return '';

  return messages.map(function (m) {
    var prefix = m.role === 'user' ? 'User' : 'Assistant';
    return prefix + ': ' + m.content;
  }).join('\n\n');
}

/**
 * Stream Claude CLI output via SSE-style callbacks.
 * Uses --output-format streaming-json to get chunks as they arrive.
 */
function streamClaude({ systemPrompt, userMessage, webSearch = true, model, onChunk, onDone, onError }) {
  var prompt = systemPrompt
    ? '<instructions>\n' + systemPrompt + '\n</instructions>\n\n' + userMessage
    : userMessage;

  var args = ['-p', '-', '--output-format', 'stream-json', '--verbose'];
  if (model) args.push('--model', model);
  if (webSearch) args.push('--allowedTools', 'WebSearch,WebFetch');

  var proc = spawn(CLAUDE_BIN, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  var lineBuffer = '';
  var lastText = '';
  var finished = false;
  var timedOut = false;

  var TIMEOUT_MS = 3 * 60 * 1000;
  var timer = setTimeout(function () {
    timedOut = true;
    proc.kill('SIGTERM');
    setTimeout(function () { try { proc.kill('SIGKILL'); } catch(e) {} }, 5000);
  }, TIMEOUT_MS);

  proc.stdout.on('data', function (data) {
    lineBuffer += data.toString();
    var lines = lineBuffer.split('\n');
    lineBuffer = lines.pop(); // keep incomplete trailing line

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      try {
        var event = JSON.parse(line);
        if (event.type === 'assistant' && event.message && Array.isArray(event.message.content)) {
          var text = '';
          for (var j = 0; j < event.message.content.length; j++) {
            if (event.message.content[j].type === 'text') text += event.message.content[j].text;
          }
          if (text.length > lastText.length) {
            onChunk(text.slice(lastText.length));
            lastText = text;
          }
        } else if (event.type === 'result' && !finished) {
          finished = true;
          onDone(event.result || lastText);
        }
      } catch (e) { /* skip malformed lines */ }
    }
  });

  proc.stdin.write(prompt);
  proc.stdin.end();

  var stderr = '';
  proc.stderr.on('data', function (d) { stderr += d.toString(); });

  proc.on('error', function (err) { clearTimeout(timer); onError(err); });
  proc.on('close', function (code, signal) {
    clearTimeout(timer);
    console.log('[streamClaude] close code=' + code + ' signal=' + signal + ' stderr=' + stderr.slice(0, 300));
    if (finished) return;
    if (timedOut) {
      onError(new Error('Claude CLI timed out after ' + (TIMEOUT_MS / 1000) + 's'));
      return;
    }
    if (code !== 0 || code === null) {
      onError(new Error('claude exited with code ' + code + (signal ? ' signal=' + signal : '') + (stderr ? ' | ' + stderr.slice(0, 200) : '')));
    } else {
      onDone(lastText);
    }
  });

  return proc;
}

module.exports = { callClaude, streamClaude, formatChatHistory };
