/* Teaching layer: from-zero primers, one concise video per topic, 3D hooks, book/exam refs.
 * Global: IO.Teach. Owner: this file. No network besides the YouTube iframe the browser loads. */
(function (global) {
  'use strict';
  var IO = global.IO = global.IO || { chapters: [] };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function isFileProtocol() {
    try {
      return typeof location !== 'undefined' && location.protocol === 'file:';
    } catch (e) { return false; }
  }

  function videoCard(v) {
    if (!v || !v.id) return '';
    var watch = 'https://www.youtube.com/watch?v=' + encodeURIComponent(v.id);
    var head = '<div class="video-card-head">' +
        '<strong>Video para este tema</strong>' +
        '<span class="badge">' + esc(v.dur || '') + (v.lang ? ' · ' + esc(v.lang) : '') + '</span>' +
      '</div>';
    var why = '<p class="video-card-why"><strong>' + esc(v.title) + '.</strong> ' + esc(v.why || '') +
        ' <a href="' + watch + '" target="_blank" rel="noopener">Abrir en YouTube</a></p>';
    var frame;
    if (isFileProtocol()) {
      frame = '<a class="video-frame video-frame-link" href="' + watch + '" target="_blank" rel="noopener">' +
        '<img src="https://i.ytimg.com/vi/' + encodeURIComponent(v.id) + '/hqdefault.jpg" alt="' + esc(v.title) + '" />' +
        '<span class="video-play">Ver en YouTube</span></a>' +
        '<p class="muted" style="padding:0 14px">Si abre esta página con doble clic, el video se abre en YouTube. Para verlo acá: <code>python3 -m http.server 8765</code> desde la carpeta de la materia.</p>';
    } else {
      frame = '<div class="video-frame">' +
        '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.id) + '" title="' + esc(v.title) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>' +
        '</div>';
    }
    return '<div class="video-card">' + head + frame + why + '</div>';
  }

  function refsHtml(refs) {
    if (!refs || !refs.length) return '';
    var h = '<p class="teach-refs"><strong>Referencias externas</strong></p><ul class="teach-refs">';
    refs.forEach(function (r) {
      h += '<li><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.title) + '</a>';
      if (r.note) h += ' — ' + esc(r.note);
      h += '</li>';
    });
    return h + '</ul>';
  }

  function vizHtml(name, caption) {
    if (!name) return '';
    return '<div class="widget wide" data-viz3d="' + esc(name) + '" data-caption="' + esc(caption || '') + '"></div>';
  }

  function block(lesson) {
    if (!lesson) return '';
    var h = '<div class="teach-block">';
    if (lesson.primer) h += '<div class="teach-primer zero-hero">' + lesson.primer + '</div>';
    if (lesson.viz) h += vizHtml(lesson.viz, lesson.vizCaption || '');
    if (lesson.video) h += videoCard(lesson.video);
    if (lesson.refs) h += refsHtml(lesson.refs);
    if (lesson.exam) h += '<div class="callout callout-exam">' + lesson.exam + '</div>';
    return h + '</div>';
  }

  var WIKI_OR = { title: 'Wikipedia · Investigación de operaciones', url: 'https://es.wikipedia.org/wiki/Investigaci%C3%B3n_de_operaciones', note: 'mapa general de la disciplina.' };
  var WIKI_LP = { title: 'Wikipedia · Programación lineal', url: 'https://es.wikipedia.org/wiki/Programaci%C3%B3n_lineal', note: 'definición, historia y teorema del vértice.' };
  var WIKI_SX = { title: 'Wikipedia · Algoritmo símplex', url: 'https://es.wikipedia.org/wiki/Algoritmo_s%C3%ADmplex', note: 'pasos y casos especiales.' };
  var WIKI_DUAL = { title: 'Wikipedia · Dualidad (optimización)', url: 'https://es.wikipedia.org/wiki/Dualidad_(optimizaci%C3%B3n)', note: 'primal, dual, holgura complementaria.' };
  var WIKI_TR = { title: 'Wikipedia · Problema de transporte', url: 'https://es.wikipedia.org/wiki/Problema_del_transporte', note: 'oferta, demanda y costo.' };
  var WIKI_HU = { title: 'Wikipedia · Método húngaro', url: 'https://es.wikipedia.org/wiki/Algoritmo_h%C3%BAngaro', note: 'asignación de costo mínimo.' };
  var WIKI_ILP = { title: 'Wikipedia · Programación lineal entera', url: 'https://es.wikipedia.org/wiki/Programaci%C3%B3n_lineal_entera', note: 'variables enteras y binarias.' };
  var WIKI_MF = { title: 'Wikipedia · Flujo máximo', url: 'https://es.wikipedia.org/wiki/Flujo_m%C3%A1ximo', note: 'Ford–Fulkerson y corte mínimo.' };
  var WIKI_GA = { title: 'Wikipedia · Algoritmo genético', url: 'https://es.wikipedia.org/wiki/Algoritmo_gen%C3%A9tico', note: 'población, cruce, mutación, fitness.' };
  var TAHA = { title: 'Taha, Investigación de operaciones, 9ª ed.', url: 'https://es.wikipedia.org/wiki/Investigaci%C3%B3n_de_operaciones', note: 'libro de la cátedra. Use los capítulos indicados abajo.' };

  /* One lesson per existing section id. Primer is for a reader who knows nothing. */
  var LESSONS = {
    'cap1-s1': {
      viz: 'io-pipeline',
      vizCaption: 'Del mundo real a una decisión',
      primer:
        '<p><strong>De cero.</strong> Investigación de operaciones (IO) es un método para <em>decidir bien</em> cuando hay números, límites y un objetivo.</p>' +
        '<p>Imagine una fábrica, un hospital o un camión. Hay muchas formas de operar. IO traduce esa situación a un modelo: qué se puede elegir, qué no se puede romper, y qué se quiere maximizar o minimizar. Después un algoritmo busca la mejor decisión.</p>' +
        '<ol class="teach-steps">' +
        '<li>Hay un sistema real (personas, máquinas, dinero, tiempo).</li>' +
        '<li>Se escribe un modelo: variables, restricciones, objetivo.</li>' +
        '<li>Se resuelve el modelo (a mano, con simplex, con un solver).</li>' +
        '<li>Se vuelve al mundo real: “haga esto”.</li>' +
        '</ol>' +
        '<p>Nació en la Segunda Guerra Mundial. Hoy se usa en logística, producción, finanzas y redes. En esta materia el núcleo es la <strong>programación lineal</strong>.</p>' +
        '<p class="muted">Taha 9ª ed., §1.1.</p>',
      video: {
        id: 'V82ohQNLiM0', title: 'Generalidades de la Investigación de Operaciones (Marcel Ruiz)',
        dur: '5 min', lang: 'español',
        why: 'Origen, definición, importancia y fases de un estudio de IO. Es el mapa de la materia en cinco minutos.'
      },
      refs: [WIKI_OR, TAHA, { title: 'Tipos de modelos en IO (Marcel Ruiz)', url: 'https://www.youtube.com/watch?v=lA7WASv2YMg', note: '5 min, clasificación de modelos.' }],
      exam: '<strong>En el parcial.</strong> Suelen pedir: por qué se usan modelos matemáticos, y la diferencia entre modelo determinístico y estocástico. Respuesta corta, 1 punto cada una.'
    },
    'cap1-s2': {
      viz: 'io-pipeline',
      primer:
        '<p><strong>De cero.</strong> Un modelo de IO siempre tiene tres piezas. Si falta una, no es un modelo de optimización.</p>' +
        '<ol class="teach-steps">' +
        '<li><strong>Variables de decisión</strong> (alternativas): lo que usted elige. Ejemplo: x = libros de álgebra, y = libros de geometría.</li>' +
        '<li><strong>Restricciones</strong>: lo que no puede romper. Horas de máquina, presupuesto, demanda. Se escriben como desigualdades o igualdades.</li>' +
        '<li><strong>Función objetivo</strong>: el número que quiere hacer grande (ganancia) o chico (costo). Se llama z o Z.</li>' +
        '</ol>' +
        '<p>Ejemplo mínimo: un rectángulo de perímetro L. Variables x, y. Restricción 2x+2y=L. Objetivo: maximizar el área xy. El óptimo es un cuadrado.</p>',
      video: {
        id: 'ytiq74ALnUQ', title: 'Plantear un modelo de programación lineal · Ejemplo 1 (Marcel Ruiz)',
        dur: '9 min', lang: 'español',
        why: 'Cómo pasar de un enunciado a variables, objetivo y restricciones. Es el primer paso de todo examen de PL.'
      },
      refs: [WIKI_LP, { title: 'Taha §1.2 y §2.1', url: 'https://es.wikipedia.org/wiki/Programaci%C3%B3n_lineal', note: 'Reddy Mikks es el ejemplo guía del libro.' }],
      exam: '<strong>En el parcial.</strong> Editorial Lumbreras y The Really Big Shoe: le dan un enunciado y debe armar variables, tabla característica, objetivo y restricciones.'
    },
    'cap1-s3': {
      viz: 'ga-landscape',
      primer:
        '<p><strong>De cero. Exacto vs heurístico.</strong> Hay dos familias de métodos para resolver un modelo.</p>' +
        '<p><strong>Método exacto:</strong> garantiza el óptimo global. Ejemplos: simplex, método gráfico, ramificación y acotamiento, flujo máximo Ford–Fulkerson. Puede tardar mucho si el problema es enorme.</p>' +
        '<p><strong>Método heurístico (aproximado):</strong> busca una solución buena en poco tiempo. No promete que sea la mejor. Ejemplos: algoritmos genéticos, búsqueda tabú, recocido simulado, vecino más cercano.</p>' +
        '<p>La simulación es un tercer camino: no “resuelve” una fórmula; imita el sistema paso a paso y estima resultados.</p>' +
        '<p class="muted">Esta distinción entra en casi todos los exámenes de la cátedra (3 puntos + ejemplos).</p>',
      video: {
        id: 'Bhme3i8jHpU', title: '¿Qué es un algoritmo genético? (MindMachineTV)',
        dur: '4 min', lang: 'español',
        why: 'Fitness, población, cruce y mutación en cuatro minutos. Es el vocabulario del ítem de exactos vs heurísticos.'
      },
      refs: [
        WIKI_GA,
        { title: 'Capítulo «Algoritmos evolutivos» de esta página', url: '#evolutivos', note: 'teoría completa del ítem de examen.' }
      ],
      exam: '<strong>En el parcial.</strong> “Mencione e indique la diferencia de los dos métodos generales… Cite un ejemplo de cada uno.” Exacto = simplex. Heurístico = algoritmo genético.'
    },
    'cap1-s4': {
      primer:
        '<p><strong>De cero.</strong> Colas y simulación aparecen en Taha §1.4. En los exámenes fotografiados <strong>casi no entran</strong>. Léalo una vez para el vocabulario (llegadas aleatorias, tiempo de espera) y no invierta horas.</p>',
      video: {
        id: 'V82ohQNLiM0', title: 'Generalidades de la Investigación de Operaciones (Marcel Ruiz)',
        dur: '5 min', lang: 'español',
        why: 'Colas casi no entra. Este video de 5 minutos le deja el mapa de la materia y no pierde tiempo en un tema de baja prioridad.'
      },
      refs: [{ title: 'Wikipedia · Teoría de colas', url: 'https://es.wikipedia.org/wiki/Teor%C3%ADa_de_colas', note: 'solo cultura general para este curso.' }],
      exam: '<strong>Prioridad baja.</strong> Si falta tiempo, salte esta sección. No aparece en los parciales de 2025.'
    },
    'cap1-s5': {
      viz: 'io-pipeline',
      primer:
        '<p><strong>De cero.</strong> Modelar es traducir. El mundo es sucio y ambiguo. El modelo es limpio y mentiroso a propósito: se quedan solo las piezas que importan.</p>' +
        '<p>Cadena: mundo real → supuestos (qué se ignora) → modelo matemático. Un modelo demasiado simple no sirve. Uno demasiado complejo no se puede resolver. El arte es el equilibrio.</p>',
      video: {
        id: 'KUDO49AKb7U', title: 'Modelado en IO: concepto y componentes del modelo (Marcel Ruiz)',
        dur: '9 min', lang: 'español',
        why: 'Explica cómo se pasa del mundo real a un modelo con supuestos. Es el arte del modelado del cap. 1.'
      },
      refs: [WIKI_OR],
      exam: '<strong>En el parcial.</strong> “¿Por qué se utilizan modelos matemáticos?” Porque permiten probar muchas decisiones sin experimentar en el sistema real, y encontrar la mejor con un algoritmo.'
    },
    'cap1-s6': {
      primer:
        '<p><strong>De cero.</strong> El número óptimo no siempre es la decisión correcta para las personas. Taha cuenta dos historias: espejos frente a los ascensores (el problema era el aburrimiento, no el tiempo) y la fila única en un banco (justicia percibida).</p>' +
        '<p>Antes de optimizar, confirme que está resolviendo el problema real.</p>',
      video: {
        id: 'V82ohQNLiM0', title: 'Generalidades de la Investigación de Operaciones (Marcel Ruiz)',
        dur: '5 min', lang: 'español',
        why: 'La parte humana (espejos, filas) está en Taha §1.6. Este video recuerda que el modelo sirve para decidir, no para reemplazar a las personas.'
      },
      refs: [{ title: 'Taha §1.6', url: 'https://es.wikipedia.org/wiki/Investigaci%C3%B3n_de_operaciones', note: 'los dos ejemplos del libro.' }],
      exam: 'Rara vez entra. Si entra, es un concepto de 1 punto: el modelo debe representar el problema correcto.'
    },
    'cap1-s7': {
      viz: 'io-pipeline',
      primer:
        '<p><strong>De cero. Las cinco fases</strong> de un estudio de IO (Taha §1.7):</p>' +
        '<ol class="teach-steps">' +
        '<li>Definir el problema (qué se decide, con qué límites, con qué objetivo).</li>' +
        '<li>Construir el modelo.</li>' +
        '<li>Resolverlo (y mirar sensibilidad: ¿qué pasa si un dato cambia?).</li>' +
        '<li>Validar: ¿el modelo predice el mundo real?</li>' +
        '<li>Implementar: convertir el número en una instrucción que la gente pueda cumplir.</li>' +
        '</ol>',
      video: {
        id: 'V82ohQNLiM0', title: 'Generalidades de la Investigación de Operaciones (Marcel Ruiz)',
        dur: '5 min', lang: 'español',
        why: 'Minuto 2:31: las fases de un estudio de IO. Definir, modelar, resolver, validar, implementar.'
      },
      refs: [WIKI_OR],
      exam: 'Puede pedir “fases de un estudio” o “solución factible / óptima / no factible”. Factible = cumple todas las restricciones. Óptima = la factible con mejor z. No factible = rompe al menos una restricción.'
    },

    'cap2-s1': {
      viz: 'lp-prism',
      vizCaption: 'Reddy Mikks: la altura es z = 5x1+4x2',
      primer:
        '<p><strong>De cero. Programación lineal (PL).</strong> Todas las fórmulas son rectas: el objetivo es lineal, las restricciones son lineales, las variables no son negativas.</p>' +
        '<p>Reddy Mikks (Taha §2.1) fabrica dos pinturas. x1 = toneladas de pintura para exteriores, x2 = interiores.</p>' +
        '<pre class="formula">max z = 5x1 + 4x2\n6x1 + 4x2 ≤ 24     (materia M1)\n x1 + 2x2 ≤ 6      (materia M2)\n−x1 +  x2 ≤ 1      (demanda)\n        x2 ≤ 2      (límite)\nx1, x2 ≥ 0</pre>' +
        '<p>Óptimo: (3, 1.5), z = 21. Memorice este ejemplo: el libro y los widgets lo reutilizan.</p>' +
        '<p>Cuatro propiedades del modelo: proporcionalidad, aditividad, certidumbre, no negatividad.</p>',
      video: {
        id: '2uJiJYviiIw', title: 'Programación lineal · Método gráfico 1 · Maximizar paso a paso (IngeChay)',
        dur: '15 min', lang: 'español',
        why: 'El gráfico de maximización más visto en español. Rectas, región factible y vértice óptimo, como en Lumbreras.'
      },
      refs: [
        WIKI_LP,
        { title: 'Taha §2.1 Reddy Mikks', url: 'https://es.wikipedia.org/wiki/Programaci%C3%B3n_lineal', note: 'óptimo (3, 1.5), z = 21.' }
      ],
      exam: '<strong>Ítem estrella.</strong> Formular desde un enunciado (Lumbreras, Really Big Shoe). Tabla de recursos × productos, variables, max/min, desigualdades, x≥0.'
    },
    'cap2-s2': {
      viz: 'lp-2d',
      vizCaption: 'Método gráfico de Reddy Mikks',
      primer:
        '<p><strong>De cero. Método gráfico.</strong> Solo funciona con <strong>dos variables</strong>. En el examen es el ítem más largo (11 a 24 puntos).</p>' +
        '<ol class="teach-steps">' +
        '<li>Iguale cada restricción a su lado derecho y dibuje la recta. Cortes con los ejes: ponga x=0, después y=0.</li>' +
        '<li>Pruebe un punto (a menudo el origen) para saber de qué lado queda la región.</li>' +
        '<li>La intersección de todos los lados válidos es la <strong>región factible</strong> (un polígono).</li>' +
        '<li>Los candidatos a óptimo son los <strong>vértices</strong>.</li>' +
        '<li>Calcule z en cada vértice. El mejor es la solución. Márquelo.</li>' +
        '</ol>' +
        '<p>Errores típicos del examen: marcar cortes de ejes que no son vértices; olvidar evaluar (0, algo); no sombrear la región.</p>' +
        '<p>Minimización (problema de la dieta, Taha): misma receta, se elige el vértice de z más chico. Óptimo ≈ (470.6, 329.4), z ≈ 437.64.</p>',
      video: {
        id: 'muZ7iVZ2UzI', title: 'Programación lineal · Método gráfico 2 · Minimizar paso a paso (IngeChay)',
        dur: '10 min', lang: 'español',
        why: 'El mismo procedimiento del gráfico, pero para minimizar. El examen a veces pide costo (min) y a veces ganancia (max).'
      },
      refs: [
        { title: 'Método gráfico a mano · Ejemplo 1 (Marcel Ruiz)', url: 'https://www.youtube.com/watch?v=dd_EMYzGltU', note: '30 min, el clásico de sillas y mesas.' },
        { title: 'Cómo plantear y resolver PL (profesor10demates)', url: 'https://www.youtube.com/watch?v=urJHbv9eSzM', note: '23 min, estilo examen: variables, región, vértices.' },
        WIKI_LP
      ],
      exam: 'Examen 1 (Lumbreras), examen 2 (3x+2y) y examen 4 (Really Big Shoe). Siempre: dibujar, región, z en cada vértice, marcar el óptimo. En Lumbreras el óptimo es un eje: (0, 40), Z=400. No se deje llevar por el cruce interior.'
    },
    'cap2-s3': {
      primer:
        '<p><strong>De cero. Solver.</strong> Excel Solver (o TORA) hace el simplex por usted. En el examen de PEB piden “muestre el modelo en una hoja y resuelva con Solver”: celdas cambiantes = variables, objetivo = SUMPRODUCTO, restricciones, y marcar variables binarias.</p>' +
        '<p>No entra un examen escrito de AMPL. Sí entra saber nombrarlo como técnica de solución junto a gráfico y simplex.</p>',
      video: {
        id: 'jMEeqE3LEpU', title: 'Programación entera binaria en Solver (Ing. Oscar Aguilar)',
        dur: '6 min', lang: 'español',
        why: 'Armar la hoja, marcar variables binarias y correr Solver. Es el ítem c del examen de PEB.'
      },
      refs: [
        { title: 'Microsoft · Solver', url: 'https://support.microsoft.com/es-es/office/definir-y-resolver-un-problema-mediante-solver-5d1a388f-079d-43ac-a7eb-f63e45925040', note: 'pasos oficiales.' }
      ],
      exam: 'Examen 2 ítem 5c: Solver con variables binarias. Método Simplex LP. Resultado Peterson &amp; Johnson: proyectos 1, 3 y 4, ganancia 3,4.'
    },
    'cap2-s4': {
      primer:
        '<p><strong>De cero. Formular sin resolver.</strong> Taha §2.4 enseña a escribir el modelo de inversión, producción-inventario, turnos, mezcla. En el examen le dan un cuento y usted debe producir: grafo o tabla, variables x<sub>ij</sub>, min/max z, restricciones de oferta y demanda.</p>' +
        '<p>Receta: 1) ¿qué número decido? 2) ¿qué no puede pasar? 3) ¿qué mido como éxito?</p>',
      video: {
        id: 'jlz5NqkDR6A', title: 'Explicación del modelo de transporte, parte 1 (Marcel Ruiz)',
        dur: '11 min', lang: 'español',
        why: 'Grafo, variables xij, función objetivo y restricciones. Es el ítem de 8 puntos de los exámenes.'
      },
      refs: [WIKI_TR, { title: 'Taha §2.4', url: 'https://es.wikipedia.org/wiki/Programaci%C3%B3n_lineal', note: 'aplicaciones: inversión, mezcla, mano de obra.' }],
      exam: 'Transporte A/B→tiendas y C1/C2→clientes: 8 puntos de formulación. Plantas de energía: formulación + costo mínimo.'
    },

    'cap3-s1': {
      viz: 'simplex-walk',
      primer:
        '<p><strong>De cero. Forma de ecuación.</strong> Simplex no traga desigualdades. Hay que convertir:</p>' +
        '<ul class="teach-steps">' +
        '<li>≤ : sume una <strong>holgura</strong> s ≥ 0. Lo que “sobra” del recurso.</li>' +
        '<li>≥ : reste un <strong>excedente</strong> e ≥ 0 y, para tener base inicial, sume una <strong>artificial</strong> a ≥ 0.</li>' +
        '<li>= : solo artificial.</li>' +
        '<li>Variable libre: x = x⁺ − x⁻, ambas ≥ 0.</li>' +
        '<li>Si b &lt; 0, multiplique la fila por −1 (cambia el sentido de la desigualdad).</li>' +
        '</ul>',
      video: {
        id: '9OIbDjorz6c', title: 'Método Simplex (1) Ejemplo maximizar (IngeChay)',
        dur: '18 min', lang: 'español',
        why: 'Holguras, tabla inicial, columna pivote y razón mínima. Es el formato que pide la clase.'
      },
      refs: [WIKI_SX, { title: 'Taha §3.1', url: 'https://es.wikipedia.org/wiki/Algoritmo_s%C3%ADmplex', note: 'forma de ecuación.' }],
      exam: 'En clase piden el tableau con columnas Básicas | Z | vars | holguras | R. En el parcial escrito aparece más el gráfico; el simplex entra en la tarea y puede entrar como “técnica de solución”.'
    },
    'cap3-s2': {
      viz: 'simplex-walk',
      primer:
        '<p><strong>De cero.</strong> Con m ecuaciones y n variables, una <strong>solución básica</strong> pone n−m variables en cero (no básicas) y resuelve las m restantes (básicas). Si todas las básicas son ≥ 0, es una <strong>solución básica factible</strong>: un vértice del polígono.</p>' +
        '<p>Por eso simplex camina por vértices. Hay C(n,m) soluciones básicas posibles; muchas no son factibles.</p>',
      video: {
        id: 'STRC94VCcBc', title: 'Conceptos básicos de PL y el método simplex (Marcel Ruiz)',
        dur: '4 min', lang: 'español',
        why: 'Solución básica, vértice y por qué simplex camina por las esquinas. Cuatro minutos.'
      },
      refs: [WIKI_SX],
      exam: 'Concepto: “solución factible” = punto de la región. “Óptima” = el mejor vértice. Relación gráfica ↔ algebraica.'
    },
    'cap3-s3': {
      viz: 'simplex-walk',
      primer:
        '<p><strong>De cero. El algoritmo (maximizar).</strong></p>' +
        '<ol class="teach-steps">' +
        '<li><strong>Entra</strong> la no básica con el coeficiente más negativo en la fila z (quiere subir z).</li>' +
        '<li><strong>Sale</strong> la básica con la menor razón b<sub>i</sub>/a<sub>ir</sub> entre los a<sub>ir</sub> &gt; 0. Si no hay a<sub>ir</sub> &gt; 0: el problema es <em>no acotado</em>.</li>' +
        '<li><strong>Pivote</strong> Gauss–Jordan: la fila pivote se divide por el pivote; las otras filas restan múltiplos para anular la columna.</li>' +
        '<li>Repita hasta que la fila z no tenga negativos. Entonces es óptimo.</li>' +
        '</ol>' +
        '<p>En minimización, entra el coeficiente más positivo de la fila z.</p>',
      video: {
        id: 'hVjBn14xdMQ', title: 'Método simplex a mano para maximizar (Marcel Ruiz)',
        dur: '27 min', lang: 'español',
        why: 'El video de simplex más visto en español (1,8 millones). Un ejemplo completo: entra, sale, pivote, óptimo.'
      },
      refs: [
        WIKI_SX,
        { title: 'Taha §3.3 Reddy Mikks por simplex', url: 'https://es.wikipedia.org/wiki/Algoritmo_s%C3%ADmplex', note: '3 tablas, z = 21.' }
      ],
      exam: 'Tarea de clase: simplex en el formato del profesor (operaciones tipo “5R2+R1”). El widget de este capítulo lo imita.'
    },
    'cap3-s4': {
      primer:
        '<p><strong>De cero. Base inicial cuando hay ≥ o =.</strong> Las holguras de ≤ ya forman una base. Si hay ≥ o =, necesita artificiales.</p>' +
        '<p><strong>Método M:</strong> la artificial cuesta −M (max) o +M (min), con M enorme. Si una artificial queda positiva al final, el problema no es factible.</p>' +
        '<p><strong>Dos fases:</strong> fase I minimiza la suma de artificiales. Debe dar 0. Fase II tira las artificiales y sigue con z real.</p>' +
        '<p>Ejemplo Taha: min z = 4x1 + x2, óptimo (2/5, 9/5), z = 17/5.</p>',
      video: {
        id: 'zRmXEQak6lo', title: 'Método Simplex minimizar · Gran M · Ejemplo 1 (IngeChay)',
        dur: '26 min', lang: 'español',
        why: 'Minimización con variables artificiales y penalización M. Es el caso que más cuesta armar a mano.'
      },
      refs: [WIKI_SX],
      exam: 'Si entra, es un problema pequeño de min con una ≥ y una ≤. Practique el ejemplo del libro a mano y verifique con el widget.'
    },
    'cap3-s5': {
      primer:
        '<p><strong>De cero. Cuatro casos que el tableau delata.</strong></p>' +
        '<ul class="teach-steps">' +
        '<li><strong>Degeneración:</strong> una básica vale 0. El pivote puede no bajar z. Riesgo de ciclar.</li>' +
        '<li><strong>Óptimos alternativos:</strong> en el óptimo, una no básica tiene 0 en la fila z. Puede entrar y z no cambia.</li>' +
        '<li><strong>No acotado:</strong> la columna que entra no tiene positivos. z se puede ir a infinito.</li>' +
        '<li><strong>No factible:</strong> una artificial sobrevive con valor &gt; 0.</li>' +
        '</ul>',
      video: {
        id: 'hVjBn14xdMQ', title: 'Método simplex a mano para maximizar (Marcel Ruiz)',
        dur: '27 min', lang: 'español',
        why: 'Con el tableau a la vista se reconocen degeneración (básica = 0), alternativos (cero en fila z), no acotado y no factible.'
      },
      refs: [WIKI_SX],
      exam: 'En gráfico: región vacía o abierta. En simplex: reconocer el síntoma en la tabla. También entra como opción múltiple.'
    },
    'cap3-s6': {
      viz: 'dual-balance',
      primer:
        '<p><strong>De cero. Sensibilidad.</strong> Ya tiene el óptimo. Ahora pregunta: si cambia un dato, ¿el plan sigue valiendo?</p>' +
        '<p><strong>Lado derecho b<sub>i</sub></strong> (más horas, más materia): el <em>precio dual</em> y<sub>i</sub> dice cuánto sube z por una unidad extra, dentro de un rango de factibilidad.</p>' +
        '<p><strong>Coeficiente c<sub>j</sub></strong> (cambia el precio de venta): el óptimo (las variables que se producen) no cambia dentro de un rango de optimalidad.</p>' +
        '<p>TOYCO (Taha): z* = 1350, y = (1, 2, 0). El recurso 3 es abundante (y3 = 0).</p>',
      video: {
        id: '0SCg4pbUN1k', title: 'Introducción al análisis de sensibilidad (GOAL PROJECT)',
        dur: '12 min', lang: 'español',
        why: 'Precios sombra y qué pasa si cambia un recurso. Es el ítem de post-óptimo del examen 1.'
      },
      refs: [
        WIKI_DUAL,
        { title: 'Taha §3.6 TOYCO', url: 'https://es.wikipedia.org/wiki/An%C3%A1lisis_de_sensibilidad', note: 'y=(1,2,0), z=1350.' }
      ],
      exam: 'Examen 1 ítem i: “explique análisis post-óptimo y dé un ejemplo”. Use Lumbreras: una hora más de impresión vale y1 = 2.'
    },
    'cap3-s7': {
      primer:
        '<p><strong>Nota breve (Taha §3.7).</strong> En problemas enormes el simplex clásico se vuelve lento; existe el simplex revisado y el método de punto interior. <strong>No entra en este parcial.</strong></p>',
      video: {
        id: 'STRC94VCcBc', title: 'Conceptos básicos de PL y el método simplex (Marcel Ruiz)',
        dur: '4 min', lang: 'español',
        why: 'Idea del pivote sin simplex revisado. Ese tema no entra en el parcial.'
      },
      refs: [WIKI_SX],
      exam: 'Fuera de alcance. No estudie simplex revisado.'
    },

    'cap4-s1': {
      viz: 'dual-balance',
      primer:
        '<p><strong>De cero. El dual.</strong> Cada PL (primal) tiene un gemelo. Si el primal maximiza ganancia con recursos limitados, el dual minimiza el valor de esos recursos.</p>' +
        '<p>Regla (primal max → dual min):</p>' +
        '<ul class="teach-steps">' +
        '<li>Una restricción ≤ crea una variable dual y<sub>i</sub> ≥ 0.</li>' +
        '<li>Una restricción = crea y<sub>i</sub> libre.</li>' +
        '<li>Una restricción ≥ crea y<sub>i</sub> ≤ 0.</li>' +
        '<li>El lado derecho b se vuelve el costo del dual. Los costos c se vuelven el lado derecho del dual.</li>' +
        '</ul>' +
        '<p>Reddy Mikks dual: min w = 24y1+6y2+y3+2y4, óptimo y=(3/4, 1/2, 0, 0), w=21=z.</p>',
      video: {
        id: 'tAdaNMoSeVU', title: 'Modelo primal y dual en programación lineal (Marcel Ruiz)',
        dur: '7 min', lang: 'español',
        why: 'Cómo escribir el dual a partir del primal, regla por regla. Es el ítem h del examen 1 (4 puntos).'
      },
      refs: [
        WIKI_DUAL,
        { title: 'Dualidad primal y dual (Asesor Juan Manuel)', url: 'https://www.youtube.com/watch?v=FN6jmT6po3s', note: '9 min, max y min, con Solver.' }
      ],
      exam: 'Examen 1 ítem h (4 puntos): escribir el dual de Lumbreras. Min W=200y1+240y2, 4y1+6y2≥7, 5y1+3y2≥10, y≥0.'
    },
    'cap4-s2': {
      viz: 'dual-balance',
      primer:
        '<p><strong>De cero. Relaciones.</strong> Dualidad débil: para cualquier par factible, z ≤ w (en un max/min). Dualidad fuerte: en el óptimo z* = w*.</p>' +
        '<p>Tres formas de leer y* desde el tableau óptimo: y = c<sub>B</sub> B⁻¹; los coeficientes z de las holguras; o y<sub>i</sub> = z<sub>j</sub>−c<sub>j</sub> de la variable inicial asociada.</p>',
      video: {
        id: 'FN6jmT6po3s', title: 'Dualidad: problema primal y dual (Asesor Juan Manuel)',
        dur: '9 min', lang: 'español',
        why: 'Relación z = w en el óptimo. Holgura complementaria: si un recurso sobra, su dual vale 0.'
      },
      refs: [WIKI_DUAL],
      exam: 'Tarea Dual_a_Primal.pdf: del dual óptimo reconstruir el primal con holgura complementaria. El módulo «Ejercicios de clase» tiene un modo «Hazlo tú».'
    },
    'cap4-s3': {
      primer:
        '<p><strong>De cero. Lectura económica.</strong> y<sub>i</sub> es lo máximo que pagaría por una unidad más del recurso i. Si y<sub>i</sub>=0 el recurso sobra. Una actividad conviene si el valor de los recursos que consume no supera su ingreso (costo reducido ≤ 0 en un max).</p>',
      video: {
        id: '0SCg4pbUN1k', title: 'Introducción al análisis de sensibilidad (GOAL PROJECT)',
        dur: '12 min', lang: 'español',
        why: 'Precio sombra = variable dual. Es la interpretación económica que hay que escribir en el examen.'
      },
      refs: [WIKI_DUAL],
      exam: 'En Lumbreras: y1=2 (impresión escasa), y2=0 (encuadernación sobra 120 h).'
    },
    'cap4-s4': {
      primer:
        '<p><strong>De cero. Simplex dual.</strong> Arranca con una tabla que ya es “óptima” en la fila z, pero algún lado derecho es negativo (no factible). Sale la fila más negativa. Entra la columna que da el menor cociente |z<sub>j</sub>−c<sub>j</sub>|/|a<sub>rj</sub>| entre los a<sub>rj</sub> &lt; 0. Si esa fila no tiene negativos, el primal no es factible.</p>',
      video: {
        id: 'K0kzoaTbmT0', title: 'Método simplex dual (GOAL PROJECT)',
        dur: '13 min', lang: 'español',
        why: 'Sale la fila más negativa, entra por el menor cociente. El widget de este capítulo hace el pivote dual paso a paso.'
      },
      refs: [WIKI_DUAL, WIKI_SX],
      exam: 'Puede entrar como problema corto de min con ≥. Practique el ejemplo Taha: min 3x1+2x2, óptimo (3/5, 6/5), z=21/5.'
    },
    'cap4-s5': {
      primer:
        '<p><strong>De cero. Postóptimo.</strong> No resuelva de cero. Reuse B⁻¹.</p>' +
        '<ul class="teach-steps">' +
        '<li>Cambia b: X<sub>B</sub> = B⁻¹ b. Si algún componente es &lt; 0, corra simplex dual.</li>' +
        '<li>Cambia c o agrega una variable: recalcule la fila z con y·a<sub>j</sub> − c<sub>j</sub>. Si sigue óptima, listo; si no, simplex primal.</li>' +
        '<li>Agrega una restricción: si el óptimo actual la cumple, no haga nada; si no, agréguela y use simplex dual.</li>' +
        '</ul>',
      video: {
        id: 'TXjGnhNco4I', title: 'Análisis de sensibilidad en PL con Solver de Excel (GEOTutoriales)',
        dur: '14 min', lang: 'español',
        why: 'Informe de sensibilidad de Solver: precios sombra y rangos. Es el ítem i del examen 1, con números.'
      },
      refs: [{ title: 'Taha §4.5 TOYCO postóptimo', url: 'https://es.wikipedia.org/wiki/An%C3%A1lisis_de_sensibilidad', note: 'cambiar b, cambiar c, nueva actividad.' }],
      exam: 'Examen 1: ejemplo de post-óptimo. “Si impresión pasa de 200 a 210, Z sube 10×2=20.”'
    },

    'cap5-s1': {
      viz: 'transport-3d',
      vizCaption: 'Red de transporte A, B → T1 T2 T3',
      primer:
        '<p><strong>De cero. Transporte.</strong> Hay orígenes con oferta y destinos con demanda. Cada arco tiene un costo. Se busca el plan de envíos de menor costo.</p>' +
        '<p>Si oferta total = demanda total, el modelo está <strong>balanceado</strong> y las restricciones van con igualdad. Si no, se agrega un origen o destino ficticio (costo 0, o M si el arco no existe).</p>' +
        '<p>Variables: x<sub>ij</sub> = cantidad enviada de i a j. Una por arco.</p>' +
        '<p>MG Auto (Taha): 3 plantas × 2 centros, óptimo 313 200.</p>',
      video: {
        id: 'jlz5NqkDR6A', title: 'Explicación del modelo de transporte, parte 1 (Marcel Ruiz)',
        dur: '11 min', lang: 'español',
        why: 'Cubre el ítem de 8 puntos: grafo, variables, objetivo y restricciones.'
      },
      refs: [WIKI_TR],
      exam: 'En todos los exámenes hay transporte. A veces solo formulación; a veces también costo mínimo o noroeste. Balanceado: oferta = demanda.'
    },
    'cap5-s2': {
      primer:
        '<p><strong>De cero.</strong> Un problema que no parece transporte a veces lo es: producción + inventario a lo largo de meses (no se puede “producir hacia atrás”: costo M), o recolección de herramientas. Se mapea período-origen y período-destino.</p>',
      video: {
        id: 'kTiDbSPcups', title: 'Explicación del modelo de transporte (Marcel Ruiz)',
        dur: '25 min', lang: 'español',
        why: 'La formulación es la misma; solo cambian los nombres de los nodos (producción-inventario, energía).'
      },
      refs: [{ title: 'Taha §5.2', url: 'https://es.wikipedia.org/wiki/Problema_del_transporte', note: 'producción-inventario como transporte.' }],
      exam: 'Prioridad media. El examen de plantas de energía es un transporte disfrazado (red externa = origen extra, ciudad 3 sin arco = costo M).'
    },
    'cap5-s3': {
      viz: 'transport-3d',
      primer:
        '<p><strong>De cero. Cómo se resuelve a mano.</strong></p>' +
        '<p><em>Inicio</em> (solución básica factible, m+n−1 celdas):</p>' +
        '<ol class="teach-steps">' +
        '<li><strong>Noroeste:</strong> llene la esquina superior izquierda al máximo, tache fila o columna, siga. Ignora costos. Rápido y malo.</li>' +
        '<li><strong>Costo mínimo:</strong> llene la celda más barata disponible. Mejor.</li>' +
        '<li><strong>Vogel:</strong> penalización = diferencia de los dos costos menores de cada fila/columna. Asigne en la línea de mayor penalización, en su celda más barata. Casi óptimo.</li>' +
        '</ol>' +
        '<p><em>Mejora MODI (multiplicadores):</em> u<sub>i</sub>+v<sub>j</sub>=c<sub>ij</sub> en básicas (u1=0). En no básicas evalúe u<sub>i</sub>+v<sub>j</sub>−c<sub>ij</sub>. Si alguna es &gt; 0 (min), esa celda entra. Ciclo +/−, θ = mínimo de las celdas −, esa sale. Repita hasta que todas las evaluaciones sean ≤ 0.</p>' +
        '<p>SunRay (Taha): NW 520, costo mínimo 475, Vogel 475, óptimo MODI <strong>435</strong>.</p>',
      video: {
        id: 'oH4mxLFZw58', title: 'Método de aproximación de Vogel (Marcel Ruiz)',
        dur: '11 min', lang: 'español',
        why: 'Vogel es el mejor inicio. 11 minutos, pizarrón. En el examen de plantas piden costo mínimo; practique también noroeste.'
      },
      refs: [
        WIKI_TR,
        { title: 'Esquina noroeste (IngeChay)', url: 'https://www.youtube.com/watch?v=IyogQ4noci0', note: '8 min.' },
        { title: 'Costo mínimo (Marcel Ruiz)', url: 'https://www.youtube.com/watch?v=n5cXI10tZMw', note: '3 min. Es el método del ítem de plantas de energía.' },
        { title: 'Transporte a mano · salto de piedra (Marcel Ruiz)', url: 'https://www.youtube.com/watch?v=RTO8yk6nZY4', note: '34 min, mejora de la solución inicial (MODI / stepping-stone).' }
      ],
      exam: 'Examen 3: costo mínimo en plantas de energía, Z = 49 710. Pizarra: noroeste 10 900 vs costo mínimo 8 405, óptimo 7 980. Recuerde m+n−1 básicas.'
    },
    'cap5-s4': {
      primer:
        '<p><strong>De cero. Asignación / método húngaro.</strong> Caso de transporte con ofertas y demandas = 1 (una persona a una tarea). Matriz cuadrada.</p>' +
        '<ol class="teach-steps">' +
        '<li>Reste el mínimo de cada fila.</li>' +
        '<li>Reste el mínimo de cada columna.</li>' +
        '<li>Cubra los ceros con el mínimo de líneas. Si líneas = n, asigne (un cero por fila y columna).</li>' +
        '<li>Si líneas &lt; n: reste el mínimo no cubierto a los no cubiertos y súmelo en los cruces de líneas. Vuelva a 3.</li>' +
        '</ol>' +
        '<p>Maximización: reste cada entrada del máximo de la matriz y siga como minimización. Joboco (Taha): costo óptimo 27.</p>',
      video: {
        id: '7jl0hRf7OvE', title: 'Problema de asignación (Marcel Ruiz)',
        dur: '10 min', lang: 'español',
        why: 'Método húngaro: restar mínimos, cubrir ceros, asignar. Diez minutos, pizarrón.'
      },
      refs: [
        WIKI_HU,
        { title: 'Método húngaro de minimización', url: 'https://www.youtube.com/watch?v=AH_Nvgi9N8o', note: '7 min, otro ejemplo 3×3.' }
      ],
      exam: 'No apareció en las fotos de 2025, pero está en Taha cap. 5 y en el programa. Si entra, es un 3×3 o 4×4 a mano.'
    }
  };

  function enhance(root) {
    if (!root) return;
    var sections = root.querySelectorAll('.chapter-section');
    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      var id = sec.id;
      var lesson = LESSONS[id];
      if (!lesson) continue;
      var body = sec.querySelector('.section-body');
      if (!body) continue;
      if (body.querySelector('.teach-block')) continue;
      var holder = document.createElement('div');
      holder.innerHTML = block(lesson);
      var node = holder.firstChild;
      if (node) body.insertBefore(node, body.firstChild);
    }
  }

  IO.Teach = {
    lessons: LESSONS,
    videoCard: videoCard,
    refsHtml: refsHtml,
    vizHtml: vizHtml,
    block: block,
    enhance: enhance
  };
})(typeof window !== 'undefined' ? window : globalThis);
