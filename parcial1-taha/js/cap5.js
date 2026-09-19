/* Cap 5 — Modelo de transporte y sus variantes (Taha 9a ed.)
 * Owner: E. Global-only script, no ES modules, no fetch.
 * Depends on: js/lib/frac.js (loaded, not required for this file's integer arithmetic),
 * js/quiz.js (IO.Quiz), js/app.js (IO.registerChapter contract).
 */
(function () {
  'use strict';
  window.IO = window.IO || { chapters: [] };
  IO.registerChapter = IO.registerChapter || function (ch) { IO.chapters.push(ch); };

  /* ======================================================================
   * 0. Utilidades
   * ==================================================================== */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cloneMatrix(m) { return m.map(function (row) { return row.slice(); }); }
  function sum(arr) { return arr.reduce(function (a, b) { return a + b; }, 0); }
  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }

  /* ======================================================================
   * 1. Núcleo: modelo de transporte
   * ==================================================================== */

  // Balancea oferta/demanda agregando fuente o destino ficticio (costo 0).
  function balanceProblem(supply, demand, cost) {
    supply = supply.slice(); demand = demand.slice(); cost = cloneMatrix(cost);
    var sS = sum(supply), sD = sum(demand);
    var addedRow = false, addedCol = false;
    if (sS < sD) {
      supply.push(sD - sS);
      cost.push(new Array(demand.length).fill(0));
      addedRow = true;
    } else if (sD < sS) {
      demand.push(sS - sD);
      cost.forEach(function (r) { r.push(0); });
      addedCol = true;
    }
    // "balanced" refleja el estado final (tras agregar la fuente/destino ficticio si hizo
    // falta), no las sumas originales: de lo contrario siempre daría false cuando se agregó
    // un ficticio, aunque el problema ya haya quedado balanceado.
    return { supply: supply, demand: demand, cost: cost, addedRow: addedRow, addedCol: addedCol, balanced: sum(supply) === sum(demand) };
  }

  function totalCost(alloc, cost) {
    var t = 0;
    for (var i = 0; i < alloc.length; i++) for (var j = 0; j < alloc[i].length; j++) if (alloc[i][j]) t += alloc[i][j] * cost[i][j];
    return t;
  }

  // Esquina noroeste, con bitácora de pasos.
  function nwCorner(supply, demand) {
    var m = supply.length, n = demand.length;
    var s = supply.slice(), d = demand.slice();
    var alloc = Array.from({ length: m }, function () { return new Array(n).fill(0); });
    var steps = [];
    var i = 0, j = 0;
    while (i < m && j < n) {
      var q = Math.min(s[i], d[j]);
      alloc[i][j] = q;
      steps.push({
        r: i, c: j, amount: q, supplyLeft: s[i] - q, demandLeft: d[j] - q,
        note: 'Celda noroeste disponible: (F' + (i + 1) + ', D' + (j + 1) + '). Se asigna ' + q + ' = mín(oferta ' + s[i] + ', demanda ' + d[j] + ').'
      });
      s[i] -= q; d[j] -= q;
      if (s[i] === 0 && d[j] === 0) {
        if (i === m - 1) j++; else if (j === n - 1) i++; else i++;
      } else if (s[i] === 0) i++;
      else j++;
    }
    return { alloc: alloc, steps: steps };
  }

  // Costo mínimo.
  function leastCost(supply, demand, cost) {
    var m = supply.length, n = demand.length;
    var s = supply.slice(), d = demand.slice();
    var rowDone = new Array(m).fill(false), colDone = new Array(n).fill(false);
    var alloc = Array.from({ length: m }, function () { return new Array(n).fill(0); });
    var steps = [];
    while (true) {
      var min = Infinity, mi = -1, mj = -1;
      for (var i = 0; i < m; i++) { if (rowDone[i]) continue; for (var j = 0; j < n; j++) { if (colDone[j]) continue; if (cost[i][j] < min) { min = cost[i][j]; mi = i; mj = j; } } }
      if (mi < 0) break;
      var q = Math.min(s[mi], d[mj]);
      alloc[mi][mj] = q;
      steps.push({
        r: mi, c: mj, amount: q, supplyLeft: s[mi] - q, demandLeft: d[mj] - q,
        note: 'Costo mínimo disponible = ' + cost[mi][mj] + ' en (F' + (mi + 1) + ', D' + (mj + 1) + '). Se asigna ' + q + '.'
      });
      s[mi] -= q; d[mj] -= q;
      if (s[mi] === 0 && d[mj] === 0) {
        var openRows = 0; for (var a = 0; a < m; a++) if (!rowDone[a]) openRows++;
        if (openRows > 1) rowDone[mi] = true; else colDone[mj] = true;
      } else if (s[mi] === 0) rowDone[mi] = true;
      else colDone[mj] = true;
    }
    return { alloc: alloc, steps: steps };
  }

  // Vogel (VAM): penalizaciones = diferencia de los dos costos más chicos por fila/columna activa.
  function vogel(supply, demand, cost) {
    var m = supply.length, n = demand.length;
    var s = supply.slice(), d = demand.slice();
    var rowDone = new Array(m).fill(false), colDone = new Array(n).fill(false);
    var alloc = Array.from({ length: m }, function () { return new Array(n).fill(0); });
    var steps = [];
    var activeRows = m, activeCols = n;
    while (activeRows > 0 && activeCols > 0) {
      var rowPen = new Array(m).fill(-1), colPen = new Array(n).fill(-1);
      for (var i = 0; i < m; i++) {
        if (rowDone[i]) continue;
        var vals = [];
        for (var j = 0; j < n; j++) if (!colDone[j]) vals.push(cost[i][j]);
        vals.sort(function (a, b) { return a - b; });
        rowPen[i] = vals.length >= 2 ? vals[1] - vals[0] : (vals.length === 1 ? vals[0] : -1);
      }
      for (var j2 = 0; j2 < n; j2++) {
        if (colDone[j2]) continue;
        var vals2 = [];
        for (var i2 = 0; i2 < m; i2++) if (!rowDone[i2]) vals2.push(cost[i2][j2]);
        vals2.sort(function (a, b) { return a - b; });
        colPen[j2] = vals2.length >= 2 ? vals2[1] - vals2[0] : (vals2.length === 1 ? vals2[0] : -1);
      }
      var best = -Infinity, bestIsRow = true, bestIdx = -1;
      for (var i3 = 0; i3 < m; i3++) if (!rowDone[i3] && rowPen[i3] > best) { best = rowPen[i3]; bestIsRow = true; bestIdx = i3; }
      for (var j3 = 0; j3 < n; j3++) if (!colDone[j3] && colPen[j3] > best) { best = colPen[j3]; bestIsRow = false; bestIdx = j3; }
      var mi, mj;
      if (bestIsRow) {
        mi = bestIdx; var minc = Infinity;
        for (var j4 = 0; j4 < n; j4++) { if (colDone[j4]) continue; if (cost[mi][j4] < minc) { minc = cost[mi][j4]; mj = j4; } }
      } else {
        mj = bestIdx; var minc2 = Infinity;
        for (var i4 = 0; i4 < m; i4++) { if (rowDone[i4]) continue; if (cost[i4][mj] < minc2) { minc2 = cost[i4][mj]; mi = i4; } }
      }
      var q = Math.min(s[mi], d[mj]);
      alloc[mi][mj] = q;
      steps.push({
        r: mi, c: mj, amount: q, penalty: best, supplyLeft: s[mi] - q, demandLeft: d[mj] - q,
        note: 'Mayor penalización = ' + best + ' en ' + (bestIsRow ? 'fila F' + (bestIdx + 1) : 'columna D' + (bestIdx + 1)) + '. Celda de costo mínimo en esa línea: (F' + (mi + 1) + ', D' + (mj + 1) + '). Se asigna ' + q + '.'
      });
      s[mi] -= q; d[mj] -= q;
      if (s[mi] === 0 && d[mj] === 0) {
        var openRows2 = 0; for (var a2 = 0; a2 < m; a2++) if (!rowDone[a2]) openRows2++;
        if (openRows2 > 1) { rowDone[mi] = true; activeRows--; } else { colDone[mj] = true; activeCols--; }
      } else if (s[mi] === 0) { rowDone[mi] = true; activeRows--; }
      else { colDone[mj] = true; activeCols--; }
    }
    return { alloc: alloc, steps: steps };
  }

  function getBasicCells(alloc) {
    var cells = [];
    for (var i = 0; i < alloc.length; i++) for (var j = 0; j < alloc[i].length; j++) if (alloc[i][j] > 0) cells.push({ r: i, c: j });
    return cells;
  }

  // Completa a m+n-1 celdas básicas con asignaciones 0 que no cierren ciclo (unión-búsqueda),
  // para poder calcular u_i, v_j cuando hay degeneración.
  function fixDegeneracy(basics, m, n) {
    var need = m + n - 1;
    basics = basics.slice();
    if (basics.length >= need) return basics;
    var parent = [];
    for (var k = 0; k < m + n; k++) parent.push(k);
    function find(x) { while (parent[x] !== x) x = parent[x]; return x; }
    function union(a, b) { var ra = find(a), rb = find(b); if (ra !== rb) { parent[ra] = rb; return true; } return false; }
    var have = {};
    basics.forEach(function (c) { union(c.r, m + c.c); have[c.r + '_' + c.c] = true; });
    for (var i = 0; i < m && basics.length < need; i++) {
      for (var j = 0; j < n && basics.length < need; j++) {
        if (have[i + '_' + j]) continue;
        if (union(i, m + j)) { basics.push({ r: i, c: j }); have[i + '_' + j] = true; }
      }
    }
    return basics;
  }

  function computeUV(basics, cost, m, n) {
    var u = new Array(m).fill(null), v = new Array(n).fill(null);
    u[0] = 0;
    var changed = true, guard = 0;
    while (changed && guard < 50) {
      changed = false; guard++;
      basics.forEach(function (c) {
        if (u[c.r] !== null && v[c.c] === null) { v[c.c] = cost[c.r][c.c] - u[c.r]; changed = true; }
        else if (v[c.c] !== null && u[c.r] === null) { u[c.r] = cost[c.r][c.c] - v[c.c]; changed = true; }
      });
    }
    for (var i = 0; i < m; i++) if (u[i] === null) u[i] = 0;
    for (var j = 0; j < n; j++) if (v[j] === null) v[j] = 0;
    return { u: u, v: v };
  }

  // Evaluación u_i + v_j - c_ij de las celdas no básicas (positiva = mejora posible al minimizar).
  function evaluateNonBasic(basics, cost, u, v, m, n) {
    var basicSet = {};
    basics.forEach(function (c) { basicSet[c.r + '_' + c.c] = true; });
    var evals = [];
    for (var i = 0; i < m; i++) for (var j = 0; j < n; j++) {
      if (basicSet[i + '_' + j]) continue;
      evals.push({ r: i, c: j, value: u[i] + v[j] - cost[i][j] });
    }
    return evals;
  }

  function findEntering(evals) {
    var best = null;
    evals.forEach(function (e) { if (e.value > 0 && (best === null || e.value > best.value)) best = e; });
    return best;
  }

  // Encuentra el ciclo cerrado (celda entrante + básicas) mediante poda: se eliminan
  // celdas cuya fila o columna aparece una sola vez, hasta que sólo queda el ciclo único.
  // Luego se recorre alternando fila/columna a partir de la celda entrante.
  function findLoop(basics, start) {
    var cells = basics.slice();
    cells.push(start);
    var key = function (c) { return c.r + '_' + c.c; };
    var changed = true;
    while (changed) {
      changed = false;
      var rowCount = {}, colCount = {};
      cells.forEach(function (c) { rowCount[c.r] = (rowCount[c.r] || 0) + 1; colCount[c.c] = (colCount[c.c] || 0) + 1; });
      cells = cells.filter(function (c) {
        if (rowCount[c.r] < 2 || colCount[c.c] < 2) { changed = true; return false; }
        return true;
      });
    }
    var byRow = {}, byCol = {};
    cells.forEach(function (c) { (byRow[c.r] = byRow[c.r] || []).push(c); (byCol[c.c] = byCol[c.c] || []).push(c); });
    var order = [start];
    var visited = {}; visited[key(start)] = true;
    var cur = start, dir = 'row', guard = 0;
    while (guard++ < 100) {
      var candidates = dir === 'row' ? (byRow[cur.r] || []) : (byCol[cur.c] || []);
      var closed = false, next = null;
      for (var k = 0; k < candidates.length; k++) {
        var cand = candidates[k];
        if (cand.r === start.r && cand.c === start.c && order.length >= 3) { closed = true; break; }
        if (!visited[key(cand)]) next = cand;
      }
      if (closed) break;
      if (!next) break;
      order.push(next); visited[key(next)] = true; cur = next; dir = dir === 'row' ? 'col' : 'row';
    }
    return order;
  }

  // Aplica theta al ciclo (signos +,-,+,-,... comenzando en la entrante) y actualiza la base.
  function applyLoop(alloc, basis, order) {
    var minusCells = [];
    for (var k = 1; k < order.length; k += 2) minusCells.push({ val: alloc[order[k].r][order[k].c], cell: order[k] });
    var theta = Math.min.apply(null, minusCells.map(function (t) { return t.val; }));
    order.forEach(function (cell, k) {
      var sign = k % 2 === 0 ? 1 : -1;
      alloc[cell.r][cell.c] += sign * theta;
    });
    var leaving = null;
    for (var k2 = 0; k2 < minusCells.length; k2++) if (minusCells[k2].val === theta) { leaving = minusCells[k2].cell; break; }
    var key = function (c) { return c.r + '_' + c.c; };
    var newBasis = basis.filter(function (c) { return key(c) !== key(leaving); });
    newBasis.push(order[0]);
    return { theta: theta, leaving: leaving, basis: newBasis };
  }

  // Corre MODI completo desde una solución inicial factible, devolviendo iteraciones detalladas.
  function modiSolve(supply, demand, cost, initialAlloc) {
    var m = supply.length, n = demand.length;
    var alloc = cloneMatrix(initialAlloc);
    var basis = fixDegeneracy(getBasicCells(alloc), m, n);
    var iterations = [];
    var guard = 0;
    while (guard++ < 60) {
      var uv = computeUV(basis, cost, m, n);
      var evals = evaluateNonBasic(basis, cost, uv.u, uv.v, m, n);
      var entering = findEntering(evals);
      if (!entering) {
        iterations.push({ optimal: true, alloc: cloneMatrix(alloc), u: uv.u, v: uv.v, evals: evals, basis: basis.slice() });
        break;
      }
      var loop = findLoop(basis, entering);
      var before = cloneMatrix(alloc);
      var res = applyLoop(alloc, basis, loop);
      basis = res.basis;
      iterations.push({
        optimal: false, before: before, after: cloneMatrix(alloc), u: uv.u, v: uv.v, evals: evals,
        entering: entering, loop: loop, theta: res.theta, leaving: res.leaving
      });
    }
    return { alloc: alloc, iterations: iterations, cost: totalCost(alloc, cost) };
  }

  /* ======================================================================
   * 2. Núcleo: método húngaro (asignación)
   * ==================================================================== */

  function maxMatching(zeroMatrix, n) {
    var matchCol = new Array(n).fill(-1), matchRow = new Array(n).fill(-1);
    function tryAugment(i, visited) {
      for (var j = 0; j < n; j++) {
        if (zeroMatrix[i][j] && !visited[j]) {
          visited[j] = true;
          if (matchCol[j] === -1 || tryAugment(matchCol[j], visited)) { matchCol[j] = i; matchRow[i] = j; return true; }
        }
      }
      return false;
    }
    for (var i = 0; i < n; i++) tryAugment(i, new Array(n).fill(false));
    return { matchRow: matchRow, matchCol: matchCol };
  }

  // Teorema de König: filas no marcadas + columnas marcadas = cobertura mínima de ceros.
  function minLineCover(zeroMatrix, n, matchRow, matchCol) {
    var rowMarked = new Array(n).fill(false), colMarked = new Array(n).fill(false);
    var queue = [];
    for (var i = 0; i < n; i++) if (matchRow[i] === -1) { rowMarked[i] = true; queue.push(i); }
    var qi = 0;
    while (qi < queue.length) {
      var r = queue[qi++];
      for (var j = 0; j < n; j++) {
        if (zeroMatrix[r][j] && !colMarked[j]) {
          colMarked[j] = true;
          var i2 = matchCol[j];
          if (i2 !== -1 && !rowMarked[i2]) { rowMarked[i2] = true; queue.push(i2); }
        }
      }
    }
    var rows = [], cols = [];
    for (var i3 = 0; i3 < n; i3++) if (!rowMarked[i3]) rows.push(i3);
    for (var j3 = 0; j3 < n; j3++) if (colMarked[j3]) cols.push(j3);
    return { rows: rows, cols: cols };
  }

  // costMatrix: rectangular admitido (se rellena con ceros ficticios hasta cuadrada).
  function hungarianSolve(costMatrix) {
    var m = costMatrix.length, n = costMatrix[0].length, N = Math.max(m, n);
    var cost = [];
    for (var i = 0; i < N; i++) { cost.push([]); for (var j = 0; j < N; j++) cost[i][j] = (i < m && j < n) ? costMatrix[i][j] : 0; }
    var work = cloneMatrix(cost);
    var steps = [];
    for (var i2 = 0; i2 < N; i2++) { var mn = Math.min.apply(null, work[i2]); for (var j2 = 0; j2 < N; j2++) work[i2][j2] -= mn; }
    steps.push({ phase: 'row', matrix: cloneMatrix(work), note: 'Se resta el mínimo de cada fila.' });
    for (var j4 = 0; j4 < N; j4++) {
      var col = []; for (var i4 = 0; i4 < N; i4++) col.push(work[i4][j4]);
      var mc = Math.min.apply(null, col); for (var i5 = 0; i5 < N; i5++) work[i5][j4] -= mc;
    }
    steps.push({ phase: 'col', matrix: cloneMatrix(work), note: 'Se resta el mínimo de cada columna.' });
    var guard = 0, finalMatch = null;
    while (guard++ < 100) {
      var zeroMatrix = work.map(function (row) { return row.map(function (v) { return v === 0; }); });
      var match = maxMatching(zeroMatrix, N);
      var cover = minLineCover(zeroMatrix, N, match.matchRow, match.matchCol);
      var numLines = cover.rows.length + cover.cols.length;
      steps.push({ phase: 'cover', matrix: cloneMatrix(work), rows: cover.rows, cols: cover.cols, numLines: numLines, matchRow: match.matchRow.slice(),
        note: 'Cobertura mínima de ceros con ' + numLines + ' línea(s) (se necesitan ' + N + ').' });
      if (numLines >= N) { finalMatch = match; steps.push({ phase: 'done', matchRow: match.matchRow.slice(), note: 'Líneas = N: asignación óptima encontrada.' }); break; }
      var uncovered = [];
      for (var i6 = 0; i6 < N; i6++) if (cover.rows.indexOf(i6) < 0) for (var j6 = 0; j6 < N; j6++) if (cover.cols.indexOf(j6) < 0) uncovered.push(work[i6][j6]);
      var minUnc = Math.min.apply(null, uncovered);
      for (var i7 = 0; i7 < N; i7++) for (var j7 = 0; j7 < N; j7++) {
        var rc = cover.rows.indexOf(i7) >= 0, cc = cover.cols.indexOf(j7) >= 0;
        if (!rc && !cc) work[i7][j7] -= minUnc; else if (rc && cc) work[i7][j7] += minUnc;
      }
      steps.push({ phase: 'adjust', matrix: cloneMatrix(work), minUncovered: minUnc, note: 'Se resta ' + minUnc + ' de las celdas no cubiertas y se suma en las intersecciones cubiertas dos veces.' });
    }
    var assign = [], cost2 = 0;
    for (var i8 = 0; i8 < N; i8++) {
      var j8 = finalMatch.matchRow[i8];
      if (i8 < m && j8 < n) { assign.push({ r: i8, c: j8, cost: costMatrix[i8][j8] }); cost2 += costMatrix[i8][j8]; }
    }
    return { assign: assign, cost: cost2, steps: steps, N: N, m: m, n: n };
  }

  function hungarianSolveMax(profitMatrix) {
    var flat = [];
    profitMatrix.forEach(function (r) { r.forEach(function (v) { flat.push(v); }); });
    var maxVal = Math.max.apply(null, flat);
    var costMatrix = profitMatrix.map(function (r) { return r.map(function (v) { return maxVal - v; }); });
    var res = hungarianSolve(costMatrix);
    var profit = 0;
    res.assign.forEach(function (a) { profit += profitMatrix[a.r][a.c]; });
    res.profit = profit;
    res.maxVal = maxVal;
    return res;
  }

  /* ======================================================================
   * 3. Render helpers compartidos
   * ==================================================================== */

  function matrixEditorHTML(idPrefix, supply, demand, cost, rowLabel, colLabel) {
    var m = supply.length, n = demand.length;
    var h = '<div class="canvas-wrap"><table class="tableau data" id="' + idPrefix + '-grid"><thead><tr><th></th>';
    for (var j = 0; j < n; j++) h += '<th>' + colLabel + (j + 1) + '</th>';
    h += '<th>Oferta</th></tr></thead><tbody>';
    for (var i = 0; i < m; i++) {
      h += '<tr><th>' + rowLabel + (i + 1) + '</th>';
      for (var j2 = 0; j2 < n; j2++) {
        h += '<td><input class="input-grid" type="number" data-role="cost" data-r="' + i + '" data-c="' + j2 + '" value="' + cost[i][j2] + '"></td>';
      }
      h += '<td><input class="input-grid" type="number" data-role="supply" data-r="' + i + '" value="' + supply[i] + '"></td></tr>';
    }
    h += '<tr><th>Demanda</th>';
    for (var j3 = 0; j3 < n; j3++) h += '<td><input class="input-grid" type="number" data-role="demand" data-c="' + j3 + '" value="' + demand[j3] + '"></td>';
    h += '<td class="muted">' + sum(supply) + ' / ' + sum(demand) + '</td></tr>';
    h += '</tbody></table></div>';
    return h;
  }

  function allocTableHTML(alloc, cost, opts) {
    opts = opts || {};
    var m = alloc.length, n = alloc[0].length;
    var u = opts.u, v = opts.v;
    var highlightR = opts.highlightR, highlightC = opts.highlightC;
    var loopSet = {};
    (opts.loop || []).forEach(function (cell, idx) { loopSet[cell.r + '_' + cell.c] = idx % 2 === 0 ? '+' : '−'; });
    var h = '<div class="canvas-wrap" style="position:relative"><table class="tableau data" id="' + (opts.tableId || 'cap5-alloc') + '">';
    h += '<thead><tr><th></th>';
    for (var j = 0; j < n; j++) h += '<th>D' + (j + 1) + (v ? ' <span class="muted">(v=' + v[j] + ')</span>' : '') + '</th>';
    h += '<th>Oferta</th></tr></thead><tbody>';
    for (var i = 0; i < m; i++) {
      h += '<tr><th>F' + (i + 1) + (u ? ' <span class="muted">(u=' + u[i] + ')</span>' : '') + '</th>';
      for (var j2 = 0; j2 < n; j2++) {
        var val = alloc[i][j2];
        var cls = ['tableau-cell'];
        if (i === highlightR && j2 === highlightC) cls.push('pivot-cell');
        var sign = loopSet[i + '_' + j2];
        if (sign) cls.push('hl');
        var content = (val ? '<b>' + val + '</b>' : '<span class="muted">0</span>') + '<div class="muted" style="font-size:.8em">c=' + cost[i][j2] + '</div>';
        if (sign) content += '<div class="badge ' + (sign === '+' ? 'badge-ok' : 'badge-err') + '">' + sign + '</div>';
        h += '<td class="' + cls.join(' ') + '" data-r="' + i + '" data-c="' + j2 + '">' + content + '</td>';
      }
      h += '<td class="muted">' + alloc[i].reduce(function (a, b) { return a + b; }, 0) + '</td></tr>';
    }
    h += '<tr><th>Demanda</th>';
    for (var j4 = 0; j4 < n; j4++) {
      var colSum = 0; for (var i2 = 0; i2 < m; i2++) colSum += alloc[i2][j4];
      h += '<td class="muted">' + colSum + '</td>';
    }
    h += '<td></td></tr></tbody></table></div>';
    return h;
  }

  // Dibuja el ciclo cerrado como SVG superpuesto sobre la tabla de asignación.
  function drawLoopSVG(wrap, tableId, loop) {
    if (!loop || loop.length < 4) return;
    var table = wrap.querySelector('#' + tableId);
    if (!table) return;
    var wrapRect = wrap.getBoundingClientRect();
    var pts = loop.map(function (cell) {
      var td = table.querySelector('td[data-r="' + cell.r + '"][data-c="' + cell.c + '"]');
      if (!td) return null;
      var r = td.getBoundingClientRect();
      return { x: r.left - wrapRect.left + r.width / 2, y: r.top - wrapRect.top + r.height / 2 };
    });
    if (pts.indexOf(null) >= 0) return;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', wrap.scrollWidth);
    svg.setAttribute('height', wrap.scrollHeight);
    svg.style.position = 'absolute';
    svg.style.left = '0'; svg.style.top = '0';
    svg.style.pointerEvents = 'none';
    svg.setAttribute('class', 'cap5-loop-svg');
    var d = 'M' + pts.map(function (p) { return p.x + ',' + p.y; }).join(' L');
    d += ' L' + pts[0].x + ',' + pts[0].y;
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--accent)');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-dasharray', '6 4');
    svg.appendChild(path);
    pts.forEach(function (p, idx) {
      var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', 4);
      c.setAttribute('fill', idx % 2 === 0 ? 'var(--ok)' : 'var(--err)');
      svg.appendChild(c);
    });
    wrap.appendChild(svg);
  }

  /* ======================================================================
   * 4. Widget «Transporte paso a paso»
   * ==================================================================== */

  var TRANSPORT_EXAMPLES = {
    sunray: {
      label: 'SunRay Transport', supply: [15, 25, 10], demand: [5, 15, 15, 15],
      cost: [[10, 2, 20, 11], [12, 7, 9, 20], [4, 14, 16, 18]], rowLabel: 'F', colLabel: 'D'
    },
    mgauto: {
      label: 'MG Auto (balanceado)', supply: [1000, 1500, 1200], demand: [2300, 1400],
      cost: [[80, 215], [100, 108], [102, 68]], rowLabel: 'Planta', colLabel: 'Centro'
    },
    mgauto_unb: {
      label: 'MG Auto (desbalanceado, destino ficticio)', supply: [1000, 1500, 1200], demand: [2000, 1400],
      cost: [[80, 215], [100, 108], [102, 68]], rowLabel: 'Planta', colLabel: 'Centro'
    },
    degenerado: {
      label: 'Caso degenerado', supply: [5, 15, 5], demand: [5, 15, 5],
      cost: [[8, 6, 3], [4, 7, 5], [9, 2, 6]], rowLabel: 'F', colLabel: 'D'
    }
  };

  function buildTransportFrames(supply, demand, cost, method) {
    var frames = [];
    var zero = supply.map(function (s) { return demand.map(function () { return 0; }); });
    frames.push({ kind: 'start', alloc: zero, text: 'Matriz balanceada (oferta total = demanda total = ' + sum(supply) + '). Método de inicio: ' + method + '.' });
    var res = method === 'nw' ? nwCorner(supply, demand) : method === 'lc' ? leastCost(supply, demand, cost) : vogel(supply, demand, cost);
    var running = zero.map(function (r) { return r.slice(); });
    res.steps.forEach(function (st) {
      running = running.map(function (r) { return r.slice(); });
      running[st.r][st.c] = st.amount;
      frames.push({ kind: 'init-step', alloc: running.map(function (r) { return r.slice(); }), highlightR: st.r, highlightC: st.c, text: st.note });
    });
    frames.push({ kind: 'init-done', alloc: res.alloc, text: 'Solución inicial completa. Costo = ' + totalCost(res.alloc, cost) + '.' });
    var modi = modiSolve(supply, demand, cost, res.alloc);
    modi.iterations.forEach(function (it, idx) {
      if (it.optimal) {
        var evalTxt = it.evals.map(function (e) { return '(F' + (e.r + 1) + ',D' + (e.c + 1) + ')=' + e.value; }).join(', ');
        frames.push({
          kind: 'modi-optimal', alloc: it.alloc, u: it.u, v: it.v,
          text: 'MODI: u_1=0, multiplicadores u=[' + it.u.join(', ') + '], v=[' + it.v.join(', ') + ']. Evaluaciones de no básicas: ' + (evalTxt || '(ninguna)') + '. Todas ≤ 0 → óptimo. Costo = ' + totalCost(it.alloc, cost) + '.'
        });
      } else {
        var evalTxt2 = it.evals.map(function (e) { return '(F' + (e.r + 1) + ',D' + (e.c + 1) + ')=' + e.value; }).join(', ');
        frames.push({
          kind: 'modi-eval', alloc: it.before, u: it.u, v: it.v,
          text: 'Iteración ' + (idx + 1) + ': u=[' + it.u.join(', ') + '], v=[' + it.v.join(', ') + ']. Evaluaciones: ' + evalTxt2 + '. Entra la celda más positiva: (F' + (it.entering.r + 1) + ',D' + (it.entering.c + 1) + ') con valor ' + it.entering.value + '.'
        });
        frames.push({
          kind: 'modi-loop', alloc: it.before, loop: it.loop, entering: it.entering,
          text: 'Ciclo cerrado desde la celda entrante (signos + y − alternados). θ = mínimo de las celdas «−» = ' + it.theta + '. Sale la celda (F' + (it.leaving.r + 1) + ',D' + (it.leaving.c + 1) + ').'
        });
        frames.push({
          kind: 'modi-applied', alloc: it.after,
          text: 'Nueva tabla tras aplicar θ=' + it.theta + '. Costo = ' + totalCost(it.after, cost) + '.'
        });
      }
    });
    frames.push({ kind: 'final', alloc: modi.alloc, text: 'Solución óptima final. Costo total = ' + modi.cost + '.' });
    return frames;
  }

  function mountTransportWidget(root) {
    var state = { supply: TRANSPORT_EXAMPLES.sunray.supply.slice(), demand: TRANSPORT_EXAMPLES.sunray.demand.slice(),
      cost: cloneMatrix(TRANSPORT_EXAMPLES.sunray.cost), method: 'nw', frames: null, idx: 0 };

    function computeFrames() {
      state.frames = buildTransportFrames(state.supply, state.demand, state.cost, state.method);
      state.idx = 0;
    }
    computeFrames();

    function render() {
      var m = state.supply.length, n = state.demand.length;
      var frame = state.frames[state.idx];
      var editorHTML = matrixEditorHTML('cap5-transport', state.supply, state.demand, state.cost, 'F', 'D');
      var methodLabel = { nw: 'Esquina noroeste', lc: 'Costo mínimo', vam: 'Vogel (VAM)' }[state.method];
      var balanced = sum(state.supply) === sum(state.demand);
      var allocOpts = { tableId: 'cap5-transport-alloc' };
      if (frame.u) allocOpts.u = frame.u;
      if (frame.v) allocOpts.v = frame.v;
      if (frame.highlightR !== undefined) { allocOpts.highlightR = frame.highlightR; allocOpts.highlightC = frame.highlightC; }
      if (frame.loop) allocOpts.loop = frame.loop;
      var html = '' +
        '<div class="row">' +
        '  <label>Ejemplo ' +
        '    <select class="example-picker" data-act="example">' +
        Object.keys(TRANSPORT_EXAMPLES).map(function (k) { return '<option value="' + k + '">' + esc(TRANSPORT_EXAMPLES[k].label) + '</option>'; }).join('') +
        '    </select></label>' +
        '  <label>Método de inicio ' +
        '    <select data-act="method">' +
        '      <option value="nw"' + (state.method === 'nw' ? ' selected' : '') + '>Esquina noroeste</option>' +
        '      <option value="lc"' + (state.method === 'lc' ? ' selected' : '') + '>Costo mínimo</option>' +
        '      <option value="vam"' + (state.method === 'vam' ? ' selected' : '') + '>Vogel (VAM)</option>' +
        '    </select></label>' +
        '  <button class="btn btn-sm" data-act="add-row">+ fila</button>' +
        '  <button class="btn btn-sm" data-act="del-row">− fila</button>' +
        '  <button class="btn btn-sm" data-act="add-col">+ columna</button>' +
        '  <button class="btn btn-sm" data-act="del-col">− columna</button>' +
        '  <button class="btn btn-sm" data-act="balance">Balancear</button>' +
        '  <button class="btn btn-primary btn-sm" data-act="build">Comenzar</button>' +
        '</div>' +
        (balanced ? '<p class="badge badge-ok">Balanceado: oferta = demanda = ' + sum(state.supply) + '</p>' : '<p class="badge badge-warn">Desbalanceado: oferta ' + sum(state.supply) + ' ≠ demanda ' + sum(state.demand) + '. Use «Balancear».</p>') +
        editorHTML +
        '<div class="step-bar">' +
        '  <button class="btn btn-ghost btn-sm" data-act="prev">◀ Anterior</button>' +
        '  <span class="muted">Paso ' + (state.idx + 1) + ' / ' + state.frames.length + ' (' + methodLabel + ')</span>' +
        '  <button class="btn btn-ghost btn-sm" data-act="next">Siguiente ▶</button>' +
        '  <button class="btn btn-sm" data-act="solve-all">Resolver todo</button>' +
        '  <button class="btn btn-sm" data-act="reset">Reiniciar</button>' +
        '</div>' +
        '<p class="step-text">' + esc(frame.text) + '</p>' +
        '<div id="cap5-transport-allocwrap" style="position:relative">' + allocTableHTML(frame.alloc, state.cost, allocOpts) + '</div>';
      root.innerHTML = html;
      var wrap = root.querySelector('#cap5-transport-allocwrap');
      if (frame.loop) drawLoopSVG(wrap, 'cap5-transport-alloc', frame.loop);
      bind();
    }

    function readEditor() {
      var m = state.supply.length, n = state.demand.length;
      root.querySelectorAll('[data-role="cost"]').forEach(function (inp) {
        var r = +inp.dataset.r, c = +inp.dataset.c;
        state.cost[r][c] = parseFloat(inp.value) || 0;
      });
      root.querySelectorAll('[data-role="supply"]').forEach(function (inp) {
        state.supply[+inp.dataset.r] = parseFloat(inp.value) || 0;
      });
      root.querySelectorAll('[data-role="demand"]').forEach(function (inp) {
        state.demand[+inp.dataset.c] = parseFloat(inp.value) || 0;
      });
    }

    function bind() {
      root.querySelector('[data-act="example"]').addEventListener('change', function (e) {
        var ex = TRANSPORT_EXAMPLES[e.target.value];
        state.supply = ex.supply.slice(); state.demand = ex.demand.slice(); state.cost = cloneMatrix(ex.cost);
        computeFrames(); render();
      });
      root.querySelector('[data-act="method"]').addEventListener('change', function (e) {
        readEditor(); state.method = e.target.value; computeFrames(); render();
      });
      root.querySelector('[data-act="add-row"]').addEventListener('click', function () {
        readEditor();
        if (state.supply.length >= 5) return;
        state.supply.push(0); state.cost.push(new Array(state.demand.length).fill(0)); render();
      });
      root.querySelector('[data-act="del-row"]').addEventListener('click', function () {
        readEditor();
        if (state.supply.length <= 2) return;
        state.supply.pop(); state.cost.pop(); render();
      });
      root.querySelector('[data-act="add-col"]').addEventListener('click', function () {
        readEditor();
        if (state.demand.length >= 5) return;
        state.demand.push(0); state.cost.forEach(function (r) { r.push(0); }); render();
      });
      root.querySelector('[data-act="del-col"]').addEventListener('click', function () {
        readEditor();
        if (state.demand.length <= 2) return;
        state.demand.pop(); state.cost.forEach(function (r) { r.pop(); }); render();
      });
      root.querySelector('[data-act="balance"]').addEventListener('click', function () {
        readEditor();
        var b = balanceProblem(state.supply, state.demand, state.cost);
        state.supply = b.supply; state.demand = b.demand; state.cost = b.cost;
        render();
      });
      root.querySelector('[data-act="build"]').addEventListener('click', function () {
        readEditor();
        if (sum(state.supply) !== sum(state.demand)) {
          var b2 = balanceProblem(state.supply, state.demand, state.cost);
          state.supply = b2.supply; state.demand = b2.demand; state.cost = b2.cost;
        }
        computeFrames(); render();
      });
      root.querySelector('[data-act="prev"]').addEventListener('click', function () { if (state.idx > 0) { state.idx--; render(); } });
      root.querySelector('[data-act="next"]').addEventListener('click', function () { if (state.idx < state.frames.length - 1) { state.idx++; render(); } });
      root.querySelector('[data-act="solve-all"]').addEventListener('click', function () { state.idx = state.frames.length - 1; render(); });
      root.querySelector('[data-act="reset"]').addEventListener('click', function () { state.idx = 0; render(); });
    }

    render();
  }

  /* ======================================================================
   * 5. Widget «Húngaro paso a paso»
   * ==================================================================== */

  var HUNGARIAN_EXAMPLES = {
    joboco: { label: 'Joboco (3 hijos × 3 tareas)', matrix: [[15, 10, 9], [9, 15, 10], [10, 12, 8]], mode: 'min' },
    book4x4: { label: 'Ejemplo 4×4 (asignación de máquinas)', matrix: [[9, 11, 14, 11], [6, 15, 13, 13], [12, 13, 6, 8], [11, 9, 10, 12]], mode: 'min' },
    maximize: { label: 'Maximización (asignación de vendedores)', matrix: [[9, 11, 14, 11], [6, 15, 13, 13], [12, 13, 6, 8], [11, 9, 10, 12]], mode: 'max' }
  };

  function buildHungarianFrames(matrix, mode) {
    var res = mode === 'max' ? hungarianSolveMax(matrix) : hungarianSolve(matrix);
    var frames = [];
    var N = res.N;
    frames.push({ matrix: matrix, note: mode === 'max' ? 'Matriz de beneficios original. Para maximizar se resta cada valor del máximo (' + res.maxVal + ') y se minimiza la matriz resultante.' : 'Matriz de costos original.' });
    res.steps.forEach(function (st) {
      if (st.phase === 'done') {
        var assignTxt = res.assign.map(function (a) { return '(F' + (a.r + 1) + '→C' + (a.c + 1) + ')'; }).join(', ');
        frames.push({ matrix: st.matrix || frames[frames.length - 1].matrix, matchRow: st.matchRow, note: st.note + ' Asignación: ' + assignTxt + '. ' + (mode === 'max' ? 'Beneficio total = ' + res.profit : 'Costo total = ' + res.cost) + '.', done: true });
      } else {
        frames.push({ matrix: st.matrix, rows: st.rows, cols: st.cols, note: st.note, matchRow: st.matchRow });
      }
    });
    return { frames: frames, result: res };
  }

  function hungarianTableHTML(frame, N) {
    var h = '<div class="canvas-wrap"><table class="tableau data"><thead><tr><th></th>';
    for (var j = 0; j < N; j++) h += '<th class="' + (frame.cols && frame.cols.indexOf(j) >= 0 ? 'pivot-col' : '') + '">C' + (j + 1) + '</th>';
    h += '</tr></thead><tbody>';
    for (var i = 0; i < N; i++) {
      h += '<tr><th class="' + (frame.rows && frame.rows.indexOf(i) >= 0 ? 'pivot-row' : '') + '">F' + (i + 1) + '</th>';
      for (var j2 = 0; j2 < N; j2++) {
        var isZero = frame.matrix[i][j2] === 0;
        var isAssigned = frame.matchRow && frame.matchRow[i] === j2 && frame.done;
        var covered = (frame.rows && frame.rows.indexOf(i) >= 0) || (frame.cols && frame.cols.indexOf(j2) >= 0);
        var cls = [];
        if (isAssigned) cls.push('basic');
        else if (isZero && covered) cls.push('hl');
        else if (isZero) cls.push('pivot-cell');
        h += '<td class="' + cls.join(' ') + '">' + frame.matrix[i][j2] + '</td>';
      }
      h += '</tr>';
    }
    h += '</tbody></table></div>';
    return h;
  }

  function mountHungarianWidget(root) {
    var state = { matrix: cloneMatrix(HUNGARIAN_EXAMPLES.joboco.matrix), mode: 'min', frames: null, idx: 0, result: null };

    function computeFrames() {
      var built = buildHungarianFrames(state.matrix, state.mode);
      state.frames = built.frames; state.result = built.result; state.idx = 0;
    }
    computeFrames();

    function editorHTML() {
      var n = state.matrix.length;
      var h = '<div class="canvas-wrap"><table class="tableau data"><thead><tr><th></th>';
      for (var j = 0; j < n; j++) h += '<th>C' + (j + 1) + '</th>';
      h += '</tr></thead><tbody>';
      for (var i = 0; i < n; i++) {
        h += '<tr><th>F' + (i + 1) + '</th>';
        for (var j2 = 0; j2 < n; j2++) h += '<td><input class="input-grid" type="number" data-r="' + i + '" data-c="' + j2 + '" value="' + state.matrix[i][j2] + '"></td>';
        h += '</tr>';
      }
      h += '</tbody></table></div>';
      return h;
    }

    function render() {
      var frame = state.frames[state.idx];
      var N = state.result.N;
      var html = '' +
        '<div class="row">' +
        '  <label>Ejemplo ' +
        '    <select class="example-picker" data-act="example">' +
        Object.keys(HUNGARIAN_EXAMPLES).map(function (k) { return '<option value="' + k + '">' + esc(HUNGARIAN_EXAMPLES[k].label) + '</option>'; }).join('') +
        '    </select></label>' +
        '  <label>Modo ' +
        '    <select data-act="mode">' +
        '      <option value="min"' + (state.mode === 'min' ? ' selected' : '') + '>Minimizar costo</option>' +
        '      <option value="max"' + (state.mode === 'max' ? ' selected' : '') + '>Maximizar beneficio</option>' +
        '    </select></label>' +
        '  <button class="btn btn-sm" data-act="add">+ tarea/agente</button>' +
        '  <button class="btn btn-sm" data-act="del">− tarea/agente</button>' +
        '  <button class="btn btn-primary btn-sm" data-act="build">Resolver</button>' +
        '</div>' +
        '<p class="muted">Matriz editable (' + state.matrix.length + '×' + state.matrix.length + '; si es rectangular se completa con ceros ficticios hasta cuadrada).</p>' +
        editorHTML() +
        '<div class="step-bar">' +
        '  <button class="btn btn-ghost btn-sm" data-act="prev">◀ Anterior</button>' +
        '  <span class="muted">Paso ' + (state.idx + 1) + ' / ' + state.frames.length + '</span>' +
        '  <button class="btn btn-ghost btn-sm" data-act="next">Siguiente ▶</button>' +
        '  <button class="btn btn-sm" data-act="solve-all">Resolver todo</button>' +
        '  <button class="btn btn-sm" data-act="reset">Reiniciar</button>' +
        '</div>' +
        '<p class="step-text">' + esc(frame.note) + '</p>' +
        hungarianTableHTML(frame, N);
      root.innerHTML = html;
      bind();
    }

    function readEditor() {
      root.querySelectorAll('input[data-r]').forEach(function (inp) {
        state.matrix[+inp.dataset.r][+inp.dataset.c] = parseFloat(inp.value) || 0;
      });
    }

    function bind() {
      root.querySelector('[data-act="example"]').addEventListener('change', function (e) {
        var ex = HUNGARIAN_EXAMPLES[e.target.value];
        state.matrix = cloneMatrix(ex.matrix); state.mode = ex.mode;
        computeFrames(); render();
      });
      root.querySelector('[data-act="mode"]').addEventListener('change', function (e) { readEditor(); state.mode = e.target.value; computeFrames(); render(); });
      root.querySelector('[data-act="add"]').addEventListener('click', function () {
        readEditor();
        if (state.matrix.length >= 5) return;
        state.matrix.forEach(function (r) { r.push(0); });
        state.matrix.push(new Array(state.matrix[0].length).fill(0));
        render();
      });
      root.querySelector('[data-act="del"]').addEventListener('click', function () {
        readEditor();
        if (state.matrix.length <= 2) return;
        state.matrix.pop();
        state.matrix.forEach(function (r) { r.pop(); });
        render();
      });
      root.querySelector('[data-act="build"]').addEventListener('click', function () { readEditor(); computeFrames(); render(); });
      root.querySelector('[data-act="prev"]').addEventListener('click', function () { if (state.idx > 0) { state.idx--; render(); } });
      root.querySelector('[data-act="next"]').addEventListener('click', function () { if (state.idx < state.frames.length - 1) { state.idx++; render(); } });
      root.querySelector('[data-act="solve-all"]').addEventListener('click', function () { state.idx = state.frames.length - 1; render(); });
      root.querySelector('[data-act="reset"]').addEventListener('click', function () { state.idx = 0; render(); });
    }

    render();
  }

  /* ======================================================================
   * 6. Contenido: secciones, ejemplos estáticos, quiz
   * ==================================================================== */

  var CSS = '' +
    '#cap5 .cap5-loop-svg{overflow:visible}' +
    '#cap5 table.tableau td.hl{outline:2px dashed var(--accent)}' +
    '#cap5 table.tableau td.pivot-cell{background:var(--pivot)}' +
    '#cap5 table.data th{white-space:nowrap}' +
    '#cap5 .kv dt{font-weight:600}';

  var s1 = '' +
    '<p>El <b>modelo de transporte</b> es un caso especial de programación lineal donde se busca la forma más ' +
    'económica de enviar un bien desde varias <b>fuentes</b> (plantas, depósitos) hacia varios <b>destinos</b> ' +
    '(centros de distribución, clientes), respetando la <b>oferta</b> disponible en cada fuente y la <b>demanda</b> ' +
    'requerida en cada destino, con un <b>costo unitario de transporte</b> c<sub>ij</sub> por cada ruta (fuente i, destino j).</p>' +
    '<div class="callout callout-def"><b>Definiciones.</b>' +
    '<ul><li><b>Fuente</b>: origen con oferta a<sub>i</sub> unidades disponibles.</li>' +
    '<li><b>Destino</b>: punto con demanda b<sub>j</sub> unidades requeridas.</li>' +
    '<li><b>Modelo balanceado</b>: Σa<sub>i</sub> = Σb<sub>j</sub>. Si no lo es, se agrega una <b>fuente ficticia</b> ' +
    '(si Σa<sub>i</sub> &lt; Σb<sub>j</sub>) o un <b>destino ficticio</b> (si Σa<sub>i</sub> &gt; Σb<sub>j</sub>) con costo 0, ' +
    'que absorbe la diferencia sin costo real (representa oferta no usada o demanda no satisfecha).</li></ul></div>' +
    '<p><b>Ejemplo resuelto — MG Auto.</b> Tres plantas (LA: 1000, Detroit: 1500, Nueva Orleans: 1200) abastecen dos ' +
    'centros de distribución (Denver: 2300, Miami: 1400). Costos por unidad:</p>' +
    '<table class="data"><thead><tr><th></th><th>Denver</th><th>Miami</th><th>Oferta</th></tr></thead><tbody>' +
    '<tr><th>LA</th><td>80</td><td>215</td><td>1000</td></tr>' +
    '<tr><th>Detroit</th><td>100</td><td>108</td><td>1500</td></tr>' +
    '<tr><th>Nueva Orleans</th><td>102</td><td>68</td><td>1200</td></tr>' +
    '<tr><th>Demanda</th><td>2300</td><td>1400</td><td>3700</td></tr></tbody></table>' +
    '<p>Está balanceado (3700 = 3700). La solución óptima envía LA→Denver 1000, Detroit→Denver 1300, Detroit→Miami 200, ' +
    'Nueva Orleans→Miami 1200, con <b>costo óptimo = 313 200</b>. Verifíquelo con el widget «Transporte paso a paso» ' +
    '(ejemplo «MG Auto»).</p>' +
    '<p><b>Caso desbalanceado — destino ficticio.</b> Si la demanda de Denver baja a 2000 unidades, la oferta total ' +
    '(3700) supera a la demanda (3400): se agrega un <b>destino ficticio</b> con demanda 300 y costo 0 (representa ' +
    'capacidad de planta que queda sin usar). La solución óptima de este caso da costo = 283 200 (envío real; el resto ' +
    'es oferta ficticia sin costo). Ejemplo precargado en el widget: «MG Auto (desbalanceado, destino ficticio)».</p>' +
    '<div class="exercise"><p><b>Ejercicio.</b> Si en MG Auto la planta de Detroit redujera su capacidad a 1300 unidades ' +
    '(oferta total 3500 &lt; demanda 3700), ¿qué tipo de elemento ficticio hay que agregar y de qué tamaño?</p>' +
    '<details class="solution"><summary>Ver solución</summary><p>Se agrega una <b>fuente ficticia</b> con oferta ' +
    '3700 − 3500 = 200 unidades y costo 0 en todas sus rutas, representando demanda que no se puede cubrir con la ' +
    'capacidad real.</p></details></div>';

  var s2 = '' +
    '<p>Muchos problemas que no parecen de transporte a primera vista se pueden <b>modelar como tales</b>, ' +
    'reinterpretando fuentes, destinos y costos.</p>' +
    '<div class="callout callout-def"><b>Producción–inventario como transporte.</b> Cada <b>período de producción</b> ' +
    'se modela como una <b>fuente</b> (con oferta = capacidad de producción de ese período, a costo de producción + ' +
    'almacenamiento) y cada <b>período de demanda</b> como un <b>destino</b>. El costo c<sub>ij</sub> de producir en el ' +
    'período i para satisfacer demanda en el período j incluye el costo unitario de producción más el costo de ' +
    'almacenamiento por cada período que la unidad espera (si j &gt; i). Producir "hacia atrás" (satisfacer demanda de un ' +
    'período con producción de uno posterior) no es factible: se penaliza con un costo M muy grande (o se bloquea la ruta).</p></div>' +
    '<div class="callout callout-def"><b>Modelo de recolección de herramientas (rutas cíclicas).</b> El libro plantea un ' +
    'ejemplo de máquinas que deben visitar estaciones para recoger herramientas: cada estación de recolección ' +
    'programada se modela como fuente y cada estación de entrega como destino, con el costo de traslado como ' +
    'costo de transporte; el objetivo (minimizar el recorrido total) se resuelve igual que un transporte clásico ' +
    'una vez identificadas las fuentes/destinos y sus disponibilidades.</p></div>' +
    '<p>En ambos casos la clave del modelado es identificar qué juega el papel de «fuente con oferta limitada» y qué ' +
    'juega el papel de «destino con demanda fija», y traducir la estructura de costos (producción, almacenamiento, ' +
    'traslado) en la matriz de costos c<sub>ij</sub> del transporte.</p>' +
    '<div class="exercise"><p><b>Ejercicio.</b> En el modelo de producción–inventario, ¿por qué la ruta que produce en ' +
    'el período 3 para satisfacer demanda del período 1 debe bloquearse o penalizarse con M?</p>' +
    '<details class="solution"><summary>Ver solución</summary><p>Porque implicaría producir en el futuro para ' +
    'satisfacer una demanda que ya ocurrió en el pasado (no se puede almacenar hacia atrás en el tiempo); el modelo ' +
    'de transporte no distingue el orden temporal por sí solo, así que hay que impedir esa ruta explícitamente.</p></details></div>';

  var s3 = '' +
    '<p>El <b>algoritmo de transporte</b> tiene dos fases: (1) hallar una <b>solución básica factible inicial</b> ' +
    '(con m+n−1 celdas básicas, m fuentes y n destinos), y (2) mejorarla iterativamente hasta el óptimo con el ' +
    '<b>método de multiplicadores (MODI)</b>.</p>' +
    '<div class="callout callout-def"><b>Métodos de inicio.</b>' +
    '<ul><li><b>Esquina noroeste (NW)</b>: asigna lo máximo posible en la celda superior izquierda disponible, avanza ' +
    'fila o columna según cuál se agote. Simple pero ignora costos (peor punto de partida en general).</li>' +
    '<li><b>Costo mínimo</b>: en cada paso asigna en la celda de menor costo disponible entre filas/columnas activas.</li>' +
    '<li><b>Vogel (VAM)</b>: para cada fila y columna activa calcula una <b>penalización</b> = diferencia entre los dos ' +
    'costos más bajos disponibles; se elige la fila/columna de mayor penalización y, dentro de ella, la celda de costo ' +
    'mínimo. Suele dar el mejor punto de partida.</li></ul></div>' +
    '<div class="callout callout-def"><b>Método de multiplicadores (MODI).</b> Se calculan u<sub>i</sub>, v<sub>j</sub> ' +
    'tales que u<sub>i</sub> + v<sub>j</sub> = c<sub>ij</sub> en toda celda básica (fijando u<sub>1</sub> = 0). Para cada ' +
    'celda no básica se evalúa u<sub>i</sub> + v<sub>j</sub> − c<sub>ij</sub>: si alguna es positiva, la solución no es ' +
    'óptima y entra la de valor más positivo. Se traza el <b>ciclo cerrado</b> (rectángulo de celdas básicas + la ' +
    'entrante, alternando signos + y − empezando en +), y θ = mínimo de las celdas «−» del ciclo. Se suma θ en las ' +
    '«+» y se resta en las «−»; la celda «−» que llega a 0 sale de la base.</div>' +
    '<div class="callout callout-warn"><b>Degeneración.</b> Si el número de celdas básicas es menor a m+n−1 (dos o más ' +
    'celdas se saturan a la vez durante el inicio), no se pueden calcular todos los u<sub>i</sub>, v<sub>j</sub>. Se ' +
    'agrega una asignación de valor 0 en una celda no básica que no cierre un ciclo con las básicas existentes, para ' +
    'completar m+n−1 celdas «básicas» (aunque una valga 0).</div>' +
    '<p><b>Ejemplo resuelto — SunRay Transport.</b> Oferta (15, 25, 10), demanda (5, 15, 15, 15), costos:</p>' +
    '<table class="data"><thead><tr><th></th><th>D1</th><th>D2</th><th>D3</th><th>D4</th><th>Oferta</th></tr></thead><tbody>' +
    '<tr><th>F1</th><td>10</td><td>2</td><td>20</td><td>11</td><td>15</td></tr>' +
    '<tr><th>F2</th><td>12</td><td>7</td><td>9</td><td>20</td><td>25</td></tr>' +
    '<tr><th>F3</th><td>4</td><td>14</td><td>16</td><td>18</td><td>10</td></tr>' +
    '<tr><th>Demanda</th><td>5</td><td>15</td><td>15</td><td>15</td><td>50</td></tr></tbody></table>' +
    '<p>Costo de inicio con esquina noroeste = <b>520</b>; con costo mínimo = <b>475</b>; con Vogel = <b>475</b>. ' +
    'Aplicando MODI hasta el óptimo desde cualquiera de los tres, se llega al <b>costo óptimo = 435</b>. ' +
    'Pruébelo en el widget «Transporte paso a paso» con los tres métodos y compare cuántas iteraciones de MODI ' +
    'hace falta desde cada uno.</p>' +
    '<div class="widget wide" data-widget="cap5-transport"></div>' +
    '<p class="muted">5.3.3 — Los multiplicadores u<sub>i</sub>, v<sub>j</sub> son exactamente las variables duales del ' +
    'problema de transporte visto como programa lineal (una restricción de igualdad por fuente y por destino); el ' +
    'valor u<sub>i</sub> + v<sub>j</sub> − c<sub>ij</sub> es el costo reducido de la ruta (i, j), igual que en el simplex.</p>' +
    '<div class="exercise"><p><b>Ejercicio.</b> ¿Por qué el método de la esquina noroeste casi siempre necesita más ' +
    'iteraciones de MODI que Vogel para llegar al óptimo?</p>' +
    '<details class="solution"><summary>Ver solución</summary><p>Porque NW no mira los costos al asignar: solo llena ' +
    'celdas según oferta/demanda disponible, así que el punto de partida suele estar lejos del óptimo. Vogel usa las ' +
    'penalizaciones (diferencias de costo) para evitar las asignaciones más caras desde el inicio.</p></details></div>';

  var s4 = '' +
    '<p>El <b>modelo de asignación</b> es un caso particular del transporte donde todas las ofertas y demandas valen 1 ' +
    '(n agentes, n tareas, cada agente hace exactamente una tarea). Se resuelve de forma más simple con el ' +
    '<b>método húngaro</b>, sin usar MODI.</p>' +
    '<div class="callout callout-def"><b>Método húngaro (minimización).</b>' +
    '<ol><li>Restar el mínimo de cada fila.</li><li>Restar el mínimo de cada columna.</li>' +
    '<li>Cubrir todos los ceros con el número mínimo de líneas horizontales/verticales.</li>' +
    '<li>Si el número de líneas &lt; n: tomar el menor valor no cubierto, restarlo de todas las celdas no cubiertas y ' +
    'sumarlo en las celdas cubiertas por dos líneas; volver al paso 3.</li>' +
    '<li>Cuando las líneas = n, hay una asignación de costo 0 en cada fila/columna: esa es la asignación óptima.</li></ol>' +
    'Para <b>maximizar</b>, se resta cada valor de la matriz del valor máximo de toda la matriz y se resuelve como ' +
    'minimización sobre esa matriz transformada.</div>' +
    '<p><b>Ejemplo resuelto — Joboco.</b> Tres hijos y tres tareas, costo (tiempo) de cada asignación:</p>' +
    '<table class="data"><thead><tr><th></th><th>Tarea 1</th><th>Tarea 2</th><th>Tarea 3</th></tr></thead><tbody>' +
    '<tr><th>Hijo 1</th><td>15</td><td>10</td><td>9</td></tr>' +
    '<tr><th>Hijo 2</th><td>9</td><td>15</td><td>10</td></tr>' +
    '<tr><th>Hijo 3</th><td>10</td><td>12</td><td>8</td></tr></tbody></table>' +
    '<p>Asignación óptima: Hijo 1→Tarea 2, Hijo 2→Tarea 1, Hijo 3→Tarea 3, con <b>costo óptimo = 27</b>.</p>' +
    '<div class="widget wide" data-widget="cap5-hungarian"></div>' +
    '<p class="muted">5.4.2 — El método húngaro es equivalente a resolver el transporte con todas las ofertas y ' +
    'demandas iguales a 1 mediante simplex, aprovechando que la solución siempre es entera (0 o 1) por la estructura ' +
    'especial de la matriz de restricciones (totalmente unimodular).</p>' +
    '<div class="exercise"><p><b>Ejercicio.</b> ¿Qué se hace si el problema de asignación es de <b>maximizar</b> ' +
    'beneficios y la matriz no es cuadrada (más agentes que tareas)?</p>' +
    '<details class="solution"><summary>Ver solución</summary><p>Primero se agregan filas o columnas ficticias con ' +
    'beneficio 0 hasta volverla cuadrada (igual que en transporte), y luego se resta cada valor del máximo de la ' +
    'matriz para convertir la maximización en una minimización antes de aplicar el método húngaro.</p></details></div>';

  var CALLOUT_EXAM = '<div class="callout callout-exam"><b>Lo que suele tomar el parcial (Cap 5)</b>' +
    '<ul><li>Reconocer cuándo un problema está desbalanceado y si hace falta fuente o destino ficticio (y de qué tamaño).</li>' +
    '<li>Ejecutar a mano esquina noroeste, costo mínimo y Vogel, y comparar sus costos de inicio.</li>' +
    '<li>Calcular u<sub>i</sub>, v<sub>j</sub> (con u<sub>1</sub>=0) y las evaluaciones de las celdas no básicas.</li>' +
    '<li>Trazar el ciclo cerrado correcto y calcular θ sin errores de signo.</li>' +
    '<li>Detectar y resolver degeneración (asignar 0 sin cerrar ciclo).</li>' +
    '<li>Aplicar el método húngaro completo: reducción de filas/columnas, cobertura mínima de ceros, ajuste, asignación final.</li>' +
    '<li>Convertir un problema de maximización a minimización antes de aplicar el método húngaro.</li></ul></div>';

  var QUIZ = [
    { q: '¿Cuándo se agrega una fuente ficticia en el modelo de transporte?', options: ['Cuando la oferta total supera a la demanda total', 'Cuando la demanda total supera a la oferta total', 'Siempre, para simplificar el cálculo', 'Solo si hay costos negativos'], answer: 1, explain: 'Si Σb_j > Σa_i falta oferta real, así que se agrega una fuente ficticia con la diferencia y costo 0.' },
    { q: '¿Cuándo se agrega un destino ficticio?', options: ['Cuando la oferta total supera a la demanda total', 'Cuando la demanda total supera a la oferta total', 'Nunca, solo existen fuentes ficticias', 'Cuando hay degeneración'], answer: 0, explain: 'Si Σa_i > Σb_j sobra oferta, así que se agrega un destino ficticio que la absorbe sin costo.' },
    { q: 'En SunRay Transport, ¿cuál es el costo de la solución inicial por esquina noroeste?', type: 'number', answer: 520, tol: 0.01, explain: 'La esquina noroeste da un costo inicial de 520 para SunRay, muy por encima del óptimo (435).' },
    { q: 'En SunRay Transport, ¿cuál es el costo óptimo final tras aplicar MODI?', type: 'number', answer: 435, tol: 0.01, explain: 'Partiendo de cualquier solución básica factible inicial, MODI converge al óptimo de 435.' },
    { q: 'En el método de Vogel, la penalización de una fila o columna es…', options: ['El costo más alto disponible en esa línea', 'La diferencia entre los dos costos más bajos disponibles en esa línea', 'La suma de todos los costos de esa línea', 'El promedio de los costos de esa línea'], answer: 1, explain: 'La penalización mide cuánto «cuesta» no usar la ruta más barata de esa fila o columna.' },
    { q: 'En MODI, ¿qué condición indica que la solución todavía NO es óptima (minimizando)?', options: ['Todas las evaluaciones u_i+v_j−c_ij son ≤ 0', 'Alguna evaluación u_i+v_j−c_ij es > 0', 'El número de celdas básicas es m+n−1', 'θ es igual a 0'], answer: 1, explain: 'Una evaluación positiva indica que meter esa ruta en la base reduciría el costo total.' },
    { q: 'En el ciclo cerrado de MODI, ¿qué signo recibe la celda entrante?', options: ['Negativo (−)', 'Positivo (+)', 'Depende del signo de su evaluación', 'No participa del ciclo'], answer: 1, explain: 'La celda entrante siempre arranca el ciclo con signo +, y los signos se alternan +,−,+,− a lo largo del ciclo.' },
    { q: '¿Cómo se calcula θ en el ciclo cerrado de MODI?', options: ['El máximo de las celdas con signo +', 'El mínimo de las celdas con signo −', 'La suma de todas las celdas del ciclo', 'El costo de la celda entrante'], answer: 1, explain: 'θ es el mínimo entre las celdas marcadas con «−», porque ese es el máximo que se puede transferir sin volverse negativo.' },
    { q: '¿Qué indica la degeneración en el modelo de transporte?', options: ['Que hay más de una solución óptima', 'Que el número de celdas básicas es menor que m+n−1', 'Que el problema no tiene solución factible', 'Que el problema está desbalanceado'], answer: 1, explain: 'La degeneración ocurre cuando faltan celdas básicas para poder calcular todos los multiplicadores u_i, v_j.' },
    { q: 'En el modelo de asignación de Joboco, ¿cuál es el costo óptimo?', type: 'number', answer: 27, tol: 0.01, explain: 'La asignación Hijo1→Tarea2, Hijo2→Tarea1, Hijo3→Tarea3 da costo 10+9+8 = 27.' },
    { q: 'En el método húngaro, ¿qué se hace si el número de líneas que cubren los ceros es menor que n?', options: ['Se declara que no hay solución', 'Se resta el menor valor no cubierto de las celdas no cubiertas y se suma en las intersecciones cubiertas dos veces', 'Se vuelve a restar el mínimo de cada fila desde cero', 'Se agregan filas y columnas ficticias'], answer: 1, explain: 'Ese ajuste genera nuevos ceros sin perder los que ya estaban cubiertos, permitiendo aumentar la cobertura en la siguiente ronda.' },
    { q: 'Para resolver un problema de asignación de MAXIMIZACIÓN con el método húngaro, primero hay que…', options: ['Multiplicar toda la matriz por −1', 'Restar cada valor del máximo de la matriz para obtener una matriz de costos equivalente', 'Aplicar el método directamente sobre los beneficios', 'Sumar el mínimo de cada fila'], answer: 1, explain: 'Restar del máximo convierte "maximizar beneficio" en "minimizar costo equivalente", que es lo que resuelve el algoritmo húngaro.' }
  ];

  /* ======================================================================
   * 7. Registro del capítulo
   * ==================================================================== */

  IO.registerChapter({
    id: 'cap5',
    num: 5,
    title: 'Modelo de transporte y sus variantes',
    summary: 'Transporte (esquina noroeste, costo mínimo, Vogel, MODI) y asignación (método húngaro), con sus aplicaciones no tradicionales.',
    css: CSS,
    sections: [
      { id: 'cap5-s1', title: '5.1 Definición del modelo de transporte', html: s1 },
      { id: 'cap5-s2', title: '5.2 Modelos de transporte no tradicionales', html: s2 },
      { id: 'cap5-s3', title: '5.3 Algoritmo de transporte (inicio + MODI)', html: s3 },
      { id: 'cap5-s4', title: '5.4 Modelo de asignación (método húngaro)', html: s4 + CALLOUT_EXAM }
    ],
    mount: function (root) {
      root.querySelectorAll('[data-widget="cap5-transport"]').forEach(mountTransportWidget);
      root.querySelectorAll('[data-widget="cap5-hungarian"]').forEach(mountHungarianWidget);
    },
    quiz: QUIZ
  });

  /* Hook interno de verificación numérica (no forma parte del contrato público). */
  IO.__cap5 = {
    nwCorner: nwCorner, leastCost: leastCost, vogel: vogel, balanceProblem: balanceProblem,
    modiSolve: modiSolve, totalCost: totalCost, hungarianSolve: hungarianSolve, hungarianSolveMax: hungarianSolveMax
  };
})();
