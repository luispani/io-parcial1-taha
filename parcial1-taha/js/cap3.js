/* Cap 3 — Método simplex y análisis de sensibilidad. Owner: C.
 * Depende de js/lib/frac.js y js/lib/simplex.js (cargados antes en index.html).
 * Solo usa las clases CSS globales de §3 más su propio CSS prefijado #cap3.
 */
(function (global) {
  'use strict';
  var IO = global.IO = global.IO || { chapters: [] };
  IO.registerChapter = IO.registerChapter || function (ch) { IO.chapters.push(ch); };
  var S = IO.Simplex;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function opSym(op) { return op === '<=' ? '≤' : op === '>=' ? '≥' : '='; }
  function fracHTML(f) { return f && f.toHTML ? f.toHTML() : String(f); }
  // Formatea un límite de rango (RHS u optimalidad) que puede ser un Frac, null/undefined
  // (sin límite) o los primitivos Infinity/-Infinity que puede devolver el motor simplex.
  function fmtBound(val, isLower) {
    if (val === null || val === undefined) return isLower ? '−∞' : '+∞';
    if (val === Infinity) return '+∞';
    if (val === -Infinity) return '−∞';
    return fracHTML(val);
  }
  // Un límite inferior "sin restricción" es null/undefined o -Infinity; análogo para el superior.
  function isUnboundedLower(val) { return val === null || val === undefined || val === -Infinity; }
  function isUnboundedUpper(val) { return val === null || val === undefined || val === Infinity; }

  /* ================= Ejemplos precargados ================= */
  var EXAMPLES = {
    reddy: {
      label: 'Reddy Mikks (max, holguras)',
      method: 'bigM',
      spec: {
        type: 'max', c: [5, 4], varNames: ['x1', 'x2'],
        constraints: [
          { a: [6, 4], op: '<=', b: 24 },
          { a: [1, 2], op: '<=', b: 6 },
          { a: [-1, 1], op: '<=', b: 1 },
          { a: [0, 1], op: '<=', b: 2 }
        ]
      }
    },
    toyco: {
      label: 'TOYCO (max, sensibilidad)',
      method: 'bigM',
      spec: {
        type: 'max', c: [3, 2, 5], varNames: ['x1', 'x2', 'x3'],
        constraints: [
          { a: [1, 2, 1], op: '<=', b: 430 },
          { a: [3, 0, 2], op: '<=', b: 460 },
          { a: [1, 4, 0], op: '<=', b: 420 }
        ]
      }
    },
    twophase: {
      label: 'Dos fases (min, artificial + = y ≥)',
      method: 'twophase',
      spec: {
        type: 'min', c: [4, 1], varNames: ['x1', 'x2'],
        constraints: [
          { a: [3, 1], op: '=', b: 3 },
          { a: [4, 3], op: '>=', b: 6 },
          { a: [1, 2], op: '<=', b: 4 }
        ]
      }
    },
    degenerate: {
      label: 'Degeneración',
      method: 'bigM',
      spec: {
        type: 'max', c: [3, 9], varNames: ['x1', 'x2'],
        constraints: [
          { a: [1, 4], op: '<=', b: 8 },
          { a: [1, 2], op: '<=', b: 4 }
        ]
      }
    },
    alternative: {
      label: 'Óptimos alternativos',
      method: 'bigM',
      spec: {
        type: 'max', c: [2, 4], varNames: ['x1', 'x2'],
        constraints: [
          { a: [1, 2], op: '<=', b: 5 },
          { a: [1, 1], op: '<=', b: 4 }
        ]
      }
    },
    unbounded: {
      label: 'No acotado',
      method: 'bigM',
      spec: {
        type: 'max', c: [2, 1], varNames: ['x1', 'x2'],
        constraints: [
          { a: [1, -1], op: '<=', b: 10 },
          { a: [2, 0], op: '<=', b: 40 }
        ]
      }
    },
    infeasible: {
      label: 'No factible',
      method: 'bigM',
      spec: {
        type: 'max', c: [3, 2], varNames: ['x1', 'x2'],
        constraints: [
          { a: [2, 1], op: '<=', b: 2 },
          { a: [3, 4], op: '>=', b: 12 }
        ]
      }
    }
  };

  var STATUS_LABEL = {
    optimal: 'Óptima', degenerate: 'Óptima (con degeneración en el camino)',
    alternative: 'Óptima (con soluciones alternativas)',
    unbounded: 'No acotada', infeasible: 'No factible',
    iteration_limit: 'Límite de iteraciones alcanzado (no óptimo)'
  };
  var STATUS_BADGE = {
    optimal: 'badge-ok', degenerate: 'badge-warn', alternative: 'badge-warn',
    unbounded: 'badge-err', infeasible: 'badge-err', iteration_limit: 'badge-err'
  };

  /* ================= Widget 1: Simplex paso a paso ================= */
  function mountStepper(root) {
    var elModel = root.querySelector('.sx-model');
    var elExample = root.querySelector('.sx-example');
    var elMethod = root.querySelector('.sx-method');
    var elN = root.querySelector('.sx-n');
    var elM = root.querySelector('.sx-m');
    var elType = root.querySelector('.sx-type');
    var elBuild = root.querySelector('.sx-build');
    var elTableauWrap = root.querySelector('.sx-tableau-wrap');
    var elStepText = root.querySelector('.sx-step-text');
    var elCase = root.querySelector('.sx-case');
    var elPrev = root.querySelector('.sx-prev');
    var elNext = root.querySelector('.sx-next');
    var elAll = root.querySelector('.sx-all');
    var elReset = root.querySelector('.sx-reset');
    var elCounter = root.querySelector('.sx-counter');

    var state = { model: null, result: null, idx: 0 };

    function buildGrid() {
      var n = Math.max(1, Math.min(5, parseInt(elN.value, 10) || 2));
      var m = Math.max(1, Math.min(5, parseInt(elM.value, 10) || 2));
      elN.value = n; elM.value = m;
      var html = '<div class="row" style="align-items:flex-start;gap:20px;flex-wrap:wrap">';
      html += '<div><p class="muted">Función objetivo (' + (elType.value === 'max' ? 'maximizar' : 'minimizar') + ' z)</p><div class="input-grid sx-crow">';
      for (var j = 0; j < n; j++) html += '<input type="text" class="sx-c" data-j="' + j + '" value="1" aria-label="c' + (j + 1) + '" placeholder="c' + (j + 1) + '">';
      html += '</div></div></div>';
      html += '<table class="data sx-conrows"><thead><tr><th>Restricción</th>';
      for (j = 0; j < n; j++) html += '<th>x' + (j + 1) + '</th>';
      html += '<th>Operador</th><th>RHS</th></tr></thead><tbody>';
      for (var i = 0; i < m; i++) {
        html += '<tr><td>R' + (i + 1) + '</td>';
        for (j = 0; j < n; j++) html += '<td><input type="text" class="sx-a" data-i="' + i + '" data-j="' + j + '" value="1" style="width:64px"></td>';
        html += '<td><select class="sx-op" data-i="' + i + '"><option value="<=">≤</option><option value=">=">≥</option><option value="=">=</option></select></td>';
        html += '<td><input type="text" class="sx-b" data-i="' + i + '" value="1" style="width:70px"></td>';
        html += '</tr>';
      }
      html += '</tbody></table>';
      elModel.innerHTML = html;
    }

    function loadExample(key) {
      var ex = EXAMPLES[key];
      elType.value = ex.spec.type;
      elMethod.value = ex.method;
      elN.value = ex.spec.c.length;
      elM.value = ex.spec.constraints.length;
      buildGrid();
      ex.spec.c.forEach(function (v, j) { elModel.querySelector('.sx-c[data-j="' + j + '"]').value = v; });
      ex.spec.constraints.forEach(function (con, i) {
        con.a.forEach(function (v, j) { elModel.querySelector('.sx-a[data-i="' + i + '"][data-j="' + j + '"]').value = v; });
        elModel.querySelector('.sx-op[data-i="' + i + '"]').value = con.op;
        elModel.querySelector('.sx-b[data-i="' + i + '"]').value = con.b;
      });
      run();
    }

    function readModel() {
      var n = parseInt(elN.value, 10), m = parseInt(elM.value, 10);
      var c = [];
      for (var j = 0; j < n; j++) c.push(elModel.querySelector('.sx-c[data-j="' + j + '"]').value || 0);
      var constraints = [];
      for (var i = 0; i < m; i++) {
        var a = [];
        for (j = 0; j < n; j++) a.push(elModel.querySelector('.sx-a[data-i="' + i + '"][data-j="' + j + '"]').value || 0);
        constraints.push({
          a: a,
          op: elModel.querySelector('.sx-op[data-i="' + i + '"]').value,
          b: elModel.querySelector('.sx-b[data-i="' + i + '"]').value || 0
        });
      }
      return { type: elType.value, c: c, constraints: constraints };
    }

    function run() {
      try {
        var spec = readModel();
        var model = S.parse(spec);
        var result = S.solve(model, { method: elMethod.value });
        state.model = model; state.result = result; state.idx = 0;
        render();
      } catch (e) {
        elTableauWrap.innerHTML = '<p class="callout callout-warn">No se pudo resolver el modelo: ' + esc(e.message) + '</p>';
        elStepText.textContent = '';
        elCase.innerHTML = '';
      }
    }

    function render() {
      var iters = state.result.iterations;
      var it = iters[state.idx];
      elTableauWrap.innerHTML = '<div class="tableau-wrap">' + S.toHTML(it, state.model.varNames) + '</div>';
      var phaseTxt = it.phase ? ('[Fase ' + it.phase + '] ') : '';
      // it.note puede incluir <span class="frac"> (viene del propio motor simplex, no de input de usuario).
      elStepText.innerHTML = phaseTxt + it.note;
      elCounter.textContent = 'Paso ' + (state.idx + 1) + ' / ' + iters.length;
      elPrev.disabled = state.idx === 0;
      elNext.disabled = state.idx === iters.length - 1;
      if (state.idx === iters.length - 1) {
        var badge = STATUS_BADGE[state.result.status] || 'badge';
        var html = '<span class="badge ' + badge + '">' + (STATUS_LABEL[state.result.status] || state.result.status) + '</span>';
        if (state.result.status === 'iteration_limit') {
          html += '<p class="callout callout-warn" style="margin-top:10px">Se alcanzó el límite de iteraciones; el resultado no es óptimo.</p>';
        } else if (state.result.optimal) {
          html += '<div class="kv" style="margin-top:10px">';
          html += '<div><span>z*</span><span>' + fracHTML(state.result.optimal.z) + ' (' + state.result.optimal.z.toFixed(4) + ')</span></div>';
          Object.keys(state.result.optimal.x).forEach(function (name) {
            var v = state.result.optimal.x[name];
            if (!v.isZero()) html += '<div><span>' + esc(name) + '</span><span>' + fracHTML(v) + '</span></div>';
          });
          html += '</div>';
        }
        elCase.innerHTML = html;
      } else {
        elCase.innerHTML = '';
      }
    }

    elExample.addEventListener('change', function () { loadExample(elExample.value); });
    elBuild.addEventListener('click', buildGrid);
    elModel.addEventListener('change', run);
    elMethod.addEventListener('change', run);
    elType.addEventListener('change', function () { buildGrid(); run(); });
    elPrev.addEventListener('click', function () { if (state.idx > 0) { state.idx--; render(); } });
    elNext.addEventListener('click', function () { if (state.result && state.idx < state.result.iterations.length - 1) { state.idx++; render(); } });
    elAll.addEventListener('click', function () { if (state.result) { state.idx = state.result.iterations.length - 1; render(); } });
    elReset.addEventListener('click', function () { if (state.result) { state.idx = 0; render(); } });

    Object.keys(EXAMPLES).forEach(function (key) {
      var opt = document.createElement('option');
      opt.value = key; opt.textContent = EXAMPLES[key].label;
      elExample.appendChild(opt);
    });
    elExample.value = 'reddy';
    loadExample('reddy');
  }

  /* ================= Widget 2: Sensibilidad algebraica ================= */
  function mountSensitivity(root) {
    var elExample = root.querySelector('.sn-example');
    var elOut = root.querySelector('.sn-out');
    var elWhatB = root.querySelector('.sn-whatb-i');
    var elWhatBVal = root.querySelector('.sn-whatb-val');
    var elWhatBBtn = root.querySelector('.sn-whatb-btn');
    var elWhatBOut = root.querySelector('.sn-whatb-out');
    var elWhatC = root.querySelector('.sn-whatc-j');
    var elWhatCVal = root.querySelector('.sn-whatc-val');
    var elWhatCBtn = root.querySelector('.sn-whatc-btn');
    var elWhatCOut = root.querySelector('.sn-whatc-out');

    var state = { model: null, result: null };

    function load(key) {
      var ex = EXAMPLES[key];
      var model = S.parse(ex.spec);
      var result = S.solve(model, { method: ex.method });
      state.model = model; state.result = result;
      renderMain();
      fillSelectors();
    }

    function renderMain() {
      var res = state.result, model = state.model;
      if (res.status === 'iteration_limit') {
        elOut.innerHTML = '<p class="callout callout-warn">Se alcanzó el límite de iteraciones; el resultado no es óptimo. Elija TOYCO u otro ejemplo con óptimo para ver la sensibilidad.</p>';
        return;
      }
      if (!res.optimal) { elOut.innerHTML = '<p class="callout callout-warn">Este ejemplo no tiene un óptimo finito con solución única; elija TOYCO u otro ejemplo con óptimo para ver la sensibilidad.</p>'; return; }
      var sens = res.sensitivity;
      var html = '<div class="grid-2">';
      html += '<div><p class="panel-title" style="font-size:1rem">Solución óptima</p><div class="kv">';
      html += '<div><span>z*</span><span>' + fracHTML(res.optimal.z) + '</span></div>';
      Object.keys(res.optimal.x).forEach(function (name) {
        var v = res.optimal.x[name];
        if (!v.isZero()) html += '<div><span>' + esc(name) + '</span><span>' + fracHTML(v) + '</span></div>';
      });
      html += '</div></div>';
      html += '<div><p class="panel-title" style="font-size:1rem">Precios duales (y<sub>i</sub>)</p><div class="kv">';
      sens.duals.forEach(function (y, i) { html += '<div><span>Restricción ' + (i + 1) + '</span><span>' + fracHTML(y) + '</span></div>'; });
      html += '</div></div></div>';

      html += '<p class="panel-title" style="font-size:1rem;margin-top:14px">Rangos de factibilidad del lado derecho (b<sub>i</sub>)</p>';
      html += '<table class="data"><thead><tr><th>Restricción</th><th>b actual</th><th>Rango factible</th></tr></thead><tbody>';
      sens.rhsRanges.forEach(function (rr, i) {
        html += '<tr><td>R' + (i + 1) + '</td><td>' + fracHTML(model.b[i]) + '</td><td>' +
          fmtBound(rr.lower, true) + ' ≤ b' + (i + 1) + ' ≤ ' + fmtBound(rr.upper, false) + '</td></tr>';
      });
      html += '</tbody></table>';

      html += '<p class="panel-title" style="font-size:1rem;margin-top:14px">Rangos de optimalidad de c<sub>j</sub> y costos reducidos</p>';
      html += '<table class="data"><thead><tr><th>Variable</th><th>c actual</th><th>Rango de optimalidad</th><th>Costo reducido</th></tr></thead><tbody>';
      sens.cRanges.forEach(function (cr) {
        var name = model.varNames[cr.j];
        var rc = sens.reducedCosts[name];
        html += '<tr><td>' + esc(name) + '</td><td>' + fracHTML(model.cRow[cr.j]) + '</td><td>' +
          fmtBound(cr.lower, true) + ' ≤ c ≤ ' + fmtBound(cr.upper, false) + '</td><td>' +
          (rc !== undefined ? fracHTML(rc) : '0 (básica)') + '</td></tr>';
      });
      html += '</tbody></table>';
      elOut.innerHTML = html;
    }

    function fillSelectors() {
      var model = state.model;
      elWhatB.innerHTML = '';
      model.b.forEach(function (b, i) {
        var opt = document.createElement('option'); opt.value = i; opt.textContent = 'b' + (i + 1) + ' (actual ' + b.toString() + ')';
        elWhatB.appendChild(opt);
      });
      elWhatBVal.value = model.b[0] ? model.b[0].toNumber() : 0;
      elWhatC.innerHTML = '';
      for (var j = 0; j < model.nDecision; j++) {
        var opt2 = document.createElement('option'); opt2.value = j; opt2.textContent = model.varNames[j] + ' (actual ' + model.cRow[j].toString() + ')';
        elWhatC.appendChild(opt2);
      }
      elWhatCVal.value = model.cRow[0] ? model.cRow[0].toNumber() : 0;
      elWhatBOut.innerHTML = ''; elWhatCOut.innerHTML = '';
    }

    function whatIfB() {
      if (!state.result.sensitivity) {
        elWhatBOut.innerHTML = '<span class="badge badge-warn">Sin datos de sensibilidad</span> Este ejemplo no llegó a un óptimo (por ejemplo, se agotaron las iteraciones); elija otro ejemplo.';
        return;
      }
      var i = parseInt(elWhatB.value, 10);
      var newB = global.Frac.from(String(elWhatBVal.value).trim() === "" ? 0 : elWhatBVal.value);
      var rr = state.result.sensitivity.rhsRanges[i];
      var inRange = (isUnboundedLower(rr.lower) || newB.cmp(rr.lower) >= 0) && (isUnboundedUpper(rr.upper) || newB.cmp(rr.upper) <= 0);
      var html;
      if (inRange) {
        html = '<span class="badge badge-ok">Sigue óptima la misma base</span> La base actual sigue siendo factible y óptima; solo cambian los valores de las variables básicas (recalcule X<sub>B</sub> = B⁻¹b con el nuevo b).';
      } else {
        html = '<span class="badge badge-warn">La base actual deja de ser factible</span> b' + (i + 1) + ' = ' + newB.toString() +
          ' sale del rango [' + fmtBound(rr.lower, true) + ', ' + fmtBound(rr.upper, false) +
          ']. Hace falta resolver de nuevo (por ejemplo con simplex dual) porque alguna variable básica se volvería negativa.';
      }
      elWhatBOut.innerHTML = html;
    }

    function whatIfC() {
      if (!state.result.sensitivity) {
        elWhatCOut.innerHTML = '<span class="badge badge-warn">Sin datos de sensibilidad</span> Este ejemplo no llegó a un óptimo (por ejemplo, se agotaron las iteraciones); elija otro ejemplo.';
        return;
      }
      var j = parseInt(elWhatC.value, 10);
      var newC = global.Frac.from(String(elWhatCVal.value).trim() === "" ? 0 : elWhatCVal.value);
      var cr = state.result.sensitivity.cRanges[j];
      var inRange = (isUnboundedLower(cr.lower) || newC.cmp(cr.lower) >= 0) && (isUnboundedUpper(cr.upper) || newC.cmp(cr.upper) <= 0);
      var name = state.model.varNames[j];
      var html;
      if (inRange) {
        html = '<span class="badge badge-ok">Sigue óptima la misma base</span> c<sub>' + esc(name) + '</sub> = ' + newC.toString() +
          ' está dentro del rango de optimalidad; la solución óptima actual no cambia (z* sí cambia si la variable es básica).';
      } else {
        html = '<span class="badge badge-warn">Cambia la base óptima</span> c<sub>' + esc(name) + '</sub> = ' + newC.toString() +
          ' sale del rango [' + fmtBound(cr.lower, true) + ', ' + fmtBound(cr.upper, false) +
          ']. Hace falta recomputar la fila z y seguir iterando con simplex primal.';
      }
      elWhatCOut.innerHTML = html;
    }

    elExample.addEventListener('change', function () { load(elExample.value); });
    elWhatBBtn.addEventListener('click', whatIfB);
    elWhatCBtn.addEventListener('click', whatIfC);
    Object.keys(EXAMPLES).forEach(function (key) {
      var opt = document.createElement('option');
      opt.value = key; opt.textContent = EXAMPLES[key].label;
      elExample.appendChild(opt);
    });
    elExample.value = 'toyco';
    load('toyco');
  }

  /* ================= Secciones (teoría, ejemplos, ejercicios) ================= */

  var s31 = '<p>Para aplicar el método simplex, todo modelo de PL se escribe primero en <strong>forma de ecuación</strong>: ' +
    'todas las restricciones se convierten en igualdades y todas las variables quedan restringidas a valores no negativos.</p>' +
    '<div class="callout callout-def"><strong>Definición.</strong> Forma de ecuación de un modelo de PL: ' +
    '(1) toda restricción ≤ recibe una <em>variable de holgura</em> s<sub>i</sub> ≥ 0 que se suma; ' +
    '(2) toda restricción ≥ recibe una <em>variable de excedente</em> e<sub>i</sub> ≥ 0 que se resta; ' +
    '(3) toda restricción = queda igual, pero en el método simplex necesita además una <em>variable artificial</em> R<sub>i</sub> ≥ 0 ' +
    '(y las ≥ también, sumada, para tener un punto de partida factible con solución básica identidad); ' +
    '(4) si el lado derecho b es negativo, se multiplica toda la restricción por −1 (lo que invierte el sentido de la desigualdad); ' +
    '(5) una variable libre (sin restricción de signo) x se reemplaza por x = x⁺ − x⁻, con x⁺, x⁻ ≥ 0.</p></div>' +
    '<p><strong>Ejemplo (Reddy Mikks).</strong> max z = 5x1 + 4x2 sujeto a:</p>' +
    '<div class="formula">6x1 + 4x2 ≤ 24<br>x1 + 2x2 ≤ 6<br>−x1 + x2 ≤ 1<br>x2 ≤ 2<br>x1, x2 ≥ 0</div>' +
    '<p>En forma de ecuación (con holguras s1..s4):</p>' +
    '<div class="formula">6x1 + 4x2 + s1 = 24<br>x1 + 2x2 + s2 = 6<br>−x1 + x2 + s3 = 1<br>x2 + s4 = 2</div>' +
    '<div class="exercise"><p><strong>Ejercicio.</strong> Escriba en forma de ecuación: min z = 4x1 + x2; 3x1 + x2 = 3; 4x1 + 3x2 ≥ 6; x1 + 2x2 ≤ 4.</p>' +
    '<details class="solution"><summary>Ver solución</summary><p>3x1 + x2 + R1 = 3; 4x1 + 3x2 − e2 + R2 = 6; x1 + 2x2 + s3 = 4. ' +
    'Se agregan artificiales R1 (por la igualdad) y R2 (por la ≥) porque no hay una variable "de holgura" natural que dé una base identidad inicial en esas dos filas.</p></details></div>';

  var s32 = '<div class="callout callout-def"><strong>Solución básica.</strong> Dado un sistema de m ecuaciones con n incógnitas (n ≥ m) en forma de ecuación, ' +
    'una solución básica se obtiene igualando a 0 exactamente n − m variables (las <em>no básicas</em>) y resolviendo el sistema cuadrado resultante para las m restantes ' +
    '(las <em>variables básicas</em>). Si además todas las variables básicas resultan ≥ 0, la solución se llama <strong>básica factible</strong>.</div>' +
    '<p>El número de soluciones básicas posibles (eligiendo qué n − m variables poner en 0) está acotado por la combinación</p>' +
    '<div class="formula eq">C(n, m) = n! / (m! (n − m)!)</div>' +
    '<p>Cada solución básica factible corresponde exactamente a un <strong>punto extremo (vértice)</strong> de la región factible, y viceversa: ' +
    'esta es la conexión clave entre la solución gráfica del cap. 2 y el álgebra del simplex — el simplex es, en el fondo, ' +
    'una forma inteligente de recorrer vértices sin enumerarlos todos.</p>' +
    '<div class="exercise"><p><strong>Ejercicio.</strong> Para Reddy Mikks en forma de ecuación (n = 6 variables: x1,x2,s1..s4; m = 4 ecuaciones), ' +
    '¿cuántas soluciones básicas como máximo pueden existir?</p><details class="solution"><summary>Ver solución</summary>' +
    '<p>C(6,4) = 15. No todas son factibles: el óptimo (3, 1.5) es una de las soluciones básicas factibles, con s3 = 5/2 y s4 = 1/2 básicas y x1, x2 también básicas (m = 4 básicas, n − m = 2 no básicas: s1 = s2 = 0).</p></details></div>';

  var s33 = '<p>El método simplex es <strong>iterativo</strong>: parte de una solución básica factible inicial (típicamente el origen, con las holguras como base) ' +
    'y en cada paso se mueve a un vértice adyacente que mejora (o al menos no empeora) el valor de z, hasta que ninguna mejora es posible.</p>' +
    '<div class="callout callout-def"><strong>Condición de optimalidad.</strong> En un problema de <em>maximización</em>, entra a la base la variable no básica ' +
    'con el coeficiente <strong>más negativo</strong> en la fila z (así aumenta z lo más rápido posible por unidad). En <em>minimización</em>, entra la de coeficiente ' +
    '<strong>más positivo</strong>. Si ningún candidato cumple la condición, la solución actual ya es óptima.</div>' +
    '<div class="callout callout-def"><strong>Condición de factibilidad (regla del cociente mínimo).</strong> Entre las filas con coeficiente positivo en la columna entrante, ' +
    'sale de la base la variable de la fila con el <strong>cociente mínimo</strong> RHS / coeficiente. Esto garantiza que ninguna variable básica se vuelva negativa.</div>' +
    '<p>El pivoteo se hace con <strong>operaciones de Gauss-Jordan</strong>: la fila pivote se divide entera por el elemento pivote (para dejar un 1 en esa posición), ' +
    'y a cada una de las demás filas (incluida la fila z) se le resta un múltiplo adecuado de la fila pivote para dejar ceros en el resto de la columna pivote.</p>' +
    '<div class="callout callout-tip"><strong>Resumen del algoritmo.</strong>' +
    '<ol><li>Forma de ecuación y tabla inicial (base = holguras/artificiales).</li>' +
    '<li>¿Óptima? (condición de optimalidad). Si sí, parar.</li>' +
    '<li>Elegir variable entrante.</li><li>Cociente mínimo → variable saliente. Si no hay cocientes, el problema no está acotado.</li>' +
    '<li>Pivotear (Gauss-Jordan) y volver al paso 2.</li></ol></div>' +
    '<p>Use el widget «Simplex paso a paso» de la sección 3.7 para seguir Reddy Mikks tabla por tabla (3 tablas hasta el óptimo (3, 1.5), z = 21).</p>' +
    '<div class="exercise"><p><strong>Ejercicio.</strong> En la tabla inicial de Reddy Mikks (base = s1..s4), la fila z es (−5, −4, 0, 0, 0, 0 | 0). ¿Qué variable entra primero y por qué?</p>' +
    '<details class="solution"><summary>Ver solución</summary><p>Entra x1: es una maximización, y −5 es el coeficiente más negativo de la fila z (más negativo que el −4 de x2).</p></details></div>';

  var s34 = '<p>Cuando una restricción es <strong>=</strong> o <strong>≥</strong>, no hay una variable natural con coeficiente +1 aislado en esa fila para arrancar la base; ' +
    'se agrega una <strong>variable artificial</strong> R<sub>i</sub> ≥ 0 solo para tener una base identidad inicial. Como R<sub>i</sub> no tiene significado físico, ' +
    'el método debe forzarla a valer 0 en la solución final. Hay dos formas de lograrlo:</p>' +
    '<div class="callout callout-def"><strong>Método M (Big-M).</strong> Se penaliza cada artificial en la función objetivo con un costo enorme M ' +
    '(−M en max, +M en min), de modo que el simplex la expulsa de la base en cuanto puede. Los coeficientes de la fila z quedan de la forma a + bM ' +
    '(por ejemplo "−4 − 3M"), y para comparar dos coeficientes primero se compara el término en M y, si empatan, el término constante.</div>' +
    '<div class="callout callout-def"><strong>Método de dos fases.</strong> Fase I: se resuelve un problema auxiliar que minimiza r = Σ R<sub>i</sub> ' +
    '(ignorando la función objetivo original). Si el óptimo de la fase I da r = 0, hay una solución factible para el problema original y se eliminan ' +
    'las columnas artificiales; si r > 0, el problema original es no factible. Fase II: se restaura la función objetivo real (recalculando la fila z sobre ' +
    'la base con la que terminó la fase I) y se sigue iterando con simplex normal.</div>' +
    '<p><strong>Ejemplo.</strong> min z = 4x1 + x2 sujeto a 3x1 + x2 = 3; 4x1 + 3x2 ≥ 6; x1 + 2x2 ≤ 4; x ≥ 0. ' +
    'Óptimo: x1 = 2/5, x2 = 9/5, z = 17/5 — verificado con ambos métodos (M y dos fases) en el widget, dan la misma solución.</p>' +
    '<div class="exercise"><p><strong>Ejercicio.</strong> ¿Por qué la restricción x1 + 2x2 ≤ 4 no necesita variable artificial?</p>' +
    '<details class="solution"><summary>Ver solución</summary><p>Porque al ser ≤ con b ≥ 0, su holgura s3 ya aporta un coeficiente +1 aislado, ' +
    'suficiente para formar la base identidad inicial en esa fila sin necesidad de una artificial.</p></details></div>';

  var s35 = '<p>El tableau simplex puede mostrar cuatro situaciones especiales, todas detectables mirando la tabla:</p>' +
    '<div class="grid-2">' +
    '<div class="callout callout-warn"><strong>Degeneración.</strong> Una variable básica vale 0 (empate en la regla del cociente mínimo). ' +
    'Ejemplo: max 3x1 + 9x2; x1 + 4x2 ≤ 8; x1 + 2x2 ≤ 4. El óptimo (0, 2), z = 18 se alcanza pasando por una tabla con una variable básica en 0. ' +
    'No cambia el resultado final, pero en teoría puede (rara vez) causar ciclos.</div>' +
    '<div class="callout callout-warn"><strong>Óptimos alternativos.</strong> En la tabla óptima, una variable no básica tiene coeficiente 0 en la fila z: ' +
    'se puede meter a la base sin cambiar z, y existe todo un segmento de soluciones óptimas. Ejemplo: max 2x1 + 4x2; x1 + 2x2 ≤ 5; x1 + x2 ≤ 4; z* = 10 ' +
    'se alcanza tanto en (0, 2.5) como en (3, 1).</div>' +
    '<div class="callout callout-warn"><strong>No acotado.</strong> La columna de la variable entrante no tiene ningún coeficiente positivo: se puede aumentar ' +
    'esa variable indefinidamente sin violar ninguna restricción, y z crece (o decrece) sin límite. Ejemplo: max 2x1 + x2; x1 − x2 ≤ 10; 2x1 ≤ 40.</div>' +
    '<div class="callout callout-warn"><strong>No factible.</strong> Al terminar (M o fase I), alguna variable artificial sigue básica con valor positivo: ' +
    'no existe ninguna solución que cumpla todas las restricciones simultáneamente. Ejemplo: max 3x1 + 2x2; 2x1 + x2 ≤ 2; 3x1 + 4x2 ≥ 12.</div>' +
    '</div>' +
    '<div class="callout callout-exam">En el parcial suelen pedir <em>identificar</em> el caso especial mirando una tabla ya armada, más que llegar a ella a mano. ' +
    'Practique reconociéndolos con el widget: cargue cada ejemplo y mire qué fila/columna delata el caso.</div>' +
    '<div class="exercise"><p><strong>Ejercicio.</strong> En la tabla óptima de "max 2x1+4x2; x1+2x2≤5; x1+x2≤4", la variable no básica x1 tiene coeficiente 0 en la fila z. ' +
    '¿Qué caso especial es y qué otra solución óptima existe además de (0, 2.5)?</p><details class="solution"><summary>Ver solución</summary>' +
    '<p>Es el caso de óptimos alternativos: (3, 1) también da z = 10 (2·3 + 4·1 = 10), igual que (0, 2.5) (2·0 + 4·2.5 = 10). Cualquier combinación convexa entre ambos puntos también es óptima.</p></details></div>';

  var s36 = '<p>El análisis de sensibilidad estudia cómo cambia la solución óptima cuando cambian los datos del modelo (b, c, o los coeficientes a<sub>ij</sub>), ' +
    'sin tener que resolver todo el problema desde cero. La versión <strong>gráfica</strong> ya se vio en el widget de sensibilidad del cap. 2 ' +
    '(pendientes de las rectas iso-z y precio dual visual); acá se hace lo mismo de manera <strong>algebraica</strong>, leyendo directamente el tableau óptimo.</p>' +
    '<div class="callout callout-def"><strong>Precio dual (valor por unidad de recurso), y<sub>i</sub>.</strong> Es el coeficiente de la fila z bajo la columna de la ' +
    'holgura (o artificial) de la restricción i en la tabla óptima. Mide cuánto mejora z por cada unidad adicional de b<sub>i</sub> (dentro del rango de factibilidad).</div>' +
    '<div class="callout callout-def"><strong>Rango de factibilidad de b<sub>i</sub>.</strong> Intervalo de valores de b<sub>i</sub> para el cual la <em>misma base</em> ' +
    'sigue siendo óptima (solo cambian los valores numéricos de las variables básicas, vía X<sub>B</sub> = B⁻¹b).</div>' +
    '<div class="callout callout-def"><strong>Costo reducido y rango de optimalidad de c<sub>j</sub>.</strong> El costo reducido de una variable no básica ' +
    '(z<sub>j</sub> − c<sub>j</sub>) mide cuánto empeoraría z si se forzara a esa variable a entrar. El rango de optimalidad de c<sub>j</sub> es el intervalo en el que ' +
    'puede moverse ese costo sin que cambie la base óptima.</div>' +
    '<p><strong>Ejemplo TOYCO.</strong> max z = 3x1 + 2x2 + 5x3; x1+2x2+x3 ≤ 430; 3x1+2x3 ≤ 460; x1+4x2 ≤ 420. ' +
    'Óptimo: x2 = 100, x3 = 230, z = 1350. Precios duales y = (1, 2, 0) — el recurso 3 (holgura s3 = 20) es abundante, por eso su precio dual es 0. ' +
    'Rangos de factibilidad: b1 ∈ [230, 440], b2 ∈ [440, 860], b3 ≥ 400 (verificado con el widget).</p>' +
    '<div class="callout callout-warn"><strong>Nota sobre esta guía.</strong> Si en sus apuntes vio "b3 ≥ 20" para TOYCO, revíselo: 20 es el valor de la holgura ' +
    's3 en el óptimo (b3 puede <em>bajar</em> hasta 400 antes de que la base cambie), no el propio límite de b3. El widget recalcula esto con aritmética exacta y da 400.</div>' +
    '<div class="exercise"><p><strong>Ejercicio.</strong> En TOYCO, ¿qué pasa si b2 sube a 500?</p><details class="solution"><summary>Ver solución</summary>' +
    '<p>500 está dentro de [440, 860], así que la base actual (x2, x3, s3) sigue siendo óptima; solo cambian los valores numéricos de x2, x3 y s3 ' +
    '(pruébelo con el widget «Sensibilidad algebraica», pregunta «¿qué pasa si b2 = 500?»).</p></details></div>';

  var s37 = '<p>Temas de cálculo que Taha solo desarrolla como idea (no entran en detalle en el parcial escrito):</p>' +
    '<ul><li><strong>Tamaño del problema.</strong> El número de tablas que hay que recorrer crece mucho con m y n; en la práctica se usan versiones ' +
    'computacionales (simplex revisado) que no arman la tabla completa.</li>' +
    '<li><strong>Degeneración.</strong> En teoría puede producir ciclos infinitos; en la práctica casi nunca ocurre, y reglas como la de Bland (usada en este ' +
    'motor para deshacer empates) lo evitan.</li>' +
    '<li><strong>Simplex revisado.</strong> Variante que solo guarda B⁻¹ y recalcula columnas bajo demanda, mucho más eficiente para problemas grandes; ' +
    'la idea es la misma que el tableau completo, solo cambia qué se almacena.</li></ul>' +
    '<div class="exercise"><p><strong>Ejercicio.</strong> ¿Por qué la regla de Bland (elegir la variable de menor índice para desempatar en la fila/columna) evita ciclos infinitos por degeneración?</p>' +
    '<details class="solution"><summary>Ver solución</summary><p>Porque impone un orden fijo y estrictamente decreciente sobre qué variables pueden repetirse en la base; ' +
    'sin un criterio de desempate así, dos o más pivotes degenerados podrían alternarse indefinidamente sin que z cambie.</p></details></div>' +
    '<div class="widget wide" data-widget="simplex-stepper">' +
    '<p class="panel-title">Simplex paso a paso</p>' +
    '<div class="row"><div class="example-picker"><label>Ejemplo: <select class="sx-example"></select></label></div>' +
    '<label>Tipo: <select class="sx-type"><option value="max">Maximizar</option><option value="min">Minimizar</option></select></label>' +
    '<label>Variables (n≤5): <input type="number" class="sx-n" min="1" max="5" value="2" style="width:56px"></label>' +
    '<label>Restricciones (m≤5): <input type="number" class="sx-m" min="1" max="5" value="4" style="width:56px"></label>' +
    '<button type="button" class="btn btn-sm sx-build">Reconstruir editor</button>' +
    '<label>Método: <select class="sx-method"><option value="bigM">Método M</option><option value="twophase">Dos fases</option><option value="auto">Auto</option></select></label>' +
    '</div><div class="sx-model"></div>' +
    '<div class="step-bar"><button type="button" class="btn btn-sm sx-prev">◀ Anterior</button>' +
    '<span class="step-text sx-step-text"></span>' +
    '<span class="muted sx-counter"></span>' +
    '<button type="button" class="btn btn-sm sx-next">Siguiente ▶</button>' +
    '<button type="button" class="btn btn-sm sx-all">Resolver todo</button>' +
    '<button type="button" class="btn btn-ghost btn-sm sx-reset">Reiniciar</button></div>' +
    '<div class="sx-tableau-wrap"></div><div class="sx-case"></div></div>' +
    '<div class="widget wide" data-widget="sensitivity-algebraic">' +
    '<p class="panel-title">Sensibilidad algebraica</p>' +
    '<div class="row"><div class="example-picker"><label>Ejemplo: <select class="sn-example"></select></label></div></div>' +
    '<div class="sn-out"></div>' +
    '<div class="grid-2" style="margin-top:14px">' +
    '<div class="panel"><p class="panel-title" style="font-size:1rem">¿Qué pasa si b<sub>i</sub> = …?</p>' +
    '<div class="row"><select class="sn-whatb-i"></select><input type="number" class="sn-whatb-val" step="any" style="width:90px">' +
    '<button type="button" class="btn btn-sm sn-whatb-btn">Evaluar</button></div><div class="sn-whatb-out muted" style="margin-top:8px"></div></div>' +
    '<div class="panel"><p class="panel-title" style="font-size:1rem">¿Qué pasa si c<sub>j</sub> = …?</p>' +
    '<div class="row"><select class="sn-whatc-j"></select><input type="number" class="sn-whatc-val" step="any" style="width:90px">' +
    '<button type="button" class="btn btn-sm sn-whatc-btn">Evaluar</button></div><div class="sn-whatc-out muted" style="margin-top:8px"></div></div>' +
    '</div></div>';

  /* ================= Quiz (14 preguntas) ================= */
  var QUIZ = [
    { q: 'Una restricción "x1 + x2 ≥ 10" en forma de ecuación necesita:', options: ['Solo una holgura', 'Una variable de excedente y una artificial', 'Solo una variable artificial', 'Nada, ya es una igualdad'], answer: 1, explain: 'Se resta una variable de excedente e para llegar a la igualdad, y se suma una artificial R para tener base inicial.' },
    { q: 'Si el lado derecho de una restricción es negativo, ¿qué se hace antes de identificar holgura/excedente/artificial?', options: ['Se ignora el signo', 'Se multiplica toda la restricción por −1 (invirtiendo el operador)', 'Se elimina la restricción', 'Se agrega una variable libre'], answer: 1, explain: 'Así el RHS queda ≥ 0, requisito para arrancar el simplex con una base no negativa.' },
    { q: 'Una solución básica se obtiene igualando a 0:', options: ['Todas las variables', 'm variables (tantas como ecuaciones)', 'n − m variables (las no básicas)', 'Ninguna variable'], answer: 2, explain: 'Con n variables y m ecuaciones, se ponen en 0 las n − m no básicas y se resuelve para las m básicas.' },
    { q: 'Toda solución básica factible corresponde a:', options: ['Un punto interior de la región factible', 'Un punto extremo (vértice) de la región factible', 'El origen siempre', 'Una recta completa'], answer: 1, explain: 'Es la conexión clave entre la solución gráfica (cap. 2) y el álgebra del simplex.' },
    { q: 'En un problema de maximización, la condición de optimalidad dice que entra a la base la variable no básica con:', options: ['El coeficiente más positivo en la fila z', 'El coeficiente más negativo en la fila z', 'El mayor cociente RHS/coeficiente', 'Cualquier coeficiente distinto de 0'], answer: 1, explain: 'En max entra el más negativo; en min, el más positivo.' },
    { q: '¿Qué determina qué variable sale de la base?', options: ['La variable con coeficiente más negativo en la fila z', 'El cociente mínimo entre RHS y el coeficiente positivo de la columna entrante', 'La primera fila de la tabla', 'La variable con el valor más grande'], answer: 1, explain: 'Regla del cociente mínimo (condición de factibilidad).' },
    { q: '¿Para qué sirven las variables artificiales?', options: ['Para maximizar más rápido', 'Para dar una base identidad inicial en restricciones = o ≥', 'Para eliminar variables libres', 'Para graficar la región factible'], answer: 1, explain: 'No tienen significado físico; solo arrancan el simplex y deben salir de la base (o valer 0) al final.' },
    { q: 'En el método M, si un coeficiente de la fila z es "−4 − 3M" y otro es "−4 − 2M", ¿cuál es más negativo?', options: ['−4 − 3M (el término en M decide primero)', '−4 − 2M', 'Son iguales', 'No se pueden comparar'], answer: 0, explain: 'Con M muy grande, primero se compara el coeficiente de M; −3M domina sobre −2M.' },
    { q: 'En el método de dos fases, si la fase I termina con r > 0, entonces:', options: ['Hay múltiples óptimos', 'El problema es no acotado', 'El problema original es no factible', 'Hay que repetir la fase I con otro método'], answer: 2, explain: 'r > 0 significa que quedó una variable artificial positiva: no hay solución que cumpla todas las restricciones.' },
    { q: 'Una tabla óptima tiene una variable no básica con coeficiente 0 en la fila z. Esto indica:', options: ['No factibilidad', 'No acotamiento', 'Óptimos alternativos', 'Degeneración'], answer: 2, explain: 'Esa variable podría entrar sin cambiar z: existe todo un segmento de soluciones óptimas.' },
    { q: 'Si al elegir la columna entrante ninguna fila tiene coeficiente positivo, el problema es:', options: ['No factible', 'No acotado', 'Degenerado', 'Óptimo'], answer: 1, explain: 'Sin cocientes válidos, la variable entrante puede crecer indefinidamente: no acotado.' },
    { q: 'Para TOYCO (max z = 3x1+2x2+5x3; óptimo x2=100, x3=230), el precio dual de la restricción 3 es 0 porque:', options: ['Esa restricción está activa (sin holgura)', 'Esa restricción tiene holgura positiva (recurso abundante)', 'x1 es básica', 'El modelo es no factible'], answer: 1, explain: 'Un recurso con holgura positiva (no todo se usa) tiene precio dual 0: una unidad más no mejora z.' },
    { q: 'El rango de factibilidad de b_i es el intervalo donde:', options: ['Cambia la base óptima', 'La misma base sigue óptima, solo cambian los valores de las variables básicas', 'z se vuelve negativo', 'La solución deja de existir'], answer: 1, explain: 'Fuera de ese rango, alguna variable básica se volvería negativa y hay que resolver de nuevo.' },
    { q: 'Con z = 3x1+2x2+5x3, x2=100, x3=230, z=1350 (TOYCO): ¿cuál es el valor óptimo de z?', type: 'number', answer: 1350, tol: 0.01, explain: 'z* = 3(0) + 2(100) + 5(230) = 200 + 1150 = 1350.' }
  ];

  IO.registerChapter({
    id: 'cap3',
    num: 3,
    title: 'Método simplex y análisis de sensibilidad',
    summary: 'Forma de ecuación, soluciones básicas, el algoritmo simplex con método M y dos fases, casos especiales, y sensibilidad algebraica (precios duales y rangos), con dos widgets interactivos con aritmética exacta.',
    css: '#cap3 .sx-conrows td, #cap3 .sx-conrows th { text-align: center; } ' +
      '#cap3 .sx-crow input, #cap3 .sx-a, #cap3 .sx-b { text-align: center; } ' +
      '#cap3 .z-row td, #cap3 .z-row th { background: rgba(199,125,26,.06); font-weight: 700; } ' +
      '#cap3 .sx-case { margin-top: 10px; } ' +
      '#cap3 details.solution p { margin: 8px 0 0; }',
    sections: [
      { id: 'cap3-s1', title: '3.1 Forma de ecuación de un modelo de PL', html: s31 },
      { id: 'cap3-s2', title: '3.2 De la solución gráfica a la algebraica', html: s32 },
      { id: 'cap3-s3', title: '3.3 El método simplex', html: s33 },
      { id: 'cap3-s4', title: '3.4 Solución artificial inicial: método M y dos fases', html: s34 },
      { id: 'cap3-s5', title: '3.5 Casos especiales', html: s35 },
      { id: 'cap3-s6', title: '3.6 Análisis de sensibilidad', html: s36 },
      { id: 'cap3-s7', title: '3.7 Temas de cálculo y widgets', html: s37 }
    ],
    mount: function (root) {
      var stepperEl = root.querySelector('[data-widget="simplex-stepper"]');
      if (stepperEl) mountStepper(stepperEl);
      var sensEl = root.querySelector('[data-widget="sensitivity-algebraic"]');
      if (sensEl) mountSensitivity(sensEl);
    },
    quiz: QUIZ
  });
})(typeof window !== 'undefined' ? window : globalThis);
