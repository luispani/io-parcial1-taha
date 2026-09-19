/* Pure, testable state management for the "simulacro" (mock exam). Owner: A.
 * Global: IO.SimulacroState = { create, answer, remainingMs, isExpired, submit,
 *   checkAnswer, serialize, deserialize, STORAGE_KEY }
 *
 * State shape: { questions, answers, endTime, submitted, result }
 * - questions: array of quiz items (as produced by IO.Quiz.randomFrom), each may
 *   carry chapterId/chapterNum/chapterTitle so the attempt can be restored later
 *   without depending on chapter modules being present.
 * - answers: map of questionIndex(string) -> given value (string for both types).
 * - endTime: epoch ms when the attempt must auto-submit.
 * - submitted: boolean.
 * - result: null until submitted, then { score, total, nota, byChapter, repasar, perQuestion }.
 *
 * All functions are pure: they never touch the DOM, localStorage or timers, and
 * they return a new state object instead of mutating the one passed in.
 */
(function (global) {
  'use strict';
  var IO = global.IO = global.IO || { chapters: [] };

  var STORAGE_KEY = 'io_simulacro';

  function cloneAnswers(answers) {
    var out = {};
    for (var k in answers) if (Object.prototype.hasOwnProperty.call(answers, k)) out[k] = answers[k];
    return out;
  }

  function cloneQuestions(questions) {
    return (questions || []).map(function (q) {
      var copy = {};
      for (var k in q) if (Object.prototype.hasOwnProperty.call(q, k)) copy[k] = q[k];
      return copy;
    });
  }

  /* create(questions, now, durationMs) -> new state */
  function create(questions, now, durationMs) {
    return {
      questions: cloneQuestions(questions),
      answers: {},
      endTime: now + durationMs,
      submitted: false,
      result: null
    };
  }

  /* answer(state, idx, value) -> new state with answers[idx] = value */
  function answer(state, idx, value) {
    if (!state || state.submitted) return state;
    var next = {
      questions: state.questions,
      answers: cloneAnswers(state.answers),
      endTime: state.endTime,
      submitted: state.submitted,
      result: state.result
    };
    next.answers[String(idx)] = value;
    return next;
  }

  /* remainingMs(state, now) -> milliseconds left, computed from endTime (never from ticks) */
  function remainingMs(state, now) {
    if (!state) return 0;
    return Math.max(0, state.endTime - now);
  }

  function isExpired(state, now) {
    return remainingMs(state, now) <= 0;
  }

  /* Same correction logic as js/quiz.js: multiple choice by index, numeric with tolerance. */
  function checkAnswer(item, given) {
    if (given === null || given === undefined || given === '') return false;
    if (item.type === 'number') {
      var v = parseFloat(given);
      if (isNaN(v)) return false;
      var tol = item.tol === undefined ? 0.01 : item.tol;
      return Math.abs(v - item.answer) <= tol;
    }
    return parseInt(given, 10) === item.answer;
  }

  /* submit(state, now) -> new state with submitted:true and a computed result.
   * Submitting an already-submitted state is a no-op (returns the same state). */
  function submit(state, now) {
    if (!state) return state;
    if (state.submitted) return state;

    var score = 0;
    var byChapter = {};
    var perQuestion = [];

    state.questions.forEach(function (q, idx) {
      var given = state.answers[String(idx)];
      var ok = checkAnswer(q, given);
      if (ok) score++;
      perQuestion.push({ idx: idx, ok: ok, given: given === undefined ? null : given });

      var num = q.chapterNum || 0;
      if (!byChapter[num]) {
        byChapter[num] = { total: 0, ok: 0, title: q.chapterTitle || ('Cap ' + num) };
      }
      byChapter[num].total++;
      if (ok) byChapter[num].ok++;
    });

    var total = state.questions.length;
    var nota = total ? Math.round((score / total) * 100) : 0;

    var repasar = [];
    Object.keys(byChapter).sort(function (a, b) { return Number(a) - Number(b); }).forEach(function (num) {
      var b = byChapter[num];
      var pct = b.total ? Math.round((b.ok / b.total) * 100) : 0;
      if (pct < 70) repasar.push({ num: Number(num), title: b.title, pct: pct });
    });

    var result = {
      score: score,
      total: total,
      nota: nota,
      byChapter: byChapter,
      repasar: repasar,
      perQuestion: perQuestion
    };

    return {
      questions: state.questions,
      answers: cloneAnswers(state.answers),
      endTime: state.endTime,
      submitted: true,
      result: result
    };
  }

  function serialize(state) {
    return JSON.stringify(state);
  }

  /* deserialize(str) -> state, or null if str is missing/invalid/malformed. */
  function deserialize(str) {
    if (!str) return null;
    var parsed;
    try {
      parsed = JSON.parse(str);
    } catch (e) {
      return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.questions)) return null;
    if (typeof parsed.endTime !== 'number') return null;
    return {
      questions: cloneQuestions(parsed.questions),
      answers: (parsed.answers && typeof parsed.answers === 'object') ? cloneAnswers(parsed.answers) : {},
      endTime: parsed.endTime,
      submitted: !!parsed.submitted,
      result: parsed.result || null
    };
  }

  IO.SimulacroState = {
    STORAGE_KEY: STORAGE_KEY,
    create: create,
    answer: answer,
    remainingMs: remainingMs,
    isExpired: isExpired,
    checkAnswer: checkAnswer,
    submit: submit,
    serialize: serialize,
    deserialize: deserialize
  };
})(typeof window !== 'undefined' ? window : globalThis);
