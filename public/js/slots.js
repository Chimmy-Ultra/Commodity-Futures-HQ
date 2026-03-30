/* slots.js — Slot machine minigame */

var Slots = (function () {
  var SYMBOLS = ['\u2B50', '7\uFE0F\u20E3', '\uD83D\uDC8E', '\uD83D\uDD14', '\uD83C\uDF52', '\uD83C\uDF4B'];
  // indices:    0=star    1=seven      2=diamond     3=bell       4=cherry     5=lemon
  var PAYOUTS = {
    0: 50,  // star
    1: 20,  // seven
    2: 10,  // diamond
    3: 5,   // bell
    4: 3,   // cherry
    5: 2,   // lemon
  };
  var REEL_LENGTH = 20; // virtual reel positions
  var SYMBOL_HEIGHT = 80;

  var flavorLines = [
    'Gary says the RNG is just vibes.',
    'Dario insists this machine has constitutional alignment baked in.',
    'Sam claims AGI will replace slot machines entirely. Unclear how.',
    'Claude deals the reels with suspicious fairness.',
  ];

  var state = {
    balance: 1000,
    bet: 10,
    spinning: false,
    reels: [0, 0, 0], // result symbol indices
  };

  function el(id) { return document.getElementById(id); }

  function buildReelStrip() {
    // Build a strip of symbols for visual spinning
    var strip = [];
    for (var i = 0; i < REEL_LENGTH; i++) {
      strip.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    }
    return strip;
  }

  function initReels() {
    for (var r = 0; r < 3; r++) {
      var reel = el('sl-reel-' + r);
      reel.innerHTML = '';
      var strip = buildReelStrip();
      strip.forEach(function (sym) {
        var div = document.createElement('div');
        div.className = 'sl-symbol';
        div.textContent = sym;
        reel.appendChild(div);
      });
      reel.style.transition = 'none';
      reel.style.transform = 'translateY(0)';
    }
  }

  function render() {
    el('sl-balance').textContent = state.balance;
    el('sl-pull').disabled = state.spinning || state.balance < state.bet;
  }

  function selectBet(val) {
    state.bet = val;
    document.querySelectorAll('.sl-bet-btn').forEach(function (b) {
      b.classList.toggle('active', parseInt(b.dataset.val, 10) === val);
    });
    render();
  }

  function pull() {
    if (state.spinning || state.balance < state.bet) return;
    state.spinning = true;
    state.balance -= state.bet;
    render();
    el('sl-status').textContent = 'Spinning...';

    // Pick 3 random results
    var results = [];
    for (var i = 0; i < 3; i++) {
      results.push(Math.floor(Math.random() * SYMBOLS.length));
    }
    state.reels = results;

    // Build new reel strips with the result at a known position
    for (var r = 0; r < 3; r++) {
      var reel = el('sl-reel-' + r);
      reel.innerHTML = '';

      // Build strip: random symbols + result symbol at the landing position
      var landPos = REEL_LENGTH - 3 + r; // stagger landing
      for (var j = 0; j < REEL_LENGTH + 5; j++) {
        var div = document.createElement('div');
        div.className = 'sl-symbol';
        if (j === landPos) {
          div.textContent = SYMBOLS[results[r]];
          div.classList.add('result');
        } else {
          div.textContent = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        }
        reel.appendChild(div);
      }

      // Reset position
      reel.style.transition = 'none';
      reel.style.transform = 'translateY(0)';
    }

    // Force reflow
    void el('sl-reel-0').offsetHeight;

    // Animate each reel with staggered timing
    var durations = [800, 1200, 1600];
    var stopped = 0;

    for (var r2 = 0; r2 < 3; r2++) {
      (function (idx) {
        var reel = el('sl-reel-' + idx);
        var landPos = REEL_LENGTH - 3 + idx;
        var offset = (landPos) * SYMBOL_HEIGHT;

        reel.style.transition = 'transform ' + durations[idx] + 'ms cubic-bezier(0.2, 0.8, 0.3, 1)';
        reel.style.transform = 'translateY(-' + offset + 'px)';

        setTimeout(function () {
          stopped++;
          if (stopped === 3) resolveResult(results);
        }, durations[idx] + 50);
      })(r2);
    }
  }

  function resolveResult(results) {
    var a = results[0], b = results[1], c = results[2];
    var payout = 0;
    var msg = '';

    if (a === b && b === c) {
      // Triple match
      var mult = PAYOUTS[a];
      payout = state.bet * mult;
      if (a === 0) msg = 'JACKPOT! ' + SYMBOLS[a] + SYMBOLS[a] + SYMBOLS[a] + ' \u2014 You win ' + payout + '!';
      else if (a === 1) msg = 'BIG WIN! ' + SYMBOLS[a] + SYMBOLS[a] + SYMBOLS[a] + ' \u2014 You win ' + payout + '!';
      else msg = SYMBOLS[a] + SYMBOLS[a] + SYMBOLS[a] + ' \u2014 You win ' + payout + '!';
    } else if (a === b || b === c || a === c) {
      // Pair — return bet
      payout = state.bet;
      var pair = a === b ? SYMBOLS[a] : (b === c ? SYMBOLS[b] : SYMBOLS[a]);
      msg = 'Pair of ' + pair + ' \u2014 bet returned.';
    } else {
      msg = 'No match. Better luck next spin!';
    }

    state.balance += payout;
    state.spinning = false;
    el('sl-status').textContent = msg;

    // Highlight win
    if (payout > 0) {
      var machine = document.querySelector('.sl-machine');
      machine.classList.add('win');
      setTimeout(function () { machine.classList.remove('win'); }, 1500);
    }

    render();

    if (state.balance <= 0) {
      el('sl-status').textContent = 'Broke! Resetting balance...';
      setTimeout(function () {
        state.balance = 1000;
        render();
        el('sl-status').textContent = 'Claude spotted you 1000. Pull the lever!';
      }, 2000);
    }
  }

  function open() {
    state.balance = state.balance || 1000;
    state.spinning = false;
    el('sl-flavor').textContent = flavorLines[Math.floor(Math.random() * flavorLines.length)];
    el('sl-status').textContent = 'Pull the lever to spin!';
    initReels();
    render();
    el('slots-overlay').classList.add('open');
  }

  function close() {
    el('slots-overlay').classList.remove('open');
  }

  document.addEventListener('DOMContentLoaded', function () {
    el('sl-close').addEventListener('click', close);
    el('sl-backdrop').addEventListener('click', close);
    el('sl-pull').addEventListener('click', pull);

    document.querySelectorAll('.sl-bet-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectBet(parseInt(btn.dataset.val, 10));
      });
    });
  });

  return { open: open, close: close };
})();
