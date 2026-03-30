/* group-chat.js — Group Discussion Room: multi-agent simultaneous discussion */

var GroupChatManager = (function () {
  var selectedIds = [];
  var isRunning = false;
  var abortController = null;

  function el(id) { return document.getElementById(id); }

  function getChar(id) {
    for (var i = 0; i < CHARS.length; i++) {
      if (CHARS[i].id === id) return CHARS[i];
    }
    return null;
  }

  function buildCharGrid() {
    var grid = el('gc-char-grid');
    if (!grid) return;

    // Exclude non-discussion characters (casino games only)
    var discussionChars = CHARS.filter(function (c) {
      return c.id !== 'claude'; // Claude can be included if wanted, but let's keep it
    });

    var html = '';
    discussionChars.forEach(function (c) {
      var avatarUrl = c.avatar;
      var contain = c.avatarContain ? ' avatar-contain' : '';
      html += '<label class="gc-char-option" data-id="' + c.id + '">';
      html += '<input type="checkbox" value="' + c.id + '" class="gc-checkbox">';
      html += '<img src="' + avatarUrl + '" class="gc-char-avatar' + contain + '" alt="' + c.name + '">';
      html += '<div class="gc-char-name">' + c.name + '</div>';
      html += '<div class="gc-char-role">' + c.role + '</div>';
      html += '</label>';
    });
    grid.innerHTML = html;

    // Attach checkbox listeners
    grid.querySelectorAll('.gc-checkbox').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var label = cb.closest('.gc-char-option');
        if (cb.checked) {
          if (selectedIds.length >= 5) {
            cb.checked = false;
            return;
          }
          selectedIds.push(cb.value);
          label.classList.add('selected');
        } else {
          selectedIds = selectedIds.filter(function (id) { return id !== cb.value; });
          label.classList.remove('selected');
        }
        updateStartBtn();
      });
    });
  }

  function updateStartBtn() {
    var btn = el('gc-start');
    var topic = el('gc-topic');
    if (btn) {
      btn.disabled = selectedIds.length < 2 || isRunning || !topic || !topic.value.trim();
      btn.textContent = isRunning ? 'Discussing...' : '\uD83D\uDDE3\uFE0F Start Discussion (' + selectedIds.length + '/5)';
    }
  }

  function addMessage(charId, name, color, avatarHtml, content) {
    var container = el('gc-messages');
    if (!container) return;

    var div = document.createElement('div');
    div.className = 'gc-message';
    div.innerHTML =
      '<div class="gc-msg-avatar">' + avatarHtml + '</div>' +
      '<div class="gc-msg-body">' +
      '<div class="gc-msg-name" style="color:' + color + '">' + name + '</div>' +
      '<div class="gc-msg-content">' + DOMPurify.sanitize(marked.parse(content)) + '</div>' +
      '</div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function addTypingIndicator(name, color) {
    var container = el('gc-messages');
    if (!container) return;
    var div = document.createElement('div');
    div.className = 'gc-typing';
    div.id = 'gc-typing-indicator';
    div.innerHTML = '<span style="color:' + color + ';font-weight:600">' + name + '</span> is thinking...';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function removeTypingIndicator() {
    var ind = el('gc-typing-indicator');
    if (ind) ind.remove();
  }

  async function startDiscussion() {
    var topic = el('gc-topic').value.trim();
    if (!topic || selectedIds.length < 2 || isRunning) return;

    isRunning = true;
    updateStartBtn();

    // Clear messages
    var container = el('gc-messages');
    container.innerHTML = '';

    // Show topic as system message
    var topicDiv = document.createElement('div');
    topicDiv.className = 'gc-system-msg';
    topicDiv.textContent = '\uD83D\uDCDD Topic: ' + topic;
    container.appendChild(topicDiv);

    try {
      var res = await fetch('/api/group-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterIds: selectedIds, topic: topic }),
      });

      if (!res.ok) {
        var errData = await res.json().catch(function () { return {}; });
        throw new Error(errData.error || 'Request failed');
      }

      // SSE stream
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      while (true) {
        var result = await reader.read();
        if (result.done) break;

        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        var currentEvent = null;
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7);
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              var data = JSON.parse(line.substring(6));
              handleSSE(currentEvent, data);
            } catch (e) { /* skip parse errors */ }
            currentEvent = null;
          }
        }
      }
    } catch (err) {
      var errDiv = document.createElement('div');
      errDiv.className = 'gc-system-msg gc-error';
      errDiv.textContent = 'Error: ' + err.message;
      container.appendChild(errDiv);
    } finally {
      removeTypingIndicator();
      isRunning = false;
      updateStartBtn();
    }
  }

  function handleSSE(event, data) {
    if (event === 'agent_start') {
      var c = getChar(data.characterId);
      if (c) addTypingIndicator(c.name, c.color);
    } else if (event === 'agent_done') {
      removeTypingIndicator();
      var c = getChar(data.characterId);
      if (c) {
        var avatarHtml = window.avatarImg ? window.avatarImg(c.avatar, 36, c.avatarContain) : '';
        addMessage(c.id, c.name, c.color, avatarHtml, data.response);
      }
    } else if (event === 'agent_error') {
      removeTypingIndicator();
      var errDiv = document.createElement('div');
      errDiv.className = 'gc-system-msg gc-error';
      errDiv.textContent = (data.name || data.characterId) + ' failed: ' + (data.error || 'Unknown error');
      el('gc-messages').appendChild(errDiv);
    }
  }

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

    el('groupchat-panel').classList.add('visible');
    if (!el('gc-char-grid').children.length) buildCharGrid();
  }

  function hide() {
    el('groupchat-panel').classList.remove('visible');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var closeBtn = el('gc-close');
    if (closeBtn) closeBtn.addEventListener('click', function () {
      hide();
      document.getElementById('welcome').style.display = '';
    });

    var startBtn = el('gc-start');
    if (startBtn) startBtn.addEventListener('click', startDiscussion);

    var topicInput = el('gc-topic');
    if (topicInput) {
      topicInput.addEventListener('input', updateStartBtn);
      topicInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          startDiscussion();
        }
      });
    }
  });

  return { show: show, hide: hide };
})();
