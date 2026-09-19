/* Algoritmos evolutivos — ítem teórico de todos los exámenes 2025.
 * No está en Taha cap. 1–5; el profesor lo toma igual. */
(function (global) {
  'use strict';
  var IO = global.IO = global.IO || { chapters: [] };
  IO.registerChapter = IO.registerChapter || function (ch) { IO.chapters.push(ch); };

  function video(id, title, dur, lang, why) {
    return IO.Teach ? IO.Teach.videoCard({ id: id, title: title, dur: dur, lang: lang, why: why }) : '';
  }
  function refs(list) { return IO.Teach ? IO.Teach.refsHtml(list) : ''; }
  function viz(name, cap) { return IO.Teach ? IO.Teach.vizHtml(name, cap) : '<div data-viz3d="' + name + '"></div>'; }

  /* Tiny GA on f(x)=sin(x)*sin(0.4x)+1.2 over [0, 10], x encoded as real. */
  function fitness(x) {
    return Math.sin(x) * Math.sin(0.4 * x) + 1.2;
  }
  function runGA(opts) {
    var pop = opts.pop || 12;
    var gens = opts.gens || 8;
    var seed = opts.seed || 1;
    function rnd() {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    }
    var people = [];
    var i, g, hist = [];
    for (i = 0; i < pop; i++) people.push(rnd() * 10);
    for (g = 0; g < gens; g++) {
      people.sort(function (a, b) { return fitness(b) - fitness(a); });
      hist.push({
        best: people[0],
        bestF: fitness(people[0]),
        mean: people.reduce(function (s, x) { return s + fitness(x); }, 0) / pop
      });
      var next = people.slice(0, 2); /* elitismo: los 2 mejores */
      while (next.length < pop) {
        var p1 = people[Math.floor(rnd() * 4)];
        var p2 = people[Math.floor(rnd() * 4)];
        var child = (p1 + p2) / 2 + (rnd() - 0.5) * 0.8; /* cruce + mutación */
        if (child < 0) child = 0;
        if (child > 10) child = 10;
        next.push(child);
      }
      people = next;
    }
    people.sort(function (a, b) { return fitness(b) - fitness(a); });
    return { hist: hist, best: people[0], bestF: fitness(people[0]) };
  }

  function s1() {
    return '<div class="zero-hero">' +
      '<p><strong>De cero.</strong> Un algoritmo evolutivo es una <strong>heurística</strong> inspirada en la selección natural. No garantiza el óptimo. Trabaja con una <strong>población</strong> de soluciones (no con una sola).</p>' +
      '<p>Cada solución se llama individuo o cromosoma. Una <strong>función de aptitud (fitness)</strong> le pone un número: qué tan buena es. Los más aptos tienen más chance de ser padres. Los operadores son:</p>' +
      '<ul class="teach-steps">' +
      '<li><strong>Selección:</strong> elige padres según el fitness.</li>' +
      '<li><strong>Cruce (crossover):</strong> mezcla partes de dos padres y crea hijos.</li>' +
      '<li><strong>Mutación:</strong> cambia un gen al azar. Introduce diversidad. Evita que todos se copien y se estanquen.</li>' +
      '</ul>' +
      '<p>Se repite generación tras generación. Criterios de paro: un número máximo de generaciones, o varias generaciones seguidas sin mejorar el mejor fitness.</p>' +
      '<p>Ejemplos que el examen acepta: <strong>algoritmo genético</strong> y <strong>evolución diferencial</strong> (también programación genética, estrategias evolutivas).</p>' +
      '</div>' +
      viz('ga-landscape', 'Población subiendo un paisaje de aptitud') +
      video('Bhme3i8jHpU', '¿Qué es un algoritmo genético? (MindMachineTV)', '4 min', 'español',
        'Población, fitness, cruce y mutación. Es exactamente el vocabulario del examen.') +
      refs([
        { title: 'Wikipedia · Algoritmo genético', url: 'https://es.wikipedia.org/wiki/Algoritmo_gen%C3%A9tico', note: 'operadores y esquema general.' },
        { title: 'Wikipedia · Computación evolutiva', url: 'https://es.wikipedia.org/wiki/Computaci%C3%B3n_evolutiva', note: 'familia: AG, estrategias evolutivas, programación genética.' }
      ]) +
      '<div class="callout callout-exam">Examen 2 ítem 2 (3 P.) y examen 3 preguntas 7 a 12. Memorice: inspiración = selección natural; fitness = elegir mejores; mutación = diversidad; cruce = combina dos; paro = generaciones sin mejora; diversidad evita convergencia prematura.</div>';
  }

  function s2() {
    return '<div class="zero-hero">' +
      '<p><strong>De cero. Un ciclo de algoritmo genético</strong>, el que hay que poder contar en 4 renglones:</p>' +
      '<ol class="teach-steps">' +
      '<li>Genere al azar N soluciones (población inicial).</li>' +
      '<li>Evalúe el fitness de cada una.</li>' +
      '<li>Seleccione padres (ruleta, torneo, o los k mejores).</li>' +
      '<li>Cruce pares de padres → hijos. Mute algunos genes con probabilidad baja.</li>' +
      '<li>Reemplace la población. Vuelva a 2 hasta el criterio de paro.</li>' +
      '</ol>' +
      '<p>Abajo corre un AG mínimo sobre una función de una variable. No es el examen (el examen es teórico), pero sirve para ver que el mejor fitness sube y que la población se junta cerca de un pico.</p>' +
      '</div>' +
      '<div class="widget wide" data-widget="ga-mini"></div>' +
      video('RBrXGyo0kIw', 'Algoritmos genéticos en 5 minutos', '5 min', 'español',
        'Selección, cruce, mutación y reemplazo. Con eso alcanza para las 6 preguntas de opción múltiple.') +
      refs([
        { title: 'Wikipedia · Operadores genéticos', url: 'https://es.wikipedia.org/wiki/Operador_gen%C3%A9tico', note: 'cruce de un punto, mutación de bit.' }
      ]);
  }

  function s3() {
    return '<div class="zero-hero">' +
      '<p><strong>De cero. Exacto vs heurístico, otra vez, porque vale 5 puntos.</strong></p>' +
      '<div class="table-scroll"><table class="data"><thead><tr><th></th><th>Exacto</th><th>Heurístico / evolutivo</th></tr></thead><tbody>' +
      '<tr><td>Promesa</td><td>óptimo global</td><td>solución buena, no garantizada</td></tr>' +
      '<tr><td>Tiempo</td><td>puede explotar con el tamaño</td><td>controlable (N, generaciones)</td></tr>' +
      '<tr><td>Ejemplos</td><td>simplex, gráfico, Ford–Fulkerson, ramificación y acotamiento</td><td>genético, evolución diferencial, tabú, recocido simulado</td></tr>' +
      '<tr><td>Cuándo</td><td>PL chico o mediano, redes, PEB de 5 variables</td><td>viajante con muchas ciudades, horarios, diseños enormes</td></tr>' +
      '</tbody></table></div>' +
      '<p>El profesor tachó “método de transporte” como técnica general de PL. Transporte es un PL especial, no una familia de métodos. Las dos familias generales son exactos y heurísticos.</p>' +
      '</div>' +
      video('VCN3CqCO2KQ', 'Algoritmos genéticos (UPV)', '10 min', 'español',
        'Heurística vs óptimo: no garantiza la mejor solución. Usa el problema de la mochila, el mismo de PEB.') +
      refs([
        { title: 'Wikipedia · Heurística', url: 'https://es.wikipedia.org/wiki/Heur%C3%ADstica_(inform%C3%A1tica)', note: 'definición de método aproximado.' }
      ]) +
      '<div class="callout callout-exam">Respuesta modelo (5 P.): “Los métodos exactos garantizan el óptimo (simplex). Los heurísticos dan una solución buena en menos tiempo, sin garantía (algoritmo genético). Exacto se usa en un PL de producción; heurístico en un viajante con 200 ciudades.”</div>';
  }

  function mountGA(root) {
    var el = root.querySelector('[data-widget="ga-mini"]');
    if (!el) return;
    var r = runGA({ pop: 14, gens: 10, seed: 3 });
    var h = '<p>Fitness f(x) = sen(x)·sen(0,4x)+1,2 en [0, 10]. Población 14, 10 generaciones, elitismo 2, cruce promedio + mutación chica.</p>';
    h += '<div class="table-scroll"><table class="data"><thead><tr><th>Generación</th><th>Mejor x</th><th>Mejor fitness</th><th>Fitness medio</th></tr></thead><tbody>';
    r.hist.forEach(function (row, i) {
      h += '<tr><td>' + i + '</td><td>' + row.best.toFixed(2) + '</td><td>' + row.bestF.toFixed(3) + '</td><td>' + row.mean.toFixed(3) + '</td></tr>';
    });
    h += '</tbody></table></div>';
    h += '<p>El mejor fitness de la generación 0 era ' + r.hist[0].bestF.toFixed(3) +
      '. Al final es ' + r.bestF.toFixed(3) + ' en x ≈ ' + r.best.toFixed(2) +
      '. Subió. Eso es “evolución”: no se demostró optimalidad; se mejoró una población.</p>';
    el.innerHTML = h;
  }

  IO.registerChapter({
    id: 'evolutivos',
    num: 10,
    title: 'Algoritmos evolutivos',
    summary: 'Ítem teórico de los exámenes 2025: exactos vs heurísticos, genéticos, fitness, cruce, mutación, diversidad y paro.',
    css: '',
    sections: [
      { id: 'evo-s1', title: 'Qué es un algoritmo evolutivo', html: s1() },
      { id: 'evo-s2', title: 'Un ciclo: selección, cruce, mutación', html: s2() },
      { id: 'evo-s3', title: 'Exactos vs heurísticos (5 puntos)', html: s3() }
    ],
    mount: function (root) {
      mountGA(root);
    },
    quiz: [
      { q: 'Los algoritmos evolutivos se inspiran en:', options: ['redes de flujo', 'sistemas neuronales', 'la selección natural', 'la física cuántica'], answer: 2, explain: 'Pregunta 7 del examen 3.' },
      { q: 'La función de aptitud (fitness) sirve para:', options: ['seleccionar mejores soluciones', 'dividir la población en grupos', 'fijar la mutación', 'armar el cromosoma'], answer: 0, explain: 'Pregunta 8 del examen 3.' },
      { q: 'La mutación se hace para:', options: ['acortar el cromosoma', 'introducir variabilidad genética', 'forzar convergencia', 'borrar peores'], answer: 1, explain: 'Pregunta 9. Sin mutación la población se copia y se estanca.' },
      { q: 'El operador que combina dos soluciones candidatas es:', options: ['selección', 'mutación', 'cruce', 'replicación'], answer: 2, explain: 'Pregunta 10. Cruce = crossover.' },
      { q: 'Un criterio de paro típico es:', options: ['el número de mutaciones', 'generaciones seguidas sin mejora', 'el número de nodos', 'un cruce exitoso'], answer: 1, explain: 'Pregunta 11.' },
      { q: 'La diversidad en la población importa porque:', options: ['evita la convergencia prematura', 'aumenta el tamaño de la población', 'hace inútil al cruce', 'simplifica el fitness'], answer: 0, explain: 'Pregunta 12.' },
      { q: 'Dos ejemplos de algoritmos evolutivos son:', options: ['simplex y dual', 'genético y evolución diferencial', 'noroeste y Vogel', 'Ford–Fulkerson y húngaro'], answer: 1, explain: 'Ítem 2 del examen 2.' },
      { q: 'Un método exacto se caracteriza porque:', options: ['es siempre más rápido', 'garantiza el óptimo global', 'nunca usa restricciones', 'solo sirve para redes'], answer: 1, explain: 'Ítem 1 de los exámenes 2 y 4.' },
      { q: 'Un ejemplo válido de método exacto es:', options: ['algoritmo genético', 'búsqueda tabú', 'simplex', 'recocido simulado'], answer: 2, explain: 'Simplex, gráfico, ramificación y acotamiento, Ford–Fulkerson.' },
      { q: 'Un ejemplo válido de heurística es:', options: ['método gráfico', 'algoritmo genético', 'simplex dual', 'flujo máximo'], answer: 1, explain: 'Genético, tabú, recocido, vecino más cercano.' }
    ]
  });

  IO.__evolutivos = { fitness: fitness, runGA: runGA };
})(typeof window !== 'undefined' ? window : globalThis);
