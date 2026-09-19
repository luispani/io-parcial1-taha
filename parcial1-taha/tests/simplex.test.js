'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadScripts } = require('./helpers/load');

const ctx = loadScripts(['js/lib/frac.js', 'js/lib/simplex.js']);
const S = ctx.IO.Simplex;

function num(frac) { return frac.toNumber(); }

test('Reddy Mikks: max z = 5x1 + 4x2 -> z = 21, (x1,x2) = (3, 1.5)', () => {
  const model = S.parse({
    type: 'max', c: [5, 4],
    constraints: [
      { a: [6, 4], op: '<=', b: 24 },
      { a: [1, 2], op: '<=', b: 6 },
      { a: [-1, 1], op: '<=', b: 1 },
      { a: [0, 1], op: '<=', b: 2 },
    ],
  });
  const r = S.solve(model, { method: 'auto' });
  assert.strictEqual(r.status, 'optimal');
  assert.strictEqual(r.optimal.z.toString(), '21');
  assert.strictEqual(num(r.optimal.x.x1), 3);
  assert.strictEqual(num(r.optimal.x.x2), 1.5);

  // Dantzig is the default entering rule (rule: 'auto', matching the
  // textbook/class sequence): x1 has the most negative initial reduced cost
  // (-5 vs -4 for x2), so it must enter first, and the optimum is reached in
  // exactly two pivots (a third "iteration" snapshot records the optimal stop).
  assert.strictEqual(r.iterations[0].entering, 0);
  assert.strictEqual(r.iterations[0].varNames[r.iterations[0].entering], 'x1');
  assert.strictEqual(r.iterations.length, 3);
  assert.strictEqual(r.iterations[2].entering, null);
});

test('TOYCO: max z = 3x1 + 2x2 + 5x3 -> z = 1350, duals (1,2,0), rhs ranges', () => {
  const model = S.parse({
    type: 'max', c: [3, 2, 5],
    constraints: [
      { a: [1, 2, 1], op: '<=', b: 430 },
      { a: [3, 0, 2], op: '<=', b: 460 },
      { a: [1, 4, 0], op: '<=', b: 420 },
    ],
  });
  const r = S.solve(model, { method: 'auto' });
  assert.strictEqual(r.status, 'optimal');
  assert.strictEqual(r.optimal.z.toString(), '1350');
  assert.strictEqual(num(r.optimal.x.x1), 0);
  assert.strictEqual(num(r.optimal.x.x2), 100);
  assert.strictEqual(num(r.optimal.x.x3), 230);

  // Dantzig entering rule (default rule: 'auto') reproduces the textbook/class
  // tableau sequence: x3 has the most negative initial reduced cost (-5, vs
  // -3 for x1 and -2 for x2) and must enter first, kicking s2 out; then x2
  // enters and kicks out s1 — matching Taha's TOYCO walkthrough.
  assert.strictEqual(r.iterations[0].entering, 2);
  assert.strictEqual(r.iterations[0].varNames[r.iterations[0].entering], 'x3');
  assert.strictEqual(r.iterations[0].varNames[r.iterations[0].basis[r.iterations[0].leaving]], 's2');
  assert.strictEqual(r.iterations[1].entering, 1);
  assert.strictEqual(r.iterations[1].varNames[r.iterations[1].entering], 'x2');
  assert.strictEqual(r.iterations[1].varNames[r.iterations[1].basis[r.iterations[1].leaving]], 's1');

  const sens = r.sensitivity;
  assert.deepStrictEqual(Array.from(sens.duals, (d) => d.toString()), ['1', '2', '0']);

  // Feasibility (RHS) ranges from SPEC.md §5 / Taha 9a ed. 3.6:
  // b1 in [230, 440], b2 in [440, 860], b3 >= 400 (b3 has no finite upper bound).
  const [r1, r2, r3] = sens.rhsRanges;
  assert.strictEqual(r1.lower.toString(), '230');
  assert.strictEqual(r1.upper.toString(), '440');
  assert.strictEqual(r2.lower.toString(), '440');
  assert.strictEqual(r2.upper.toString(), '860');
  assert.strictEqual(r3.lower.toString(), '400');
  assert.strictEqual(r3.upper, null);

  // Optimality ranges of c1, c2, c3, deduced from the optimal tableau:
  //  - x1 is nonbasic. Its reduced cost is z1 - c1 = y.a1 - c1
  //    = (1,2,0)-(1,3,1) - 3 = (1*1 + 2*3 + 0*1) - 3 = 7 - 3 = 4.
  //    A nonbasic max variable's cost may rise up to c1 + (z1-c1) = 3 + 4 = 7
  //    before it would want to enter the basis: range (-inf, 7].
  //  - x2 and x3 are basic. Changing c_j by delta shifts every nonbasic
  //    reduced cost by delta * a_rk (a_rk = row of x_j in the optimal
  //    tableau); optimality (z_k - c_k >= 0 for max) bounds delta from both
  //    sides depending on the sign of a_rk. Solving that system on the
  //    optimal TOYCO tableau (basis x2, x3, s3) gives c2 in [0, 10] and
  //    c3 in [7/3, +inf).
  const [c1r, c2r, c3r] = sens.cRanges;
  assert.strictEqual(c1r.j, 0);
  assert.strictEqual(c1r.lower, null);
  assert.strictEqual(c1r.upper.toString(), '7');
  assert.strictEqual(c2r.j, 1);
  assert.strictEqual(c2r.lower.toString(), '0');
  assert.strictEqual(c2r.upper.toString(), '10');
  assert.strictEqual(c3r.j, 2);
  assert.strictEqual(c3r.lower.toString(), '7/3');
  assert.strictEqual(c3r.upper, null);
});

test('2.1 regression: two-phase transition from phase I to phase II (max x1, -x1 = 0)', () => {
  const model = S.parse({
    type: 'max', c: [1],
    constraints: [{ a: [-1], op: '=', b: 0 }],
  });
  const r = S.solve(model, { method: 'twophase' });
  // Was 'unbounded' before the phase I -> II fix (a basic-but-meaningless
  // artificial variable made the ratio test see a spurious constraint).
  assert.strictEqual(r.status, 'optimal');
  assert.strictEqual(r.optimal.z.toString(), '0');
  assert.strictEqual(num(r.optimal.x.x1), 0);
});

test('two-phase textbook example: min z = 4x1 + x2 -> z = 17/5, (x1,x2) = (2/5, 9/5)', () => {
  const model = S.parse({
    type: 'min', c: [4, 1],
    constraints: [
      { a: [3, 1], op: '=', b: 3 },
      { a: [4, 3], op: '>=', b: 6 },
      { a: [1, 2], op: '<=', b: 4 },
    ],
  });
  const r = S.solve(model, { method: 'twophase' });
  assert.strictEqual(r.status, 'optimal');
  assert.strictEqual(r.optimal.z.toString(), '17/5');
  assert.strictEqual(r.optimal.x.x1.toString(), '2/5');
  assert.strictEqual(r.optimal.x.x2.toString(), '9/5');
});

test('infeasible problem is detected', () => {
  const model = S.parse({
    type: 'max', c: [3, 2],
    constraints: [
      { a: [2, 1], op: '<=', b: 2 },
      { a: [3, 4], op: '>=', b: 12 },
    ],
  });
  const r = S.solve(model, { method: 'auto' });
  assert.strictEqual(r.status, 'infeasible');
  assert.strictEqual(r.optimal, null);
});

test('unbounded problem is detected', () => {
  const model = S.parse({
    type: 'max', c: [2, 1],
    constraints: [
      { a: [1, -1], op: '<=', b: 10 },
      { a: [2, 0], op: '<=', b: 40 },
    ],
  });
  const r = S.solve(model, { method: 'auto' });
  assert.strictEqual(r.status, 'unbounded');
  assert.strictEqual(r.optimal, null);
});

test('alternative optima: max 2x1 + 4x2 -> z = 10', () => {
  const model = S.parse({
    type: 'max', c: [2, 4],
    constraints: [
      { a: [1, 2], op: '<=', b: 5 },
      { a: [1, 1], op: '<=', b: 4 },
    ],
  });
  const r = S.solve(model, { method: 'auto' });
  assert.strictEqual(r.status, 'alternative');
  assert.strictEqual(r.optimal.z.toString(), '10');
});

test('degeneracy: max 3x1 + 9x2 -> z = 18', () => {
  const model = S.parse({
    type: 'max', c: [3, 9],
    constraints: [
      { a: [1, 4], op: '<=', b: 8 },
      { a: [1, 2], op: '<=', b: 4 },
    ],
  });
  const r = S.solve(model, { method: 'auto' });
  assert.strictEqual(r.status, 'degenerate');
  assert.strictEqual(r.optimal.z.toString(), '18');
});

test('2.2 regression: Bland anti-cycling on the classic cycling example -> z = 1, x = (1,0,1,0)', () => {
  const model = S.parse({
    type: 'max', c: [10, -57, -9, -24],
    constraints: [
      { a: [0.5, -5.5, -2.5, 9], op: '<=', b: 0 },
      { a: [0.5, -1.5, -0.5, 1], op: '<=', b: 0 },
      { a: [1, 0, 0, 0], op: '<=', b: 1 },
    ],
  });
  const r = S.solve(model, { method: 'auto' });
  // Before Bland's rule this cycled: the loop exhausted its (undetected)
  // iteration cap and silently reported the degenerate starting vertex
  // (z = 0, x = 0) as if it were the answer.
  assert.notStrictEqual(r.status, 'iteration_limit');
  assert.ok(r.optimal, 'expected an optimal solution, not ' + r.status);
  assert.strictEqual(r.optimal.z.toString(), '1');
  assert.strictEqual(num(r.optimal.x.x1), 1);
  assert.strictEqual(num(r.optimal.x.x2), 0);
  assert.strictEqual(num(r.optimal.x.x3), 1);
  assert.strictEqual(num(r.optimal.x.x4), 0);
});

test('2.2 rule: dantzig forces the classic cycle (Beale) -> iteration_limit', () => {
  // Same model as above, but pinned to pure Dantzig (no auto-switch to
  // Bland): this is the textbook example that cycles forever under Dantzig,
  // so it must exhaust maxIterations instead of reaching an optimum.
  const model = S.parse({
    type: 'max', c: [10, -57, -9, -24],
    constraints: [
      { a: [0.5, -5.5, -2.5, 9], op: '<=', b: 0 },
      { a: [0.5, -1.5, -0.5, 1], op: '<=', b: 0 },
      { a: [1, 0, 0, 0], op: '<=', b: 1 },
    ],
  });
  const r = S.solve(model, { rule: 'dantzig', maxIterations: 30 });
  assert.strictEqual(r.status, 'iteration_limit');
  assert.strictEqual(r.optimal, null);
});

test('2.2 iteration_limit: exhausting maxIterations never reports optimal/degenerate', () => {
  const model = S.parse({
    type: 'max', c: [5, 4],
    constraints: [
      { a: [6, 4], op: '<=', b: 24 },
      { a: [1, 2], op: '<=', b: 6 },
    ],
  });
  const r = S.solve(model, { method: 'auto', maxIterations: 1 });
  assert.strictEqual(r.status, 'iteration_limit');
  assert.strictEqual(r.optimal, null);
});

test('2.3 minimal optimality range: max x1 s.t. x1 <= 2 -> c1 range [0, +inf)', () => {
  const model = S.parse({
    type: 'max', c: [1],
    constraints: [{ a: [1], op: '<=', b: 2 }],
  });
  const r = S.solve(model, { method: 'auto' });
  assert.strictEqual(r.status, 'optimal');
  assert.strictEqual(r.optimal.x.x1.toString(), '2');
  assert.strictEqual(r.optimal.z.toString(), '2');
  // Regression: this used to report approximately (-inf, 2].
  const c1r = r.sensitivity.cRanges[0];
  assert.strictEqual(c1r.lower.toString(), '0');
  assert.strictEqual(c1r.upper, null);
});

test('2.3 sensitivity for a nonbasic variable in a min problem', () => {
  // min z = 4x1 + x2; 3x1+x2=3; 4x1+3x2>=6; x1+2x2<=4 -> optimal (2/5, 9/5)
  const model = S.parse({
    type: 'min', c: [4, 1],
    constraints: [
      { a: [3, 1], op: '=', b: 3 },
      { a: [4, 3], op: '>=', b: 6 },
      { a: [1, 2], op: '<=', b: 4 },
    ],
  });
  const r = S.solve(model, { method: 'twophase' });
  assert.strictEqual(r.status, 'optimal');
  // Both x1 and x2 are basic here (nondegenerate 2-variable optimum), so
  // just check the ranges are internally consistent: the current cost must
  // lie inside its own reported optimality range.
  [4, 1].forEach((cj, j) => {
    const range = r.sensitivity.cRanges[j];
    const val = ctx.Frac.from(cj);
    if (range.lower !== null) assert.ok(val.cmp(range.lower) >= 0, 'c' + j + ' below its own lower bound');
    if (range.upper !== null) assert.ok(val.cmp(range.upper) <= 0, 'c' + j + ' above its own upper bound');
  });
});
