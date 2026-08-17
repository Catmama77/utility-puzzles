/* ============================================================
   Word scramble (unscramble) generator.
   Pure logic, no DOM — works in the browser and in Node (for
   tests). Picks themed words and scrambles their letters; the
   optional clue comes from WORD_DATA, so a worksheet can double
   as a vocabulary exercise.

   API:
     ScrambleGen.DIFFICULTY         — { easy, medium, hard }
     ScrambleGen.makeScramble(category, difficulty, count, withClues)
       -> {
            words: [{ word, scrambled, clue|null, number }],
            title, difficulty, category, withClues
          }
     ScrambleGen.makeBatch(count, category, difficulty, withClues)
       -> array of distinct worksheets
   ============================================================ */

(function (global) {
  "use strict";

  var DIFFICULTY = {
    easy:   { label: "Easy",   minLen: 3, maxLen: 5, words: 10 },
    medium: { label: "Medium", minLen: 4, maxLen: 7, words: 12 },
    hard:   { label: "Hard",   minLen: 5, maxLen: 9, words: 14 }
  };

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // Scramble a word so the result is NOT the original word and (when
  // possible) not another real word from the same category — a plain
  // shuffle can produce a valid different word, which would confuse
  // solvers. Bounded attempts, then accept the last shuffle.
  function scramble(word, bank) {
    var letters = word.split("");
    var result = null;
    for (var attempt = 0; attempt < 60; attempt++) {
      shuffle(letters);
      var cand = letters.join("");
      if (cand === word) continue;                       // unchanged — reshuffle
      if (bank && bank.indexOf(cand) !== -1) continue;   // is a real word — reshuffle
      result = cand;
      break;
    }
    if (result === null) {
      shuffle(letters);
      result = letters.join("");
      if (result === word) result = word.slice(1) + word[0];
    }
    return result;
  }

  function makeScramble(category, difficulty, count, withClues) {
    var D = DIFFICULTY[difficulty] || DIFFICULTY.easy;
    var data = (global.WORD_DATA && global.WORD_DATA[category]) || {};
    var n = count || D.words;

    // pool of words in the difficulty's length range
    var pool = Object.keys(data).filter(function (w) {
      return w.length >= D.minLen && w.length <= D.maxLen;
    });
    pool = shuffle(pool.slice());
    if (pool.length > n) pool = pool.slice(0, n);

    var bank = Object.keys(data); // avoid scrambling into another real word

    var words = pool.map(function (word, i) {
      return {
        word: word,
        scrambled: scramble(word, bank),
        clue: withClues ? (data[word] || null) : null,
        number: i + 1
      };
    });

    var title = "Word Scramble — " +
      ((global.CATEGORY_LABELS && global.CATEGORY_LABELS[category]) || category) +
      " · " + D.label + (withClues ? " · with clues" : "");

    return {
      words: words,
      title: title,
      difficulty: difficulty,
      category: category,
      withClues: withClues
    };
  }

  /* Identity of a worksheet: the set of answer words. */
  function signature(p) {
    return p.words.map(function (w) { return w.word; }).sort().join("|");
  }

  /* Generate `count` distinct worksheets for one sheet/batch. */
  function makeBatch(count, category, difficulty, withClues) {
    var out = [];
    var seen = {};
    var maxAttempts = 60;
    for (var i = 0; i < count; i++) {
      var p = null;
      for (var a = 0; a < maxAttempts; a++) {
        var cand = makeScramble(category, difficulty, 0, withClues);
        var sig = signature(cand);
        if (!seen[sig]) {
          p = cand;
          seen[sig] = true;
          break;
        }
      }
      if (!p) p = makeScramble(category, difficulty, 0, withClues);
      out.push(p);
    }
    return out;
  }

  global.ScrambleGen = {
    DIFFICULTY: DIFFICULTY,
    makeScramble: makeScramble,
    makeBatch: makeBatch
  };
})(typeof window !== "undefined" ? window : globalThis);
