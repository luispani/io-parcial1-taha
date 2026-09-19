/* Modelos de redes: flujo máximo (Unidad IV). El transporte ya está en cap 5. */
(function (global) {
  'use strict';
  var IO = global.IO = global.IO || { chapters: [] };
  IO.registerChapter = IO.registerChapter || function (ch) { IO.chapters.push(ch); };

  function video(id, title, dur, lang, why) {
    return IO.Teach ? IO.Teach.videoCard({ id: id, title: title, dur: dur, lang: lang, why: why }) : '';
  }
  function refs(list) { return IO.Teach ? IO.Teach.refsHtml(list) : ''; }
  function viz(name, cap) { return IO.Teach ? IO.Teach.vizHtml(name, cap) : '<div data-viz3d="' + name + '"></div>'; }

  /* Exam 3 network: capacities. */
  var ARCS = [
    ['A', 'B', 9], ['A', 'C', 7], ['B', 'D', 7], ['B', 'E', 2],
    ['C', 'D', 4], ['C', 'E', 6], ['D', 'E', 3], ['D', 'F', 6], ['E', 'F', 9]
  ];

  /* Residual graph as map "U>V" -> remaining forward capacity. Backward = current flow. */
  function emptyResidual() {
    var r = {};
    ARCS.forEach(function (a) {
      r[a[0] + '>' + a[1]] = a[2];
      r[a[1] + '>' + a[0]] = 0;
    });
    return r;
  }

  /* BFS augmenting path. Returns {path:[nodes], bottleneck} or null. */
  function findPath(resid, source, sink) {
    var q = [source];
    var prev = {};
    prev[source] = null;
    var nodes = ['A', 'B', 'C', 'D', 'E', 'F'];
    while (q.length) {
      var u = q.shift();
      for (var i = 0; i < nodes.length; i++) {
        var v = nodes[i];
        if (prev[v] !== undefined) continue;
        var cap = resid[u + '>' + v] || 0;
        if (cap > 0) {
          prev[v] = u;
          if (v === sink) {
            var path = [];
            var x = sink;
            while (x !== null) { path.push(x); x = prev[x]; }
            path.reverse();
            var bot = Infinity;
            for (var k = 0; k < path.length - 1; k++) {
              bot = Math.min(bot, resid[path[k] + '>' + path[k + 1]]);
            }
            return { path: path, bottleneck: bot };
          }
          q.push(v);
        }
      }
    }
    return null;
  }

  function augment(resid, path, bot) {
    for (var i = 0; i < path.length - 1; i++) {
      var u = path[i], v = path[i + 1];
      resid[u + '>' + v] -= bot;
      resid[v + '>' + u] = (resid[v + '>' + u] || 0) + bot;
    }
  }

  function maxFlow(source, sink) {
    var resid = emptyResidual();
    var total = 0;
    var steps = [];
    var found;
    while ((found = findPath(resid, source, sink))) {
      augment(resid, found.path, found.bottleneck);
      total += found.bottleneck;
      steps.push({ path: found.path.slice(), flow: found.bottleneck, acc: total });
    }
    return { value: total, steps: steps, residual: resid };
  }

  function s1() {
    return '<div class="zero-hero">' +
      '<p><strong>De cero. Una red de flujo</strong> es un grafo dirigido. Cada arco es un caño con una <strong>capacidad</strong> (el máximo que puede pasar). Hay un origen s y un destino t. El problema: ¿cuál es la mayor cantidad que puede ir de s a t sin reventar ningún caño?</p>' +
      '<p>Reglas que no se discuten:</p>' +
      '<ul class="teach-steps">' +
      '<li>0 ≤ flujo(arco) ≤ capacidad(arco).</li>' +
      '<li>En cada nodo intermedio, lo que entra = lo que sale (conservación).</li>' +
      '<li>El valor del flujo es lo que sale de s, igual a lo que llega a t.</li>' +
      '</ul>' +
      '<p>El transporte del cap. 5 también es una red, pero con costos. El flujo máximo no mira costos: mira capacidades.</p>' +
      '</div>' +
      viz('maxflow-pipes', 'Caños de A a F, el flujo llena los arcos') +
      '<p>Red del examen (origen A, destino F):</p>' +
      '<div class="table-scroll"><table class="data"><thead><tr><th>Arco</th><th>A→B</th><th>A→C</th><th>B→D</th><th>B→E</th><th>C→D</th><th>C→E</th><th>D→E</th><th>D→F</th><th>E→F</th></tr></thead>' +
      '<tbody><tr><td>Capacidad</td><td>9</td><td>7</td><td>7</td><td>2</td><td>4</td><td>6</td><td>3</td><td>6</td><td>9</td></tr></tbody></table></div>' +
      video('Btqs1f0TfeU', 'Flujo máximo con algoritmo de Ford-Fulkerson (UPV)', '8 min', 'español',
        'Capacidad, flujo, residual y camino de aumento. Universidad, en español, 8 minutos.') +
      refs([
        { title: 'Wikipedia · Flujo máximo', url: 'https://es.wikipedia.org/wiki/Flujo_m%C3%A1ximo', note: 'enunciado y teorema max-flow min-cut.' },
        { title: 'Taha 9ª ed., capítulo 6 (redes)', url: 'https://es.wikipedia.org/wiki/Flujo_m%C3%A1ximo', note: 'fuera de cap. 1–5; el examen sí lo toma.' }
      ]);
  }

  function s2() {
    return '<div class="zero-hero">' +
      '<p><strong>De cero. Ford–Fulkerson</strong> (como se pide “muestre los pasos”):</p>' +
      '<ol class="teach-steps">' +
      '<li>Empiece con flujo 0 en todos los arcos.</li>' +
      '<li>Busque un camino de s a t donde todavía sobre capacidad (camino de aumento). El cuello de botella es el mínimo residual de ese camino.</li>' +
      '<li>Sume ese número al flujo de cada arco del camino. En el residual, reste adelante y sume atrás (por si hay que deshacer).</li>' +
      '<li>Repita hasta que no quede ningún camino de s a t.</li>' +
      '</ol>' +
      '<p>En el examen no exigen el residual formal. Basta listar rutas, el flujo de cada una y el acumulado, y parar cuando D→F y E→F están llenos.</p>' +
      '<p>Una secuencia válida para la red del examen:</p>' +
      '<div class="table-scroll"><table class="data"><thead><tr><th>Paso</th><th>Ruta</th><th>Flujo</th><th>Acumulado</th></tr></thead><tbody>' +
      '<tr><td>1</td><td>A→B→D→F</td><td>6</td><td>6</td></tr>' +
      '<tr><td>2</td><td>A→B→E→F</td><td>2</td><td>8</td></tr>' +
      '<tr><td>3</td><td>A→B→D→E→F</td><td>1</td><td>9</td></tr>' +
      '<tr><td>4</td><td>A→C→E→F</td><td>6</td><td>15</td></tr>' +
      '</tbody></table></div>' +
      '<p><strong>Flujo máximo = 15.</strong> Otras secuencias de rutas también llegan a 15. El número final no cambia.</p>' +
      '</div>' +
      '<div class="widget wide" data-widget="maxflow-steps"></div>' +
      video('BK5OuCEV804', 'Método de flujo máximo · Ford-Fulkerson (Investigación de Operaciones)', '9 min', 'español',
        'Caminos de aumento a mano, cuello de botella y acumulado. Es el estilo del examen.') +
      refs([
        { title: 'Wikipedia · Ford–Fulkerson', url: 'https://es.wikipedia.org/wiki/Algoritmo_de_Ford-Fulkerson', note: 'pseudocódigo.' }
      ]) +
      '<div class="callout callout-exam">Examen 3, 9 puntos. Origen A, destino F. Muestre pasos. Respuesta 15. Corte mínimo {D→F, E→F} = 6+9 = 15.</div>';
  }

  function s3() {
    return '<div class="zero-hero">' +
      '<p><strong>De cero. Teorema max-flow min-cut.</strong> Un corte parte los nodos en dos conjuntos: S (contiene el origen) y T (contiene el destino). La capacidad del corte es la suma de las capacidades de los arcos que salen de S hacia T.</p>' +
      '<p>El flujo máximo es igual a la capacidad del corte más chico. Cuando el algoritmo termina, los nodos aún alcanzables desde s en el residual forman S. Los arcos S→T saturados son el corte mínimo.</p>' +
      '<p>En el examen: D→F (6) y E→F (9) están llenos. No hay otra forma de entrar a F. Corte mínimo = 15 = flujo máximo. Eso prueba que 15 no se puede superar.</p>' +
      '</div>' +
      video('Btqs1f0TfeU', 'Flujo máximo con algoritmo de Ford-Fulkerson (UPV)', '8 min', 'español',
        'Al terminar no queda camino de aumento: ese valor es el corte mínimo.') +
      refs([
        { title: 'Wikipedia · Teorema de flujo máximo y corte mínimo', url: 'https://es.wikipedia.org/wiki/Teorema_de_flujo_m%C3%A1ximo_y_corte_m%C3%ADnimo', note: 'enunciado.' }
      ]);
  }

  function mountSteps(root) {
    var el = root.querySelector('[data-widget="maxflow-steps"]');
    if (!el) return;
    var r = maxFlow('A', 'F');
    var h = '<p><strong>El algoritmo corre solo sobre la red del examen.</strong> Cada clic agrega un camino de aumento.</p>';
    h += '<div class="step-bar">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-mf="prev">◀ Anterior</button>' +
      '<span class="step-text" data-mf="text"></span>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-mf="next">Siguiente ▶</button>' +
      '<button type="button" class="btn btn-sm" data-mf="all">Resolver todo</button>' +
      '</div>';
    h += '<div data-mf="table"></div>';
    el.innerHTML = h;
    var step = 0;
    function render() {
      var rows = r.steps.slice(0, step);
      var tab = '<div class="table-scroll"><table class="data"><thead><tr><th>Paso</th><th>Ruta</th><th>Flujo</th><th>Acumulado</th></tr></thead><tbody>';
      rows.forEach(function (s, i) {
        tab += '<tr><td>' + (i + 1) + '</td><td>' + s.path.join(' → ') + '</td><td>' + s.flow + '</td><td>' + s.acc + '</td></tr>';
      });
      tab += '</tbody></table></div>';
      el.querySelector('[data-mf="table"]').innerHTML = tab;
      var txt = el.querySelector('[data-mf="text"]');
      if (step === 0) txt.textContent = 'Flujo = 0. Busque un camino de A a F con capacidad libre.';
      else if (step < r.steps.length) txt.textContent = 'Acumulado ' + r.steps[step - 1].acc + '. Todavía hay camino.';
      else txt.textContent = 'No queda camino. Flujo máximo = ' + r.value + '.';
    }
    el.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var k = t.getAttribute('data-mf');
      if (k === 'next') step = Math.min(r.steps.length, step + 1);
      if (k === 'prev') step = Math.max(0, step - 1);
      if (k === 'all') step = r.steps.length;
      render();
    });
    render();
  }

  IO.registerChapter({
    id: 'redes',
    num: 9,
    title: 'Redes: flujo máximo',
    summary: 'Unidad IV (además de transporte). Ford–Fulkerson a mano, como en el examen: rutas de aumento y corte mínimo.',
    css: '#redes .table-scroll{overflow-x:auto}',
    sections: [
      { id: 'redes-s1', title: 'Qué es una red de flujo', html: s1() },
      { id: 'redes-s2', title: 'Ford–Fulkerson paso a paso', html: s2() },
      { id: 'redes-s3', title: 'Corte mínimo = flujo máximo', html: s3() }
    ],
    mount: function (root) {
      mountSteps(root);
    },
    quiz: [
      { q: 'El objetivo de un modelo de flujo máximo es:', options: ['minimizar el costo por unidad', 'maximizar el flujo del origen al destino', 'minimizar el número de aristas', 'generar ciclos'], answer: 1, explain: 'Igual que la pregunta 5 del examen 3.' },
      { q: 'Cuando hay capacidades en los arcos se habla de:', options: ['redes no dirigidas', 'redes con congestión', 'redes de flujo máximo', 'redes conectadas'], answer: 2, explain: 'Pregunta 6 del examen 3.' },
      { q: 'En la red del examen (A→F) el flujo máximo vale:', type: 'number', answer: 15, tol: 0.1, explain: 'D→F 6 + E→F 9 = 15, y se alcanza con 4 rutas de aumento.' },
      { q: 'Un camino de aumento es:', options: ['cualquier ciclo', 'un camino de s a t con capacidad residual > 0 en cada arco', 'el arco más caro', 'un corte'], answer: 1, explain: 'Ford–Fulkerson busca esos caminos hasta que no quedan.' },
      { q: 'El cuello de botella de una ruta es:', options: ['la suma de capacidades', 'el mínimo residual de sus arcos', 'el número de nodos', 'el costo'], answer: 1, explain: 'Ese mínimo es lo que se puede sumar al flujo en ese paso.' },
      { q: 'Si D→F y E→F están saturados, un corte mínimo es:', options: ['A→B y A→C', 'D→F y E→F', 'B→E', 'C→D'], answer: 1, explain: 'Son los únicos arcos que entran a F. Capacidad 6+9=15.' },
      { q: 'El teorema max-flow min-cut dice que:', options: ['el flujo máximo es menor que todo corte', 'flujo máximo = capacidad del corte mínimo', 'todo corte vale 0', 'hay que minimizar el flujo'], answer: 1, explain: 'Por eso 15 es óptimo: hay un corte de 15.' },
      { q: 'A diferencia del transporte, el flujo máximo:', options: ['minimiza costos', 'ignora costos y mira capacidades', 'exige oferta = demanda', 'usa el método húngaro'], answer: 1, explain: 'Transporte = costos. Flujo máximo = capacidades.' },
      { q: 'Si un arco tiene flujo 4 y capacidad 7, su residual hacia adelante es:', type: 'number', answer: 3, tol: 0.1, explain: '7 − 4 = 3. Hacia atrás queda residual 4 (se puede deshacer).' },
      { q: 'Ford–Fulkerson termina cuando:', options: ['se recorren 10 iteraciones', 'no queda camino de s a t en el residual', 'todos los costos son 0', 'el grafo es no dirigido'], answer: 1, explain: 'Esa es la condición de parada. El flujo alcanzado es máximo.' }
    ]
  });

  IO.__redes = { maxFlow: maxFlow, findPath: findPath, ARCS: ARCS };
})(typeof window !== 'undefined' ? window : globalThis);
