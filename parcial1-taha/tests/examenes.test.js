'use strict';
/* Pruebas de la pestaña «Exámenes anteriores»: recalcula cada respuesta numérica con fuerza
 * bruta o con algoritmos independientes. node --test tests/examenes.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load');

const ctx = loadScripts(['js/examenes.js']);
const D = JSON.parse(JSON.stringify(ctx.IO.__examenes.DATA));

function close(a, b, tol) {
  assert.ok(Math.abs(a - b) <= (tol === undefined ? 1e-6 : tol), `esperado ${b}, obtuve ${a}`);
}

/* Max c·x con A x ≤ b, x ≥ 0, 2 variables: evalúa todos los vértices factibles. */
function solve2(c, A, b) {
  const lines = A.map((r, i) => [r[0], r[1], b[i]]).concat([[1, 0, 0], [0, 1, 0]]);
  let best = null;
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const [a1, b1, c1] = lines[i];
      const [a2, b2, c2] = lines[j];
      const det = a1 * b2 - a2 * b1;
      if (Math.abs(det) < 1e-12) continue;
      const x = (c1 * b2 - c2 * b1) / det;
      const y = (a1 * c2 - a2 * c1) / det;
      if (x < -1e-9 || y < -1e-9) continue;
      if (A.some((r, k) => r[0] * x + r[1] * y > b[k] + 1e-9)) continue;
      const z = c[0] * x + c[1] * y;
      if (!best || z > best.z + 1e-9) best = { x: [x, y], z };
    }
  }
  return best;
}

function checkLP(p) {
  const s = solve2(p.c, p.A, p.b);
  close(s.z, p.opt.z);
  close(s.x[0], p.opt.x[0]);
  close(s.x[1], p.opt.x[1]);
}

function transportCost(cost, alloc) {
  let z = 0;
  alloc.forEach((row, i) => row.forEach((q, j) => {
    if (q > 0) {
      assert.notEqual(cost[i][j], null, `celda prohibida usada (${i},${j})`);
      z += q * cost[i][j];
    }
  }));
  return z;
}

function checkBalance(alloc, supply, demand) {
  alloc.forEach((row, i) => assert.equal(row.reduce((s, v) => s + v, 0), supply[i], `oferta fila ${i}`));
  demand.forEach((d, j) => assert.equal(alloc.reduce((s, r) => s + r[j], 0), d, `demanda columna ${j}`));
}

/* Óptimo exacto de transporte pequeño por fuerza bruta (valores enteros). */
function bruteTransport(cost, supply, demand) {
  const m = supply.length, n = demand.length;
  let best = Infinity;
  const alloc = supply.map(() => demand.map(() => 0));
  const rem = demand.slice();
  function rec(i, j, left) {
    if (i === m) { if (rem.every((r) => r === 0)) best = Math.min(best, transportCost(cost, alloc)); return; }
    if (j === n - 1) {
      if (left > rem[j] || (left > 0 && cost[i][j] === null)) return;
      alloc[i][j] = left; rem[j] -= left;
      rec(i + 1, 0, i + 1 < m ? supply[i + 1] : 0);
      rem[j] += left; alloc[i][j] = 0;
      return;
    }
    const maxQ = cost[i][j] === null ? 0 : Math.min(left, rem[j]);
    for (let q = 0; q <= maxQ; q++) {
      alloc[i][j] = q; rem[j] -= q;
      rec(i, j + 1, left - q);
      rem[j] += q; alloc[i][j] = 0;
    }
  }
  rec(0, 0, supply[0]);
  return best;
}

test('Examen 1: Lumbreras, óptimo (0, 40) con Z = 400', () => checkLP(D.lumbreras));

test('Examen 1: dual y1 = 2, y2 = 0 es factible y W = Z', () => {
  const y = [2, 0];
  assert.ok(4 * y[0] + 6 * y[1] >= 7);
  assert.ok(5 * y[0] + 3 * y[1] >= 10);
  assert.equal(200 * y[0] + 240 * y[1], D.lumbreras.opt.z);
});

test('Examen 2: gráfico, óptimo (3, 12) con Z = 33', () => checkLP(D.grafico2025));

test('Examen 4: Really Big Shoe, óptimo PL y entero', () => {
  checkLP(D.reallyBigShoe);
  const p = D.reallyBigShoe;
  let best = -1;
  for (let x = 0; x <= 40; x++) for (let y = 0; y <= 40; y++) {
    if (p.A.every((r, k) => r[0] * x + r[1] * y <= p.b[k])) best = Math.max(best, x + y);
  }
  assert.equal(best, p.intOpt.z);
  const [x, y] = p.intOpt.x;
  assert.ok(p.A.every((r, k) => r[0] * x + r[1] * y <= p.b[k]));
  assert.equal(x + y, p.intOpt.z);
});

test('Examen 2: transporte A/B, costo óptimo 26', () => {
  const t = D.transporteAB;
  checkBalance(t.opt.alloc, t.supply, t.demand);
  assert.equal(transportCost(t.cost, t.opt.alloc), t.opt.z);
  assert.equal(bruteTransport(t.cost, t.supply, t.demand), t.opt.z);
});

test('Examen 4: transporte C1/C2, costo óptimo 27', () => {
  const t = D.transporteC;
  checkBalance(t.opt.alloc, t.supply, t.demand);
  assert.equal(transportCost(t.cost, t.opt.alloc), t.opt.z);
  assert.equal(bruteTransport(t.cost, t.supply, t.demand), t.opt.z);
});

test('Examen 3: energía, costo mínimo 49 710 y es óptimo', () => {
  const t = D.energia;
  assert.equal(t.demand.reduce((a, b) => a + b, 0), 108);
  assert.deepEqual(t.demand, [30, 35, 25].map((d) => Math.round(d * 1.2)));
  checkBalance(t.minCost.alloc, t.supply, t.demand);
  assert.equal(transportCost(t.cost, t.minCost.alloc), t.minCost.z);
  /* Optimalidad por MODI: u_i + v_j = c_ij en las celdas básicas y costos reducidos ≥ 0. */
  const basic = [];
  t.minCost.alloc.forEach((row, i) => row.forEach((q, j) => { if (q > 0) basic.push([i, j]); }));
  assert.equal(basic.length, t.supply.length + t.demand.length - 1);
  const u = [0, null, null, null], v = [null, null, null];
  for (let k = 0; k < 10; k++) {
    basic.forEach(([i, j]) => {
      if (u[i] !== null && v[j] === null) v[j] = t.cost[i][j] - u[i];
      else if (v[j] !== null && u[i] === null) u[i] = t.cost[i][j] - v[j];
    });
  }
  assert.ok(u.every((x) => x !== null) && v.every((x) => x !== null));
  t.cost.forEach((row, i) => row.forEach((c, j) => {
    if (c !== null) assert.ok(c - u[i] - v[j] >= 0, `costo reducido negativo en (${i},${j})`);
  }));
});

test('Examen 2: PEB Peterson & Johnson, proyectos 1, 3 y 4 con 3,4', () => {
  const p = D.peb;
  let best = -1, bestMask = -1;
  for (let mask = 0; mask < 32; mask++) {
    let g = 0, c = 0;
    for (let j = 0; j < 5; j++) if (mask & (1 << j)) { g += p.gain[j]; c += p.capital[j]; }
    if (c <= p.budget && g > best + 1e-9) { best = g; bestMask = mask; }
  }
  close(best, p.opt.z);
  assert.deepEqual([0, 1, 2, 3, 4].map((j) => (bestMask >> j) & 1), p.opt.x);
});

test('Examen 3: flujo máximo A→F = 15 (Edmonds-Karp)', () => {
  const f = D.flujo;
  const cap = {};
  const nodes = new Set();
  f.arcs.forEach(([u, v, c]) => {
    nodes.add(u); nodes.add(v);
    cap[u] = cap[u] || {}; cap[v] = cap[v] || {};
    cap[u][v] = (cap[u][v] || 0) + c;
    cap[v][u] = cap[v][u] || 0;
  });
  let flow = 0;
  for (;;) {
    const prev = { [f.source]: null };
    const queue = [f.source];
    while (queue.length && !(f.sink in prev)) {
      const u = queue.shift();
      Object.keys(cap[u]).forEach((v) => {
        if (!(v in prev) && cap[u][v] > 0) { prev[v] = u; queue.push(v); }
      });
    }
    if (!(f.sink in prev)) break;
    let add = Infinity;
    for (let v = f.sink; prev[v] !== null; v = prev[v]) add = Math.min(add, cap[prev[v]][v]);
    for (let v = f.sink; prev[v] !== null; v = prev[v]) { cap[prev[v]][v] -= add; cap[v][prev[v]] += add; }
    flow += add;
  }
  assert.equal(flow, f.max);
});

test('Anexo: pizarra, esquina noroeste 10 900 y costo mínimo 8 405', () => {
  const t = D.pizarra;
  checkBalance(t.noroeste.alloc, t.supply, t.demand);
  checkBalance(t.costoMinimo.alloc, t.supply, t.demand);
  assert.equal(transportCost(t.cost, t.noroeste.alloc), t.noroeste.z);
  assert.equal(transportCost(t.cost, t.costoMinimo.alloc), t.costoMinimo.z);
  assert.equal(t.noroeste.alloc.flat().filter((q) => q > 0).length, 8);
  assert.equal(t.costoMinimo.alloc.flat().filter((q) => q > 0).length, 8);
  checkBalance(t.optimo.alloc, t.supply, t.demand);
  assert.equal(transportCost(t.cost, t.optimo.alloc), t.optimo.z);
});

test('Anexo: pizarra, óptimo 7 980 igual al motor MODI de cap5', () => {
  const c5 = loadScripts(['js/cap5.js']).IO.__cap5;
  const t = D.pizarra;
  const r = c5.modiSolve(t.supply, t.demand, t.cost, t.costoMinimo.alloc);
  assert.equal(r.cost, t.optimo.z);
});

test('Examen 3: energía, el motor MODI de cap5 confirma 49 710', () => {
  const c5 = loadScripts(['js/cap5.js']).IO.__cap5;
  const t = D.energia;
  const cost = t.cost.map((row) => row.map((c) => (c === null ? 1e6 : c)));
  assert.equal(c5.modiSolve(t.supply, t.demand, cost, t.minCost.alloc).cost, t.minCost.z);
});

test('Opción múltiple: 12 preguntas con respuesta válida y quiz registrado', () => {
  const mc = ctx.IO.__examenes.MC;
  assert.equal(mc.length, 12);
  mc.forEach((m) => { assert.equal(m[1].length, 4); assert.ok(m[2] >= 0 && m[2] < 4); });
  assert.deepEqual(mc.map((m) => 'abcd'[m[2]]).join(''), 'bcbcbccabcba');
  const ch = ctx.IO.chapters.find((c) => c.id === 'examenes');
  assert.ok(ch);
  assert.equal(ch.quiz.length, 12);
  assert.equal(ch.sections.length, 5);
});
