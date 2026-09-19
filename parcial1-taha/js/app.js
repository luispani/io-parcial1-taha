/* App shell: router, sidebar, progress, theme, chapter rendering, Inicio/Resumen/Simulacro. Owner: A */
(function (global) {
  'use strict';
  var IO = global.IO = global.IO || { chapters: [] };
  IO.registerChapter = IO.registerChapter || function (ch) { IO.chapters.push(ch); };

  /* ---------- cleanup contract (SPEC §2) ---------- */
  IO._cleanups = IO._cleanups || [];
  IO.registerCleanup = IO.registerCleanup || function (fn) {
    (IO._cleanups = IO._cleanups || []).push(fn);
  };

  var EXAM_DATE = '2026-09-23';
  var CHAPTER_FALLBACK_TITLES = {
    cap1: 'Qué es la investigación de operaciones',
    cap2: 'Modelado con programación lineal',
    cap3: 'Método simplex y análisis de sensibilidad',
    cap4: 'Dualidad y análisis postóptimo',
    cap5: 'Modelo de transporte y sus variantes',
    peb: 'Programación entera y binaria',
    redes: 'Redes: flujo máximo',
    evolutivos: 'Algoritmos evolutivos'
  };
  var CHAPTER_IDS = ['cap1', 'cap2', 'cap3', 'cap4', 'cap5'];
  var EXTRA_IDS = ['peb', 'redes', 'evolutivos'];

  var currentChapterId = null; // id of the chapter currently mounted in #view, if any

  /* ---------- storage helpers ---------- */
  function lsGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ }
  }
  function lsGetRaw(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? fallback : raw;
    } catch (e) { return fallback; }
  }
  function lsSetRaw(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* ignore */ }
  }
  function lsRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- countdown ---------- */
  function daysUntilExam() {
    var now = new Date();
    var todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var parts = EXAM_DATE.split('-').map(Number);
    var exam = new Date(parts[0], parts[1] - 1, parts[2]);
    var diffMs = exam.getTime() - todayMidnight.getTime();
    return Math.ceil(diffMs / 86400000);
  }

  /* ---------- theme ---------- */
  function currentThemeSetting() {
    var theme = lsGetRaw('io_theme', null);
    return (theme === 'light' || theme === 'dark') ? theme : 'auto';
  }
  function applyTheme() {
    var theme = lsGetRaw('io_theme', null);
    var html = document.documentElement;
    if (theme === 'light' || theme === 'dark') {
      html.setAttribute('data-theme', theme);
    } else {
      html.removeAttribute('data-theme');
    }
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      var label = theme === 'light' ? 'Tema: claro' : theme === 'dark' ? 'Tema: oscuro' : 'Tema: automático';
      btn.textContent = label;
    }
  }
  function cycleTheme() {
    var theme = lsGetRaw('io_theme', null);
    var next = theme === null ? 'light' : theme === 'light' ? 'dark' : null;
    if (next === null) lsRemove('io_theme');
    else lsSetRaw('io_theme', next);
    applyTheme();
    var emitted = next === null ? 'auto' : next;
    try {
      window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: emitted } }));
    } catch (e) { /* ignore (very old browsers without CustomEvent) */ }
  }

  /* ---------- progress ---------- */
  function getProgress() { return lsGet('io_progress', {}); }
  function setSectionStudied(sectionId, val) {
    var p = getProgress();
    p[sectionId] = val;
    lsSet('io_progress', p);
  }
  function chapterPercent(ch) {
    var p = getProgress();
    var secs = (ch && ch.sections) || [];
    if (!secs.length) return 0;
    var done = 0;
    secs.forEach(function (s) { if (p[s.id]) done++; });
    return Math.round((done / secs.length) * 100);
  }

  /* ---------- export / import / delete progress (README) ---------- */
  function collectProgressKeys() {
    var keys = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('io_') === 0) keys.push(k);
      }
    } catch (e) { /* ignore */ }
    return keys;
  }
  function exportProgressJSON() {
    var data = {};
    collectProgressKeys().forEach(function (k) { data[k] = lsGetRaw(k, null); });
    return JSON.stringify(data, null, 2);
  }
  function importProgressJSON(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return false; }
    if (!data || typeof data !== 'object') return false;
    Object.keys(data).forEach(function (k) {
      if (k.indexOf('io_') !== 0) return;
      var v = data[k];
      lsSetRaw(k, typeof v === 'string' ? v : JSON.stringify(v));
    });
    return true;
  }
  function clearProgressData() {
    collectProgressKeys().forEach(function (k) { lsRemove(k); });
  }

  /* ---------- data access ---------- */
  function getChaptersSorted() {
    return IO.chapters.slice().sort(function (a, b) { return a.num - b.num; });
  }
  function findChapter(id) {
    var found = null;
    IO.chapters.forEach(function (c) { if (c.id === id) found = c; });
    return found;
  }

  /* ---------- sidebar ---------- */
  function renderSidebar() {
    var nav = document.getElementById('sidebar-nav');
    if (!nav) return;
    var currentHash = (location.hash || '#inicio').replace(/^#/, '');
    var currentChapterHash = (currentHash.match(/^(cap[1-5]|peb|redes|evolutivos|tareas|examenes)/) || [null])[0];

    var html = '<div class="sidebar-countdown"><span class="countdown-num">' + daysUntilExam() +
      '</span><span class="countdown-label">días para el parcial</span></div>';
    html += '<ul class="sidebar-list">';
    html += '<li><a href="#inicio" class="' + (currentHash === 'inicio' || currentHash === '' ? 'active' : '') + '">Inicio</a></li>';
    CHAPTER_IDS.forEach(function (id, i) {
      var ch = findChapter(id);
      var num = i + 1;
      var title = ch ? ch.title : CHAPTER_FALLBACK_TITLES[id];
      var pct = ch ? chapterPercent(ch) : 0;
      var isActive = currentChapterHash === id;
      html += '<li class="sidebar-chapter-item">' +
        '<a href="#' + id + '" class="' + (isActive ? 'active' : '') + '">Cap ' + num + '. ' + esc(title) + (ch ? '' : ' <span class="badge">en construcción</span>') + '</a>' +
        '<div class="chapter-progress" title="' + pct + '% estudiado"><div class="chapter-progress-fill" style="width:' + pct + '%"></div></div>' +
        '</li>';
    });
    EXTRA_IDS.forEach(function (id) {
      var ch = findChapter(id);
      if (!ch) return;
      var pct = chapterPercent(ch);
      var isActive = currentChapterHash === id;
      html += '<li class="sidebar-chapter-item">' +
        '<a href="#' + id + '" class="' + (isActive ? 'active' : '') + '">' + esc(ch.title) + '</a>' +
        '<div class="chapter-progress" title="' + pct + '% estudiado"><div class="chapter-progress-fill" style="width:' + pct + '%"></div></div>' +
        '</li>';
    });
    var tareas = findChapter('tareas');
    if (tareas) {
      var tpct = chapterPercent(tareas);
      html += '<li class="sidebar-chapter-item">' +
        '<a href="#tareas" class="' + (currentChapterHash === 'tareas' ? 'active' : '') + '">' + esc(tareas.title) + '</a>' +
        '<div class="chapter-progress" title="' + tpct + '% estudiado"><div class="chapter-progress-fill" style="width:' + tpct + '%"></div></div>' +
        '</li>';
    }
    var examenes = findChapter('examenes');
    if (examenes) {
      html += '<li><a href="#examenes" class="' + (currentChapterHash === 'examenes' ? 'active' : '') + '">' + esc(examenes.title) + '</a></li>';
    }
    html += '<li><a href="#resumen" class="' + (currentHash === 'resumen' ? 'active' : '') + '">Resumen</a></li>';
    html += '<li><a href="#simulacro" class="' + (currentHash === 'simulacro' ? 'active' : '') + '">Simulacro</a></li>';
    html += '</ul>';
    nav.innerHTML = html;
  }

  /* ---------- teardown before rendering any view (SPEC §2) ---------- */
  function teardownCurrentView() {
    var cleanups = IO._cleanups || [];
    IO._cleanups = [];
    cleanups.forEach(function (fn) {
      try { fn(); } catch (e) { console.error('Error en cleanup', e); }
    });
    if (currentChapterId) {
      var ch = findChapter(currentChapterId);
      if (ch && typeof ch.unmount === 'function') {
        var root = document.getElementById(ch.id);
        try { ch.unmount(root); } catch (e) { console.error('Error desmontando capítulo ' + ch.id, e); }
      }
      currentChapterId = null;
    }
  }

  /* ---------- chapter rendering (contract §2) ---------- */
  function ensureChapterCss(ch) {
    var styleId = 'io-css-' + ch.id;
    var existing = document.getElementById(styleId);
    if (existing) existing.remove();
    if (ch.css) {
      var style = document.createElement('style');
      style.id = styleId;
      style.textContent = ch.css;
      document.head.appendChild(style);
    }
  }

  function renderChapterMissing(view, id, num) {
    view.innerHTML =
      '<div class="panel">' +
      '<h1 class="panel-title">Cap ' + num + '. ' + esc(CHAPTER_FALLBACK_TITLES[id] || id) + '</h1>' +
      '<p class="callout callout-warn">Capítulo en construcción. Todavía no está disponible en esta versión de la página.</p>' +
      '</div>';
  }

  function renderChapter(id) {
    var view = document.getElementById('view');
    var num = CHAPTER_IDS.indexOf(id) + 1;
    var ch = findChapter(id);
    if (!ch) { renderChapterMissing(view, id, num > 0 ? num : '?'); return; }

    ensureChapterCss(ch);

    var html = '<section id="' + ch.id + '" class="chapter">';
    var headerTitle = (CHAPTER_IDS.indexOf(ch.id) >= 0 ? 'Cap ' + ch.num + '. ' : '') + esc(ch.title);
    html += '<div class="chapter-header"><h1 class="panel-title">' + headerTitle + '</h1>' +
      (ch.summary ? '<p class="muted">' + esc(ch.summary) + '</p>' : '') + '</div>';

    var progress = getProgress();
    (ch.sections || []).forEach(function (sec) {
      var studied = !!progress[sec.id];
      html += '<section id="' + sec.id + '" class="chapter-section panel">' +
        '<div class="row" style="justify-content:space-between;align-items:baseline;">' +
        '<h2>' + esc(sec.title) + '</h2>' +
        '<button type="button" class="btn btn-sm mark-studied-btn ' + (studied ? 'badge-ok' : '') + '" data-section="' + sec.id + '">' +
        (studied ? 'Estudiado ✓' : 'Marcar como estudiado') + '</button>' +
        '</div>' +
        '<div class="section-body">' + sec.html + '</div>' +
        '</section>';
    });

    html += '<div class="panel quiz-panel">' +
      '<h2 class="panel-title">Autoevaluación</h2>' +
      '<div id="quiz-' + ch.id + '"></div>' +
      '</div>';
    html += '</section>';

    view.innerHTML = html;
    currentChapterId = ch.id;

    var root = document.getElementById(ch.id);
    view.querySelectorAll('.mark-studied-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sid = btn.getAttribute('data-section');
        var nowStudied = !getProgress()[sid];
        setSectionStudied(sid, nowStudied);
        btn.textContent = nowStudied ? 'Estudiado ✓' : 'Marcar como estudiado';
        btn.classList.toggle('badge-ok', nowStudied);
        renderSidebar();
      });
    });

    if (typeof ch.mount === 'function') {
      try { ch.mount(root); } catch (e) { console.error('Error montando capítulo ' + ch.id, e); }
    }
    if (IO.Teach && typeof IO.Teach.enhance === 'function') {
      try { IO.Teach.enhance(root); } catch (e) { console.error('Error en Teach.enhance', e); }
    }
    if (IO.Viz3D && typeof IO.Viz3D.mountAll === 'function') {
      try { IO.Viz3D.mountAll(root); } catch (e) { console.error('Error montando Viz3D', e); }
    }

    if (ch.quiz && ch.quiz.length) {
      IO.Quiz.render(document.getElementById('quiz-' + ch.id), ch.quiz, 'io_quiz_' + ch.id);
    }
  }

  /* ---------- Inicio ---------- */
  function renderInicio() {
    var view = document.getElementById('view');
    var plan = lsGet('io_plan', {});

    var days = daysUntilExam();
    var html = '<div class="panel inicio-hero">' +
      '<h1 class="panel-title">Parcial · Investigación de operaciones</h1>' +
      '<p>Esta página enseña la materia <strong>desde cero</strong>. Libro: Taha, 9ª ed. Límite: los temas que aparecen en los exámenes de la cátedra (carpeta <code>examenes IO</code>) y en el programa 2020 (PL, PLE/PLB, redes).</p>' +
      '<p class="muted">Taha cap. 1–5 cubren IO, PL, simplex, dualidad y transporte. El examen también pide PEB, flujo máximo y algoritmos evolutivos: están en las pestañas extra.</p>' +
      '<div class="countdown-big"><span class="countdown-num">' + days + '</span><span class="countdown-label">' +
      (days >= 0 ? 'días para el parcial' : 'días desde la fecha cargada') + '</span></div>' +
      '</div>';

    html += '<div class="panel">' +
      '<h2 class="panel-title">Qué pide el examen (y dónde estudiarlo)</h2>' +
      '<p class="muted">Hecho con las 12 fotos de exámenes anteriores. Estudie en este orden si el tiempo es corto.</p>' +
      '<div class="exam-map">' +
      '<div><strong>Tema</strong></div><div><strong>Puntos típicos</strong></div><div><strong>Dónde</strong></div>' +
      '<div>Formulación + método gráfico de PL</div><div>11–24</div><div><a href="#cap2">Cap 2</a> · Taha 2.1–2.2</div>' +
      '<div>Transporte: grafo, FO, restricciones, costo mínimo / noroeste</div><div>8–19</div><div><a href="#cap5">Cap 5</a> · Taha 5.1–5.3</div>' +
      '<div>Conceptos: determinístico/estocástico, factible, óptimo</div><div>5</div><div><a href="#cap1">Cap 1</a> · Taha 1.1–1.3</div>' +
      '<div>Exactos vs heurísticos + algoritmos evolutivos</div><div>5 + 6 MC</div><div><a href="#evolutivos">Evolutivos</a></div>' +
      '<div>Dual y post-óptimo</div><div>6</div><div><a href="#cap4">Cap 4</a> · Taha 4.1 y 4.5</div>' +
      '<div>PEB + Solver (Peterson &amp; Johnson)</div><div>10</div><div><a href="#peb">Entera/binaria</a> · Taha 9</div>' +
      '<div>Flujo máximo Ford–Fulkerson</div><div>9</div><div><a href="#redes">Redes</a> · Taha 6</div>' +
      '<div>Simplex (tarea de clase; puede entrar)</div><div>variable</div><div><a href="#cap3">Cap 3</a> · Taha 3</div>' +
      '</div>' +
      '<p class="callout callout-exam"><strong>Si hay poco tiempo:</strong> Cap 2 gráfico → Cap 5 transporte (formular + costo mínimo) → conceptos cap 1 → evolutivos (de memoria) → dual → PEB → flujo máximo → simplex. Cada sección tiene una explicación desde cero, una animación 3D y el mejor video corto del tema.</p>' +
      '</div>';

    html += '<div class="grid-2">';
    html += '<div class="panel"><h2 class="panel-title">Accesos a capítulos</h2><div class="row">';
    CHAPTER_IDS.forEach(function (id, i) {
      var ch = findChapter(id);
      var title = ch ? ch.title : CHAPTER_FALLBACK_TITLES[id];
      html += '<a class="btn btn-ghost btn-sm" href="#' + id + '">Cap ' + (i + 1) + '. ' + esc(title) + '</a>';
    });
    EXTRA_IDS.forEach(function (id) {
      var ch = findChapter(id);
      if (ch) html += '<a class="btn btn-ghost btn-sm" href="#' + id + '">' + esc(ch.title) + '</a>';
    });
    if (findChapter('tareas')) html += '<a class="btn btn-ghost btn-sm" href="#tareas">' + esc(findChapter('tareas').title) + '</a>';
    if (findChapter('examenes')) html += '<a class="btn btn-ghost btn-sm" href="#examenes">' + esc(findChapter('examenes').title) + '</a>';
    html += '<a class="btn btn-ghost btn-sm" href="#resumen">Resumen</a>';
    html += '<a class="btn btn-primary btn-sm" href="#simulacro">Simulacro</a>';
    html += '</div></div>';

    html += '<div class="panel"><h2 class="panel-title">Progreso por capítulo</h2>';
    html += '<div class="kv">';
    CHAPTER_IDS.forEach(function (id, i) {
      var ch = findChapter(id);
      var pct = ch ? chapterPercent(ch) : 0;
      var title = ch ? ch.title : CHAPTER_FALLBACK_TITLES[id];
      html += '<div><span>Cap ' + (i + 1) + '. ' + esc(title) + '</span><span>' + pct + '%</span></div>';
    });
    EXTRA_IDS.forEach(function (id) {
      var ch = findChapter(id);
      if (!ch) return;
      html += '<div><span>' + esc(ch.title) + '</span><span>' + chapterPercent(ch) + '%</span></div>';
    });
    html += '</div></div>';
    html += '</div>';

    html += '<div class="panel"><h2 class="panel-title">Plan de estudio</h2>';
    (IO.plan ? IO.plan.days : []).forEach(function (day) {
      html += '<div class="plan-day">';
      html += '<h3>' + esc(day.label) + ' — ' + esc(day.topic) + '</h3>';
      html += '<ul class="plan-tasks">';
      day.tasks.forEach(function (task, ti) {
        var key = day.id;
        var checked = plan[key] && plan[key][ti];
        html += '<li><label class="row"><input type="checkbox" class="plan-check" data-day="' + day.id + '" data-idx="' + ti + '" ' +
          (checked ? 'checked' : '') + ' /> <span class="' + (checked ? 'muted' : '') + '">' + esc(task) + '</span></label></li>';
      });
      html += '</ul></div>';
    });
    html += '</div>';

    html += '<div class="panel">' +
      '<h2 class="panel-title">Progreso guardado en este navegador</h2>' +
      '<p class="muted">El progreso se guarda solo en este navegador (localStorage). Puede exportarlo para respaldarlo o pasarlo a otro equipo.</p>' +
      '<div class="row">' +
      '<button type="button" class="btn btn-sm" id="progress-export-btn">Exportar progreso</button>' +
      '<button type="button" class="btn btn-sm" id="progress-import-btn">Importar progreso</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" id="progress-clear-btn">Borrar progreso</button>' +
      '</div>' +
      '<textarea id="progress-io-area" class="wide" rows="6" style="width:100%;margin-top:8px;font-family:var(--font-mono, monospace);" placeholder="Exportar escribe el JSON acá. Para importar, pegue el JSON acá y presione Importar." hidden></textarea>' +
      '<div id="progress-clear-confirm" class="callout callout-warn" hidden>' +
      '<p>¿Confirma borrar todo el progreso guardado (capítulos, plan, quizzes, simulacro y tema)? Esta acción no se puede deshacer.</p>' +
      '<button type="button" class="btn btn-sm" id="progress-clear-yes">Sí, borrar</button> ' +
      '<button type="button" class="btn btn-sm btn-ghost" id="progress-clear-no">Cancelar</button>' +
      '</div>' +
      '</div>';

    view.innerHTML = html;
    currentChapterId = null;

    view.querySelectorAll('.plan-check').forEach(function (chk) {
      chk.addEventListener('change', function () {
        var day = chk.getAttribute('data-day');
        var idx = chk.getAttribute('data-idx');
        var p = lsGet('io_plan', {});
        p[day] = p[day] || {};
        p[day][idx] = chk.checked;
        lsSet('io_plan', p);
        chk.parentElement.querySelector('span').classList.toggle('muted', chk.checked);
      });
    });

    var area = document.getElementById('progress-io-area');
    var exportBtn = document.getElementById('progress-export-btn');
    var importBtn = document.getElementById('progress-import-btn');
    var clearBtn = document.getElementById('progress-clear-btn');
    var clearConfirm = document.getElementById('progress-clear-confirm');

    if (exportBtn) exportBtn.addEventListener('click', function () {
      area.hidden = false;
      area.value = exportProgressJSON();
      area.focus();
      area.select();
    });
    if (importBtn) importBtn.addEventListener('click', function () {
      if (area.hidden || !area.value.trim()) {
        area.hidden = false;
        area.value = '';
        area.focus();
        return;
      }
      var ok = importProgressJSON(area.value);
      if (ok) { renderSidebar(); route(); }
      else { area.value = '// JSON inválido. Vuelva a pegar el progreso exportado.\n' + area.value; }
    });
    if (clearBtn) clearBtn.addEventListener('click', function () { clearConfirm.hidden = false; });
    var clearYes = document.getElementById('progress-clear-yes');
    var clearNo = document.getElementById('progress-clear-no');
    if (clearYes) clearYes.addEventListener('click', function () {
      clearProgressData();
      clearConfirm.hidden = true;
      applyTheme();
      renderSidebar();
      route();
    });
    if (clearNo) clearNo.addEventListener('click', function () { clearConfirm.hidden = true; });
  }

  /* ---------- Resumen ---------- */
  function renderResumen() {
    var view = document.getElementById('view');
    var html = '<div class="panel">' +
      '<div class="row" style="justify-content:space-between;">' +
      '<h1 class="panel-title">Hoja resumen</h1>' +
      '<button type="button" class="btn btn-sm btn-ghost" onclick="window.print()">Imprimir</button>' +
      '</div>' +
      (IO.resumen ? IO.resumen.html : '<p class="callout callout-warn">Resumen no disponible.</p>') +
      '</div>';
    view.innerHTML = html;
    currentChapterId = null;
  }

  /* ---------- Simulacro (§7) ---------- */
  var SIM_DURATION_MS = 90 * 60 * 1000;

  function loadSimState() {
    var raw = lsGetRaw(IO.SimulacroState.STORAGE_KEY, null);
    if (!raw) return null;
    return IO.SimulacroState.deserialize(raw);
  }
  function saveSimState(state) {
    lsSetRaw(IO.SimulacroState.STORAGE_KEY, IO.SimulacroState.serialize(state));
  }
  function clearSimState() {
    lsRemove(IO.SimulacroState.STORAGE_KEY);
  }

  function formatMMSS(ms) {
    var totalSec = Math.max(0, Math.round(ms / 1000));
    var mm = Math.floor(totalSec / 60), ss = totalSec % 60;
    return (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function renderSimulacro() {
    var view = document.getElementById('view');
    currentChapterId = null;
    var state = loadSimState();

    if (state && !state.submitted && IO.SimulacroState.isExpired(state, Date.now())) {
      /* Time ran out while the user was away. Finish safely: pure state math only,
       * no DOM access here (the view for this attempt may not even exist yet). */
      state = IO.SimulacroState.submit(state, Date.now());
      saveSimState(state);
    }

    if (!state) { renderSimStart(view); return; }
    if (state.submitted) { renderSimResult(view, state); return; }
    renderSimInProgress(view, state);
  }

  function renderSimStart(view) {
    view.innerHTML =
      '<div class="panel">' +
      '<h1 class="panel-title">Simulacro de parcial</h1>' +
      '<p>21 preguntas: 3 de cada capítulo 1–5 y 2 de PEB, redes y evolutivos. Cronómetro de 90 minutos. Se puede entregar antes.</p>' +
      '<button type="button" class="btn btn-primary" id="sim-start-btn">Comenzar simulacro</button>' +
      '</div>';
    var startBtn = document.getElementById('sim-start-btn');
    if (startBtn) startBtn.addEventListener('click', function () { beginNewSimulacro(); });
  }

  function beginNewSimulacro() {
    var bookChapters = getChaptersSorted().filter(function (c) { return CHAPTER_IDS.indexOf(c.id) >= 0; });
    var extraChapters = getChaptersSorted().filter(function (c) { return EXTRA_IDS.indexOf(c.id) >= 0; });
    var questions = IO.Quiz.randomFrom(bookChapters, 3).concat(IO.Quiz.randomFrom(extraChapters, 2));
    var qi, qj, tmp;
    for (qi = questions.length - 1; qi > 0; qi--) {
      qj = Math.floor(Math.random() * (qi + 1));
      tmp = questions[qi]; questions[qi] = questions[qj]; questions[qj] = tmp;
    }
    questions = questions.map(function (q) {
      var ch = findChapter(q.chapterId);
      q.chapterTitle = (ch && ch.title) || CHAPTER_FALLBACK_TITLES[q.chapterId] || ('Cap ' + q.chapterNum);
      return q;
    });
    var state = IO.SimulacroState.create(questions, Date.now(), SIM_DURATION_MS);
    saveSimState(state);
    renderSimInProgress(document.getElementById('view'), state);
  }

  function renderSimQuestions(container, state) {
    var html = '';
    state.questions.forEach(function (item, idx) {
      var given = state.answers[String(idx)];
      html += '<div class="quiz-q sim-q" data-idx="' + idx + '">';
      html += '<p class="quiz-q-text"><strong>' + (idx + 1) + '.</strong> ' + esc(item.q) + '</p>';
      if (item.type === 'number') {
        html += '<div class="input-grid"><input type="number" step="any" class="quiz-input" data-idx="' + idx + '"' +
          (given !== undefined && given !== null ? ' value="' + esc(given) + '"' : '') +
          ' placeholder="Respuesta numérica" /></div>';
      } else {
        html += '<div class="quiz-options">';
        (item.options || []).forEach(function (opt, oi) {
          var checked = String(given) === String(oi);
          html += '<label class="quiz-option row">' +
            '<input type="radio" name="sim-q-' + idx + '" value="' + oi + '" data-idx="' + idx + '"' + (checked ? ' checked' : '') + ' /> <span>' + esc(opt) + '</span></label>';
        });
        html += '</div>';
      }
      html += '</div>';
    });
    container.innerHTML = html;
  }

  function renderSimInProgress(view, initialState) {
    var html = '<div class="panel">' +
      '<div class="row" style="justify-content:space-between;">' +
      '<h1 class="panel-title">Simulacro en curso</h1>' +
      '<span class="badge" id="sim-timer">' + formatMMSS(IO.SimulacroState.remainingMs(initialState, Date.now())) + '</span>' +
      '</div>' +
      '<p class="muted">' + initialState.questions.length + ' preguntas. Las respuestas se guardan automáticamente.</p>' +
      '<div id="sim-questions"></div>' +
      '<div class="row">' +
      '<button type="button" class="btn btn-primary" id="sim-submit-btn">Entregar</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="sim-newattempt-btn">Nuevo simulacro</button>' +
      '</div>' +
      '<div id="sim-discard-confirm" class="callout callout-warn" hidden>' +
      '<p>Hay un intento en curso sin entregar. ¿Confirma descartarlo y empezar uno nuevo?</p>' +
      '<button type="button" class="btn btn-sm" id="sim-discard-yes">Sí, descartar</button> ' +
      '<button type="button" class="btn btn-sm btn-ghost" id="sim-discard-no">Cancelar</button>' +
      '</div>' +
      '</div>';
    view.innerHTML = html;

    var qContainer = document.getElementById('sim-questions');
    var state = initialState;
    renderSimQuestions(qContainer, state);

    var timerEl = document.getElementById('sim-timer');
    var timerId = null;

    function stopTimer() {
      if (timerId !== null) { clearInterval(timerId); timerId = null; }
    }
    IO.registerCleanup(stopTimer);

    function tick() {
      var el = document.getElementById('sim-timer');
      if (!el) return; /* view no longer mounted; the cleanup above already stops this interval */
      var remaining = IO.SimulacroState.remainingMs(state, Date.now());
      el.textContent = formatMMSS(remaining);
      if (IO.SimulacroState.isExpired(state, Date.now())) {
        stopTimer();
        doSubmit();
      }
    }
    tick();
    timerId = setInterval(tick, 1000);

    qContainer.addEventListener('change', function (e) {
      var target = e.target;
      if (!target || !target.classList || !target.classList.contains('quiz-input') && target.type !== 'radio') return;
      var idx = target.getAttribute('data-idx');
      if (idx === null) return;
      state = IO.SimulacroState.answer(state, idx, target.value);
      saveSimState(state);
    });
    qContainer.addEventListener('input', function (e) {
      var target = e.target;
      if (!target || !target.classList || !target.classList.contains('quiz-input')) return;
      var idx = target.getAttribute('data-idx');
      if (idx === null) return;
      state = IO.SimulacroState.answer(state, idx, target.value);
      saveSimState(state);
    });

    function doSubmit() {
      if (state.submitted) return;
      state = IO.SimulacroState.submit(state, Date.now());
      saveSimState(state);
      var v = document.getElementById('view');
      if (v) renderSimResult(v, state);
    }

    var submitBtn = document.getElementById('sim-submit-btn');
    if (submitBtn) submitBtn.addEventListener('click', doSubmit);

    var newBtn = document.getElementById('sim-newattempt-btn');
    var discardConfirm = document.getElementById('sim-discard-confirm');
    if (newBtn) newBtn.addEventListener('click', function () { discardConfirm.hidden = false; });
    var discardYes = document.getElementById('sim-discard-yes');
    var discardNo = document.getElementById('sim-discard-no');
    if (discardYes) discardYes.addEventListener('click', function () {
      stopTimer();
      clearSimState();
      var v = document.getElementById('view');
      if (v) renderSimStart(v);
    });
    if (discardNo) discardNo.addEventListener('click', function () { discardConfirm.hidden = true; });
  }

  function renderSimResult(view, state) {
    var result = state.result || { score: 0, total: state.questions.length, nota: 0, byChapter: {}, repasar: [], perQuestion: [] };
    var chapterRows = '';
    Object.keys(result.byChapter).sort(function (a, b) { return Number(a) - Number(b); }).forEach(function (num) {
      var b = result.byChapter[num];
      var pct = b.total ? Math.round((b.ok / b.total) * 100) : 0;
      chapterRows += '<div><span>Cap ' + num + '. ' + esc(b.title) + '</span><span>' + b.ok + '/' + b.total + ' (' + pct + '%)</span></div>';
    });

    var html = '<div class="panel callout ' + (result.nota >= 70 ? 'callout-tip' : 'callout-warn') + '">' +
      '<h2>Resultado: ' + result.nota + '/100</h2>' +
      '<div class="kv">' + chapterRows + '</div>';
    if (result.repasar.length) {
      html += '<p><strong>Temas a repasar (menos de 70%):</strong></p><ul>' +
        result.repasar.map(function (r) { return '<li>Cap ' + r.num + '. ' + esc(r.title) + '</li>'; }).join('') + '</ul>';
    } else {
      html += '<p>Buen puntaje en todos los capítulos evaluados.</p>';
    }
    html += '<button type="button" class="btn btn-ghost btn-sm" id="sim-restart-btn">Nuevo simulacro</button>';
    html += '</div>';

    html += '<div class="panel"><h2 class="panel-title">Revisión</h2>';
    state.questions.forEach(function (item, idx) {
      var pq = result.perQuestion[idx] || { ok: false, given: null };
      var correctText = item.type === 'number' ? String(item.answer) : (item.options ? item.options[item.answer] : '');
      html += '<div class="quiz-q ' + (pq.ok ? 'quiz-ok' : 'quiz-wrong') + '">' +
        '<p class="quiz-q-text"><strong>' + (idx + 1) + '.</strong> ' + esc(item.q) + '</p>' +
        '<div class="quiz-feedback"><span class="badge ' + (pq.ok ? 'badge-ok' : 'badge-err') + '">' + (pq.ok ? 'Correcto' : 'Incorrecto') + '</span> ' +
        (pq.ok ? '' : '<span class="muted">Respuesta correcta: ' + esc(correctText) + '.</span> ') +
        '<span class="muted">' + esc(item.explain || '') + '</span></div>' +
        '</div>';
    });
    html += '</div>';

    view.innerHTML = html;

    var restartBtn = document.getElementById('sim-restart-btn');
    if (restartBtn) restartBtn.addEventListener('click', function () {
      clearSimState();
      beginNewSimulacro();
    });
  }

  /* ---------- router ---------- */
  function route() {
    teardownCurrentView();
    var hash = (location.hash || '#inicio').replace(/^#/, '');
    if (hash === '' || hash === 'inicio') { renderInicio(); }
    else if (hash === 'resumen') { renderResumen(); }
    else if (hash === 'simulacro') { renderSimulacro(); }
    else if (/^(cap[1-5]|peb|redes|evolutivos|tareas|examenes)/.test(hash)) {
      var chapterId = hash.match(/^(cap[1-5]|peb|redes|evolutivos|tareas|examenes)/)[0];
      renderChapter(chapterId);
      if (hash !== chapterId) {
        var target = document.getElementById(hash);
        if (target) setTimeout(function () { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
      }
    } else {
      renderInicio();
    }
    renderSidebar();
    var main = document.getElementById('view');
    if (main) main.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  /* ---------- mobile sidebar toggle ---------- */
  var mobileToggleInit = false;
  function initMobileToggle() {
    if (mobileToggleInit) return;
    var btn = document.getElementById('sidebar-toggle');
    var sidebar = document.getElementById('sidebar');
    if (!btn || !sidebar) return;
    mobileToggleInit = true;
    btn.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== btn) {
        sidebar.classList.remove('open');
      }
    });
  }

  /* ---------- init ---------- */
  var appInit = false;
  function init() {
    if (appInit) return;
    appInit = true;
    applyTheme();
    var themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', cycleTheme);
    initMobileToggle();
    window.addEventListener('hashchange', route);
    route();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  IO.app = {
    route: route,
    renderSidebar: renderSidebar,
    currentTheme: currentThemeSetting
  };
})(typeof window !== 'undefined' ? window : globalThis);
