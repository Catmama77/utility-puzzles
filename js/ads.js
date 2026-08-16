/* ============================================================
   Google AdSense setup (centralized).
   -----------------------------------------
   TWO WAYS TO GO LIVE:

   Option A — Auto ads (recommended, simplest):
     1. In AdSense → Ads → Auto ads, enable auto ads.
     2. Paste your publisher ID into ADSENSE_CONFIG.client
        below and set manualSlots: false. The loader script
        injects itself on every page and AdSense places ads
        automatically. Nothing else to do.

   Option B — Manual ad units:
     1. Create ad units in AdSense (responsive).
     2. Paste your publisher ID into ADSENSE_CONFIG.client
        and set manualSlots: true.
     3. Replace each data-ad-slot="0000000000" placeholder
        in the HTML pages with your real ad unit IDs.

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
