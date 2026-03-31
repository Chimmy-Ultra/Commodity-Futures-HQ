/* bigtwo.js — 大老二 Big Two card game */

var BigTwo = (function () {
  // --- Constants ---
  var SUITS = ['\u2663', '\u2666', '\u2665', '\u2660']; // ♣♦♥♠ (low→high)
  var RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
  var RANK_VAL = {};
  RANKS.forEach(function (r, i) { RANK_VAL[r] = i; });
  var SUIT_VAL = {};
  SUITS.forEach(function (s, i) { SUIT_VAL[s] = i; });

  var uid = 0;
  var runToken = 0;

  // AI players: Sam, Dario, Claude
  var AI_PLAYERS = [
    { id: 'sam', fallback: 'Sam', style: 'aggressive' },
    { id: 'dario', fallback: 'Dario', style: 'cautious' },
    { id: 'claude', fallback: 'Claude', style: 'balanced' },
  ];

  var flavorLines = [
    'Sam insists his "all-in" strategy works for Big Two. Dario disagrees constitutionally.',
    'Claude politely suggests you play your ♣3 first. It\'s the rules.',
    'Dario is calculating optimal card sequences. Sam already played.',
    'Sam says Big Two is just poker with extra steps. He\'s wrong.',
    'Claude has memorized every card you\'ve played. No pressure.',
    'Dario claims this game requires constitutional alignment of suits.',
  ];

  var state = {
    hands: [[], [], [], []], // 0=human, 1=Sam, 2=Dario, 3=Claude
    currentPlay: null,       // { cards, type, rank, playerIdx }
    currentPlayerIdx: 0,
    passCount: 0,
    lastPlayerIdx: -1,
    gameOver: false,
    winner: -1,
    selectedIndices: [],
    busy: false,
    message: 'Press New Game to start.',
    showRules: false,
    firstTurn: true,         // must include ♣3
    names: ['You', 'Sam', 'Dario', 'Claude'],
  };

  function el(id) { return document.getElementById(id); }

  // --- Card utilities ---
  function cardValue(card) { return RANK_VAL[card.rank] * 4 + SUIT_VAL[card.suit]; }
  function suitColor(s) { return s === '\u2665' || s === '\u2666' ? 'red' : ''; }

  function createDeck() {
    var deck = [];
    SUITS.forEach(function (suit) {
      RANKS.forEach(function (rank) {
        deck.push({ rank: rank, suit: suit, id: 'b2' + (++uid) });
      });
    });
    // Fisher-Yates shuffle
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    return deck;
  }

  function sortHand(hand) {
    hand.sort(function (a, b) { return cardValue(a) - cardValue(b); });
  }

  var FACE_ICONS = { 'J': '\uD83E\uDDD1', 'Q': '\uD83D\uDC51', 'K': '\uD83D\uDE4D' };
  // J=🧑 Q=👑 K=🙍 — but let's use cleaner approach with suit decoration

  function renderCard(card) {
    var color = suitColor(card.suit);
    var cls = 'b2-card ' + (color || 'black');
    var rank = card.rank;
    var suit = card.suit;
    var isFace = (rank === 'J' || rank === 'Q' || rank === 'K');
    if (isFace) cls += ' b2-face';

    var html = '<div class="' + cls + '" data-id="' + card.id + '">';
    // Top-left corner
    html += '<div class="b2-card-tl"><span class="b2-card-rank">' + rank + '</span><span class="b2-card-suit">' + suit + '</span></div>';
    // Bottom-right corner
    html += '<div class="b2-card-br"><span class="b2-card-rank">' + rank + '</span><span class="b2-card-suit">' + suit + '</span></div>';

    if (isFace) {
      // Face cards: large rank + decorative suit border pattern
      html += '<div class="b2-card-face-mid">';
      html += '<span class="b2-face-suit top-l">' + suit + '</span>';
      html += '<span class="b2-face-suit top-r">' + suit + '</span>';
      html += '<span class="b2-face-letter">' + rank + '</span>';
      html += '<span class="b2-face-suit bot-l">' + suit + '</span>';
      html += '<span class="b2-face-suit bot-r">' + suit + '</span>';
      html += '</div>';
    } else if (rank === 'A') {
      // Ace: one HUGE suit in center
      html += '<div class="b2-card-ace">' + suit + '</div>';
    } else {
      // Number cards: large suit in center
      html += '<div class="b2-card-mid">' + suit + '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderCardBack() {
    return '<div class="b2-card b2-card-back"></div>';
  }

  // --- Hand classification ---
  // Returns { type, typeRank, rank } or null if invalid
  // typeRank: 0=single,1=pair,2=triple,3=straight,4=flush,5=fullhouse,6=quads,7=straightflush
  function classifyPlay(cards) {
    var n = cards.length;
    if (n === 1) return { type: 'single', typeRank: 0, rank: cardValue(cards[0]) };
    if (n === 2) {
      if (cards[0].rank === cards[1].rank) {
        return { type: 'pair', typeRank: 1, rank: Math.max(cardValue(cards[0]), cardValue(cards[1])) };
      }
      return null;
    }
    if (n === 3) {
      if (cards[0].rank === cards[1].rank && cards[1].rank === cards[2].rank) {
        var vals = cards.map(cardValue);
        return { type: 'triple', typeRank: 2, rank: Math.max.apply(null, vals) };
      }
      return null;
    }
    if (n === 5) return classifyFiveCards(cards);
    return null;
  }

  function classifyFiveCards(cards) {
    var sorted = cards.slice().sort(function (a, b) { return RANK_VAL[a.rank] - RANK_VAL[b.rank]; });
    var rankVals = sorted.map(function (c) { return RANK_VAL[c.rank]; });
    var suits = sorted.map(function (c) { return c.suit; });

    var isFlush = suits.every(function (s) { return s === suits[0]; });
    var isStraight = checkStraight(rankVals);
    var straightHigh = isStraight ? getStraightHigh(rankVals) : -1;

    // Count ranks
    var counts = {};
    sorted.forEach(function (c) { counts[c.rank] = (counts[c.rank] || 0) + 1; });
    var countVals = Object.keys(counts).map(function (r) { return { rank: r, count: counts[r] }; });
    countVals.sort(function (a, b) { return b.count - a.count || RANK_VAL[b.rank] - RANK_VAL[a.rank]; });

    // Straight Flush
    if (isFlush && isStraight) {
      var highCard = getHighestCardInStraight(sorted, rankVals);
      return { type: 'straightflush', typeRank: 7, rank: straightHigh * 4 + SUIT_VAL[highCard.suit] };
    }
    // Four of a kind
    if (countVals[0].count === 4) {
      return { type: 'quads', typeRank: 6, rank: RANK_VAL[countVals[0].rank] };
    }
    // Full house
    if (countVals[0].count === 3 && countVals[1].count === 2) {
      return { type: 'fullhouse', typeRank: 5, rank: RANK_VAL[countVals[0].rank] };
    }
    // Flush
    if (isFlush) {
      var flushCards = sorted.slice().sort(function (a, b) { return cardValue(b) - cardValue(a); });
      return { type: 'flush', typeRank: 4, rank: cardValue(flushCards[0]) };
    }
    // Straight
    if (isStraight) {
      var highCard2 = getHighestCardInStraight(sorted, rankVals);
      return { type: 'straight', typeRank: 3, rank: straightHigh * 4 + SUIT_VAL[highCard2.suit] };
    }
    return null;
  }

  function checkStraight(rankVals) {
    var unique = rankVals.slice();
    // Normal consecutive
    for (var i = 1; i < unique.length; i++) {
      if (unique[i] - unique[i - 1] !== 1) {
        // Check A-2-3-4-5 wrap: ranks [0,1,2,3,12] → A(11)-2(12)-3(0)-4(1)-5(2) wait...
        // RANK_VAL: 3=0,4=1,...,A=11,2=12
        // A-2-3-4-5 → values [0,1,2,11,12] sorted → [0,1,2,11,12]
        // This is: 3,4,5,A,2 → not what we want
        // Actually: A=11, 2=12, 3=0, 4=1, 5=2
        // So A-2-3-4-5 in rank values = [11,12,0,1,2] sorted = [0,1,2,11,12]
        return checkWrapStraight(unique);
      }
    }
    return true;
  }

  function checkWrapStraight(vals) {
    // Check for wrap-around straights that include 2 (value 12) and/or A (value 11)
    // Valid wraps: A-2-3-4-5 = [0,1,2,11,12], 10-J-Q-K-A = already consecutive [7,8,9,10,11]
    // 2-3-4-5-6 = [0,1,2,3,12] → this is 2 wrapping to 3
    // J-Q-K-A-2 = [8,9,10,11,12] → already consecutive
    // Q-K-A-2-3 = [0,9,10,11,12]
    // K-A-2-3-4 = [1,10,11,12,0] sorted [0,1,10,11,12]
    var sorted = vals.slice().sort(function (a, b) { return a - b; });

    // The 13 possible straights in Big Two (with wrap):
    // A-2-3-4-5: [0,1,2,11,12]
    // 2-3-4-5-6: [0,1,2,3,12]
    // 3-4-5-6-7: [0,1,2,3,4]
    // ... (consecutive up to)
    // 10-J-Q-K-A: [7,8,9,10,11]
    // J-Q-K-A-2: [8,9,10,11,12]
    // Q-K-A-2-3: [0,9,10,11,12]
    // K-A-2-3-4: [0,1,10,11,12]

    var VALID_STRAIGHTS = [
      [0, 1, 2, 11, 12],   // A-2-3-4-5
      [0, 1, 2, 3, 12],    // 2-3-4-5-6
      [0, 1, 2, 3, 4],     // 3-4-5-6-7
      [1, 2, 3, 4, 5],     // 4-5-6-7-8
      [2, 3, 4, 5, 6],     // 5-6-7-8-9
      [3, 4, 5, 6, 7],     // 6-7-8-9-10
      [4, 5, 6, 7, 8],     // 7-8-9-10-J
      [5, 6, 7, 8, 9],     // 8-9-10-J-Q
      [6, 7, 8, 9, 10],    // 9-10-J-Q-K
      [7, 8, 9, 10, 11],   // 10-J-Q-K-A
      [8, 9, 10, 11, 12],  // J-Q-K-A-2
      [0, 9, 10, 11, 12],  // Q-K-A-2-3
      [0, 1, 10, 11, 12],  // K-A-2-3-4
    ];

    for (var i = 0; i < VALID_STRAIGHTS.length; i++) {
      if (arraysEqual(sorted, VALID_STRAIGHTS[i])) return true;
    }
    return false;
  }

  // Get the "high rank" of a straight for comparison
  // Straights are ordered: A-2-3-4-5 (lowest=0) ... 10-J-Q-K-A (=9) ... K-A-2-3-4 (=12)
  function getStraightHigh(rankVals) {
    var sorted = rankVals.slice().sort(function (a, b) { return a - b; });

    var STRAIGHT_ORDER = [
      { vals: [0, 1, 2, 11, 12], high: 0 },   // A-2-3-4-5 (weakest)
      { vals: [0, 1, 2, 3, 12], high: 1 },     // 2-3-4-5-6
      { vals: [0, 1, 2, 3, 4], high: 2 },      // 3-4-5-6-7
      { vals: [1, 2, 3, 4, 5], high: 3 },      // 4-5-6-7-8
      { vals: [2, 3, 4, 5, 6], high: 4 },      // 5-6-7-8-9
      { vals: [3, 4, 5, 6, 7], high: 5 },      // 6-7-8-9-10
      { vals: [4, 5, 6, 7, 8], high: 6 },      // 7-8-9-10-J
      { vals: [5, 6, 7, 8, 9], high: 7 },      // 8-9-10-J-Q
      { vals: [6, 7, 8, 9, 10], high: 8 },     // 9-10-J-Q-K
      { vals: [7, 8, 9, 10, 11], high: 9 },    // 10-J-Q-K-A
      { vals: [8, 9, 10, 11, 12], high: 10 },  // J-Q-K-A-2
      { vals: [0, 9, 10, 11, 12], high: 11 },  // Q-K-A-2-3
      { vals: [0, 1, 10, 11, 12], high: 12 },  // K-A-2-3-4
    ];

    for (var i = 0; i < STRAIGHT_ORDER.length; i++) {
      if (arraysEqual(sorted, STRAIGHT_ORDER[i].vals)) return STRAIGHT_ORDER[i].high;
    }
    return -1;
  }

  function getHighestCardInStraight(sortedCards, rankVals) {
    // Return the card that determines suit for tie-breaking
    // It's the "logical highest" card in the straight
    var sorted = rankVals.slice().sort(function (a, b) { return a - b; });
    var highIdx;

    // For wrap-around straights, the highest card depends on the straight type
    if (arraysEqual(sorted, [0, 1, 2, 11, 12])) {
      // A-2-3-4-5: highest is 5 (rank val 2)
      highIdx = sortedCards.findIndex(function (c) { return RANK_VAL[c.rank] === 2; });
    } else if (arraysEqual(sorted, [0, 1, 2, 3, 12])) {
      // 2-3-4-5-6: highest is 6 (rank val 3)
      highIdx = sortedCards.findIndex(function (c) { return RANK_VAL[c.rank] === 3; });
    } else if (arraysEqual(sorted, [0, 9, 10, 11, 12])) {
      // Q-K-A-2-3: highest is 3 (rank val 0)
      highIdx = sortedCards.findIndex(function (c) { return RANK_VAL[c.rank] === 0; });
    } else if (arraysEqual(sorted, [0, 1, 10, 11, 12])) {
      // K-A-2-3-4: highest is 4 (rank val 1)
      highIdx = sortedCards.findIndex(function (c) { return RANK_VAL[c.rank] === 1; });
    } else {
      // Normal straight: highest rank value card
      var maxVal = -1;
      highIdx = 0;
      for (var i = 0; i < sortedCards.length; i++) {
        if (RANK_VAL[sortedCards[i].rank] > maxVal) {
          maxVal = RANK_VAL[sortedCards[i].rank];
          highIdx = i;
        }
      }
    }
    return sortedCards[highIdx >= 0 ? highIdx : 0];
  }

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) { if (a[i] !== b[i]) return false; }
    return true;
  }

  // --- Play validation ---
  function isValidPlay(cards, currentPlay) {
    var play = classifyPlay(cards);
    if (!play) return false;

    // Free lead — any valid combo
    if (!currentPlay) return true;

    // Five-card hands: higher typeRank beats lower typeRank
    if (play.typeRank >= 3 && currentPlay.typeRank >= 3) {
      // Both are 5-card types
      if (play.typeRank > currentPlay.typeRank) return true;
      if (play.typeRank < currentPlay.typeRank) return false;
      return play.rank > currentPlay.rank;
    }

    // Same type only
    if (play.type !== currentPlay.type) return false;
    return play.rank > currentPlay.rank;
  }

  // Check if first play includes ♣3
  function includesClub3(cards) {
    return cards.some(function (c) { return c.rank === '3' && c.suit === '\u2663'; });
  }

  // --- AI logic ---
  function findAllPlays(hand) {
    var plays = [];
    var n = hand.length;

    // Singles
    for (var i = 0; i < n; i++) {
      plays.push([hand[i]]);
    }

    // Pairs
    for (var i = 0; i < n; i++) {
      for (var j = i + 1; j < n; j++) {
        if (hand[i].rank === hand[j].rank) plays.push([hand[i], hand[j]]);
      }
    }

    // Triples
    for (var i = 0; i < n; i++) {
      for (var j = i + 1; j < n; j++) {
        for (var k = j + 1; k < n; k++) {
          if (hand[i].rank === hand[j].rank && hand[j].rank === hand[k].rank) {
            plays.push([hand[i], hand[j], hand[k]]);
          }
        }
      }
    }

    // Five-card combos (only if 5+ cards)
    if (n >= 5) {
      var combos = getCombinations5(hand);
      combos.forEach(function (combo) {
        if (classifyPlay(combo)) plays.push(combo);
      });
    }

    return plays;
  }

  function getCombinations5(arr) {
    var result = [];
    var n = arr.length;
    for (var i = 0; i < n - 4; i++)
      for (var j = i + 1; j < n - 3; j++)
        for (var k = j + 1; k < n - 2; k++)
          for (var l = k + 1; l < n - 1; l++)
            for (var m = l + 1; m < n; m++)
              result.push([arr[i], arr[j], arr[k], arr[l], arr[m]]);
    return result;
  }

  function findValidPlays(hand, currentPlay) {
    var all = findAllPlays(hand);
    return all.filter(function (cards) { return isValidPlay(cards, currentPlay); });
  }

  function aiDecide(playerIdx) {
    var hand = state.hands[playerIdx];
    var currentPlay = state.currentPlay;
    var style = AI_PLAYERS[playerIdx - 1].style;

    // Free lead
    if (!currentPlay) {
      return aiFreeLead(hand, style, playerIdx);
    }

    // Must follow
    var valid = findValidPlays(hand, currentPlay);
    if (valid.length === 0) return null; // pass

    // Sort by rank (ascending — smallest first)
    valid.sort(function (a, b) {
      var ca = classifyPlay(a);
      var cb = classifyPlay(b);
      return ca.rank - cb.rank;
    });

    if (hand.length <= 3) {
      // Endgame: play strongest to finish
      return valid[valid.length - 1];
    }

    if (style === 'aggressive') {
      // Play mid-high card
      var idx = Math.min(valid.length - 1, Math.floor(valid.length * 0.6));
      return valid[idx];
    } else if (style === 'cautious') {
      // Play weakest valid
      return valid[0];
    } else {
      // Balanced: play weakest, sometimes mid
      if (Math.random() < 0.3 && valid.length > 1) return valid[1];
      return valid[0];
    }
  }

  function aiFreeLead(hand, style, playerIdx) {
    // First turn — must include ♣3
    if (state.firstTurn && hasClub3(playerIdx)) {
      return aiFirstTurnPlay(hand);
    }

    var plays = findAllPlays(hand);
    if (plays.length === 0) return null;

    // Separate by type
    var singles = plays.filter(function (p) { return p.length === 1; });
    var pairs = plays.filter(function (p) { return p.length === 2; });
    var triples = plays.filter(function (p) { return p.length === 3; });
    var fives = plays.filter(function (p) { return p.length === 5; });

    // Sort each by rank
    var sortByRank = function (arr) {
      arr.sort(function (a, b) {
        var ca = classifyPlay(a);
        var cb = classifyPlay(b);
        return ca.rank - cb.rank;
      });
    };
    sortByRank(singles);
    sortByRank(pairs);
    sortByRank(triples);
    sortByRank(fives);

    if (hand.length <= 3) {
      // Try to finish: look for exact match
      if (hand.length === 1) return singles[0];
      if (hand.length === 2 && pairs.length > 0) return pairs[0];
      if (hand.length === 3 && triples.length > 0) return triples[0];
    }

    if (style === 'aggressive') {
      // Prefer pairs/triples to clear cards faster
      if (pairs.length > 0 && Math.random() < 0.5) return pairs[0];
      if (triples.length > 0 && Math.random() < 0.3) return triples[0];
      return singles.length > 0 ? singles[0] : plays[0];
    } else if (style === 'cautious') {
      // Always play smallest single
      return singles.length > 0 ? singles[0] : plays[0];
    } else {
      // Balanced
      if (Math.random() < 0.3 && pairs.length > 0) return pairs[0];
      return singles.length > 0 ? singles[0] : plays[0];
    }
  }

  function hasClub3(playerIdx) {
    return state.hands[playerIdx].some(function (c) { return c.rank === '3' && c.suit === '\u2663'; });
  }

  function aiFirstTurnPlay(hand) {
    // Must include ♣3, prefer smallest play
    var club3 = hand.find(function (c) { return c.rank === '3' && c.suit === '\u2663'; });
    if (!club3) return [hand[0]]; // fallback

    // Try single ♣3
    var single = [club3];

    // Try pair of 3s
    var threes = hand.filter(function (c) { return c.rank === '3'; });
    if (threes.length >= 2) {
      return [club3, threes.find(function (c) { return c !== club3; })];
    }

    // Try five-card with ♣3
    // Check if there's a straight starting from 3
    var plays = findAllPlays(hand);
    var fivesWithClub3 = plays.filter(function (p) {
      return p.length === 5 && p.some(function (c) { return c === club3; }) && classifyPlay(p);
    });
    if (fivesWithClub3.length > 0) {
      // Sort by rank, return weakest
      fivesWithClub3.sort(function (a, b) {
        return classifyPlay(a).rank - classifyPlay(b).rank;
      });
      // Only if it seems strategic (random chance)
      if (Math.random() < 0.3) return fivesWithClub3[0];
    }

    return single;
  }

  // --- Game flow ---
  function newGame() {
    runToken++;
    var token = runToken;

    var deck = createDeck();
    state.hands = [[], [], [], []];
    for (var i = 0; i < 52; i++) {
      state.hands[i % 4].push(deck[i]);
    }
    state.hands.forEach(sortHand);

    state.currentPlay = null;
    state.passCount = 0;
    state.lastPlayerIdx = -1;
    state.gameOver = false;
    state.winner = -1;
    state.selectedIndices = [];
    state.busy = false;
    state.firstTurn = true;
    lastHandKey = '';

    // Find who has ♣3
    var starter = -1;
    for (var p = 0; p < 4; p++) {
      if (hasClub3(p)) { starter = p; break; }
    }
    state.currentPlayerIdx = starter;
    state.message = state.names[starter] + ' has ♣3 — goes first!';

    render(token);

    // If AI starts, trigger after delay
    if (starter !== 0) {
      state.busy = true;
      render(token);
      setTimeout(function () { if (runToken === token) aiTurn(token); }, 1000);
    }
  }

  function playCards(cards, playerIdx, token) {
    if (runToken !== token) return;

    var play = classifyPlay(cards);
    if (!play) return;

    // Remove from hand
    cards.forEach(function (card) {
      var idx = state.hands[playerIdx].indexOf(card);
      if (idx >= 0) state.hands[playerIdx].splice(idx, 1);
    });

    state.currentPlay = { cards: cards, type: play.type, typeRank: play.typeRank, rank: play.rank, playerIdx: playerIdx };
    state.passCount = 0;
    state.lastPlayerIdx = playerIdx;
    state.firstTurn = false;

    var typeName = getPlayTypeName(play.type, cards.length);
    state.message = state.names[playerIdx] + ' played ' + typeName;

    // Check win
    if (state.hands[playerIdx].length === 0) {
      state.gameOver = true;
      state.winner = playerIdx;
      state.message = '\uD83C\uDFC6 ' + state.names[playerIdx] + ' wins!';
      state.busy = false;
      render(token);
      return;
    }

    nextTurn(token);
  }

  function passAction(playerIdx, token) {
    if (runToken !== token) return;

    state.passCount++;
    state.message = state.names[playerIdx] + ' passed.';

    // 3 passes → free lead for last player
    if (state.passCount >= 3) {
      state.currentPlay = null;
      state.passCount = 0;
      state.currentPlayerIdx = state.lastPlayerIdx;
      state.message = state.names[state.lastPlayerIdx] + ' takes the round — free lead!';
      state.busy = false;
      render(token);

      // If AI has free lead
      if (state.currentPlayerIdx !== 0) {
        state.busy = true;
        render(token);
        setTimeout(function () { if (runToken === token) aiTurn(token); }, 800);
      }
      return;
    }

    nextTurn(token);
  }

  function nextTurn(token) {
    state.currentPlayerIdx = (state.currentPlayerIdx + 1) % 4;
    state.selectedIndices = [];

    render(token);

    if (state.currentPlayerIdx !== 0) {
      state.busy = true;
      render(token);
      var delay = 600 + Math.floor(Math.random() * 800);
      setTimeout(function () { if (runToken === token) aiTurn(token); }, delay);
    } else {
      state.busy = false;
      render(token);
    }
  }

  function aiTurn(token) {
    if (runToken !== token || state.gameOver) return;

    var playerIdx = state.currentPlayerIdx;
    var decision = aiDecide(playerIdx);

    if (decision) {
      playCards(decision, playerIdx, token);
    } else {
      passAction(playerIdx, token);
    }
  }

  function getPlayTypeName(type, count) {
    var names = {
      single: 'Single',
      pair: 'Pair',
      triple: 'Triple',
      straight: 'Straight',
      flush: 'Flush',
      fullhouse: 'Full House',
      quads: 'Four of a Kind',
      straightflush: 'Straight Flush',
    };
    return names[type] || (count + ' cards');
  }

  // --- Human actions ---
  function humanPlay() {
    if (state.busy || state.gameOver || state.currentPlayerIdx !== 0) return;
    var token = runToken;

    var selectedCards = state.selectedIndices.map(function (i) { return state.hands[0][i]; });
    if (selectedCards.length === 0) return;

    // First turn must include ♣3
    if (state.firstTurn && !includesClub3(selectedCards)) {
      state.message = 'First play must include ♣3!';
      render(token);
      return;
    }

    var play = classifyPlay(selectedCards);
    if (!play) {
      state.message = 'Invalid combination!';
      render(token);
      return;
    }

    if (state.currentPlay && !isValidPlay(selectedCards, state.currentPlay)) {
      state.message = 'Must play same type and higher!';
      render(token);
      return;
    }

    playCards(selectedCards, 0, token);
  }

  function humanPass() {
    if (state.busy || state.gameOver || state.currentPlayerIdx !== 0) return;
    if (!state.currentPlay) {
      state.message = 'You must play — it\'s a free lead!';
      render(runToken);
      return;
    }
    passAction(0, runToken);
  }

  // --- Rendering ---
  // Seat mapping: 0=South(human), 1=West(Sam), 2=North(Dario), 3=East(Claude)
  var SEAT_MAP = { 1: 'west', 2: 'north', 3: 'east' };
  var lastHandKey = ''; // track hand state to avoid unnecessary re-renders

  function getPlayerInfo(playerIdx) {
    if (playerIdx === 0) return { name: 'You', avatar: '', contain: false };
    var ai = AI_PLAYERS[playerIdx - 1];
    var char = (typeof CHARS !== 'undefined') ? CHARS.find(function (c) { return c.id === ai.id; }) : null;
    return {
      name: char ? char.name : ai.fallback,
      avatar: char ? char.avatar : '',
      contain: char ? char.avatarContain : false,
    };
  }

  function render(token) {
    if (runToken !== token) return;
    renderSeats();
    renderTable();
    renderHandSmart();
    renderStatus();
    renderButtons();
  }

  function renderSeats() {
    for (var i = 1; i <= 3; i++) {
      var seatId = 'b2-seat-' + SEAT_MAP[i];
      var container = el(seatId);
      if (!container) continue;

      var info = getPlayerInfo(i);
      var count = state.hands[i].length;
      var isActive = state.currentPlayerIdx === i && !state.gameOver;
      var isWinner = state.winner === i;

      container.className = 'b2-seat b2-' + SEAT_MAP[i] + (isActive ? ' active' : '') + (isWinner ? ' winner' : '');

      var html = '';
      if (info.avatar) {
        var containCls = info.contain ? ' avatar-contain' : '';
        html += '<img src="' + info.avatar + '" class="b2-seat-avatar' + containCls + '" alt="' + info.name + '">';
      }
      html += '<div class="b2-seat-name">' + info.name + '</div>';
      html += '<div class="b2-seat-count">' + count + '</div>';
      // Stacked card backs — cap display to prevent layout overflow
      var maxShow = (SEAT_MAP[i] === 'north') ? count : Math.min(count, 10);
      html += '<div class="b2-seat-cards">';
      for (var j = 0; j < maxShow; j++) {
        html += '<div class="b2-mini-back"></div>';
      }
      html += '</div>';
      container.innerHTML = html;
    }
  }

  var DIRECTION_MAP = { 0: 'south', 1: 'west', 2: 'north', 3: 'east' };

  function renderTable() {
    var played = el('b2-played');
    var info = el('b2-played-info');
    if (!played || !info) return;

    if (state.currentPlay) {
      var pInfo = getPlayerInfo(state.currentPlay.playerIdx);
      var typeName = getPlayTypeName(state.currentPlay.type, state.currentPlay.cards.length);
      var dir = DIRECTION_MAP[state.currentPlay.playerIdx] || 'south';

      // Build played-by badge with avatar
      var html = '<div class="b2-played-by">';
      if (pInfo.avatar) {
        var containCls = pInfo.contain ? ' avatar-contain' : '';
        html += '<img src="' + pInfo.avatar + '" class="b2-played-avatar' + containCls + '">';
      }
      html += '<span class="b2-played-name">' + pInfo.name + '</span>';
      html += '<span class="b2-played-type">' + typeName + '</span>';
      html += '</div>';
      // Cards with direction animation class
      html += '<div class="b2-played-cards from-' + dir + '">';
      state.currentPlay.cards.forEach(function (card) {
        html += renderCard(card, false);
      });
      html += '</div>';
      played.innerHTML = html;
      info.textContent = '';
    } else {
      played.innerHTML = '<div class="b2-empty-table">No cards on table</div>';
      info.textContent = 'Free lead';
    }
  }

  // Smart hand rendering: only rebuild DOM when cards change, toggle classes for selection
  function renderHandSmart() {
    var container = el('b2-hand');
    if (!container) return;

    // Build a key from card IDs to detect actual hand changes
    var handKey = state.hands[0].map(function (c) { return c.id; }).join(',');

    if (handKey !== lastHandKey) {
      // Hand changed (cards were played) — full rebuild
      lastHandKey = handKey;
      rebuildHand(container);
    } else {
      // Only selection changed — just toggle classes
      updateHandSelection(container);
    }
  }

  function rebuildHand(container) {
    var html = '';
    state.hands[0].forEach(function (card, idx) {
      var selected = state.selectedIndices.indexOf(idx) >= 0;
      var cls = 'b2-hand-card' + (selected ? ' selected' : '');
      html += '<div class="' + cls + '" data-idx="' + idx + '">' + renderCard(card, false) + '</div>';
    });
    container.innerHTML = html;
    bindHandClicks(container);
  }

  function updateHandSelection(container) {
    container.querySelectorAll('.b2-hand-card').forEach(function (cardEl) {
      var idx = parseInt(cardEl.dataset.idx, 10);
      var shouldSelect = state.selectedIndices.indexOf(idx) >= 0;
      if (shouldSelect) {
        cardEl.classList.add('selected');
      } else {
        cardEl.classList.remove('selected');
      }
    });
  }

  function bindHandClicks(container) {
    container.querySelectorAll('.b2-hand-card').forEach(function (cardEl) {
      cardEl.addEventListener('click', function () {
        if (state.busy || state.gameOver || state.currentPlayerIdx !== 0) return;
        var idx = parseInt(cardEl.dataset.idx, 10);
        var pos = state.selectedIndices.indexOf(idx);
        if (pos >= 0) {
          state.selectedIndices.splice(pos, 1);
        } else {
          state.selectedIndices.push(idx);
        }
        updateHandSelection(container);
        renderButtons();
      });
    });
  }

  function renderStatus() {
    var statusEl = el('b2-status');
    if (statusEl) statusEl.textContent = state.message;
  }

  function renderButtons() {
    var playBtn = el('b2-play');
    var passBtn = el('b2-pass');
    var isMyTurn = state.currentPlayerIdx === 0 && !state.busy && !state.gameOver;
    if (playBtn) playBtn.disabled = !isMyTurn || state.selectedIndices.length === 0;
    if (passBtn) passBtn.disabled = !isMyTurn || !state.currentPlay; // can't pass on free lead
  }

  // --- Rules panel ---
  function toggleRules() {
    state.showRules = !state.showRules;
    var panel = el('b2-rules');
    if (panel) panel.style.display = state.showRules ? 'flex' : 'none';
  }

  // --- Open / Close ---
  function open() {
    el('bigtwo-overlay').classList.add('open');
    var flavor = el('b2-flavor');
    if (flavor) flavor.textContent = flavorLines[Math.floor(Math.random() * flavorLines.length)];
    newGame();
  }

  function close() {
    runToken++;
    state.showRules = false;
    var panel = el('b2-rules');
    if (panel) panel.style.display = 'none';
    el('bigtwo-overlay').classList.remove('open');
  }

  // --- Init ---
  document.addEventListener('DOMContentLoaded', function () {
    var closeBtn = el('b2-close');
    if (closeBtn) closeBtn.addEventListener('click', close);

    var backdrop = el('b2-backdrop');
    if (backdrop) backdrop.addEventListener('click', close);

    var helpBtn = el('b2-help');
    if (helpBtn) helpBtn.addEventListener('click', toggleRules);

    var playBtn = el('b2-play');
    if (playBtn) playBtn.addEventListener('click', humanPlay);

    var passBtn = el('b2-pass');
    if (passBtn) passBtn.addEventListener('click', humanPass);

    var newBtn = el('b2-new');
    if (newBtn) newBtn.addEventListener('click', newGame);

    // Close rules when clicking overlay background
    var rulesOverlay = el('b2-rules');
    if (rulesOverlay) {
      rulesOverlay.addEventListener('click', function (e) {
        if (e.target === rulesOverlay) toggleRules();
      });
    }
  });

  return { open: open, close: close };
})();
