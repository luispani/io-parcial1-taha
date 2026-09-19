'use strict';
const test = require('node:test');
// Plain (non-strict) assert: state objects come out of a vm.createContext
// realm, so cross-realm structural equality needs assert.deepEqual, not
// assert/strict's deepStrictEqual (which also checks prototype identity).
const assert = require('node:assert');
const { loadScripts } = require('./helpers/load');

function makeQuestions() {
  return [
    { q: '¿2+2?', options: ['3', '4', '5'], answer: 1, explain: 'Suma básica.', chapterId: 'cap1', chapterNum: 1, chapterTitle: 'Cap 1' },
    { q: 'z óptimo de Reddy Mikks', type: 'number', answer: 21, tol: 0.01, explain: 'Ver 2.1.', chapterId: 'cap2', chapterNum: 2, chapterTitle: 'Cap 2' },
    { q: '¿Método M sirve para...?', options: ['a', 'b'], answer: 0, explain: 'Fase artificial.', chapterId: 'cap3', chapterNum: 3, chapterTitle: 'Cap 3' }
  ];
}

function ctx() {
  return loadScripts(['js/simulacro-state.js']);
}

test('create builds a fresh state with the given questions and endTime', () => {
  const c = ctx();
  const now = 1000;
  const state = c.IO.SimulacroState.create(makeQuestions(), now, 5000);
  assert.equal(state.questions.length, 3);
  assert.deepEqual(state.answers, {});
  assert.equal(state.endTime, 6000);
  assert.equal(state.submitted, false);
  assert.equal(state.result, null);
});

test('create does not alias the questions array passed in (immutability)', () => {
  const c = ctx();
  const qs = makeQuestions();
  const state = c.IO.SimulacroState.create(qs, 0, 1000);
  qs[0].q = 'mutated';
  assert.notEqual(state.questions[0].q, 'mutated');
});

test('answer returns a new state and does not mutate the original', () => {
  const c = ctx();
  const state0 = c.IO.SimulacroState.create(makeQuestions(), 0, 1000);
  const state1 = c.IO.SimulacroState.answer(state0, 0, '1');
  assert.deepEqual(state0.answers, {});
  assert.equal(state1.answers['0'], '1');
  assert.notEqual(state0, state1);
});

test('answer on an already-submitted state is a no-op', () => {
  const c = ctx();
  let state = c.IO.SimulacroState.create(makeQuestions(), 0, 1000);
  state = c.IO.SimulacroState.submit(state, 500);
  const after = c.IO.SimulacroState.answer(state, 0, '1');
  assert.equal(after, state);
});

test('remainingMs is computed from endTime, not from ticks', () => {
  const c = ctx();
  const state = c.IO.SimulacroState.create(makeQuestions(), 0, 10000);
  assert.equal(c.IO.SimulacroState.remainingMs(state, 3000), 7000);
  assert.equal(c.IO.SimulacroState.remainingMs(state, 10000), 0);
  assert.equal(c.IO.SimulacroState.remainingMs(state, 999999), 0, 'never goes negative');
});

test('isExpired reflects endTime vs now', () => {
  const c = ctx();
  const state = c.IO.SimulacroState.create(makeQuestions(), 0, 1000);
  assert.equal(c.IO.SimulacroState.isExpired(state, 500), false);
  assert.equal(c.IO.SimulacroState.isExpired(state, 1000), true);
  assert.equal(c.IO.SimulacroState.isExpired(state, 2000), true);
});

test('submit grades multiple choice and numeric-with-tolerance answers, and scores per chapter', () => {
  const c = ctx();
  let state = c.IO.SimulacroState.create(makeQuestions(), 0, 60000);
  state = c.IO.SimulacroState.answer(state, 0, '1');       // correct (mc)
  state = c.IO.SimulacroState.answer(state, 1, '21.005');  // correct (within tol)
  state = c.IO.SimulacroState.answer(state, 2, '1');       // wrong (mc)

  const graded = c.IO.SimulacroState.submit(state, 1000);
  assert.equal(graded.submitted, true);
  assert.equal(graded.result.score, 2);
  assert.equal(graded.result.total, 3);
  assert.equal(graded.result.nota, Math.round((2 / 3) * 100));
  assert.equal(graded.result.byChapter[1].ok, 1);
  assert.equal(graded.result.byChapter[2].ok, 1);
  assert.equal(graded.result.byChapter[3].ok, 0);
  assert.deepEqual(graded.result.perQuestion.map((p) => p.ok), [true, true, false]);
});

test('submit marks chapters under 70% as "repasar"', () => {
  const c = ctx();
  let state = c.IO.SimulacroState.create(makeQuestions(), 0, 60000);
  // Leave everything unanswered -> 0% in every chapter.
  const graded = c.IO.SimulacroState.submit(state, 0);
  assert.equal(graded.result.repasar.length, 3);
  assert.equal(graded.result.score, 0);
});

test('submitting twice does not recompute the result', () => {
  const c = ctx();
  let state = c.IO.SimulacroState.create(makeQuestions(), 0, 60000);
  state = c.IO.SimulacroState.answer(state, 0, '1');
  const first = c.IO.SimulacroState.submit(state, 100);
  const second = c.IO.SimulacroState.submit(first, 999999);
  assert.equal(second, first, 'second submit call is a no-op returning the same object');
});

test('serialize/deserialize round-trips a state exactly, including answers already given', () => {
  const c = ctx();
  let state = c.IO.SimulacroState.create(makeQuestions(), 0, 60000);
  state = c.IO.SimulacroState.answer(state, 0, '1');
  state = c.IO.SimulacroState.answer(state, 1, '21');

  const serialized = c.IO.SimulacroState.serialize(state);
  const restored = c.IO.SimulacroState.deserialize(serialized);

  assert.deepEqual(restored.answers, state.answers);
  assert.equal(restored.endTime, state.endTime);
  assert.equal(restored.submitted, state.submitted);
  assert.equal(restored.questions.length, state.questions.length);
  assert.equal(restored.questions[0].q, state.questions[0].q);
  assert.equal(restored.questions[0].chapterId, 'cap1');
});

test('serialize/deserialize round-trips a submitted state with its result', () => {
  const c = ctx();
  let state = c.IO.SimulacroState.create(makeQuestions(), 0, 60000);
  state = c.IO.SimulacroState.answer(state, 0, '1');
  state = c.IO.SimulacroState.submit(state, 1000);

  const restored = c.IO.SimulacroState.deserialize(c.IO.SimulacroState.serialize(state));
  assert.equal(restored.submitted, true);
  assert.equal(restored.result.score, state.result.score);
  assert.equal(restored.result.total, state.result.total);
});

test('deserialize returns null for missing, malformed, or invalid input', () => {
  const c = ctx();
  assert.equal(c.IO.SimulacroState.deserialize(null), null);
  assert.equal(c.IO.SimulacroState.deserialize(''), null);
  assert.equal(c.IO.SimulacroState.deserialize('not json'), null);
  assert.equal(c.IO.SimulacroState.deserialize('{}'), null, 'missing questions/endTime');
  assert.equal(c.IO.SimulacroState.deserialize('{"questions":"nope","endTime":1}'), null);
  assert.equal(c.IO.SimulacroState.deserialize(JSON.stringify({ questions: [], endTime: 'nan' })), null);
});

test('answers already given are never lost across an answer -> serialize -> deserialize -> answer chain', () => {
  const c = ctx();
  let state = c.IO.SimulacroState.create(makeQuestions(), 0, 60000);
  state = c.IO.SimulacroState.answer(state, 0, '1');
  state = c.IO.SimulacroState.deserialize(c.IO.SimulacroState.serialize(state));
  state = c.IO.SimulacroState.answer(state, 2, '0');

  assert.equal(state.answers['0'], '1', 'first answer survives the round trip');
  assert.equal(state.answers['2'], '0', 'second answer is applied on top');

  const graded = c.IO.SimulacroState.submit(state, 100);
  assert.equal(graded.result.score, 2);
});

test('checkAnswer treats empty/missing answers as incorrect for both question types', () => {
  const c = ctx();
  const { checkAnswer } = c.IO.SimulacroState;
  assert.equal(checkAnswer({ options: ['a', 'b'], answer: 0 }, null), false);
  assert.equal(checkAnswer({ options: ['a', 'b'], answer: 0 }, ''), false);
  assert.equal(checkAnswer({ type: 'number', answer: 5 }, ''), false);
  assert.equal(checkAnswer({ type: 'number', answer: 5 }, 'abc'), false);
  assert.equal(checkAnswer({ type: 'number', answer: 5, tol: 0.1 }, '5.05'), true);
});
