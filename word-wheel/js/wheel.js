/* ============================================================
   Word wheel generator (Boggle-style).
   Pure logic, no DOM. Picks 9 letters (one mandatory center) and
   lists every bank word of 3+ letters that can be built from them
   and must use the center letter.

   API:
     WheelGen.makeWheel(category, difficulty)
       -> {
            letters: [9 letters], center (index), centerLetter,
            words:   [{ word }] sorted longest-first,
            title, difficulty, category
          }
     WheelGen.makeBatch(count, category, difficulty)
   ============================================================ */

(function (global) {
  "use strict";

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // frequency map of letters in a word
  function counts(w) {
    var m = {};
    for (var i = 0; i < w.length; i++) m[w[i]] = (m[w[i]] || 0) + 1;
    return m;
  }

  // can the word be built from the 9 letters (no letter used more
  // often than it appears in the wheel)?
  function buildable(w, letters) {
    var avail = counts(letters.join(""));
    var need = counts(w);
    for (var ch in need) {
      if ((avail[ch] || 0) < need[ch]) return false;
    }
    return true;
  }

  // Try candidate center letters; for each, greedily pick the 8 other
  // letters that appear in the most candidate words, and count how many
  // words result. Return the wheel with the most words.
  function bestWheel(category) {
    var data = (global.WORD_DATA && global.WORD_DATA[category]) || {};
    var bank = Object.keys(data);

    var candidateLetters = {};
    bank.forEach(function (w) {
      for (var i = 0; i < w.length; i++) candidateLetters[w[i]] = true;
    });
    var letterList = Object.keys(candidateLetters);

    var best = null;
    var tries = Math.min(40, letterList.length);
    for (var t = 0; t < tries; t++) {
      var centerLetter = letterList[Math.floor(Math.random() * letterList.length)];

      // words that use the center letter and can still be built from 9
      // unique letters (so word length 3..9, all letters distinct)
      var candidates = bank.filter(function (w) {
        return w.length >= 3 && w.length <= 9 &&
          w.indexOf(centerLetter) !== -1 &&
          new Set(w.split("")).size === w.length;
      });

      // frequency of every other letter among the candidates
      var freq = {};
      candidates.forEach(function (w) {
        for (var i = 0; i < w.length; i++) {
          var ch = w[i];
          if (ch === centerLetter) continue;
          freq[ch] = (freq[ch] || 0) + 1;
        }
      });
      var ranked = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a]; });
      var letters = [centerLetter].concat(ranked.slice(0, 8));
      if (letters.length < 9) {
        for (var k = 0; k < 26 && letters.length < 9; k++) {
          var ch2 = String.fromCharCode(65 + k);
          if (letters.indexOf(ch2) === -1) letters.push(ch2);
        }
      }
      letters = letters.slice(0, 9);

      var words = candidates.filter(function (w) {
        return buildable(w, letters);
      });

      if (!best || words.length > best.words.length) {
        best = {
          letters: letters,
          centerLetter: centerLetter,
          words: words
        };
      }
      if (best.words.length >= 12) break;
    }
    return best;
  }

  function makeWheel(category, difficulty) {
    var data = (global.WORD_DATA && global.WORD_DATA[category]) || {};
    var bank = Object.keys(data);

    var b = bestWheel(category);
    var letters = (b && b.letters) || [];
    if (!letters.length) {
      letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
    }
    letters = shuffle(letters);

    var center = letters.indexOf(b.centerLetter);
    if (center === -1) center = Math.floor(Math.random() * 9);
    var centerLetter = letters[center];

    var words = bank.filter(function (w) {
      return w.length >= 3 && w.indexOf(centerLetter) !== -1 && buildable(w, letters);
    });
    words.sort(function (a, b) { return b.length - a.length || (a < b ? -1 : 1); });

    var title = "Word Wheel — " +
      ((global.CATEGORY_LABELS && global.CATEGORY_LABELS[category]) || category);

    return {
      letters: letters,
      center: center,
      centerLetter: centerLetter,
      words: words.map(function (w) { return { word: w }; }),
      title: title.trim(),
      difficulty: difficulty,
      category: category
    };
  }

  function signature(w) {
    return w.letters.join("");
  }

  function makeBatch(count, category, difficulty) {
    var out = [];
    var seen = {};
    var maxAttempts = 60;
    for (var i = 0; i < count; i++) {
      var w = null;
      for (var a = 0; a < maxAttempts; a++) {
        var cand = makeWheel(category, difficulty);
        var sig = signature(cand);
        if (!seen[sig]) {
          w = cand;
          seen[sig] = true;
          break;
        }
      }
      if (!w) w = makeWheel(category, difficulty);
      out.push(w);
    }
    return out;
  }

  global.WheelGen = {
    makeWheel: makeWheel,
    makeBatch: makeBatch
  };
})(typeof window !== "undefined" ? window : globalThis);
