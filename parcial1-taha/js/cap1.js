/* Cap 1 — Qué es la investigación de operaciones. Owner: A */
(function (global) {
  'use strict';
  var IO = global.IO = global.IO || { chapters: [] };
  IO.registerChapter = IO.registerChapter || function (ch) { IO.chapters.push(ch); };

  var CLASIFICADOR_CASOS = [
    {
      text: 'Una fábrica decide cuántas unidades de dos productos fabricar por semana para maximizar ganancia, sujeta a horas de máquina y de mano de obra disponibles (variables continuas).',
      answer: 'pl',
      explain: 'Variables continuas, función objetivo y restricciones lineales → programación lineal (PL).'
    },
    {
      text: 'Una empresa de mudanzas decide asignar 5 camiones a 5 rutas, cada camión a exactamente una ruta, minimizando el costo total.',
      answer: 'entero',
      explain: 'Decisión "sí/no" de asignación (variables binarias) → programación entera / asignación.'
    },
    {
      text: 'Se busca la ruta más corta entre dos ciudades usando un mapa de caminos con distancias conocidas.',
      answer: 'red',
      explain: 'Nodos y arcos con distancias → modelo de redes (ruta más corta).'
    },
    {
      text: 'Un banco quiere saber cuántos cajeros necesita a distintas horas del día, dado que los clientes llegan al azar y el tiempo de atención también varía.',
      answer: 'colas',
      explain: 'Llegadas y servicio aleatorios, se estudia el comportamiento del sistema en espera → teoría de colas.'
    },
    {
      text: 'Un ingeniero construye un modelo por computadora que imita, paso a paso, el funcionamiento de una línea de producción para probar distintos escenarios sin poder resolverlo con fórmulas cerradas.',
      answer: 'simulacion',
      explain: 'Se imita el comportamiento del sistema numéricamente porque es demasiado complejo para una solución analítica → simulación.'
    },
    {
      text: 'Una refinería decide la mezcla de crudos que minimiza el costo, cumpliendo especificaciones de calidad, con proporciones que pueden tomar cualquier valor real.',
      answer: 'pl',
      explain: 'Mezcla con variables continuas y relaciones lineales → programación lineal.'
    },
    {
      text: 'Una empresa de transporte de mercadería decide cuánto enviar desde 3 plantas a 2 centros de distribución, minimizando el costo de transporte, respetando oferta y demanda.',
      answer: 'red',
      explain: 'Estructura de oferta/demanda entre nodos → modelo de redes (transporte), caso particular de PL en red.'
    },
    {
      text: 'Un hospital de urgencias quiere estimar cuánto tiempo esperan en promedio los pacientes antes de ser atendidos, sabiendo la tasa de llegada y la tasa de atención.',
      answer: 'colas',
      explain: 'Pregunta típica de tiempos de espera con llegadas/servicio aleatorios → teoría de colas.'
    }
  ];

  var TIPOS = [
    { id: 'pl', label: 'Programación lineal' },
    { id: 'entero', label: 'Programación entera' },
    { id: 'red', label: 'Modelo de redes' },
    { id: 'colas', label: 'Teoría de colas' },
    { id: 'simulacion', label: 'Simulación' }
  ];

  function mountClasificador(root) {
    var el = root.querySelector('[data-widget="clasificador-modelos"]');
    if (!el) return;
    var idx = 0;

    function render() {
      var caso = CLASIFICADOR_CASOS[idx];
      var html = '<div class="row" style="justify-content:space-between;align-items:baseline;">' +
        '<span class="muted">Situación ' + (idx + 1) + ' de ' + CLASIFICADOR_CASOS.length + '</span>' +
        '</div>';
      html += '<p><strong>Caso:</strong> ' + caso.text + '</p>';
      html += '<div class="row">';
      TIPOS.forEach(function (t) {
        html += '<button type="button" class="btn btn-sm clasif-opt" data-val="' + t.id + '">' + t.label + '</button>';
      });
      html += '</div>';
      html += '<div class="clasif-feedback" hidden></div>';
      html += '<div class="step-bar">' +
        '<button type="button" class="btn btn-ghost btn-sm clasif-prev">◀ Anterior</button>' +
        '<span class="step-text">Elija el tipo de modelo que mejor describe la situación.</span>' +
        '<button type="button" class="btn btn-ghost btn-sm clasif-next">Siguiente ▶</button>' +
        '</div>';
      el.innerHTML = html;

      el.querySelectorAll('.clasif-opt').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var val = btn.getAttribute('data-val');
          var fb = el.querySelector('.clasif-feedback');
          var ok = val === caso.answer;
          fb.hidden = false;
          fb.innerHTML = '<p class="callout ' + (ok ? 'callout-tip' : 'callout-warn') + '">' +
            '<span class="badge ' + (ok ? 'badge-ok' : 'badge-err') + '">' + (ok ? 'Correcto' : 'Incorrecto') + '</span> ' +
            caso.explain + '</p>';
        });
      });
      el.querySelector('.clasif-prev').addEventListener('click', function () {
        idx = (idx - 1 + CLASIFICADOR_CASOS.length) % CLASIFICADOR_CASOS.length;
        render();
      });
      el.querySelector('.clasif-next').addEventListener('click', function () {
        idx = (idx + 1) % CLASIFICADOR_CASOS.length;
        render();
      });
    }
    render();
  }

  IO.registerChapter({
    id: 'cap1',
    num: 1,
    title: 'Qué es la investigación de operaciones',
    summary: 'Modelos, fases de un estudio de IO y el rol del arte del modelado en la solución de problemas reales.',
    css:
      '#cap1 .clasif-opt { min-width: 140px; } ' +
      '#cap1 .clasif-feedback { margin-top: 10px; }',
    sections: [
      {
        id: 'cap1-s1',
        title: '1.1 Introducción',
        html: '<p>La investigación de operaciones (IO) aplica el método científico para tomar decisiones sobre la ' +
          'operación de sistemas complejos (producción, logística, finanzas, servicios). Nace en la Segunda Guerra ' +
          'Mundial, cuando equipos mixtos analizaron problemas militares con métodos cuantitativos, y luego se ' +
          'extendió a la industria.</p>' +
          '<p class="callout callout-def"><strong>Definición operativa:</strong> la IO construye <em>modelos</em> ' +
          'matemáticos de sistemas reales para encontrar la mejor decisión posible (óptima o casi óptima) dado un ' +
          'conjunto de restricciones y un criterio de desempeño.</p>'
      },
      {
        id: 'cap1-s2',
        title: '1.2 Modelos de investigación de operaciones',
        html: '<p>Todo modelo de IO tiene tres componentes:</p>' +
          '<ul><li><strong>Alternativas (variables de decisión):</strong> las opciones que el modelo debe elegir.</li>' +
          '<li><strong>Restricciones:</strong> límites que las alternativas deben respetar.</li>' +
          '<li><strong>Criterio (función objetivo):</strong> la medida que se maximiza o minimiza para comparar alternativas.</li></ul>' +
          '<p class="callout callout-exam"><strong>Ejemplo — rectángulo de perímetro L:</strong> se quiere construir un ' +
          'jardín rectangular con un perímetro fijo L, maximizando el área. Si x e y son los lados: ' +
          '<span class="formula">max A = x·y &nbsp; sujeto a &nbsp; 2x + 2y = L, &nbsp; x, y ≥ 0</span> ' +
          'La solución (con cálculo, derivando y sustituyendo) da x = y = L/4: el rectángulo óptimo es un cuadrado.</p>' +
          '<p class="callout callout-exam"><strong>Ejemplo — cruce de calles:</strong> en una intersección con semáforos, ' +
          'las alternativas son los tiempos de luz verde asignados a cada sentido; las restricciones son los ciclos ' +
          'mínimos de seguridad y la demanda de tránsito por sentido; el criterio es minimizar el tiempo total de ' +
          'espera de los vehículos. Ilustra que un modelo de IO no siempre es "resolver una fórmula": aquí ya aparece ' +
          'la idea de optimizar un sistema con recursos compartidos (tiempo de semáforo).</p>'
      },
      {
        id: 'cap1-s3',
        title: '1.3 Solución del modelo',
        html: '<p>Un modelo se puede resolver de tres maneras, según qué tan bien se pueda representar el sistema:</p>' +
          '<div class="kv">' +
          '<div><span>Solución óptima</span><span>un algoritmo exacto garantiza la mejor solución posible (p. ej. simplex para PL).</span></div>' +
          '<div><span>Solución heurística</span><span>reglas prácticas que dan una buena solución (no necesariamente la mejor) cuando el problema es demasiado grande o complejo para resolver exactamente.</span></div>' +
          '<div><span>Solución por simulación</span><span>se imita el comportamiento del sistema con un modelo numérico/computacional cuando no hay fórmula cerrada.</span></div>' +
          '</div>'
      },
      {
        id: 'cap1-s4',
        title: '1.4 Colas y simulación (idea general)',
        html: '<p>Muchos sistemas reales (bancos, hospitales, centrales telefónicas) tienen llegadas y tiempos de servicio ' +
          'aleatorios. La <strong>teoría de colas</strong> estudia matemáticamente el comportamiento de espera de estos ' +
          'sistemas (tiempo promedio de espera, longitud de la cola, utilización del servidor). Cuando el sistema es ' +
          'demasiado complejo para fórmulas analíticas, se recurre a la <strong>simulación</strong>: un modelo ' +
          'computacional que reproduce, evento a evento, el comportamiento del sistema para estimar sus medidas de desempeño.</p>'
      },
      {
        id: 'cap1-s5',
        title: '1.5 El arte del modelado',
        html: '<p>Construir un modelo no es mecánico: implica traducir un problema del mundo real en una representación ' +
          'matemática manejable. El proceso típico es:</p>' +
          '<p class="formula">Mundo real (complejo, ambiguo) → Supuestos simplificadores → Modelo matemático (manejable)</p>' +
          '<p>Un buen modelo equilibra <em>realismo</em> (capturar lo esencial del problema) con <em>simplicidad</em> ' +
          '(poder resolverlo con las herramientas disponibles). Un modelo demasiado simple puede dar soluciones inútiles; ' +
          'uno demasiado complejo puede ser imposible de resolver o de entender.</p>'
      },
      {
        id: 'cap1-s6',
        title: '1.6 Más que matemáticas: aspectos humanos',
        html: '<p>La solución matemáticamente óptima no siempre es la mejor solución para las personas involucradas. ' +
          'Dos ejemplos clásicos del libro:</p>' +
          '<ul>' +
          '<li><strong>Ascensores con espejos:</strong> en un edificio con quejas por la espera de ascensores, la solución ' +
          'de ingeniería (agregar más ascensores) era costosa; la solución real fue instalar espejos frente a los ' +
          'ascensores. La espera objetiva (en segundos) no cambió, pero la espera percibida sí, porque la gente se ' +
          'entretenía mirándose. El problema real no era "el tiempo de espera" sino "el aburrimiento durante la espera".</li>' +
          '<li><strong>Línea de espera única:</strong> reemplazar varias filas independientes (una por cajero) por una ' +
          'sola fila que alimenta a todos los cajeros reduce la variabilidad de espera y la sensación de injusticia ' +
          '(nadie ve a alguien que llegó después ser atendido antes), aunque el tiempo promedio de espera matemático ' +
          'pueda ser similar.</li>' +
          '</ul>' +
          '<p class="callout callout-tip">Moraleja: antes de optimizar hay que asegurarse de estar modelando el problema ' +
          'correcto, y no solo el que es matemáticamente cómodo de resolver.</p>'
      },
      {
        id: 'cap1-s7',
        title: '1.7 Fases de un estudio de investigación de operaciones',
        html: '<p>Un estudio completo de IO sigue, en general, estas fases:</p>' +
          '<ol>' +
          '<li><strong>Definición del problema:</strong> alcance, alternativas, restricciones y criterio de decisión.</li>' +
          '<li><strong>Construcción del modelo:</strong> traducir el problema a una forma matemática (o simulada).</li>' +
          '<li><strong>Solución del modelo:</strong> aplicar el algoritmo apropiado (exacto, heurístico o simulación) y ' +
          'hacer análisis de sensibilidad sobre los parámetros más inciertos.</li>' +
          '<li><strong>Validación del modelo:</strong> comprobar que el modelo predice razonablemente el comportamiento ' +
          'real del sistema (con datos históricos, por ejemplo) antes de usarlo para decidir.</li>' +
          '<li><strong>Implementación de los resultados:</strong> traducir la solución matemática en instrucciones de ' +
          'operación entendibles y aceptadas por quienes manejan el sistema.</li>' +
          '</ol>' +
          '<div class="widget wide" data-widget="clasificador-modelos"></div>'
      }
    ],
    mount: function (root) {
      mountClasificador(root);
    },
    quiz: [
      { q: 'Los tres componentes de todo modelo de IO son:', options: [
          'Variables, parámetros y coeficientes',
          'Alternativas, restricciones y criterio',
          'Datos, algoritmo y resultado',
          'Entradas, proceso y salidas'
        ], answer: 1, explain: 'Todo modelo de IO se define por sus alternativas (variables de decisión), sus restricciones y su criterio (función objetivo).' },
      { q: 'En el ejemplo del rectángulo de perímetro L, la forma que maximiza el área es:', options: [
          'Un rectángulo muy alargado', 'Un triángulo', 'Un cuadrado', 'Un círculo'
        ], answer: 2, explain: 'Con 2x+2y=L fijo, el área x·y se maximiza cuando x=y=L/4, es decir, un cuadrado.' },
      { q: 'Una solución heurística se caracteriza porque:', options: [
          'Siempre da la solución óptima', 'Da una buena solución, no necesariamente óptima, cuando el problema es muy complejo',
          'Solo aplica a modelos de colas', 'Requiere simulación por computadora'
        ], answer: 1, explain: 'Las heurísticas sacrifican la garantía de optimalidad a cambio de poder resolver problemas grandes o complejos en tiempo razonable.' },
      { q: 'La teoría de colas estudia principalmente:', options: [
          'La asignación óptima de tareas a máquinas', 'El comportamiento de sistemas con llegadas y/o servicio aleatorios',
          'La mezcla óptima de productos', 'El transporte al mínimo costo'
        ], answer: 1, explain: 'La teoría de colas modela sistemas de espera con llegadas y/o tiempos de servicio aleatorios.' },
      { q: 'La simulación se usa típicamente cuando:', options: [
          'El problema es lineal y pequeño', 'Existe una fórmula cerrada simple', 'El sistema es demasiado complejo para una solución analítica',
          'Solo hay dos variables de decisión'
        ], answer: 2, explain: 'La simulación imita el comportamiento del sistema numéricamente cuando no es posible (o práctico) resolverlo analíticamente.' },
      { q: 'El proceso de modelado descrito en 1.5 va, en general, en el sentido:', options: [
          'Modelo matemático → supuestos → mundo real', 'Mundo real → supuestos simplificadores → modelo matemático',
          'Supuestos → mundo real → validación', 'Validación → modelo → supuestos'
        ], answer: 1, explain: 'Se parte del sistema real, se simplifica con supuestos razonables y se llega a un modelo matemático manejable.' },
      { q: 'En el caso de los ascensores con espejos, el verdadero problema resultó ser:', options: [
          'La capacidad insuficiente de los ascensores', 'El aburrimiento durante la espera, no el tiempo de espera en sí',
          'La falta de mantenimiento', 'El costo eléctrico de los ascensores'
        ], answer: 1, explain: 'El tiempo objetivo de espera no cambió; lo que cambió fue la percepción, al dar algo con qué entretenerse durante la espera.' },
      { q: 'Usar una única fila de espera para varios cajeros, en vez de una fila por cajero, principalmente:', options: [
          'Reduce a cero el tiempo de espera', 'Reduce la variabilidad y la sensación de injusticia en la espera',
          'Aumenta el costo operativo', 'Es un modelo de programación entera'
        ], answer: 1, explain: 'La fila única reparte la espera de forma más pareja y evita que alguien vea a otro "colarse" al ser atendido antes.' },
      { q: 'La fase de "validación del modelo" en un estudio de IO consiste en:', options: [
          'Programar el modelo en una computadora', 'Comprobar que el modelo predice razonablemente el comportamiento real antes de usarlo',
          'Definir las restricciones del problema', 'Elegir el algoritmo de solución'
        ], answer: 1, explain: 'La validación compara las predicciones del modelo con el comportamiento real (por ejemplo con datos históricos) antes de confiar en sus resultados.' },
      { q: 'La fase final de un estudio de IO es:', options: [
          'La construcción del modelo', 'La solución matemática', 'La implementación de los resultados', 'La definición del problema'
        ], answer: 2, explain: 'Un estudio de IO termina cuando la solución se traduce en instrucciones de operación reales y se pone en práctica.' },
      { q: 'Un modelo demasiado simplificado respecto del sistema real corre el riesgo de:', options: [
          'Ser imposible de resolver', 'Dar una solución que no sirva para el problema real', 'Tardar demasiado en resolverse', 'Requerir demasiadas variables'
        ], answer: 1, explain: 'Si el modelo pierde lo esencial del problema, su "solución óptima" puede no aplicar al sistema real.' },
      { q: 'Elegir cuántos ascensores instalar en un edificio nuevo, con variables continuas de capacidad y costo, y una función lineal de costo total, es un ejemplo típico de:', options: [
          'Teoría de colas pura', 'Programación lineal', 'Simulación obligatoria', 'Método húngaro'
        ], answer: 1, explain: 'Con relaciones lineales entre variables continuas de decisión, restricciones y un objetivo, corresponde a programación lineal.' }
    ]
  });
})(typeof window !== 'undefined' ? window : globalThis);
