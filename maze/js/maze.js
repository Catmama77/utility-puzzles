/* ============================================================
   Maze generator.
   Pure logic, no DOM — works in the browser and in Node (for
   tests). Builds a perfect maze (exactly one path between any two
   cells) with a recursive backtracker, and records the solution
   path from start (top-left) to end (bottom-right).

   API:
     MazeGen.SIZES              — { "8x8", "12x12", "16x16" }
     MazeGen.DIFFICULTY         — { easy, medium, hard } (solution
                                   path length as a share of cells)
     MazeGen.makeMaze(sizeKey, difficultyKey)
       -> {
            rows, cols,
            walls: rows x cols, each { n, e, s, w } booleans,
            start: { r, c }, end: { r, c },
            solution: [{ r, c }, ...],
            title
          }
     MazeGen.makeBatch(count, sizeKey, difficultyKey)
   ============================================================ */

(function (global) {
  "use strict";

  var SIZES = {
    "8x8":   { rows: 8,  cols: 8,  label: "8 × 8" },
    "12x12": { rows: 12, cols: 12, label: "12 × 12" },
    "16x16": { rows: 16, cols: 16, label: "16 × 16" }
  };

  // Difficulty = how winding the solution path is, measured as the
  // share of all cells the path visits. Easy mazes have a short,
  // direct route; hard mazes wind through most of the grid.
  var DIFFICULTY = {
    easy:   { label: "Easy",   target: 0.38 },
    medium: { label: "Medium", target: 0.55 },
    hard:   { label: "Hard",   target: 0.72 }
  };

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function newWalls(rows, cols) {
    var walls = [];
    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < cols; c++) {
        row.push({ n: true, e: true, s: true, w: true });
      }
      walls.push(row);
    }
    return walls;
  }

  function makeMaze(sizeKey, difficultyKey) {
    var S = SIZES[sizeKey] || SIZES["12x12"];
    var D = DIFFICULTY[difficultyKey] || DIFFICULTY.medium;
    var rows = S.rows;
    var cols = S.cols;

    // generate a few candidate mazes and keep the one whose solution
    // path length lands closest to the difficulty target
    var best = null;
    var bestScore = Infinity;
    var tries = 24;
    for (var t = 0; t < tries; t++) {
      var cand = buildMaze(rows, cols);
      var ratio = cand.solution.length / (rows * cols);
      var score = Math.abs(ratio - D.target);
      if (score < bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    var m = best || buildMaze(rows, cols);

    var title = "Maze — " + S.label + " · " + D.label;

    return {
      rows: rows,
      cols: cols,
      walls: m.walls,
      start: m.start,
      end: m.end,
      solution: m.solution,
      title: title,
      sizeKey: sizeKey,
      difficulty: difficultyKey
    };
  }

  function buildMaze(rows, cols) {
    var walls = newWalls(rows, cols);
    var visited = [];
    for (var r = 0; r < rows; r++) visited.push(new Array(cols).fill(false));

    var dirs = [
      { dr: -1, dc: 0, wall: "n", opp: "s" },
      { dr: 0, dc: 1, wall: "e", opp: "w" },
      { dr: 1, dc: 0, wall: "s", opp: "n" },
      { dr: 0, dc: -1, wall: "w", opp: "e" }
    ];

    // iterative DFS with an explicit stack (avoids recursion depth issues)
    var stack = [{ r: 0, c: 0 }];
    visited[0][0] = true;
    while (stack.length) {
      var cell = stack[stack.length - 1];
      var options = shuffle(dirs.filter(function (d) {
        var nr = cell.r + d.dr;
        var nc = cell.c + d.dc;
        return nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc];
      }));
      if (!options.length) {
        stack.pop();
        continue;
      }
      var d = options[0];
      var nr = cell.r + d.dr;
      var nc = cell.c + d.dc;
      walls[cell.r][cell.c][d.wall] = false;
      walls[nr][nc][d.opp] = false;
      visited[nr][nc] = true;
      stack.push({ r: nr, c: nc });
    }

    var start = { r: 0, c: 0 };
    var end = { r: rows - 1, c: cols - 1 };

    // solve: BFS from start, then walk back
    var prev = {};
    var queue = [start];
    var seen = {};
    seen["0,0"] = true;
    var found = null;
    while (queue.length && !found) {
      var cur = queue.shift();
      if (cur.r === end.r && cur.c === end.c) { found = cur; break; }
      for (var i = 0; i < dirs.length; i++) {
        var d2 = dirs[i];
        if (walls[cur.r][cur.c][d2.wall]) continue; // wall blocks
        var nr2 = cur.r + d2.dr;
        var nc2 = cur.c + d2.dc;
        if (nr2 < 0 || nr2 >= rows || nc2 < 0 || nc2 >= cols) continue;
        var key = nr2 + "," + nc2;
        if (seen[key]) continue;
        seen[key] = true;
        prev[key] = cur;
        queue.push({ r: nr2, c: nc2 });
      }
    }

    var solution = [];
    var node = found || end;
    while (node) {
      solution.unshift({ r: node.r, c: node.c });
      node = prev[node.r + "," + node.c];
    }

    return {
      rows: rows,
      cols: cols,
      walls: walls,
      start: start,
      end: end,
      solution: solution
    };
  }

  function signature(m) {
    var parts = [];
    for (var r = 0; r < m.rows; r++) {
      for (var c = 0; c < m.cols; c++) {
        var w = m.walls[r][c];
        parts.push((w.n ? "n" : "") + (w.e ? "e" : "") + (w.s ? "s" : "") + (w.w ? "w" : ""));
      }
    }
    return parts.join("|");
  }

  function makeBatch(count, sizeKey, difficultyKey) {
    var out = [];
    var seen = {};
    var maxAttempts = 40;
    for (var i = 0; i < count; i++) {
      var m = null;
      for (var a = 0; a < maxAttempts; a++) {
        var cand = makeMaze(sizeKey, difficultyKey);
        var sig = signature(cand);
        if (!seen[sig]) {
          m = cand;
          seen[sig] = true;
          break;
        }
      }
      if (!m) m = makeMaze(sizeKey, difficultyKey);
      out.push(m);
    }
    return out;
  }

  global.MazeGen = {
    SIZES: SIZES,
    DIFFICULTY: DIFFICULTY,
    makeMaze: makeMaze,
    makeBatch: makeBatch
  };
})(typeof window !== "undefined" ? window : globalThis);
