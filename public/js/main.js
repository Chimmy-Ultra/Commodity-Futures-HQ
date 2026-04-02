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

  // --- Sidebar nav ---
  function initSidebarNav() {
    var navMap = {
      'nav-home': function () { showHome(); },
      'nav-kline': function () { KlineManager.show(); },
      'nav-corr': function () { CorrelationManager.show(); },
      'nav-cal': function () { CalendarManager.show(); },
      'nav-gc': function () { GroupChatManager.show(); },
      'nav-reports': function () { AnalysisManager.showReportPanel(); },
      'nav-databento': function () { DatabentoManager.show(); },
      'nav-bscalc': function () { BSCalcManager.show(); },
    };
    Object.keys(navMap).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', function () {
        if (isMobile()) closeSidebar();
        navMap[id]();
        // highlight active nav
        document.querySelectorAll('.sidebar-nav-item').forEach(function (n) { n.classList.remove('active'); });
        el.classList.add('active');
      });
    });
  }

  // --- Sidebar ticker ---
  var tickerTimer = null;
  function fetchSidebarTicker() {
    fetch('/api/quotes/sidebar').then(function (r) { return r.json(); }).then(function (data) {
      var container = document.getElementById('sidebar-ticker');
      if (!container || !data.quotes) return;
      container.innerHTML = '';
      data.quotes.forEach(function (q) {
        var row = document.createElement('div');
        row.className = 'sidebar-ticker-item';
        var changeClass = (q.changePercent > 0) ? 'tk-up' : (q.changePercent < 0) ? 'tk-down' : 'tk-flat';
        var changeStr = q.changePercent != null ? (q.changePercent >= 0 ? '+' : '') + q.changePercent.toFixed(2) + '%' : '';
        var priceStr = q.price != null ? q.price.toFixed(q.precision || 2) : '—';
        row.innerHTML =
          '<div class="tk-label">' + q.label + '</div>' +
          '<div class="tk-price">' + priceStr + '</div>' +
          '<div class="tk-change ' + changeClass + '">' + changeStr + '</div>';
        row.addEventListener('click', function () {
          KlineManager.show(q.symbol);
          if (isMobile()) closeSidebar();
        });
        container.appendChild(row);
      });
    }).catch(function () {
      var container = document.getElementById('sidebar-ticker');
      if (container) container.innerHTML = '<div class="sidebar-ticker-loading">Failed to load</div>';
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
        '<div class="card-shine"></div>' +
        '<div class="home-char-avatar">' + avatarImg(c.avatar, 48, c.avatarContain) + '</div>' +
        '<div class="home-char-name">' + c.name + '</div>' +
        '<div class="home-char-role">' + c.role + '</div>' +
        (c.bio ? '<div class="home-char-bio">' + c.bio + '</div>' : '') +
        '<span class="home-char-badge ' + c.model.toLowerCase() + '">' + c.model + '</span>';
      card.addEventListener('click', function () { selectChar(c); });

      // 3D tilt effect
      card.addEventListener('mousemove', function (e) {
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var midX = rect.width / 2;
        var midY = rect.height / 2;
        var rotY = ((x - midX) / midX) * 15;
        var rotX = ((midY - y) / midY) * 15;
        card.style.transform = 'perspective(600px) rotateX(' + rotX + 'deg) rotateY(' + rotY + 'deg) scale(1.05)';
        var shine = card.querySelector('.card-shine');
        if (shine) shine.style.background = 'radial-gradient(circle at ' + x + 'px ' + y + 'px, rgba(255,255,255,0.3) 0%, transparent 60%)';
      });
      card.addEventListener('mouseleave', function () {
        card.style.transform = '';
        var shine = card.querySelector('.card-shine');
        if (shine) shine.style.background = 'transparent';
      });

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

  // --- Show home page ---
  function showHome() {
    selectedCharId = null;
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
    var bsp = document.getElementById('bscalc-panel');
    if (bsp) bsp.classList.remove('visible');
    document.getElementById('welcome').style.display = '';
    buildHomeRecentReports();
    document.getElementById('topbar-title').textContent = 'Commodity HQ';
    document.getElementById('topbar-role').textContent = 'Select an analyst';
  }

  // --- Character selection ---
  function selectChar(c) {
    selectedCharId = c.id;
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
    var bsp2 = document.getElementById('bscalc-panel');
    if (bsp2) bsp2.classList.remove('visible');
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
    var map = { 'home-blackjack': Blackjack, 'home-roulette': Roulette, 'home-slots': Slots, 'home-poker': Poker, 'home-bigtwo': BigTwo };
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
    initSidebarNav();
    buildHomeTeamGrid();
    buildHomeRecentReports();
    fetchSidebarTicker();
    tickerTimer = setInterval(fetchSidebarTicker, 45000);

    document.getElementById('hamburger').addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-collapse').addEventListener('click', closeSidebar);
    document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);
    document.querySelector('.sidebar-logo').addEventListener('click', showHome);

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
        BigTwo.close();
      }
    });

    handleResize();
    window.addEventListener('resize', handleResize);
  });

  // Export avatarImg for other modules
  window.avatarImg = avatarImg;
})();
