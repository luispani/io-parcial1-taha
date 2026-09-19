/* Cap 4 — Dualidad y análisis postóptimo. Owner: D.
 * Implementa su propio pivoteo con Frac (NO depende de IO.Simplex).
 */
window.IO = window.IO || { chapters: [] };
IO.registerChapter = IO.registerChapter || function (ch) { IO.chapters.push(ch); };

(function () {
  'use strict';

  /* ---------------------------------------------------------------------
   * 0. Helpers
   * ------------------------------------------------------------------- */
  var F = Frac;
  function fz() { return F.ZERO; }
  function fnum(v) { return F.from(v); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---------------------------------------------------------------------
   * 1. Tableau engine (Gauss-Jordan con Frac). Formato Taha: fila z arriba,
   *    z.vals[j] = z_j - c_j (óptimo en max cuando todos >= 0).
   * ------------------------------------------------------------------- */
  function cloneTab(tab) {
    return {
      names: tab.names.slice(),
      rows: tab.rows.map(function (r) { return { basis: r.basis, vals: r.vals.map(function (v) { return v; }), rhs: r.rhs }; }),
      z: { vals: tab.z.vals.map(function (v) { return v; }), rhs: tab.z.rhs },
      maximize: tab.maximize,
      objSign: tab.objSign
    };
  }

  function pivot(tab, rowIdx, colIdx) {
    var t = cloneTab(tab);
    var row = t.rows[rowIdx];
    var piv = row.vals[colIdx];
    var n = t.names.length;
    var newVals = new Array(n);
    for (var j = 0; j < n; j++) newVals[j] = row.vals[j].div(piv);
    var newRhs = row.rhs.div(piv);
    row.vals = newVals;
    row.rhs = newRhs;
    row.basis = colIdx;
    function eliminate(target) {
      var factor = target.vals[colIdx];
      if (factor.isZero()) return;
      var vv = new Array(n);
      for (var j = 0; j < n; j++) vv[j] = target.vals[j].sub(factor.mul(newVals[j]));
      target.vals = vv;
      target.rhs = target.rhs.sub(factor.mul(newRhs));
    }
    for (var r = 0; r < t.rows.length; r++) if (r !== rowIdx) eliminate(t.rows[r]);
    eliminate(t.z);
    return t;
  }

  /* Primal step: entra la col con z_j-c_j mas negativo; sale por razon minima. */
  function primalStep(tab) {
    var enter = -1, best = null;
    for (var j = 0; j < tab.names.length; j++) {
      var v = tab.z.vals[j];
      if (v.isNeg() && (best === null || v.cmp(best) < 0)) { best = v; enter = j; }
    }
    if (enter === -1) return { optimal: true };
    var leave = -1, bestRatio = null, ratios = [];
    for (var r = 0; r < tab.rows.length; r++) {
      var a = tab.rows[r].vals[enter];
      if (a.isPos()) {
        var ratio = tab.rows[r].rhs.div(a);
        ratios[r] = ratio;
        if (bestRatio === null || ratio.cmp(bestRatio) < 0) { bestRatio = ratio; leave = r; }
      } else { ratios[r] = null; }
    }
    if (leave === -1) return { unbounded: true, entering: enter };
    return { entering: enter, leaving: leave, ratios: ratios, pivotVal: tab.rows[leave].vals[enter] };
  }

  /* Dual step: sale la fila con RHS mas negativo; entra por cociente minimo
   * |z_j - c_j| / |a_rj| entre columnas con a_rj < 0 de esa fila. */
  function dualStep(tab) {
    var leave = -1, worst = null;
    for (var r = 0; r < tab.rows.length; r++) {
      var rhs = tab.rows[r].rhs;
      if (rhs.isNeg() && (worst === null || rhs.cmp(worst) < 0)) { worst = rhs; leave = r; }
    }
    if (leave === -1) return { optimal: true, feasible: true };
    var enter = -1, bestRatio = null, ratios = [];
    for (var j = 0; j < tab.names.length; j++) {
      var a = tab.rows[leave].vals[j];
      if (a.isNeg()) {
        var ratio = tab.z.vals[j].abs().div(a.abs());
        ratios[j] = ratio;
        if (bestRatio === null || ratio.cmp(bestRatio) < 0) { bestRatio = ratio; enter = j; }
      } else { ratios[j] = null; }
    }
    if (enter === -1) return { infeasible: true, leaving: leave };
    return { entering: enter, leaving: leave, ratios: ratios, pivotVal: tab.rows[leave].vals[enter] };
  }

  function tabToHTML(tab, opts) {
    opts = opts || {};
    var pr = opts.pivotRow, pc = opts.pivotCol;
    var out = '<div class="canvas-wrap" style="overflow-x:auto"><table class="tableau"><thead><tr><th>Base</th>';
    for (var j = 0; j < tab.names.length; j++) out += '<th' + (j === pc ? ' class="pivot-col"' : '') + '>' + esc(tab.names[j]) + '</th>';
    out += '<th>LD</th></tr></thead><tbody>';
    out += '<tr class="z-row"><td><em>z</em></td>';
    for (var j2 = 0; j2 < tab.names.length; j2++) out += '<td' + (j2 === pc ? ' class="pivot-col"' : '') + '>' + tab.z.vals[j2].toHTML() + '</td>';
    out += '<td>' + tab.z.rhs.toHTML() + '</td></tr>';
    for (var r = 0; r < tab.rows.length; r++) {
      var row = tab.rows[r];
      var rowCls = (r === pr) ? ' class="pivot-row"' : '';
      out += '<tr' + rowCls + '><td class="basic">' + esc(tab.names[row.basis]) + '</td>';
      for (var j3 = 0; j3 < tab.names.length; j3++) {
        var isPivotCell = (r === pr && j3 === pc);
        var cls = [];
        if (j3 === pc) cls.push('pivot-col');
        if (r === pr) cls.push('pivot-row');
        if (isPivotCell) cls.push('pivot-cell');
        out += '<td' + (cls.length ? ' class="' + cls.join(' ') + '"' : '') + '>' + row.vals[j3].toHTML() + '</td>';
      }
      out += '<td>' + row.rhs.toHTML() + '</td></tr>';
    }
    out += '</tbody></table></div>';
    return out;
  }

  /* ---------------------------------------------------------------------
   * 2. Constructor del dual (reglas de Taha, tabla §4.1)
   * ------------------------------------------------------------------- */
  /* primal = { type:'max'|'min', c:[Frac], names:[x1..], varSign:['>=0'|'<=0'|'free'],
   *            constraints:[{a:[Frac], op:'<='|'>='|'=', b:Frac, name:'R1'}] } */
  function buildDual(primal) {
    var m = primal.constraints.length;
    var n = primal.c.length;
    var dualType = primal.type === 'max' ? 'min' : 'max';
    var explain = [];
    // dual variable sign per primal constraint
    var ySign = [];
    for (var i = 0; i < m; i++) {
      var op = primal.constraints[i].op;
      var s;
      if (primal.type === 'max') {
        s = op === '<=' ? '>=0' : (op === '>=' ? '<=0' : 'free');
      } else {
        s = op === '>=' ? '>=0' : (op === '<=' ? '<=0' : 'free');
      }
      ySign.push(s);
      explain.push('Restricción primal ' + (primal.constraints[i].name || ('R' + (i + 1))) + ' es "' + op + '" → y' + (i + 1) + ' ' + (s === 'free' ? 'irrestricta' : s));
    }
    // dual constraint op per primal variable sign
    var dualOps = [];
    for (var j = 0; j < n; j++) {
      var vs = primal.varSign[j];
      var dop;
      if (primal.type === 'max') {
        dop = vs === '>=0' ? '>=' : (vs === '<=0' ? '<=' : '=');
      } else {
        dop = vs === '>=0' ? '<=' : (vs === '<=0' ? '>=' : '=');
      }
      dualOps.push(dop);
      explain.push('Variable primal ' + (primal.names ? primal.names[j] : ('x' + (j + 1))) + ' es "' + (vs === 'free' ? 'irrestricta' : vs) + '" → restricción dual ' + (j + 1) + ' es "' + dop + '"');
    }
    // dual objective coefficients = b_i ; dual constraint matrix = A^T ; dual RHS = c_j
    var dualC = primal.constraints.map(function (ct) { return ct.b; });
    var dualConstraints = [];
    for (var jj = 0; jj < n; jj++) {
      var row = [];
      for (var ii = 0; ii < m; ii++) row.push(primal.constraints[ii].a[jj]);
      dualConstraints.push({ a: row, op: dualOps[jj], b: primal.c[jj], name: 'D' + (jj + 1) });
    }
    var dualNames = [];
    for (var k = 0; k < m; k++) dualNames.push('y' + (k + 1));
    return { type: dualType, c: dualC, names: dualNames, varSign: ySign, constraints: dualConstraints, explain: explain };
  }

  function modelToHTML(model, isDual) {
    var s = '<div class="formula">' + (isDual ? 'w' : 'z') + ' ' + (model.type === 'max' ? '(max)' : '(min)') + ' = ';
    var terms = [];
    for (var j = 0; j < model.c.length; j++) terms.push(model.c[j].toHTML() + (model.c[j].isNeg() ? '' : '') + model.names[j]);
    s += terms.join(' + ').replace(/\+ -/g, '- ') + '</div><div class="formula">sujeto a:</div><ul class="formula" style="list-style:none;padding:0">';
    for (var i = 0; i < model.constraints.length; i++) {
      var ct = model.constraints[i];
      var t2 = [];
      for (var jj = 0; jj < ct.a.length; jj++) if (!ct.a[jj].isZero()) t2.push(ct.a[jj].toHTML() + model.names[jj]);
      s += '<li>' + t2.join(' + ').replace(/\+ -/g, '- ') + ' ' + ct.op + ' ' + ct.b.toHTML() + '</li>';
    }
    s += '</ul><div class="eq">';
    var signParts = [];
    for (var k = 0; k < model.varSign.length; k++) signParts.push(model.names[k] + ' ' + (model.varSign[k] === 'free' ? 'irrestricta' : model.varSign[k]));
    s += signParts.join(', ') + '</div>';
    return s;
  }

  /* ---------------------------------------------------------------------
   * 3. Ejemplos precargados
   * ------------------------------------------------------------------- */
  function P(a) { return a.map(fnum); }

  var DUAL_EXAMPLES = [
    {
      label: 'Reddy Mikks (max, todo ≤)',
      primal: {
        type: 'max', names: ['x1', 'x2'], c: P([5, 4]), varSign: ['>=0', '>=0'],
        constraints: [
          { name: 'R1', a: P([6, 4]), op: '<=', b: fnum(24) },
          { name: 'R2', a: P([1, 2]), op: '<=', b: fnum(6) },
          { name: 'R3', a: P([-1, 1]), op: '<=', b: fnum(1) },
          { name: 'R4', a: P([0, 1]), op: '<=', b: fnum(2) }
        ]
      },
      known: 'y = (3/4, 1/2, 0, 0), w* = 21 (coincide con z* = 21 del primal).'
    },
    {
      label: 'Con = e irrestricta (max)',
      primal: {
        type: 'max', names: ['x1', 'x2'], c: P([3, 5]), varSign: ['free', '>=0'],
        constraints: [
          { name: 'R1', a: P([1, 1]), op: '=', b: fnum(4) },
          { name: 'R2', a: P([2, -1]), op: '<=', b: fnum(6) }
        ]
      },
      known: 'x1 irrestricta ⇒ 2ª restricción dual es "=". R1 es "=" ⇒ y1 irrestricta.'
    },
    {
      label: 'Problema de minimización',
      primal: {
        type: 'min', names: ['x1', 'x2'], c: P([6, 8]), varSign: ['>=0', '>=0'],
        constraints: [
          { name: 'R1', a: P([1, 1]), op: '>=', b: fnum(10) },
          { name: 'R2', a: P([2, 1]), op: '>=', b: fnum(15) }
        ]
      },
      known: 'Primal óptimo x=(10,0), z*=60. Dual óptimo y=(6,0), w*=60.'
    }
  ];

  /* ---------------------------------------------------------------------
   * 4. Widget 1 — Constructor del dual
   * ------------------------------------------------------------------- */
  function mountDualBuilder(root) {
    var state = { primal: DUAL_EXAMPLES[0].primal, known: DUAL_EXAMPLES[0].known };

    root.innerHTML =
      '<div class="row">' +
      '<label>Ejemplo: <select class="ex-pick">' +
      DUAL_EXAMPLES.map(function (e, i) { return '<option value="' + i + '">' + esc(e.label) + '</option>'; }).join('') +
      '</select></label>' +
      '<label>Tipo: <select class="ptype"><option value="max">max</option><option value="min">min</option></select></label>' +
      '<label>Vars (n): <input type="number" class="pn" min="1" max="5" value="2" style="width:4em"></label>' +
      '<label>Restr. (m): <input type="number" class="pm" min="1" max="5" value="4" style="width:4em"></label>' +
      '</div>' +
      '<div class="editor-holder"></div>' +
      '<div class="row"><button class="btn btn-primary btn-gen">Generar dual</button></div>' +
      '<div class="dual-result"></div>';

    var exPick = root.querySelector('.ex-pick');
    var ptype = root.querySelector('.ptype');
    var pn = root.querySelector('.pn');
    var pm = root.querySelector('.pm');
    var holder = root.querySelector('.editor-holder');
    var result = root.querySelector('.dual-result');

    function renderEditor() {
      var m = state.primal;
      var n = m.c.length;
      var rows = m.constraints.length;
      var t = '<div class="canvas-wrap" style="overflow-x:auto"><table class="input-grid data"><thead><tr><th></th>';
      for (var j = 0; j < n; j++) t += '<th>' + esc(m.names[j]) + '</th>';
      t += '<th>Op</th><th>LD</th></tr></thead><tbody>';
      for (var i = 0; i < rows; i++) {
        t += '<tr><td>R' + (i + 1) + '</td>';
        for (var j2 = 0; j2 < n; j2++) t += '<td><input class="a-cell" data-r="' + i + '" data-c="' + j2 + '" value="' + m.constraints[i].a[j2].toString() + '"></td>';
        t += '<td><select class="op-cell" data-r="' + i + '">' +
          ['<=', '>=', '='].map(function (o) { return '<option value="' + o + '"' + (o === m.constraints[i].op ? ' selected' : '') + '>' + o + '</option>'; }).join('') +
          '</select></td>';
        t += '<td><input class="b-cell" data-r="' + i + '" value="' + m.constraints[i].b.toString() + '"></td></tr>';
      }
      t += '<tr><td>c<sub>j</sub></td>';
      for (var j3 = 0; j3 < n; j3++) t += '<td><input class="c-cell" data-c="' + j3 + '" value="' + m.c[j3].toString() + '"></td>';
      t += '<td colspan="2"></td></tr>';
      t += '<tr><td>signo x<sub>j</sub></td>';
      for (var j4 = 0; j4 < n; j4++) {
        t += '<td><select class="sign-cell" data-c="' + j4 + '">' +
          [['>=0', '≥ 0'], ['<=0', '≤ 0'], ['free', 'irrestricta']].map(function (o) {
            return '<option value="' + o[0] + '"' + (o[0] === m.varSign[j4] ? ' selected' : '') + '>' + o[1] + '</option>';
          }).join('') + '</select></td>';
      }
      t += '<td colspan="2"></td></tr></tbody></table></div>';
      holder.innerHTML = t;
      holder.querySelectorAll('.a-cell').forEach(function (inp) {
        inp.addEventListener('change', function () {
          state.primal.constraints[+inp.dataset.r].a[+inp.dataset.c] = F.from(inp.value);
        });
      });
      holder.querySelectorAll('.op-cell').forEach(function (sel) {
        sel.addEventListener('change', function () { state.primal.constraints[+sel.dataset.r].op = sel.value; });
      });
      holder.querySelectorAll('.b-cell').forEach(function (inp) {
        inp.addEventListener('change', function () { state.primal.constraints[+inp.dataset.r].b = F.from(inp.value); });
      });
      holder.querySelectorAll('.c-cell').forEach(function (inp) {
        inp.addEventListener('change', function () { state.primal.c[+inp.dataset.c] = F.from(inp.value); });
      });
      holder.querySelectorAll('.sign-cell').forEach(function (sel) {
        sel.addEventListener('change', function () { state.primal.varSign[+sel.dataset.c] = sel.value; });
      });
    }

    function renderResult() {
      var dual = buildDual(state.primal);
      var s = '<div class="grid-2">';
      s += '<div class="panel"><div class="panel-title">Primal</div>' + modelToHTML(state.primal, false) + '</div>';
      s += '<div class="panel"><div class="panel-title">Dual</div>' + modelToHTML(dual, true) + '</div>';
      s += '</div>';
      s += '<div class="callout callout-def"><strong>Regla por regla:</strong><ul>' +
        dual.explain.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';
      if (state.known) s += '<div class="callout callout-tip"><strong>Solución conocida (libro):</strong> ' + esc(state.known) + '</div>';
      result.innerHTML = s;
    }

    function loadExample(idx) {
      var ex = DUAL_EXAMPLES[idx];
      state.primal = { type: ex.primal.type, names: ex.primal.names.slice(), c: ex.primal.c.slice(), varSign: ex.primal.varSign.slice(), constraints: ex.primal.constraints.map(function (ct) { return { name: ct.name, a: ct.a.slice(), op: ct.op, b: ct.b }; }) };
      state.known = ex.known;
      ptype.value = state.primal.type;
      pn.value = state.primal.c.length;
      pm.value = state.primal.constraints.length;
      renderEditor();
      renderResult();
    }

    exPick.addEventListener('change', function () { loadExample(+exPick.value); });
    ptype.addEventListener('change', function () { state.primal.type = ptype.value; });
    pn.addEventListener('change', function () {
      var n = Math.max(1, Math.min(5, +pn.value || 2));
      var m = state.primal;
      while (m.c.length < n) { m.c.push(fz()); m.names.push('x' + (m.c.length)); m.varSign.push('>=0'); m.constraints.forEach(function (ct) { ct.a.push(fz()); }); }
      while (m.c.length > n) { m.c.pop(); m.names.pop(); m.varSign.pop(); m.constraints.forEach(function (ct) { ct.a.pop(); }); }
      renderEditor();
    });
    pm.addEventListener('change', function () {
      var rows = Math.max(1, Math.min(5, +pm.value || 4));
      var m = state.primal;
      while (m.constraints.length < rows) m.constraints.push({ name: 'R' + (m.constraints.length + 1), a: m.c.map(function () { return fz(); }), op: '<=', b: fz() });
      while (m.constraints.length > rows) m.constraints.pop();
      renderEditor();
    });
    root.querySelector('.btn-gen').addEventListener('click', renderResult);

    loadExample(0);
  }

  /* ---------------------------------------------------------------------
   * 5. Widget 2 — Simplex dual paso a paso
   * ------------------------------------------------------------------- */
  /* Construye tableau inicial dual-factible a partir de un modelo min/max con
   * restricciones <=, >= (y = tratado como <= y >= combinadas). */
  function buildDualSimplexInitial(model) {
    var objSign = model.type === 'min' ? -1 : 1;
    var rows = [];
    model.constraints.forEach(function (ct) {
      if (ct.op === '=') {
        rows.push({ a: ct.a.slice(), b: ct.b, op: '<=' });
        rows.push({ a: ct.a.map(function (v) { return v.neg(); }), b: ct.b.neg(), op: '<=' });
      } else if (ct.op === '>=') {
        rows.push({ a: ct.a.map(function (v) { return v.neg(); }), b: ct.b.neg(), op: '<=' });
      } else {
        rows.push({ a: ct.a.slice(), b: ct.b, op: '<=' });
      }
    });
    var n = model.c.length;
    var m = rows.length;
    var names = model.names.slice();
    for (var i = 0; i < m; i++) names.push('s' + (i + 1));
    var internalC = model.c.map(function (cj) { return objSign === -1 ? cj.neg() : cj; });
    var zVals = new Array(names.length);
    for (var j = 0; j < n; j++) zVals[j] = internalC[j].neg();
    for (var j2 = n; j2 < names.length; j2++) zVals[j2] = fz();
    var tabRows = [];
    for (var r = 0; r < m; r++) {
      var vals = new Array(names.length);
      for (var c = 0; c < n; c++) vals[c] = rows[r].a[c];
      for (var s = 0; s < m; s++) vals[n + s] = (s === r) ? F.ONE : fz();
      tabRows.push({ basis: n + r, vals: vals, rhs: rows[r].b });
    }
    return { names: names, rows: tabRows, z: { vals: zVals, rhs: fz() }, maximize: true, objSign: objSign, nDecision: n };
  }

  function trueObjective(tab) { return tab.z.rhs.mul(fnum(tab.objSign)); }
  function varValue(tab, idx) {
    for (var r = 0; r < tab.rows.length; r++) if (tab.rows[r].basis === idx) return tab.rows[r].rhs;
    return fz();
  }

  var DUALSIMPLEX_EXAMPLES = [
    {
      label: 'min z = 3x1 + 2x2 (Taha)',
      model: {
        type: 'min', names: ['x1', 'x2'], c: P([3, 2]),
        constraints: [
          { a: P([3, 1]), op: '>=', b: fnum(3) },
          { a: P([4, 3]), op: '>=', b: fnum(6) },
          { a: P([1, 1]), op: '<=', b: fnum(3) }
        ]
      },
      known: 'x* = (3/5, 6/5), z* = 21/5'
    },
    {
      label: 'min z = 2x1 + 3x2 (otro)',
      model: {
        type: 'min', names: ['x1', 'x2'], c: P([2, 3]),
        constraints: [
          { a: P([1, 2]), op: '>=', b: fnum(4) },
          { a: P([3, 2]), op: '>=', b: fnum(6) }
        ]
      },
      known: 'x* = (1, 3/2), z* = 13/2'
    }
  ];

  function mountDualSimplex(root) {
    var state = { exIdx: 0, history: [], tab: null, finished: null };

    root.innerHTML =
      '<div class="row"><label>Ejemplo: <select class="ex-pick">' +
      DUALSIMPLEX_EXAMPLES.map(function (e, i) { return '<option value="' + i + '">' + esc(e.label) + '</option>'; }).join('') +
      '</select></label></div>' +
      '<div class="tab-holder"></div>' +
      '<div class="step-bar row">' +
      '<button class="btn btn-sm btn-prev">◀ Anterior</button>' +
      '<button class="btn btn-sm btn-next">Siguiente ▶</button>' +
      '<button class="btn btn-sm btn-all">Resolver todo</button>' +
      '<button class="btn btn-sm btn-ghost btn-reset">Reiniciar</button>' +
      '</div>' +
      '<div class="step-text"></div>' +
      '<div class="callout callout-tip known-box"></div>';

    var tabHolder = root.querySelector('.tab-holder');
    var stepText = root.querySelector('.step-text');
    var knownBox = root.querySelector('.known-box');
    var exPick = root.querySelector('.ex-pick');

    function reset(idx) {
      state.exIdx = idx;
      state.tab = buildDualSimplexInitial(DUALSIMPLEX_EXAMPLES[idx].model);
      state.history = [cloneTab(state.tab)];
      state.finished = null;
      knownBox.innerHTML = '<strong>Solución esperada (libro):</strong> ' + esc(DUALSIMPLEX_EXAMPLES[idx].known);
      render(null);
    }

    function currentX() {
      var n = state.tab.nDecision;
      var xs = [];
      for (var j = 0; j < n; j++) xs.push(state.tab.names[j] + ' = ' + varValue(state.tab, j).toHTML());
      return xs.join(', ');
    }

    function render(stepInfo) {
      var pr = stepInfo && stepInfo.leaving !== undefined ? stepInfo.leaving : undefined;
      var pc = stepInfo && stepInfo.entering !== undefined ? stepInfo.entering : undefined;
      tabHolder.innerHTML = tabToHTML(state.tab, { pivotRow: pr, pivotCol: pc });
      var msg = '';
      if (state.finished === 'optimal') {
        msg = '<span class="badge badge-ok">Óptimo y factible.</span> z = ' + trueObjective(state.tab).toHTML() + '. ' + currentX() + '.';
      } else if (state.finished === 'infeasible') {
        msg = '<span class="badge badge-err">Primal no factible</span>: la fila que debía salir no tiene coeficientes negativos para elegir variable entrante.';
      } else if (stepInfo && stepInfo.leaving !== undefined) {
        var ratioStr = [];
        for (var j = 0; j < state.tab.names.length; j++) if (stepInfo.ratios[j]) ratioStr.push(state.tab.names[j] + ': ' + stepInfo.ratios[j].toHTML());
        msg = 'Sale <strong>' + esc(state.tab.names[state.tab.rows[stepInfo.leaving].basis]) + '</strong> (LD más negativo). ' +
          'Cocientes |z<sub>j</sub>−c<sub>j</sub>| / |a<sub>rj</sub>| entre los a<sub>rj</sub> &lt; 0: ' + ratioStr.join(', ') + '. ' +
          'Entra <strong>' + esc(state.tab.names[stepInfo.entering]) + '</strong> (cociente mínimo). Pivote = ' + stepInfo.pivotVal.toHTML() + '.';
      } else {
        msg = 'Tabla inicial dual-factible (óptima pero posiblemente no factible). Pulse «Siguiente ▶».';
      }
      stepText.innerHTML = msg;
    }

    function stepOnce() {
      if (state.finished) return false;
      var info = dualStep(state.tab);
      if (info.optimal) { state.finished = 'optimal'; render(info); return false; }
      if (info.infeasible) { state.finished = 'infeasible'; render(info); return false; }
      state.tab = pivot(state.tab, info.leaving, info.entering);
      state.history.push(cloneTab(state.tab));
      render(info);
      return true;
    }

    root.querySelector('.btn-next').addEventListener('click', stepOnce);
    root.querySelector('.btn-all').addEventListener('click', function () {
      var guard = 0;
      while (stepOnce() && guard < 50) guard++;
    });
    root.querySelector('.btn-prev').addEventListener('click', function () {
      if (state.history.length > 1) {
        state.history.pop();
        state.tab = cloneTab(state.history[state.history.length - 1]);
        state.finished = null;
        render(null);
      }
    });
    root.querySelector('.btn-reset').addEventListener('click', function () { reset(state.exIdx); });
    exPick.addEventListener('change', function () { reset(+exPick.value); });

    reset(0);
  }

  /* ---------------------------------------------------------------------
   * 6. Widget 3 — Postóptimo TOYCO
   * ------------------------------------------------------------------- */
  var TOYCO = {
    names: ['x1', 'x2', 'x3', 's1', 's2', 's3'],
    A: [P([1, 2, 1, 1, 0, 0]), P([3, 0, 2, 0, 1, 0]), P([1, 4, 0, 0, 0, 1])],
    c: P([3, 2, 5, 0, 0, 0]),
    b: P([430, 460, 420]),
    basis: [1, 2, 5], // x2, x3, s3
    Binv: [
      [F.of(1, 2), F.of(-1, 4), fz()],
      [fz(), F.of(1, 2), fz()],
      [F.of(-2, 1), F.of(1, 1), F.of(1, 1)]
    ]
  };

  function matVec(M, v) {
    return M.map(function (row) {
      var s = fz();
      for (var i = 0; i < row.length; i++) s = s.add(row[i].mul(v[i]));
      return s;
    });
  }
  function vecMat(v, M) {
    var n = M[0].length;
    var out = [];
    for (var j = 0; j < n; j++) {
      var s = fz();
      for (var i = 0; i < M.length; i++) s = s.add(v[i].mul(M[i][j]));
      out.push(s);
    }
    return out;
  }
  function dot(a, b) { var s = fz(); for (var i = 0; i < a.length; i++) s = s.add(a[i].mul(b[i])); return s; }

  function buildToycoTableau(b, c) {
    var Binv = TOYCO.Binv;
    var basis = TOYCO.basis;
    var cB = basis.map(function (idx) { return c[idx]; });
    var y = vecMat(cB, Binv); // y = cB * Binv
    var XB = matVec(Binv, b); // XB = Binv * b
    var names = TOYCO.names;
    var n = names.length;
    var m = 3;
    var zVals = [];
    for (var j = 0; j < n; j++) zVals.push(dot(y, TOYCO.A.map(function (row) { return row[j]; })).sub(c[j]));
    var zRhs = dot(cB, XB);
    // build each column j as Binv * A_j, then assemble rows
    var cols = [];
    for (var jj = 0; jj < n; jj++) {
      var Aj = TOYCO.A.map(function (row) { return row[jj]; });
      cols.push(matVec(Binv, Aj));
    }
    var tabRows = [];
    for (var r = 0; r < m; r++) {
      var vals = [];
      for (var j2 = 0; j2 < n; j2++) vals.push(cols[j2][r]);
      tabRows.push({ basis: basis[r], vals: vals, rhs: XB[r] });
    }
    return { names: names, rows: tabRows, z: { vals: zVals, rhs: zRhs }, maximize: true, objSign: 1, Binv: Binv, y: y, cB: cB };
  }

  function mountPostopt(root) {
    root.innerHTML =
      '<div class="callout callout-def"><strong>TOYCO</strong>: max z = 3x1 + 2x2 + 5x3; ' +
      'x1+2x2+x3 ≤ 430; 3x1+2x3 ≤ 460; x1+4x2 ≤ 420. Óptimo: x2=100, x3=230, z=1350.</div>' +
      '<div class="base-info"></div>' +
      '<div class="grid-2">' +
      '<div class="panel"><div class="panel-title">Cambiar b (lado derecho)</div>' +
      '<div class="row"><label>b1 <input class="b1" value="430" style="width:5em"></label>' +
      '<label>b2 <input class="b2" value="460" style="width:5em"></label>' +
      '<label>b3 <input class="b3" value="420" style="width:5em"></label>' +
      '<button class="btn btn-sm btn-b">Recalcular</button></div>' +
      '<div class="b-result"></div></div>' +
      '<div class="panel"><div class="panel-title">Cambiar c (función objetivo)</div>' +
      '<div class="row"><label>c1 <input class="c1" value="3" style="width:5em"></label>' +
      '<label>c2 <input class="c2" value="2" style="width:5em"></label>' +
      '<label>c3 <input class="c3" value="5" style="width:5em"></label>' +
      '<button class="btn btn-sm btn-c">Recalcular</button></div>' +
      '<div class="c-result"></div></div>' +
      '</div>' +
      '<div class="panel wide"><div class="panel-title">Agregar nueva variable</div>' +
      '<div class="row"><label>a1 <input class="na1" value="1" style="width:5em"></label>' +
      '<label>a2 <input class="na2" value="1" style="width:5em"></label>' +
      '<label>a3 <input class="na3" value="1" style="width:5em"></label>' +
      '<label>c<sub>nueva</sub> <input class="nc" value="4" style="width:5em"></label>' +
      '<button class="btn btn-sm btn-nv">Evaluar</button></div>' +
      '<div class="nv-result"></div></div>' +
      '<div class="tab-holder"></div>' +
      '<div class="step-bar row">' +
      '<button class="btn btn-sm btn-prev">◀ Anterior</button>' +
      '<button class="btn btn-sm btn-next">Siguiente ▶</button>' +
      '<button class="btn btn-sm btn-all">Resolver todo</button>' +
      '<button class="btn btn-sm btn-reset btn-ghost">Reiniciar</button>' +
      '</div><div class="step-text"></div>';

    var baseInfo = root.querySelector('.base-info');
    var tabHolder = root.querySelector('.tab-holder');
    var stepText = root.querySelector('.step-text');
    var stepper = { tab: null, history: [], mode: null, finished: null };

    function renderBaseInfo() {
      var Binv = TOYCO.Binv;
      var cB = TOYCO.basis.map(function (idx) { return TOYCO.c[idx]; });
      var y = vecMat(cB, Binv);
      var s = '<div class="kv"><div>B⁻¹</div><div>' +
        Binv.map(function (row) { return '[' + row.map(function (v) { return v.toHTML(); }).join(', ') + ']'; }).join('<br>') +
        '</div><div>c<sub>B</sub></div><div>[' + cB.map(function (v) { return v.toHTML(); }).join(', ') + ']</div>' +
        '<div>y = c<sub>B</sub>B⁻¹</div><div>(' + y.map(function (v) { return v.toHTML(); }).join(', ') + ')</div></div>';
      baseInfo.innerHTML = s;
    }
    renderBaseInfo();

    function renderStepper(finalMsgIfNone) {
      if (!stepper.tab) { tabHolder.innerHTML = ''; stepText.innerHTML = finalMsgIfNone || ''; return; }
      tabHolder.innerHTML = tabToHTML(stepper.tab, stepper.lastInfo || {});
      stepText.innerHTML = stepper.msg || '';
    }

    function stepOnce() {
      if (!stepper.tab || stepper.finished) return false;
      var info = stepper.mode === 'dual' ? dualStep(stepper.tab) : primalStep(stepper.tab);
      if (info.optimal) {
        stepper.finished = 'optimal';
        stepper.msg = '<span class="badge badge-ok">Óptimo' + (stepper.mode === 'dual' ? ' y factible' : '') + '.</span> z = ' + trueObjective(stepper.tab).toHTML() + '.';
        stepper.lastInfo = {};
        renderStepper();
        return false;
      }
      if (info.infeasible) { stepper.finished = 'infeasible'; stepper.msg = '<span class="badge badge-err">No factible.</span>'; stepper.lastInfo = {}; renderStepper(); return false; }
      if (info.unbounded) { stepper.finished = 'unbounded'; stepper.msg = '<span class="badge badge-warn">No acotado.</span>'; stepper.lastInfo = {}; renderStepper(); return false; }
      var pr = info.leaving, pc = info.entering;
      stepper.msg = 'Sale <strong>' + esc(stepper.tab.names[stepper.tab.rows[pr].basis]) + '</strong>, entra <strong>' + esc(stepper.tab.names[pc]) + '</strong>. Pivote = ' + info.pivotVal.toHTML() + '.';
      stepper.tab = pivot(stepper.tab, pr, pc);
      stepper.history.push(cloneTab(stepper.tab));
      stepper.lastInfo = { pivotRow: pr, pivotCol: pc };
      renderStepper();
      return true;
    }
    root.querySelector('.btn-next').addEventListener('click', stepOnce);
    root.querySelector('.btn-all').addEventListener('click', function () { var g = 0; while (stepOnce() && g < 50) g++; });
    root.querySelector('.btn-prev').addEventListener('click', function () {
      if (stepper.history.length > 1) { stepper.history.pop(); stepper.tab = cloneTab(stepper.history[stepper.history.length - 1]); stepper.finished = null; stepper.lastInfo = {}; renderStepper(); }
    });
    root.querySelector('.btn-reset').addEventListener('click', function () { stepper.tab = null; stepper.history = []; stepper.finished = null; renderStepper('Use "Cambiar b", "Cambiar c" o "Agregar variable" para iniciar un recálculo.'); });

    root.querySelector('.btn-b').addEventListener('click', function () {
      var b = [F.from(root.querySelector('.b1').value), F.from(root.querySelector('.b2').value), F.from(root.querySelector('.b3').value)];
      var tab = buildToycoTableau(b, TOYCO.c);
      var neg = tab.rows.some(function (r) { return r.rhs.isNeg(); });
      var resDiv = root.querySelector('.b-result');
      if (!neg) {
        resDiv.innerHTML = '<span class="badge badge-ok">Sigue factible.</span> X<sub>B</sub> = B⁻¹b = (' +
          tab.rows.map(function (r) { return r.rhs.toHTML(); }).join(', ') + '), z = ' + tab.z.rhs.toHTML() + '.';
        stepper.tab = null; renderStepper('');
      } else {
        resDiv.innerHTML = '<span class="badge badge-warn">Deja de ser factible</span> (algún X<sub>B</sub> negativo). Se ejecuta simplex dual:';
        stepper.tab = tab; stepper.history = [cloneTab(tab)]; stepper.mode = 'dual'; stepper.finished = null; stepper.lastInfo = {};
        stepper.msg = 'Tabla con nuevo b, aún óptima (misma fila z) pero no factible. Pulse «Siguiente ▶».';
        renderStepper();
      }
    });

    root.querySelector('.btn-c').addEventListener('click', function () {
      var c = TOYCO.c.slice();
      c[0] = F.from(root.querySelector('.c1').value);
      c[1] = F.from(root.querySelector('.c2').value);
      c[2] = F.from(root.querySelector('.c3').value);
      var tab = buildToycoTableau(TOYCO.b, c);
      var neg = tab.z.vals.some(function (v) { return v.isNeg(); });
      var resDiv = root.querySelector('.c-result');
      if (!neg) {
        resDiv.innerHTML = '<span class="badge badge-ok">Sigue óptima.</span> z = ' + tab.z.rhs.toHTML() + '.';
        stepper.tab = null; renderStepper('');
      } else {
        resDiv.innerHTML = '<span class="badge badge-warn">Deja de ser óptima</span> (algún z<sub>j</sub>−c<sub>j</sub> negativo). Se ejecuta simplex primal:';
        stepper.tab = tab; stepper.history = [cloneTab(tab)]; stepper.mode = 'primal'; stepper.finished = null; stepper.lastInfo = {};
        stepper.msg = 'Tabla con nuevo c, aún factible (mismo X<sub>B</sub>) pero no óptima. Pulse «Siguiente ▶».';
        renderStepper();
      }
    });

    root.querySelector('.btn-nv').addEventListener('click', function () {
      var a = [F.from(root.querySelector('.na1').value), F.from(root.querySelector('.na2').value), F.from(root.querySelector('.na3').value)];
      var cNew = F.from(root.querySelector('.nc').value);
      var Binv = TOYCO.Binv;
      var cB = TOYCO.basis.map(function (idx) { return TOYCO.c[idx]; });
      var y = vecMat(cB, Binv);
      var col = matVec(Binv, a);
      var reduced = dot(y, a).sub(cNew);
      var resDiv = root.querySelector('.nv-result');
      if (reduced.cmp(fz()) >= 0) {
        resDiv.innerHTML = 'Costo reducido y·a − c = ' + reduced.toHTML() + ' ≥ 0. <span class="badge badge-warn">No conviene incorporarla.</span>';
        stepper.tab = null; renderStepper('');
      } else {
        resDiv.innerHTML = 'Costo reducido y·a − c = ' + reduced.toHTML() + ' &lt; 0. <span class="badge badge-ok">Conviene incorporarla.</span> Columna en la tabla: (' + col.map(function (v) { return v.toHTML(); }).join(', ') + '). Se agrega y se corre simplex primal:';
        var tab = buildToycoTableau(TOYCO.b, TOYCO.c);
        tab.names = tab.names.slice(); tab.names.splice(3, 0, 'xN');
        tab.rows = tab.rows.map(function (r, i) { var vv = r.vals.slice(); vv.splice(3, 0, col[i]); return { basis: r.basis >= 3 ? r.basis + 1 : r.basis, vals: vv, rhs: r.rhs }; });
        var zv = tab.z.vals.slice(); zv.splice(3, 0, reduced); // z_j - c_j for new var = y·a - c
        tab.z = { vals: zv, rhs: tab.z.rhs };
        stepper.tab = tab; stepper.history = [cloneTab(tab)]; stepper.mode = 'primal'; stepper.finished = null; stepper.lastInfo = {};
        stepper.msg = 'Nueva variable xN agregada con costo reducido negativo. Pulse «Siguiente ▶».';
        renderStepper();
      }
    });

    renderStepper('Use "Cambiar b", "Cambiar c" o "Agregar variable" para iniciar un recálculo.');
  }

  /* ---------------------------------------------------------------------
   * 7. Contenido teórico
   * ------------------------------------------------------------------- */
  var S1 = '<p>Todo problema de programación lineal (el <strong>primal</strong>) tiene asociado otro problema lineal, el ' +
    '<strong>dual</strong>, construido a partir de los mismos datos (coeficientes, restricciones, lado derecho) pero ' +
    'con los papeles invertidos: los coeficientes del lado derecho del primal pasan a ser los coeficientes objetivo del dual, ' +
    'y viceversa.</p>' +
    '<div class="callout callout-def"><strong>Definición.</strong> Si el primal es max z = Σ c<sub>j</sub>x<sub>j</sub> sujeto a ' +
    'Σ a<sub>ij</sub>x<sub>j</sub> {≤,≥,=} b<sub>i</sub>, el dual es min w = Σ b<sub>i</sub>y<sub>i</sub> con una variable y<sub>i</sub> ' +
    'por cada restricción primal y una restricción dual por cada variable primal.</div>' +
    '<p>La correspondencia exacta entre signos se resume en la tabla de reglas (Taha, tabla 4.1):</p>' +
    '<div class="canvas-wrap" style="overflow-x:auto"><table class="data"><thead><tr><th>Primal (max)</th><th>Dual (min)</th></tr>' +
    '<tr><th>Primal (min)</th><th>Dual (max)</th></tr></thead><tbody>' +
    '<tr><td>Restricción ≤</td><td>y<sub>i</sub> ≥ 0</td></tr>' +
    '<tr><td>Restricción ≥</td><td>y<sub>i</sub> ≤ 0</td></tr>' +
    '<tr><td>Restricción =</td><td>y<sub>i</sub> irrestricta</td></tr>' +
    '<tr><td>x<sub>j</sub> ≥ 0</td><td>restricción dual ≥ (si primal max) / ≤ (si primal min)</td></tr>' +
    '<tr><td>x<sub>j</sub> ≤ 0</td><td>restricción dual ≤ (si primal max) / ≥ (si primal min)</td></tr>' +
    '<tr><td>x<sub>j</sub> irrestricta</td><td>restricción dual =</td></tr>' +
    '</tbody></table></div>' +
    '<div class="callout callout-tip">Regla mnemónica: si el primal es <em>max</em>, las restricciones ≤ dan variables duales ≥0 ' +
    '(el "sentido natural"); si el primal es <em>min</em>, se invierte todo.</div>' +
    '<p><strong>Ejemplo resuelto (Reddy Mikks).</strong> Primal: max z = 5x1 + 4x2; 6x1+4x2≤24; x1+2x2≤6; −x1+x2≤1; x2≤2; x≥0. ' +
    'Como las cuatro restricciones son ≤ y las variables son ≥0, el dual es: min w = 24y1+6y2+y3+2y4; ' +
    '6y1+y2−y3≥5; 4y1+2y2+y3+y4≥4; y≥0. La solución óptima del dual es y = (3/4, 1/2, 0, 0), con w* = 21 — el mismo valor ' +
    'que z* = 21 del primal (dualidad fuerte).</p>' +
    '<div class="widget wide" data-widget="dual-builder"></div>' +
    '<div class="exercise"><p><strong>Ejercicio.</strong> Escriba el dual de: min z = 4x1 + x2; 3x1 + x2 = 3; 4x1 + 3x2 ≥ 6; x1 + 2x2 ≤ 4; x ≥ 0.</p>' +
    '<details class="solution"><summary>Ver solución</summary><p>max w = 3y1 + 6y2 + 4y3; 3y1+4y2+y3 ≤ 4; y1+3y2+2y3 ≤ 1; ' +
    'y1 irrestricta (por la igualdad), y2 ≥ 0, y3 ≤ 0 (restricción ≤ en un primal de min).</p></details></div>' +
    '<div class="exercise"><p><strong>Ejercicio.</strong> Escriba el dual de Reddy Mikks y verifique que w* coincide con z* = 21.</p>' +
    '<details class="solution"><summary>Ver solución</summary><p>Ver el ejemplo resuelto arriba: y=(3/4,1/2,0,0), w*=21=z*.</p></details></div>';

  var S2 = '<p>Toda la información del dual está escondida dentro de la tabla óptima del primal, sin necesidad de resolver el ' +
    'dual por separado. Esto se explica con álgebra de matrices: si B es la matriz de columnas de las variables básicas óptimas, ' +
    'B⁻¹ aparece bajo las columnas donde originalmente estaban las variables de holgura (la base inicial).</p>' +
    '<div class="callout callout-def"><strong>Tres métodos para obtener y* desde la tabla óptima:</strong>' +
    '<ol><li><strong>Matricial:</strong> y = c<sub>B</sub>B⁻¹ (vector fila de costos básicos por la inversa de B).</li>' +
    '<li><strong>Por las holguras:</strong> el coeficiente z<sub>j</sub>−c<sub>j</sub> que queda bajo la variable de holgura ' +
    'de la restricción i, sumado al costo original de esa holgura (que es 0), es directamente y<sub>i</sub>.</li>' +
    '<li><strong>Fórmula general:</strong> y<sub>i</sub> = z<sub>j</sub> − c<sub>j</sub> de la variable que ocupaba inicialmente ' +
    'la posición básica i (holgura, artificial, etc.), independientemente de cuál sea.</li></ol></div>' +
    '<p><strong>Cálculos con la tabla:</strong> la columna que aparece bajo cualquier variable no básica j es B⁻¹a<sub>j</sub>, ' +
    'y su coeficiente en la fila z es z<sub>j</sub> − c<sub>j</sub> = y·a<sub>j</sub> − c<sub>j</sub> (esto es exactamente lo que ' +
    'usa el análisis postóptimo para revisar cambios sin resolver de nuevo desde cero).</p>' +
    '<p><strong>Ejemplo TOYCO.</strong> max z=3x1+2x2+5x3; x1+2x2+x3≤430; 3x1+2x3≤460; x1+4x2≤420. La base óptima es (x2,x3,s3) con ' +
    'B⁻¹ = [[1/2,−1/4,0],[0,1/2,0],[−2,1,1]] y c<sub>B</sub>=(2,5,0). Por el método 1: y = c<sub>B</sub>B⁻¹ = (1,2,0). ' +
    'Por el método 2: los coeficientes z<sub>j</sub>−c<sub>j</sub> bajo s1, s2, s3 son exactamente 1, 2 y 0.</p>' +
    '<div class="callout callout-def"><strong>Dualidad débil y fuerte.</strong> Para cualquier solución factible x del primal ' +
    '(max) y cualquier solución factible y del dual: z(x) ≤ w(y) (dualidad débil). En el óptimo de ambos, z* = w* (dualidad fuerte).</div>' +
    '<div class="exercise"><p><strong>Ejercicio.</strong> Con B⁻¹ y c<sub>B</sub> de TOYCO, calcule la columna que tendría x1 en la ' +
    'tabla óptima (a<sub>x1</sub> = (1,3,1)) y su costo reducido.</p><details class="solution"><summary>Ver solución</summary>' +
    '<p>B⁻¹a<sub>x1</sub> = (−1/4, 3/2, 2). Costo reducido = y·a<sub>x1</sub> − c<sub>x1</sub> = (1·1+2·3+0·1) − 3 = 7−3 = 4 ≥ 0: ' +
    'confirma que x1 no conviene incorporar (la solución ya es óptima sin ella).</p></details></div>';

  var S3 = '<p>Las variables duales tienen una lectura económica directa: y<sub>i</sub> es el <strong>valor por unidad</strong> ' +
    '(o precio sombra) del recurso i — cuánto aumentaría z si se dispusiera de una unidad más de ese recurso.</p>' +
    '<div class="callout callout-def"><strong>Interpretación en TOYCO</strong> (y1=1, y2=2, y3=0): el recurso 1 vale 1 por unidad, ' +
    'el recurso 2 vale 2 por unidad, y el recurso 3 (y3=0) está <strong>sobrante</strong> (no se usa por completo: 400 de 420 ' +
    'disponibles) — una unidad extra de un recurso abundante no cambia z.</div>' +
    '<p>Las restricciones del dual también tienen sentido económico: para la actividad j, y·a<sub>j</sub> es el ' +
    '<strong>costo de los recursos</strong> que consume, y c<sub>j</sub> es su ingreso. El <strong>costo reducido</strong> ' +
    'es y·a<sub>j</sub> − c<sub>j</sub> (costo de recursos − ingreso).</p>' +
    '<div class="callout callout-tip">«Vale la pena producir» la actividad j si su costo reducido y·a<sub>j</sub> − c<sub>j</sub> ≤ 0 ' +
    '(el ingreso alcanza para pagar los recursos que consume). Si es &gt; 0, no conviene: los recursos rinden más en otro lado.</div>' +
    '<div class="exercise"><p><strong>Ejercicio.</strong> En TOYCO, ¿por qué x1 no entra en la solución óptima?</p>' +
    '<details class="solution"><summary>Ver solución</summary><p>Porque su costo reducido es 4 &gt; 0: el costo de los recursos ' +
    'que usaría (7 por unidad) supera su ingreso (3 por unidad).</p></details></div>';

  var S4 = '<p>El <strong>simplex dual</strong> resuelve problemas que arrancan <em>óptimos pero no factibles</em> (algún lado ' +
    'derecho negativo), justo lo contrario del simplex normal (que arranca factible pero no óptimo). Es útil cuando ya se tiene ' +
    'una tabla óptima y cambia el lado derecho, volviéndola infactible.</p>' +
    '<div class="callout callout-def"><strong>Algoritmo (simplex dual):</strong>' +
    '<ol><li>Sale de la base la variable con el <strong>lado derecho más negativo</strong>.</li>' +
    '<li>Entre las columnas con coeficiente a<sub>rj</sub> &lt; 0 en esa fila, entra la que minimiza |z<sub>j</sub>−c<sub>j</sub>| / |a<sub>rj</sub>|.</li>' +
    '<li>Se pivotea con Gauss-Jordan igual que en el simplex normal.</li>' +
    '<li>Se repite hasta que todos los lados derechos sean ≥ 0 (óptimo y factible). Si una fila con LD negativo no tiene ningún ' +
    'a<sub>rj</sub> &lt; 0, el problema es <strong>no factible</strong>.</li></ol></div>' +
    '<p><strong>Ejemplo resuelto:</strong> min z = 3x1 + 2x2; 3x1+x2≥3; 4x1+3x2≥6; x1+x2≤3. Convirtiendo las ≥ en ≤ (multiplicando ' +
    'por −1) se arranca con una tabla óptima-pero-infactible; tras dos pivotes (sale s2, entra x2; luego sale s1, entra x1) se ' +
    'llega a x* = (3/5, 6/5), z* = 21/5.</p>' +
    '<div class="widget wide" data-widget="dual-simplex"></div>' +
    '<div class="callout callout-tip"><strong>Simplex generalizado.</strong> Cuando una tabla no es ni óptima ni factible, se ' +
    'alterna entre pasos de simplex dual (para recuperar factibilidad) y simplex primal (para recuperar optimalidad) hasta ' +
    'que ambas condiciones se cumplan.</div>' +
    '<div class="exercise"><p><strong>Ejercicio.</strong> ¿Por qué el simplex dual empieza siendo "óptimo"?</p>' +
    '<details class="solution"><summary>Ver solución</summary><p>Porque se arma la tabla de forma que la fila z ya cumple la ' +
    'condición de optimalidad (todos los z<sub>j</sub>−c<sub>j</sub> ≥ 0 para un problema de maximización interno), aunque algún ' +
    'lado derecho sea negativo (infactible).</p></details></div>';

  var S5 = '<p>El análisis postóptimo estudia qué pasa con la solución óptima cuando cambian los datos del modelo, sin resolver ' +
    'todo desde cero — se reutiliza la tabla óptima y B⁻¹.</p>' +
    '<div class="callout callout-def"><strong>Cambios que afectan la factibilidad</strong> (cambiar b): se recalcula ' +
    'X<sub>B</sub> = B⁻¹b. Si sigue ≥ 0, la solución sigue siendo óptima con los nuevos valores. Si algún componente es negativo, ' +
    'la tabla queda óptima-pero-infactible y se corre el <strong>simplex dual</strong> para recuperar la factibilidad. Agregar una ' +
    'restricción nueva se trata igual: se agrega una fila y, si la solución actual la viola, se resuelve con simplex dual.</div>' +
    '<div class="callout callout-def"><strong>Cambios que afectan la optimalidad</strong> (cambiar c, o agregar una variable): se ' +
    'recalcula la fila z completa (z<sub>j</sub>−c<sub>j</sub> = y·a<sub>j</sub> − c<sub>j</sub> para todo j, con y = c<sub>B</sub>B⁻¹ ' +
    'actualizado). Si todos siguen ≥ 0, la solución sigue óptima (solo cambia z). Si no, se corre el <strong>simplex primal</strong> ' +
    'desde esa tabla. Para una variable nueva con columna a y costo c, el costo reducido y·a − c decide si conviene incorporarla.</div>' +
    '<p><strong>Ejemplo TOYCO.</strong> Si b pasa a (500, 460, 420): X<sub>B</sub> = B⁻¹b = (135, 230, −120) → s3 queda negativo, ' +
    'se necesita simplex dual. Si c3 baja a 1: el costo reducido de x1 cambia y hay que revisar si sigue conviniendo la base actual.</p>' +
    '<div class="widget wide" data-widget="toyco-postopt"></div>' +
    '<div class="exercise"><p><strong>Ejercicio.</strong> En TOYCO, si b1 pasara a 200, ¿sigue factible la base (x2,x3,s3)?</p>' +
    '<details class="solution"><summary>Ver solución</summary><p>X<sub>B</sub> = B⁻¹(200,460,420) = (1/2·200−1/4·460, 1/2·460, ' +
    '−2·200+460+420) = (−15, 230, 480): x2 sale negativo → no factible, hace falta simplex dual.</p></details></div>' +
    '<div class="callout callout-exam"><strong>Lo que suele tomar el parcial:</strong> construir el dual de un primal dado (con ' +
    '=, ≥, ≤ y variables irrestrictas), obtener y* por los tres métodos desde una tabla óptima, interpretar económicamente los ' +
    'valores duales y los costos reducidos, ejecutar simplex dual a mano en un ejemplo de 2 variables, y decidir si un cambio de ' +
    'b o de c mantiene la optimalidad/factibilidad de TOYCO.</div>';

  var CSS = '' +
    '#cap4 .editor-holder table.input-grid input, #cap4 .editor-holder table.input-grid select { width: 4.5em; }' +
    '#cap4 .dual-result .formula { text-align:left; }' +
    '#cap4 .base-info .kv { grid-template-columns: max-content 1fr; }' +
    '#cap4 table.tableau td.z-row, #cap4 tr.z-row td { font-weight:600; }' +
    '#cap4 .step-text { min-height: 2.4em; }' +
    '#cap4 .known-box { margin-top: .5rem; }';

  /* ---------------------------------------------------------------------
   * 8. Quiz
   * ------------------------------------------------------------------- */
  var QUIZ = [
    { q: 'En un primal de maximización, una restricción "≤" genera una variable dual…', options: ['≥ 0', '≤ 0', 'irrestricta', 'no genera variable'], answer: 0, explain: 'Regla de Taha: max + ≤ ⇒ y ≥ 0.' },
    { q: 'Si la variable primal x_j es irrestricta, la restricción dual asociada es…', options: ['≤', '≥', '=', 'no hay restricción'], answer: 2, explain: 'Variable irrestricta ⇒ restricción dual de igualdad.' },
    { q: 'Dual de Reddy Mikks: ¿cuál es el valor óptimo de w?', type: 'number', answer: 21, tol: 0.01, explain: 'w* = 21, igual a z* del primal (dualidad fuerte).' },
    { q: 'Dual de Reddy Mikks: ¿cuánto vale y1 en el óptimo?', type: 'number', answer: 0.75, tol: 0.01, explain: 'y* = (3/4, 1/2, 0, 0).' },
    { q: 'Para un primal (max) factible y su dual factible, siempre se cumple…', options: ['z ≥ w siempre', 'z ≤ w siempre, y z = w en el óptimo', 'z = w siempre', 'no hay relación entre z y w'], answer: 1, explain: 'Dualidad débil (z ≤ w) y fuerte en el óptimo (z* = w*).' },
    { q: 'En TOYCO, y3 = 0 significa que…', options: ['el recurso 3 es escaso', 'el recurso 3 está sobrante (no se usa por completo)', 'x3 no se produce', 'el problema es no acotado'], answer: 1, explain: 'El recurso 3 tiene holgura (400 de 420 usados); un recurso abundante vale 0 por unidad extra.' },
    { q: 'El costo reducido (costo de recursos − ingreso) de una actividad nueva es negativo. Esto significa que…', options: ['conviene incorporarla a la solución', 'no conviene incorporarla', 'ya está en la base', 'el dual es no acotado'], answer: 0, explain: 'Costo reducido ≤ 0 ⇒ el ingreso alcanza para pagar los recursos: conviene producir.' },
    { q: 'En el simplex dual, la variable que SALE de la base es la que tiene…', options: ['el coeficiente más negativo en la fila z', 'el lado derecho (LD) más negativo', 'la razón mínima', 'el mayor costo'], answer: 1, explain: 'Sale la fila con LD más negativo (la más infactible).' },
    { q: 'En el simplex dual, la variable que ENTRA se elige con…', options: ['el coeficiente más negativo de la fila z', 'el cociente mínimo |z_j−c_j| / |a_rj| entre los a_rj < 0 de la fila que sale', 'el mayor a_rj positivo', 'cualquier variable no básica'], answer: 1, explain: 'Se prueba solo con columnas de coeficiente negativo en la fila que sale.' },
    { q: 'Resuelva por simplex dual: min z = 3x1 + 2x2; 3x1+x2≥3; 4x1+3x2≥6; x1+x2≤3. ¿Valor óptimo de z?', type: 'number', answer: 4.2, tol: 0.02, explain: 'z* = 21/5 = 4.2, en x* = (3/5, 6/5).' },
    { q: 'Si al cambiar b algún X_B = B⁻¹b resulta negativo, la tabla queda óptima pero no factible. ¿Qué método recupera la factibilidad?', options: ['simplex primal', 'simplex dual', 'método M', 'hay que resolver todo de nuevo'], answer: 1, explain: 'El simplex dual está hecho justamente para eso: arranca óptimo-infactible.' },
    { q: 'Al agregar una variable nueva con columna a y costo c, si el costo reducido y·a − c es negativo (max), la solución actual…', options: ['sigue óptima', 'deja de ser óptima y conviene incorporar la variable', 'deja de ser factible', 'no cambia'], answer: 1, explain: 'Costo reducido negativo en max ⇒ hay margen de mejora, conviene incorporarla y correr simplex primal.' }
  ];

  /* ---------------------------------------------------------------------
   * 9. Registro del capítulo
   * ------------------------------------------------------------------- */
  IO.registerChapter({
    id: 'cap4',
    num: 4,
    title: 'Dualidad y análisis postóptimo',
    summary: 'El problema dual, las relaciones primal-dual, su interpretación económica, el simplex dual y el análisis postóptimo.',
    css: CSS,
    sections: [
      { id: 'cap4-s1', title: '4.1 Definición del problema dual', html: S1 },
      { id: 'cap4-s2', title: '4.2 Relaciones primal-dual', html: S2 },
      { id: 'cap4-s3', title: '4.3 Interpretación económica de la dualidad', html: S3 },
      { id: 'cap4-s4', title: '4.4 Algoritmo simplex dual (y simplex generalizado)', html: S4 },
      { id: 'cap4-s5', title: '4.5 Análisis postóptimo', html: S5 }
    ],
    mount: function (root) {
      root.querySelectorAll('[data-widget]').forEach(function (w) {
        var kind = w.getAttribute('data-widget');
        try {
          if (kind === 'dual-builder') mountDualBuilder(w);
          else if (kind === 'dual-simplex') mountDualSimplex(w);
          else if (kind === 'toyco-postopt') mountPostopt(w);
        } catch (e) {
          w.innerHTML = '<div class="callout callout-warn">Error al montar widget: ' + esc(e.message) + '</div>';
        }
      });
    },
    quiz: QUIZ
  });

  /* Test hook (no-op in production; used by node test harness only). */
  window.IO._cap4Internal = {
    buildDual: buildDual, buildDualSimplexInitial: buildDualSimplexInitial, dualStep: dualStep, primalStep: primalStep,
    pivot: pivot, trueObjective: trueObjective, varValue: varValue, buildToycoTableau: buildToycoTableau,
    DUAL_EXAMPLES: DUAL_EXAMPLES, DUALSIMPLEX_EXAMPLES: DUALSIMPLEX_EXAMPLES, TOYCO: TOYCO
  };
})();
