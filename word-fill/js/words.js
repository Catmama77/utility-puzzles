/* ============================================================
   Word bank for the Word Fill-In puzzle generator.
   Derived from the shared WORD_DATA (js/word-data.js).
   ============================================================ */

(function (global) {
  "use strict";

  var WORD_BANK = {};
  Object.keys(global.WORD_DATA || {}).forEach(function (cat) {
    WORD_BANK[cat] = Object.keys(global.WORD_DATA[cat]);
  });

  global.WORD_BANK = WORD_BANK;
})(typeof window !== "undefined" ? window : globalThis);
