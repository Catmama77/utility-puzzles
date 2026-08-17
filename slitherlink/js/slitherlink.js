/* ============================================================
   Slitherlink puzzle generator.
   Pure logic, no DOM — works in the browser and in Node (for
   tests). Draw a single closed loop along the grid lines so that
   every numbered cell has exactly that many of its four sides
   used by the loop; unnumbered cells impose no constraint. The
   loop never crosses or branches.

   Generation: a random spanning tree of the vertex lattice, the
   fundamental cycle formed by one non-tree edge, scrambled with
   random 2-opt flips, then clue cells are hidden one at a time
   while a counting solver proves the loop stays unique. Every
   published puzzle has exactly one solution.

   API:
     SlitherGen.DIFFICULTY  — { easy, medium, hard } options
     SlitherGen.makePuzzle(difficultyKey) -> puzzle
     SlitherGen.makeBatch(count, difficultyKey) -> [puzzle...]
     puzzle = {
       w, h:   cells per row / per column,
       clues:  w*h flat array (-1 = unnumbered),
       loop:   flat array of used edges (for answers / tests),
       blanks: number of unnumbered cells,
       difficulty, title
     }
   Edge ids: horizontal edges (r,c)-(r,c+1) for r in 0..h,
   c in 0..w-1 -> id = r*w + c; vertical edges (r,c)-(r+1,c)
   for r in 0..h-1, c in 0..w -> id = (h+1)*w + r*(w+1) + c.
   ============================================================ */

(function (global) {
  "use strict";

  var DIFFICULTY = {
    easy:   { label: "Easy",   w: 4, h: 4, hide: 2, minHide: 2 },
    medium: { label: "Medium", w: 5, h: 5, hide: 4, minHide: 4 },
    hard:   { label: "Hard",   w: 6, h: 6, hide: 6, minHide: 4 }
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

  /* ---------- lattice helpers ---------- */

  function edgeEndpoints(w, h) {
    // returns [ [u, v], ... ] for every edge
    var ends = [];
    for (var r = 0; r <= h; r++) {
      for (var c = 0; c < w; c++) {
        ends.push([r * (w + 1) + c, r * (w + 1) + c + 1]); // horizontal
      }
    }
    for (var r2 = 0; r2 < h; r2++) {
      for (var c2 = 0; c2 <= w; c2++) {
        ends.push([r2 * (w + 1) + c2, (r2 + 1) * (w + 1) + c2]); // vertical
      }
    }
    return ends;
  }

  /* cell (r,c) side edges -> ids */
  function cellEdges(w, h, r, c) {
    return [
      r * w + c,                       // top (horizontal)
      (r + 1) * w + c,                 // bottom (horizontal)
      (h + 1) * w + r * (w + 1) + c,   // left (vertical)
      (h + 1) * w + r * (w + 1) + c + 1 // right (vertical)
    ];
  }

  /* ---------- loop generation ---------- */

  /* Build a random simple cycle as the boundary of a randomly grown
     connected region of cells (randomized Prim, 35-70% of the grid).
     The boundary of a simply-connected cell region is a single simple
     cycle — reject holes and corner pinches (degree-4 vertices). */
  function makeLoop(w, h) {
    var total = w * h;
    var ends = edgeEndpoints(w, h);
    for (var attempt = 0; attempt < 300; attempt++) {
      var inRegion = new Array(total).fill(false);
      var start = Math.floor(Math.random() * total);
      inRegion[start] = true;
      var frontier = [];
      function addFrontier(cell) {
        var r = Math.floor(cell / w), c = cell % w;
        if (r > 0 && !inRegion[cell - w]) frontier.push(cell - w);
        if (r < h - 1 && !inRegion[cell + w]) frontier.push(cell + w);
        if (c > 0 && !inRegion[cell - 1]) frontier.push(cell - 1);
        if (c < w - 1 && !inRegion[cell + 1]) frontier.push(cell + 1);
      }
      addFrontier(start);
      var target = Math.floor(total * (0.35 + Math.random() * 0.35)); // 35-70%
      var size = 1;
      while (frontier.length && size < target) {
        var idx = Math.floor(Math.random() * frontier.length);
        var cell = frontier[idx];
        frontier.splice(idx, 1);
        if (inRegion[cell]) continue;
        inRegion[cell] = true;
        size++;
        addFrontier(cell);
      }
      // boundary: sides with no region cell on the other side
      var used = new Array(ends.length).fill(false);
      for (var r2 = 0; r2 < h; r2++) {
        for (var c2 = 0; c2 < w; c2++) {
          if (!inRegion[r2 * w + c2]) continue;
          if (!(r2 > 0 && inRegion[(r2 - 1) * w + c2])) used[r2 * w + c2] = true;          // top
          if (!(r2 < h - 1 && inRegion[(r2 + 1) * w + c2])) used[(r2 + 1) * w + c2] = true; // bottom
          if (!(c2 > 0 && inRegion[r2 * w + c2 - 1])) used[(h + 1) * w + r2 * (w + 1) + c2] = true;       // left
          if (!(c2 < w - 1 && inRegion[r2 * w + c2 + 1])) used[(h + 1) * w + r2 * (w + 1) + c2 + 1] = true; // right
        }
      }
      // validate: every vertex has degree 0 or 2
      var deg = new Array((w + 1) * (h + 1)).fill(0);
      for (var e = 0; e < ends.length; e++) {
        if (used[e]) { deg[ends[e][0]]++; deg[ends[e][1]]++; }
      }
      var bad = false;
      for (var v = 0; v < deg.length; v++) {
        if (deg[v] !== 0 && deg[v] !== 2) { bad = true; break; }
      }
      if (bad) continue;
      // validate: the used edges form one connected component
      var first = -1;
      for (var e2 = 0; e2 < ends.length; e2++) { if (used[e2]) { first = ends[e2][0]; break; } }
      var seen = new Array((w + 1) * (h + 1)).fill(false);
      var queue = [first];
      seen[first] = true;
      var reached = 0;
      for (var qi = 0; qi < queue.length; qi++) {
        var cur = queue[qi];
        for (var e3 = 0; e3 < ends.length; e3++) {
          if (!used[e3]) continue;
          var nxt = ends[e3][0] === cur ? ends[e3][1] : (ends[e3][1] === cur ? ends[e3][0] : -1);
          if (nxt !== -1 && !seen[nxt]) { seen[nxt] = true; queue.push(nxt); }
        }
      }
      for (var e4 = 0; e4 < ends.length; e4++) {
        if (used[e4] && (!seen[ends[e4][0]] || !seen[ends[e4][1]])) { bad = true; break; }
      }
      if (bad) continue;
      return used;
    }
    return null;
  }

  /* ---------- clue computation ---------- */

  function computeClues(w, h, used) {
    var clues = [];
    for (var r = 0; r < h; r++) {
      for (var c = 0; c < w; c++) {
        var sides = cellEdges(w, h, r, c);
        var n = 0;
        for (var i = 0; i < 4; i++) if (used[sides[i]]) n++;
        clues.push(n);
      }
    }
    return clues;
  }

  /* ---------- counting solver ---------- */

  /* Count solutions (up to `limit`) of a slitherlink grid. `clues`
     is w*h flat; -1 means unnumbered (no constraint). Edge DFS with
     vertex-degree, cell-count and premature-cycle pruning (DSU with
     rollback). Returns -1 if the node budget is exceeded. */
  function countSolutions(clues, w, h, limit, nodeBudget) {
    var MAX_NODES = nodeBudget || 120000;
    var ends = edgeEndpoints(w, h);
    var E = ends.length;
    var nv = (w + 1) * (h + 1);
    var cells = [];
    for (var r = 0; r < h; r++) {
      for (var c = 0; c < w; c++) cells.push(cellEdges(w, h, r, c));
    }
    var cellOf = {}; // edge id -> cell index (an edge borders 1 or 2 cells)
    for (var ci = 0; ci < cells.length; ci++) {
      for (var s = 0; s < 4; s++) {
        var eid = cells[ci][s];
        cellOf[eid] = cellOf[eid] === undefined ? [ci] : cellOf[eid].concat([ci]);
      }
    }
    var count = 0;
    var nodes = 0;
    var on = new Array(E).fill(false);
    var deg = new Array(nv).fill(0);
    var usedCnt = new Array(cells.length).fill(0);
    var decided = new Array(cells.length).fill(0);
    var remaining = new Array(cells.length).fill(0); // undecided sides per cell
    for (var ci2 = 0; ci2 < cells.length; ci2++) remaining[ci2] = 4;

    // DSU with rollback
    var parent = range(nv);
    var rank = new Array(nv).fill(0);
    var hist = [];
    function find(x) {
      while (parent[x] !== x) x = parent[x];
      return x;
    }
    function union(a, b) {
      var ra = find(a), rb = find(b);
      if (ra === rb) return false;
      if (rank[ra] < rank[rb]) { var t = ra; ra = rb; rb = t; }
      // record the OLD parent of rb so rollback can restore it
      hist.push([rb, parent[rb]]);
      parent[rb] = ra;
      if (rank[ra] === rank[rb]) { rank[ra]++; hist.push([ra, -1]); }
      return true;
    }
    function rollback(mark) {
      while (hist.length > mark) {
        var op = hist.pop();
        if (op[1] === -1) rank[op[0]]--;
        else parent[op[0]] = op[1];
      }
    }

    /* edge decision order: every cell owns its top and left edges
       (the bottom of cell (r,c) is the top of (r+1,c), and the right
       of (r,c) is the left of (r,c+1)); the bottom row and right
       column border edges are appended at the end. */
    var order = [];
    for (var r2 = 0; r2 < h; r2++) {
      for (var c2 = 0; c2 < w; c2++) {
        order.push(cellEdges(w, h, r2, c2)[0]); // top
        order.push(cellEdges(w, h, r2, c2)[2]); // left
      }
    }
    for (var c3 = 0; c3 < w; c3++) order.push(cellEdges(w, h, h - 1, c3)[1]); // bottom row
    for (var r3 = 0; r3 < h; r3++) order.push(cellEdges(w, h, r3, w - 1)[3]); // right col

    function pruneCell(ci) {
      var clue = clues[ci];
      if (clue < 0) return true;
      return usedCnt[ci] <= clue && clue <= usedCnt[ci] + remaining[ci];
    }

    function dfs(pos) {
      if (count >= limit || nodes > MAX_NODES) return;
      if (pos >= order.length) {
        // all edges decided; a solution requires a cycle to have closed
        return;
      }
      var e = order[pos];
      var u = ends[e][0], v = ends[e][1];
      var cellList = cellOf[e] || [];
      var mark = hist.length;

      // forced-edge reasoning: if a neighbouring numbered cell already
      // has all its sides used, this edge must be OFF; if it still
      // needs every remaining side, this edge must be ON
      var forceOff = false, forceOn = false;
      for (var fc = 0; fc < cellList.length; fc++) {
        var cidx = cellList[fc];
        if (clues[cidx] < 0) continue;
        if (usedCnt[cidx] === clues[cidx]) forceOff = true;
        if (remaining[cidx] > 0 && usedCnt[cidx] + remaining[cidx] === clues[cidx]) forceOn = true;
      }
      if (forceOn && forceOff) return; // contradiction

      // option 1: edge OFF
      if (!forceOn) {
        for (var i = 0; i < cellList.length; i++) {
          decided[cellList[i]]++;
          remaining[cellList[i]]--;
        }
        var offOk = true;
        for (var i2 = 0; i2 < cellList.length; i2++) {
          if (!pruneCell(cellList[i2])) { offOk = false; break; }
        }
        if (offOk) dfs(pos + 1);
        for (var i3 = 0; i3 < cellList.length; i3++) {
          decided[cellList[i3]]--;
          remaining[cellList[i3]]++;
        }
        if (count >= limit || nodes > MAX_NODES) return;
      }

      // option 2: edge ON
      if (forceOff || deg[u] >= 2 || deg[v] >= 2) return;
      nodes++;
      on[e] = true;
      deg[u]++; deg[v]++;
      for (var i4 = 0; i4 < cellList.length; i4++) {
        usedCnt[cellList[i4]]++;
        decided[cellList[i4]]++;
        remaining[cellList[i4]]--;
      }
      var onOk = true;
      for (var i5 = 0; i5 < cellList.length; i5++) {
        if (!pruneCell(cellList[i5])) { onOk = false; break; }
      }
      if (onOk) {
        var closes = !union(u, v);
        if (closes) {
          // a cycle just closed: the only valid completion sets every
          // remaining edge to 0, so every numbered cell must already
          // be exactly satisfied
          var allSat = true;
          for (var ci3 = 0; ci3 < cells.length; ci3++) {
            if (clues[ci3] >= 0 && usedCnt[ci3] !== clues[ci3]) { allSat = false; break; }
          }
          if (allSat) count++;
        } else {
          dfs(pos + 1);
        }
      }
      // undo
      for (var i6 = 0; i6 < cellList.length; i6++) {
        usedCnt[cellList[i6]]--;
        decided[cellList[i6]]--;
        remaining[cellList[i6]]++;
      }
      deg[u]--; deg[v]--;
      on[e] = false;
      rollback(mark);
    }

    dfs(0);
    if (nodes > MAX_NODES) return -1;
    return count;
  }

  /* ---------- puzzle assembly ---------- */

  function finalize(clues, used, diffKey, d) {
    var blanks = 0;
    for (var i = 0; i < clues.length; i++) if (clues[i] < 0) blanks++;
    return {
      w: d.w,
      h: d.h,
      n: d.w * d.h,
      clues: clues.slice(),
      loop: used.slice(),
      blanks: blanks,
      difficulty: diffKey,
      title: "Slitherlink — " + d.label + " level"
    };
  }

  function hideClues(clues, used, w, h, target) {
    var out = clues.slice();
    var hidden = 0;
    var order = shuffle(range(clues.length));
    for (var i = 0; i < order.length && hidden < target; i++) {
      var cell = order[i];
      if (out[cell] < 0) continue;
      var saved = out[cell];
      out[cell] = -1;
      var res = countSolutions(out, w, h, 2, 30000);
      if (res === 1) {
        hidden++;
      } else {
        out[cell] = saved; // keep the clue (or budget hit)
      }
    }
    return out;
  }

  function makePuzzle(diffKey) {
    var d = DIFFICULTY[diffKey] || DIFFICULTY.medium;
    for (var attempt = 0; attempt < 100; attempt++) {
      var used = makeLoop(d.w, d.h);
      if (!used) continue;
      var allClues = computeClues(d.w, d.h, used);
      // with every cell numbered the loop must already be unique
      if (countSolutions(allClues, d.w, d.h, 2, 1000000) !== 1) continue;
      var clues = hideClues(allClues, used, d.w, d.h, d.hide);
      var hidden = 0;
      for (var hc = 0; hc < clues.length; hc++) if (clues[hc] < 0) hidden++;
      if (hidden < d.minHide) continue; // keep difficulty honest
      // uniqueness is already exact: the all-clues state passed with a
      // full count, and every hide step only kept cells whose removal
      // was verified to leave exactly one solution (never a budget hit)
      return finalize(clues, used, diffKey, d);
    }
    return null;
  }

  function signature(p) {
    return p.loop.join("") + "|" + p.clues.map(function (c) { return c < 0 ? "x" : c; }).join("");
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

  global.SlitherGen = {
    DIFFICULTY: DIFFICULTY,
    makePuzzle: makePuzzle,
    makeBatch: makeBatch,
    countSolutions: countSolutions, // exposed for tests
    _edgeEndpoints: edgeEndpoints,  // exposed for tests
    _cellEdges: cellEdges,          // exposed for tests
    _computeClues: computeClues,    // exposed for tests
    _makeLoop: makeLoop,            // exposed for tests
    _hideClues: hideClues           // exposed for tests
  };
})(typeof window !== "undefined" ? window : globalThis);
