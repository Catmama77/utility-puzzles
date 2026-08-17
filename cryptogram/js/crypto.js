/* Cryptogram generator.
   A themed sentence is hidden with a random letter-substitution cipher
   (every plaintext letter maps to a different cipher letter — a
   "derangement", so no letter stays itself). Difficulty controls the
   sentence length and how many letters are revealed up front.

   Exposes window.CryptGen = { DIFFICULTY, makePuzzle, makeBatch }.
   All sentences are original (copyright-clean), no apostrophes or
   digits so the ciphertext stays tidy. */

(function (global) {
  "use strict";

  var SENTENCES = {
    animals: [
      "The old cat slept on the warm windowsill",
      "The clever fox hid behind the wooden fence",
      "A gentle rabbit nibbled the fresh carrot",
      "The playful otter slid into the water",
      "Birds build their nests in the tall oak",
      "The curious bear wandered down to the quiet river",
      "Every morning the horse trots around the big pasture",
      "A small dog chased the red ball across the green lawn"
    ],
    foods: [
      "A bowl of hot soup is perfect tonight",
      "Sweet strawberries taste best with cream",
      "Grandma bakes a delicious apple pie",
      "Fresh bread smells wonderful from the oven",
      "We shared a large pizza with mushrooms cheese and peppers",
      "The chef chopped onions and garlic for the tomato sauce",
      "Dinner was simple rice beans and a fresh green salad",
      "The baker makes crusty rolls every single morning"
    ],
    sports: [
      "She runs five miles every morning",
      "The team practiced before the big game",
      "The crowd cheered as the runner finished",
      "The goalkeeper made a save in the final minute",
      "The swimmers race across the pool to the finish",
      "Every player must stretch before training",
      "He swung the bat and sent the ball over the fence",
      "A good coach builds confidence and teaches discipline"
    ],
    countries: [
      "The capital city is famous for its parks",
      "The local market sells fresh fruit and crafts",
      "We learned about the country on the tour",
      "The train crossed the border into a new land",
      "Tourists visit the ancient castle on the hill",
      "A long flight over the ocean brings you somewhere new",
      "People celebrate the festival with music and dancing",
      "The desert stretches for miles under the sun"
    ],
    jobs: [
      "The doctor checks the patient each morning",
      "A good teacher explains ideas with patience",
      "The farmer wakes before sunrise each day",
      "The pilot welcomed everyone aboard the flight",
      "The firefighter rushed into the building to help",
      "The librarian helps readers find the perfect book",
      "A skilled carpenter builds strong furniture",
      "The nurse takes care of people with kindness"
    ],
    nature: [
      "The river winds through the green valley",
      "The morning dew sparkles after the rain",
      "The waterfall crashes into a blue pool",
      "The full moon shone over the silent lake",
      "Wildflowers bloom along the path in spring",
      "Tall pine trees cover the mountain slopes",
      "A strong wind blew the leaves across the road",
      "Thunder rolled across the sky as the storm came"
    ]
  };

  var DIFFICULTY = {
    easy:   { label: "Easy",   maxWords: 9,  reveals: 5 },
    medium: { label: "Medium", maxWords: 12, reveals: 3 },
    hard:   { label: "Hard",   maxWords: 99, reveals: 1 }
  };

  var LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  /* Random substitution with no letter mapped to itself (derangement). */
  function makeCipher() {
    var c;
    do {
      c = shuffle(LETTERS.slice());
    } while (c.some(function (v, i) { return v === LETTERS[i]; }));
    return c;
  }

  function wordCount(s) {
    return s.split(" ").length;
  }

  function encodeToken(token, cipher) {
    var out = "";
    for (var i = 0; i < token.length; i++) {
      var ch = token[i];
      if (ch >= "A" && ch <= "Z") out += cipher[ch.charCodeAt(0) - 65];
      else out += ch;
    }
    return out;
  }

  /* Pick the `n` most frequent letters that appear in the plaintext. */
  function pickReveals(plain, n) {
    var freq = {};
    for (var i = 0; i < plain.length; i++) {
      var ch = plain[i];
      if (ch >= "A" && ch <= "Z") freq[ch] = (freq[ch] || 0) + 1;
    }
    return Object.keys(freq)
      .sort(function (a, b) { return (freq[b] - freq[a]) || (a < b ? -1 : 1); })
      .slice(0, n);
  }

  function makePuzzle(category, difficulty) {
    var D = DIFFICULTY[difficulty] || DIFFICULTY.medium;
    var pool = (SENTENCES[category] || SENTENCES.animals).filter(function (s) {
      return wordCount(s) <= D.maxWords;
    });
    var plain = pool[Math.floor(Math.random() * pool.length)].toUpperCase();
    var cipher = makeCipher();
    var words = plain.split(" ").map(function (w) {
      return { plain: w, cipher: encodeToken(w, cipher) };
    });

    var mapping = {};
    var mappingInverse = {};
    for (var i = 0; i < 26; i++) {
      mapping[LETTERS[i]] = cipher[i];         // plaintext -> cipher
      mappingInverse[cipher[i]] = LETTERS[i];  // cipher -> plaintext
    }

    var reveals = {};
    pickReveals(plain, D.reveals).forEach(function (pl) {
      reveals[cipher[pl.charCodeAt(0) - 65]] = pl; // cipher letter -> plaintext
    });

    var label = (global.CATEGORY_LABELS && global.CATEGORY_LABELS[category]) || category;
    return {
      category: category,
      difficulty: difficulty,
      title: "Cryptogram — " + label,
      plain: plain,
      words: words,
      mapping: mapping,         // plaintext -> cipher
      mappingInverse: mappingInverse, // cipher -> plaintext
      reveals: reveals,         // cipher -> plaintext (subset)
      cipherLength: plain.replace(/[^A-Z]/g, "").length
    };
  }

  function signature(p) {
    return p.plain + "|" + p.words.map(function (w) { return w.cipher; }).join(" ");
  }

  function makeBatch(count, category, difficulty) {
    var n = count || 1;
    var out = [];
    var seen = {};
    var attempts = 0;
    while (out.length < n && attempts < 200) {
      attempts++;
      var cand = makePuzzle(category, difficulty);
      var sig = signature(cand);
      if (!seen[sig]) {
        seen[sig] = true;
        out.push(cand);
      }
    }
    while (out.length < n) out.push(makePuzzle(category, difficulty));
    return out;
  }

  global.CryptGen = {
    DIFFICULTY: DIFFICULTY,
    makePuzzle: makePuzzle,
    makeBatch: makeBatch
  };
})(typeof window !== "undefined" ? window : globalThis);
