'use strict';
/* Pruebas del solucionador gráfico (Cap 2). node --test tests/graphic.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load');

function ctx() {
  return loadScripts(['js/lib/frac.js', 'js/cap2.js']);
}

function close(actual, expected, tol) {
  tol = tol === undefined ? 1e-3 : tol;
  assert.ok(Math.abs(actual - expected) <= tol, `esperado ${expected}, obtuve ${actual}`);
}

test('Reddy Mikks: óptimo (3, 1.5), z=21', () => {
  const { IO } = ctx();
  const ex = IO.__cap2.EXAMPLES.reddy;
  const r = IO.__cap2.solveLP(ex.constraints, ex.c1, ex.c2, ex.sense);
  assert.equal(r.status, 'optimal');
  close(r.optimal.x, 3);
  close(r.optimal.y, 1.5);
  close(r.optimal.z, 21);
});

test('Dieta (mín.): óptimo (470.6, 329.4), z≈437.65', () => {
  const { IO } = ctx();
  const ex = IO.__cap2.EXAMPLES.dieta;
  const r = IO.__cap2.solveLP(ex.constraints, ex.c1, ex.c2, ex.sense);
  assert.equal(r.status, 'optimal');
  close(r.optimal.x, 470.588, 0.01);
  close(r.optimal.y, 329.412, 0.01);
  close(r.optimal.z, 437.647, 0.01);
});

test('óptimos alternativos: al menos dos vértices con el mismo z', () => {
  const { IO } = ctx();
  const ex = IO.__cap2.EXAMPLES.alternos;
  const r = IO.__cap2.solveLP(ex.constraints, ex.c1, ex.c2, ex.sense);
  assert.equal(r.status, 'alternative');
  assert.ok(r.alternates.length >= 2);
  const z0 = r.alternates[0].z;
  r.alternates.forEach((p) => close(p.z, z0, 1e-4));
});

test('no factible: restricciones incompatibles', () => {
  const { IO } = ctx();
  const ex = IO.__cap2.EXAMPLES.nofactible;
  const r = IO.__cap2.solveLP(ex.constraints, ex.c1, ex.c2, ex.sense);
  assert.equal(r.status, 'infeasible');
});

test('no acotado: existe dirección de recesión que mejora z', () => {
  const { IO } = ctx();
  const ex = IO.__cap2.EXAMPLES.noacotado;
  const r = IO.__cap2.solveLP(ex.constraints, ex.c1, ex.c2, ex.sense);
  assert.equal(r.status, 'unbounded');
  assert.ok(r.direction);
});

test('regresión: caso acotado alejado (1001,1000), z=2001 (no debe confundirse con no acotado)', () => {
  const { IO } = ctx();
  const constraints = [
    { a: 1, b: -1, op: '<=', c: 1 },
    { a: -1, b: 1.001, op: '<=', c: 0 }
  ];
  const r = IO.__cap2.solveLP(constraints, 1, 1, 'max');
  assert.equal(r.status, 'optimal');
  close(r.optimal.x, 1001, 0.01);
  close(r.optimal.y, 1000, 0.01);
  close(r.optimal.z, 2001, 0.01);
  // La ventana de dibujo debe ajustarse para que el óptimo alejado entre en la vista.
  assert.ok(r.viewSize > 1000, `viewSize (${r.viewSize}) debería cubrir el óptimo alejado`);
});

test('limpieza de listeners: montar N veces no multiplica listeners de resize/themechange', () => {
  // El helper de tests (tests/helpers/load.js, compartido con otros capítulos) no
  // parsea innerHTML/querySelector como un DOM real, así que no se puede montar el
  // widget completo aquí. Se ejercita directamente IO.__cap2.attachAutoRedraw, el
  // mecanismo real (compartido por ambos widgets de cap2) que registra resize/
  // themechange/matchMedia y su limpieza vía IO.registerCleanup (SPEC.md §2 y §5).
  const { IO, window } = ctx();
  assert.equal(typeof IO.__cap2.attachAutoRedraw, 'function');

  function mountAndCleanup() {
    IO._cleanups = IO._cleanups || [];
    IO.__cap2.attachAutoRedraw(function () {});
    const before = window.listenerCount('resize') + window.listenerCount('themechange');
    IO._cleanups.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
    IO._cleanups = [];
    return before;
  }

  const first = mountAndCleanup();
  assert.ok(first > 0, 'montar debe registrar al menos un listener de resize/themechange');
  const afterCleanup = window.listenerCount('resize') + window.listenerCount('themechange');
  assert.equal(afterCleanup, 0, 'la limpieza debe retirar todos los listeners');

  const second = mountAndCleanup();
  assert.equal(second, first, 'montar de nuevo no debe acumular listeners (mismo conteo que la primera vez)');

  const third = mountAndCleanup();
  assert.equal(third, first, 'visitar el capítulo N veces no debe dejar N listeners');
});
