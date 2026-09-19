'use strict';
/* Pruebas del núcleo de transporte y asignación (js/cap5.js), vía IO.__cap5.
 * Cubre SunRay (NW/costo mínimo/Vogel/MODI), MG Auto, Joboco, balanceo y degeneración.
 */
const test = require('node:test');
const assert = require('node:assert');
const { loadScripts } = require('./helpers/load');

function ctx() {
  return loadScripts(['js/lib/frac.js', 'js/cap5.js']);
}

test('SunRay Transport: NW = 520, costo mínimo = 475, Vogel = 475, MODI óptimo = 435', () => {
  const c = ctx();
  const cap5 = c.IO.__cap5;
  const supply = [15, 25, 10];
  const demand = [5, 15, 15, 15];
  const cost = [[10, 2, 20, 11], [12, 7, 9, 20], [4, 14, 16, 18]];

  const nw = cap5.nwCorner(supply, demand);
  assert.strictEqual(cap5.totalCost(nw.alloc, cost), 520, 'esquina noroeste debe dar 520');

  const lc = cap5.leastCost(supply, demand, cost);
  assert.strictEqual(cap5.totalCost(lc.alloc, cost), 475, 'costo mínimo debe dar 475');

  const vam = cap5.vogel(supply, demand, cost);
  assert.strictEqual(cap5.totalCost(vam.alloc, cost), 475, 'Vogel debe dar 475');

  // MODI debe converger al óptimo (435) sin importar desde qué solución inicial se parta.
  [nw, lc, vam].forEach((start) => {
    const modi = cap5.modiSolve(supply, demand, cost, start.alloc);
    assert.strictEqual(modi.cost, 435, 'MODI debe converger a 435 desde cualquier inicio');
  });
});

test('MG Auto (balanceado): costo óptimo = 313200', () => {
  const c = ctx();
  const cap5 = c.IO.__cap5;
  const supply = [1000, 1500, 1200];
  const demand = [2300, 1400];
  const cost = [[80, 215], [100, 108], [102, 68]];

  assert.strictEqual(cap5.balanceProblem(supply, demand, cost).balanced, true);

  const start = cap5.vogel(supply, demand, cost);
  const modi = cap5.modiSolve(supply, demand, cost, start.alloc);
  assert.strictEqual(modi.cost, 313200);
});

test('Joboco (asignación 3x3): costo óptimo = 27', () => {
  const c = ctx();
  const cap5 = c.IO.__cap5;
  const matrix = [[15, 10, 9], [9, 15, 10], [10, 12, 8]];
  const res = cap5.hungarianSolve(matrix);
  assert.strictEqual(res.cost, 27);
  // Cada fila y cada columna debe usarse exactamente una vez.
  assert.strictEqual(res.assign.length, 3);
  // res.assign es un array creado dentro del vm context de las pruebas; se copia a un
  // array "nativo" de este realm antes de comparar (deepStrictEqual exige mismo constructor).
  const rows = Array.from(res.assign.map((a) => a.r)).sort();
  const cols = Array.from(res.assign.map((a) => a.c)).sort();
  assert.deepStrictEqual([...rows], [0, 1, 2]);
  assert.deepStrictEqual([...cols], [0, 1, 2]);
});

test('Balanceo: oferta != demanda agrega ficticio y el óptimo coincide con el cálculo manual', () => {
  const c = ctx();
  const cap5 = c.IO.__cap5;
  // MG Auto desbalanceado: Detroit reduce oferta a 1300 (oferta total 3500 < demanda 3700).
  const supply = [1000, 1300, 1200];
  const demand = [2300, 1400];
  const cost = [[80, 215], [100, 108], [102, 68]];

  const balanced = cap5.balanceProblem(supply, demand, cost);
  assert.strictEqual(balanced.balanced, true);
  assert.strictEqual(balanced.addedRow, true, 'debe agregar una fuente ficticia (falta oferta)');
  assert.strictEqual(balanced.addedCol, false);
  assert.strictEqual(balanced.supply.length, 4);
  assert.strictEqual(balanced.supply[3], 200, 'la fuente ficticia debe cubrir 3700 - 3500 = 200');
  assert.deepStrictEqual([...balanced.cost[3]], [0, 0], 'la fuente ficticia tiene costo 0 en todas las rutas');

  const start = cap5.vogel(balanced.supply, balanced.demand, balanced.cost);
  const modi = cap5.modiSolve(balanced.supply, balanced.demand, balanced.cost, start.alloc);
  // Óptimo calculado a mano: LA->Denver 1000 (80), Nueva Orleans->Miami 1200 (68),
  // Detroit->Denver 1300 (100) cubre el resto de Denver, y la fuente ficticia (200,
  // costo 0) cubre las 200 unidades de Miami que no alcanza a cubrir la oferta real.
  // 80·1000 + 68·1200 + 100·1300 + 0·200 = 80000 + 81600 + 130000 = 291600.
  assert.strictEqual(modi.cost, 291600);

  // Caso de destino ficticio: MG Auto con demanda de Denver reducida a 2000 (oferta 3700 > demanda 3400).
  const supply2 = [1000, 1500, 1200];
  const demand2 = [2000, 1400];
  const balanced2 = cap5.balanceProblem(supply2, demand2, cost);
  assert.strictEqual(balanced2.balanced, true);
  assert.strictEqual(balanced2.addedCol, true, 'debe agregar un destino ficticio (sobra oferta)');
  assert.strictEqual(balanced2.addedRow, false);
  assert.strictEqual(balanced2.demand.length, 3);
  assert.strictEqual(balanced2.demand[2], 300, 'el destino ficticio debe absorber 3700 - 3400 = 300');

  const start2 = cap5.vogel(balanced2.supply, balanced2.demand, balanced2.cost);
  const modi2 = cap5.modiSolve(balanced2.supply, balanced2.demand, balanced2.cost, start2.alloc);
  assert.strictEqual(modi2.cost, 283200);
});

test('Degeneración: oferta (10,10), demanda (10,10), costos [[1,2],[3,1]] -> óptimo 20, MODI resuelve igual', () => {
  const c = ctx();
  const cap5 = c.IO.__cap5;
  const supply = [10, 10];
  const demand = [10, 10];
  const cost = [[1, 2], [3, 1]];

  // La esquina noroeste en este caso asigna (10,0)/(0,10): F1->D1=10, F1 se agota exactamente
  // cuando D1 también se agota, lo que deja menos de m+n-1=3 celdas básicas (degeneración
  // en el arranque). MODI debe manejarlo (completando con una celda 0) y llegar al óptimo.
  const nw = cap5.nwCorner(supply, demand);
  const basicCount = nw.alloc.reduce((acc, row) => acc + row.filter((v) => v > 0).length, 0);
  assert.ok(basicCount < 3, 'el arranque de este caso debe quedar degenerado (menos de m+n-1 básicas)');

  const modi = cap5.modiSolve(supply, demand, cost, nw.alloc);
  assert.strictEqual(modi.cost, 20, 'el óptimo manual es F1->D1=10 (costo 10) + F2->D2=10 (costo 10) = 20');
});
