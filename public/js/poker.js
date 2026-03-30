/* poker.js — Texas Hold'em with office colleagues */

var Poker = (function () {
  var SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];
  var RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  var RANK_VAL = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
  var HAND_NAMES = ['High Card','Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush','Royal Flush'];

  var SB = 10, BB = 20;
  var uid = 0;

  // AI personality profiles
  var AI_PROFILES = [
    { name: 'Gary', style: 'fish', desc: 'calls everything', foldRate: 0.1, raiseRate: 0.15, bluffRate: 0.05 },
    { name: 'Sophie', style: 'tight', desc: 'only plays premium', foldRate: 0.7, raiseRate: 0.25, bluffRate: 0.05 },
    { name: 'Wei', style: 'maniac', desc: 'bluffs constantly', foldRate: 0.2, raiseRate: 0.5, bluffRate: 0.4 },
    { name: 'Raj', style: 'balanced', desc: 'solid player', foldRate: 0.45, raiseRate: 0.3, bluffRate: 0.15 },
    { name: 'Max', style: 'math', desc: 'plays the odds', foldRate: 0.5, raiseRate: 0.35, bluffRate: 0.1 },
    { name: 'Ace', style: 'pro', desc: 'reads you like a book', foldRate: 0.4, raiseRate: 0.4, bluffRate: 0.2 },
    { name: 'Ming', style: 'newbie', desc: 'random plays', foldRate: 0.3, raiseRate: 0.2, bluffRate: 0.1 },
    { name: 'Zhang', style: 'oldschool', desc: 'gut-feel player', foldRate: 0.35, raiseRate: 0.3, bluffRate: 0.15 },
  ];

  var flavorLines = [
    'Gary brought snacks but forgot his poker face. Wei suspects the deck is rigged.',
    'Zhang tells everyone about the legendary 1998 poker night. Nobody asked.',
    'Sophie calculated your expected value before you sat down.',
    'Ace flips his coin. "Heads I raise, tails... I also raise."',
    'Ming is taking notes on everyone\'s betting patterns. On a napkin.',
    'Wei checked under the table for hidden cameras. Twice.',
  ];

  var state = {
    deck: [],
    community: [],
    pot: 0,
    players: [],    // [{name, chips, hand, folded, allIn, bet, style, profile, isHuman, acted}]
    dealerIdx: 0,
    currentIdx: 0,
    phase: 'idle',  // idle, preflop, flop, turn, river, showdown
    currentBet: 0,
    minRaise: BB,
    busy: false,
    message: 'Press New Game to start.',
    handNum: 0,
  };

  function el(id) { return document.getElementById(id); }
  function suitColor(s) { return s === '\u2665' || s === '\u2666' ? 'red' : ''; }

  function createDeck() {
    var deck = [];
    SUITS.forEach(function (s) {
      RANKS.forEach(function (r) { deck.push({ rank: r, suit: s, id: 'pk' + (++uid) }); });
    });
    // Fisher-Yates shuffle
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    return deck;
  }

  // ========== HAND EVALUATION ==========

  function evaluateHand(cards) {
    // Find best 5-card hand from 5-7 cards
    if (cards.length < 5) return { rank: 0, high: [0], name: 'High Card' };
    var combos = getCombinations(cards, 5);
    var best = null;
    combos.forEach(function (c) {
      var score = scoreHand(c);
      if (!best || compareScores(score, best) > 0) best = score;
    });
    return best;
  }

  function getCombinations(arr, k) {
    if (k === arr.length) return [arr.slice()];
    if (k === 1) return arr.map(function (x) { return [x]; });
    var results = [];
    function combo(start, chosen) {
      if (chosen.length === k) { results.push(chosen.slice()); return; }
      for (var i = start; i <= arr.length - (k - chosen.length); i++) {
        chosen.push(arr[i]);
        combo(i + 1, chosen);
        chosen.pop();
      }
    }
    combo(0, []);
    return results;
  }

  function scoreHand(five) {
    var vals = five.map(function (c) { return RANK_VAL[c.rank]; }).sort(function (a, b) { return b - a; });
    var suits = five.map(function (c) { return c.suit; });

    var flush = suits.every(function (s) { return s === suits[0]; });
    var straight = isStraight(vals);

    // Count values
    var counts = {};
    vals.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    var groups = Object.keys(counts).map(function (k) { return { val: parseInt(k), cnt: counts[k] }; });
    groups.sort(function (a, b) { return b.cnt - a.cnt || b.val - a.val; });

    var highCards = groups.map(function (g) { return g.val; });

    if (flush && straight) {
      var top = straightHigh(vals);
      return { rank: top === 14 ? 9 : 8, high: [top], name: top === 14 ? 'Royal Flush' : 'Straight Flush' };
    }
    if (groups[0].cnt === 4) return { rank: 7, high: highCards, name: 'Four of a Kind' };
    if (groups[0].cnt === 3 && groups[1].cnt === 2) return { rank: 6, high: highCards, name: 'Full House' };
    if (flush) return { rank: 5, high: vals, name: 'Flush' };
    if (straight) return { rank: 4, high: [straightHigh(vals)], name: 'Straight' };
    if (groups[0].cnt === 3) return { rank: 3, high: highCards, name: 'Three of a Kind' };
    if (groups[0].cnt === 2 && groups[1].cnt === 2) return { rank: 2, high: highCards, name: 'Two Pair' };
    if (groups[0].cnt === 2) return { rank: 1, high: highCards, name: 'Pair' };
    return { rank: 0, high: vals, name: 'High Card' };
  }

  function isStraight(sorted) {
    // Check normal straight
    for (var i = 0; i < sorted.length - 1; i++) {
      if (sorted[i] - sorted[i + 1] !== 1) {
        // Check wheel (A-2-3-4-5)
        if (sorted[0] === 14 && sorted[1] === 5 && sorted[2] === 4 && sorted[3] === 3 && sorted[4] === 2) return true;
        return false;
      }
    }
    return true;
  }

  function straightHigh(sorted) {
    if (sorted[0] === 14 && sorted[1] === 5) return 5; // wheel
    return sorted[0];
  }

  function compareScores(a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    for (var i = 0; i < Math.min(a.high.length, b.high.length); i++) {
      if (a.high[i] !== b.high[i]) return a.high[i] - b.high[i];
    }
    return 0;
  }

  // ========== HAND STRENGTH (for AI) ==========

  function handStrength(holeCards, communityCards) {
    // Simple: evaluate current hand, normalize rank 0-1
    var all = holeCards.concat(communityCards);
    if (all.length < 5) {
      // Pre-flop: use Chen formula approximation
      return preFlopStrength(holeCards);
    }
    var eval5 = evaluateHand(all);
    // Normalize: rank 0-9 → 0-1, with kicker bonus
    return Math.min(1, (eval5.rank * 0.1) + (eval5.high[0] / 140));
  }

  function preFlopStrength(hole) {
    var v1 = RANK_VAL[hole[0].rank], v2 = RANK_VAL[hole[1].rank];
    var high = Math.max(v1, v2), low = Math.min(v1, v2);
    var suited = hole[0].suit === hole[1].suit;
    var pair = v1 === v2;

    var score = 0;
    if (pair) {
      score = high * 2;
      if (high >= 11) score += 10; // premium pair bonus
    } else {
      score = high * 1.5 + low * 0.5;
      if (suited) score += 3;
      var gap = high - low;
      if (gap <= 2) score += 2;
      if (high >= 14) score += 4; // ace bonus
    }
    return Math.min(1, score / 30);
  }

  // ========== AI DECISION ==========

  function aiDecision(player, gState) {
    var strength = handStrength(player.hand, gState.community);
    var profile = player.profile;
    var toCall = gState.currentBet - player.bet;
    var potOdds = toCall > 0 ? toCall / (gState.pot + toCall) : 0;

    // Adjust strength by style
    var adjustedStrength = strength;
    if (profile.style === 'fish') adjustedStrength += 0.15; // Gary overvalues hands
    if (profile.style === 'maniac') adjustedStrength += 0.1;
    if (profile.style === 'tight') adjustedStrength -= 0.1;
    if (profile.style === 'newbie') adjustedStrength += (Math.random() - 0.5) * 0.3; // random variance

    // Bluff chance
    var isBluffing = Math.random() < profile.bluffRate;
    if (isBluffing) adjustedStrength += 0.3;

    // Decision
    if (toCall === 0) {
      // Can check or bet
      if (adjustedStrength > 0.6 || Math.random() < profile.raiseRate * adjustedStrength) {
        var raiseAmt = Math.max(gState.minRaise, Math.floor(gState.pot * (0.3 + adjustedStrength * 0.7)));
        raiseAmt = Math.min(raiseAmt, player.chips);
        if (raiseAmt >= gState.minRaise) return { action: 'raise', amount: raiseAmt };
      }
      return { action: 'check' };
    } else {
      // Must call, raise, or fold
      if (adjustedStrength < potOdds * 1.5 && !isBluffing) {
        if (Math.random() < profile.foldRate) return { action: 'fold' };
      }
      if (adjustedStrength > 0.7 && Math.random() < profile.raiseRate) {
        var rAmt = Math.max(gState.minRaise, Math.floor(gState.pot * 0.5 + toCall));
        rAmt = Math.min(rAmt, player.chips);
        if (rAmt > toCall && rAmt >= gState.minRaise) return { action: 'raise', amount: rAmt };
      }
      if (toCall <= player.chips) return { action: 'call' };
      return { action: 'fold' };
    }
  }

  // ========== GAME FLOW ==========

  function pickAIPlayers() {
    var shuffled = AI_PROFILES.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t;
    }
    return shuffled.slice(0, 3);
  }

  function newGame() {
    state.handNum++;
    state.deck = createDeck();
    state.community = [];
    state.pot = 0;
    state.phase = 'preflop';
    state.currentBet = 0;
    state.minRaise = BB;
    state.busy = false;

    var aiPicks = pickAIPlayers();

    state.players = [
      { name: 'You', chips: 1000, hand: [], folded: false, allIn: false, bet: 0, acted: false, isHuman: true, profile: null }
    ];
    aiPicks.forEach(function (ai) {
      state.players.push({
        name: ai.name, chips: 1000, hand: [], folded: false, allIn: false, bet: 0, acted: false,
        isHuman: false, profile: ai, style: ai.style
      });
    });

    // Rotate dealer
    state.dealerIdx = (state.handNum - 1) % 4;

    // Post blinds
    var sbIdx = (state.dealerIdx + 1) % 4;
    var bbIdx = (state.dealerIdx + 2) % 4;
    postBet(sbIdx, SB);
    postBet(bbIdx, BB);
    state.currentBet = BB;

    // Deal 2 cards each
    for (var round = 0; round < 2; round++) {
      for (var i = 0; i < 4; i++) {
        state.players[i].hand.push(state.deck.pop());
      }
    }

    // Start action at UTG (left of BB)
    state.currentIdx = nextActiveIdx(bbIdx);
    state.message = 'Pre-flop. Your turn.';

    el('pk-flavor').textContent = flavorLines[Math.floor(Math.random() * flavorLines.length)];
    render();

    // If first to act is AI, start AI loop
    if (!state.players[state.currentIdx].isHuman) runAILoop();
  }

  function postBet(pIdx, amount) {
    var p = state.players[pIdx];
    var actual = Math.min(amount, p.chips);
    p.chips -= actual;
    p.bet += actual;
    state.pot += actual;
    if (p.chips === 0) p.allIn = true;
  }

  function activePlayers() {
    return state.players.filter(function (p) { return !p.folded; });
  }

  function activeNonAllIn() {
    return state.players.filter(function (p) { return !p.folded && !p.allIn; });
  }

  function nextActiveIdx(from) {
    for (var i = 1; i <= 4; i++) {
      var idx = (from + i) % 4;
      if (!state.players[idx].folded && !state.players[idx].allIn) return idx;
    }
    return -1;
  }

  function isRoundOver() {
    // Round ends when all active non-allin players have matched current bet
    // and everyone has acted at least once
    var active = activeNonAllIn();
    if (active.length <= 1 && activePlayers().length <= 1) return true;
    return active.every(function (p) { return p.bet === state.currentBet; }) && active.length > 0;
  }

  function doAction(action, amount, internal) {
    if (!internal && state.busy) return;
    if (state.phase === 'idle' || state.phase === 'showdown') return;
    var p = state.players[state.currentIdx];

    p.acted = true;

    if (action === 'fold') {
      p.folded = true;
    } else if (action === 'check') {
      // nothing
    } else if (action === 'call') {
      var toCall = state.currentBet - p.bet;
      postBet(state.currentIdx, toCall);
    } else if (action === 'raise') {
      var totalBet = amount + (state.currentBet - p.bet);
      postBet(state.currentIdx, totalBet);
      state.currentBet = p.bet;
      state.minRaise = amount;
      // Everyone else needs to act again
      state.players.forEach(function (other, idx) {
        if (idx !== state.currentIdx && !other.folded && !other.allIn) {
          other.acted = false;
        }
      });
    }

    // Check if only 1 player left
    if (activePlayers().length === 1) {
      var winner = activePlayers()[0];
      winner.chips += state.pot;
      state.message = winner.name + ' wins $' + state.pot + '! (others folded)';
      state.pot = 0;
      state.phase = 'showdown';
      render();
      return;
    }

    // Move to next player or advance phase
    advanceAction();
  }

  function isBettingRoundComplete() {
    var active = activeNonAllIn();
    if (active.length === 0) return true;
    // Everyone active must have acted AND matched the current bet
    return active.every(function (p) {
      return p.acted && p.bet === state.currentBet;
    });
  }

  function advanceAction() {
    if (isBettingRoundComplete()) {
      advancePhase();
      return;
    }

    var nextIdx = nextActiveIdx(state.currentIdx);
    if (nextIdx === -1) {
      advancePhase();
      return;
    }

    state.currentIdx = nextIdx;
    render();

    if (!state.players[state.currentIdx].isHuman) {
      runAILoop();
    }
  }

  function runAILoop() {
    state.busy = true;
    render();
    setTimeout(function () {
      if (state.phase === 'idle' || state.phase === 'showdown') { state.busy = false; render(); return; }
      var p = state.players[state.currentIdx];
      if (p.folded || p.allIn || p.isHuman) { state.busy = false; render(); return; }

      var decision = aiDecision(p, { community: state.community, currentBet: state.currentBet, pot: state.pot, minRaise: state.minRaise });
      var actionText = p.name + ': ' + decision.action;
      if (decision.amount) actionText += ' $' + decision.amount;
      state.message = actionText;

      doAction(decision.action, decision.amount || 0, true);

      // If next player is also AI and game continues, chain
      if (state.phase !== 'showdown' && state.phase !== 'idle') {
        var next = state.players[state.currentIdx];
        if (next && !next.isHuman && !next.folded && !next.allIn) {
          runAILoop();
          return;
        }
      }
      state.busy = false;
      render();
    }, 600 + Math.random() * 400);
  }

  function advancePhase() {
    // Reset bets and acted flags for next round
    state.players.forEach(function (p) { p.bet = 0; p.acted = false; });
    state.currentBet = 0;
    state.minRaise = BB;

    if (state.phase === 'preflop') {
      state.phase = 'flop';
      state.community.push(state.deck.pop(), state.deck.pop(), state.deck.pop());
      state.message = 'Flop dealt.';
    } else if (state.phase === 'flop') {
      state.phase = 'turn';
      state.community.push(state.deck.pop());
      state.message = 'Turn dealt.';
    } else if (state.phase === 'turn') {
      state.phase = 'river';
      state.community.push(state.deck.pop());
      state.message = 'River dealt.';
    } else if (state.phase === 'river') {
      showdown();
      return;
    }

    // Start from left of dealer
    state.currentIdx = nextActiveIdx(state.dealerIdx);
    if (state.currentIdx === -1 || activeNonAllIn().length === 0) {
      // Everyone is all-in, deal remaining cards
      while (state.community.length < 5) state.community.push(state.deck.pop());
      showdown();
      return;
    }
    render();
    if (!state.players[state.currentIdx].isHuman) runAILoop();
  }

  function showdown() {
    state.phase = 'showdown';
    var active = activePlayers();

    // Evaluate each player's hand
    var results = active.map(function (p) {
      var all = p.hand.concat(state.community);
      var ev = evaluateHand(all);
      return { player: p, eval: ev };
    });

    // Sort by hand strength descending
    results.sort(function (a, b) { return compareScores(b.eval, a.eval); });

    // Winner(s) — handle ties
    var winners = [results[0]];
    for (var i = 1; i < results.length; i++) {
      if (compareScores(results[i].eval, results[0].eval) === 0) winners.push(results[i]);
      else break;
    }

    var share = Math.floor(state.pot / winners.length);
    var msg = '';
    winners.forEach(function (w) {
      w.player.chips += share;
      msg += w.player.name + ' wins with ' + w.eval.name + '! ';
    });
    msg += '(Pot: $' + state.pot + ')';
    state.pot = 0;
    state.message = msg;
    render();
  }

  // ========== HUMAN ACTIONS ==========

  function humanFold() {
    if (state.busy || state.phase === 'idle' || state.phase === 'showdown') return;
    if (!state.players[state.currentIdx].isHuman) return;
    doAction('fold');
  }

  function humanCheck() {
    if (state.busy || state.phase === 'idle' || state.phase === 'showdown') return;
    var p = state.players[state.currentIdx];
    if (!p.isHuman) return;
    var toCall = state.currentBet - p.bet;
    if (toCall > 0) {
      doAction('call');
    } else {
      doAction('check');
    }
  }

  function humanRaise() {
    if (state.busy || state.phase === 'idle' || state.phase === 'showdown') return;
    var p = state.players[state.currentIdx];
    if (!p.isHuman) return;
    var slider = el('pk-raise-slider');
    var amount = parseInt(slider.value, 10);
    if (amount < state.minRaise) amount = state.minRaise;
    doAction('raise', amount);
  }

  // ========== RENDERING ==========

  function renderCard(card, hidden, small) {
    var cls = 'playing-card' + (small ? ' pk-card-sm' : '') + (hidden ? ' hidden' : '') + (suitColor(card.suit) ? ' ' + suitColor(card.suit) : '');
    if (hidden) return '<div class="' + cls + '"></div>';
    return '<div class="' + cls + '">'
      + '<div class="card-corner">' + card.rank + '<span>' + card.suit + '</span></div>'
      + '<div class="card-center">' + card.suit + '</div>'
      + '<div class="card-corner bottom">' + card.rank + '<span>' + card.suit + '</span></div></div>';
  }

  function getCharAvatar(name) {
    if (typeof CHARS === 'undefined') return '';
    var map = { 'Gary': 'slacker', 'Sophie': 'risk', 'Wei': 'conspiracy', 'Raj': 'fx', 'Max': 'quant', 'Ace': 'poker', 'Ming': 'intern', 'Zhang': 'veteran' };
    var cid = map[name];
    if (!cid) return '';
    var found = CHARS.find(function (c) { return c.id === cid; });
    return found && found.avatar ? '<img src="' + found.avatar + '" alt="" width="28" height="28">' : '';
  }

  function render() {
    // Opponents
    var oppsEl = el('pk-opponents');
    oppsEl.innerHTML = '';
    for (var i = 1; i < state.players.length; i++) {
      var p = state.players[i];
      var isDealer = i === state.dealerIdx;
      var isActive = i === state.currentIdx && state.phase !== 'showdown' && state.phase !== 'idle';
      var classes = 'pk-opponent' + (p.folded ? ' folded' : '') + (isActive ? ' active' : '');
      var cardsHtml = '';
      if (p.hand.length) {
        var showCards = state.phase === 'showdown' && !p.folded;
        cardsHtml = p.hand.map(function (c) { return renderCard(c, !showCards, true); }).join('');
      }
      var avatar = getCharAvatar(p.name);
      oppsEl.innerHTML +=
        '<div class="' + classes + '">'
        + '<div class="pk-opp-info">'
        + (avatar ? '<div class="pk-opp-avatar">' + avatar + '</div>' : '')
        + '<div class="pk-opp-text">'
        + '<div class="pk-opp-name">' + p.name + (isDealer ? ' <span class="pk-dealer-btn">D</span>' : '') + '</div>'
        + '<div class="pk-opp-chips">$' + p.chips + (p.profile ? ' <span class="pk-opp-style">' + p.profile.desc + '</span>' : '') + '</div>'
        + '</div>'
        + '</div>'
        + '<div class="pk-opp-cards">' + cardsHtml + '</div>'
        + (p.folded ? '<div class="pk-opp-fold">FOLD</div>' : '')
        + (p.allIn && !p.folded ? '<div class="pk-opp-allin">ALL IN</div>' : '')
        + '</div>';
    }

    // Community cards
    var commEl = el('pk-community');
    commEl.innerHTML = '';
    for (var ci = 0; ci < 5; ci++) {
      if (ci < state.community.length) {
        commEl.innerHTML += renderCard(state.community[ci], false, false);
      } else {
        commEl.innerHTML += '<div class="playing-card pk-empty-slot"></div>';
      }
    }

    // Pot
    el('pk-pot').textContent = 'Pot: $' + state.pot;

    // Player hand
    var playerEl = el('pk-player-cards');
    playerEl.innerHTML = '';
    var human = state.players[0];
    if (human && human.hand.length) {
      human.hand.forEach(function (c) { playerEl.innerHTML += renderCard(c, false, false); });
    }
    el('pk-player-chips').textContent = '$' + (human ? human.chips : 0);
    var isPlayerDealer = state.dealerIdx === 0;
    el('pk-player-label').textContent = 'You' + (isPlayerDealer ? ' (Dealer)' : '');

    // Hand info
    if (human && human.hand.length && state.community.length >= 3 && !human.folded) {
      var evalResult = evaluateHand(human.hand.concat(state.community));
      el('pk-hand-info').textContent = evalResult.name;
      el('pk-hand-info').style.display = 'block';
    } else {
      el('pk-hand-info').style.display = 'none';
    }

    // Controls
    var isMyTurn = human && state.currentIdx === 0 && !state.busy && state.phase !== 'idle' && state.phase !== 'showdown' && !human.folded;
    var toCall = state.currentBet - (human ? human.bet : 0);
    el('pk-fold').disabled = !isMyTurn;
    el('pk-check').disabled = !isMyTurn;
    el('pk-check').textContent = toCall > 0 ? 'Call $' + toCall : 'Check';
    el('pk-raise').disabled = !isMyTurn;

    var slider = el('pk-raise-slider');
    slider.disabled = !isMyTurn;
    if (human) {
      slider.max = human.chips;
      slider.min = Math.max(state.minRaise, BB);
    }
    el('pk-raise-amount').textContent = '$' + slider.value;

    // Status
    el('pk-status').textContent = state.message;

    // Phase indicator
    var phases = ['preflop', 'flop', 'turn', 'river'];
    phases.forEach(function (ph) {
      var dot = el('pk-phase-' + ph);
      if (dot) dot.className = 'pk-phase-dot' + (state.phase === ph ? ' active' : (phases.indexOf(ph) < phases.indexOf(state.phase) ? ' done' : ''));
    });
  }

  // ========== OPEN / CLOSE ==========

  function open() {
    el('poker-overlay').classList.add('open');
    state.phase = 'idle';
    state.message = 'Press New Game to start.';
    render();
  }

  function close() {
    el('poker-overlay').classList.remove('open');
  }

  // ========== WIRE EVENTS ==========

  document.addEventListener('DOMContentLoaded', function () {
    el('pk-new').addEventListener('click', newGame);
    el('pk-fold').addEventListener('click', humanFold);
    el('pk-check').addEventListener('click', humanCheck);
    el('pk-raise').addEventListener('click', humanRaise);
    el('pk-close').addEventListener('click', close);
    el('pk-backdrop').addEventListener('click', close);

    var slider = el('pk-raise-slider');
    slider.addEventListener('input', function () {
      el('pk-raise-amount').textContent = '$' + slider.value;
    });
  });

  return { open: open, close: close };
})();
