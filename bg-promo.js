/* ==========================================================================
   BasicGym Riverside - "Back to Basic" promotion engine
   v1.0  |  24 August 2026  |  Charles Piper

   WHAT IT DOES
   Runs a genuinely recurring, genuinely time-limited discount window.
   The window opens and closes on a fixed weekly schedule in London time.
   While a window is open the BACK26 code is shown and the countdown runs to
   the real close time. While it is closed the code is hidden, full price is
   shown, and the next opening is announced.

   WHY IT IS BUILT THIS WAY
   The countdown must expire on a real deadline and the discount must actually
   stop being available. A timer that resets, or a code that still works after
   the clock hits zero, is a banned commercial practice under Schedule 20(7)
   of the DMCC Act 2024. See CHANGES.md, section 4.

   HARD DEPENDENCY
   The Ashbourne coupon BACK26 must be enabled and disabled on exactly this
   schedule. If it stays live 24/7 the site and the checkout disagree.

   CACHE SAFETY
   Everything is computed client side, so LiteSpeed full page cache stays
   valid. Nothing here is rendered server side. Do not wrap any of this in PHP.

   INSTALL
   Load once, site wide, before the closing </body> tag. Options:
     a) Elementor > Site Settings > Custom Code > footer, wrapped in <script>
     b) Upload to the child theme and wp_enqueue_script with the footer flag
   Then add the markup hooks (see MARKUP CONTRACT below) to any page.
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------
     1. CONFIG - the only block you edit
     ------------------------------------------------------------------ */
  var CONFIG = {

    code: 'BACK26',

    tz: 'Europe/London',

    /* ROLLING CYCLE
       Riaz's brief: a promo that runs for three days, then resets, so a new
       promotion can be run each cycle.

       anchor  the London date and time the very first window opened
       onDays  how long each window stays open
       offDays the gap before the next one opens

       onDays 3 / offDays 3 gives a six day cycle: three days on, three off.
       Set offDays to 0 only if each cycle carries a genuinely DIFFERENT
       offer, otherwise the countdown expires onto the same deal and the
       deadline is not real. See CHANGES-v2.md section 3. */
    anchor: { y: 2026, m: 9, d: 1, h: 9, min: 0 },
    onDays: 3,
    offDays: 3,

    /* Dates to skip entirely, as London calendar dates 'YYYY-MM-DD'.
       Matched against the window OPEN date. Use for Christmas, audits, etc. */
    blackoutDates: [],

    /* Hard stop. After this instant the engine renders the closed state
       permanently and stops ticking. Set to null for no end date.
       Format: London wall clock [year, month(1-12), day, hour, minute] */
    campaignEnds: null,   // e.g. [2026, 12, 31, 23, 59]

    /* Query parameter Ashbourne expects for a pre-applied coupon.
       *** UNCONFIRMED - see CHANGES.md question 6. Do not go live on this
       assumption without Reece or Keira confirming the parameter name. ***
       Set to null to disable coupon pre-fill on join links entirely. */
    couponParam: 'couponCode',

    /* Show seconds in the countdown. Off after 24h remaining looks calmer. */
    showSeconds: true,

    /* dataLayer event names for Avi's GTM / server side CAPI */
    dlStateEvent: 'bg_promo_state',
    dlCopyEvent: 'bg_promo_code_copied'
  };


  /* ------------------------------------------------------------------
     2. MARKUP CONTRACT
     ------------------------------------------------------------------

     The engine sets a state flag on <html>:
         data-bg-promo="live"    or    data-bg-promo="closed"
     so you can style either state in pure CSS with no JS in the widget.

     Element hooks (all optional, use what a page needs):

       data-bg-when="live"        element shown only while a window is open
       data-bg-when="closed"      element shown only while it is shut

       data-bg-count="days"       zero padded countdown digits
       data-bg-count="hours"
       data-bg-count="mins"
       data-bg-count="secs"
       data-bg-count="full"       "1d 04h 22m 10s" in one element

       data-bg-code               text content set to the discount code
       data-bg-copy               button, copies the code to clipboard
       data-bg-closes             human close time, "Thursday 9am"
       data-bg-opens              human next open time, "Friday 9am"
       data-bg-sr                 screen reader summary, updated each minute

       data-bg-join               anchor, gets the coupon appended while live

     Reserve the countdown's space in CSS so nothing shifts on first paint.
     ------------------------------------------------------------------ */


  /* ------------------------------------------------------------------
     3. Time helpers - London wall clock, DST correct
     ------------------------------------------------------------------ */

  var root = document.documentElement;
  var DAY = 86400000;
  var hasIntl = typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function';

  var fmt = hasIntl ? new Intl.DateTimeFormat('en-GB', {
    timeZone: CONFIG.tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }) : null;

  /* Offset in ms between UTC and London at a given instant. */
  function offsetMs(ms) {
    if (!fmt) return 0;
    var parts = {};
    fmt.formatToParts(new Date(ms)).forEach(function (p) { parts[p.type] = p.value; });
    var asUTC = Date.UTC(
      +parts.year, +parts.month - 1, +parts.day,
      (+parts.hour) % 24, +parts.minute, +parts.second
    );
    return asUTC - (Math.floor(ms / 1000) * 1000);
  }

  /* A Date whose UTC getters return London wall clock fields. */
  function londonClock(ms) {
    return new Date(ms + offsetMs(ms));
  }

  /* Convert a London wall clock moment back to a real instant.
     Two passes so spring forward and autumn back land correctly. */
  function fromLondon(y, mo, d, h, mi) {
    var naive = Date.UTC(y, mo, d, h, mi, 0);
    var t = naive - offsetMs(naive);
    t = naive - offsetMs(t);
    return t;
  }

  function isoDate(ms) {
    var c = londonClock(ms);
    return c.getUTCFullYear() + '-' +
      pad(c.getUTCMonth() + 1) + '-' +
      pad(c.getUTCDate());
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }


  /* ------------------------------------------------------------------
     4. Window resolution
     ------------------------------------------------------------------ */

  /* Build the window instances around now from the rolling cycle.
     Boundaries are pinned to London wall clock, so a window still opens at
     09:00 local after the clocks change rather than drifting to 08:00. */
  function instances(now) {
    var a = CONFIG.anchor;
    var period = CONFIG.onDays + CONFIG.offDays;
    if (period < 1) period = 1;

    var anchorMs = fromLondon(a.y, a.m - 1, a.d, a.h, a.min);
    var elapsedDays = Math.floor((now - anchorMs) / DAY);
    var cycleIndex = Math.floor(elapsedDays / period);

    var out = [];
    for (var k = cycleIndex - 2; k <= cycleIndex + 2; k++) {
      var startDay = k * period;
      var openAt = fromLondon(a.y, a.m - 1, a.d + startDay, a.h, a.min);
      var closeAt = fromLondon(a.y, a.m - 1, a.d + startDay + CONFIG.onDays, a.h, a.min);
      if (CONFIG.blackoutDates.indexOf(isoDate(openAt)) !== -1) continue;
      if (closeAt > openAt) out.push({ open: openAt, close: closeAt });
    }
    out.sort(function (a2, b2) { return a2.open - b2.open; });
    return out;
  }

  var campaignEndMs = CONFIG.campaignEnds
    ? fromLondon(CONFIG.campaignEnds[0], CONFIG.campaignEnds[1] - 1,
                 CONFIG.campaignEnds[2], CONFIG.campaignEnds[3], CONFIG.campaignEnds[4])
    : null;

  /* resolve() walks a rolling 18 day band and does a lot of Intl work, so its
     answer is cached until the moment it would actually change. The per second
     tick then costs nothing but arithmetic. */
  var cache = null;

  /* STAGING PREVIEW OVERRIDE
     Lets a reviewer see both states without waiting for a real window.
     Deliberately gated on <html data-bg-staging>, which only the staging
     build sets, so even if window.BG_PROMO_FORCE were ever set on the live
     site it would be ignored. Never add data-bg-staging to production. */
  function forced() {
    if (!root.hasAttribute('data-bg-staging')) return null;
    var f = window.BG_PROMO_FORCE;
    if (f !== 'live' && f !== 'closed') return null;
    var xs = instances(Date.now()), nextOpen = null, nextClose = null, i;
    for (i = 0; i < xs.length; i++) {
      if (xs[i].open > Date.now()) { nextOpen = xs[i].open; break; }
    }
    nextClose = Date.now() + 36 * 3600000;
    return f === 'live'
      ? { live: true, until: nextClose, next: nextOpen }
      : { live: false, next: nextOpen };
  }

  function resolve(now) {
    var f = forced();
    if (f) return f;
    if (cache && now >= cache.validFrom && now < cache.validTo) return cache.value;
    var value = computeState(now);
    var validTo = value.live ? value.until : (value.next || (now + 6 * 3600000));
    cache = { validFrom: now - 1, validTo: validTo, value: value };
    return value;
  }

  function invalidate() { cache = null; }

  function computeState(now) {
    if (campaignEndMs && now >= campaignEndMs) return { live: false, next: null, ended: true };

    var xs = instances(now), i;

    for (i = 0; i < xs.length; i++) {
      if (now >= xs[i].open && now < xs[i].close) {
        var closeAt = xs[i].close;
        if (campaignEndMs && campaignEndMs < closeAt) closeAt = campaignEndMs;
        return { live: true, until: closeAt, next: xs[i + 1] ? xs[i + 1].open : null };
      }
    }
    for (i = 0; i < xs.length; i++) {
      if (xs[i].open > now) {
        if (campaignEndMs && xs[i].open >= campaignEndMs) break;
        return { live: false, next: xs[i].open };
      }
    }
    return { live: false, next: null };
  }


  /* ------------------------------------------------------------------
     5. Formatting
     ------------------------------------------------------------------ */

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* "Thursday 9am", "Friday 9.30am", "Monday 12pm" */
  function humanTime(ms) {
    if (ms == null) return '';
    var c = londonClock(ms);
    var h = c.getUTCHours(), m = c.getUTCMinutes();
    var suffix = h < 12 ? 'am' : 'pm';
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    var time = m === 0 ? h12 + suffix : h12 + '.' + pad(m) + suffix;
    return DAYS[c.getUTCDay()] + ' ' + time;
  }

  function split(remaining) {
    if (remaining < 0) remaining = 0;
    var s = Math.floor(remaining / 1000);
    return {
      d: Math.floor(s / 86400),
      h: Math.floor(s % 86400 / 3600),
      m: Math.floor(s % 3600 / 60),
      s: s % 60
    };
  }

  function full(p) {
    var out = [];
    if (p.d) out.push(p.d + 'd');
    out.push(pad(p.h) + 'h');
    out.push(pad(p.m) + 'm');
    if (CONFIG.showSeconds && !p.d) out.push(pad(p.s) + 's');
    return out.join(' ');
  }

  function srText(state, p) {
    if (!state.live) {
      return state.next
        ? 'The Back to Basic offer is closed. It opens again ' + humanTime(state.next) + '.'
        : 'The Back to Basic offer is closed.';
    }
    var bits = [];
    if (p.d) bits.push(p.d + (p.d === 1 ? ' day' : ' days'));
    bits.push(p.h + (p.h === 1 ? ' hour' : ' hours'));
    bits.push(p.m + (p.m === 1 ? ' minute' : ' minutes'));
    return 'Back to Basic offer, code ' + CONFIG.code +
           '. Closes in ' + bits.join(', ') + ', at ' + humanTime(state.until) + '.';
  }


  /* ------------------------------------------------------------------
     6. Render
     ------------------------------------------------------------------ */

  var lastState = null;
  var lastMinute = null;
  var timer = null;

  function q(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function setText(sel, value) {
    q(sel).forEach(function (el) { if (el.textContent !== value) el.textContent = value; });
  }

  function applyJoinLinks(live) {
    if (!CONFIG.couponParam) return;
    q('[data-bg-join]').forEach(function (a) {
      var base = a.getAttribute('data-bg-join-base');
      if (!base) { base = a.getAttribute('href') || ''; a.setAttribute('data-bg-join-base', base); }
      if (!base) return;
      if (!live) { a.setAttribute('href', base); return; }
      var joiner = base.indexOf('?') === -1 ? '?' : '&';
      a.setAttribute('href', base + joiner +
        encodeURIComponent(CONFIG.couponParam) + '=' + encodeURIComponent(CONFIG.code));
    });
  }

  function render() {
    var now = Date.now();
    var state = resolve(now);
    var stateKey = state.live ? 'live' : 'closed';

    if (stateKey !== lastState) {
      root.setAttribute('data-bg-promo', stateKey);
      q('[data-bg-when]').forEach(function (el) {
        var show = el.getAttribute('data-bg-when') === stateKey;
        el.hidden = !show;
      });
      setText('[data-bg-code]', CONFIG.code);
      setText('[data-bg-closes]', humanTime(state.until));
      setText('[data-bg-opens]', humanTime(state.next));
      applyJoinLinks(state.live);
      pushState(state, lastState !== null);
      lastState = stateKey;
      lastMinute = null;
    }

    var p = split(state.live ? state.until - now : 0);

    if (state.live) {
      setText('[data-bg-count="days"]', String(p.d));
      setText('[data-bg-count="hours"]', pad(p.h));
      setText('[data-bg-count="mins"]', pad(p.m));
      setText('[data-bg-count="secs"]', pad(p.s));
      setText('[data-bg-count="full"]', full(p));
    }

    /* Screen reader line updates once a minute, not once a second. */
    var minuteKey = state.live ? (p.d + ':' + p.h + ':' + p.m) : 'closed';
    if (minuteKey !== lastMinute) {
      setText('[data-bg-sr]', srText(state, p));
      lastMinute = minuteKey;
    }
  }

  function pushState(state, isTransition) {
    if (!window.dataLayer) window.dataLayer = [];
    window.dataLayer.push({
      event: CONFIG.dlStateEvent,
      promo_code: CONFIG.code,
      promo_state: state.live ? 'live' : 'closed',
      promo_closes_at: state.until ? new Date(state.until).toISOString() : null,
      promo_opens_at: state.next ? new Date(state.next).toISOString() : null,
      promo_transition: !!isTransition
    });
  }


  /* ------------------------------------------------------------------
     7. Copy to clipboard
     ------------------------------------------------------------------ */

  function bindCopy() {
    q('[data-bg-copy]').forEach(function (btn) {
      if (btn.getAttribute('data-bg-bound')) return;
      btn.setAttribute('data-bg-bound', '1');

      btn.addEventListener('click', function () {
        var done = function () {
          var original = btn.getAttribute('data-bg-copy-label') || btn.textContent;
          btn.setAttribute('data-bg-copy-label', original);
          btn.textContent = 'Copied';
          btn.classList.add('is-copied');
          setTimeout(function () {
            btn.textContent = original;
            btn.classList.remove('is-copied');
          }, 2000);

          if (!window.dataLayer) window.dataLayer = [];
          window.dataLayer.push({ event: CONFIG.dlCopyEvent, promo_code: CONFIG.code });
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(CONFIG.code).then(done).catch(fallback);
        } else {
          fallback();
        }

        function fallback() {
          var ta = document.createElement('textarea');
          ta.value = CONFIG.code;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); done(); } catch (e) { /* silent */ }
          document.body.removeChild(ta);
        }
      });
    });
  }


  /* ------------------------------------------------------------------
     8. Boot
     ------------------------------------------------------------------ */

  function tick() {
    render();
    var delay = CONFIG.showSeconds ? 1000 : 15000;
    timer = setTimeout(tick, delay);
  }

  function start() {
    if (timer) clearTimeout(timer);
    tick();
  }

  function stop() {
    if (timer) { clearTimeout(timer); timer = null; }
  }

  /* A laptop that sleeps for three hours must not wake showing a stale
     clock, so recompute hard on visibility and focus. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stop(); } else { invalidate(); start(); }
  });
  window.addEventListener('focus', function () { invalidate(); render(); });
  window.addEventListener('pageshow', function () { invalidate(); render(); });

  function init() {
    bindCopy();
    start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Small public surface for debugging in the console. */
  window.BGPromo = {
    config: CONFIG,
    state: function () { return resolve(Date.now()); },
    /* Preview any moment: BGPromo.at(2026,9,3,10,0) -> 3 Oct 2026 10:00 London */
    at: function (y, mo, d, h, mi) { return computeState(fromLondon(y, mo - 1, d, h, mi || 0)); },
    refresh: function () { invalidate(); render(); }
  };

})();
