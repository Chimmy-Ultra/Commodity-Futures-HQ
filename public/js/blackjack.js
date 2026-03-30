/* blackjack.js — Blackjack minigame */

var Blackjack = (function () {
  var SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];
  var uid = 0;
  var runToken = 0;
  var flavorLines = [
    'Dario is dealing tonight and insists the shuffle is constitutionally aligned.',
    'Claude the dealer nods politely. Gary says counting cards sounds like cardio.',
    'Sam keeps calling basic strategy a temporary bridge to AGI.',
    'The table is live. Dario claims the house edge is just bounded optimization.',
  ];

  var state = {
    deck: [], dealer: [], player: [],
    dealerHidden: true, roundOver: false, busy: false,
    message: 'Press New Game to start.'
  };

  function el(id) { return document.getElementById(id); }

  function suitColor(s) { return s === '\u2665' || s === '\u2666' ? 'red' : ''; }

  function createDeck() {
    var ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    var deck = [];
    SUITS.forEach(function (suit) {
      ranks.forEach(function (rank) { deck.push({ rank: rank, suit: suit, id: 'c' + (++uid) }); });
    });
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    return deck;
  }

  function handValue(hand) {
    var total = 0, aces = 0;
    hand.forEach(function (card) {
      if (card.rank === 'A') { aces++; total += 11; }
      else if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') total += 10;
      else total += parseInt(card.rank, 10);
    });
    while (total > 21 && aces) { total -= 10; aces--; }
    return { total: total, soft: aces > 0, blackjack: hand.length === 2 && total === 21 };
  }

  function renderCard(card, hidden) {
    if (hidden) return '<div class="playing-card hidden"></div>';
    return '<div class="playing-card ' + suitColor(card.suit) + '">' +
      '<div class="card-corner">' + card.rank + '<span>' + card.suit + '</span></div>' +
      '<div class="card-center">' + card.suit + '</div>' +
      '<div class="card-corner bottom">' + card.rank + '<span>' + card.suit + '</span></div></div>';
  }

  function refreshButtons() {
    var locked = state.busy || state.roundOver;
    el('blackjack-hit').disabled = locked;
    el('blackjack-stand').disabled = locked;
  }

  function render() {
    el('dealer-cards').innerHTML = '';
    el('player-cards').innerHTML = '';
    state.dealer.forEach(function (card, i) {
      el('dealer-cards').insertAdjacentHTML('beforeend', renderCard(card, state.dealerHidden && i === 0 && !state.roundOver));
    });
    state.player.forEach(function (card) {
      el('player-cards').insertAdjacentHTML('beforeend', renderCard(card, false));
    });
    el('dealer-total').textContent = 'Total: ' + (state.dealerHidden && !state.roundOver ? '?' : handValue(state.dealer).total);
    el('player-total').textContent = 'Total: ' + handValue(state.player).total;
    el('blackjack-status').textContent = state.message;
    refreshButtons();
    var handsEl = el('dealer-cards').closest('.bj-hands');
    if (handsEl) handsEl.scrollTop = handsEl.scrollHeight;
  }

  function finishRound(msg) {
    state.roundOver = true;
    state.busy = false;
    state.dealerHidden = false;
    state.message = msg;
    render();
  }

  function compareHands() {
    var p = handValue(state.player), d = handValue(state.dealer);
    if (d.total > 21) finishRound('Dealer busts. You win!');
    else if (p.total > d.total) finishRound('You win. Claude concedes with suspicious grace.');
    else if (p.total < d.total) finishRound('Dealer wins this hand.');
    else finishRound('Push. Nobody wins the pot.');
  }

  function dealerTurn() {
    if (state.roundOver) return;
    runToken++;
    var token = runToken;
    state.busy = true;
    state.dealerHidden = false;
    state.message = 'Claude reveals the hole card...';
    render();

    setTimeout(function step() {
      if (token !== runToken) return;
      var d = handValue(state.dealer);
      if (d.total < 17) {
        state.dealer.push(state.deck.pop());
        state.message = 'Claude draws...';
        render();
        if (handValue(state.dealer).total > 21) { finishRound('Dealer busts. You win!'); return; }
        setTimeout(step, 320);
        return;
      }
      state.busy = false;
      compareHands();
    }, 260);
  }

  function openingCheck() {
    var p = handValue(state.player), d = handValue(state.dealer);
    if (p.blackjack || d.blackjack) {
      if (p.blackjack && d.blackjack) finishRound('Push. Both opened with blackjack.');
      else if (p.blackjack) finishRound('Blackjack! You win instantly.');
      else finishRound('Dealer blackjack. Claude takes the hand.');
    } else {
      state.message = 'Your move. Hit or stand.';
      render();
    }
  }

  function newGame() {
    runToken++;
    state.deck = createDeck();
    state.dealer = [];
    state.player = [];
    state.dealerHidden = true;
    state.roundOver = false;
    state.busy = false;
    state.message = 'Cards are on the felt. Your move.';
    el('blackjack-flavor').textContent = flavorLines[Math.floor(Math.random() * flavorLines.length)];
    state.player.push(state.deck.pop());
    state.dealer.push(state.deck.pop());
    state.player.push(state.deck.pop());
    state.dealer.push(state.deck.pop());
    render();
    openingCheck();
  }

  function hit() {
    if (state.busy || state.roundOver) return;
    state.player.push(state.deck.pop());
    var p = handValue(state.player);
    if (p.total > 21) { finishRound('Bust. The hand goes to Claude.'); return; }
    if (p.total === 21) { state.message = '21. Claude now plays the dealer hand.'; render(); dealerTurn(); return; }
    state.message = 'You can hit again or stand.';
    render();
  }

  function stand() {
    if (state.busy || state.roundOver) return;
    state.message = 'You stand.';
    render();
    dealerTurn();
  }

  function open() {
    el('blackjack-overlay').classList.add('open');
    newGame();
  }

  function close() {
    runToken++;
    el('blackjack-overlay').classList.remove('open');
  }

  // Wire up events
  document.addEventListener('DOMContentLoaded', function () {
    el('blackjack-hit').addEventListener('click', hit);
    el('blackjack-stand').addEventListener('click', stand);
    el('blackjack-new').addEventListener('click', newGame);
    el('blackjack-close').addEventListener('click', close);
    el('bj-backdrop').addEventListener('click', close);
  });

  return { open: open, close: close };
})();
