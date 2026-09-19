/* Exámenes anteriores — ítems de cada examen (fotos en ../examenes IO) con su respuesta.
 * Owner: this file + tests/examenes.test.js. Depends only on the window.IO contract (SPEC.md §2).
 * Content is static HTML; the numeric answers are re-checked in tests/examenes.test.js using the
 * data exported through IO.__examenes (no DOM needed).
 */
(function () {
  'use strict';
  window.IO = window.IO || { chapters: [] };
  IO.registerChapter = IO.registerChapter || function (ch) { IO.chapters.push(ch); };

  /* ---------------------------------------------------------------------------
   * Datos numéricos usados para verificar las respuestas (tests).
   * ------------------------------------------------------------------------- */
  var DATA = {
    lumbreras: { c: [7, 10], A: [[4, 5], [6, 3]], b: [200, 240], opt: { x: [0, 40], z: 400 } },
    grafico2025: { c: [3, 2], A: [[2, 1], [2, 3], [3, 1]], b: [18, 42, 24], opt: { x: [3, 12], z: 33 } },
    reallyBigShoe: { c: [1, 1], A: [[10, 3], [96, 120]], b: [300, 4000], opt: { x: [500 / 19, 700 / 57], z: 2200 / 57 }, intOpt: { x: [26, 12], z: 38 } },
    transporteAB: {
      cost: [[1, 2, 4], [3, 2, 1]], supply: [5, 10], demand: [8, 5, 2],
      opt: { alloc: [[5, 0, 0], [3, 5, 2]], z: 26 }
    },
    transporteC: {
      cost: [[2, 4, 5], [3, 1, 2]], supply: [6, 9], demand: [5, 6, 4],
      opt: { alloc: [[5, 0, 1], [0, 6, 3]], z: 27 }
    },
    energia: {
      /* filas: planta 1, 2, 3 y la red externa; columnas: ciudad 1, 2, 3. null = arco inexistente. */
      cost: [[600, 700, 400], [320, 300, 350], [500, 480, 450], [1000, 1000, null]],
      supply: [25, 40, 30, 13], demand: [36, 42, 30],
      minCost: { alloc: [[0, 0, 25], [0, 40, 0], [23, 2, 5], [13, 0, 0]], z: 49710 }
    },
    peb: {
      gain: [1, 1.8, 1.6, 0.8, 1.4], capital: [6, 12, 10, 4, 8], budget: 20,
      opt: { x: [1, 0, 1, 1, 0], z: 3.4 }
    },
    flujo: {
      arcs: [['A', 'B', 9], ['A', 'C', 7], ['B', 'D', 7], ['B', 'E', 2], ['C', 'D', 4], ['C', 'E', 6], ['D', 'E', 3], ['D', 'F', 6], ['E', 'F', 9]],
      source: 'A', sink: 'F', max: 15
    },
    pizarra: {
      cost: [[14, 10, 8, 10, 12], [20, 5, 9, 17, 18], [15, 16, 8, 6, 10], [9, 10, 20, 8, 18]],
      supply: [250, 250, 250, 250], demand: [300, 175, 325, 130, 70],
      noroeste: { alloc: [[250, 0, 0, 0, 0], [50, 175, 25, 0, 0], [0, 0, 250, 0, 0], [0, 0, 50, 130, 70]], z: 10900 },
      costoMinimo: { alloc: [[0, 0, 250, 0, 0], [50, 175, 0, 0, 25], [0, 0, 75, 130, 45], [250, 0, 0, 0, 0]], z: 8405 },
      optimo: { alloc: [[50, 0, 200, 0, 0], [0, 175, 75, 0, 0], [0, 0, 50, 130, 70], [250, 0, 0, 0, 0]], z: 7980 }
    }
  };

  /* ---------------------------------------------------------------------------
   * Helpers de HTML
   * ------------------------------------------------------------------------- */
  function table(head, rows) {
    var h = '<div class="table-scroll"><table class="data"><thead><tr>';
    head.forEach(function (c) { h += '<th>' + c + '</th>'; });
    h += '</tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr>';
      r.forEach(function (c) { h += '<td>' + c + '</td>'; });
      h += '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  /* Un ítem: número, puntos, enunciado y respuesta plegable. */
  function item(num, pts, enunciado, respuesta, nota) {
    return '<div class="ex-item">' +
      '<p class="ex-q"><strong>' + num + '</strong>' + (pts ? ' <span class="badge">' + pts + '</span>' : '') + ' ' + enunciado + '</p>' +
      '<details class="solution ex-ans"><summary>Ver respuesta</summary><div class="ex-ans-body">' + respuesta +
      (nota ? '<p class="callout callout-warn">' + nota + '</p>' : '') +
      '</div></details></div>';
  }

  function fuente(archivos, extra) {
    return '<p class="muted ex-src">Fotos: ' + archivos.map(function (a) { return '<code>' + a + '</code>'; }).join(', ') +
      (extra ? '. ' + extra : '') + '</p>';
  }

  function mc(num, q, opts, correct, why) {
    var letters = ['a', 'b', 'c', 'd'];
    var list = '<ol type="a" class="ex-opts">' + opts.map(function (o) { return '<li>' + o + '</li>'; }).join('') + '</ol>';
    return item(num + '.', null, q + list,
      '<p><strong>' + letters[correct] + ') ' + opts[correct] + '</strong></p><p>' + why + '</p>');
  }

  /* ---------------------------------------------------------------------------
   * Examen 1 — Primer Examen Parcial (18/09/2025)
   * ------------------------------------------------------------------------- */
  function buildEx1() {
    var h = '<p><strong>Universidad Nacional de Itapúa · Electiva I · Prof. Ing. Néstor F. Tapia.</strong> Primer Examen Parcial, fecha 18/09/2025, total 29 puntos. La hoja fotografiada es de un alumno que sacó 25 puntos; abajo se indica dónde se equivocó.</p>' +
      fuente(['eb39e715….JPG (enunciado)', 'e6a5cebe….JPG y d3146b7c….JPG (resolución del alumno)']);

    h += '<h3>1) Responda los conceptos (5 P.)</h3>';
    h += item('a.', '1 P.', '¿Cuál es la diferencia entre un modelo determinístico y uno estocástico?',
      '<p><strong>Determinístico:</strong> todos los datos (parámetros) se conocen con certeza. Con los mismos datos siempre da el mismo resultado. Ejemplo: un modelo de programación lineal.</p>' +
      '<p><strong>Estocástico (probabilístico):</strong> al menos un dato es aleatorio y se describe con una distribución de probabilidad. El resultado es un valor esperado o una probabilidad. Ejemplo: líneas de espera o inventario con demanda aleatoria.</p>',
      'El alumno lo confundió con «resolver todos los casos» contra «aproximación». Eso es la diferencia entre métodos exactos y heurísticos, no entre modelos determinísticos y estocásticos.');
    h += item('b.', '1 P.', '¿Por qué se utilizan modelos matemáticos en un problema de optimización?',
      '<p>Porque representan el sistema real de forma simplificada y cuantitativa (variables, función objetivo y restricciones). Así se pueden evaluar muchas alternativas sin experimentar con el sistema real y encontrar, con un algoritmo, la mejor decisión.</p>');
    h += item('c.', '1 P.', 'Soluciones factibles.',
      '<p>Son las soluciones que cumplen <strong>todas</strong> las restricciones, incluida la no negatividad. Forman la región factible.</p>');
    h += item('d.', '1 P.', 'Solución óptima.',
      '<p>Es la solución factible que da el mejor valor de la función objetivo: el mayor valor si se maximiza, el menor si se minimiza. En PL siempre está en un vértice de la región factible (si existe).</p>');
    h += item('e.', '1 P.', 'Solución no factible.',
      '<p>Es una solución que viola al menos una restricción. Queda fuera de la región factible.</p>');

    h += '<h3>2) Problema de programación lineal (24 P.)</h3>';
    h += '<p class="ex-q">La editorial Lumbreras produce dos libros de Matemática: álgebra y geometría. La utilidad por unidad es de $7 para el libro de álgebra y de $10 para el de geometría. El libro de álgebra requiere 4 horas de impresión y 6 de encuadernación. El de geometría requiere 5 horas de impresión y 3 de encuadernación. Se dispone de 200 horas para imprimir y 240 horas para encuadernar.</p>';
    h += item('a)', '1 P.', 'Mencione tres técnicas para resolver un problema de programación lineal.',
      '<ul><li>Método gráfico (solo con 2 variables).</li><li>Método simplex (y sus variantes: M grande, dos fases, simplex dual).</li><li>Software: Solver de Excel, TORA, LINDO.</li></ul>',
      'El alumno puso «método de transporte». Eso no es una técnica general de PL; el profesor lo tachó y anotó «método gráfico».');
    h += item('b)', '2 P.', 'Elabore la tabla característica del modelo.',
      table(['Recurso', 'Álgebra (x)', 'Geometría (y)', 'Disponible'], [
        ['Impresión', '4 h', '5 h', '200 h'], ['Encuadernación', '6 h', '3 h', '240 h'], ['Utilidad por unidad', '$7', '$10', '—']
      ]));
    h += item('c)', '4 P.', 'Formule el modelo de programación lineal.',
      '<p>x = libros de álgebra, y = libros de geometría.</p>' +
      '<pre>Max Z = 7x + 10y\ns.a.  4x + 5y ≤ 200   (impresión)\n      6x + 3y ≤ 240   (encuadernación)\n      x, y ≥ 0</pre>');
    h += item('d)', '4 P.', 'Elabore el método gráfico.',
      '<p>Cortes con los ejes:</p>' +
      table(['Recta', 'x = 0', 'y = 0'], [['4x + 5y = 200', '(0, 40)', '(50, 0)'], ['6x + 3y = 240', '(0, 80)', '(40, 0)']]) +
      '<p>Cruce de las dos rectas: de la primera, x = (200 − 5y)/4. Se reemplaza en la segunda: 6(200 − 5y)/4 + 3y = 240, entonces 300 − 7,5y + 3y = 240, y = 40/3 ≈ 13,33 y x = 100/3 ≈ 33,33.</p>' +
      '<p>La región factible queda debajo de las dos rectas y en el primer cuadrante.</p>');
    h += item('e)', '2 P.', 'Indique la región factible y las soluciones factibles en los vértices.',
      '<p>Vértices de la región factible: (0, 0), (40, 0), (33,33; 13,33) y (0, 40).</p>',
      'El alumno marcó B = (40, 80) y C = (50, 40). Esos puntos no son vértices: son cortes de las rectas con los ejes mezclados. El vértice (0, 40) lo tachó, y justo ese es el óptimo.');
    h += item('f)', '3 P.', 'Encuentre la máxima ganancia y el valor de cada variable de decisión.',
      table(['Vértice', 'Z = 7x + 10y'], [['(0, 0)', '0'], ['(40, 0)', '280'], ['(33,33; 13,33)', '366,67'], ['<strong>(0, 40)</strong>', '<strong>400 (máximo)</strong>']]) +
      '<p><strong>Óptimo: x = 0 libros de álgebra, y = 40 libros de geometría, Z = $400.</strong></p>',
      'El alumno dio x = 33,3, y = 13,3, Z = 366,1. Es incorrecto (el profesor le bajó puntos acá): no evaluó el vértice (0, 40).');
    h += item('g)', '2 P.', 'Verifique el valor exacto de su solución óptima con la solución algebraica de las ecuaciones.',
      '<p>En (0, 40) está activa solo la restricción de impresión: 4(0) + 5(40) = 200 ✓. Encuadernación: 6(0) + 3(40) = 120 ≤ 240, sobran 120 h.</p>' +
      '<p>Z = 7(0) + 10(40) = 400. El cruce de las dos rectas (100/3, 40/3) da Z = 700/3 + 400/3 = 1100/3 ≈ 366,67, que es menor.</p>' +
      '<p>Control por pendientes: la recta de Z tiene pendiente −7/10 = −0,7 y la de impresión −4/5 = −0,8. Z es más «plana», por eso el óptimo cae en el corte de la recta de impresión con el eje y.</p>',
      'El alumno calculó Z = 7(40) + 10(80) = 1080 y Z = 7(50) + 10(40) = 750 con puntos que no son factibles. Por eso le marcaron el inciso con una X.');
    h += item('h)', '4 P.', 'Presente el modelo dual del problema.',
      '<pre>Min W = 200y1 + 240y2\ns.a.  4y1 + 6y2 ≥ 7\n      5y1 + 3y2 ≥ 10\n      y1, y2 ≥ 0</pre>' +
      '<p>Solución dual: y1 = 2, y2 = 0, W = 400 = Z (se cumple la dualidad fuerte). y1 = 2 es el precio sombra de una hora de impresión; y2 = 0 porque sobran horas de encuadernación.</p>');
    h += item('i)', '2 P.', 'Explique y dé un ejemplo sobre el concepto de análisis post-óptimo.',
      '<p>El análisis post-óptimo (de sensibilidad) estudia cómo cambia la solución óptima cuando cambian los datos (coeficientes de la función objetivo, lados derechos, nuevas restricciones o variables), sin resolver todo de nuevo.</p>' +
      '<p><strong>Ejemplo 1 (lado derecho):</strong> si las horas de impresión suben de 200 a 210, Z sube 10 × y1 = 10 × 2 = $20, entonces Z = 420 (y = 42). Vale mientras la encuadernación alcance: 3y ≤ 240, o sea hasta 400 horas de impresión.</p>' +
      '<p><strong>Ejemplo 2 (función objetivo):</strong> la solución (0, 40) sigue óptima mientras la utilidad del libro de álgebra sea ≤ $8 (c1/10 ≤ 4/5).</p>');
    return h;
  }

  /* ---------------------------------------------------------------------------
   * Examen 2 — Examen 2025 (métodos, algoritmos evolutivos, gráfico, transporte, PEB)
   * ------------------------------------------------------------------------- */
  function buildEx2() {
    var h = '<p><strong>Examen 2025 · Prof. Ing. Néstor F. Tapia.</strong> La foto no muestra la fecha. Contenido: métodos de optimización, algoritmos evolutivos, método gráfico, transporte y programación entera binaria.</p>' +
      fuente(['26ee14c8….JPG (ítems 1 a 3)', '329019fe….JPG (ítems 4 y 5)'], 'Son las dos caras de la misma hoja: en cada foto se ve por transparencia el texto de la otra cara');

    h += item('1)', '3 P. + 2 P.', 'Mencione e indique la diferencia de los dos métodos generales para resolver un problema de optimización. Cite al menos un ejemplo para cada método.',
      '<p><strong>Métodos exactos:</strong> garantizan encontrar el óptimo global, pero pueden tardar mucho en problemas grandes. Ejemplos: simplex, ramificación y acotamiento, programación dinámica.</p>' +
      '<p><strong>Métodos heurísticos (aproximados):</strong> encuentran una solución buena en poco tiempo, pero no garantizan que sea la óptima. Ejemplos: algoritmos genéticos, búsqueda tabú, recocido simulado, vecino más cercano.</p>');
    h += item('2)', '1 P. + 2 P.', 'Explique brevemente qué son los algoritmos evolutivos. Cite dos algoritmos de ejemplo.',
      '<p>Son métodos heurísticos (metaheurísticas) inspirados en la evolución natural y la selección natural. Trabajan con una población de soluciones. En cada generación, la función de aptitud (fitness) evalúa las soluciones y se aplican selección, cruce y mutación para crear soluciones mejores.</p>' +
      '<p>Ejemplos: algoritmo genético y evolución diferencial (también: programación genética, estrategias evolutivas).</p>');

    h += '<h3>3) Modelo de PL (11 P.)</h3>';
    h += '<pre class="ex-q">Max Z = 3x + 2y\ns.a.  2x +  y ≤ 18\n      2x + 3y ≤ 42\n      3x +  y ≤ 24\n      x, y ≥ 0</pre>';
    h += item('a)', '4 P.', 'Realice la solución gráfica del modelo.',
      table(['Recta', 'x = 0', 'y = 0'], [['2x + y = 18', '(0, 18)', '(9, 0)'], ['2x + 3y = 42', '(0, 14)', '(21, 0)'], ['3x + y = 24', '(0, 24)', '(8, 0)']]) +
      '<p>Cruces útiles: 2x + y = 18 con 3x + y = 24 da (6, 6). 2x + y = 18 con 2x + 3y = 42 da (3, 12).</p>');
    h += item('b)', '1 P.', 'Marque en su gráfica la región factible.',
      '<p>Es el polígono con vértices (0, 0), (8, 0), (6, 6), (3, 12) y (0, 14), debajo de las tres rectas y en el primer cuadrante.</p>');
    h += item('c)', '5 P.', 'Indique y calcule Z para cada solución.',
      table(['Vértice', 'Z = 3x + 2y'], [['(0, 0)', '0'], ['(8, 0)', '24'], ['(6, 6)', '30'], ['<strong>(3, 12)</strong>', '<strong>33</strong>'], ['(0, 14)', '28']]));
    h += item('d)', '1 P.', 'Marque el vértice en el cual se encuentra la solución óptima.',
      '<p><strong>Óptimo en (3, 12): x = 3, y = 12, Z = 33.</strong> Ahí se cruzan 2x + y = 18 y 2x + 3y = 42. La tercera restricción queda con holgura: 3(3) + 12 = 21 ≤ 24.</p>');

    h += '<h3>4) Transporte (8 P.)</h3>';
    h += '<p class="ex-q">Un fabricante despacha un artículo a tres tiendas T1, T2 y T3 desde dos almacenes A y B. A dispone de 5 unidades y B de 10. La demanda de las tiendas es 8, 5 y 2. Costos por unidad:</p>' +
      table(['', 'T1', 'T2', 'T3', 'Oferta'], [['A', '1', '2', '4', '5'], ['B', '3', '2', '1', '10'], ['Demanda', '8', '5', '2', '15 = 15']]);
    h += item('a)', '1 P.', 'Represente el grafo que genera el modelo.',
      '<p>Dos nodos de origen (A con 5, B con 10) a la izquierda y tres nodos de destino (T1 con 8, T2 con 5, T3 con 2) a la derecha. Hay un arco de cada almacén a cada tienda (6 arcos), con su costo: A→T1 (1), A→T2 (2), A→T3 (4), B→T1 (3), B→T2 (2), B→T3 (1).</p>');
    h += item('b)', '1 P.', 'Indique las variables de decisión en su grafo.',
      '<p>x<sub>ij</sub> = unidades enviadas del almacén i (A, B) a la tienda j (1, 2, 3). Una variable por arco: x<sub>A1</sub>, x<sub>A2</sub>, x<sub>A3</sub>, x<sub>B1</sub>, x<sub>B2</sub>, x<sub>B3</sub>.</p>');
    h += item('c)', '1 P.', 'Formule la función objetivo.',
      '<pre>Min Z = 1xA1 + 2xA2 + 4xA3 + 3xB1 + 2xB2 + 1xB3</pre>');
    h += item('d)', '5 P.', 'Formule las restricciones.',
      '<pre>Oferta:   xA1 + xA2 + xA3 = 5\n          xB1 + xB2 + xB3 = 10\nDemanda:  xA1 + xB1 = 8\n          xA2 + xB2 = 5\n          xA3 + xB3 = 2\n          xij ≥ 0</pre>' +
      '<p>El modelo está balanceado (15 = 15), por eso van igualdades. También se acepta ≤ en la oferta y ≥ en la demanda.</p>' +
      '<p><strong>Extra (solución óptima):</strong> xA1 = 5, xB1 = 3, xB2 = 5, xB3 = 2, con Z = 5 + 9 + 10 + 2 = <strong>26</strong>.</p>');

    h += '<h3>5) Programación entera binaria (10 P.)</h3>';
    h += '<p class="ex-q">Peterson &amp; Johnson analiza cinco proyectos. Tienen $20 millones y quieren la combinación que maximiza la ganancia (valor presente neto) sin invertir más de $20 millones. Datos en millones de dólares:</p>' +
      table(['Proyecto', '1', '2', '3', '4', '5'], [['Ganancia estimada', '1', '1,8', '1,6', '0,8', '1,4'], ['Capital requerido', '6', '12', '10', '4', '8']]);
    h += item('a)', '4 P.', 'Formule un modelo de PEB para este problema.',
      '<p>x<sub>j</sub> = 1 si se hace el proyecto j, 0 si no (j = 1…5).</p>' +
      '<pre>Max Z = 1x1 + 1,8x2 + 1,6x3 + 0,8x4 + 1,4x5\ns.a.  6x1 + 12x2 + 10x3 + 4x4 + 8x5 ≤ 20\n      xj ∈ {0, 1}</pre>');
    h += item('b)', '2 P.', 'Muestre el modelo en una hoja de cálculo de Excel.',
      '<ul><li>Una fila con las ganancias y otra con el capital de cada proyecto.</li><li>Una fila de celdas cambiantes (x1…x5), al inicio en 0.</li><li>Ganancia total: =SUMAPRODUCTO(ganancias; x).</li><li>Capital usado: =SUMAPRODUCTO(capital; x), al lado del límite 20.</li></ul>');
    h += item('c)', '4 P.', 'Utilice Solver para resolver el modelo.',
      '<p>Solver: objetivo = celda de ganancia total, Máx. Celdas cambiantes = x1…x5. Restricciones: capital usado ≤ 20 y x1…x5 = binario. Método: Simplex LP.</p>' +
      '<p><strong>Resultado: hacer los proyectos 1, 3 y 4 (x = 1, 0, 1, 1, 0). Capital usado $20 millones. Ganancia $3,4 millones.</strong></p>' +
      '<p>Comparación: {2, 5} y {1, 4, 5} dan 3,2; {3, 5} da 3,0; {1, 2} da 2,8.</p>');
    return h;
  }

  /* ---------------------------------------------------------------------------
   * Examen 3 — Opción múltiple + transporte con compra extra + flujo máximo
   * ------------------------------------------------------------------------- */
  var MC = [
    ['¿Cuál es el objetivo principal de un modelo de transporte?', ['Maximizar el número de rutas disponibles', 'Minimizar el costo total de distribución', 'Aumentar el número de proveedores', 'Reducir el número de destinos'], 1, 'El modelo de transporte busca el plan de envíos de menor costo total que cumpla ofertas y demandas.'],
    ['En un modelo de transporte balanceado, la suma de las ofertas es igual a:', ['La capacidad total de cada ruta', 'El costo mínimo de transporte', 'La suma de las demandas', 'El número de orígenes'], 2, 'Balanceado significa oferta total = demanda total.'],
    ['¿Qué método se utiliza habitualmente para obtener una solución inicial factible en el modelo de transporte?', ['Método simplex', 'Método del costo mínimo', 'Método de corte', 'Método de regresión'], 1, 'Los métodos de solución inicial son esquina noroeste, costo mínimo y Vogel. De las opciones, solo está el costo mínimo.'],
    ['Los problemas de transporte son un caso particular de:', ['Programación no lineal', 'Programación cuadrática', 'Programación lineal', 'Programación booleana'], 2, 'Función objetivo y restricciones lineales: es un PL con estructura especial.'],
    ['Un modelo de flujo máximo busca:', ['Minimizar el costo por unidad de flujo', 'Maximizar el flujo desde el origen hasta el destino', 'Minimizar el número de aristas en una red', 'Generar ciclos de flujo'], 1, 'Busca la mayor cantidad de flujo de la fuente al sumidero sin pasar las capacidades de los arcos.'],
    ['Cuando se realiza un análisis de redes con restricciones de capacidad se habla de:', ['Redes no dirigidas', 'Redes con congestión', 'Redes de flujo máximo', 'Redes conectadas'], 2, 'Las capacidades en los arcos son la característica de las redes de flujo máximo.'],
    ['Los algoritmos evolutivos se inspiran en:', ['La teoría de redes de flujo', 'Los sistemas neuronales complejos', 'El proceso de selección natural', 'La física cuántica'], 2, 'Imitan la evolución biológica: selección natural, cruce y mutación.'],
    ['Una función de aptitud (fitness) en un algoritmo genético se utiliza para:', ['Seleccionar mejores soluciones', 'Dividir la población en grupos', 'Determinar la probabilidad de mutación', 'Establecer la estructura de los cromosomas'], 0, 'El fitness mide qué tan buena es cada solución; con ese valor se eligen los padres.'],
    ['En los algoritmos genéticos, la mutación se realiza con el objetivo de:', ['Reducir el tamaño del cromosoma', 'Introducir variabilidad genética', 'Incrementar la convergencia de soluciones', 'Eliminar soluciones no aptas'], 1, 'La mutación cambia genes al azar para explorar nuevas zonas y mantener la diversidad.'],
    ['¿Qué operador combina dos soluciones candidatas para generar nuevas?', ['Selección', 'Mutación', 'Cruce', 'Replicación'], 2, 'El cruce (crossover) mezcla partes de dos padres para formar hijos.'],
    ['Un criterio de paro en un algoritmo evolutivo podría basarse en:', ['El número de mutaciones realizadas', 'La cantidad de generaciones sin mejora', 'La cantidad de nodos en la red', 'La ocurrencia de un cruce exitoso'], 1, 'Criterios típicos: número máximo de generaciones, o varias generaciones seguidas sin mejorar el mejor fitness.'],
    ['La diversidad en la población de un algoritmo evolutivo es importante porque:', ['Evita la convergencia prematura', 'Aumenta el tamaño de la población', 'Reduce la necesidad de operadores genéticos', 'Facilita el cálculo del fitness'], 0, 'Sin diversidad, la población se estanca en un óptimo local (convergencia prematura).']
  ];

  function buildEx3() {
    var h = '<p><strong>Examen de la Electiva I · UNI · Prof. Ing. Néstor F. Tapia.</strong> Las fotos no muestran la fecha. Contenido: opción múltiple (transporte, redes y algoritmos evolutivos), transporte con compra adicional y flujo máximo. Las 12 preguntas de opción múltiple también están en la autoevaluación de abajo.</p>' +
      fuente(['6e166f4f….JPG (preguntas 1 a 6)', 'da80f31a….JPG (preguntas 7 a 12)', '9cb628f8….JPG (ítems 2 y 3)']);

    h += '<h3>1) Marque con un círculo la respuesta correcta (12 P.)</h3>';
    MC.forEach(function (m, i) { h += mc(i + 1, m[0], m[1], m[2], m[3]); });

    h += '<h3>2) Plantas de energía (19 P.)</h3>';
    h += '<p class="ex-q">Tres plantas de 25, 40 y 30 millones de kWh abastecen a tres ciudades. Las demandas máximas son 30, 35 y 25 millones de kWh. Precio por millón de kWh:</p>' +
      table(['Planta', 'Ciudad 1', 'Ciudad 2', 'Ciudad 3'], [['1', '$600', '$700', '$400'], ['2', '$320', '$300', '$350'], ['3', '$500', '$480', '$450']]) +
      '<p class="ex-q">En agosto la demanda sube 20% en cada ciudad. El faltante se compra a otra red a $1000 por millón de kWh. Esa red NO está enlazada a la ciudad 3. Se busca el plan más económico de distribución y compra.</p>';
    var dataNote = '<p>Datos de agosto: demandas 30 × 1,2 = 36, 35 × 1,2 = 42 y 25 × 1,2 = 30 (total 108). Las plantas dan 25 + 40 + 30 = 95. Faltan 108 − 95 = 13 millones de kWh, que se compran a la red externa.</p>';
    h += item('1.', '1 P.', 'Elabore el grafo que representa el problema.',
      dataNote +
      '<p>Orígenes: P1 (25), P2 (40), P3 (30) y la red externa R (13). Destinos: C1 (36), C2 (42), C3 (30).</p>' +
      '<p>Arcos: cada planta a cada ciudad (9 arcos, con el precio de la tabla). R→C1 y R→C2 con costo 1000. No hay arco R→C3.</p>');
    h += item('2.a', '1 P.', 'Indique cuáles son las variables de decisión.',
      '<p>x<sub>ij</sub> = millones de kWh que la planta i (1, 2, 3) envía a la ciudad j (1, 2, 3).</p><p>x<sub>4j</sub> = millones de kWh comprados a la red para la ciudad j (j = 1, 2).</p>');
    h += item('2.b', '2 P.', 'Elabore la fórmula general de la función objetivo.',
      '<pre>Min Z = Σ Σ cij·xij\n      = 600x11 + 700x12 + 400x13\n      + 320x21 + 300x22 + 350x23\n      + 500x31 + 480x32 + 450x33\n      + 1000x41 + 1000x42</pre>');
    h += item('2.c', '3 P.', 'Elabore las restricciones de ofertas.',
      '<pre>x11 + x12 + x13 ≤ 25   (planta 1)\nx21 + x22 + x23 ≤ 40   (planta 2)\nx31 + x32 + x33 ≤ 30   (planta 3)\nx41 + x42       ≤ 13   (red externa)</pre>' +
      '<p>Como 95 + 13 = 108, todas se cumplen con igualdad en la solución.</p>');
    h += item('2.d', '3 P.', 'Elabore las restricciones de demandas.',
      '<pre>x11 + x21 + x31 + x41 = 36   (ciudad 1)\nx12 + x22 + x32 + x42 = 42   (ciudad 2)\nx13 + x23 + x33       = 30   (ciudad 3)\nxij ≥ 0</pre>');
    h += item('2.e', '1 P.', 'Elabore la restricción para el caso de la ciudad 3.',
      '<pre>x43 = 0</pre><p>En la tabla de transporte se pone un costo muy grande (M) en la celda red→ciudad 3 para que nunca se use.</p>');
    h += item('3.', '3 P.', 'Utilice el método del costo mínimo para obtener el costo total de los envíos.',
      '<p>Se llena primero la celda más barata disponible y se tacha la fila o columna que se agota:</p>' +
      '<ol><li>P2→C2 ($300): 40. Se agota P2; a C2 le faltan 2.</li><li>P1→C3 ($400): 25. Se agota P1; a C3 le faltan 5.</li><li>P3→C3 ($450): 5. Se completa C3; a P3 le quedan 25.</li><li>P3→C2 ($480): 2. Se completa C2; a P3 le quedan 23.</li><li>P3→C1 ($500): 23. Se agota P3; a C1 le faltan 13.</li><li>R→C1 ($1000): 13. Todo asignado.</li></ol>' +
      table(['', 'C1', 'C2', 'C3', 'Oferta'], [['P1', '—', '—', '25', '25'], ['P2', '—', '40', '—', '40'], ['P3', '23', '2', '5', '30'], ['Red', '13', '—', 'M', '13'], ['Demanda', '36', '42', '30', '108']]) +
      '<p>Costo = 40(300) + 25(400) + 5(450) + 2(480) + 23(500) + 13(1000) = 12 000 + 10 000 + 2 250 + 960 + 11 500 + 13 000 = <strong>$49 710</strong>.</p>' +
      '<p>Hay 6 celdas básicas = m + n − 1 = 4 + 3 − 1. Con el método MODI todos los costos reducidos dan ≥ 0, así que esta solución ya es óptima.</p>');
    h += item('4.', '3 P.', 'Indique las rutas que se van a utilizar para el menor costo.',
      '<ul><li>Planta 1 → Ciudad 3: 25</li><li>Planta 2 → Ciudad 2: 40</li><li>Planta 3 → Ciudad 1: 23</li><li>Planta 3 → Ciudad 2: 2</li><li>Planta 3 → Ciudad 3: 5</li><li>Red externa → Ciudad 1: 13 (compra adicional)</li></ul><p><strong>Costo mínimo: $49 710.</strong> Existe otra solución con el mismo costo, porque la celda P2→C1 tiene costo reducido 0: P1→C3 25, P2→C1 23, P2→C2 17, P3→C2 25, P3→C3 5 y Red→C1 13.</p>');

    h += '<h3>3) Flujo máximo (9 P.)</h3>';
    h += '<p class="ex-q">Use el algoritmo de flujo máximo en la red de la figura. Origen A, destino F. Muestre los pasos.</p>' +
      table(['Arco', 'A→B', 'A→C', 'B→D', 'B→E', 'C→D', 'C→E', 'D→E', 'D→F', 'E→F'], [['Capacidad', '9', '7', '7', '2', '4', '6', '3', '6', '9']]);
    h += item('3)', '9 P.', 'Encontrar el valor máximo del flujo.',
      '<p>Rutas de aumento (en cada paso se envía la capacidad mínima de la ruta):</p>' +
      table(['Paso', 'Ruta', 'Flujo', 'Acumulado'], [['1', 'A→B→D→F', '6', '6'], ['2', 'A→B→E→F', '2', '8'], ['3', 'A→B→D→E→F', '1', '9'], ['4', 'A→C→E→F', '6', '15']]) +
      '<p>Después del paso 4 los arcos D→F (6/6) y E→F (9/9) están llenos. No queda ninguna ruta de A a F.</p>' +
      '<p><strong>Flujo máximo = 15.</strong> Corte mínimo: {D→F, E→F} con capacidad 6 + 9 = 15.</p>' +
      '<p>Flujos finales: A→B 9, A→C 6, B→D 7, B→E 2, C→D 0, C→E 6, D→E 1, D→F 6, E→F 9.</p>',
      'En la foto el nodo F queda cortado a la derecha. Se supone que los arcos de capacidad 6 y 9 llegan a F. Revise en la hoja original la dirección de los arcos cruzados B→E (2) y C→D (4).');
    return h;
  }

  /* ---------------------------------------------------------------------------
   * Examen 4 — Métodos exactos/heurísticos, Really Big Shoe, transporte C1/C2
   * ------------------------------------------------------------------------- */
  function buildEx4() {
    var h = '<p><strong>Examen de la Electiva I.</strong> Las fotos no muestran la fecha ni el encabezado. Contenido: métodos exactos y heurísticos, método gráfico y transporte.</p>' +
      fuente(['94a6a662….JPG (ítems 1 y 2)', 'e3865fc3….JPG (ítem 3)'], 'Puede que el examen tenga más ítems que no están en las fotos');

    h += '<h3>1) Métodos de optimización</h3>';
    h += item('a.', '3 P.', 'Mencione e indique la diferencia entre los métodos exactos y heurísticos para resolver problemas de optimización.',
      '<p><strong>Exactos:</strong> garantizan la solución óptima. Su tiempo puede crecer mucho con el tamaño del problema. Ejemplos: simplex, ramificación y acotamiento, programación dinámica.</p>' +
      '<p><strong>Heurísticos:</strong> dan una solución buena (no siempre la óptima) en un tiempo razonable. Se usan cuando el problema es muy grande o muy complejo. Ejemplos: algoritmos genéticos, búsqueda tabú, recocido simulado.</p>');
    h += item('b.', '2 P.', 'Cite al menos un ejemplo de problema donde se puede aplicar cada uno.',
      '<ul><li><strong>Exacto:</strong> mezcla de producción con PL (simplex), o un problema de transporte.</li><li><strong>Heurístico:</strong> problema del viajante (TSP) con muchas ciudades, ruteo de vehículos o armado de horarios.</li></ul>');

    h += '<h3>2) The Really Big Shoe</h3>';
    h += '<p class="ex-q">Cada equipo de fútbol patrocinado requiere 120 pares de zapatos. Cada equipo de básquetbol requiere 32 pares. Los entrenadores de fútbol reciben $300 000 y los de básquetbol $1 000 000. El presupuesto es $30 000 000. Hay 4000 cc de flubber. Cada par de básquetbol usa 3 cc y cada par de fútbol 1 cc. Se quiere patrocinar el mayor número de equipos.</p>';
    h += item('a)', '4 P.', 'Formule las ecuaciones lineales de la función objetivo y las restricciones.',
      '<p>x1 = equipos de básquetbol, x2 = equipos de fútbol.</p>' +
      '<pre>Max Z = x1 + x2\ns.a.  1 000 000x1 + 300 000x2 ≤ 30 000 000  →  10x1 + 3x2 ≤ 300\n      (32·3)x1 + (120·1)x2 ≤ 4000        →  96x1 + 120x2 ≤ 4000\n      x1, x2 ≥ 0</pre>');
    h += item('b)', '4 P.', 'Utilice el método gráfico.',
      table(['Recta', 'x1 = 0', 'x2 = 0'], [['10x1 + 3x2 = 300', '(0, 100)', '(30, 0)'], ['96x1 + 120x2 = 4000', '(0; 33,33)', '(41,67; 0)']]) +
      '<p>Cruce: de la primera, x2 = 100 − 10x1/3. En la segunda: 96x1 + 12 000 − 400x1 = 4000, entonces x1 = 8000/304 = 26,32 y x2 = 12,28.</p>');
    h += item('c)', '1 P.', 'Indique en su gráfica la región factible.',
      '<p>Vértices: (0, 0), (30, 0), (26,32; 12,28) y (0; 33,33).</p>' +
      table(['Vértice', 'Z = x1 + x2'], [['(0, 0)', '0'], ['(30, 0)', '30'], ['<strong>(26,32; 12,28)</strong>', '<strong>38,6</strong>'], ['(0; 33,33)', '33,3']]));
    h += item('d)', '2 P.', '¿Cuál es el número máximo de cada tipo de equipo que podrá patrocinar?',
      '<p>Óptimo del PL: x1 = 500/19 ≈ 26,3 equipos de básquetbol y x2 = 700/57 ≈ 12,3 de fútbol (Z ≈ 38,6).</p>' +
      '<p><strong>Como los equipos son enteros: 26 de básquetbol y 12 de fútbol, 38 equipos en total.</strong> Control: 10(26) + 3(12) = 296 ≤ 300 y 96(26) + 120(12) = 3936 ≤ 4000. No se puede llegar a 39 equipos.</p>',
      'Con 38 equipos también sirven 25 + 13 y 24 + 14. La opción 26 + 12 es la que más se acerca al óptimo del gráfico.');

    h += '<h3>3) Transporte C1/C2</h3>';
    h += '<p class="ex-q">Una empresa envía productos desde dos centros de distribución (C1 y C2) a tres clientes (D1, D2 y D3):</p>' +
      table(['', 'Oferta', 'D1', 'D2', 'D3'], [['C1', '6', '2', '4', '5'], ['C2', '9', '3', '1', '2'], ['Demanda', '', '5', '6', '4']]);
    h += item('a)', '1 P.', 'Represente el grafo que genera el modelo.',
      '<p>Orígenes C1 (6) y C2 (9). Destinos D1 (5), D2 (6) y D3 (4). Seis arcos: C1→D1 (2), C1→D2 (4), C1→D3 (5), C2→D1 (3), C2→D2 (1), C2→D3 (2). Oferta 15 = demanda 15: está balanceado.</p>');
    h += item('b)', '1 P.', 'Indique las variables de decisión en su grafo.',
      '<p>x<sub>ij</sub> = unidades del centro i (1, 2) al cliente j (1, 2, 3): x11, x12, x13, x21, x22, x23.</p>');
    h += item('c)', '1 P.', 'Formule la función objetivo.',
      '<pre>Min Z = 2x11 + 4x12 + 5x13 + 3x21 + 1x22 + 2x23</pre>');
    h += item('d)', '5 P.', 'Formule las restricciones.',
      '<pre>Oferta:   x11 + x12 + x13 = 6\n          x21 + x22 + x23 = 9\nDemanda:  x11 + x21 = 5\n          x12 + x22 = 6\n          x13 + x23 = 4\n          xij ≥ 0</pre>' +
      '<p><strong>Extra (solución óptima):</strong> x11 = 5, x13 = 1, x22 = 6, x23 = 3, con Z = 10 + 5 + 6 + 6 = <strong>27</strong>. Otra solución con el mismo costo: x11 = 5, x12 = 1, x22 = 5, x23 = 4.</p>');
    return h;
  }

  /* ---------------------------------------------------------------------------
   * Anexo — ejemplo de la pizarra (transporte 4×5)
   * ------------------------------------------------------------------------- */
  function buildPizarra() {
    var h = '<p>No es un examen: es un ejemplo resuelto en clase (esquina noroeste y costo mínimo). Sirve para practicar el ítem de solución inicial.</p>' +
      fuente(['e18dcc59….JPG', '50242c7f….JPG']);
    h += table(['', 'D1', 'D2', 'D3', 'D4', 'D5', 'Oferta'], [
      ['S1', '14', '10', '8', '10', '12', '250'], ['S2', '20', '5', '9', '17', '18', '250'],
      ['S3', '15', '16', '8', '6', '10', '250'], ['S4', '9', '10', '20', '8', '18', '250'],
      ['Demanda', '300', '175', '325', '130', '70', '1000']]);
    h += item('1.', null, '¿Cuántas celdas básicas debe tener la solución inicial?',
      '<p>m + n − 1 = 4 + 5 − 1 = <strong>8</strong>.</p>');
    h += item('2.', null, 'Solución inicial por esquina noroeste y su costo.',
      '<p>S1→D1 250, S2→D1 50, S2→D2 175, S2→D3 25, S3→D3 250, S4→D3 50, S4→D4 130, S4→D5 70.</p>' +
      '<p>Costo = 3500 + 1000 + 875 + 225 + 2000 + 1000 + 1040 + 1260 = <strong>$10 900</strong> (igual que en la pizarra).</p>');
    h += item('3.', null, 'Solución inicial por costo mínimo y su costo.',
      '<p>S2→D2 175 (5), S3→D4 130 (6), S1→D3 250 (8), S3→D3 75 (8), S4→D1 250 (9), S3→D5 45 (10), S2→D5 25 (18), S2→D1 50 (20).</p>' +
      '<p>Costo = 875 + 780 + 2000 + 600 + 2250 + 450 + 450 + 1000 = <strong>$8 405</strong>.</p>',
      'En la pizarra se anotó 130 × 5 = 650 y un total de $8 275. En la tabla, el costo de S3→D4 figura como 6, y con 6 el total es $8 405. Confirme con su cuaderno qué costo tiene esa celda.');
    h += item('4.', null, '¿Alguna de las dos soluciones iniciales es óptima? (práctica extra con MODI)',
      '<p>No. Son solo soluciones iniciales. Con el método MODI desde la de costo mínimo:</p>' +
      '<ol><li>Entra S2→D3 (costo reducido −7), θ = 25. Costo: $8 230.</li><li>Entra S1→D1 (costo reducido −5), θ = 50. Costo: $7 980. Todos los costos reducidos quedan ≥ 0.</li></ol>' +
      '<p><strong>Óptimo: S1→D1 50, S1→D3 200, S2→D2 175, S2→D3 75, S3→D3 50, S3→D4 130, S3→D5 70, S4→D1 250. Costo mínimo $7 980.</strong></p>' +
      '<p>Como referencia, el método de Vogel da una solución inicial de $8 030, más cerca del óptimo.</p>');
    return h;
  }

  var quiz = MC.map(function (m) {
    return { q: m[0], options: m[1], answer: m[2], explain: m[3] };
  });

  IO.registerChapter({
    id: 'examenes', num: 7,
    title: 'Exámenes anteriores',
    summary: 'Todos los ítems de los exámenes fotografiados (carpeta «examenes IO»), ordenados por examen, con su respuesta. Cada respuesta está plegada: intente resolver primero y después abra «Ver respuesta».',
    css:
      '#examenes .ex-item{border-top:1px solid var(--line);padding:8px 0}' +
      '#examenes .ex-q{margin:4px 0}' +
      '#examenes .ex-opts{margin:4px 0 0 18px}' +
      '#examenes .ex-src{font-size:13px}' +
      '#examenes .ex-src code{font-size:12px}' +
      '#examenes .ex-ans-body{padding:4px 2px}' +
      '#examenes pre{white-space:pre-wrap;font-family:"JetBrains Mono",monospace;font-size:13px;background:var(--paper-2);border:1px solid var(--line);border-radius:6px;padding:8px 10px;overflow-x:auto}' +
      '#examenes .table-scroll{overflow-x:auto}' +
      '#examenes table.data td,#examenes table.data th{font-family:"JetBrains Mono",monospace;font-variant-numeric:tabular-nums}' +
      '#examenes h3{margin:16px 0 4px}' +
      '#examenes .ex-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}',
    sections: [
      { id: 'examenes-s1', title: 'Examen 1 · Primer parcial (18/09/2025)', html: buildEx1() },
      { id: 'examenes-s2', title: 'Examen 2 · Examen 2025: gráfico, transporte y PEB', html: buildEx2() },
      { id: 'examenes-s3', title: 'Examen 3 · Opción múltiple, transporte con compra y flujo máximo', html: buildEx3() },
      { id: 'examenes-s4', title: 'Examen 4 · Exactos y heurísticos, Really Big Shoe y transporte', html: buildEx4() },
      { id: 'examenes-s5', title: 'Anexo · Ejemplo de la pizarra (transporte 4×5)', html: buildPizarra() }
    ],
    mount: function (root) {
      if (!root) return;
      var bar = document.createElement('div');
      bar.className = 'ex-toolbar';
      bar.innerHTML = '<button type="button" class="btn btn-sm" data-ex="open">Abrir todas las respuestas</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-ex="close">Cerrar todas</button>';
      var header = root.querySelector('.chapter-header');
      if (header) header.appendChild(bar); else root.insertBefore(bar, root.firstChild);
      bar.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.getAttribute) return;
        var mode = t.getAttribute('data-ex');
        if (!mode) return;
        root.querySelectorAll('details.ex-ans').forEach(function (d) { d.open = mode === 'open'; });
      });
    },
    quiz: quiz
  });

  IO.__examenes = { DATA: DATA, MC: MC };
})();
