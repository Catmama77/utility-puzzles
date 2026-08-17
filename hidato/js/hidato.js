/* ============================================================
   Hidato puzzle generator.
   Pure logic, no DOM — works in the browser and in Node (for
   tests). Hidato is a number-path puzzle: fill the grid with the
   consecutive numbers 1..N so that each number sits next to the
   previous one (including diagonally) and every cell is used
   exactly once. Some numbers are given as clues; the start (1)
   and end (N) are always shown. Every published puzzle has
   exactly one solution (verified with a counting solver).

   API:
     HidatoGen.DIFFICULTY  — { easy, medium, hard } options
     HidatoGen.makePuzzle(difficultyKey) -> puzzle
     HidatoGen.makeBatch(count, difficultyKey) -> [puzzle...]
     puzzle = {
       rows, cols, n:   grid dimensions and cell count,
       num:   rows*cols flat array of solution numbers,
       given: rows*cols flat array of booleans,
       blanks: number of blank cells,
       difficulty, title
     }
   ============================================================ */

(function (global) {
  "use strict";

  var DIFFICULTY = {
    easy:   { label: "Easy",   rows: 7,  cols: 7,  keep: 24 },
    medium: { label: "Medium", rows: 9,  cols: 9,  keep: 30 },
    hard:   { label: "Hard",   rows: 11, cols: 11, keep: 34 }
  };

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function range(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(i);
    return out;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /* 8-directional adjacency (including diagonals). */
  function buildAdj(rows, cols) {
    var adj = [];
    var dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var list = [];
        for (var i = 0; i < dirs.length; i++) {
          var nr = r + dirs[i][0], nc = c + dirs[i][1];
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            list.push(nr * cols + nc);
          }
        }
        adj.push(list);
      }
    }
    return adj;
  }

  /* ---------- Hamiltonian path ---------- */

  /* Build a random path that visits every cell exactly once with
     king moves. Uses Warnsdorff's rule (always step to the
     unvisited neighbour with the fewest onward moves, ties broken
     at random) starting from a random corner — the same trick that
     makes knight's tours fast. Restarts on dead ends. Returns
     path[0..N-1] where path[k-1] is the cell of number k, or null. */
  function makePath(rows, cols) {
    var total = rows * cols;
    var adj = buildAdj(rows, cols);
    var corners = [0, cols - 1, (rows - 1) * cols, rows * cols - 1];
    for (var attempt = 0; attempt < 300; attempt++) {
      var path = new Array(total);
      var used = new Array(total).fill(false);
      var start = pick(corners);
      path[0] = start;
      used[start] = true;
      var complete = true;
      for (var k = 1; k < total; k++) {
        var cands = adj[path[k - 1]].filter(function (c) { return !used[c]; });
        if (!cands.length) { complete = false; break; }
        var best = [];
        var bestCount = Infinity;
        for (var i = 0; i < cands.length; i++) {
          var cnt = 0;
          var nbrs = adj[cands[i]];
          for (var j = 0; j < nbrs.length; j++) {
            if (!used[nbrs[j]]) cnt++;
          }
          if (cnt < bestCount) { bestCount = cnt; best = [cands[i]]; }
          else if (cnt === bestCount) best.push(cands[i]);
        }
        path[k] = pick(best);
        used[path[k]] = true;
      }
      if (complete) return path;
    }
    return null;
  }

  /* ---------- counting solver ---------- */

  /* Count solutions (up to `limit`) of the number path. `num` holds
     the full solution, `given[i]` marks the cells whose numbers are
     shown. Numbers are placed 1..N in order; number k must sit in a
     cell adjacent to number k-1, never in an occupied or given cell.
     Returns -1 if the node budget is exceeded. */
  function countSolutions(num, given, adj, N, limit, nodeBudget) {
    var MAX_NODES = nodeBudget || 400000;
    var count = 0;
    var nodes = 0;
    var occ = new Array(num.length).fill(false);
    var cellOf = new Array(N + 1).fill(-1);
    for (var i = 0; i < num.length; i++) {
      if (given[i]) { occ[i] = true; cellOf[num[i]] = i; }
    }

    function dfs(k, prevCell) {
      if (count >= limit || nodes > MAX_NODES) return;
      if (k > N) { count++; return; }
      nodes++;
      if (cellOf[k] !== -1) {
        var c = cellOf[k];
        if (k === 1 || adj[prevCell].indexOf(c) !== -1) dfs(k + 1, c);
        return;
      }
      var cands = k === 1 ? range(num.length) : adj[prevCell];
      // try fewest-onward-moves candidates first: finds a second
      // solution quickly when one exists (the expensive non-unique
      // case), mirroring Warnsdorff in makePath
      var best = [];
      var bestCnt = Infinity;
      for (var i = 0; i < cands.length; i++) {
        if (occ[cands[i]]) continue;
        // future-given prune: k+1's cell must touch this one
        if (k + 1 <= N && cellOf[k + 1] !== -1 && adj[cands[i]].indexOf(cellOf[k + 1]) === -1) continue;
        var onward = 0;
        var nbrs = adj[cands[i]];
        for (var j = 0; j < nbrs.length; j++) if (!occ[nbrs[j]]) onward++;
        if (onward < bestCnt) { bestCnt = onward; best = [cands[i]]; }
        else if (onward === bestCnt) best.push(cands[i]);
      }
      for (var b = 0; b < best.length; b++) {
        var c2 = best[b];
        occ[c2] = true;
        dfs(k + 1, c2);
        occ[c2] = false;
        if (count >= limit || nodes > MAX_NODES) return;
      }
    }

    dfs(1, -1);
    if (nodes > MAX_NODES) return -1;
    return count;
  }

  /* ---------- puzzle assembly ---------- */

  function finalize(num, given, diffKey, d) {
    var blanks = 0;
    for (var i = 0; i < given.length; i++) if (!given[i]) blanks++;
    return {
      rows: d.rows,
      cols: d.cols,
      n: d.rows * d.cols,
      num: num.slice(),
      given: given.slice(),
      blanks: blanks,
      difficulty: diffKey,
      title: "Hidato — " + d.label + " level"
    };
  }

  /* Blank cells (random order, keeping 1 and N) while the puzzle
     stays unique; stops at `keep` givens or when nothing more can
     be removed. A budget-bailout keeps the cell as a given. */
  function blankCells(num, adj, N, keep) {
    var given = new Array(num.length).fill(true);
    var givenCount = num.length;
    var order = shuffle(range(num.length));
    for (var i = 0; i < order.length && givenCount > keep; i++) {
      var cell = order[i];
      if (num[cell] === 1 || num[cell] === N) continue; // always show start & end
      given[cell] = false;
      var res = countSolutions(num, given, adj, N, 2, 100000);
      if (res === 1) {
        givenCount--;
      } else {
        given[cell] = true; // not blankable (or budget hit)
      }
    }
    return given;
  }

  function makePuzzle(diffKey) {
    var d = DIFFICULTY[diffKey] || DIFFICULTY.medium;
    for (var attempt = 0; attempt < 100; attempt++) {
      var path = makePath(d.rows, d.cols);
      if (!path) continue;
      var num = new Array(d.rows * d.cols).fill(0);
      for (var k = 1; k <= path.length; k++) num[path[k - 1]] = k;
      var adj = buildAdj(d.rows, d.cols);
      var given = blankCells(num, adj, path.length, d.keep);
      // final belt-and-suspenders uniqueness check with a bigger budget
      if (countSolutions(num, given, adj, path.length, 2, 400000) !== 1) continue;
      return finalize(num, given, diffKey, d);
    }
    return null;
  }

  function signature(p) {
    return p.num.join("") + "|" + p.given.map(function (g) { return g ? 1 : 0; }).join("");
  }

  function makeBatch(count, diffKey) {
    var out = [];
    var seen = {};
    var guard = 0;
    while (out.length < count && guard < 200) {
      guard++;
      var p = makePuzzle(diffKey);
      if (!p) continue;
      var sig = signature(p);
      if (seen[sig]) continue;
      seen[sig] = true;
      out.push(p);
    }
    return out;
  }

  global.HidatoGen = {
    DIFFICULTY: DIFFICULTY,
    makePuzzle: makePuzzle,
    makeBatch: makeBatch,
    countSolutions: countSolutions, // exposed for tests
    _buildAdj: buildAdj,            // exposed for tests
    _makePath: makePath,            // exposed for tests
    _blankCells: blankCells         // exposed for tests
  };
})(typeof window !== "undefined" ? window : globalThis);
