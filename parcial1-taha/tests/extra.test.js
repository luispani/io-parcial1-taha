'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load');

const ctx = loadScripts([
  'js/lib/viz3d.js',
  'js/lib/teach.js',
  'js/peb.js',
  'js/redes.js',
  'js/evolutivos.js'
]);

test('Peterson & Johnson knapsack: Z = 3.4 on projects 1, 3, 4', () => {
  const r = ctx.IO.__peb.knapsackBest(ctx.IO.__peb.PROJECTS, 20);
  assert.ok(Math.abs(r.z - 3.4) < 1e-9, 'z=' + r.z);
  assert.equal(Array.from(r.x).join(','), '1,0,1,1,0');
  assert.equal(r.cap, 20);
});

test('max flow of the exam network A→F is 15', () => {
  const r = ctx.IO.__redes.maxFlow('A', 'F');
  assert.equal(r.value, 15);
  assert.ok(r.steps.length >= 3);
  const acc = r.steps[r.steps.length - 1].acc;
  assert.equal(acc, 15);
});

test('GA mini-run does not make the best fitness worse', () => {
  const r = ctx.IO.__evolutivos.runGA({ pop: 12, gens: 8, seed: 3 });
  assert.ok(r.hist.length === 8);
  assert.ok(r.bestF >= r.hist[0].bestF - 1e-9);
  assert.ok(r.bestF > 0);
});

test('extra chapters register with quizzes of at least 10 items', () => {
  const ids = { peb: false, redes: false, evolutivos: false };
  ctx.IO.chapters.forEach((ch) => {
    if (ids[ch.id] === false) {
      ids[ch.id] = true;
      assert.ok(ch.quiz.length >= 10, ch.id + ' quiz too small');
      assert.ok(ch.sections.length >= 3, ch.id + ' needs 3 sections');
    }
  });
  Object.keys(ids).forEach((id) => assert.equal(ids[id], true, 'missing chapter ' + id));
});
