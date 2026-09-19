/* Quiz engine. Global: IO.Quiz = { render, grade, randomFrom } */
(function (global) {
  'use strict';
  var IO = global.IO = global.IO || { chapters: [] };

  function storeGet(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function storeSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Render a quiz block into container. questions: [{q, options?, answer, type?, tol?, explain, chapterId?}] */
  function render(container, questions, key) {
    if (!container) return;
    var qs = questions || [];
    var last = storeGet(key);

    var html = '<div class="quiz-block">';
    qs.forEach(function (item, idx) {
      html += '<div class="quiz-q" data-idx="' + idx + '">';
      html += '<p class="quiz-q-text"><strong>' + (idx + 1) + '.</strong> ' + esc(item.q) + '</p>';
      if (item.type === 'number') {
        html += '<div class="input-grid"><input type="number" step="any" class="quiz-input" data-idx="' + idx + '" placeholder="Respuesta numérica" /></div>';
      } else {
        html += '<div class="quiz-options">';
        (item.options || []).forEach(function (opt, oi) {
          html += '<label class="quiz-option row">' +
            '<input type="radio" name="quiz-' + esc(key) + '-' + idx + '" value="' + oi + '" data-idx="' + idx + '" /> ' +
            '<span>' + esc(opt) + '</span></label>';
        });
        html += '</div>';
      }
      html += '<div class="quiz-feedback" data-idx="' + idx + '" hidden></div>';
      html += '</div>';
    });
    html += '<div class="row quiz-actions">';
    html += '<button type="button" class="btn btn-primary quiz-correct-btn">Corregir</button>';
    html += '<span class="quiz-score badge"' + (last ? '' : ' hidden') + '>' +
      (last ? 'Último puntaje: ' + last.score + '/' + last.total : '') + '</span>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;

    var btn = container.querySelector('.quiz-correct-btn');
    btn.addEventListener('click', function () {
      var result = grade(container, qs);
      storeSet(key, { score: result.score, total: result.total, ts: Date.now() });
      var scoreEl = container.querySelector('.quiz-score');
      scoreEl.hidden = false;
      scoreEl.textContent = 'Puntaje: ' + result.score + '/' + result.total;
      scoreEl.className = 'badge ' + (result.score / result.total >= 0.7 ? 'badge-ok' : result.score / result.total >= 0.4 ? 'badge-warn' : 'badge-err');
    });
  }

  function checkAnswer(item, given) {
    if (item.type === 'number') {
      if (given === null || given === undefined || given === '') return false;
      var v = parseFloat(given);
      if (isNaN(v)) return false;
      var tol = item.tol === undefined ? 0.01 : item.tol;
      return Math.abs(v - item.answer) <= tol;
    }
    return parseInt(given, 10) === item.answer;
  }

  /* Grade the quiz currently rendered in container against questions; annotate DOM. */
  function grade(container, questions) {
    var score = 0;
    questions.forEach(function (item, idx) {
      var given;
      var qDiv = container.querySelector('.quiz-q[data-idx="' + idx + '"]');
      var fb = container.querySelector('.quiz-feedback[data-idx="' + idx + '"]');
      var ok;
      if (item.type === 'number') {
        var input = container.querySelector('.quiz-input[data-idx="' + idx + '"]');
        given = input ? input.value : '';
        ok = checkAnswer(item, given);
      } else {
        var checked = container.querySelector('input[data-idx="' + idx + '"]:checked');
        given = checked ? checked.value : null;
        ok = checkAnswer(item, given);
      }
      if (ok) score++;
      if (qDiv) qDiv.classList.toggle('quiz-wrong', !ok);
      if (qDiv) qDiv.classList.toggle('quiz-ok', ok);
      if (fb) {
        fb.hidden = false;
        var correctText = item.type === 'number' ? String(item.answer) : (item.options ? item.options[item.answer] : '');
        fb.innerHTML = '<span class="badge ' + (ok ? 'badge-ok' : 'badge-err') + '">' + (ok ? 'Correcto' : 'Incorrecto') + '</span> ' +
          (ok ? '' : '<span class="muted">Respuesta correcta: ' + esc(correctText) + '.</span> ') +
          '<span class="muted">' + esc(item.explain || '') + '</span>';
      }
    });
    return { score: score, total: questions.length };
  }

  /* Pick nPerChapter random questions from each registered chapter's quiz bank. */
  function randomFrom(chapters, nPerChapter) {
    var out = [];
    (chapters || []).forEach(function (ch) {
      var bank = (ch.quiz || []).map(function (q) {
        var copy = {};
        for (var k in q) copy[k] = q[k];
        copy.chapterId = ch.id;
        copy.chapterNum = ch.num;
        return copy;
      });
      var picked = shuffle(bank).slice(0, nPerChapter);
      out = out.concat(picked);
    });
    return shuffle(out);
  }

  IO.Quiz = { render: render, grade: grade, randomFrom: randomFrom };
})(typeof window !== 'undefined' ? window : globalThis);
