/* roulette.js — Roulette minigame */

var Roulette = (function () {
  // European roulette: 0-36
  var RED_NUMS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  var flavorLines = [
    'Claude insists the wheel is constitutionally fair.',
    'Dario says betting on red is just bounded optimization with style.',
    'Sam keeps implying AGI would count as an inside bet.',
    'Gary placed a bet yesterday. It still hasn\'t settled.',
  ];

  var state = {
    balance: 1000,
    bets: {},       // { '17': 50, 'red': 100, ... }
    chipSize: 10,
    spinning: false,
    lastResult: null,
  };

  function el(id) { return document.getElementById(id); }

  function isRed(n) { return RED_NUMS.indexOf(n) !== -1; }
  function numColor(n) { return n === 0 ? 'green' : isRed(n) ? 'red' : 'black'; }

  function totalBet() {
    var sum = 0;
    for (var k in state.bets) sum += state.bets[k];
    return sum;
  }

  // Evaluate bets against result
  function evaluate(result) {
    var payout = 0;
    for (var key in state.bets) {
      var amt = state.bets[key];
      var win = false;
      var mult = 0;

      // Single number
      if (/^\d+$/.test(key)) {
        if (parseInt(key, 10) === result) { win = true; mult = 35; }
      }
      // Red / Black
      else if (key === 'red') { if (result > 0 && isRed(result)) { win = true; mult = 1; } }
      else if (key === 'black') { if (result > 0 && !isRed(result)) { win = true; mult = 1; } }
      // Odd / Even
      else if (key === 'odd') { if (result > 0 && result % 2 === 1) { win = true; mult = 1; } }
      else if (key === 'even') { if (result > 0 && result % 2 === 0) { win = true; mult = 1; } }
      // High / Low
      else if (key === 'low') { if (result >= 1 && result <= 18) { win = true; mult = 1; } }
      else if (key === 'high') { if (result >= 19 && result <= 36) { win = true; mult = 1; } }
      // Dozens
      else if (key === 'doz1') { if (result >= 1 && result <= 12) { win = true; mult = 2; } }
      else if (key === 'doz2') { if (result >= 13 && result <= 24) { win = true; mult = 2; } }
      else if (key === 'doz3') { if (result >= 25 && result <= 36) { win = true; mult = 2; } }
      // Columns
      else if (key === 'col1') { if (result > 0 && result % 3 === 1) { win = true; mult = 2; } }
      else if (key === 'col2') { if (result > 0 && result % 3 === 2) { win = true; mult = 2; } }
      else if (key === 'col3') { if (result > 0 && result % 3 === 0) { win = true; mult = 2; } }

      if (win) payout += amt + amt * mult;
    }
    return payout;
  }

  function render() {
    el('rl-balance').textContent = state.balance;

    // Update chip badges on board
    var cells = document.querySelectorAll('.rl-cell');
    cells.forEach(function (cell) {
      var key = cell.dataset.bet;
      var badge = cell.querySelector('.rl-bet-badge');
      if (state.bets[key]) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'rl-bet-badge';
          cell.appendChild(badge);
        }
        badge.textContent = state.bets[key];
        cell.classList.add('has-bet');
      } else {
        if (badge) badge.remove();
        cell.classList.remove('has-bet');
      }
    });

    // Buttons
    el('rl-spin').disabled = state.spinning || totalBet() === 0;
    el('rl-clear').disabled = state.spinning || totalBet() === 0;
  }

  function buildBoard() {
    var board = el('rl-board');
    board.innerHTML = '';

    // Number grid: 3 rows × 12 cols + 0
    // Layout: row 0 (top) = 3,6,9,...,36 | row 1 = 2,5,8,...,35 | row 2 = 1,4,7,...,34
    var grid = document.createElement('div');
    grid.className = 'rl-grid';

    // Zero cell
    var zero = document.createElement('div');
    zero.className = 'rl-cell rl-zero green';
    zero.dataset.bet = '0';
    zero.textContent = '0';
    zero.addEventListener('click', placeBet);
    grid.appendChild(zero);

    // Number cells
    for (var row = 0; row < 3; row++) {
      for (var col = 0; col < 12; col++) {
        var n = (col * 3) + (3 - row);
        var cell = document.createElement('div');
        cell.className = 'rl-cell rl-num ' + numColor(n);
        cell.dataset.bet = String(n);
        cell.textContent = n;
        cell.style.gridRow = (row + 1);
        cell.style.gridColumn = (col + 2);
        cell.addEventListener('click', placeBet);
        grid.appendChild(cell);
      }
    }

    // Column bets (right side)
    ['col3', 'col2', 'col1'].forEach(function (key, i) {
      var cell = document.createElement('div');
      cell.className = 'rl-cell rl-col';
      cell.dataset.bet = key;
      cell.textContent = '2:1';
      cell.style.gridRow = (i + 1);
      cell.style.gridColumn = 14;
      cell.addEventListener('click', placeBet);
      grid.appendChild(cell);
    });

    board.appendChild(grid);

    // Bottom bets
    var bottom = document.createElement('div');
    bottom.className = 'rl-bottom';

    var dozens = [
      { key: 'doz1', label: '1st 12' },
      { key: 'doz2', label: '2nd 12' },
      { key: 'doz3', label: '3rd 12' },
    ];
    var dRow = document.createElement('div');
    dRow.className = 'rl-bottom-row rl-dozens';
    dozens.forEach(function (d) {
      var cell = document.createElement('div');
      cell.className = 'rl-cell rl-doz';
      cell.dataset.bet = d.key;
      cell.textContent = d.label;
      cell.addEventListener('click', placeBet);
      dRow.appendChild(cell);
    });
    bottom.appendChild(dRow);

    var outsides = [
      { key: 'low', label: '1-18' },
      { key: 'even', label: 'EVEN' },
      { key: 'red', label: 'RED', cls: 'red' },
      { key: 'black', label: 'BLK', cls: 'black' },
      { key: 'odd', label: 'ODD' },
      { key: 'high', label: '19-36' },
    ];
    var oRow = document.createElement('div');
    oRow.className = 'rl-bottom-row rl-outsides';
    outsides.forEach(function (o) {
      var cell = document.createElement('div');
      cell.className = 'rl-cell rl-out' + (o.cls ? ' ' + o.cls : '');
      cell.dataset.bet = o.key;
      cell.textContent = o.label;
      cell.addEventListener('click', placeBet);
      oRow.appendChild(cell);
    });
    bottom.appendChild(oRow);

    board.appendChild(bottom);
  }

  function placeBet(e) {
    if (state.spinning) return;
    var key = e.currentTarget.dataset.bet;
    if (state.balance < state.chipSize) {
      el('rl-status').textContent = 'Not enough balance!';
      return;
    }
    if (!state.bets[key]) state.bets[key] = 0;
    state.bets[key] += state.chipSize;
    state.balance -= state.chipSize;
    el('rl-status').textContent = 'Bet ' + state.chipSize + ' on ' + key + '. Total bet: ' + totalBet();
    render();
  }

  function clearBets() {
    if (state.spinning) return;
    state.balance += totalBet();
    state.bets = {};
    el('rl-status').textContent = 'Bets cleared.';
    render();
  }

  function spin() {
    if (state.spinning || totalBet() === 0) return;
    state.spinning = true;
    render();

    var result = Math.floor(Math.random() * 37);
    var numEl = el('rl-result-num');
    var labelEl = el('rl-result-label');
    var resultBox = el('rl-result');

    numEl.textContent = '--';
    labelEl.textContent = 'Spinning...';
    resultBox.className = 'rl-result spinning';
    el('rl-status').textContent = 'No more bets!';

    // Spinner animation
    var ticks = 0;
    var maxTicks = 35;
    var interval = setInterval(function () {
      var rnd = Math.floor(Math.random() * 37);
      numEl.textContent = rnd;
      numEl.className = 'rl-result-num ' + numColor(rnd);
      ticks++;
      if (ticks >= maxTicks) {
        clearInterval(interval);
        // Final result
        numEl.textContent = result;
        numEl.className = 'rl-result-num ' + numColor(result);
        labelEl.textContent = result === 0 ? 'GREEN 0' : (isRed(result) ? 'RED' : 'BLACK') + ' ' + result;
        resultBox.className = 'rl-result landed ' + numColor(result);

        var payout = evaluate(result);
        state.balance += payout;
        state.lastResult = result;

        if (payout > 0) {
          el('rl-status').textContent = result + ' ' + (result === 0 ? 'Green' : isRed(result) ? 'Red' : 'Black') + '! You win ' + payout + '!';
        } else {
          el('rl-status').textContent = result + ' ' + (result === 0 ? 'Green' : isRed(result) ? 'Red' : 'Black') + '. No winners this round.';
        }

        state.bets = {};
        state.spinning = false;
        render();
      }
    }, 60);
  }

  function selectChip(val) {
    state.chipSize = val;
    var chips = document.querySelectorAll('.rl-chip');
    chips.forEach(function (c) {
      c.classList.toggle('active', parseInt(c.dataset.val, 10) === val);
    });
  }

  function open() {
    state.balance = state.balance || 1000;
    state.bets = {};
    state.spinning = false;
    el('rl-flavor').textContent = flavorLines[Math.floor(Math.random() * flavorLines.length)];
    el('rl-result-num').textContent = '\u2014';
    el('rl-result-num').className = 'rl-result-num';
    el('rl-result-label').textContent = 'Place your bets';
    el('rl-result').className = 'rl-result';
    el('rl-status').textContent = 'Click a number or area to place a bet.';
    buildBoard();
    render();
    el('roulette-overlay').classList.add('open');
  }

  function close() {
    el('roulette-overlay').classList.remove('open');
  }

  document.addEventListener('DOMContentLoaded', function () {
    el('rl-close').addEventListener('click', close);
    el('rl-backdrop').addEventListener('click', close);
    el('rl-spin').addEventListener('click', spin);
    el('rl-clear').addEventListener('click', clearBets);

    document.querySelectorAll('.rl-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        selectChip(parseInt(chip.dataset.val, 10));
      });
    });
  });

  return { open: open, close: close };
})();
