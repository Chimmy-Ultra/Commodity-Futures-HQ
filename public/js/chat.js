/* chat.js — Chat panel logic */

var ChatManager = (function () {
  var STORAGE_KEY = 'commodity-hq-chat-memory-v1';
  var convos = {};
  var activeChar = null;
  var isLoading = false;

  function blankConvos() {
    var s = {};
    CHARS.forEach(function (c) { s[c.id] = []; });
    return s;
  }

  function sanitizeMsgs(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (m) {
      return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
    }).map(function (m) { return { role: m.role, content: m.content }; });
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return blankConvos();
      var parsed = JSON.parse(raw);
      var state = blankConvos();
      CHARS.forEach(function (c) { state[c.id] = sanitizeMsgs(parsed[c.id]); });
      return state;
    } catch (e) { return blankConvos(); }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(convos)); } catch (e) {}
  }

  convos = load();

  // Markdown setup
  marked.setOptions({
    breaks: true,
    highlight: function (code, lang) {
      if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
      return hljs.highlightAuto(code).value;
    }
  });

  function esc(t) {
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderMath(html) {
    // Protect <code> and <pre> blocks from math processing
    var codeBlocks = [];
    html = html.replace(/<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>/g, function (m) {
      codeBlocks.push(m);
      return '%%CODE_BLOCK_' + (codeBlocks.length - 1) + '%%';
    });

    // Block math: $$...$$
    html = html.replace(/\$\$([\s\S]+?)\$\$/g, function (_, tex) {
      try { return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false }); }
      catch (e) { return '$$' + tex + '$$'; }
    });

    // Inline math: $...$  (not empty, not starting/ending with space)
    html = html.replace(/\$(\S[\s\S]*?\S|\S)\$/g, function (_, tex) {
      try { return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false }); }
      catch (e) { return '$' + tex + '$'; }
    });

    // Restore code blocks
    html = html.replace(/%%CODE_BLOCK_(\d+)%%/g, function (_, i) {
      return codeBlocks[parseInt(i)];
    });

    return html;
  }

  function md(t) {
    var html = renderMath(marked.parse(t));
    return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(html, { ADD_TAGS: ['annotation', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'mspace', 'mtext', 'math'], ADD_ATTR: ['xmlns', 'encoding', 'mathvariant', 'displaystyle', 'scriptlevel'] }) : html;
  }

  function getMsgsEl() { return document.getElementById('chat-messages'); }
  function getInputEl() { return document.getElementById('chat-input'); }
  function getSendBtn() { return document.getElementById('send-btn'); }
  function getClearBtn() { return document.getElementById('chat-clear-btn'); }

  function syncControls() {
    var hasHistory = !!(activeChar && convos[activeChar.id] && convos[activeChar.id].length);
    getClearBtn().disabled = !hasHistory || isLoading;
    getSendBtn().disabled = isLoading;
  }

  function renderMessages(cid) {
    var el = getMsgsEl();
    el.innerHTML = '';
    var h = convos[cid];
    if (!h || !h.length) {
      el.innerHTML = '<div class="msg assistant"><p style="color:var(--text-hint);font-style:italic">Start a conversation about markets...</p></div>';
      syncControls();
      return;
    }
    var avatarHtml = activeChar && activeChar.avatar ? '<img src="' + activeChar.avatar + '" alt=""' + (activeChar.avatarContain ? ' class="avatar-contain"' : '') + ' width="28" height="28">' : '';
    h.forEach(function (m) {
      var d = document.createElement('div');
      d.className = 'msg ' + m.role;
      if (m.role === 'assistant') {
        d.innerHTML = '<div class="msg-avatar">' + avatarHtml + '</div>'
          + '<div class="msg-content">' + md(m.content) + '</div>';
      } else {
        d.innerHTML = '<div class="msg-content">' + esc(m.content) + '</div>';
      }
      el.appendChild(d);
    });
    el.scrollTop = el.scrollHeight;
    syncControls();
  }

  function addLoader() {
    var d = document.createElement('div');
    d.className = 'msg assistant loading';
    d.id = 'chat-loader';
    var avatarHtml = activeChar && activeChar.avatar ? '<img src="' + activeChar.avatar + '" alt=""' + (activeChar.avatarContain ? ' class="avatar-contain"' : '') + ' width="28" height="28">' : '';
    d.innerHTML = '<div class="msg-avatar">' + avatarHtml + '</div>'
      + '<div class="msg-content"><div class="loading-dots"><span></span><span></span><span></span></div></div>';
    getMsgsEl().appendChild(d);
    getMsgsEl().scrollTop = getMsgsEl().scrollHeight;
  }

  function removeLoader() {
    var e = document.getElementById('chat-loader');
    if (e) e.remove();
  }

  function send() {
    if (isLoading || !activeChar) return;
    var input = getInputEl();
    var text = input.value.trim();
    if (!text) return;

    var cid = activeChar.id;
    convos[cid].push({ role: 'user', content: text });
    save();
    input.value = '';
    input.style.height = 'auto';
    renderMessages(cid);
    isLoading = true;
    syncControls();
    addLoader();

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: cid, messages: convos[cid] })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        convos[cid].push({ role: 'assistant', content: d.error ? 'Error: ' + d.error : d.response });
        save();
      })
      .catch(function (err) {
        convos[cid].push({ role: 'assistant', content: 'Error: ' + err.message });
        save();
      })
      .finally(function () {
        removeLoader();
        isLoading = false;
        if (activeChar && activeChar.id === cid) renderMessages(cid);
        syncControls();
        if (activeChar && activeChar.id === cid) getInputEl().focus();
      });
  }

  function clearConversation() {
    if (!activeChar || isLoading || !convos[activeChar.id].length) return;
    if (!window.confirm('Clear the saved conversation with ' + activeChar.name + '?')) return;
    convos[activeChar.id] = [];
    save();
    renderMessages(activeChar.id);
  }

  function open(char) {
    activeChar = char;
    document.getElementById('welcome').style.display = 'none';
    document.getElementById('analysis-panel').classList.remove('visible');
    var rp = document.getElementById('report-panel');
    if (rp) rp.classList.remove('visible');
    var kp = document.getElementById('kline-panel');
    if (kp) kp.classList.remove('visible');
    var dp = document.getElementById('databento-panel');
    if (dp) dp.classList.remove('visible');
    document.getElementById('chat-area').classList.add('visible');

    // Populate chat header
    var headerAvatar = document.getElementById('chat-header-avatar');
    var headerName = document.getElementById('chat-header-name');
    var headerRole = document.getElementById('chat-header-role');
    if (headerAvatar) headerAvatar.innerHTML = char.avatar ? '<img src="' + char.avatar + '" alt="" width="36" height="36">' : '';
    if (headerName) headerName.textContent = char.name;
    if (headerRole) headerRole.textContent = char.role;

    renderMessages(char.id);
    QuoteManager.show(char);
    setTimeout(function () { getInputEl().focus(); }, 100);
  }

  function getActiveChar() { return activeChar; }

  // Wire up events
  document.addEventListener('DOMContentLoaded', function () {
    getSendBtn().addEventListener('click', send);
    getClearBtn().addEventListener('click', clearConversation);

    var input = getInputEl();
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 110) + 'px';
    });
  });

  function clearAll() {
    if (!window.confirm('Delete ALL chat history with every employee? This cannot be undone.')) return;
    convos = blankConvos();
    save();
    if (activeChar) renderMessages(activeChar.id);
  }

  return { open: open, getActiveChar: getActiveChar, clearAll: clearAll };
})();
