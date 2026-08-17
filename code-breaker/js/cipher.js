/* ============================================================
   Code breaker (secret message) generator.
   Pure logic, no DOM. Picks themed words, applies a Caesar shift
   to the letters, and shows the encoded words. The solver
   decodes them — with an optional clue per word from WORD_DATA.

   API:
     CipherGen.DIFFICULTY     — { easy, medium, hard }
     CipherGen.makeCode(category, difficulty, count, withClues)
       -> {
            words: [{ word, encoded, clue|null, number }],
            shift,               // the Caesar key used
            title, difficulty, category, withClues
          }
     CipherGen.makeBatch(count, category, difficulty, withClues)
   ============================================================ */

(function (global) {
  "use strict";

  var DIFFICULTY = {
    easy:   { label: "Easy",   shift: 3,  words: 8,  minLen: 3, maxLen: 5 },
    medium: { label: "Medium", shift: 5,  words: 10, minLen: 4, maxLen: 6 },
    hard:   { label: "Hard",   shift: 7,  words: 12, minLen: 4, maxLen: 7 }
  };

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function caesar(word, shift) {
    var out = "";
    for (var i = 0; i < word.length; i++) {
      var code = ((word.charCodeAt(i) - 65 + shift) % 26 + 26) % 26;
      out += String.fromCharCode(65 + code);
    }
    return out;
  }

  function makeCode(category, difficulty, count, withClues) {
    var D = DIFFICULTY[difficulty] || DIFFICULTY.medium;
    var data = (global.WORD_DATA && global.WORD_DATA[category]) || {};
    var n = count || D.words;

    var pool = Object.keys(data).filter(function (w) {
      return w.length >= D.minLen && w.length <= D.maxLen;
    });
    pool = shuffle(pool.slice());
    if (pool.length > n) pool = pool.slice(0, n);

    var words = pool.map(function (word, i) {
      return {
        word: word,
        encoded: caesar(word, D.shift),
        clue: withClues ? (data[word] || null) : null,
        number: i + 1
      };
    });

    var title = "Code Breaker — " +
      ((global.CATEGORY_LABELS && global.CATEGORY_LABELS[category]) || category) +
      " · " + D.label + (withClues ? " · with clues" : "");

    return {
      words: words,
      shift: D.shift,
      title: title,
      difficulty: difficulty,
      category: category,
      withClues: withClues
    };
  }

  function signature(c) {
    return c.words.map(function (w) { return w.word; }).sort().join("|");
  }

  function makeBatch(count, category, difficulty, withClues) {
    var out = [];
    var seen = {};
    var maxAttempts = 60;
    for (var i = 0; i < count; i++) {
      var c = null;
      for (var a = 0; a < maxAttempts; a++) {
        var cand = makeCode(category, difficulty, 0, withClues);
        var sig = signature(cand);
        if (!seen[sig]) {
          c = cand;
          seen[sig] = true;
          break;
        }
      }
      if (!c) c = makeCode(category, difficulty, 0, withClues);
      out.push(c);
    }
    return out;
  }

  global.CipherGen = {
    DIFFICULTY: DIFFICULTY,
    makeCode: makeCode,
    makeBatch: makeBatch
  };
})(typeof window !== "undefined" ? window : globalThis);
