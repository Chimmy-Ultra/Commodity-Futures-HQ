/* quotes.js — Live market quote panel */

var QuoteManager = (function () {
  var cache = {};
  var errors = {};
  var retryAt = {};
  var pendingId = null;
  var requestToken = 0;
  var currentCharId = null;

  var els = {
    panel: function () { return document.getElementById('quote-panel'); },
    title: function () { return document.getElementById('quote-title'); },
    source: function () { return document.getElementById('quote-source'); },
    status: function () { return document.getElementById('quote-status'); },
    grid: function () { return document.getElementById('quote-grid'); },
  };

  function esc(t) {
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatFixed(v, p) {
    return Number(v).toLocaleString(undefined, { minimumFractionDigits: p, maximumFractionDigits: p });
  }

  function formatPrice(q) {
    if (typeof q.price !== 'number') return 'N/A';
    var p = typeof q.precision === 'number' ? q.precision : (Math.abs(q.price) >= 100 ? 2 : 3);
    return formatFixed(q.price, p);
  }

  function formatChange(q) {
    if (typeof q.change !== 'number' && typeof q.changePercent !== 'number') return 'No change';
    var parts = [];
    var p = typeof q.precision === 'number' ? q.precision : 2;
    if (typeof q.change === 'number') parts.push((q.change > 0 ? '+' : '') + formatFixed(q.change, p));
    if (typeof q.changePercent === 'number') parts.push('(' + (q.changePercent > 0 ? '+' : '') + q.changePercent.toFixed(2) + '%)');
    return parts.join(' ');
  }

  function tone(q) {
    if (typeof q.change !== 'number') return 'flat';
    return q.change > 0 ? 'up' : q.change < 0 ? 'down' : 'flat';
  }

  function formatUpdated(ts, stale) {
    var label = 'Live market snapshot';
    if (ts) {
      var diff = Math.max(0, Date.now() - new Date(ts).getTime());
      label = diff < 60000 ? 'Updated just now' : 'Updated ' + Math.round(diff / 60000) + 'm ago';
    }
    return stale ? label + ' (cached)' : label;
  }

  function showLoading(name) {
    els.title().textContent = name + ' live markets';
    els.source().textContent = 'Yahoo Finance';
    els.status().textContent = 'Loading latest prices...';
    els.status().className = 'quote-status loading';
    els.grid().innerHTML = '';
    els.panel().classList.add('visible');
  }

  function showError(name, msg) {
    els.title().textContent = name + ' live markets';
    els.source().textContent = 'Live quotes';
    els.status().textContent = msg || 'Unable to load live market data.';
    els.status().className = 'quote-status error';
    els.grid().innerHTML = '';
    els.panel().classList.add('visible');
  }

  function render(char, payload) {
    els.title().textContent = char.name + ' live markets';
    els.source().textContent = payload.source || 'Live quotes';
    els.status().textContent = payload.note || formatUpdated(payload.updatedAt, payload.stale);
    els.status().className = 'quote-status' + (payload.stale ? ' stale' : '');
    els.grid().innerHTML = '';

    if (!payload.quotes || !payload.quotes.length) {
      els.status().textContent = 'No live market coverage configured.';
      els.panel().classList.add('visible');
      return;
    }

    payload.quotes.forEach(function (q) {
      var card = document.createElement('div');
      card.className = 'quote-card';
      card.innerHTML =
        '<div class="quote-top"><div class="quote-name">' + esc(q.label) + '</div><div class="quote-symbol">' + esc(q.symbol) + '</div></div>' +
        '<div class="quote-price-row"><div class="quote-price">' + formatPrice(q) + '</div><div class="quote-change ' + tone(q) + '">' + esc(formatChange(q)) + '</div></div>' +
        '<div class="quote-meta">' + esc(q.unit || q.currency || q.marketState || 'Live quote') + '</div>';
      els.grid().appendChild(card);
    });
    els.panel().classList.add('visible');
  }

  function fetchQuotes(char, force) {
    var cid = char.id;
    var now = Date.now();
    var cached = cache[cid];

    if (!force && cached && now - cached.fetchedAt < 45000) {
      render(char, cached.payload);
      return;
    }
    if (pendingId === cid) return;

    pendingId = cid;
    showLoading(char.name);
    var token = ++requestToken;

    fetch('/api/quotes/' + encodeURIComponent(cid))
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) { return { ok: r.ok, data: data }; });
      })
      .then(function (result) {
        if (token !== requestToken || currentCharId !== cid) return;
        if (!result.ok) throw new Error(result.data.error || 'Live data unavailable.');
        cache[cid] = { payload: result.data, fetchedAt: Date.now() };
        delete errors[cid];
        delete retryAt[cid];
        render(char, result.data);
      })
      .catch(function (error) {
        if (token !== requestToken || currentCharId !== cid) return;
        errors[cid] = error.message || 'Live data unavailable.';
        retryAt[cid] = Date.now() + 15000;
        showError(char.name, errors[cid]);
      })
      .finally(function () {
        if (pendingId === cid) pendingId = null;
      });
  }

  function show(char) {
    if (!char || char.livePanel === false) {
      hide();
      return;
    }
    currentCharId = char.id;

    if (cache[char.id]) {
      render(char, cache[char.id].payload);
      if (Date.now() - cache[char.id].fetchedAt > 45000 && (!retryAt[char.id] || Date.now() >= retryAt[char.id])) {
        fetchQuotes(char, true);
      }
    } else if (retryAt[char.id] && Date.now() < retryAt[char.id] && errors[char.id]) {
      showError(char.name, errors[char.id]);
    } else {
      fetchQuotes(char, false);
    }
  }

  function hide() {
    currentCharId = null;
    pendingId = null;
    requestToken++;
    els.grid().innerHTML = '';
    els.panel().classList.remove('visible');
  }

  // Bind close button
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('quote-close');
    if (btn) btn.addEventListener('click', function () { hide(); });
  });

  return { show: show, hide: hide };
})();
