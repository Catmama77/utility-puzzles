/* ============================================================
   Number search generator.
   Pure logic, no DOM. Like a word search, but the hidden items
   are numbers in a grid of digits. Difficulty controls the size
   of the numbers and which directions they can run.

   API:
     NSearchGen.SIZES          — { "8x8", "10x10", "12x12" }
     NSearchGen.DIFFICULTY     — { easy, medium, hard }
     NSearchGen.makeSearch(sizeKey, difficultyKey)
       -> {
            grid:  square array of digit strings,
            nums:  [{ value, r, c, dir }],
            size, title, difficulty
          }
     NSearchGen.makeBatch(count, sizeKey, difficultyKey)
   ============================================================ */

(function (global) {
  "use strict";

  var SIZES = {
    "8x8":   { size: 8,  label: "8 × 8",  nums: 8 },
    "10x10": { size: 10, label: "10 × 10", nums: 10 },
    "12x12": { size: 12, label: "12 × 12", nums: 12 }
  };

  var DIRS = {
    "e":  [0, 1],  "s":  [1, 0],
    "w":  [0, -1], "n":  [-1, 0],
    "se": [1, 1],  "sw": [1, -1],
    "ne": [-1, 1], "nw": [-1, -1]
  };

  var DIFFICULTY = {
    easy:   { label: "Easy",   digits: [2, 2], dirs: ["e", "s"] },
    medium: { label: "Medium", digits: [2, 3], dirs: ["e", "s", "w", "n"] },
    hard:   { label: "Hard",   digits: [3, 4], dirs: ["e", "s", "w", "n", "se", "sw", "ne", "nw"] }
  };

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function randDigit() {
    return String(Math.floor(Math.random() * 10));
  }

  function randomNumber(len) {
    // no leading zero
    var s = String(1 + Math.floor(Math.random() * 9));
    for (var i = 1; i < len; i++) s += randDigit();
    return s;
  }

  function makeSearch(sizeKey, diffKey) {
    var S = SIZES[sizeKey] || SIZES["10x10"];
    var D = DIFFICULTY[diffKey] || DIFFICULTY.medium;
    var size = S.size;
    var target = S.nums;

    var grid = [];
    for (var r = 0; r < size; r++) grid.push(new Array(size).fill(""));

    var placed = [];
    var seenNums = {};
    var attempts = 0;
    var maxAttempts = 2000;

    while (placed.length < target && attempts < maxAttempts) {
      attempts++;
      var len = D.digits[0] + Math.floor(Math.random() * (D.digits[1] - D.digits[0] + 1));
      var value = randomNumber(len);
      if (seenNums[value]) continue;
      var dirKey = D.dirs[Math.floor(Math.random() * D.dirs.length)];
      var d = DIRS[dirKey];

      var rMin = d[0] === 1 ? 0 : (d[0] === -1 ? len - 1 : 0);
      var rMax = d[0] === 1 ? size - len : size - 1;
      var cMin = d[1] === 1 ? 0 : (d[1] === -1 ? len - 1 : 0);
      var cMax = d[1] === 1 ? size - len : size - 1;
      if (rMin > rMax || cMin > cMax) continue;

      var sr = rMin + Math.floor(Math.random() * (rMax - rMin + 1));
      var sc = cMin + Math.floor(Math.random() * (cMax - cMin + 1));

      var ok = true;
      for (var i = 0; i < len; i++) {
        var cr = sr + d[0] * i;
        var cc = sc + d[1] * i;
        var existing = grid[cr][cc];
        if (existing !== "" && existing !== value[i]) { ok = false; break; }
      }
      if (!ok) continue;

      for (var j = 0; j < len; j++) {
        grid[sr + d[0] * j][sc + d[1] * j] = value[j];
      }
      seenNums[value] = true;
      placed.push({ value: value, r: sr, c: sc, dir: dirKey });
    }

    for (var rr = 0; rr < size; rr++) {
      for (var cc2 = 0; cc2 < size; cc2++) {
        if (grid[rr][cc2] === "") grid[rr][cc2] = randDigit();
      }
    }

    var title = "Number Search — " + S.label + " · " + D.label;

    return {
      grid: grid,
      nums: placed,
      size: size,
      title: title,
      difficulty: diffKey,
      sizeKey: sizeKey
    };
  }

  function signature(p) {
    var parts = p.nums.map(function (n) {
      return n.value + "@" + n.r + "," + n.c + "," + n.dir;
    });
    parts.sort();
    return parts.join("|");
  }

  function makeBatch(count, sizeKey, diffKey) {
    var out = [];
    var seen = {};
    var maxAttempts = 60;
    for (var i = 0; i < count; i++) {
      var p = null;
      for (var a = 0; a < maxAttempts; a++) {
        var cand = makeSearch(sizeKey, diffKey);
        var sig = signature(cand);
        if (!seen[sig]) {
          p = cand;
          seen[sig] = true;
          break;
        }
      }
      if (!p) p = makeSearch(sizeKey, diffKey);
      out.push(p);
    }
    return out;
  }

  global.NSearchGen = {
    SIZES: SIZES,
    DIFFICULTY: DIFFICULTY,
    makeSearch: makeSearch,
    makeBatch: makeBatch
  };
})(typeof window !== "undefined" ? window : globalThis);
