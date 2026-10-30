/* Staging copy of elementor/00-site-wide-offer-script.html. Edit that file, then rebuild. */
(function(){var s=document.createElement("style");s.textContent="[data-bg-when][hidden]{display:none!important}";document.head.appendChild(s);})();
/* ==========================================================================
   BasicGym Riverside - SAVE50 offer, site wide (30 Oct 2026)
   Replaces the Back to Basic / BACK26 script in Elementor > Custom Code.

   The offer:
     - 50% off the first month on every membership
     - 12 month plans (Off Peak 17.99, Plus 24.99): joining fee waived too
     - monthly plans (Off Peak 21.99, Monthly 27.99): 14.99 joining fee applies
     - day pass: no offer
   No end date and no spaces count, so there is nothing to keep true by hand.

   OFFER_ON = false switches every SAVE50 block off across the site and shows
   the standard price lines instead. CODE fills every [data-bg-code].
   ========================================================================== */
(function () {
  'use strict';

  var OFFER_ON = true;      /* false turns the offer off site wide */
  var CODE     = 'SAVE50';

  /* staging preview only: ?offer=off shows the site with the offer switched off */
  if (window.BG_STAGING && /[?&]offer=off\b/.test(location.search)) OFFER_ON = false;

  var root = document.documentElement;

  function all(sel) {
    return Array.prototype.slice.call(document.querySelectorAll(sel));
  }

  function render() {
    var state = OFFER_ON ? 'live' : 'closed';
    root.setAttribute('data-bg-promo', state);

    all('[data-bg-when]').forEach(function (el) {
      el.hidden = el.getAttribute('data-bg-when') !== state;
    });

    all('[data-bg-code]').forEach(function (el) {
      if (el.textContent !== CODE) el.textContent = CODE;
    });

    if (!window.dataLayer) window.dataLayer = [];
    window.dataLayer.push({ event: 'bg_promo_state', promo_code: CODE, promo_state: state });
  }

  function bindCopy() {
    all('[data-bg-copy]').forEach(function (btn) {
      if (btn.getAttribute('data-bound')) return;
      btn.setAttribute('data-bound', '1');
      btn.addEventListener('click', function () {
        function done() {
          var original = btn.getAttribute('data-label') || btn.textContent;
          btn.setAttribute('data-label', original);
          btn.textContent = 'Copied';
          setTimeout(function () { btn.textContent = original; }, 2000);
          if (!window.dataLayer) window.dataLayer = [];
          window.dataLayer.push({ event: 'bg_promo_code_copied', promo_code: CODE });
        }
        function fallback() {
          var ta = document.createElement('textarea');
          ta.value = CODE;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); done(); } catch (e) { /* silent */ }
          document.body.removeChild(ta);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(CODE).then(done).catch(fallback);
        } else {
          fallback();
        }
      });
    });
  }

  function init() { render(); bindCopy(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.BGPromo = { render: render, code: CODE, live: OFFER_ON };
})();
