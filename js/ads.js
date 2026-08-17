/* ============================================================
   Google AdSense setup (centralized).
   -----------------------------------------
   HOW THE LOADER WORKS:
   Every page's <head> already includes the AdSense loader
   directly (the standard snippet, with the publisher ID baked
   into the src). injectLoader() below is only a fallback for a
   page that is ever missing that script tag — it is a no-op on
   all current pages because loaderInjected() finds the existing
   tag, so the loader is never injected twice.
   IMPORTANT: keep ADSENSE_CONFIG.client in sync with the
   publisher ID in the pages' loader tags.

   TWO WAYS TO GO LIVE:

   Option A — Auto ads (recommended, simplest):
     1. In AdSense → Ads → Auto ads, enable auto ads.
     2. Leave manualSlots: false. Google places ads on every
        page automatically; the .ad-slot placeholder boxes stay
        hidden (see css/style.css). Nothing else to do.

   Option B — Manual ad units:
     1. Create responsive ad units in AdSense.
     2. Replace each data-ad-slot="0000000000" placeholder in
        the HTML pages with your real ad unit IDs.
     3. Set manualSlots: true below. ads.js then turns each
        placeholder into an <ins class="adsbygoogle"> unit and
        pushes it to the loader.

   You can start with auto ads now and switch to manual units
   later without touching the pages.
   ============================================================ */

(function () {
  "use strict";

  var ADSENSE_CONFIG = {
    client: "ca-pub-9864335019534391", // publisher ID (AdSense → Settings → Account information)
    manualSlots: false // true = render the manual ad units in the pages; false = auto ads only
  };

  function loaderInjected() {
    return !!document.querySelector('script[src*="adsbygoogle.js"]');
  }

  function injectLoader() {
    if (!ADSENSE_CONFIG.client || loaderInjected()) return;
    var s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
      ADSENSE_CONFIG.client;
    document.head.appendChild(s);
  }

  function fillSlots() {
    if (!ADSENSE_CONFIG.client || !ADSENSE_CONFIG.manualSlots) return; // leave placeholder text
    var slots = document.querySelectorAll(".ad-slot");
    if (!slots.length) return;
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (slot.dataset.filled) continue;
      slot.dataset.filled = "1";
      slot.classList.add("filled");
      var adSlotId = slot.dataset.adSlot || "0000000000";
      var ins = document.createElement("ins");
      ins.className = "adsbygoogle";
      ins.style.display = "block";
      ins.dataset.adClient = ADSENSE_CONFIG.client;
      ins.dataset.adSlot = adSlotId;
      ins.dataset.adFormat = "auto";
      ins.dataset.fullWidthResponsive = "true";
      slot.textContent = "";
      slot.appendChild(ins);
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    }
  }

  function init() {
    injectLoader();
    if (ADSENSE_CONFIG.client) {
      // wait for the loader, then fill slots and push
      var tries = 0;
      (function wait() {
        if (loaderInjected() && tries++ < 50) {
          fillSlots();
        } else if (tries < 50) {
          setTimeout(wait, 100);
        }
      })();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
