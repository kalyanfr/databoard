/* Data Board tracking script.
 *
 * Loaded by customer websites as <script defer src="/t.js" data-site="acme.com">.
 * Deliberately tiny and dependency-free: it derives the collector origin from
 * its own src, keeps an anonymous visitor id in localStorage (no cookies, no
 * fingerprinting), respects Do Not Track, batches hits and flushes them with
 * sendBeacon/fetch so a page never waits on analytics.
 */
(function () {
  var current = document.currentScript;
  if (!current) {
    var tags = document.getElementsByTagName('script');
    for (var i = tags.length - 1; i >= 0; i--) {
      var src = tags[i].getAttribute('src') || '';
      if (src.indexOf('/t.js') !== -1) { current = tags[i]; break; }
    }
  }
  if (!current) return;

  var ORIGIN = '';
  try { ORIGIN = new URL(current.src, window.location.href).origin; } catch (e) { ORIGIN = ''; }
  if (!ORIGIN) return;

  var ENDPOINT = ORIGIN + '/functions/track';
  var GAP = 30 * 60 * 1000;
  var MAX_BATCH = 25;

  function attr(name) { return current && current.getAttribute ? current.getAttribute(name) : null; }
  var site = attr('data-site') || (typeof window !== 'undefined' && window.location ? window.location.hostname.replace(/^www\./, '') : '');
  var pid = attr('data-key') || attr('data-site') || attr('data-project-id') || site;
  if (!pid) {
    var all = document.getElementsByTagName('script');
    for (var j = all.length - 1; j >= 0; j--) {
      var value = all[j].getAttribute('data-key') || all[j].getAttribute('data-site') || all[j].getAttribute('data-project-id');
      if (value) { pid = value; break; }
    }
  }
  if (!pid) return;

  var nav = navigator;
  if (nav.doNotTrack === '1' || window.doNotTrack === '1' || nav.msDoNotTrack === '1' || nav.globalPrivacyControl === true) return;

  var store = window.localStorage;
  var queue = [];
  var timer = null;
  var lastHit = null;

  function read(key) { try { return store.getItem(key); } catch (e) { return null; } }
  function write(key, value) { try { store.setItem(key, value); } catch (e) {} }
  function uid() {
    var crypto = window.crypto;
    if (crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '');
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  function visitor() {
    var id = read('lume_visitor');
    if (!id) { id = uid(); write('lume_visitor', id); }
    return id;
  }
  function session() {
    var now = Date.now();
    var id = read('lume_session');
    var seen = parseInt(read('lume_seen') || '0', 10);
    if (!id || !seen || now - seen > GAP) { id = uid(); write('lume_session', id); }
    write('lume_seen', String(now));
    return id;
  }
  function utm() {
    var out = {};
    var search = window.location.search || '';
    if (search.length < 2) return out;
    var pairs = search.replace(/^\?/, '').split('&');
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i].split('=');
      var key = decodeURIComponent(pair[0] || '');
      if (key.indexOf('utm_') !== 0) continue;
      out[key] = decodeURIComponent((pair[1] || '').replace(/\+/g, ' ')).slice(0, 120);
    }
    return out;
  }
  function send() {
    if (!queue.length) return;
    var batch = queue.splice(0, MAX_BATCH);
    var body = JSON.stringify({ pid: pid, site: site, events: batch });
    if (nav.sendBeacon) {
      try {
        if (nav.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain;charset=UTF-8' }))) return;
      } catch (e) {}
    }
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: body,
        keepalive: true,
        credentials: 'omit',
        mode: 'cors'
      });
    } catch (e) {}
  }
  function schedule() {
    if (timer) return;
    timer = window.setTimeout(function () { timer = null; send(); }, 2000);
  }
  function push(hit) {
    queue.push(hit);
    if (queue.length >= 10) {
      if (timer) { clearTimeout(timer); timer = null; }
      send();
    } else {
      schedule();
    }
  }
  function autoDetectAuth() {
    try {
      var currentUid = read('lume_user_id');

      // 1. Clerk SDK check (window.Clerk)
      if (window.Clerk && window.Clerk.user) {
        var cu = window.Clerk.user;
        var cEmail = cu.primaryEmailAddress ? cu.primaryEmailAddress.emailAddress : (cu.emailAddresses && cu.emailAddresses[0] ? cu.emailAddresses[0].emailAddress : null);
        var cName = (cu.fullName || (cu.firstName || '') + (cu.lastName ? ' ' + cu.lastName : '')).trim();
        var cId = cu.id || cEmail;
        if (cId && currentUid !== cId) {
          identify(cId, { email: cEmail, name: cName || undefined, auth_provider: 'clerk' });
          return cId;
        }
      }

      // 2. Ads Tracker / Custom App Session in localStorage (e.g. ads_tracker_session)
      var sessionStr = read('ads_tracker_session') || read('user_session') || read('sb-auth-token');
      if (sessionStr) {
        try {
          var parsed = JSON.parse(sessionStr);
          var sEmail = parsed.email || (parsed.user && parsed.user.email);
          var sUid = parsed.uid || parsed.id || (parsed.user && parsed.user.id) || sEmail;
          if (sUid && currentUid !== sUid) {
            identify(sUid, { email: sEmail, auth_provider: 'ads_tracker_session' });
            return sUid;
          }
        } catch (e) {}
      }
    } catch (e) {}
    return null;
  }

  function context() {
    autoDetectAuth();
    return {
      u: window.location.href.slice(0, 900),
      p: window.location.pathname.slice(0, 500),
      r: (document.referrer || '').slice(0, 500),
      sid: session(),
      vid: visitor(),
      uid: read('lume_user_id') || null,
      sw: window.screen ? window.screen.width : null
    };
  }
  function pageview() {
    var key = window.location.pathname + window.location.search;
    if (lastHit === key) return;
    lastHit = key;
    reportedScroll = {};
    var hit = context();
    hit.t = 'pageview';
    hit.ti = new Date().toISOString();
    hit.utm = utm();
    push(hit);
    if (immediate) {
      if (timer) { clearTimeout(timer); timer = null; }
      send();
    }
  }

  function goal(name, props) {
    track(name, props, true);
  }
  function track(name, props, immediate) {
    if (!name) return;
    var hit = context();
    hit.t = 'event';
    hit.n = String(name).slice(0, 80);
    hit.ti = new Date().toISOString();
    if (props && typeof props === 'object') {
      var clean = {};
      var keys = Object.keys(props).slice(0, 20);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key === 'revenue') continue;
        var value = props[key];
        if (value === null || value === undefined || typeof value === 'function') continue;
        clean[key.slice(0, 40)] = typeof value === 'object' ? '[object]' : String(value).slice(0, 300);
      }
      var revenue = typeof props.revenue === 'string' ? Number(props.revenue) : props.revenue;
      if (typeof revenue === 'number' && isFinite(revenue) && revenue >= 0) hit.rev = revenue;
      if (typeof clean.target === 'string' && clean.target) { hit.tg = clean.target.slice(0, 500); delete clean.target; }
      hit.props = clean;
    } else if (typeof props === 'number' && isFinite(props)) {
      hit.rev = props;
    }
    push(hit);
  }

  function identify(userId, traits) {
    if (!userId) return;
    var cleanId = String(userId).slice(0, 100);
    write('lume_user_id', cleanId);
    var hit = context();
    hit.t = 'identify';
    hit.uid = cleanId;
    hit.ti = new Date().toISOString();
    if (traits && typeof traits === 'object') {
      var clean = {};
      var keys = Object.keys(traits).slice(0, 30);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var val = traits[key];
        if (val === null || val === undefined || typeof val === 'function') continue;
        clean[key.slice(0, 40)] = typeof val === 'object' ? JSON.stringify(val).slice(0, 300) : String(val).slice(0, 300);
      }
      hit.traits = clean;
    }
    push(hit);
  }

  function reset() {
    try {
      store.removeItem('lume_user_id');
      store.removeItem('lume_visitor');
      store.removeItem('lume_session');
      store.removeItem('lume_seen');
    } catch (e) {}
  }

  var api = {
    track: track,
    goal: goal,
    pageview: function () { lastHit = null; pageview(); },
    identify: identify,
    reset: reset,
    getVisitorId: function () { return visitor(); },
    getSessionId: function () { return session(); },
    getUserId: function () { return read('lume_user_id'); }
  };

  window.analytics = api;
  window.datafast = function (action, a, b) {
    if (action === 'identify') identify(a, b);
    else if (action === 'track') track(a, b);
    else if (action === 'goal') goal(a, b);
    else if (action === 'pageview') api.pageview();
    else if (action === 'reset') reset();
  };
  for (var k in api) { window.datafast[k] = api[k]; }
  window.minilytics = api;

  // Auto-capture: data-event buttons, outbound links, file downloads and forms.
  var DOWNLOAD_RE = /\.(pdf|zip|rar|7z|gz|tar|tgz|doc|docx|xls|xlsx|ppt|pptx|csv|dmg|exe|apk|msi|mp3|mp4|mov|avi|webm|epub|ogg|wav)$/i;

  function absoluteHref(href) {
    try { return new URL(href, window.location.href).href.slice(0, 500); } catch (e) { return ''; }
  }

  function extractGoalProps(el) {
    var props = {};
    if (!el || !el.attributes) return props;
    for (var i = 0; i < el.attributes.length; i++) {
      var at = el.attributes[i];
      var aname = at.name.toLowerCase();
      var val = at.value;
      if (aname.indexOf('data-goal-') === 0 && aname !== 'data-goal-revenue' && aname !== 'data-goal-currency') {
        props[aname.slice(10)] = val.slice(0, 200);
      } else if (aname.indexOf('data-prop-') === 0) {
        props[aname.slice(10)] = val.slice(0, 200);
      } else if (aname.indexOf('data-event-') === 0 && aname !== 'data-event-revenue') {
        props[aname.slice(11)] = val.slice(0, 200);
      }
    }
    var rev = el.getAttribute('data-revenue') || el.getAttribute('data-goal-revenue') || el.getAttribute('data-value');
    if (rev && !isNaN(Number(rev))) {
      props.revenue = Number(rev);
    }
    var curr = el.getAttribute('data-currency') || el.getAttribute('data-goal-currency');
    if (curr) {
      props.currency = String(curr).slice(0, 10);
    }
    return props;
  }

  document.addEventListener('click', function (event) {
    try {
      var goalEl = event.target && event.target.closest ? event.target.closest('[data-goal], [data-event], [data-track], [data-ml-goal]') : null;
      if (goalEl) {
        var goalName = goalEl.getAttribute('data-goal') || goalEl.getAttribute('data-event') || goalEl.getAttribute('data-track') || goalEl.getAttribute('data-ml-goal');
        if (goalName) {
          var props = extractGoalProps(goalEl);
          track(goalName, Object.keys(props).length ? props : undefined, true);
        }
      }

      var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      if (!link) return;
      var href = absoluteHref(link.getAttribute('href'));
      if (!href) return;
      var clean = href.split(/[?#]/)[0].toLowerCase();
      if (DOWNLOAD_RE.test(clean)) { track('file_download', { target: href }); return; }
      var target = null;
      try { target = new URL(href); } catch (e) { target = null; }
      if (target && (target.protocol === 'http:' || target.protocol === 'https:') && target.origin !== window.location.origin) {
        track('outbound_link', { target: href });
      }
    } catch (e) {}
  }, true);

  document.addEventListener('submit', function (event) {
    try {
      var form = event.target;
      if (!form || !form.tagName) return;
      var emailInput = form.querySelector ? form.querySelector('input[type="email"], input[name*="email" i], input[id*="email" i]') : null;
      if (emailInput && emailInput.value && emailInput.value.indexOf('@') !== -1) {
        var emailVal = emailInput.value.trim().toLowerCase();
        var nameInput = form.querySelector ? form.querySelector('input[name*="name" i], input[id*="name" i]') : null;
        var nameVal = nameInput ? nameInput.value.trim() : null;
        identify(emailVal, { email: emailVal, name: nameVal || undefined, source: 'form_auto_capture' });
      }
      var target = form.getAttribute('data-form-name') || form.action || window.location.href;
      track('form_submit', { target: String(target).slice(0, 500) });
    } catch (e) {}
  }, true);

  window.addEventListener('message', function (event) {
    try {
      if (event.data && (event.data.type === 'ADS_TRACKER_CLERK_TOKEN' || event.data.token || event.data.email)) {
        var d = event.data;
        var uid = d.uid || d.email;
        if (uid) {
          identify(uid, { email: d.email, name: d.label || d.name, auth_provider: 'clerk_message' });
        }
      }
    } catch (e) {}
  });

  window.setTimeout(autoDetectAuth, 600);
  window.setTimeout(autoDetectAuth, 2500);
  window.setTimeout(autoDetectAuth, 6000);

  // Auto-capture: scroll depth milestones and engaged time, flushed on page exit.
  var SCROLL_MILESTONES = [25, 50, 75, 100];
  var reportedScroll = {};
  var engagedSeconds = 0;

  function reportAuto(name, extra) {
    var hit = context();
    hit.t = 'event';
    hit.n = name;
    hit.ti = new Date().toISOString();
    if (extra) { for (var key in extra) hit[key] = extra[key]; }
    push(hit);
  }

  function measureScroll() {
    var doc = document.documentElement;
    var body = document.body;
    var scrollable = Math.max(1, Math.max(doc.scrollHeight, body ? body.scrollHeight : 0) - window.innerHeight);
    var y = window.scrollY || window.pageYOffset || doc.scrollTop || 0;
    var percent = Math.round(Math.min(100, Math.max(0, (y / scrollable) * 100)));
    for (var i = 0; i < SCROLL_MILESTONES.length; i++) {
      var mark = SCROLL_MILESTONES[i];
      if (percent >= mark && !reportedScroll[mark]) {
        reportedScroll[mark] = true;
        reportAuto('scroll_depth', { sd: mark });
      }
    }
  }

  var scrollTimer = null;
  window.addEventListener('scroll', function () {
    if (scrollTimer) return;
    scrollTimer = window.setTimeout(function () { scrollTimer = null; measureScroll(); }, 900);
  }, { passive: true });

  window.setInterval(function () {
    if (document.visibilityState === 'visible') engagedSeconds += 5;
  }, 5000);

  function flushEngaged() {
    if (engagedSeconds < 5) return;
    reportAuto('engaged_time', { eg: Math.min(engagedSeconds, 7200) });
    engagedSeconds = 0;
  }

  var wrap = function (method) {
    var original = history[method];
    if (!original) return;
    history[method] = function () {
      var result = original.apply(this, arguments);
      window.setTimeout(pageview, 60);
      return result;
    };
  };
  wrap('pushState');
  wrap('replaceState');
  window.addEventListener('popstate', function () { window.setTimeout(pageview, 60); });
  window.addEventListener('pagehide', function () { flushEngaged(); send(); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { flushEngaged(); send(); }
  });

  pageview();
})();
