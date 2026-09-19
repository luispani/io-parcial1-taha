/* IO.Simplex — exact-arithmetic simplex engine (tableau method, Taha 9a ed.)
 * Global: IO.Simplex = { parse, solve, sensitivity, toHTML }
 * Depends on global Frac (js/lib/frac.js). No ES modules, no external deps.
 *
 * Internal representation:
 *  - Constraint-row coefficients are plain Frac (m x (numVars+1), last col = RHS).
 *  - The "z-row" (reduced-cost row, in the canonical form  z - sum c_j x_j (+/- M R) = 0)
 *    is a row of "Num" pairs {c: Frac, m: Frac} representing  c + m*M .
 *    Only artificial-variable bookkeeping ever introduces a nonzero m part;
 *    constraint rows never carry an M term, which keeps pivoting simple:
 *    row/row operations are plain Frac, and the z-row is updated with
 *    Num = Num - Num*Frac operations.
 */
(function (global) {
  'use strict';
  var F = global.Frac;

  // ---------- Num (c + m*M) helpers ----------
  function N(c, m) { return { c: F.from(c), m: F.from(m === undefined ? 0 : m) }; }
  function nAdd(a, b) { return N(a.c.add(b.c), a.m.add(b.m)); }
  function nSub(a, b) { return N(a.c.sub(b.c), a.m.sub(b.m)); }
  function nNeg(a) { return N(a.c.neg(), a.m.neg()); }
  function nMulF(a, f) { f = F.from(f); return N(a.c.mul(f), a.m.mul(f)); }
  function nCmp(a, b) { var mc = a.m.cmp(b.m); if (mc !== 0) return mc; return a.c.cmp(b.c); }
  function nIsZero(a) { return a.c.isZero() && a.m.isZero(); }
  var NZERO = N(0, 0);
  function nToHTML(num) {
    var hasM = !num.m.isZero();
    if (!hasM) return num.c.toHTML();
    var parts = [];
    if (!num.c.isZero()) parts.push(num.c.toHTML());
    var mAbs = num.m.abs();
    var mStr = (mAbs.d === 1 && mAbs.n === 1) ? 'M' : (mAbs.toHTML() + 'M');
    if (parts.length === 0) {
      parts.push((num.m.isNeg() ? '−' : '') + mStr);
    } else {
      parts.push(num.m.isNeg() ? '−' : '+', mStr);
    }
    return parts.join(' ');
  }

  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }

  // ---------- parse ----------
  function parse(spec) {
    var type = spec.type === 'min' ? 'min' : 'max';
    var n = spec.c.length;
    var baseNames = (spec.varNames && spec.varNames.length === n) ? spec.varNames.slice() : range(n).map(function (i) { return 'x' + (i + 1); });
    var signs = spec.signs || null; // array length n: 'pos' | 'free' | 'neg'

    var colNames = [];
    var colCost = [];
    var colOrigIndex = [];
    var freeMap = {}; // origIndex -> {pos, neg}
    for (var i = 0; i < n; i++) {
      var sgn = signs ? (signs[i] || 'pos') : 'pos';
      var ci = F.from(spec.c[i]);
      if (sgn === 'free') {
        var p = colNames.length; colNames.push(baseNames[i] + '⁺'); colCost.push(ci); colOrigIndex.push(i);
        var q = colNames.length; colNames.push(baseNames[i] + '⁻'); colCost.push(ci.neg()); colOrigIndex.push(i);
        freeMap[i] = { pos: p, neg: q };
      } else if (sgn === 'neg') {
        var idxN = colNames.length; colNames.push(baseNames[i]); colCost.push(ci.neg()); colOrigIndex.push(i);
        freeMap[i] = { neg: idxN };
      } else {
        var idxP = colNames.length; colNames.push(baseNames[i]); colCost.push(ci); colOrigIndex.push(i);
        freeMap[i] = { pos: idxP };
      }
    }
    var nDecision = colNames.length;
    var m = spec.constraints.length;

    var baseRows = [];
    for (var r = 0; r < m; r++) {
      var con = spec.constraints[r];
      var row = new Array(nDecision);
      for (var k = 0; k < nDecision; k++) row[k] = F.ZERO;
      for (i = 0; i < n; i++) {
        var a = F.from(con.a[i] || 0);
        if (a.isZero()) continue;
        var map = freeMap[i];
        if (map.pos !== undefined) row[map.pos] = row[map.pos].add(a);
        if (map.neg !== undefined) row[map.neg] = row[map.neg].add(a.neg());
      }
      var b = F.from(con.b);
      var op = con.op;
      if (b.isNeg()) {
        row = row.map(function (x) { return x.neg(); });
        b = b.neg();
        if (op === '<=') op = '>='; else if (op === '>=') op = '<=';
      }
      baseRows.push({ row: row, b: b, op: op });
    }

    // Determine extra columns per row, appended after all decision columns.
    var extraInfo = [];
    var colIdx = nDecision;
    for (r = 0; r < m; r++) {
      var op2 = baseRows[r].op;
      var info = {};
      if (op2 === '<=') {
        info.slack = colIdx; colNames.push('s' + (r + 1)); colCost.push(F.ZERO); colIdx++;
      } else if (op2 === '>=') {
        info.surplus = colIdx; colNames.push('e' + (r + 1)); colCost.push(F.ZERO); colIdx++;
        info.art = colIdx; colNames.push('R' + (r + 1)); colCost.push(F.ZERO); colIdx++;
      } else { // '='
        info.art = colIdx; colNames.push('R' + (r + 1)); colCost.push(F.ZERO); colIdx++;
      }
      extraInfo.push(info);
    }
    var totalCols = colIdx;
    var rows = [];
    var bArr = [];
    var basisInit = [];
    var artificialCols = [];
    for (r = 0; r < m; r++) {
      var full = new Array(totalCols);
      for (k = 0; k < totalCols; k++) full[k] = F.ZERO;
      for (k = 0; k < nDecision; k++) full[k] = baseRows[r].row[k];
      var info2 = extraInfo[r];
      if (info2.slack !== undefined) { full[info2.slack] = F.ONE; basisInit.push(info2.slack); }
      if (info2.surplus !== undefined) full[info2.surplus] = F.ONE.neg();
      if (info2.art !== undefined) {
        full[info2.art] = F.ONE;
        artificialCols.push(info2.art);
        if (info2.slack === undefined) basisInit.push(info2.art);
      }
      rows.push(full);
      bArr.push(baseRows[r].b);
    }
    var cRowFull = new Array(totalCols);
    for (k = 0; k < totalCols; k++) cRowFull[k] = k < nDecision ? colCost[k] : F.ZERO;

    return {
      type: type,
      varNames: colNames,
      numVars: totalCols,
      nDecision: nDecision,
      colOrigIndex: colOrigIndex,
      freeMap: freeMap,
      cRow: cRowFull,
      rows: rows,
      b: bArr,
      basisInit: basisInit,
      artificialCols: artificialCols,
      hasArtificial: artificialCols.length > 0,
      m: m
    };
  }

  // ---------- generic tableau engine ----------
  function cloneRows(rows) { return rows.map(function (row) { return row.slice(); }); }

  // Direct z-row (reduced cost row, Zj - Cj convention): Zj = cB . column_j, z-row = Zj - Cj.
  // Optimality: max -> all >= 0 (enter most negative); min -> all <= 0 (enter most positive).
  // Recomputed from scratch every time (rows/b/basis/costFull) instead of tracked incrementally,
  // which keeps the Big-M / two-phase bookkeeping free of sign-accumulation bugs.
  function computeZRow(rows, b, basis, costFull) {
    var n = costFull.length, m = rows.length;
    var cB = basis.map(function (col) { return costFull[col]; });
    var z = new Array(n);
    for (var j = 0; j < n; j++) {
      var acc = NZERO;
      for (var i = 0; i < m; i++) acc = nAdd(acc, nMulF(cB[i], rows[i][j]));
      z[j] = nSub(acc, costFull[j]);
    }
    var z0 = NZERO;
    for (i = 0; i < m; i++) z0 = nAdd(z0, nMulF(cB[i], b[i]));
    return { z: z, zRHS: z0 };
  }

  function fmtFrac(f) { return f.toHTML(); }

  function noteEnter(varNames, col, val, type, ruleUsed) {
    if (ruleUsed === 'bland') {
      return 'Regla de Bland (anticiclado): entra ' + varNames[col] + ' por ser la de menor índice con coeficiente ' +
        (type === 'max' ? 'negativo' : 'positivo') + ' en la fila z que todavía permite mejorar ' +
        (type === 'max' ? 'el máximo' : 'el mínimo') + ' (coeficiente ' + val + '). Se activa para evitar que el método cicle.';
    }
    return 'Entra ' + varNames[col] + ' (regla de Dantzig: el coeficiente ' +
      (type === 'max' ? 'más negativo' : 'más positivo') + ' en la fila z; coeficiente ' + val + ').';
  }

  // Entering-column selection strategies.
  // Dantzig: the coefficient with the strongest improvement (most negative in
  // max, most positive in min); ties keep the lowest column index. This is
  // the rule used by Taha's textbook and in class, so the tableau sequence
  // matches what students see there — but it can cycle on degenerate models.
  function pickEnterDantzig(z, n, enterMask, type) {
    var bestCol = -1, bestVal = null;
    for (var j = 0; j < n; j++) {
      if (!enterMask[j]) continue;
      var val = z[j];
      var improves = type === 'max'
        ? (val.m.isNeg() || (val.m.isZero() && val.c.isNeg()))
        : (val.m.isPos() || (val.m.isZero() && val.c.isPos()));
      if (!improves) continue;
      if (bestCol === -1) { bestCol = j; bestVal = val; continue; }
      var cmp = nCmp(val, bestVal);
      var better = type === 'max' ? cmp < 0 : cmp > 0;
      if (better) { bestCol = j; bestVal = val; }
    }
    return bestCol === -1 ? null : { col: bestCol, val: bestVal };
  }

  // Bland: the smallest-index variable whose reduced cost still improves the
  // objective. Proven to terminate in finitely many iterations and never
  // cycles (see MEJORAS-PENDIENTES.md §2.2). Used as the anti-cycling
  // fallback for the 'auto' rule, or directly when the caller asks for it.
  function pickEnterBland(z, n, enterMask, type) {
    for (var j = 0; j < n; j++) {
      if (!enterMask[j]) continue;
      var val = z[j];
      var improves = type === 'max'
        ? (val.m.isNeg() || (val.m.isZero() && val.c.isNeg()))
        : (val.m.isPos() || (val.m.isZero() && val.c.isPos()));
      if (improves) return { col: j, val: val };
    }
    return null;
  }

  function runPhase(ctx) {
    // ctx: {rows, b, basis, costFull, type, varNames, enterMask, artificialSet, maxIter, rule}
    var rows = ctx.rows, b = ctx.b, basis = ctx.basis.slice(), costFull = ctx.costFull;
    var varNames = ctx.varNames, type = ctx.type, enterMask = ctx.enterMask;
    var m = rows.length, n = varNames.length;
    var rule = ctx.rule || 'auto';
    // 'auto' anti-cycling: start with Dantzig (matches the textbook/class
    // tableau sequence) and switch permanently to Bland the first time a
    // cycling risk is detected — a degenerate pivot (minimum ratio = 0) or
    // the objective failing to strictly improve versus the previous
    // iteration. We deliberately never switch back to Dantzig once Bland has
    // kicked in: staying in Bland is the simplest deterministic choice and
    // Bland's rule guarantees termination on its own from that point on.
    var autoState = 'dantzig';
    var prevZRHS = null;
    var iterations = [];
    var status = 'optimal';
    var flags = { degenerate: false, alternative: false };
    var maxIter = ctx.maxIter || 200;
    var z, zRHS;
    var reachedEnd = false;

    for (var iter = 0; iter < maxIter; iter++) {
      var zr = computeZRow(rows, b, basis, costFull);
      z = zr.z; zRHS = zr.zRHS;

      if (rule === 'auto') {
        if (prevZRHS !== null && autoState === 'dantzig') {
          var improvedNow = type === 'max' ? nCmp(zRHS, prevZRHS) > 0 : nCmp(zRHS, prevZRHS) < 0;
          if (!improvedNow) autoState = 'bland';
        }
        prevZRHS = zRHS;
      }
      var effectiveRule = rule === 'auto' ? autoState : rule;

      var picked = effectiveRule === 'bland'
        ? pickEnterBland(z, n, enterMask, type)
        : pickEnterDantzig(z, n, enterMask, type);
      var enterCol = picked ? picked.col : -1;
      var best = picked ? picked.val : null;

      if (enterCol === -1) {
        // optimal: check alternative optima (nonbasic decision var with reduced cost exactly 0)
        for (var j = 0; j < n; j++) {
          if (basis.indexOf(j) !== -1) continue;
          if (ctx.artificialSet && ctx.artificialSet[j]) continue;
          if (nIsZero(z[j])) { flags.alternative = true; break; }
        }
        var snap = snapshot(rows, b, basis, z, zRHS, varNames, null, null, null, 'Solución óptima alcanzada: ninguna variable no básica mejora ' + (type === 'max' ? 'el máximo' : 'el mínimo') + '.');
        iterations.push(snap);
        reachedEnd = true;
        break;
      }

      // ratio test
      var ratios = []; var leaveRow = -1; var minRatio = null;
      for (var i = 0; i < m; i++) {
        var a = rows[i][enterCol];
        if (a.isPos()) {
          var ratio = b[i].div(a);
          ratios.push({ row: i, value: ratio, isMin: false });
          if (minRatio === null || ratio.cmp(minRatio) < 0) { minRatio = ratio; leaveRow = i; }
        } else {
          ratios.push({ row: i, value: null, isMin: false });
        }
      }
      if (leaveRow === -1) {
        var snapU = snapshot(rows, b, basis, z, zRHS, varNames, enterCol, null, ratios,
          'La columna de ' + varNames[enterCol] + ' entra pero no tiene coeficientes positivos: el problema no está acotado.');
        iterations.push(snapU);
        status = 'unbounded';
        return { iterations: iterations, status: status, flags: flags, rows: rows, b: b, basis: basis, z: z, zRHS: zRHS };
      }
      // mark ties (degenerate)
      var tieCount = 0;
      ratios.forEach(function (rr) { if (rr.value !== null && rr.value.eq(minRatio)) { rr.isMin = true; tieCount++; } });
      if (tieCount > 1) flags.degenerate = true;
      // tie-break: smallest current basis variable index leaves first (Bland's rule, avoids cycling)
      if (tieCount > 1) {
        var candidates = ratios.filter(function (rr) { return rr.isMin; }).map(function (rr) { return rr.row; });
        candidates.sort(function (x, y) { return basis[x] - basis[y]; });
        leaveRow = candidates[0];
      }
      if (b[leaveRow].isZero()) {
        flags.degenerate = true;
        if (rule === 'auto') autoState = 'bland';
      }

      var ratioText = ratios.map(function (rr) {
        var name = varNames[basis[rr.row]];
        return name + ': ' + (rr.value === null ? '—' : ('(' + b[rr.row].toString() + ')/(' + rows[rr.row][enterCol].toString() + ') = ' + rr.value.toString()));
      }).join('; ');
      var note = noteEnter(varNames, enterCol, fmtFrac(best.c) + (best.m.isZero() ? '' : (best.m.isNeg() ? ' − ' + best.m.abs().toString() + 'M' : ' + ' + best.m.toString() + 'M')), type, effectiveRule) +
        ' Cocientes: ' + ratioText + '. Sale ' + varNames[basis[leaveRow]] + '.';

      var snap2 = snapshot(rows, b, basis, z, zRHS, varNames, enterCol, leaveRow, ratios, note);
      iterations.push(snap2);

      // pivot
      var pivotVal = rows[leaveRow][enterCol];
      rows[leaveRow] = rows[leaveRow].map(function (x) { return x.div(pivotVal); });
      b[leaveRow] = b[leaveRow].div(pivotVal);
      for (i = 0; i < m; i++) {
        if (i === leaveRow) continue;
        var factor = rows[i][enterCol];
        if (factor.isZero()) continue;
        rows[i] = rows[i].map(function (x, jj) { return x.sub(factor.mul(rows[leaveRow][jj])); });
        b[i] = b[i].sub(factor.mul(b[leaveRow]));
      }
      basis[leaveRow] = enterCol;
    }
    if (!reachedEnd) {
      status = 'iteration_limit';
      var snapL = snapshot(rows, b, basis, z, zRHS, varNames, null, null, null,
        'Se alcanzó el límite de ' + maxIter + ' iteraciones sin llegar a la solución óptima: el resultado no debe presentarse como óptimo.');
      iterations.push(snapL);
    }
    return { iterations: iterations, status: status, flags: flags, rows: rows, b: b, basis: basis, z: z, zRHS: zRHS };
  }

  // Phase I -> Phase II transition: drive artificial variables that remain
  // basic at value 0 (degenerate) out of the basis using any non-artificial
  // column with a nonzero coefficient in their row (the pivot is always safe
  // because the row's RHS is 0, so no other row's feasibility is disturbed).
  // If no such column exists, the row represents a redundant constraint and
  // is removed. Without this step a basic-but-meaningless artificial column
  // can make the ratio test see a spurious "constraint" and report a bounded
  // problem as unbounded (see MEJORAS-PENDIENTES.md §2.1).
  function driveOutArtificials(rows, b, basis, artificialSet, varNames) {
    var notes = [];
    var rowsToRemove = [];
    for (var r = 0; r < basis.length; r++) {
      if (!artificialSet[basis[r]]) continue;
      var pivotCol = -1;
      for (var k = 0; k < rows[r].length; k++) {
        if (artificialSet[k]) continue;
        if (!rows[r][k].isZero()) { pivotCol = k; break; }
      }
      if (pivotCol === -1) {
        notes.push('La artificial ' + varNames[basis[r]] + ' queda básica en 0 y ninguna columna real puede sacarla de la base: la restricción es redundante y se elimina.');
        rowsToRemove.push(r);
        continue;
      }
      var leavingName = varNames[basis[r]];
      var pivotVal = rows[r][pivotCol];
      rows[r] = rows[r].map(function (x) { return x.div(pivotVal); });
      b[r] = b[r].div(pivotVal);
      for (var i = 0; i < rows.length; i++) {
        if (i === r) continue;
        var factor = rows[i][pivotCol];
        if (factor.isZero()) continue;
        rows[i] = rows[i].map(function (x, jj) { return x.sub(factor.mul(rows[r][jj])); });
        b[i] = b[i].sub(factor.mul(b[r]));
      }
      basis[r] = pivotCol;
      notes.push('Transición fase I → II: ' + leavingName + ' quedó básica artificial en 0; se la reemplaza en la base por ' +
        varNames[pivotCol] + ' (el lado derecho es 0, así que el pivote no afecta la factibilidad de ninguna fila).');
    }
    if (rowsToRemove.length) {
      rowsToRemove.sort(function (x, y) { return y - x; });
      rowsToRemove.forEach(function (r) { rows.splice(r, 1); b.splice(r, 1); basis.splice(r, 1); });
    }
    return notes;
  }

  function snapshot(rows, b, basis, z, zRHS, varNames, entering, leaving, ratios, note) {
    return {
      basis: basis.slice(),
      z: z.slice(),
      zRHS: zRHS,
      rows: rows.map(function (row, i) { return row.slice().concat([b[i]]); }),
      varNames: varNames,
      entering: entering === undefined ? null : entering,
      leaving: leaving === undefined ? null : leaving,
      pivot: (entering !== null && entering !== undefined && leaving !== null && leaving !== undefined) ? { r: leaving, c: entering } : null,
      ratios: ratios || null,
      note: note
    };
  }

  function solve(model, opts) {
    opts = opts || {};
    var method = opts.method || 'auto';
    if (method === 'auto') method = model.hasArtificial ? 'twophase' : 'bigM';
    var rule = opts.rule || 'auto';
    var varNames = model.varNames, n = model.numVars, m = model.m;
    var artificialSet = {};
    model.artificialCols.forEach(function (c) { artificialSet[c] = true; });

    var iterations = [];
    var status = 'optimal';
    var flags = { degenerate: false, alternative: false };
    var finalRows, finalBasis, finalZ;
    var maxIterations = opts.maxIterations || 200;

    if (method === 'twophase' && model.hasArtificial) {
      // Phase 1: minimize sum of artificials (real cost 1 per artificial, no M involved)
      var costFull1 = new Array(n);
      for (var j = 0; j < n; j++) costFull1[j] = artificialSet[j] ? N(1, 0) : NZERO;
      var rows1 = cloneRows(model.rows), b1 = model.b.slice(), basis1 = model.basisInit.slice();
      var enterMask1 = new Array(n).fill(true);
      var res1 = runPhase({
        rows: rows1, b: b1, basis: basis1, costFull: costFull1,
        type: 'min', varNames: varNames, enterMask: enterMask1, artificialSet: artificialSet, maxIter: maxIterations, rule: rule
      });
      res1.iterations.forEach(function (it) { it.phase = 1; });
      iterations = iterations.concat(res1.iterations);
      flags.degenerate = flags.degenerate || res1.flags.degenerate;

      if (res1.status === 'iteration_limit' || res1.status === 'unbounded') {
        return finalize(model, iterations, res1.status, flags, res1.rows, res1.b, res1.basis, res1.z, res1.zRHS, opts);
      }

      var rSum = F.ZERO;
      res1.basis.forEach(function (col, i) { if (artificialSet[col]) rSum = rSum.add(res1.b[i]); });
      if (rSum.isPos()) {
        status = 'infeasible';
        return finalize(model, iterations, status, flags, res1.rows, res1.b, res1.basis, res1.z, res1.zRHS, opts);
      }

      // Feasible: drive out any artificial still basic at 0 before phase 2.
      var transitionNotes = driveOutArtificials(res1.rows, res1.b, res1.basis, artificialSet, varNames);
      if (transitionNotes.length) {
        var costFullT = new Array(n);
        for (j = 0; j < n; j++) costFullT[j] = artificialSet[j] ? NZERO : N(model.cRow[j], 0);
        var zrT = computeZRow(res1.rows, res1.b, res1.basis, costFullT);
        var transSnap = snapshot(res1.rows, res1.b, res1.basis, zrT.z, zrT.zRHS, varNames, null, null, null, transitionNotes.join(' '));
        transSnap.phase = 1;
        iterations.push(transSnap);
      }

      // Phase 2: restore real objective, forbid artificial columns from entering
      var costFull2 = new Array(n);
      for (j = 0; j < n; j++) costFull2[j] = artificialSet[j] ? NZERO : N(model.cRow[j], 0);
      var enterMask2 = new Array(n).fill(true);
      model.artificialCols.forEach(function (c) { enterMask2[c] = false; });
      var res2 = runPhase({
        rows: res1.rows, b: res1.b, basis: res1.basis, costFull: costFull2,
        type: model.type, varNames: varNames, enterMask: enterMask2, artificialSet: artificialSet, maxIter: maxIterations, rule: rule
      });
      res2.iterations.forEach(function (it) { it.phase = 2; });
      iterations = iterations.concat(res2.iterations);
      status = res2.status;
      flags.degenerate = flags.degenerate || res2.flags.degenerate;
      flags.alternative = flags.alternative || res2.flags.alternative;
      finalRows = res2.rows; finalBasis = res2.basis; finalZ = res2.z;
      return finalize(model, iterations, status, flags, finalRows, res2.b, finalBasis, finalZ, res2.zRHS, opts);
    }

    // Big-M (also used when there are no artificials at all — M part stays 0)
    // Artificial cost is -M for max, +M for min, so it always penalizes staying basic.
    var costFullBM = new Array(n);
    var mCost = model.type === 'max' ? -1 : 1;
    for (j = 0; j < n; j++) {
      costFullBM[j] = artificialSet[j] ? N(0, mCost) : N(model.cRow[j], 0);
    }
    var rowsBM = cloneRows(model.rows), bBM = model.b.slice(), basisBM = model.basisInit.slice();
    var enterMaskBM = new Array(n).fill(true);
    var resBM = runPhase({
      rows: rowsBM, b: bBM, basis: basisBM, costFull: costFullBM,
      type: model.type, varNames: varNames, enterMask: enterMaskBM, artificialSet: artificialSet, maxIter: maxIterations, rule: rule
    });
    resBM.iterations.forEach(function (it) { it.phase = 1; });
    iterations = iterations.concat(resBM.iterations);
    status = resBM.status;
    flags.degenerate = flags.degenerate || resBM.flags.degenerate;
    flags.alternative = flags.alternative || resBM.flags.alternative;
    finalRows = resBM.rows; finalBasis = resBM.basis; finalZ = resBM.z;

    if (status === 'optimal') {
      var rSumBM = F.ZERO;
      finalBasis.forEach(function (col, i) { if (artificialSet[col]) rSumBM = rSumBM.add(resBM.b[i]); });
      if (rSumBM.isPos()) status = 'infeasible';
    }
    return finalize(model, iterations, status, flags, finalRows, resBM.b, finalBasis, finalZ, resBM.zRHS, opts);
  }

  function finalize(model, iterations, status, flags, rows, b, basis, z, zRHS, opts) {
    var result = { status: flags.degenerate && status === 'optimal' ? 'degenerate' : status, iterations: iterations, flags: flags };
    if (status === 'optimal') {
      var x = new Array(model.numVars).fill(F.ZERO);
      basis.forEach(function (col, i) { x[col] = b[i]; });
      var xNamed = {};
      model.varNames.forEach(function (name, j) { xNamed[name] = x[j]; });
      // z value: recompute directly from c·x for numerical/display safety.
      var zVal = F.ZERO;
      for (var j = 0; j < model.numVars; j++) zVal = zVal.add(model.cRow[j].mul(x[j]));
      result.optimal = { x: xNamed, xRaw: x, z: zVal, basis: basis.slice() };
      if (opts && opts.withSensitivity !== false) {
        result.sensitivity = sensitivity({ rows: rows, b: b, basis: basis, z: z }, model);
      }
    } else {
      // Never present a non-optimal result (unbounded, infeasible, or an
      // exhausted iteration limit) as if it had an optimal solution.
      result.optimal = null;
    }
    result._final = { rows: rows, b: b, basis: basis, z: z, zRHS: zRHS };
    if (flags.alternative && status === 'optimal') result.status = 'alternative';
    else if (flags.degenerate && status === 'optimal') result.status = 'degenerate';
    return result;
  }

  // ---------- sensitivity ----------
  function sensitivity(finalIter, model) {
    var rows = finalIter.rows, basis = finalIter.basis, z = finalIter.z;
    var m = model.m;
    var artificialSet = {};
    model.artificialCols.forEach(function (c) { artificialSet[c] = true; });
    var Binv = []; // Binv[k][i]
    for (var k = 0; k < m; k++) {
      Binv.push(model.basisInit.map(function (col) { return rows[k][col]; }));
    }
    var XB = basis.map(function (col, i) { return finalIter.b[i]; });

    var duals = model.basisInit.map(function (col) { return z[col].c; });

    var reducedCosts = {};
    for (var j = 0; j < model.nDecision; j++) {
      if (basis.indexOf(j) === -1) reducedCosts[model.varNames[j]] = z[j].c;
    }

    // RHS feasibility ranges
    var rhsRanges = [];
    for (var i = 0; i < m; i++) {
      var lower = null, upper = null;
      for (k = 0; k < m; k++) {
        var coef = Binv[k][i];
        if (coef.isZero()) continue;
        var bound = XB[k].neg().div(coef); // delta bound
        if (coef.isPos()) { if (lower === null || bound.cmp(lower) > 0) lower = bound; }
        else { if (upper === null || bound.cmp(upper) < 0) upper = bound; }
      }
      var bOrig = model.b[i];
      rhsRanges.push({
        i: i,
        lower: lower === null ? null : bOrig.add(lower),
        upper: upper === null ? null : bOrig.add(upper)
      });
    }

    // Objective coefficient ranges
    var cRanges = [];
    for (j = 0; j < model.nDecision; j++) {
      var basicRow = basis.indexOf(j);
      var cj = model.cRow[j];
      if (basicRow === -1) {
        // nonbasic: delta <= reduced-cost margin (max) — direction depends on type
        var margin = z[j].c;
        if (model.type === 'max') {
          cRanges.push({ j: j, lower: null, upper: cj.add(margin) });
        } else {
          cRanges.push({ j: j, lower: cj.sub(margin), upper: null });
        }
      } else {
        // Basic variable in row `basicRow`. Changing c_j by delta changes every
        // nonbasic reduced cost (z_k - c_k) by delta*a_rk (a_rk = tableau
        // coefficient of column k in that row). Optimality requires:
        //   max: (z_k - c_k) + delta*a_rk >= 0  for every nonbasic k
        //   min: (z_k - c_k) + delta*a_rk <= 0  for every nonbasic k
        // Both reduce to the same bound value delta_bound = -(z_k - c_k)/a_rk;
        // only which side (lower/upper) it constrains flips with sign(a_rk)
        // and with max vs min. lower = the largest (most restrictive) lower
        // bound found; upper = the smallest (most restrictive) upper bound.
        var lo = null, hi = null;
        // Iterate over ALL columns (decision + slack/surplus/artificial), not
        // just nDecision+m: a '>=' row contributes two extra columns
        // (surplus + artificial), so nDecision+m undercounts whenever such a
        // row is present and silently ignores real columns (e.g. a slack
        // from a later '<=' row), producing a range that can exclude the
        // variable's own current cost.
        for (var kk = 0; kk < model.numVars; kk++) {
          if (kk === j || basis.indexOf(kk) !== -1) continue;
          if (artificialSet[kk]) continue; // artificials are barred from re-entering, their reduced cost is irrelevant to optimality
          var ark = rows[basicRow][kk];
          if (ark.isZero()) continue;
          var zk = z[kk].c;
          var bound2 = zk.neg().div(ark);
          var arkPosBoundsLower = (model.type === 'max') ? ark.isPos() : ark.isNeg();
          if (arkPosBoundsLower) {
            if (lo === null || bound2.cmp(lo) > 0) lo = bound2;
          } else {
            if (hi === null || bound2.cmp(hi) < 0) hi = bound2;
          }
        }
        cRanges.push({ j: j, lower: lo === null ? null : cj.add(lo), upper: hi === null ? null : cj.add(hi) });
      }
    }

    return { duals: duals, reducedCosts: reducedCosts, rhsRanges: rhsRanges, cRanges: cRanges, Binv: Binv, XB: XB };
  }

  // ---------- HTML rendering ----------
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function toHTML(iteration, varNames, opts) {
    opts = opts || {};
    var names = varNames || iteration.varNames;
    var m = iteration.rows.length;
    var pivot = iteration.pivot;
    var html = '<table class="tableau">';
    html += '<thead><tr><th>Base</th>';
    names.forEach(function (nm, j) {
      var cls = (pivot && j === pivot.c) ? ' class="pivot-col"' : '';
      html += '<th' + cls + '>' + esc(nm) + '</th>';
    });
    html += '<th>RHS</th>';
    if (iteration.ratios) html += '<th>Cociente</th>';
    html += '</tr></thead><tbody>';
    html += '<tr class="z-row"><th>z</th>';
    names.forEach(function (nm, j) {
      var cls = (pivot && j === pivot.c) ? ' class="pivot-col"' : '';
      html += '<td' + cls + '>' + nToHTML(iteration.z[j]) + '</td>';
    });
    html += '<td>' + nToHTML(iteration.zRHS) + '</td>';
    if (iteration.ratios) html += '<td>—</td>';
    html += '</tr>';
    for (var i = 0; i < m; i++) {
      var isPivotRow = pivot && i === pivot.r;
      html += '<tr' + (isPivotRow ? ' class="pivot-row"' : '') + '><th class="basic">' + esc(names[iteration.basis[i]]) + '</th>';
      for (var j = 0; j < names.length; j++) {
        var classes = [];
        if (pivot && j === pivot.c) classes.push('pivot-col');
        if (isPivotRow) classes.push('pivot-row');
        if (pivot && i === pivot.r && j === pivot.c) classes.push('pivot-cell');
        html += '<td' + (classes.length ? ' class="' + classes.join(' ') + '"' : '') + '>' + iteration.rows[i][j].toHTML() + '</td>';
      }
      html += '<td>' + iteration.rows[i][names.length].toHTML() + '</td>';
      if (iteration.ratios) {
        var rr = iteration.ratios[i];
        var val = rr && rr.value !== null ? rr.value.toHTML() : '—';
        html += '<td class="' + (rr && rr.isMin ? 'hl' : '') + '">' + val + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
  }

  global.IO = global.IO || { chapters: [] };
  global.IO.Simplex = { parse: parse, solve: solve, sensitivity: sensitivity, toHTML: toHTML, _internal: { N: N, nCmp: nCmp } };
})(typeof window !== 'undefined' ? window : globalThis);
