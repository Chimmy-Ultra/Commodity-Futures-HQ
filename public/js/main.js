/* main.js — App initialization, sidebar, home page, casino popup, RWD */

(function () {
  var selectedCharId = null;

  function isMobile() { return window.innerWidth <= 768; }

  // Helper: render avatar as <img> tag
  function avatarImg(url, size, contain) {
    if (!url) return '';
    var s = size || 38;
    var cls = contain ? ' class="avatar-contain"' : '';
    return '<img src="' + url + '" alt=""' + cls + ' width="' + s + '" height="' + s + '" loading="lazy">';
  }

  // --- Sidebar rendering ---
  function buildSidebar() {
    var list = document.getElementById('sidebar-list');
    list.innerHTML = '';
    CHARS.forEach(function (c) {
      var card = document.createElement('div');
      card.className = 'char-card';
      card.dataset.id = c.id;
      card.innerHTML =
        '<div class="char-avatar">' + avatarImg(c.avatar, 38, c.avatarContain) + '</div>' +
        '<div class="char-info"><div class="char-name">' + c.name + '</div><div class="char-role">' + c.role + '</div></div>' +
        '<span class="char-badge ' + c.model.toLowerCase() + '">' + c.model + '</span>';
      card.addEventListener('click', function () { selectChar(c); });
      list.appendChild(card);
    });
  }

  // --- Home page team grid ---
  function buildHomeTeamGrid() {
    var grid = document.getElementById('home-team-grid');
    if (!grid) return;
    grid.innerHTML = '';
    CHARS.forEach(function (c) {
      var card = document.createElement('div');
      card.className = 'home-char-card';
      card.innerHTML =
        '<div class="home-char-avatar">' + avatarImg(c.avatar, 48, c.avatarContain) + '</div>' +
        '<div class="home-char-name">' + c.name + '</div>' +
        '<div class="home-char-role">' + c.role + '</div>' +
        (c.bio ? '<div class="home-char-bio">' + c.bio + '</div>' : '') +
        '<span class="home-char-badge ' + c.model.toLowerCase() + '">' + c.model + '</span>';
      card.addEventListener('click', function () { selectChar(c); });
      grid.appendChild(card);
    });
  }

  // --- Home page recent reports ---
  function buildHomeRecentReports() {
    var grid = document.getElementById('home-recent-reports');
    if (!grid) return;
    try {
      var raw = localStorage.getItem('commodity-hq-reports-v1');
      if (!raw) { grid.innerHTML = '<div class="databento-empty" style="grid-column:1/-1">No reports yet. Run an analysis to get started.</div>'; return; }
      var reports = JSON.parse(raw);
      if (!reports.length) { grid.innerHTML = '<div class="databento-empty" style="grid-column:1/-1">No reports yet.</div>'; return; }
      grid.innerHTML = '';
      reports.slice(0, 3).forEach(function (r) {
        var card = document.createElement('div');
        card.className = 'home-report-card';
        var timeAgo = getTimeAgo(r.timestamp);
        card.innerHTML = '<div class="home-report-title">' + (r.title || 'Report') + '</div><div class="home-report-time">' + timeAgo + '</div>';
        card.addEventListener('click', function () {
          if (typeof AnalysisManager !== 'undefined') AnalysisManager.showReportPanel();
        });
        grid.appendChild(card);
      });
    } catch (e) {
      grid.innerHTML = '<div class="databento-empty" style="grid-column:1/-1">No reports yet.</div>';
    }
  }

  function getTimeAgo(ts) {
    if (!ts) return '';
    var diff = Date.now() - new Date(ts).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    return days + 'd ago';
  }

  function highlightCard(charId) {
    var cards = document.querySelectorAll('.char-card');
    cards.forEach(function (card) {
      card.classList.toggle('active', card.dataset.id === charId);
    });
  }

  // --- Show home page ---
  function showHome() {
    selectedCharId = null;
    highlightCard('');
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
    var gcp = document.getElementById('groupchat-panel');
    if (gcp) gcp.classList.remove('visible');
    document.getElementById('welcome').style.display = '';
    buildHomeRecentReports();
    document.getElementById('topbar-title').textContent = 'Commodity HQ';
    document.getElementById('topbar-role').textContent = 'Select an analyst';
  }

  // --- Character selection ---
  function selectChar(c) {
    selectedCharId = c.id;
    highlightCard(c.id);
    ChatManager.open(c);
    document.getElementById('welcome').style.display = 'none';
    var kp = document.getElementById('kline-panel');
    if (kp) kp.classList.remove('visible');
    var dp = document.getElementById('databento-panel');
    if (dp) dp.classList.remove('visible');
    var cp2 = document.getElementById('corr-panel');
    if (cp2) cp2.classList.remove('visible');
    var calp2 = document.getElementById('calendar-panel');
    if (calp2) calp2.classList.remove('visible');
    var gcp2 = document.getElementById('groupchat-panel');
    if (gcp2) gcp2.classList.remove('visible');
    document.getElementById('topbar-title').textContent = c.name;
    document.getElementById('topbar-role').textContent = c.role;
    if (isMobile()) closeSidebar();
  }

  // --- Sidebar toggle ---
  function openSidebar() {
    document.getElementById('sidebar').classList.remove('collapsed');
    document.getElementById('sidebar-overlay').classList.add('visible');
  }
  function closeSidebar() {
    document.getElementById('sidebar').classList.add('collapsed');
    document.getElementById('sidebar-overlay').classList.remove('visible');
  }
  function toggleSidebar() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('collapsed')) openSidebar();
    else closeSidebar();
  }

  // --- Casino direct cards ---
  function initCasinoCards() {
    var map = { 'home-blackjack': Blackjack, 'home-roulette': Roulette, 'home-slots': Slots, 'home-poker': Poker };
    Object.keys(map).forEach(function (id) {
      var card = document.getElementById(id);
      if (card) card.addEventListener('click', function () { map[id].open(); });
    });
  }

  // --- RWD ---
  function handleResize() {
    if (isMobile()) {
      document.getElementById('sidebar').classList.add('collapsed');
      document.getElementById('sidebar-overlay').classList.remove('visible');
    } else {
      document.getElementById('sidebar').classList.remove('collapsed');
      document.getElementById('sidebar-overlay').classList.remove('visible');
    }
  }

  // --- Init ---
  document.addEventListener('DOMContentLoaded', function () {
    buildSidebar();
    buildHomeTeamGrid();
    buildHomeRecentReports();

    document.getElementById('hamburger').addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-collapse').addEventListener('click', closeSidebar);
    document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);
    document.querySelector('.sidebar-logo').addEventListener('click', showHome);

    document.getElementById('report-entry').addEventListener('click', function () {
      if (isMobile()) closeSidebar();
      AnalysisManager.showReportPanel();
    });
    document.getElementById('clear-all-chats').addEventListener('click', function () {
      if (isMobile()) closeSidebar();
      ChatManager.clearAll();
    });

    // Home page tool cards
    var homeKline = document.getElementById('home-kline');
    if (homeKline) homeKline.addEventListener('click', function () { KlineManager.show(); });
    var homeReports = document.getElementById('home-reports');
    if (homeReports) homeReports.addEventListener('click', function () { AnalysisManager.showReportPanel(); });
    var homeDatabento = document.getElementById('home-databento');
    if (homeDatabento) homeDatabento.addEventListener('click', function () { DatabentoManager.show(); });
    var homeCorr = document.getElementById('home-correlation');
    if (homeCorr) homeCorr.addEventListener('click', function () { CorrelationManager.show(); });
    var homeCal = document.getElementById('home-calendar');
    if (homeCal) homeCal.addEventListener('click', function () { CalendarManager.show(); });
    var homeGC = document.getElementById('home-groupchat');
    if (homeGC) homeGC.addEventListener('click', function () { GroupChatManager.show(); });

    // Casino direct cards
    initCasinoCards();

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        Blackjack.close();
        Roulette.close();
        Slots.close();
        Poker.close();
      }
    });

    handleResize();
    window.addEventListener('resize', handleResize);
  });

  // Export avatarImg for other modules
  window.avatarImg = avatarImg;
})();
