/* Cap 2 — Modelado con programación lineal. Owner: B.
 * Depends on: js/lib/frac.js (Frac, optional decorative use), window.IO contract (see SPEC.md §2).
 */
(function () {
  'use strict';
  window.IO = window.IO || { chapters: [] };
  IO.registerChapter = IO.registerChapter || function (ch) { IO.chapters.push(ch); };
  /* Fallback si cap2.js carga antes que app.js (ver SPEC.md §2, "Desmontaje y limpieza"). */
  IO.registerCleanup = IO.registerCleanup || function (fn) { (IO._cleanups = IO._cleanups || []).push(fn); };

  var EPS = 1e-7;

  /* =========================================================================
   * 1) MOTOR GEOMÉTRICO PARA PL DE 2 VARIABLES
   *
   *    Estado factible/óptimo se decide con análisis matemático exacto:
   *      (a) los vértices factibles son las intersecciones de cada par de
   *          rectas (restricciones + ejes x1=0, x2=0) que satisfacen TODAS
   *          las restricciones y la no negatividad;
   *      (b) si no hay ningún vértice factible, la región es vacía (el cono
   *          de no negatividad x,y≥0 es puntiagudo, así que si la región no
   *          es vacía siempre tiene al menos un vértice) → 'infeasible';
   *      (c) el problema es no acotado sii existe una dirección de recesión
   *          d=(d1,d2)≠0, con d≥0, que cumple homogéneamente cada restricción
   *          (a·d≤0 para ≤, a·d≥0 para ≥, a·d=0 para =) y mejora el objetivo
   *          (c·d>0 en max, c·d<0 en min). El cono de recesión en 2D es
   *          poliédrico y puntiagudo, así que basta probar sus posibles
   *          direcciones extremas: (1,0), (0,1) y ±(−b_i,a_i) de cada recta;
   *      (d) si no hay dirección de recesión que mejore z, el óptimo está en
   *          un vértice; dos o más vértices con el mismo z (tolerancia
   *          relativa) → 'alternative'.
   *
   *    El recorte de semiplanos (Sutherland-Hodgman) se conserva solo para
   *    DIBUJAR la región (recortada a la ventana visible); nunca decide
   *    acotación ni factibilidad.
   * ========================================================================= */

  function clipHalfPlane(poly, a, b, c) {
    // conserva los puntos donde a*x + b*y <= c (+EPS)
    var n = poly.length;
    if (n === 0) return [];
    var out = [];
    for (var i = 0; i < n; i++) {
      var cur = poly[i], prev = poly[(i - 1 + n) % n];
      var curIn = (a * cur.x + b * cur.y - c) <= EPS;
      var prevIn = (a * prev.x + b * prev.y - c) <= EPS;
      if (curIn) {
        if (!prevIn) out.push(segIntersect(prev, cur, a, b, c));
        out.push(cur);
      } else if (prevIn) {
        out.push(segIntersect(prev, cur, a, b, c));
      }
    }
    return out;
  }

  function segIntersect(p1, p2, a, b, c) {
    var d1 = a * p1.x + b * p1.y - c;
    var d2 = a * p2.x + b * p2.y - c;
    var t = d1 / (d1 - d2 || EPS);
    return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
  }

  function clipConstraint(poly, k) {
    if (k.op === '<=') return clipHalfPlane(poly, k.a, k.b, k.c);
    if (k.op === '>=') return clipHalfPlane(poly, -k.a, -k.b, -k.c);
    var p1 = clipHalfPlane(poly, k.a, k.b, k.c);
    return clipHalfPlane(p1, -k.a, -k.b, -k.c);
  }

  function boxPoly(size) {
    return [{ x: 0, y: 0 }, { x: size, y: 0 }, { x: size, y: size }, { x: 0, y: size }];
  }

  function feasiblePolygon(constraints, size) {
    var poly = boxPoly(size);
    for (var i = 0; i < constraints.length && poly.length; i++) poly = clipConstraint(poly, constraints[i]);
    return poly;
  }

  function reach(constraints) {
    var m = 8;
    constraints.forEach(function (k) {
      if (Math.abs(k.a) > EPS) m = Math.max(m, Math.abs(k.c / k.a));
      if (Math.abs(k.b) > EPS) m = Math.max(m, Math.abs(k.c / k.b));
    });
    return m;
  }

  function dedupeOrdered(poly) {
    var out = [];
    poly.forEach(function (p) {
      var last = out[out.length - 1];
      if (!last || Math.abs(last.x - p.x) > 1e-6 || Math.abs(last.y - p.y) > 1e-6) out.push(p);
    });
    if (out.length > 1) {
      var f = out[0], l = out[out.length - 1];
      if (Math.abs(f.x - l.x) < 1e-6 && Math.abs(f.y - l.y) < 1e-6) out.pop();
    }
    return out;
  }

  /** Intersección de dos rectas a1*x+b1*y=c1, a2*x+b2*y=c2. null si son paralelas. */
  function intersectLines(l1, l2) {
    var det = l1.a * l2.b - l2.a * l1.b;
    if (Math.abs(det) < 1e-12) return null;
    return {
      x: (l1.c * l2.b - l2.c * l1.b) / det,
      y: (l1.a * l2.c - l2.a * l1.c) / det
    };
  }

  /** ¿(x,y) cumple todas las restricciones y la no negatividad (con tolerancia relativa)? */
  function feasiblePoint(constraints, x, y) {
    var nnTol = 1e-6 * (1 + Math.abs(x) + Math.abs(y));
    if (x < -nnTol || y < -nnTol) return false;
    for (var i = 0; i < constraints.length; i++) {
      var k = constraints[i];
      var val = k.a * x + k.b * y;
      var tol = 1e-6 * (1 + Math.abs(val) + Math.abs(k.c));
      if (k.op === '<=' && val > k.c + tol) return false;
      if (k.op === '>=' && val < k.c - tol) return false;
      if (k.op === '=' && Math.abs(val - k.c) > tol) return false;
    }
    return true;
  }

  /** Elimina puntos duplicados (comparación por tolerancia relativa, sin asumir orden). */
  function dedupeVerts(points) {
    var out = [];
    points.forEach(function (p) {
      var dup = out.some(function (q) {
        return Math.abs(q.x - p.x) < 1e-6 * (1 + Math.abs(p.x)) && Math.abs(q.y - p.y) < 1e-6 * (1 + Math.abs(p.y));
      });
      if (!dup) out.push(p);
    });
    return out;
  }

  /** Vértices factibles: intersección de cada par de rectas (restricciones + ejes)
   * que satisface todas las restricciones y x,y≥0. */
  function computeVertices(constraints) {
    var lines = constraints.map(function (k) { return { a: k.a, b: k.b, c: k.c }; });
    lines.push({ a: 1, b: 0, c: 0 }); // eje x1=0
    lines.push({ a: 0, b: 1, c: 0 }); // eje x2=0
    var pts = [];
    for (var i = 0; i < lines.length; i++) {
      for (var j = i + 1; j < lines.length; j++) {
        var p = intersectLines(lines[i], lines[j]);
        if (p && feasiblePoint(constraints, p.x, p.y)) pts.push(p);
      }
    }
    return dedupeVerts(pts);
  }

  /** ¿d=(d1,d2) es una dirección de recesión válida? (d≥0, cumple homogéneamente
   * cada restricción: a·d≤0 para ≤, a·d≥0 para ≥, a·d=0 para =). */
  function isRecessionDirection(constraints, d1, d2) {
    if (d1 < -1e-9 || d2 < -1e-9) return false;
    if (Math.abs(d1) < 1e-9 && Math.abs(d2) < 1e-9) return false;
    for (var i = 0; i < constraints.length; i++) {
      var k = constraints[i];
      var val = k.a * d1 + k.b * d2;
      var scale = 1e-9 * (Math.abs(k.a) + Math.abs(k.b) + 1);
      if (k.op === '<=' && val > scale) return false;
      if (k.op === '>=' && val < -scale) return false;
      if (k.op === '=' && Math.abs(val) > scale) return false;
    }
    return true;
  }

  /** Busca una dirección extrema del cono de recesión que mejore el objetivo.
   * Como el cono en 2D es poliédrico y puntiagudo, basta probar (1,0), (0,1)
   * y ±(−b_i,a_i) de cada restricción: sus combinaciones no negativas generan
   * el cono completo, así que si alguna dirección factible mejora z, alguna
   * de estas direcciones extremas también lo hace. Devuelve la dirección
   * hallada (o null si el problema está acotado). */
  function recessionDirection(constraints, c1, c2, sense) {
    var cand = [[1, 0], [0, 1]];
    constraints.forEach(function (k) { cand.push([-k.b, k.a], [k.b, -k.a]); });
    var eps = 1e-9 * (Math.abs(c1) + Math.abs(c2) + 1);
    for (var i = 0; i < cand.length; i++) {
      var d1 = cand[i][0], d2 = cand[i][1];
      if (!isRecessionDirection(constraints, d1, d2)) continue;
      var obj = c1 * d1 + c2 * d2;
      if (sense === 'max' ? obj > eps : obj < -eps) return { x: d1, y: d2 };
    }
    return null;
  }

  /** Resuelve un PL de 2 variables por el método gráfico (análisis matemático exacto,
   * no heurísticas de tamaño de ventana).
   * constraints: [{a,b,op:'<='|'>='|'=',c}], c1,c2: coef. objetivo, sense:'max'|'min'.
   * Devuelve {status:'optimal'|'alternative'|'unbounded'|'infeasible', vertices, optimal,
   * alternates, viewSize, direction} */
  function solveLP(constraints, c1, c2, sense) {
    var r = reach(constraints);
    var vertices = computeVertices(constraints);
    if (!vertices.length) {
      return { status: 'infeasible', viewSize: Math.max(r * 1.3, 8) };
    }
    var maxCoord = 0;
    vertices.forEach(function (v) { maxCoord = Math.max(maxCoord, Math.abs(v.x), Math.abs(v.y)); });
    var viewSize = Math.max(r * 1.3 + 2, maxCoord * 1.3 + 2, 8);

    var direction = recessionDirection(constraints, c1, c2, sense);
    var withZ = vertices.map(function (p) { return { x: p.x, y: p.y, z: c1 * p.x + c2 * p.y }; });
    if (direction) {
      return { status: 'unbounded', vertices: withZ, viewSize: viewSize, direction: direction };
    }

    var best = null;
    withZ.forEach(function (p) { if (best === null || (sense === 'max' ? p.z > best.z + 1e-9 : p.z < best.z - 1e-9)) best = p; });
    var tol = 1e-7 + Math.abs(best.z) * 1e-7; // tolerancia relativa
    var alt = withZ.filter(function (p) { return Math.abs(p.z - best.z) <= tol; });
    return {
      status: alt.length > 1 ? 'alternative' : 'optimal',
      vertices: withZ, optimal: best, alternates: alt, viewSize: viewSize
    };
  }

  function activeSet(constraints, v) {
    var out = [];
    constraints.forEach(function (k, i) { if (Math.abs(k.a * v.x + k.b * v.y - k.c) < 1e-4) out.push(i); });
    return out.join(',');
  }

  /** Rango de c1 (o c2) que conserva el mismo vértice óptimo, por búsqueda numérica. */
  function objectiveRange(constraints, c1, c2, sense, which) {
    var base = solveLP(constraints, c1, c2, sense);
    if (!base.optimal) return null;
    var baseXY = [base.optimal.x, base.optimal.y];
    var p0 = which === 'c1' ? c1 : c2;
    function sameVertex(v) {
      var r = which === 'c1' ? solveLP(constraints, v, c2, sense) : solveLP(constraints, c1, v, sense);
      if (!r.optimal) return false;
      return Math.abs(r.optimal.x - baseXY[0]) < 1e-4 && Math.abs(r.optimal.y - baseXY[1]) < 1e-4;
    }
    return searchBoth(p0, sameVertex);
  }

  /** Rango de factibilidad del lado derecho b_idx (misma base activa) + precio dual numérico. */
  function rhsAnalysis(constraints, idx, c1, c2, sense) {
    var base = solveLP(constraints, c1, c2, sense);
    if (!base.optimal) return null;
    var baseActive = activeSet(constraints, base.optimal);
    var b0 = constraints[idx].c;
    function withB(b) { return constraints.map(function (k, i) { return i === idx ? { a: k.a, b: k.b, op: k.op, c: b } : k; }); }
    function sameBasis(b) {
      var r = solveLP(withB(b), c1, c2, sense);
      return r.optimal ? activeSet(withB(b), r.optimal) === baseActive : false;
    }
    var delta = Math.max(Math.abs(b0) * 0.001, 0.001);
    function zAt(b) { var r = solveLP(withB(b), c1, c2, sense); return r.optimal ? r.optimal.z : null; }
    var zp = zAt(b0 + delta), zm = zAt(b0 - delta);
    var dual = (zp !== null && zm !== null) ? (zp - zm) / (2 * delta) : null;
    var range = searchBoth(b0, sameBasis);
    return { dual: dual, range: range, base: base };
  }

  function searchBoth(p0, sameFn) {
    function dir(sign) {
      var step = Math.max(Math.abs(p0) * 0.05, 0.05);
      var cur = p0, iter = 0;
      var cap = Math.abs(p0) * 3000 + 3000;
      while (iter < 200) {
        var next = cur + sign * step;
        if (Math.abs(next - p0) > cap) return { value: next, unbounded: true };
        if (sameFn(next)) { cur = next; step *= 1.4; } else break;
        iter++;
      }
      var lo = cur, hi = cur + sign * step;
      for (var k = 0; k < 45; k++) { var mid = (lo + hi) / 2; if (sameFn(mid)) lo = mid; else hi = mid; }
      return { value: lo, unbounded: false };
    }
    var down = dir(-1), up = dir(1);
    return { lo: down.value, loUnbounded: down.unbounded, hi: up.value, hiUnbounded: up.unbounded };
  }

  /* =========================================================================
   * 2) EJEMPLOS PRECARGADOS
   * ========================================================================= */

  var EXAMPLES = {
    reddy: {
      label: 'Reddy Mikks (máx.)', sense: 'max', c1: 5, c2: 4,
      names: ['x1 (pint. ext., ton/día)', 'x2 (pint. int., ton/día)'],
      constraints: [
        { a: 6, b: 4, op: '<=', c: 24, label: 'Materia prima M1' },
        { a: 1, b: 2, op: '<=', c: 6, label: 'Materia prima M2' },
        { a: -1, b: 1, op: '<=', c: 1, label: 'Demanda relativa' },
        { a: 0, b: 1, op: '<=', c: 2, label: 'Demanda máx. interior' }
      ]
    },
    dieta: {
      label: 'Dieta (mín.)', sense: 'min', c1: 0.3, c2: 0.9,
      names: ['x1 (maíz, lb)', 'x2 (soja, lb)'],
      constraints: [
        { a: 1, b: 1, op: '>=', c: 800, label: 'Proteína mínima' },
        { a: 0.21, b: -0.30, op: '<=', c: 0, label: 'Fibra máxima' },
        { a: 0.03, b: -0.01, op: '>=', c: 0, label: 'Vitamina mínima' }
      ]
    },
    alternos: {
      label: 'Óptimos alternativos', sense: 'max', c1: 2, c2: 4,
      names: ['x1', 'x2'],
      constraints: [
        { a: 1, b: 2, op: '<=', c: 5, label: 'Restricción 1 (paralela al objetivo)' },
        { a: 1, b: 1, op: '<=', c: 4, label: 'Restricción 2' }
      ]
    },
    noacotado: {
      label: 'No acotado', sense: 'max', c1: 2, c2: 1,
      names: ['x1', 'x2'],
      constraints: [
        { a: 1, b: -1, op: '<=', c: 10, label: 'Restricción 1' },
        { a: 2, b: 0, op: '<=', c: 40, label: 'Restricción 2 (no limita x2)' }
      ]
    },
    nofactible: {
      label: 'No factible', sense: 'max', c1: 3, c2: 2,
      names: ['x1', 'x2'],
      constraints: [
        { a: 2, b: 1, op: '<=', c: 2, label: 'Restricción 1' },
        { a: 3, b: 4, op: '>=', c: 12, label: 'Restricción 2 (incompatible)' }
      ]
    }
  };

  /* =========================================================================
   * 3) UTILIDADES DE DIBUJO
   * ========================================================================= */

  function theme() {
    var cs = getComputedStyle(document.documentElement);
    function v(name, fallback) { var x = cs.getPropertyValue(name); return x && x.trim() ? x.trim() : fallback; }
    return {
      ink: v('--ink', '#1F2A44'), ink2: v('--ink-2', '#4A5470'), line: v('--line', '#D5D9E3'),
      accent: v('--accent', '#C77D1A'), accentInk: v('--accent-ink', '#7A4A08'),
      ok: v('--ok', '#2E7D5B'), err: v('--err', '#B23A3A'), warn: v('--warn', '#B8860B'),
      paper2: v('--paper-2', '#FFFFFF'), pivot: v('--pivot', 'rgba(199,125,26,.22)')
    };
  }

  function fmt(n, d) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    d = d === undefined ? 2 : d;
    var r = Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
    return (Object.is(r, -0) ? 0 : r).toString();
  }

  function setupCanvas(canvas) {
    var wrap = canvas.parentElement;
    var cssW = Math.max(wrap.clientWidth, 260);
    var cssH = Math.round(cssW * 0.72);
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: cssW, h: cssH };
  }

  function makeTransform(w, h, viewSize) {
    var mL = 40, mR = 14, mT = 14, mB = 34;
    var sx = (w - mL - mR) / viewSize;
    var sy = (h - mT - mB) / viewSize;
    function toPx(x, y) { return { x: mL + x * sx, y: h - mB - y * sy }; }
    return { toPx: toPx, mL: mL, mR: mR, mT: mT, mB: mB };
  }

  function lineSegmentInBox(a, b, c, size) {
    var box = boxPoly(size);
    var p1 = clipHalfPlane(box, a, b, c);
    var p2 = clipHalfPlane(p1, -a, -b, -c);
    return dedupeOrdered(p2);
  }

  function constraintText(k, names) {
    names = names || ['x1', 'x2'];
    var opTxt = k.op === '<=' ? '&le;' : (k.op === '>=' ? '&ge;' : '=');
    function coef(v, name) {
      if (Math.abs(v) < EPS) return '';
      var av = Math.abs(v) === 1 ? '' : fmt(Math.abs(v), 3);
      return (v < 0 ? ' - ' : (name === names[0] ? '' : ' + ')) + av + name;
    }
    var t = coef(k.a, names[0]) + coef(k.b, names[1]);
    t = t.replace(/^ \+ /, '');
    return t + ' ' + opTxt + ' ' + fmt(k.c, 3);
  }

  function drawGraph(canvas, constraints, c1, c2, sense, names, opts) {
    opts = opts || {};
    var T = theme();
    var setup = setupCanvas(canvas);
    var ctx = setup.ctx, w = setup.w, h = setup.h;
    ctx.clearRect(0, 0, w, h);
    var result = solveLP(constraints, c1, c2, sense);
    var viewSize = result.viewSize;
    var tr = makeTransform(w, h, viewSize);
    var toPx = tr.toPx;

    // grid
    ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = T.ink2;
    var steps = 5;
    for (var i = 0; i <= steps; i++) {
      var gv = (viewSize / steps) * i;
      var p0 = toPx(gv, 0), p1 = toPx(gv, viewSize);
      ctx.beginPath(); ctx.moveTo(p0.x, tr.mT); ctx.lineTo(p0.x, h - tr.mB); ctx.stroke();
      var q0 = toPx(0, gv), q1 = toPx(viewSize, gv);
      ctx.beginPath(); ctx.moveTo(tr.mL, q0.y); ctx.lineTo(w - tr.mR, q0.y); ctx.stroke();
      ctx.fillText(fmt(gv, gv < 10 ? 1 : 0), p0.x - 8, h - tr.mB + 14);
      ctx.fillText(fmt(gv, gv < 10 ? 1 : 0), 4, q0.y + 3);
    }
    // axes
    ctx.strokeStyle = T.ink; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(tr.mL, h - tr.mB); ctx.lineTo(w - tr.mR, h - tr.mB); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tr.mL, tr.mT); ctx.lineTo(tr.mL, h - tr.mB); ctx.stroke();
    ctx.fillStyle = T.ink; ctx.font = '12px "Source Sans 3", sans-serif';
    ctx.fillText(names[0] || 'x1', w - tr.mR - 10, h - tr.mB - 6);
    ctx.fillText(names[1] || 'x2', tr.mL + 6, tr.mT + 10);

    // feasible region (recorte de semiplanos SOLO para dibujar dentro de la ventana visible;
    // no participa en la decisión de acotación/factibilidad, que ya calculó solveLP)
    var drawPoly = (result.status === 'optimal' || result.status === 'alternative' || result.status === 'unbounded')
      ? dedupeOrdered(feasiblePolygon(constraints, viewSize)) : null;
    if (drawPoly && drawPoly.length > 2) {
      ctx.beginPath();
      drawPoly.forEach(function (p, idx) {
        var pp = toPx(p.x, p.y);
        if (idx === 0) ctx.moveTo(pp.x, pp.y); else ctx.lineTo(pp.x, pp.y);
      });
      ctx.closePath();
      ctx.fillStyle = T.pivot;
      ctx.fill();
      ctx.strokeStyle = T.accentInk; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // constraint lines
    constraints.forEach(function (k, idx) {
      var seg = lineSegmentInBox(k.a, k.b, k.c, viewSize);
      if (seg.length < 2) return;
      var p0 = toPx(seg[0].x, seg[0].y), p1 = toPx(seg[1].x, seg[1].y);
      ctx.strokeStyle = T.ink2; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      ctx.fillStyle = T.ink2; ctx.font = '10px "JetBrains Mono", monospace';
      var mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
      ctx.fillText('R' + (idx + 1), mx + 4, my - 4);
    });

    // unbounded hint
    if (result.status === 'unbounded') {
      ctx.fillStyle = T.warn; ctx.font = '12px "Source Sans 3", sans-serif';
      ctx.fillText('La región factible continúa sin límite ▸', tr.mL + 6, tr.mT + 26);
    }

    // vertices
    if (result.vertices) {
      result.vertices.forEach(function (v) {
        var pp = toPx(v.x, v.y);
        var isOpt = result.alternates && result.alternates.some(function (a) { return Math.abs(a.x - v.x) < 1e-6 && Math.abs(a.y - v.y) < 1e-6; });
        ctx.beginPath(); ctx.arc(pp.x, pp.y, isOpt ? 5.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = isOpt ? T.accent : T.ink;
        ctx.fill();
        if (isOpt) { ctx.strokeStyle = T.accentInk; ctx.lineWidth = 1.5; ctx.stroke(); }
        ctx.fillStyle = isOpt ? T.accentInk : T.ink2;
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText('(' + fmt(v.x, 2) + ', ' + fmt(v.y, 2) + ') z=' + fmt(v.z, 2), pp.x + 8, pp.y - 6);
      });
    }

    // iso-z line
    if (opts.isoZ !== undefined && opts.isoZ !== null) {
      var seg2 = lineSegmentInBox(c1, c2, opts.isoZ, viewSize);
      if (seg2.length >= 2) {
        var q0 = toPx(seg2[0].x, seg2[0].y), q1 = toPx(seg2[1].x, seg2[1].y);
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = T.ok; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    return result;
  }

  /* =========================================================================
   * 4) WIDGET: SOLUCIONADOR GRÁFICO
   * ========================================================================= */

  function mountGraphicSolver(root) {
    root.innerHTML =
      '<div class="row">' +
      '<label class="muted">Ejemplo: <select class="example-picker" data-role="ex"></select></label>' +
      '<span class="badge" data-role="status">—</span>' +
      '</div>' +
      '<div class="grid-2">' +
      '<div>' +
      '<div data-role="conslist"></div>' +
      '<div class="row"><button class="btn btn-sm" data-role="add">+ Restricción</button></div>' +
      '<div class="row" style="margin-top:8px">' +
      '<label class="muted">z = <input type="number" step="0.1" data-role="c1" class="input-grid" style="width:5em"> x1 + ' +
      '<input type="number" step="0.1" data-role="c2" class="input-grid" style="width:5em"> x2</label>' +
      '<select data-role="sense"><option value="max">Maximizar</option><option value="min">Minimizar</option></select>' +
      '<button class="btn btn-primary btn-sm" data-role="solve">Resolver</button>' +
      '</div>' +
      '<table class="data" data-role="vtable"></table>' +
      '</div>' +
      '<div>' +
      '<div class="canvas-wrap"><canvas data-role="canvas"></canvas></div>' +
      '<div class="row"><label class="muted">Recta iso-z: <input type="range" data-role="isoz" style="width:200px"> <span data-role="isozval"></span></label></div>' +
      '</div>' +
      '</div>';

    var exSel = root.querySelector('[data-role="ex"]');
    Object.keys(EXAMPLES).forEach(function (key) {
      var o = document.createElement('option'); o.value = key; o.textContent = EXAMPLES[key].label; exSel.appendChild(o);
    });

    var state = { constraints: [], c1: 5, c2: 4, sense: 'max', names: ['x1', 'x2'], isoZ: null };

    function loadExample(key) {
      var ex = EXAMPLES[key];
      state.constraints = ex.constraints.map(function (k) { return { a: k.a, b: k.b, op: k.op, c: k.c }; });
      state.c1 = ex.c1; state.c2 = ex.c2; state.sense = ex.sense; state.names = ex.names;
      renderConsList(); syncObjInputs(); recompute();
    }

    function syncObjInputs() {
      root.querySelector('[data-role="c1"]').value = state.c1;
      root.querySelector('[data-role="c2"]').value = state.c2;
      root.querySelector('[data-role="sense"]').value = state.sense;
    }

    function renderConsList() {
      var box = root.querySelector('[data-role="conslist"]');
      box.innerHTML = '';
      state.constraints.forEach(function (k, idx) {
        var row = document.createElement('div'); row.className = 'row';
        row.innerHTML =
          '<input type="number" step="0.1" class="input-grid" style="width:4.5em" data-f="a" value="' + k.a + '"> x1 + ' +
          '<input type="number" step="0.1" class="input-grid" style="width:4.5em" data-f="b" value="' + k.b + '"> x2 ' +
          '<select data-f="op"><option value="<="' + (k.op === '<=' ? ' selected' : '') + '>&le;</option>' +
          '<option value=">="' + (k.op === '>=' ? ' selected' : '') + '>&ge;</option>' +
          '<option value="="' + (k.op === '=' ? ' selected' : '') + '>=</option></select>' +
          '<input type="number" step="0.1" class="input-grid" style="width:5em" data-f="c" value="' + k.c + '">' +
          '<button class="btn btn-sm" data-act="del" title="Quitar">✕</button>';
        row.querySelectorAll('[data-f]').forEach(function (inp) {
          inp.addEventListener('change', function () {
            var f = inp.getAttribute('data-f');
            state.constraints[idx][f] = f === 'op' ? inp.value : parseFloat(inp.value) || 0;
          });
        });
        row.querySelector('[data-act="del"]').addEventListener('click', function () {
          state.constraints.splice(idx, 1); renderConsList(); recompute();
        });
        box.appendChild(row);
      });
    }

    root.querySelector('[data-role="add"]').addEventListener('click', function () {
      if (state.constraints.length >= 6) return;
      state.constraints.push({ a: 1, b: 1, op: '<=', c: 10 });
      renderConsList();
    });
    root.querySelector('[data-role="solve"]').addEventListener('click', function () {
      state.c1 = parseFloat(root.querySelector('[data-role="c1"]').value) || 0;
      state.c2 = parseFloat(root.querySelector('[data-role="c2"]').value) || 0;
      state.sense = root.querySelector('[data-role="sense"]').value;
      recompute();
    });
    exSel.addEventListener('change', function () { loadExample(exSel.value); });

    var isoRange = root.querySelector('[data-role="isoz"]');
    isoRange.addEventListener('input', function () {
      state.isoZ = parseFloat(isoRange.value);
      root.querySelector('[data-role="isozval"]').textContent = 'k = ' + fmt(state.isoZ, 2);
      redraw();
    });

    function badgeFor(status) {
      var map = {
        optimal: ['badge-ok', 'Óptimo único'],
        alternative: ['badge-ok', 'Óptimos alternativos'],
        unbounded: ['badge-warn', 'No acotado'],
        infeasible: ['badge-err', 'No factible']
      };
      return map[status] || ['badge', status];
    }

    var lastResult = null;
    function redraw() {
      lastResult = drawGraph(root.querySelector('[data-role="canvas"]'), state.constraints, state.c1, state.c2, state.sense, state.names, { isoZ: state.isoZ });
    }

    function recompute() {
      var r = drawGraph(root.querySelector('[data-role="canvas"]'), state.constraints, state.c1, state.c2, state.sense, state.names, { isoZ: null });
      lastResult = r;
      var badge = root.querySelector('[data-role="status"]');
      var b = badgeFor(r.status);
      badge.className = 'badge ' + b[0]; badge.textContent = b[1];

      var vtable = root.querySelector('[data-role="vtable"]');
      if (r.vertices && r.vertices.length) {
        var rowsHtml = r.vertices.map(function (v, i) {
          var isOpt = r.optimal && Math.abs(v.z - r.optimal.z) < 1e-6;
          return '<tr' + (isOpt ? ' class="hl"' : '') + '><td>V' + (i + 1) + '</td><td>' + fmt(v.x) + '</td><td>' + fmt(v.y) + '</td><td>' + fmt(v.z) + '</td>' + (isOpt ? '<td class="badge badge-ok">óptimo</td>' : '<td></td>') + '</tr>';
        }).join('');
        vtable.innerHTML = '<thead><tr><th>Vértice</th><th>x1</th><th>x2</th><th>z</th><th></th></tr></thead><tbody>' + rowsHtml + '</tbody>';
      } else {
        vtable.innerHTML = '<tbody><tr><td class="muted">Sin vértices factibles (' + b[1].toLowerCase() + ').</td></tr></tbody>';
      }

      var zs = (r.vertices || []).map(function (v) { return v.z; });
      if (zs.length) {
        var zmin = Math.min.apply(null, zs), zmax = Math.max.apply(null, zs);
        var pad = (zmax - zmin) * 0.6 || 1;
        isoRange.min = fmt(zmin - pad, 3); isoRange.max = fmt(zmax + pad, 3);
        isoRange.step = fmt((zmax - zmin) / 100 || 0.1, 4);
        state.isoZ = r.optimal ? r.optimal.z : (zmin + zmax) / 2;
        isoRange.value = state.isoZ;
        isoRange.disabled = false;
        root.querySelector('[data-role="isozval"]').textContent = 'k = ' + fmt(state.isoZ, 2);
      } else {
        isoRange.disabled = true;
        state.isoZ = null;
      }
      redraw();
    }

    attachAutoRedraw(redraw);

    loadExample('reddy');
  }

  function debounce(fn, ms) {
    var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  /** Registra `resize`/`themechange`/`matchMedia` para volver a dibujar, y registra
   * su propia limpieza con IO.registerCleanup (SPEC.md §2, "Desmontaje y limpieza").
   * Compartido por los widgets de este capítulo para no duplicar (ni fugar) listeners. */
  function attachAutoRedraw(fn) {
    var onResize = debounce(fn, 150);
    var mq = null;
    window.addEventListener('themechange', fn);
    window.addEventListener('resize', onResize);
    if (window.matchMedia) {
      try { mq = window.matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', fn); } catch (e) { mq = null; /* Safari viejo */ }
    }
    IO.registerCleanup(function () {
      window.removeEventListener('themechange', fn);
      window.removeEventListener('resize', onResize);
      if (mq) { try { mq.removeEventListener('change', fn); } catch (e) { /* ignore */ } }
    });
  }

  /* =========================================================================
   * 5) WIDGET: SENSIBILIDAD GRÁFICA (Reddy Mikks)
   * ========================================================================= */

  function mountGraphicSensitivity(root) {
    var ex = EXAMPLES.reddy;
    root.innerHTML =
      '<p class="muted">Basado en Reddy Mikks: max z = c1·x1 + c2·x2, con las 4 restricciones originales fijas. Mueva los controles y observe cómo cambia el vértice óptimo.</p>' +
      '<div class="grid-2">' +
      '<div>' +
      '<div class="row"><label>c1: <input type="range" data-role="c1" min="0.5" max="12" step="0.1" value="5" style="width:160px"> <span data-role="c1v"></span></label></div>' +
      '<div class="row"><label>c2: <input type="range" data-role="c2" min="0.5" max="12" step="0.1" value="4" style="width:160px"> <span data-role="c2v"></span></label></div>' +
      '<div class="row"><label>Recurso: <select data-role="bsel"></select></label></div>' +
      '<div class="row"><label>b: <input type="range" data-role="b" style="width:160px"> <span data-role="bv"></span></label></div>' +
      '<div class="kv" data-role="results"></div>' +
      '</div>' +
      '<div class="canvas-wrap"><canvas data-role="canvas"></canvas></div>' +
      '</div>';

    var bsel = root.querySelector('[data-role="bsel"]');
    ex.constraints.forEach(function (k, idx) {
      var o = document.createElement('option'); o.value = idx; o.textContent = k.label + ' (b=' + k.c + ')'; bsel.appendChild(o);
    });

    var state = { c1: 5, c2: 4, bIdx: 0 };
    var constraints = ex.constraints.map(function (k) { return { a: k.a, b: k.b, op: k.op, c: k.c }; });

    var bRange = root.querySelector('[data-role="b"]');
    function syncBSlider() {
      var b0 = constraints[state.bIdx].c;
      bRange.min = fmt(b0 * 0.2, 2); bRange.max = fmt(b0 * 2.2, 2); bRange.step = fmt(Math.max(b0 * 0.01, 0.01), 3);
      bRange.value = b0;
    }
    syncBSlider();

    function recompute() {
      var c1 = state.c1, c2 = state.c2;
      var r = solveLP(constraints, c1, c2, 'max');
      drawGraph(root.querySelector('[data-role="canvas"]'), constraints, c1, c2, 'max', ex.names, { isoZ: r.optimal ? r.optimal.z : null });

      var out = root.querySelector('[data-role="results"]');
      if (!r.optimal) {
        out.innerHTML = '<p class="badge badge-err">El modelo quedó no factible / no acotado con estos valores.</p>';
        return;
      }
      var c1r = objectiveRange(constraints, c1, c2, 'max', 'c1');
      var c2r = objectiveRange(constraints, c1, c2, 'max', 'c2');
      var rhs = rhsAnalysis(constraints, state.bIdx, c1, c2, 'max');
      var rows = [];
      rows.push(['Vértice óptimo', '(x1=' + fmt(r.optimal.x) + ', x2=' + fmt(r.optimal.y) + ')']);
      rows.push(['z óptimo', fmt(r.optimal.z)]);
      rows.push(['Rango de c1 (c2=' + fmt(c2) + ' fijo)', c1r ? (c1r.loUnbounded ? '(-∞' : '[' + fmt(c1r.lo)) + ' , ' + (c1r.hiUnbounded ? '+∞)' : fmt(c1r.hi) + ']') : '—']);
      rows.push(['Rango de c2 (c1=' + fmt(c1) + ' fijo)', c2r ? (c2r.loUnbounded ? '(-∞' : '[' + fmt(c2r.lo)) + ' , ' + (c2r.hiUnbounded ? '+∞)' : fmt(c2r.hi) + ']') : '—']);
      if (rhs) {
        rows.push(['Precio dual de "' + constraints[state.bIdx].label + '"', fmt(rhs.dual, 3) + ' por unidad de recurso']);
        rows.push(['Rango de factibilidad de b', (rhs.range.loUnbounded ? '(-∞' : '[' + fmt(rhs.range.lo)) + ' , ' + (rhs.range.hiUnbounded ? '+∞)' : fmt(rhs.range.hi) + ']')]);
      }
      out.innerHTML = rows.map(function (r2) { return '<div><b>' + r2[0] + ':</b> ' + r2[1] + '</div>'; }).join('') +
        '<p class="muted" style="margin-top:6px">El precio dual indica cuánto sube z por cada unidad extra del recurso, mientras el rango de factibilidad se mantenga. Fuera del rango de c1/c2, el vértice óptimo salta a otro vértice de la región factible (regla de las pendientes).</p>';
    }

    root.querySelector('[data-role="c1"]').addEventListener('input', function (e) {
      state.c1 = parseFloat(e.target.value); root.querySelector('[data-role="c1v"]').textContent = fmt(state.c1); recompute();
    });
    root.querySelector('[data-role="c2"]').addEventListener('input', function (e) {
      state.c2 = parseFloat(e.target.value); root.querySelector('[data-role="c2v"]').textContent = fmt(state.c2); recompute();
    });
    bsel.addEventListener('change', function () { state.bIdx = parseInt(bsel.value, 10); syncBSlider(); root.querySelector('[data-role="bv"]').textContent = fmt(constraints[state.bIdx].c); recompute(); });
    bRange.addEventListener('input', function (e) {
      constraints[state.bIdx].c = parseFloat(e.target.value);
      root.querySelector('[data-role="bv"]').textContent = fmt(constraints[state.bIdx].c);
      recompute();
    });

    root.querySelector('[data-role="c1v"]').textContent = fmt(state.c1);
    root.querySelector('[data-role="c2v"]').textContent = fmt(state.c2);
    root.querySelector('[data-role="bv"]').textContent = fmt(constraints[0].c);

    attachAutoRedraw(recompute);

    recompute();
  }

  /* =========================================================================
   * 6) WIDGET: ENTRENADOR DE FORMULACIÓN
   * ========================================================================= */

  var FORMULATION_ITEMS = [
    {
      id: 'inversion', title: '1. Inversión — Bank One',
      statement: 'Un banco dispone de $10 millones para prestar en cuatro líneas: personales (x1), automotor (x2), hipotecarios (x3) y comerciales (x4), con retorno anual 14%, 13%, 12% y 10% respectivamente. Política interna: los hipotecarios deben ser al menos el 40&nbsp;% del total prestado, y lo comercial no puede superar lo personal. Se quiere maximizar el interés anual.',
      varsOptions: ['xᵢ = monto (en millones $) prestado en la línea i', 'x_i = número de clientes atendidos en la línea i', 'x_i = tasa de interés cobrada en la línea i'], varsAnswer: 0,
      objOptions: ['max z = 0.14x1+0.13x2+0.12x3+0.10x4', 'min z = 0.14x1+0.13x2+0.12x3+0.10x4', 'max z = x1+x2+x3+x4'], objAnswer: 0,
      consOptions: [
        { txt: 'x1+x2+x3+x4 ≤ 10 (fondos disponibles)', ok: true },
        { txt: 'x3 ≥ 0.4(x1+x2+x3+x4) (mínimo hipotecario)', ok: true },
        { txt: 'x4 ≤ x1 (comercial no supera personal)', ok: true },
        { txt: 'x1 = x2 = x3 = x4 (montos iguales)', ok: false }
      ],
      explain: 'Modelo completo: max z=0.14x1+0.13x2+0.12x3+0.10x4 s.a. x1+x2+x3+x4≤10; x3≥0.4(x1+x2+x3+x4); x4≤x1; x_i≥0. Es formulación (no se resuelve a mano en el parcial).'
    },
    {
      id: 'produccion', title: '2. Producción e inventario',
      statement: 'Una fábrica planea producción para 3 meses con demandas d₁, d₂, d₃ conocidas. Producir cuesta c por unidad y guardar en inventario cuesta h por unidad-mes. Sea xₜ la producción del mes t e Iₜ el inventario al final del mes t (I₀ = 0 dado). Minimizar costo total.',
      varsOptions: ['xₜ = producción del mes t; Iₜ = inventario final del mes t', 'xₜ = demanda del mes t', 'Iₜ = precio de venta del mes t'], varsAnswer: 0,
      objOptions: ['min z = Σ(c·xₜ + h·Iₜ)', 'max z = Σ(c·xₜ + h·Iₜ)', 'min z = Σ xₜ solamente'], objAnswer: 0,
      consOptions: [
        { txt: 'Iₜ₋₁ + xₜ − dₜ = Iₜ para cada mes t (balance de inventario)', ok: true },
        { txt: 'xₜ, Iₜ ≥ 0', ok: true },
        { txt: 'Capacidad de planta: xₜ ≤ capacidadₜ', ok: true },
        { txt: 'Iₜ = dₜ siempre', ok: false }
      ],
      explain: 'Es un balance período a período: inventario anterior + producción − demanda = inventario nuevo. Se minimiza costo de producir más costo de mantener inventario, sujeto a capacidad.'
    },
    {
      id: 'manoobra', title: '3. Mano de obra — turnos de choferes',
      statement: 'Una empresa de buses necesita cubrir la demanda de choferes por bloques horarios del día. Cada chofer que inicia turno en el bloque i trabaja 8 horas seguidas (cubre varios bloques). Sea x_i = número de choferes que inician turno en el bloque i. Minimizar el total de choferes contratados sujeto a cubrir la demanda de cada bloque.',
      varsOptions: ['x_i = número de choferes que inician turno en el bloque i', 'x_i = horas trabajadas por el chofer i', 'x_i = demanda de pasajeros en el bloque i'], varsAnswer: 0,
      objOptions: ['min z = Σ x_i', 'max z = Σ x_i', 'min z = Σ 8x_i·costo_hora, sin restricciones de cobertura'], objAnswer: 0,
      consOptions: [
        { txt: 'Para cada bloque j: suma de x_i de los turnos que cubren j ≥ demanda_j', ok: true },
        { txt: 'x_i ≥ 0 y entero (número de personas)', ok: true },
        { txt: 'x_i ≤ 1 para todo i (a lo sumo un chofer por turno)', ok: false },
        { txt: 'Σ x_i = demanda total exacta', ok: false }
      ],
      explain: 'Es el clásico problema de programación de turnos: cada restricción exige que la cobertura acumulada de los turnos que "pasan" por ese bloque alcance la demanda de ese bloque; se minimiza el total de choferes.'
    },
    {
      id: 'urbano', title: '4. Desarrollo urbano',
      statement: 'Un municipio decide cuántos acres destinar a casas (x1), departamentos (x2) y locales comerciales (x3) en un terreno de A acres, maximizando el ingreso por impuestos, con un límite de infraestructura (escuelas, cloacas) y una proporción mínima de área verde/comercial exigida por normativa.',
      varsOptions: ['x1,x2,x3 = acres asignados a cada uso del suelo', 'x1,x2,x3 = cantidad de familias por zona', 'x1,x2,x3 = impuestos recaudados por zona'], varsAnswer: 0,
      objOptions: ['max z = r1x1+r2x2+r3x3 (ingreso por impuestos)', 'min z = r1x1+r2x2+r3x3', 'max z = x1+x2+x3 sin ponderar ingreso'], objAnswer: 0,
      consOptions: [
        { txt: 'x1+x2+x3 ≤ A (terreno disponible)', ok: true },
        { txt: 'Capacidad de infraestructura: (uso proporcional de escuelas/cloacas) ≤ límite', ok: true },
        { txt: 'x3 ≥ mínimo normativo de área comercial', ok: true },
        { txt: 'x1 = x2 (casas y departamentos deben ser iguales)', ok: false }
      ],
      explain: 'Modelo de asignación de uso de suelo: maximiza ingresos sujetos a la superficie total, capacidad de servicios públicos y mínimos normativos por zona.'
    },
    {
      id: 'mezcla', title: '5. Mezcla y refinación',
      statement: 'Una refinería mezcla componentes (x1, x2, x3, en barriles) para producir gasolina que debe cumplir un octanaje mínimo y una demanda de producción, minimizando el costo de los componentes.',
      varsOptions: ['x_i = barriles del componente i usados en la mezcla', 'x_i = octanaje del componente i', 'x_i = precio de venta de la gasolina'], varsAnswer: 0,
      objOptions: ['min z = Σ costo_i · x_i', 'max z = Σ costo_i · x_i', 'min z = Σ octanaje_i · x_i'], objAnswer: 0,
      consOptions: [
        { txt: 'Σ octanaje_i·x_i ≥ octanaje_min · Σx_i (calidad promedio ponderada)', ok: true },
        { txt: 'Σ x_i ≥ demanda (producción mínima requerida)', ok: true },
        { txt: 'x_i ≥ 0 (no negatividad)', ok: true },
        { txt: 'x_i = x_j para todo i,j (partes iguales obligatorias)', ok: false }
      ],
      explain: 'La restricción de calidad es un promedio ponderado: la suma de octanaje·cantidad dividida por el total debe superar el mínimo, lo que se reescribe como una desigualdad lineal moviendo el total al otro lado.'
    },
    {
      id: 'medios', title: '6. Mezcla de medios publicitarios',
      statement: 'Una empresa reparte un presupuesto P entre TV (x1), radio (x2) y prensa (x3) para maximizar la exposición esperada (medida en "impactos"), respetando un tope máximo de gasto por medio y el presupuesto total.',
      varsOptions: ['x1,x2,x3 = monto invertido en cada medio', 'x1,x2,x3 = número de anuncios emitidos', 'x1,x2,x3 = audiencia total de cada medio'], varsAnswer: 0,
      objOptions: ['max z = e1x1+e2x2+e3x3 (impactos por unidad de gasto)', 'min z = e1x1+e2x2+e3x3', 'max z = x1+x2+x3'], objAnswer: 0,
      consOptions: [
        { txt: 'x1+x2+x3 ≤ P (presupuesto total)', ok: true },
        { txt: 'x_i ≤ tope_i (límite por medio)', ok: true },
        { txt: 'x_i ≥ 0', ok: true },
        { txt: 'x1=x2=x3=P/3 (reparto igualitario forzado)', ok: false }
      ],
      explain: 'Modelo de mezcla de medios: maximiza impacto esperado ponderando el gasto en cada medio por su efectividad, sujeto al presupuesto y a topes individuales.'
    }
  ];

  function mountFormulationTrainer(root) {
    root.innerHTML = FORMULATION_ITEMS.map(function (item, i) {
      var varsHtml = '<select data-role="vars" data-i="' + i + '">' + item.varsOptions.map(function (o, j) { return '<option value="' + j + '">' + o + '</option>'; }).join('') + '</select>';
      var objHtml = '<select data-role="obj" data-i="' + i + '">' + item.objOptions.map(function (o, j) { return '<option value="' + j + '">' + o + '</option>'; }).join('') + '</select>';
      var consHtml = item.consOptions.map(function (o, j) {
        return '<label class="row" style="gap:6px"><input type="checkbox" data-role="cons" data-i="' + i + '" data-j="' + j + '"> ' + o.txt + '</label>';
      }).join('');
      return '<div class="panel" data-item="' + i + '" style="margin-bottom:14px">' +
        '<div class="panel-title">' + item.title + '</div>' +
        '<p>' + item.statement + '</p>' +
        '<div class="field"><b>Variables:</b> ' + varsHtml + '</div>' +
        '<div class="field"><b>Objetivo:</b> ' + objHtml + '</div>' +
        '<div><b>Restricciones (marque todas las correctas):</b>' + consHtml + '</div>' +
        '<div class="row"><button class="btn btn-primary btn-sm" data-role="check" data-i="' + i + '">Corregir</button><span class="badge" data-role="result" data-i="' + i + '"></span></div>' +
        '<div class="callout callout-def" data-role="explain" data-i="' + i + '" hidden>' + item.explain + '</div>' +
        '</div>';
    }).join('');

    root.querySelectorAll('[data-role="check"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = parseInt(btn.getAttribute('data-i'), 10);
        var item = FORMULATION_ITEMS[i];
        var varsSel = root.querySelector('[data-role="vars"][data-i="' + i + '"]');
        var objSel = root.querySelector('[data-role="obj"][data-i="' + i + '"]');
        var boxes = root.querySelectorAll('[data-role="cons"][data-i="' + i + '"]');
        var okVars = parseInt(varsSel.value, 10) === item.varsAnswer;
        var okObj = parseInt(objSel.value, 10) === item.objAnswer;
        var okCons = true;
        boxes.forEach(function (b) {
          var j = parseInt(b.getAttribute('data-j'), 10);
          if (b.checked !== item.consOptions[j].ok) okCons = false;
        });
        var result = root.querySelector('[data-role="result"][data-i="' + i + '"]');
        var allOk = okVars && okObj && okCons;
        result.className = 'badge ' + (allOk ? 'badge-ok' : 'badge-err');
        result.textContent = allOk ? 'Correcto' : ('Revisar: ' + [!okVars && 'variables', !okObj && 'objetivo', !okCons && 'restricciones'].filter(Boolean).join(', '));
        root.querySelector('[data-role="explain"][data-i="' + i + '"]').hidden = false;
      });
    });
  }

  /* =========================================================================
   * 7) CONTENIDO — SECCIONES HTML (español)
   * ========================================================================= */

  var s1 =
    '<div class="callout callout-def"><b>Programación lineal (PL):</b> modelo matemático en el que una función objetivo lineal se optimiza (máx. o mín.) sujeta a restricciones lineales de igualdad o desigualdad, con variables de decisión no negativas.</div>' +
    '<p>Ejemplo guía del capítulo — <b>Reddy Mikks</b>: una fábrica produce pinturas de exterior e interior a partir de dos materias primas, M1 y M2. La disponibilidad diaria es 24 y 6 toneladas respectivamente. Cada tonelada de pintura exterior usa 6 de M1 y 1 de M2; cada tonelada de interior usa 4 de M1 y 2 de M2. Un estudio de mercado indica que la demanda diaria de interior no puede superar la de exterior en más de 1 tonelada, y la demanda diaria de interior no supera las 2 toneladas. El precio al mayoreo es $5000 por tonelada de exterior y $4000 por tonelada de interior. ¿Cuánto producir de cada una para maximizar el ingreso bruto diario?</p>' +
    '<div class="formula">Variables: x1 = ton/día de pintura exterior, x2 = ton/día de pintura interior<br>' +
    'max z = 5x1 + 4x2<br>' +
    's.a. 6x1 + 4x2 ≤ 24 &nbsp;(M1)<br>' +
    '&nbsp;&nbsp;&nbsp;&nbsp;x1 + 2x2 ≤ 6 &nbsp;(M2)<br>' +
    '&nbsp;&nbsp;&nbsp;&nbsp;−x1 + x2 ≤ 1 &nbsp;(mercado)<br>' +
    '&nbsp;&nbsp;&nbsp;&nbsp;x2 ≤ 2 &nbsp;(demanda)<br>' +
    '&nbsp;&nbsp;&nbsp;&nbsp;x1, x2 ≥ 0</div>' +
    '<div class="callout callout-def"><b>Supuestos de la PL:</b> ' +
    '<b>proporcionalidad</b> (la contribución de cada variable al objetivo y a las restricciones es proporcional a su valor, sin costos fijos ni economías de escala), ' +
    '<b>aditividad</b> (no hay interacción entre variables: la contribución total es la suma de las contribuciones individuales), ' +
    '<b>certidumbre</b> (todos los coeficientes a, b, c se conocen con exactitud) y ' +
    '<b>divisibilidad/no negatividad</b> (las variables pueden tomar valores fraccionarios ≥ 0).</div>' +
    '<div class="exercise"><p><b>Ejercicio 2.1.1.</b> Una carpintería fabrica sillas (x1) y mesas (x2). Cada silla requiere 2 h de carpintería y 1 h de acabado; cada mesa requiere 3 h de carpintería y 2 h de acabado. Hay 60 h de carpintería y 30 h de acabado por semana. La ganancia es $20 por silla y $30 por mesa. Formule el modelo de PL.</p>' +
    '<details class="solution"><summary>Ver solución</summary><div class="formula">max z = 20x1 + 30x2<br>s.a. 2x1 + 3x2 ≤ 60<br>x1 + 2x2 ≤ 30<br>x1, x2 ≥ 0</div></details></div>' +
    '<div class="exercise"><p><b>Ejercicio 2.1.2.</b> ¿Cuál de los cuatro supuestos de la PL se viola si el costo por unidad adicional disminuye a partir de cierta cantidad producida (descuento por volumen)?</p>' +
    '<details class="solution"><summary>Ver solución</summary><p>Se viola la <b>proporcionalidad</b>: la contribución al objetivo deja de ser estrictamente proporcional a la cantidad producida.</p></details></div>';

  var s2 =
    '<p>La <b>solución gráfica</b> aplica solo a modelos de 2 variables. Pasos: (1) graficar cada restricción como una recta y sombrear el semiplano permitido; (2) identificar la <b>región factible</b> (intersección de todos los semiplanos, incluida x1,x2≥0); (3) el óptimo de un problema de PL siempre ocurre en un <b>vértice</b> (punto extremo) de la región factible — o, si hay óptimos alternativos, a lo largo de todo un lado; (4) evaluar z en cada vértice, o usar la <b>recta de iso-utilidad</b> (recta z=k que se desplaza paralela a sí misma) y detenerla en el último vértice que toca antes de salir de la región (máx.) o el primero que toca (mín.).</p>' +
    '<div class="callout-def"><b>Vértice / punto extremo:</b> intersección factible de dos rectas-restricción (incluyendo los ejes). En 2 variables, cada vértice queda determinado por exactamente 2 restricciones activas (con igualdad).</div>' +
    '<p><b>Ejemplo resuelto (máx.) — Reddy Mikks.</b> Al graficar las 4 restricciones, la región factible es un polígono con vértices (0,0), (4,0), (3,1.5), (2,2) y (0,1). Evaluando z=5x1+4x2 en cada uno: 0, 20, <b>21</b>, 18, 4. El óptimo es <b>(x1,x2)=(3, 1.5)</b> con <b>z=21</b> (venta de 3 ton de exterior y 1.5 ton de interior por día, ingreso $21&nbsp;000).</p>' +
    '<p><b>Ejemplo resuelto (mín.) — problema de la dieta.</b> Se mezclan maíz (x1) y soja (x2) al menor costo ($0.30 y $0.90 por libra) cumpliendo: proteína mínima x1+x2≥800; fibra máxima 0.21x1−0.30x2≤0; vitamina mínima 0.03x1−0.01x2≥0. Los vértices factibles no acotados hacia arriba, pero el mínimo de z ocurre en la intersección de las dos restricciones activas de fibra y vitamina: <b>(x1,x2)≈(470.6, 329.4)</b>. Redondeando esos valores a 1 decimal y multiplicando, z≈<b>437.64</b> (usando los valores exactos sin redondear previo, z≈437.65 — la pequeña diferencia es solo por el redondeo intermedio del libro).</p>' +
    '<div class="widget wide" data-widget="graphic-solver"></div>' +
    '<div class="widget wide" data-widget="graphic-sensitivity"></div>' +
    '<div class="exercise"><p><b>Ejercicio 2.2.1.</b> Resuelva gráficamente: max z=3x1+5x2 s.a. x1≤4; 2x2≤12; 3x1+2x2≤18; x1,x2≥0.</p>' +
    '<details class="solution"><summary>Ver solución</summary><p>Vértices: (0,0) z=0; (4,0) z=12; (4,3) z=27; (2,6) z=36; (0,6) z=30. Óptimo <b>(2,6)</b>, z=<b>36</b>.</p></details></div>' +
    '<div class="exercise"><p><b>Ejercicio 2.2.2.</b> Resuelva gráficamente: min z=2x1+3x2 s.a. x1+x2≥10; x1≤8; x2≤8; x1,x2≥0. ¿La región es acotada hacia arriba?</p>' +
    '<details class="solution"><summary>Ver solución</summary><p>No está acotada hacia arriba, pero el mínimo sí existe en un vértice finito: (0,10) da z=30, (8,2) da z=22, (2,8) da z=28. Óptimo <b>(8,2)</b>, z=<b>22</b>.</p></details></div>';

  var s3 =
    '<div class="callout callout-tip"><b>Nota breve (no entra en el parcial escrito):</b> Excel Solver y AMPL resuelven PL de cualquier tamaño. En Excel Solver: se ingresan las variables en celdas, la función objetivo como fórmula (SUMAPRODUCTO de coeficientes por celdas de variables), cada restricción como una fórmula ≤/=/≥ una celda de límite, se marca "Hacer las variables sin restricciones no negativas" y se elige el motor "Simplex LP". AMPL usa una sintaxis declarativa: <span class="eq">var x1&gt;=0; var x2&gt;=0; maximize z: 5*x1+4*x2; subject to M1: 6*x1+4*x2&lt;=24;</span> etc. La ventaja de estas herramientas es escalar a decenas de variables; el examen se enfoca en el método gráfico y simplex a mano.</div>';

  var s4 =
    '<p>Estas aplicaciones se piden <b>formuladas</b> (variables + función objetivo + restricciones), sin necesidad de resolverlas a mano por tener más de 2 variables.</p>' +
    '<div class="callout-def"><b>Pasos para formular:</b> (1) identificar qué decisión se controla → variables; (2) escribir el criterio a optimizar en función de las variables → objetivo; (3) traducir cada limitación de recursos, política o balance a una desigualdad/igualdad lineal → restricciones; (4) agregar x≥0 salvo que el problema indique lo contrario.</div>' +
    '<div class="widget wide" data-widget="formulation-trainer"></div>' +
    '<div class="exercise"><p><b>Ejercicio 2.4.1 (formulación).</b> Una granja produce leche (x1, litros/día) y queso (x2, kg/día) usando 500 litros de leche cruda/día; 1 kg de queso requiere 10 litros de leche cruda, y vender leche directa requiere 1 litro de cruda por litro. La demanda máxima de queso es 40 kg/día. Ganancia: $0.5/litro de leche, $6/kg de queso. Formule.</p>' +
    '<details class="solution"><summary>Ver solución</summary><div class="formula">max z = 0.5x1 + 6x2<br>s.a. x1 + 10x2 ≤ 500<br>x2 ≤ 40<br>x1, x2 ≥ 0</div></details></div>' +
    '<div class="exercise"><p><b>Ejercicio 2.4.2 (formulación).</b> Una fábrica de muebles produce escritorios (x1) y estantes (x2). Cada escritorio deja $80 de ganancia y usa 4 h de máquina y 2 h de mano de obra; cada estante deja $50 y usa 2 h de máquina y 3 h de mano de obra. Hay 100 h de máquina y 90 h de mano de obra por semana. Formule.</p>' +
    '<details class="solution"><summary>Ver solución</summary><div class="formula">max z = 80x1 + 50x2<br>s.a. 4x1 + 2x2 ≤ 100<br>2x1 + 3x2 ≤ 90<br>x1, x2 ≥ 0</div></details></div>' +
    '<div class="exercise"><p><b>Ejercicio 2.4.3 (formulación).</b> Un hospital debe cubrir la demanda de enfermeras por 3 turnos del día (mañana, tarde, noche) con demandas 12, 15 y 8 respectivamente. Cada enfermera contratada para un turno solo cubre ese turno (sin rotación). Minimice el personal total. Formule.</p>' +
    '<details class="solution"><summary>Ver solución</summary><div class="formula">Variables: x1,x2,x3 = enfermeras en turno mañana, tarde, noche<br>min z = x1+x2+x3<br>s.a. x1≥12; x2≥15; x3≥8; x1,x2,x3≥0</div></details></div>' +
    '<div class="exercise"><p><b>Ejercicio 2.4.4 (formulación).</b> Una empresa minera extrae mineral de dos yacimientos con leyes de concentración distintas para producir una mezcla con un mínimo de concentración promedio exigido, minimizando el costo de extracción. Formule en términos generales (x1, x2 = toneladas extraídas de cada yacimiento).</p>' +
    '<details class="solution"><summary>Ver solución</summary><div class="formula">min z = c1x1 + c2x2<br>s.a. (ley1·x1 + ley2·x2) / (x1+x2) ≥ ley_min &nbsp;⇒&nbsp; (ley1−ley_min)x1 + (ley2−ley_min)x2 ≥ 0<br>x1+x2 ≥ demanda<br>x1, x2 ≥ 0</div></details></div>';

  /* =========================================================================
   * 8) CALLOUT EXAMEN + QUIZ
   * ========================================================================= */

  var examCallout =
    '<div class="callout callout-exam"><b>Lo que suele tomar el parcial (Cap 2):</b> plantear y resolver gráficamente Reddy Mikks o la dieta de memoria (vértices y z); reconocer los 4 supuestos de la PL con un ejemplo que los viole; identificar el vértice óptimo por inspección de la recta iso-z; distinguir no acotado vs. no factible en un dibujo; formular (sin resolver) al menos una de las 5 aplicaciones de 2.4 con sus restricciones bien traducidas del enunciado.</div>';

  var quiz = [
    { q: '¿Cuál es el valor óptimo de x1 en el problema Reddy Mikks (max z=5x1+4x2)?', type: 'number', answer: 3, tol: 0.05, explain: 'El vértice óptimo es (3, 1.5).' },
    { q: '¿Cuál es el valor óptimo de z en Reddy Mikks?', type: 'number', answer: 21, tol: 0.1, explain: 'z = 5(3)+4(1.5) = 21.' },
    { q: 'En el problema de la dieta (min z=0.3x1+0.9x2), ¿aproximadamente cuánto vale x2 en el óptimo?', type: 'number', answer: 329.4, tol: 2, explain: 'El óptimo es (470.6, 329.4).' },
    { q: '¿Qué supuesto de la PL se viola si duplicar la producción no duplica el costo (por ejemplo, por descuentos de volumen)?', options: ['Proporcionalidad', 'Aditividad', 'Certidumbre', 'No negatividad'], answer: 0, explain: 'La proporcionalidad exige que la contribución sea estrictamente proporcional a la cantidad.' },
    { q: '¿Qué supuesto se viola si el costo total no es simplemente la suma de los costos de cada variable por separado (hay interacción entre productos)?', options: ['Proporcionalidad', 'Aditividad', 'Certidumbre', 'Divisibilidad'], answer: 1, explain: 'La aditividad exige que no haya efectos cruzados entre variables.' },
    { q: 'En el método gráfico, el óptimo de un problema de PL (con solución única) siempre se ubica en…', options: ['El centro de la región factible', 'Un vértice de la región factible', 'Cualquier punto interior', 'El origen'], answer: 1, explain: 'El óptimo de una PL con solución única siempre es un punto extremo (vértice).' },
    { q: 'Si al desplazar la recta iso-z esta nunca deja de tocar la región factible (la región se extiende sin límite en la dirección de mejora), el problema es…', options: ['No factible', 'No acotado', 'Degenerado', 'Óptimo múltiple'], answer: 1, explain: 'Es el caso "no acotado": z puede mejorar indefinidamente.' },
    { q: 'Si dos restricciones son mutuamente incompatibles y no existe ningún punto que las satisfaga junto con x≥0, el problema es…', options: ['No acotado', 'No factible', 'Alternante', 'Degenerado'], answer: 1, explain: 'Región factible vacía = no factible.' },
    { q: 'Cuando la recta iso-z queda exactamente paralela a un lado (arista) de la región factible en el óptimo, existen…', options: ['Óptimos alternativos', 'Cero soluciones', 'Un óptimo no acotado', 'Una solución degenerada únicamente'], answer: 0, explain: 'Todo punto de ese lado (y sus extremos) da el mismo z óptimo: infinitas soluciones óptimas.' },
    { q: 'En la aplicación de "producción e inventario" como PL, la restricción de balance de cada período conecta…', options: ['Inventario anterior, producción y demanda del período', 'Solo el precio de venta', 'Solo la capacidad de la planta', 'El costo fijo únicamente'], answer: 0, explain: 'Iₜ₋₁ + xₜ − dₜ = Iₜ.' },
    { q: 'En el problema de mezcla y refinación, la restricción de calidad (p. ej. octanaje mínimo) se modela como…', options: ['Un promedio ponderado convertido en desigualdad lineal', 'Una igualdad estricta entre todos los componentes', 'Una restricción de no negatividad', 'Una función objetivo secundaria'], answer: 0, explain: 'Se reescribe Σ(calidad_i·x_i) ≥ calidad_min·Σx_i como desigualdad lineal.' },
    { q: 'En Excel Solver, para resolver un modelo de PL estándar se debe elegir como motor de resolución…', options: ['Simplex LP', 'GRG No lineal solamente', 'Evolutivo', 'Ninguno, Solver no resuelve PL'], answer: 0, explain: 'El motor "Simplex LP" está diseñado para programación lineal.' }
  ];

  /* =========================================================================
   * 9) REGISTRO DEL CAPÍTULO
   * ========================================================================= */

  IO.registerChapter({
    id: 'cap2', num: 2,
    title: 'Modelado con programación lineal',
    summary: 'Modelo de dos variables, solución gráfica (máx./mín.), sensibilidad gráfica y formulación de aplicaciones clásicas.',
    css:
      '#cap2 .cap2-example-picker{margin-bottom:8px}' +
      '#cap2 .panel{border:1px solid var(--line);border-radius:8px;padding:12px 14px;background:var(--paper-2)}' +
      '#cap2 .panel-title{font-family:"Archivo",sans-serif;font-weight:700;margin-bottom:6px}' +
      '#cap2 table.data td, #cap2 table.data th{font-family:"JetBrains Mono",monospace;font-variant-numeric:tabular-nums}' +
      '#cap2 .frac{border-bottom:1px dotted var(--ink-2);cursor:help}',
    sections: [
      { id: 'cap2-s1', title: '2.1 Modelo con dos variables', html: s1 },
      { id: 'cap2-s2', title: '2.2 Solución gráfica (máx. y mín.)', html: s2 },
      { id: 'cap2-s3', title: '2.3 Solver / AMPL', html: s3 },
      { id: 'cap2-s4', title: '2.4 Aplicaciones de la PL', html: s4 + examCallout }
    ],
    mount: function (root) {
      root.querySelectorAll('[data-widget]').forEach(function (el) {
        var w = el.getAttribute('data-widget');
        if (w === 'graphic-solver') mountGraphicSolver(el);
        else if (w === 'graphic-sensitivity') mountGraphicSensitivity(el);
        else if (w === 'formulation-trainer') mountFormulationTrainer(el);
      });
    },
    quiz: quiz
  });

  /* Hook interno de verificación numérica (no forma parte del contrato público). */
  IO.__cap2 = {
    solveLP: solveLP, computeVertices: computeVertices, recessionDirection: recessionDirection,
    objectiveRange: objectiveRange, rhsAnalysis: rhsAnalysis, attachAutoRedraw: attachAutoRedraw,
    EXAMPLES: EXAMPLES
  };
})();
