/* ============================================================
   Word ladder generator.
   Pure logic, no DOM. Builds a chain of words where every step
   differs from the previous by exactly one letter (classic word
   ladders, e.g. CAT -> RAT -> RAM). Draws from the whole merged
   word bank so it has enough one-letter-apart pairs to work.

   API:
     LadderGen.DIFFICULTY     — { easy, medium, hard } (target steps)
     LadderGen.makeLadder(difficulty)
       -> {
            start, end,
            rungs: [{ word, position }],   // includes start & end
            length (number of steps),
            title, difficulty
          }
     LadderGen.makeBatch(count, difficulty)
   ============================================================ */

(function (global) {
  "use strict";

  var DIFFICULTY = {
    easy:   { label: "Easy",   minSteps: 2 },
    medium: { label: "Medium", minSteps: 3 },
    hard:   { label: "Hard",   minSteps: 4 }
  };

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function differsByOne(a, b) {
    if (a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) diff++;
      if (diff > 1) return false;
    }
    return diff === 1;
  }

  // Build the merged word bank grouped by length.
  function mergedBank() {
    var data = (global.WORD_DATA && global.WORD_DATA) || {};
    var seen = {};
    var words = [];
    Object.keys(data).forEach(function (cat) {
      Object.keys(data[cat]).forEach(function (w) {
        if (!seen[w]) {
          seen[w] = true;
          words.push(w);
        }
      });
    });
    var byLen = {};
    words.forEach(function (w) {
      (byLen[w.length] = byLen[w.length] || []).push(w);
    });
    return byLen;
  }

  // BFS: distances and paths from `start` within `group`.
  function bfs(group, start) {
    var prev = {};
    var dist = {};
    dist[start] = 0;
    var queue = [start];
    while (queue.length) {
      var cur = queue.shift();
      for (var i = 0; i < group.length; i++) {
        var w = group[i];
        if (dist[w] !== undefined) continue;
        if (!differsByOne(cur, w)) continue;
        dist[w] = dist[cur] + 1;
        prev[w] = cur;
        queue.push(w);
      }
    }
    return { prev: prev, dist: dist };
  }

  function makeLadder(difficulty) {
    var D = DIFFICULTY[difficulty] || DIFFICULTY.medium;
    var byLen = mergedBank();

    // Prefer the shortest word length with a decent group size —
    // 3-letter words connect far better than long ones.
    var lengths = [3, 4, 5].filter(function (l) {
      return byLen[l] && byLen[l].length >= 6;
    });
    var group = byLen[lengths[0]] || byLen[3] || [];

    var ladder = null;
    var attempts = 0;
    while (!ladder && attempts < 300) {
      attempts++;
      var start = group[Math.floor(Math.random() * group.length)];
      var res = bfs(group, start);
      var reachable = Object.keys(res.dist).filter(function (w) {
        return w !== start && res.dist[w] >= D.minSteps;
      });
      if (!reachable.length) continue;
      var end = reachable[Math.floor(Math.random() * reachable.length)];

      var path = [end];
      var node = end;
      while (node !== start) {
        node = res.prev[node];
        path.unshift(node);
      }
      ladder = { start: start, end: end, path: path };
    }

    if (!ladder) {
      return { start: "", end: "", rungs: [], length: 0, title: "" };
    }

    var rungs = ladder.path.map(function (w, i) {
      return { word: w, position: i };
    });

    var title = "Word Ladder — " + D.label;

    return {
      start: ladder.start,
      end: ladder.end,
      rungs: rungs,
      length: ladder.path.length - 1,
      title: title,
      difficulty: difficulty
    };
  }

  function signature(l) {
    return l.start + ">" + l.end;
  }

  function makeBatch(count, difficulty) {
    var out = [];
    var seen = {};
    var maxAttempts = 60;
    for (var i = 0; i < count; i++) {
      var l = null;
      for (var a = 0; a < maxAttempts; a++) {
        var cand = makeLadder(difficulty);
        if (!cand.rungs.length) continue;
        var sig = signature(cand);
        if (!seen[sig]) {
          l = cand;
          seen[sig] = true;
          break;
        }
      }
      if (!l) {
        l = makeLadder(difficulty);
        if (!l.rungs.length) l = { start: "", end: "", rungs: [], length: 0, title: "" };
      }
      out.push(l);
    }
    return out;
  }

  global.LadderGen = {
    DIFFICULTY: DIFFICULTY,
    makeLadder: makeLadder,
    makeBatch: makeBatch
  };
})(typeof window !== "undefined" ? window : globalThis);
