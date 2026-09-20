'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load');

const ctx = loadScripts(['js/lib/viz3d.js']);
const V = ctx.IO.Viz3D;

test('Viz3D exposes the exam-related scenes', () => {
  ['io-pipeline', 'lp-prism', 'lp-2d', 'simplex-walk', 'transport-3d', 'maxflow-pipes', 'ga-landscape', 'binary-cube', 'dual-balance']
    .forEach((name) => {
      assert.ok(V.scenes.indexOf(name) !== -1, 'missing scene ' + name);
      assert.ok(V.legends[name], 'missing legend for ' + name);
    });
});

test('Reddy Mikks vertices: z = 5x1+4x2 and optimum is 21 at (3, 1.5)', () => {
  const hit = V.reddyPoly.some((p) => p[0] === 3 && p[1] === 1.5);
  assert.equal(hit, true);
  let maxZ = -1, maxPt = null;
  V.reddyVerts.forEach((v) => {
    assert.equal(v.z, V.reddyZ(v.x, v.y), 'z mismatch at (' + v.x + ',' + v.y + ')');
    if (v.z > maxZ) { maxZ = v.z; maxPt = v; }
  });
  assert.equal(maxZ, 21);
  assert.equal(maxPt.x, 3);
  assert.equal(maxPt.y, 1.5);
});

test('simplex path is (0,0)→(4,0)→(3,1.5) with z 0, 20, 21', () => {
  assert.equal(V.simplexPath.length, 3);
  assert.equal(V.simplexPath[0].z, 0);
  assert.equal(V.simplexPath[1].x, 4);
  assert.equal(V.simplexPath[1].z, 20);
  assert.equal(V.simplexPath[2].x, 3);
  assert.equal(V.simplexPath[2].y, 1.5);
  assert.equal(V.simplexPath[2].z, 21);
});

test('transport exam cost is 26', () => {
  assert.equal(V.transportCost(), 26);
});

test('max-flow exam steps add to 15', () => {
  const last = V.maxflowSteps[V.maxflowSteps.length - 1];
  assert.equal(last.acc, 15);
  const sum = V.maxflowSteps.reduce((s, st) => s + st.bot, 0);
  assert.equal(sum, 15);
});

test('GA fitness at x=0 is 1.2', () => {
  assert.ok(Math.abs(V.gaF(0) - 1.2) < 1e-9);
});

test('pipeline is Taha 5 phases, left to right, static', () => {
  assert.equal(V.pipelineSteps.length, 5);
  assert.equal(V.pipelineSteps[0].t, 'Definir');
  assert.equal(V.pipelineSteps[4].t, 'Implantar');
  assert.ok(V.staticScenes['io-pipeline']);
  assert.ok(V.flatScenes['io-pipeline']);
  assert.ok(/5 fases/.test(V.legends['io-pipeline'].what));
  assert.ok(/izquierda a derecha/.test(V.legends['io-pipeline'].how));
});

test('transport, maxflow and dual never orbit; cube is frozen', () => {
  assert.ok(V.flatScenes['transport-3d']);
  assert.ok(V.staticScenes['transport-3d']);
  assert.ok(V.flatScenes['maxflow-pipes']);
  assert.ok(V.animatedScenes['maxflow-pipes']);
  assert.ok(V.staticScenes['dual-balance']);
  assert.ok(V.staticScenes['binary-cube']);
  assert.equal(!!V.animatedScenes['io-pipeline'], false);
  assert.equal(!!V.animatedScenes['transport-3d'], false);
  assert.equal(!!V.animatedScenes['binary-cube'], false);
});

test('project is a finite perspective map', () => {
  const cam = { yaw: 0.7, pitch: 0.4, dist: 8, scale: 70, cx: 320, cy: 180 };
  const p = V.project(1, 0.5, 0, cam);
  assert.equal(Number.isFinite(p.x), true);
  assert.equal(Number.isFinite(p.y), true);
  assert.equal(Number.isFinite(p.z), true);
  const q = V.project(0, 0, 0, cam);
  assert.equal(Number.isFinite(q.x), true);
});
