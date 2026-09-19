/* Programación entera y binaria — Unidad III del programa y ítem de examen.
 * Taha 9ª ed. cap. 9 (fuera de 1–5, pero el límite del curso son los exámenes). */
(function (global) {
  'use strict';
  var IO = global.IO = global.IO || { chapters: [] };
  IO.registerChapter = IO.registerChapter || function (ch) { IO.chapters.push(ch); };

  function video(id, title, dur, lang, why) {
    return IO.Teach ? IO.Teach.videoCard({ id: id, title: title, dur: dur, lang: lang, why: why }) : '';
  }
  function refs(list) { return IO.Teach ? IO.Teach.refsHtml(list) : ''; }
  function viz(name, cap) { return IO.Teach ? IO.Teach.vizHtml(name, cap) : '<div class="widget" data-viz3d="' + name + '"></div>'; }

  var PROJECTS = [
    { name: '1', g: 1.0, c: 6 },
    { name: '2', g: 1.8, c: 12 },
    { name: '3', g: 1.6, c: 10 },
    { name: '4', g: 0.8, c: 4 },
    { name: '5', g: 1.4, c: 8 }
  ];
  var BUDGET = 20;

  function knapsackBest(projects, budget) {
    var n = projects.length;
    var best = { z: -1, x: [], cap: 0 };
    var lim = 1 << n;
    for (var mask = 0; mask < lim; mask++) {
      var z = 0, cap = 0, x = [];
      for (var j = 0; j < n; j++) {
        var on = (mask >> j) & 1;
        x.push(on);
        if (on) { z += projects[j].g; cap += projects[j].c; }
      }
      if (cap <= budget && z > best.z) best = { z: z, x: x, cap: cap };
    }
    return best;
  }

  function s1() {
    return '<div class="zero-hero">' +
      '<p><strong>De cero.</strong> Hasta ahora las variables podían ser 3, 1,5 o 33,33. En la vida muchas decisiones son “sí o no”: abrir una planta, elegir un proyecto, comprar una máquina. Eso es <strong>programación lineal entera (PLE)</strong> y, si solo vale 0 o 1, <strong>programación entera binaria (PEB / PLB)</strong>.</p>' +
      '<p>Un modelo de PEB se escribe igual que un PL, con una línea extra:</p>' +
      '<p class="formula">x<sub>j</sub> ∈ {0, 1} &nbsp; (1 = se hace, 0 = no se hace)</p>' +
      '<p>Si redondea el óptimo del PL (la <em>relajación lineal</em>) puede obtener un punto ilegal o un punto peor. Hay que tratar las variables como enteras desde el modelo, o enumerar combinaciones factibles cuando hay pocas.</p>' +
      '<p>El programa de la materia (Unidad III) y Taha cap. 9 cubren esto. El examen lo pide con nombre: “formule un modelo de PEB”.</p>' +
      '</div>' +
      viz('binary-cube', 'Cada vértice del cubo es una combinación sí/no') +
      '<h3>Relajación vs entero</h3>' +
      '<p>Really Big Shoe (examen 4) es un PL que da 26,32 equipos de básquetbol. Un equipo no se parte. El entero factible más cercano bueno es 26 y 12, total 38. Control: no se puede llegar a 39.</p>' +
      '<div class="callout callout-def"><strong>Regla:</strong> resuelva primero como PL (gráfico o simplex). Si las variables salen enteras, terminó. Si no, busque puntos enteros vecinos que sigan factibles y compare z. Con muchas variables binarias se usa Solver con “binario”.</div>' +
      video('uDwh0c-oISQ', 'Programación lineal entera binaria · capital de inversión (Ing. Armin Flores)', '20 min', 'español',
        'El mismo tipo de problema que Peterson & Johnson: elegir proyectos 0-1 con presupuesto.') +
      refs([
        { title: 'Wikipedia · Programación lineal entera', url: 'https://es.wikipedia.org/wiki/Programaci%C3%B3n_lineal_entera', note: 'PLE, PLB y relajación.' },
        { title: 'Taha 9ª ed., capítulo 9', url: 'https://es.wikipedia.org/wiki/Programaci%C3%B3n_lineal_entera', note: 'fuera de cap. 1–5; el examen sí lo toma.' },
        { title: 'Formulación de un modelo entero (UPV)', url: 'https://www.youtube.com/watch?v=DmZeaaSgjiU', note: '10 min, variables enteras y binarias.' }
      ]) +
      '<div class="callout callout-exam"><strong>En el parcial.</strong> Peterson &amp; Johnson (5 proyectos, presupuesto 20). Formule PEB (4 P.), muéstrelo en Excel (2 P.), resuelva con Solver (4 P.).</div>';
  }

  function s2() {
    return '<div class="zero-hero">' +
      '<p><strong>De cero. El problema de la mochila 0-1</strong> (knapsack): cada ítem entra entero o no entra. Hay un presupuesto. Se maximiza la ganancia.</p>' +
      '<p>Peterson &amp; Johnson, copiado del examen:</p>' +
      '<div class="table-scroll"><table class="data"><thead><tr><th>Proyecto</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr></thead><tbody>' +
      '<tr><td>Ganancia</td><td>1</td><td>1,8</td><td>1,6</td><td>0,8</td><td>1,4</td></tr>' +
      '<tr><td>Capital</td><td>6</td><td>12</td><td>10</td><td>4</td><td>8</td></tr>' +
      '</tbody></table></div>' +
      '<pre class="formula">Max Z = 1x1 + 1,8x2 + 1,6x3 + 0,8x4 + 1,4x5\ns.a.  6x1 + 12x2 + 10x3 + 4x4 + 8x5 ≤ 20\n      xj ∈ {0, 1}</pre>' +
      '<p>Hay 2<sup>5</sup> = 32 combinaciones. Las que no pasan de 20 de capital se comparan. La mejor es <strong>x = (1, 0, 1, 1, 0)</strong>: proyectos 1, 3 y 4. Capital 6+10+4 = 20. Ganancia <strong>3,4</strong>.</p>' +
      '<p>Casi óptimas: {2,5} y {1,4,5} dan 3,2. {3,5} da 3,0. {1,2} da 2,8 y usa 18.</p>' +
      '</div>' +
      '<div class="widget wide" data-widget="peb-enum"></div>' +
      video('uDwh0c-oISQ', 'Programación lineal entera binaria · capital de inversión (Ing. Armin Flores)', '20 min', 'español',
        'Enumeración de proyectos 0-1 con presupuesto. Es el procedimiento del examen.') +
      refs([
        { title: 'Wikipedia · Problema de la mochila', url: 'https://es.wikipedia.org/wiki/Problema_de_la_mochila', note: 'versión 0-1, la del examen.' }
      ]) +
      '<div class="callout callout-exam">En Solver: objetivo = celda de ganancia (Máx). Celdas cambiantes = x1…x5. Restricciones: capital ≤ 20 y xi = binario. Método Simplex LP. Anote el resultado: 1, 0, 1, 1, 0 y Z = 3,4.</div>';
  }

  function s3() {
    return '<div class="zero-hero">' +
      '<p><strong>De cero. Cómo se escribe en Excel</strong> (lo piden con puntos).</p>' +
      '<ol class="teach-steps">' +
      '<li>Fila 1: nombres de proyectos.</li>' +
      '<li>Fila 2: ganancias 1 ; 1,8 ; 1,6 ; 0,8 ; 1,4.</li>' +
      '<li>Fila 3: capitales 6 ; 12 ; 10 ; 4 ; 8.</li>' +
      '<li>Fila 4: celdas cambiantes x1…x5, empiece en 0.</li>' +
      '<li>Ganancia total: <span class="eq">=SUMAPRODUCTO(ganancias; x)</span>.</li>' +
      '<li>Capital usado: <span class="eq">=SUMAPRODUCTO(capitales; x)</span>, al lado el límite 20.</li>' +
      '<li>Solver: Máx la ganancia, cambiantes = x, capital usado ≤ 20, x binario.</li>' +
      '</ol>' +
      '<p>Otras restricciones binarias típicas (Taha cap. 9, por si el enunciado las agrega):</p>' +
      '<ul>' +
      '<li>Si hace el 2, debe hacer el 1: x2 ≤ x1.</li>' +
      '<li>Exactamente uno de {1,2,3}: x1+x2+x3 = 1.</li>' +
      '<li>Al menos dos proyectos: x1+…+x5 ≥ 2.</li>' +
      '</ul>' +
      '</div>' +
      video('jMEeqE3LEpU', 'Programación entera binaria en Solver (Ing. Oscar Aguilar)', '6 min', 'español',
        'Misma receta que el ítem c del examen: Solver con variables binarias.') +
      refs([
        { title: 'Microsoft · Definir y resolver un problema con Solver', url: 'https://support.microsoft.com/es-es/office/definir-y-resolver-un-problema-mediante-solver-5d1a388f-079d-43ac-a7eb-f63e45925040', note: 'marcar “bin” en las restricciones.' }
      ]);
  }

  function mountEnum(root) {
    var el = root.querySelector('[data-widget="peb-enum"]');
    if (!el) return;
    var best = knapsackBest(PROJECTS, BUDGET);
    var h = '<p class="panel-title" style="margin:0 0 8px">Enumeración de Peterson &amp; Johnson (presupuesto 20)</p>';
    h += '<p class="muted">Cada fila es una combinación. Las ilegales (capital &gt; 20) se tachan. La mejor factible queda marcada.</p>';
    h += '<div class="table-scroll"><table class="data"><thead><tr><th>x1</th><th>x2</th><th>x3</th><th>x4</th><th>x5</th><th>Capital</th><th>Z</th><th></th></tr></thead><tbody>';
    var n = PROJECTS.length;
    var lim = 1 << n;
    var rows = [];
    var mask;
    for (mask = 0; mask < lim; mask++) {
      var x = [], cap = 0, z = 0, j;
      for (j = 0; j < n; j++) {
        var on = (mask >> j) & 1;
        x.push(on);
        if (on) { cap += PROJECTS[j].c; z += PROJECTS[j].g; }
      }
      rows.push({ x: x, cap: cap, z: z, ok: cap <= BUDGET });
    }
    rows.sort(function (a, b) { return b.z - a.z; });
    rows.forEach(function (r) {
      var isBest = r.ok && Math.abs(r.z - best.z) < 1e-9 && r.x.join() === best.x.join();
      h += '<tr class="' + (isBest ? 'hl' : '') + '">';
      r.x.forEach(function (v) { h += '<td>' + v + '</td>'; });
      h += '<td>' + r.cap + '</td><td>' + (Math.round(r.z * 10) / 10) + '</td>';
      h += '<td>' + (r.ok ? (isBest ? '<span class="badge badge-ok">óptimo</span>' : '') : '<span class="badge badge-err">inválido</span>') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    h += '<p><strong>Óptimo:</strong> proyectos 1, 3 y 4. Capital ' + best.cap + '. Ganancia <span class="eq">' + best.z + '</span>.</p>';
    el.innerHTML = h;
  }

  IO.registerChapter({
    id: 'peb',
    num: 8,
    title: 'Programación entera y binaria',
    summary: 'Unidad III. Variables 0-1, mochila, Peterson & Johnson y Solver. Entra en el examen aunque Taha lo pone en el capítulo 9.',
    css: '#peb table.data .hl td{background:var(--pivot)}',
    sections: [
      { id: 'peb-s1', title: 'Qué es un modelo entero / binario', html: s1() },
      { id: 'peb-s2', title: 'Mochila 0-1: Peterson & Johnson', html: s2() },
      { id: 'peb-s3', title: 'Excel Solver con binarios', html: s3() }
    ],
    mount: function (root) {
      mountEnum(root);
    },
    quiz: [
      { q: 'Una variable binaria solo puede tomar los valores:', options: ['cualquier real ≥ 0', '0 o 1', 'enteros 0,1,2,…', '−1 o 1'], answer: 1, explain: 'Binaria = {0,1}. Entera general puede ser 0,1,2,…' },
      { q: 'En Peterson & Johnson el presupuesto es 20 y el óptimo usa los proyectos:', options: ['2 y 5', '1, 3 y 4', '1, 4 y 5', '3 y 5'], answer: 1, explain: '1+3+4: capital 20, ganancia 3,4. Es la mejor.' },
      { q: 'La ganancia óptima de Peterson & Johnson es:', type: 'number', answer: 3.4, tol: 0.05, explain: '1 + 1,6 + 0,8 = 3,4.' },
      { q: 'Redondear el óptimo del PL relajado:', options: ['siempre da el óptimo entero', 'puede ser ilegal o subóptimo', 'es obligatorio en PEB', 'elimina las restricciones'], answer: 1, explain: 'Really Big Shoe: 26,32 no es un equipo. Hay que buscar enteros factibles.' },
      { q: 'En Solver, para PEB, las celdas cambiantes se marcan como:', options: ['continuas', 'binarias (bin)', 'no negativas nada más', 'libres'], answer: 1, explain: 'Restricción “binario” sobre x1…x5.' },
      { q: 'La relajación lineal de un PEB es:', options: ['el mismo modelo con 0 ≤ xj ≤ 1', 'borrar el objetivo', 'poner M en la diagonal', 'el dual'], answer: 0, explain: 'Se suelta la integralidad: 0 ≤ xj ≤ 1. Da una cota superior (en un max).' },
      { q: 'Si el proyecto 2 solo se puede hacer si se hace el 1, la restricción es:', options: ['x1 + x2 ≤ 1', 'x2 ≤ x1', 'x1 ≤ x2', 'x1 = x2'], answer: 1, explain: 'x2 ≤ x1: si x2=1 entonces x1 debe ser 1.' },
      { q: '¿Cuántas combinaciones binarias hay con 5 proyectos?', options: ['5', '10', '16', '32'], answer: 3, explain: '2^5 = 32. Por eso se puede enumerar a mano o con una tabla.' },
      { q: 'En Really Big Shoe el óptimo entero de equipos totales es:', type: 'number', answer: 38, tol: 0.1, explain: '26 de básquetbol + 12 de fútbol = 38. 39 no es factible.' },
      { q: 'PEB es un caso particular de:', options: ['teoría de colas', 'programación lineal entera', 'simulación', 'flujo máximo'], answer: 1, explain: 'Entera + dominio {0,1} = PEB.' }
    ]
  });

  IO.__peb = { knapsackBest: knapsackBest, PROJECTS: PROJECTS, BUDGET: BUDGET };
})(typeof window !== 'undefined' ? window : globalThis);
