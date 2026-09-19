'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadScripts } = require('./helpers/load');

const ctx = loadScripts(['js/lib/frac.js']);
const Frac = ctx.Frac;

test('integers', () => {
  assert.strictEqual(Frac.from(3).toString(), '3');
  assert.strictEqual(Frac.from(-3).toString(), '-3');
  assert.strictEqual(Frac.from(0).toString(), '0');
});

test('decimals', () => {
  assert.strictEqual(Frac.from(0.75).toString(), '3/4');
  assert.strictEqual(Frac.from(0.1).toString(), '1/10');
  assert.strictEqual(Frac.from(-0.5).toString(), '-1/2');
});

test('negatives via arithmetic', () => {
  assert.strictEqual(Frac.of(1, 2).neg().toString(), '-1/2');
  assert.strictEqual(Frac.of(-3, 4).toString(), '-3/4');
  assert.strictEqual(Frac.of(3, -4).toString(), '-3/4'); // negative denominator normalizes to numerator
});

test('fraction strings', () => {
  assert.strictEqual(Frac.from('3/4').toString(), '3/4');
  assert.strictEqual(Frac.from('-3/4').toString(), '-3/4');
  assert.strictEqual(Frac.from('6/8').toString(), '3/4'); // reduced
});

test('scientific notation: numbers', () => {
  // Regression: Frac.from(1e-7) used to silently become 0.
  assert.strictEqual(Frac.from(1e-7).toString(), '1/10000000');
  assert.strictEqual(Frac.from(1e-7).toNumber(), 1e-7);
  assert.strictEqual(Frac.from(2.5e-4).toString(), '1/4000');
  assert.strictEqual(Frac.from(-3e2).toString(), '-300');
});

test('scientific notation: strings', () => {
  assert.strictEqual(Frac.from('1e-7').toString(), '1/10000000');
  assert.strictEqual(Frac.from('2.5e-4').toString(), '1/4000');
  assert.strictEqual(Frac.from('-3e2').toString(), '-300');
});

test('division by zero throws', () => {
  assert.throws(() => Frac.from('1/0'), /division by zero/);
  assert.throws(() => Frac.of(1, 0), /division by zero/);
  assert.throws(() => Frac.from(1).div(Frac.ZERO), /division by zero/);
});

test('invalid inputs throw a clear error instead of becoming 0', () => {
  assert.throws(() => Frac.from('abc'), /Frac\.from/);
  assert.throws(() => Frac.from('1/2/3'), /fracción mal formada/);
  assert.throws(() => Frac.from(NaN), /NaN/);
  assert.throws(() => Frac.from(Infinity), /no finito/);
  assert.throws(() => Frac.from({}), /Frac\.from/);
});

test('empty string and undefined keep returning ZERO (relied on by js/cap4.js live inputs)', () => {
  assert.strictEqual(Frac.from('').toString(), '0');
  assert.strictEqual(Frac.from('   ').toString(), '0');
  assert.strictEqual(Frac.from(undefined).toString(), '0');
});

test('Frac instances pass through unchanged', () => {
  const f = Frac.of(2, 3);
  assert.strictEqual(Frac.from(f), f);
});

test('arithmetic still correct after the Frac.from fix', () => {
  assert.strictEqual(Frac.of(1, 2).add(Frac.of(1, 3)).toString(), '5/6');
  assert.strictEqual(Frac.of(1, 2).sub(Frac.of(1, 3)).toString(), '1/6');
  assert.strictEqual(Frac.of(2, 3).mul(Frac.of(3, 4)).toString(), '1/2');
  assert.strictEqual(Frac.of(2, 3).div(Frac.of(4, 5)).toString(), '5/6');
  assert.strictEqual(Frac.of(1, 2).cmp(Frac.of(1, 3)), 1);
  assert.ok(Frac.of(3, 4).gt(Frac.of(1, 2)));
  assert.ok(Frac.of(1, 4).lt(Frac.of(1, 2)));
});

test('toHTML renders a fraction with a decimal tooltip', () => {
  const html = Frac.of(3, 4).toHTML();
  assert.match(html, /3\/4/);
  assert.match(html, /title="0\.7500"/);
  assert.strictEqual(Frac.of(4, 1).toHTML(), '4');
});
