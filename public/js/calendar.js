/* calendar.js — Economic Calendar panel */

var CalendarManager = (function () {
  var events = [];
  var currentFilter = 'all';
  var isLoading = false;

  function el(id) { return document.getElementById(id); }

  function setLoading(v) {
    isLoading = v;
    var loader = el('cal-loader');
    if (loader) loader.style.display = v ? 'flex' : 'none';
    var btn = el('cal-refresh');
    if (btn) btn.disabled = v;
  }

  function daysUntil(dateStr) {
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var target = new Date(dateStr + 'T00:00:00');
    var diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function formatDate(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    var weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return weekdays[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate();
  }

  function renderEvents() {
    var container = el('cal-list');
    if (!container) return;

    var filtered = currentFilter === 'all'
      ? events
      : events.filter(function (e) { return e.category === currentFilter; });

    if (!filtered.length) {
      container.innerHTML = '<div class="databento-empty">No events found. Try refreshing.</div>';
      return;
    }

    // Group by date
    var grouped = {};
    filtered.forEach(function (e) {
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(e);
    });

    var html = '';
    var dates = Object.keys(grouped).sort();

    dates.forEach(function (date) {
      var days = daysUntil(date);
      if (days < 0) return; // skip past events

      var dayLabel = days === 0 ? '<span class="cal-today">TODAY</span>'
        : days === 1 ? '<span class="cal-tomorrow">Tomorrow</span>'
        : '<span class="cal-days">' + days + ' days</span>';

      html += '<div class="cal-date-group">';
      html += '<div class="cal-date-header">' + formatDate(date) + ' ' + dayLabel + '</div>';

      grouped[date].forEach(function (e) {
        var impactClass = e.impact === 'high' ? 'cal-impact-high' : 'cal-impact-med';
        html += '<div class="cal-event">';
        html += '<span class="cal-event-icon">' + e.icon + '</span>';
        html += '<div class="cal-event-info">';
        html += '<div class="cal-event-name">' + e.nameZh + ' <span class="cal-event-en">' + e.name + '</span></div>';
        html += '<div class="cal-event-desc">' + e.description + '</div>';
        html += '</div>';
        html += '<span class="cal-badge ' + impactClass + '">' + (e.impact === 'high' ? 'HIGH' : 'MED') + '</span>';
        html += '</div>';
      });

      html += '</div>';
    });

    container.innerHTML = html || '<div class="databento-empty">No upcoming events in this category.</div>';
  }

  function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.cal-filter-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderEvents();
  }

  async function fetchCalendar(force) {
    if (isLoading) return;
    setLoading(true);
    el('cal-list').innerHTML = '';

    try {
      var url = '/api/calendar';
      if (force) url += '?refresh=1';
      var res = await fetch(url);
      if (!res.ok) throw new Error('Failed (' + res.status + ')');
      var data = await res.json();
      events = data.events || [];
      renderEvents();
    } catch (err) {
      el('cal-list').innerHTML = '<div class="databento-empty">Failed to load calendar: ' + err.message + '</div>';
    } finally {
      setLoading(false);
    }
  }

  function show() {
    hideAllPanels();
    el('calendar-panel').classList.add('visible');
    fetchCalendar(false);
  }

  function hide() {
    el('calendar-panel').classList.remove('visible');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var closeBtn = el('cal-close');
    if (closeBtn) closeBtn.addEventListener('click', function () {
      hide();
      document.getElementById('welcome').style.display = '';
    });

    var refreshBtn = el('cal-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', function () {
      fetchCalendar(true);
    });

    document.querySelectorAll('.cal-filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setFilter(btn.dataset.filter);
      });
    });
  });

  return { show: show, hide: hide };
})();
