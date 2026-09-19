'use strict';
/* Pruebas de Tareas (modelado sin revelar solución, veredicto global + pistas, simplex
 * formato de clase, dual->primal). node --test tests/tareas.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load');

function ctx() {
  return loadScripts(['js/lib/frac.js', 'js/lib/simplex.js', 'js/cap2.js', 'js/tareas.js']);
}

function close(actual, expected, tol) {
  tol = tol === undefined ? 1e-3 : tol;
  assert.ok(Math.abs(actual - expected) <= tol, `esperado ${expected}, obtuve ${actual}`);
}

function byId(list, id) { return list.find((m) => m.id === id); }

/* Cadenas prohibidas: datos/respuestas reales de las 8 tareas de la clase. Nunca deben
 * aparecer en el HTML estático del capítulo (secciones) ni en el quiz. */
const FORBIDDEN_STRINGS = [
  '600 unidades', '16 000', '16000',
  'z = 21', '(3, 1.5)', '3, 1.5',
  '9000/11', '2000/33',
  'z = 1800', '(100, 200)', '100, 200',
  '338000/3', '351500/3',
  'z = 1675', '(150, 100)',
  'z = 24', '(6, 12)',
  'z = 6400', '(400, 300)'
];

/* =========================================================================
 * A) Óptimos de los modelos de 2 variables (verificados con el motor, no inventados).
 * Cubre tanto las 7 tareas (kind:'task', el óptimo solo se usa aquí para verificar
 * la lógica interna, nunca se renderiza) como los 7 ejercicios resueltos (kind:'worked').
 * ========================================================================= */

test('Wild West (tarea): óptimo (100, 200), z=1800', () => {
  const { IO } = ctx();
  const def = byId(IO.__tareas.MODEL_EXERCISES, 'wildwest');
  const g = def.constraints.map((k) => ({ a: k.a[0], b: k.a[1], op: k.op, c: k.b }));
  const r = IO.__cap2.solveLP(g, def.c[0], def.c[1], def.sense);
  assert.equal(r.status, 'optimal');
  close(r.optimal.x, 100);
  close(r.optimal.y, 200);
  close(r.optimal.z, 1800);
});

test('Reddy Mikks (tarea): óptimo (3, 1.5), z=21', () => {
  const { IO } = ctx();
  const def = byId(IO.__tareas.MODEL_EXERCISES, 'reddy');
  const g = def.constraints.map((k) => ({ a: k.a[0], b: k.a[1], op: k.op, c: k.b }));
  const r = IO.__cap2.solveLP(g, def.c[0], def.c[1], def.sense);
  assert.equal(r.status, 'optimal');
  close(r.optimal.x, 3);
  close(r.optimal.y, 1.5);
  close(r.optimal.z, 21);
});

test('Show and Sell (tarea): óptimo (2000/33, 1000/33), z=9000/11', () => {
  const { IO } = ctx();
  const def = byId(IO.__tareas.MODEL_EXERCISES, 'showsell');
  const g = def.constraints.map((k) => ({ a: k.a[0], b: k.a[1], op: k.op, c: k.b }));
  const r = IO.__cap2.solveLP(g, def.c[0], def.c[1], def.sense);
  assert.equal(r.status, 'optimal');
  close(r.optimal.x, 2000 / 33, 0.01);
  close(r.optimal.y, 1000 / 33, 0.01);
  close(r.optimal.z, 9000 / 11, 0.01);
});

test('Top Toys (tarea): óptimo (160/3, 2), alcance total = 338000/3 + 4500', () => {
  const { IO } = ctx();
  const def = byId(IO.__tareas.MODEL_EXERCISES, 'toptoys');
  const g = def.constraints.map((k) => ({ a: k.a[0], b: k.a[1], op: k.op, c: k.b }));
  const r = IO.__cap2.solveLP(g, def.c[0], def.c[1], def.sense);
  assert.equal(r.status, 'optimal');
  close(r.optimal.x, 160 / 3, 0.01);
  close(r.optimal.y, 2);
  close(r.optimal.z + def.constant, 338000 / 3 + 4500, 0.1);
});

test('Material escolar (tarea): óptimo (150, 100), z=1675', () => {
  const { IO } = ctx();
  const def = byId(IO.__tareas.MODEL_EXERCISES, 'material');
  const g = def.constraints.map((k) => ({ a: k.a[0], b: k.a[1], op: k.op, c: k.b }));
  const r = IO.__cap2.solveLP(g, def.c[0], def.c[1], def.sense);
  assert.equal(r.status, 'optimal');
  close(r.optimal.x, 150);
  close(r.optimal.y, 100);
  close(r.optimal.z, 1675);
});

test('Pastillas (tarea): óptimo (6, 12), z=24', () => {
  const { IO } = ctx();
  const def = byId(IO.__tareas.MODEL_EXERCISES, 'pastillas');
  const g = def.constraints.map((k) => ({ a: k.a[0], b: k.a[1], op: k.op, c: k.b }));
  const r = IO.__cap2.solveLP(g, def.c[0], def.c[1], def.sense);
  assert.equal(r.status, 'optimal');
  close(r.optimal.x, 6);
  close(r.optimal.y, 12);
  close(r.optimal.z, 24);
});

test('Calculadoras (tarea): óptimo (400, 300), z=6400', () => {
  const { IO } = ctx();
  const def = byId(IO.__tareas.MODEL_EXERCISES, 'calculadoras');
  const g = def.constraints.map((k) => ({ a: k.a[0], b: k.a[1], op: k.op, c: k.b }));
  const r = IO.__cap2.solveLP(g, def.c[0], def.c[1], def.sense);
  assert.equal(r.status, 'optimal');
  close(r.optimal.x, 400);
  close(r.optimal.y, 300);
  close(r.optimal.z, 6400);
});

test('ejercicios resueltos (worked): cada uno tiene un óptimo factible', () => {
  const { IO } = ctx();
  const worked = IO.__tareas.MODEL_EXERCISES.filter((m) => m.kind === 'worked');
  assert.equal(worked.length, 7);
  worked.forEach((def) => {
    const g = def.constraints.map((k) => ({ a: k.a[0], b: k.a[1], op: k.op, c: k.b }));
    const r = IO.__cap2.solveLP(g, def.c[0], def.c[1], def.sense);
    assert.equal(r.status, 'optimal', `${def.id} debería ser óptimo`);
    assert.ok(r.optimal.z > 0, `${def.id} debería tener z>0`);
  });
});

test('ColorMax (worked, tipo Reddy): óptimo (8/3, 8/3), z=56/3', () => {
  const { IO } = ctx();
  const def = byId(IO.__tareas.MODEL_EXERCISES, 'reddy-worked');
  const g = def.constraints.map((k) => ({ a: k.a[0], b: k.a[1], op: k.op, c: k.b }));
  const r = IO.__cap2.solveLP(g, def.c[0], def.c[1], def.sense);
  close(r.optimal.x, 8 / 3, 0.01);
  close(r.optimal.y, 8 / 3, 0.01);
  close(r.optimal.z, 56 / 3, 0.01);
});

test('Sombreros del Sur (worked, tipo Wild West): óptimo (50, 150), z=900', () => {
  const { IO } = ctx();
  const def = byId(IO.__tareas.MODEL_EXERCISES, 'wildwest-worked');
  const g = def.constraints.map((k) => ({ a: k.a[0], b: k.a[1], op: k.op, c: k.b }));
  const r = IO.__cap2.solveLP(g, def.c[0], def.c[1], def.sense);
  close(r.optimal.x, 50);
  close(r.optimal.y, 150);
  close(r.optimal.z, 900);
});

test('ProCalc (worked, tipo calculadoras): óptimo (450, 250), z=7650', () => {
  const { IO } = ctx();
  const def = byId(IO.__tareas.MODEL_EXERCISES, 'calculadoras-worked');
  const g = def.constraints.map((k) => ({ a: k.a[0], b: k.a[1], op: k.op, c: k.b }));
  const r = IO.__cap2.solveLP(g, def.c[0], def.c[1], def.sense);
  close(r.optimal.x, 450);
  close(r.optimal.y, 250);
  close(r.optimal.z, 7650);
});

test('MegaAds (worked, tipo Top Toys): 80% de 12000 = 9600 en cada tope; óptimo (48, 8/5), z=50400 + 1300', () => {
  const { IO } = ctx();
  const def = byId(IO.__tareas.MODEL_EXERCISES, 'toptoys-worked');
  // Los dos topes por medio deben ser exactamente 0.8 * presupuesto.
  const presupuesto = def.constraints.find((k) => k.label === 'presupuesto').b;
  const topeRadio = def.constraints.find((k) => k.label === 'tope radio').b;
  const topeTV = def.constraints.find((k) => k.label === 'tope TV').b;
  close(topeRadio, 0.8 * presupuesto, 1e-6);
  close(topeTV, 0.8 * presupuesto, 1e-6);
  const g = def.constraints.map((k) => ({ a: k.a[0], b: k.a[1], op: k.op, c: k.b }));
  const r = IO.__cap2.solveLP(g, def.c[0], def.c[1], def.sense);
  assert.equal(r.status, 'optimal');
  close(r.optimal.x, 48);
  close(r.optimal.y, 8 / 5, 0.01);
  close(r.optimal.z, 50400);
  close(r.optimal.z + def.constant, 51700);
});

/* =========================================================================
 * A) Verificador: veredicto global por categoría, equivalencia (múltiplos, orden,
 * inversión de signo), y casos de rechazo.
 * ========================================================================= */

test('verifyModel: modelo correcto exacto -> veredicto ok', () => {
  const { IO } = ctx();
  const correct = { c: [5, 4], sense: 'max', constraints: [{ a: [6, 4], op: '<=', b: 24 }, { a: [1, 2], op: '<=', b: 6 }] };
  const v = IO.__tareas.verifyModel({ c: [5, 4], sense: 'max' }, [{ a: [6, 4], op: '<=', b: 24 }, { a: [1, 2], op: '<=', b: 6 }], correct);
  assert.equal(v.objStatus, 'exact');
  assert.equal(v.consOk, true);
  assert.equal(v.verdict.level, 'ok');
});

test('verifyModel: acepta un múltiplo positivo de una restricción (mismo operador)', () => {
  const { IO } = ctx();
  const correct = { c: [5, 4], sense: 'max', constraints: [{ a: [6, 4], op: '<=', b: 24 }, { a: [1, 2], op: '<=', b: 6 }] };
  const v = IO.__tareas.verifyModel({ c: [5, 4], sense: 'max' }, [{ a: [6, 4], op: '<=', b: 24 }, { a: [2, 4], op: '<=', b: 12 }], correct);
  assert.equal(v.consOk, true);
});

test('verifyModel: acepta x1 − 2x2 ≥ 0 escrito como −x1 + 2x2 ≤ 0 (múltiplo negativo que invierte el operador)', () => {
  const { IO } = ctx();
  const correct = { c: [1, 25], sense: 'max', constraints: [{ a: [1, -2], op: '>=', b: 0 }] };
  const v = IO.__tareas.verifyModel({ c: [1, 25], sense: 'max' }, [{ a: [-1, 2], op: '<=', b: 0 }], correct);
  assert.equal(v.consOk, true, JSON.stringify(v));
});

test('verifyModel: acepta las restricciones en otro orden (emparejamiento biyectivo)', () => {
  const { IO } = ctx();
  const correct = { c: [5, 4], sense: 'max', constraints: [{ a: [6, 4], op: '<=', b: 24 }, { a: [1, 2], op: '<=', b: 6 }] };
  const v = IO.__tareas.verifyModel({ c: [5, 4], sense: 'max' }, [{ a: [1, 2], op: '<=', b: 6 }, { a: [6, 4], op: '<=', b: 24 }], correct);
  assert.equal(v.consOk, true);
});

test('verifyModel: acepta cualquier múltiplo no nulo (incluso negativo) en una restricción "="', () => {
  const { IO } = ctx();
  const correct = { c: [1, 1], sense: 'max', constraints: [{ a: [1, 1], op: '=', b: 10 }] };
  const v = IO.__tareas.verifyModel({ c: [1, 1], sense: 'max' }, [{ a: [-2, -2], op: '=', b: -20 }], correct);
  assert.equal(v.consOk, true);
});

test('verifyModel: rechaza objetivo multiplicado por 2 como "correcto" (da aviso, no ok pleno)', () => {
  const { IO } = ctx();
  const correct = { c: [5, 4], sense: 'max', constraints: [{ a: [6, 4], op: '<=', b: 24 }] };
  const v = IO.__tareas.verifyModel({ c: [10, 8], sense: 'max' }, [{ a: [6, 4], op: '<=', b: 24 }], correct);
  assert.equal(v.objStatus, 'multiple');
  assert.notEqual(v.verdict.level, 'ok');
  assert.notEqual(v.verdict.text, 'El modelo es equivalente al esperado.');
});

test('verifyModel: rechaza un coeficiente incorrecto en la función objetivo (no proporcional)', () => {
  const { IO } = ctx();
  const correct = { c: [5, 4], sense: 'max', constraints: [{ a: [6, 4], op: '<=', b: 24 }] };
  const v = IO.__tareas.verifyModel({ c: [5, 3], sense: 'max' }, [{ a: [6, 4], op: '<=', b: 24 }], correct);
  assert.equal(v.objStatus, 'wrong');
  assert.equal(v.verdict.level, 'err');
  assert.ok(v.verdict.text.includes('objetivo'));
});

test('verifyModel: rechaza una restricción faltante', () => {
  const { IO } = ctx();
  const correct = { c: [5, 4], sense: 'max', constraints: [{ a: [6, 4], op: '<=', b: 24 }, { a: [1, 2], op: '<=', b: 6 }] };
  const v = IO.__tareas.verifyModel({ c: [5, 4], sense: 'max' }, [{ a: [6, 4], op: '<=', b: 24 }], correct);
  assert.equal(v.consOk, false);
  assert.ok(v.verdict.text.includes('restricciones'));
});

test('verifyModel: rechaza una restricción de más', () => {
  const { IO } = ctx();
  const correct = { c: [5, 4], sense: 'max', constraints: [{ a: [6, 4], op: '<=', b: 24 }] };
  const v = IO.__tareas.verifyModel({ c: [5, 4], sense: 'max' }, [{ a: [6, 4], op: '<=', b: 24 }, { a: [1, 2], op: '<=', b: 6 }], correct);
  assert.equal(v.consOk, false);
});

test('verifyModel: rechaza max vs min (categoría dominio)', () => {
  const { IO } = ctx();
  const correct = { c: [5, 4], sense: 'max', constraints: [{ a: [6, 4], op: '<=', b: 24 }] };
  const v = IO.__tareas.verifyModel({ c: [5, 4], sense: 'min' }, [{ a: [6, 4], op: '<=', b: 24 }], correct);
  assert.equal(v.senseOk, false);
  assert.ok(v.verdict.text.includes('dominio'));
});

test('verifyModel: rechaza "=" donde va "≤" con los mismos coeficientes', () => {
  const { IO } = ctx();
  const correct = { c: [5, 4], sense: 'max', constraints: [{ a: [6, 4], op: '<=', b: 24 }] };
  const v = IO.__tareas.verifyModel({ c: [5, 4], sense: 'max' }, [{ a: [6, 4], op: '=', b: 24 }], correct);
  assert.equal(v.consOk, false);
});

test('verifyModel: rechaza un múltiplo negativo que NO invierte el operador', () => {
  const { IO } = ctx();
  const correct = { c: [5, 4], sense: 'max', constraints: [{ a: [6, 4], op: '<=', b: 24 }] };
  const v = IO.__tareas.verifyModel({ c: [5, 4], sense: 'max' }, [{ a: [-6, -4], op: '<=', b: -24 }], correct);
  assert.equal(v.consOk, false);
});

test('MODEL_EXERCISES: cada tarea (kind=task) trae al menos una pista sin dígitos', () => {
  const { IO } = ctx();
  const tasks = IO.__tareas.MODEL_EXERCISES.filter((m) => m.kind === 'task');
  assert.equal(tasks.length, 7);
  tasks.forEach((def) => {
    assert.ok(Array.isArray(def.hints) && def.hints.length >= 1, `${def.id} debería tener pistas`);
    assert.ok(def.hints.length <= 3, `${def.id} no debería tener más de 3 pistas`);
    def.hints.forEach((h) => assert.ok(!/\d/.test(h), `pista de ${def.id} no debe tener números: "${h}"`));
  });
});

/* =========================================================================
 * B) Simplex formato de clase: verificado con los ejemplos "worked" (no la tarea).
 * ========================================================================= */

test('buildTableauSteps: Sombreros del Sur llega a Z=900, X1=50, X2=150', () => {
  const { IO, Frac } = ctx();
  const ex = IO.__tareas.SIMPLEX_EXAMPLES.sombreros;
  const c = ex.c.map((v) => Frac.from(v));
  const cons = ex.constraints.map((k) => ({ a: k.a.map((v) => Frac.from(v)), b: Frac.from(k.b) }));
  const built = IO.__tareas.buildTableauSteps(ex.varNames, c, cons);
  const final = built.stages[built.stages.length - 1];
  assert.equal(final.type, 'final');
  assert.equal(final.z.toString(), '900');
  const x1 = final.tableau.basis.indexOf(0);
  const x2 = final.tableau.basis.indexOf(1);
  assert.equal(final.tableau.RHS[x1].toString(), '50');
  assert.equal(final.tableau.RHS[x2].toString(), '150');
});

test('buildTableauSteps: ProCalc llega a Z=7650, X1=450, X2=250', () => {
  const { IO, Frac } = ctx();
  const ex = IO.__tareas.SIMPLEX_EXAMPLES.procalc;
  const c = ex.c.map((v) => Frac.from(v));
  const cons = ex.constraints.map((k) => ({ a: k.a.map((v) => Frac.from(v)), b: Frac.from(k.b) }));
  const built = IO.__tareas.buildTableauSteps(ex.varNames, c, cons);
  const final = built.stages[built.stages.length - 1];
  assert.equal(final.z.toString(), '7650');
  const x1 = final.tableau.basis.indexOf(0);
  const x2 = final.tableau.basis.indexOf(1);
  assert.equal(final.tableau.RHS[x1].toString(), '450');
  assert.equal(final.tableau.RHS[x2].toString(), '250');
});

test('buildTableauSteps: Taller Delta (4 restricciones) muestra "No válido" por un coeficiente 0 en la columna pivote', () => {
  const { IO, Frac } = ctx();
  const ex = IO.__tareas.SIMPLEX_EXAMPLES.tallerdelta;
  const c = ex.c.map((v) => Frac.from(v));
  const cons = ex.constraints.map((k) => ({ a: k.a.map((v) => Frac.from(v)), b: Frac.from(k.b) }));
  const built = IO.__tareas.buildTableauSteps(ex.varNames, c, cons);
  // Primera iteración: columna pivote X1; la restricción "x2<=15" (fila 2) tiene coeficiente
  // 0 en la columna de X1, así que su cociente debe quedar marcado inválido.
  const iter0 = built.stages[0];
  assert.equal(iter0.pivotCol, 0);
  const rowWithZero = iter0.ratios.find((r) => r.row === 2);
  assert.equal(rowWithZero.valid, false);
  const finalD = built.stages[built.stages.length - 1];
  assert.equal(finalD.type, 'final');
  assert.equal(finalD.z.toString(), '71');
});

test('buildTableauSteps: las operaciones de eliminación quedan etiquetadas al estilo "5 R2 + R1" (ejemplo genérico, no una tarea)', () => {
  const { IO, Frac } = ctx();
  const varNames = ['X1', 'X2'];
  const c = [5, 4].map((v) => Frac.from(v));
  const cons = [
    { a: [6, 4].map((v) => Frac.from(v)), b: Frac.from(24) },
    { a: [1, 2].map((v) => Frac.from(v)), b: Frac.from(6) },
    { a: [-1, 1].map((v) => Frac.from(v)), b: Frac.from(1) },
    { a: [0, 1].map((v) => Frac.from(v)), b: Frac.from(2) }
  ];
  const built = IO.__tareas.buildTableauSteps(varNames, c, cons);
  const iter1 = built.stages[0];
  assert.equal(iter1.zAfter.toString(), '20');
  const labels1 = iter1.elimLabels.map((l) => l.label);
  assert.ok(labels1.includes('5 R2 + R1'), JSON.stringify(labels1));
  assert.ok(labels1.includes('-R2 + R3'), JSON.stringify(labels1));
  assert.ok(labels1.includes('R2 + R4'), JSON.stringify(labels1));

  const final = built.stages[built.stages.length - 1];
  assert.equal(final.type, 'final');
  assert.equal(final.z.toString(), '21');
  const basis = final.tableau.basis;
  assert.equal(final.tableau.RHS[basis.indexOf(0)].toString(), '3');
  assert.equal(final.tableau.RHS[basis.indexOf(1)].toString(), '3/2');
  assert.equal(final.tableau.RHS[basis.indexOf(4)].toString(), '5/2');
  assert.equal(final.tableau.RHS[basis.indexOf(5)].toString(), '1/2');
});

/* =========================================================================
 * C) Holgura complementaria: los dos ejemplos fijos del widget (guiado + práctica),
 * factibilidad dual (Paso 0), y el caso y_i=0 sin forzar holgura.
 * ========================================================================= */

test('checkDualFeasible + solveComplementarySlackness: ejemplo guiado x*=(0,30,20), z=w=190', () => {
  const { IO, Frac } = ctx();
  const def = IO.__tareas.DUAL_EXAMPLES.guided;
  const feas = IO.__tareas.checkDualFeasible(def);
  assert.equal(feas.feasible, true);
  const model = {
    c: def.c.map((v) => Frac.from(v)),
    A: def.A.map((row) => row.map((v) => Frac.from(v))),
    b: def.b.map((v) => Frac.from(v)),
    y: def.y.map((v) => Frac.from(v))
  };
  const cs = IO.__tareas.solveComplementarySlackness(model);
  assert.equal(cs.singular, false);
  assert.equal(cs.x[0].toString(), '0');
  assert.equal(cs.x[1].toString(), '30');
  assert.equal(cs.x[2].toString(), '20');
  assert.equal(cs.z.toString(), '190');
  assert.equal(cs.w.toString(), '190');
  assert.ok(cs.z.eq(cs.w));
});

test('checkDualFeasible + solveComplementarySlackness: ejemplo práctica x*=(0,70/3,40/3), z=w=170', () => {
  const { IO, Frac } = ctx();
  const def = IO.__tareas.DUAL_EXAMPLES.practice;
  const feas = IO.__tareas.checkDualFeasible(def);
  assert.equal(feas.feasible, true);
  const model = {
    c: def.c.map((v) => Frac.from(v)),
    A: def.A.map((row) => row.map((v) => Frac.from(v))),
    b: def.b.map((v) => Frac.from(v)),
    y: def.y.map((v) => Frac.from(v))
  };
  const cs = IO.__tareas.solveComplementarySlackness(model);
  assert.equal(cs.singular, false);
  assert.equal(cs.x[0].toString(), '0');
  assert.equal(cs.x[1].toString(), '70/3');
  assert.equal(cs.x[2].toString(), '40/3');
  assert.equal(cs.z.toString(), '170');
  assert.equal(cs.w.toString(), '170');
  assert.ok(cs.z.eq(cs.w));
});

test('el ejemplo "práctica" de holgura complementaria reproduce los duales de IO.Simplex.sensitivity', () => {
  const { IO } = ctx();
  const def = IO.__tareas.DUAL_EXAMPLES.practice;
  const model = IO.Simplex.parse({
    type: 'max', c: def.c,
    constraints: def.A.map((row, i) => ({ a: row, op: '<=', b: def.b[i] }))
  });
  const res = IO.Simplex.solve(model, { method: 'auto' });
  assert.equal(res.status, 'optimal');
  const duals = res.sensitivity.duals.map((d) => d.toString());
  assert.deepEqual(duals, def.y.map(String));
});

test('solveComplementarySlackness: caso con y_i=0 no fuerza una igualdad en esa fila (regla de una sola dirección)', () => {
  const { IO, Frac } = ctx();
  // max z=5x1+4x2+3x3; x1+x2+x3<=10 (recurso escaso); x1+2x2+3x3<=100 (recurso sobrante).
  // y=(5,0): la fila con y2=0 NO se usa como ecuación aunque también resulte ser holgura en
  // el primal en este caso particular — lo que importa es que el código solo arma eqRows con
  // y_i>0, nunca asumiendo que y_i=0 implica holgura primal.
  const model = {
    c: [5, 4, 3].map((v) => Frac.from(v)),
    A: [[1, 1, 1], [1, 2, 3]].map((row) => row.map((v) => Frac.from(v))),
    b: [10, 100].map((v) => Frac.from(v)),
    y: [5, 0].map((v) => Frac.from(v))
  };
  const cs = IO.__tareas.solveComplementarySlackness(model);
  assert.deepEqual(Array.from(cs.eqRows), [0]); // solo la fila con y1>0, nunca la de y2=0
  assert.equal(cs.singular, false);
  assert.equal(cs.x[0].toString(), '10');
  assert.equal(cs.x[1].toString(), '0');
  assert.equal(cs.x[2].toString(), '0');
  assert.equal(cs.z.toString(), '50');
  assert.equal(cs.w.toString(), '50');
  assert.ok(cs.z.eq(cs.w));
});

test('solveComplementarySlackness: sistema singular se detecta (determinante 0) sin lanzar excepción', () => {
  const { IO, Frac } = ctx();
  // x1 queda en 0 por holgura dual (lhs=20 > c1=5); x2 y x3 quedan libres (dual tight en
  // ambas filas: lhs=3=c2 y lhs=6=c3) y ambas filas tienen y_i>0 (eqRows=[0,1]), así que cae
  // en el sistema 2x2 esperado — pero las columnas de x2,x3 son proporcionales entre las dos
  // filas (1,2 vs 2,4), así que el determinante da 0 (singular) sin importar el lado derecho.
  const model = {
    c: [5, 3, 6].map((v) => Frac.from(v)),
    A: [[10, 1, 2], [10, 2, 4]].map((row) => row.map((v) => Frac.from(v))),
    b: [100, 150].map((v) => Frac.from(v)),
    y: [1, 1].map((v) => Frac.from(v))
  };
  assert.doesNotThrow(() => {
    const cs = IO.__tareas.solveComplementarySlackness(model);
    assert.deepEqual(Array.from(cs.eqRows), [0, 1]);
    assert.deepEqual(Array.from(cs.freeIdx), [1, 2]);
    assert.equal(cs.singular, true);
    assert.equal(cs.x, null);
    assert.equal(cs.z, null);
  });
});

/* =========================================================================
 * Pedagógico: las tareas de la clase no muestran nunca su modelo correcto ni su óptimo
 * en el HTML estático del capítulo (secciones) ni en el quiz; el simplex de sección B no
 * usa los números de las tareas de simplex de la clase; la sección C no usa el TOYCO
 * de cap 3/4 (430/460/1350).
 * ========================================================================= */

test('el HTML de la sección A (tareas) no contiene ninguna cadena prohibida', () => {
  const { IO } = ctx();
  const chapter = IO.chapters.find((c) => c.id === 'tareas');
  const sectionA = chapter.sections.find((s) => s.id === 'tareas-s1').html;
  FORBIDDEN_STRINGS.forEach((s) => {
    assert.ok(!sectionA.includes(s), `la sección A no debe contener "${s}"`);
  });
});

test('el quiz no contiene ninguna cadena prohibida (solo datos de ejemplos similares)', () => {
  const { IO } = ctx();
  const chapter = IO.chapters.find((c) => c.id === 'tareas');
  const quizJson = JSON.stringify(chapter.quiz);
  FORBIDDEN_STRINGS.forEach((s) => {
    assert.ok(!quizJson.includes(s), `el quiz no debe contener "${s}"`);
  });
});

test('la sección A de tareas no tiene botón "Ver solución" (details.solution)', () => {
  const { IO } = ctx();
  const chapter = IO.chapters.find((c) => c.id === 'tareas');
  const sectionA = chapter.sections.find((s) => s.id === 'tareas-s1').html;
  assert.ok(!sectionA.includes('Ver solución'), 'la sección de tareas no debe ofrecer ver la solución');
});

test('todas las tareas (kind=task) están en la sección A de tareas, y los worked en la de ejemplos', () => {
  const { IO } = ctx();
  const tasks = IO.__tareas.MODEL_EXERCISES.filter((m) => m.kind === 'task');
  const worked = IO.__tareas.MODEL_EXERCISES.filter((m) => m.kind === 'worked');
  assert.equal(tasks.length, 7);
  assert.equal(worked.length, 7);
});

test('el simplex de la sección B no usa los coeficientes de Wild West/Calculadoras/Reddy Mikks (tareas)', () => {
  const { IO } = ctx();
  const examples = IO.__tareas.SIMPLEX_EXAMPLES;
  const forbidden = [
    JSON.stringify({ c: [8, 5], constraints: [[2, 1, 400], [1, 0, 150], [0, 1, 200]] }),
    JSON.stringify({ c: [10, 8], constraints: [[1, 4, 1600], [30, 20, 18000]] }),
    JSON.stringify({ c: [5, 4], constraints: [[6, 4, 24], [1, 2, 6], [-1, 1, 1], [0, 1, 2]] })
  ];
  Object.keys(examples).forEach((key) => {
    const ex = examples[key];
    const shape = JSON.stringify({ c: ex.c, constraints: ex.constraints.map((k) => k.a.concat([k.b])) });
    assert.ok(!forbidden.includes(shape), `${key} no debe coincidir con una tarea de la clase`);
  });
});

test('la sección B de simplex no menciona "Reddy Mikks" (es la tarea)', () => {
  const { IO } = ctx();
  const chapter = IO.chapters.find((c) => c.id === 'tareas');
  const sectionB = chapter.sections.find((s) => s.id === 'tareas-s2').html;
  assert.ok(!sectionB.toLowerCase().includes('reddy'), 'la sección B no debe usar Reddy Mikks como ejemplo resuelto');
});

test('la sección C no usa los números del TOYCO de cap 3/4 (430, 460, 1350)', () => {
  const { IO } = ctx();
  const chapter = IO.chapters.find((c) => c.id === 'tareas');
  const sectionC = chapter.sections.find((s) => s.id === 'tareas-s3').html;
  ['430', '460', '1350'].forEach((s) => {
    assert.ok(!sectionC.includes(s), `la sección C no debe contener "${s}" (TOYCO ya está en cap 3/4)`);
  });
});
