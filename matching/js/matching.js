/* ============================================================
   Matching / flashcards generator.
   Pure logic, no DOM. Picks word + clue pairs from WORD_DATA and
   offers two worksheet styles:
     - "match":   two columns — words (numbered) and clues
                  (lettered, shuffled) — draw lines to match
     - "cards":   a grid of flashcards, each showing word + clue

   API:
     MatchGen.DIFFICULTY   — { easy, medium, hard } (word count)
     MatchGen.makeSet(category, mode, difficulty)
       -> {
            mode: "match" | "cards",
            words:  [{ word, clue, number }],        // solution order
            clues:  [{ clue, letter, number }],      // shuffled display order
            title, difficulty, category
          }
     MatchGen.makeBatch(count, category, mode, difficulty)
   ============================================================ */

(function (global) {
  "use strict";

  var DIFFICULTY = {
    easy:   { label: "Easy",   count: 8 },
    medium: { label: "Medium", count: 12 },
    hard:   { label: "Hard",   count: 16 }
  };

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function makeSet(category, mode, difficulty) {
    var D = DIFFICULTY[difficulty] || DIFFICULTY.medium;
    var data = (global.WORD_DATA && global.WORD_DATA[category]) || {};
    var pool = Object.keys(data).filter(function (w) {
      return w.length >= 3;
    });
    pool = shuffle(pool.slice());
    var n = Math.min(D.count, pool.length);
    pool = pool.slice(0, n);

    // solution order: words numbered 1..n (kept in picked order)
    var words = pool.map(function (w, i) {
      return { word: w, clue: data[w] || "?", number: i + 1 };
    });

    // clue display order: shuffled, lettered A..Z
    var clueItems = shuffle(words.slice()).map(function (w, i) {
      return {
        clue: w.clue,
        letter: String.fromCharCode(65 + i),
        number: w.number
      };
    });

    var modeLabel = mode === "cards" ? "Flashcards" : "Matching Worksheet";
    var title = modeLabel + " — " +
      ((global.CATEGORY_LABELS && global.CATEGORY_LABELS[category]) || category) +
      " · " + D.label;

    return {
      mode: mode === "cards" ? "cards" : "match",
      words: words,
      clues: clueItems,
      title: title,
      difficulty: difficulty,
      category: category
    };
  }

  function signature(s) {
    return s.words.map(function (w) { return w.word; }).sort().join("|");
  }

  function makeBatch(count, category, mode, difficulty) {
    var out = [];
    var seen = {};
    var maxAttempts = 60;
    for (var i = 0; i < count; i++) {
      var s = null;
      for (var a = 0; a < maxAttempts; a++) {
        var cand = makeSet(category, mode, difficulty);
        var sig = signature(cand);
        if (!seen[sig]) {
          s = cand;
          seen[sig] = true;
          break;
        }
      }
      if (!s) s = makeSet(category, mode, difficulty);
      out.push(s);
    }
    return out;
  }

  global.MatchGen = {
    DIFFICULTY: DIFFICULTY,
    makeSet: makeSet,
    makeBatch: makeBatch
  };
})(typeof window !== "undefined" ? window : globalThis);
