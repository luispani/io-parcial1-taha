/* Tareas — Ejercicios de clase (modelado, simplex formato de clase, dual->primal).
 * Owner: this file + tests/tareas.test.js only. Depends on Frac, IO.Simplex (not called directly —
 * this file implements its own small tableau engine to control the exact class format and to stay
 * independent from IO.Simplex.solve's `rule` option, owned by another file), IO.__cap2.solveLP
 * (2-variable graphic solver), window.IO contract (SPEC.md §2).
 *
 * IMPORTANTE (decisión pedagógica): las 8 tareas reales de la clase (ejercicio del precio-demanda
 * más los 7 de "armar el modelo": Reddy Mikks, Show and Sell, Wild West, Top Toys, material
 * escolar, pastillas, calculadoras) se muestran SOLO como enunciado. El corrector da un veredicto
 * GLOBAL por categoría (objetivo / restricciones / dominio), nunca línea por línea, y nunca
 * imprime el modelo correcto ni el óptimo. Hay un botón de pistas semánticas (sin números, máximo
 * 3) y un contador de intentos. El modelo correcto y el óptimo de esas 8 tareas viven ÚNICAMENTE
 * en los datos de este archivo (para poder verificar) y NUNCA se resuelven con el motor gráfico
 * para esos ítems. Todo el método paso a paso (con solución completa, vértices y óptimo) se enseña
 * con un ejercicio SIMILAR de cada tipo (otros números, otro contexto), y el simplex/hazlo-tú de la
 * sección B y los ejemplos de la sección C usan también números que no coinciden con ninguna tarea
 * real de la clase.
 */
(function () {
  'use strict';
  window.IO = window.IO || { chapters: [] };
  IO.registerChapter = IO.registerChapter || function (ch) { IO.chapters.push(ch); };
  /* Fallback si tareas.js carga antes que app.js (ver SPEC.md §2, "Desmontaje y limpieza"). */
  IO.registerCleanup = IO.registerCleanup || function (fn) { (IO._cleanups = IO._cleanups || []).push(fn); };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function opSym(op) { return op === '<=' ? '≤' : (op === '>=' ? '≥' : '='); }
  function fmtNum(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    var r = Math.round(n * 1000) / 1000;
    return (Object.is(r, -0) ? 0 : r).toString();
  }
  function signedTerm(v, name, first) {
    var av = Math.abs(v) === 1 ? '' : fmtNum(Math.abs(v));
    var sign = v < 0 ? '- ' : (first ? '' : '+ ');
    return sign + av + name;
  }
  var INTEGER_NOTE = 'En la realidad son cantidades enteras; en este curso (cap 1–5) se resuelven como PL continua.';

  /* =========================================================================
   * A) MODELADO — utilidades genéricas de verificación de modelos
   * ========================================================================= */

  /** Encuentra k tal que u = k·c (dentro de tolerancia), sin restringir el signo de k.
   * Devuelve null si no son proporcionales. u y c son arreglos numéricos del mismo largo. */
  function findProportionalK(u, c, tol) {
    tol = tol === undefined ? 1e-6 : tol;
    var k = null;
    for (var i = 0; i < u.length; i++) {
      if (Math.abs(c[i]) > 1e-9) { k = u[i] / c[i]; break; }
    }
    if (k === null) {
      var allZero = true;
      for (i = 0; i < u.length; i++) if (Math.abs(u[i]) > 1e-6) allZero = false;
      return allZero ? 1 : null;
    }
    for (i = 0; i < u.length; i++) {
      if (Math.abs(u[i] - k * c[i]) > tol * (1 + Math.abs(c[i]) + Math.abs(u[i]))) return null;
    }
    return k;
  }
  function proportionalPositive(u, c, tol) { var k = findProportionalK(u, c, tol); return (k !== null && k > 1e-9) ? k : null; }
  function proportionalNegative(u, c, tol) { var k = findProportionalK(u, c, tol); return (k !== null && k < -1e-9) ? k : null; }
  function proportionalNonzero(u, c, tol) { var k = findProportionalK(u, c, tol); return (k !== null && Math.abs(k) > 1e-9) ? k : null; }

  /** ¿La restricción del usuario es equivalente a la correcta? Reglas:
   * - '=' correcta: el usuario debe usar '=' y cualquier múltiplo NO nulo (positivo o negativo).
   * - '≤'/'≥' con el MISMO operador: acepta cualquier múltiplo POSITIVO.
   * - '≤'/'≥' con el operador CONTRARIO: acepta un múltiplo NEGATIVO (multiplicar ambos lados por
   *   un negativo invierte la desigualdad; ej. x1−2x2≥0 es lo mismo que −x1+2x2≤0). */
  function constraintsEquivalent(userRow, correctRow) {
    var uVec = userRow.a.concat([userRow.b]);
    var cVec = correctRow.a.concat([correctRow.b]);
    if (correctRow.op === '=') {
      return userRow.op === '=' && proportionalNonzero(uVec, cVec) !== null;
    }
    if (userRow.op === correctRow.op) return proportionalPositive(uVec, cVec) !== null;
    var flipped = correctRow.op === '<=' ? '>=' : '<=';
    if (userRow.op === flipped) return proportionalNegative(uVec, cVec) !== null;
    return false;
  }

  /** Clasifica la función objetivo del usuario contra la correcta: 'exact' (coeficientes exactos),
   * 'multiple' (múltiplo positivo — mismo óptimo en x, pero z cambia de escala) o 'wrong'. */
  function classifyObjective(userC, correctC, tol) {
    tol = tol === undefined ? 1e-6 : tol;
    var exact = true;
    for (var i = 0; i < correctC.length; i++) {
      if (Math.abs((userC[i] || 0) - correctC[i]) > tol * (1 + Math.abs(correctC[i]))) exact = false;
    }
    if (exact) return 'exact';
    var k = proportionalPositive(userC, correctC, tol);
    return k !== null ? 'multiple' : 'wrong';
  }

  /** Verifica un modelo armado por el usuario contra el modelo correcto y devuelve un veredicto
   * GLOBAL por categoría (nunca cuál fila ni qué coeficiente). userObj: {c:[...], sense}.
   * userConstraints: [{a:[...],op,b}]. correct: {c:[...], sense, constraints:[{a:[...],op,b}]}. */
  function verifyModel(userObj, userConstraints, correct) {
    var objStatus = classifyObjective(userObj.c, correct.c);
    var senseOk = userObj.sense === correct.sense;

    var usedCorrect = new Array(correct.constraints.length).fill(false);
    var matchedRows = userConstraints.map(function () { return -1; });
    userConstraints.forEach(function (row, ui) {
      for (var ci = 0; ci < correct.constraints.length; ci++) {
        if (usedCorrect[ci]) continue;
        if (constraintsEquivalent(row, correct.constraints[ci])) { usedCorrect[ci] = true; matchedRows[ui] = ci; break; }
      }
    });
    var consOk = userConstraints.length === correct.constraints.length &&
      matchedRows.every(function (m) { return m !== -1; });

    var categories = [];
    if (objStatus === 'wrong') categories.push('objetivo');
    if (!consOk) categories.push('restricciones');
    if (!senseOk) categories.push('dominio');

    var verdict;
    if (categories.length === 0 && objStatus === 'exact') {
      verdict = { level: 'ok', text: 'El modelo es equivalente al esperado.' };
    } else if (categories.length === 0 && objStatus === 'multiple') {
      verdict = {
        level: 'warn',
        text: 'Las restricciones y el sentido (max/min) son correctos, pero la función objetivo es un múltiplo positivo de la esperada: el óptimo (x*) es el mismo, pero el valor de z cambia; en el parcial se corrige el z exacto.'
      };
    } else {
      var extra = objStatus === 'multiple' ? ' (el objetivo es un múltiplo: revise el valor exacto de cada coeficiente)' : '';
      verdict = { level: 'err', text: 'Todavía no. Revisa: ' + categories.join(' / ') + '.' + extra };
    }
    return { objStatus: objStatus, consOk: consOk, senseOk: senseOk, matchedRows: matchedRows, verdict: verdict };
  }

  /* =========================================================================
   * A) MODELADO — datos: los 7 modelos "armar el modelo" de la clase (tarea, sin
   * solución visible, con pistas semánticas sin números) y un ejercicio de cada
   * tipo ya resuelto (worked, con otros números, para enseñar el método).
   * ========================================================================= */

  var MODEL_EXERCISES = [
    {
      id: 'reddy', kind: 'task', title: '2. Reddy Mikks (resuélvalo usted)',
      statement: 'Reddy produce pinturas para interiores y exteriores con dos materias primas M1 y M2. Cada tonelada de pintura exterior usa 6 ton de M1 y 1 de M2; cada tonelada de interior usa 4 de M1 y 2 de M2. La disponibilidad diaria es 24 ton de M1 y 6 ton de M2. La demanda diaria de interior no puede exceder la de exterior en más de 1 tonelada, y la demanda diaria de interior no supera las 2 toneladas. Utilidad: $5/ton exterior, $4/ton interior. Maximizar la utilidad diaria.',
      varNames: ['x1', 'x2'], sense: 'max', c: [5, 4],
      constraints: [
        { a: [6, 4], op: '<=', b: 24, label: 'M1' },
        { a: [1, 2], op: '<=', b: 6, label: 'M2' },
        { a: [-1, 1], op: '<=', b: 1, label: 'mercado' },
        { a: [0, 1], op: '<=', b: 2, label: 'demanda' }
      ],
      hints: [
        'Hay dos materias primas que limitan la producción: identifique qué recurso restringe cada una.',
        'La restricción de mercado compara la demanda de un producto con la del otro: fíjese cuál no puede superar a cuál, y por cuánto.',
        'Hay una restricción que es un tope directo sobre una sola variable, sin relacionarla con la otra.'
      ]
    },
    {
      id: 'reddy-worked', kind: 'worked', title: 'Resuelto (mismo tipo: mezcla de recursos): ColorMax',
      statement: 'ColorMax produce pinturas de interior y exterior con materias primas M1 y M2. Cada ton de exterior usa 4 de M1 y 1 de M2; cada ton de interior usa 2 de M1 y 2 de M2. Disponibilidad diaria: 16 ton de M1, 8 ton de M2. La demanda de interior no excede a la de exterior en más de 1 ton, y la demanda de interior no supera las 3 ton. Utilidad: $4/ton exterior, $3/ton interior. Maximizar la utilidad diaria.',
      varNames: ['x1', 'x2'], varDesc: ['x1 = ton/día de pintura para exteriores', 'x2 = ton/día de pintura para interiores'],
      sense: 'max', c: [4, 3],
      constraints: [
        { a: [4, 2], op: '<=', b: 16, label: 'M1', explain: 'Consumo de M1 por ton de cada tipo, hasta la disponibilidad diaria de 16 ton.' },
        { a: [1, 2], op: '<=', b: 8, label: 'M2', explain: 'Consumo de M2 por ton de cada tipo, hasta la disponibilidad diaria de 8 ton.' },
        { a: [-1, 1], op: '<=', b: 1, label: 'mercado', explain: 'x2 − x1 ≤ 1: interior no excede a exterior en más de 1 ton.' },
        { a: [0, 1], op: '<=', b: 3, label: 'demanda', explain: 'Demanda máxima de interior: 3 ton/día.' }
      ]
    },
    {
      id: 'showsell', kind: 'task', title: '3. Show and Sell (resuélvalo usted)',
      statement: 'Show and Sell publicita en radio y TV. Presupuesto mensual: $10 000. Cada minuto de radio cuesta $15 y cada minuto de TV $300. Quiere anunciarse en radio por lo menos el doble de minutos que en TV. No es práctico usar más de 400 minutos de radio al mes. La TV es 25 veces más efectiva que la radio. Maximizar la efectividad total.',
      varNames: ['x1', 'x2'], sense: 'max', c: [1, 25],
      constraints: [
        { a: [15, 300], op: '<=', b: 10000, label: 'presupuesto' },
        { a: [1, -2], op: '>=', b: 0, label: 'proporción' },
        { a: [1, 0], op: '<=', b: 400, label: 'límite de radio' }
      ],
      hints: [
        '¿Tradujo "por lo menos el doble" como una desigualdad entre las dos variables, y de qué lado quedó cada una?',
        'El presupuesto combina el costo de los dos medios en una sola restricción.',
        'Hay un tope que aplica solamente a una de las variables, no a la combinación de ambas.'
      ]
    },
    {
      id: 'showsell-worked', kind: 'worked', title: 'Resuelto (mismo tipo: publicidad con proporción): AdBoost',
      statement: 'AdBoost publicita en radio y TV con presupuesto mensual de $8000. Cada minuto de radio cuesta $10 y cada minuto de TV $250. Quiere que la radio triplique como mínimo a la TV en minutos. No es práctico superar 350 minutos de radio al mes. La TV es 20 veces más efectiva. Maximizar la efectividad total.',
      varNames: ['x1', 'x2'], varDesc: ['x1 = minutos de radio al mes', 'x2 = minutos de TV al mes'],
      sense: 'max', c: [1, 20],
      constraints: [
        { a: [10, 250], op: '<=', b: 8000, label: 'presupuesto', explain: 'Costo total de radio y TV no supera el presupuesto de $8000.' },
        { a: [1, -3], op: '>=', b: 0, label: 'proporción', explain: 'Radio triplica como mínimo a TV: x1 ≥ 3x2 ⇒ x1 − 3x2 ≥ 0.' },
        { a: [1, 0], op: '<=', b: 350, label: 'límite de radio', explain: 'Tope práctico de 350 minutos de radio al mes.' }
      ]
    },
    {
      id: 'wildwest', kind: 'task', title: '4. Wild West (resuélvalo usted)', integerNote: true,
      statement: 'Wild West produce sombreros tipo 1 y tipo 2. El tipo 1 requiere el doble de mano de obra que el tipo 2. Si toda la mano de obra se dedica al tipo 2, se pueden producir 400 sombreros tipo 2 al día. Límites de mercado: 150 (tipo 1) y 200 (tipo 2) por día. Utilidad: $8 (tipo 1), $5 (tipo 2). Maximizar la utilidad diaria.',
      varNames: ['x1', 'x2'], sense: 'max', c: [8, 5],
      constraints: [
        { a: [2, 1], op: '<=', b: 400, label: 'mano de obra' },
        { a: [1, 0], op: '<=', b: 150, label: 'mercado tipo 1' },
        { a: [0, 1], op: '<=', b: 200, label: 'mercado tipo 2' }
      ],
      hints: [
        'La mano de obra total depende de cuánto se fabrica de cada tipo, no en partes iguales entre ambos.',
        'Hay un tope de mercado distinto para cada tipo de producto, cada uno con su propia restricción.',
        'Piense la restricción de mano de obra como un equivalente en unidades del tipo que menos mano de obra usa.'
      ]
    },
    {
      id: 'wildwest-worked', kind: 'worked', title: 'Resuelto (mismo tipo: mano de obra compartida): Sombreros del Sur', integerNote: true,
      statement: 'Sombreros del Sur produce sombreros tipo 1 y tipo 2. El tipo 1 requiere el triple de mano de obra que el tipo 2. Si toda la mano de obra se dedica al tipo 2, se producen 300 sombreros tipo 2 al día. Límites de mercado: 80 (tipo 1) y 150 (tipo 2). Utilidad: $6 (tipo 1), $4 (tipo 2). Maximizar la utilidad diaria.',
      varNames: ['x1', 'x2'], varDesc: ['x1 = sombreros tipo 1 por día', 'x2 = sombreros tipo 2 por día'],
      sense: 'max', c: [6, 4],
      constraints: [
        { a: [3, 1], op: '<=', b: 300, label: 'mano de obra', explain: 'El tipo 1 usa el triple de mano de obra que el tipo 2; el total no puede superar lo que alcanza para 300 sombreros tipo 2.' },
        { a: [1, 0], op: '<=', b: 80, label: 'mercado tipo 1', explain: 'Tope de mercado de 80 sombreros tipo 1 por día.' },
        { a: [0, 1], op: '<=', b: 150, label: 'mercado tipo 2', explain: 'Tope de mercado de 150 sombreros tipo 2 por día.' }
      ]
    },
    {
      id: 'toptoys', kind: 'task', title: '5. Top Toys (resuélvalo usted)', constant: 4500, integerNote: true,
      statement: 'Top Toys planea publicidad por radio y TV. Un comercial de radio cuesta $300 y uno de TV $2000, con presupuesto total $20 000. Debe haber al menos un comercial de cada medio, y lo asignado a un medio no puede superar el 80% del presupuesto total. El primer comercial de radio llega a 5000 personas y cada adicional a 2000 nuevas; en TV el primero llega a 4500 y cada adicional a 3000. Maximizar el alcance total.',
      varNames: ['x1', 'x2'], sense: 'max', c: [2000, 3000],
      constraints: [
        { a: [300, 2000], op: '<=', b: 20000, label: 'presupuesto' },
        { a: [300, 0], op: '<=', b: 16000, label: 'tope radio' },
        { a: [0, 2000], op: '<=', b: 16000, label: 'tope TV' },
        { a: [1, 0], op: '>=', b: 1, label: 'mínimo radio' },
        { a: [0, 1], op: '>=', b: 1, label: 'mínimo TV' }
      ],
      hints: [
        'Hay una restricción de presupuesto total y, además, un tope aparte para cada medio.',
        'El enunciado exige un mínimo de anuncios en cada medio: ¿cómo se escribe eso como restricción?',
        'Los topes por medio son una fracción del presupuesto total, no del gasto de cada medio por separado.'
      ],
      constantNote: 'La fórmula de alcance total incluye una constante aditiva que no depende de las variables (viene de restar lo que ya cuenta el primer anuncio de cada medio); usted debe derivarla del enunciado. Aquí solo se verifica la parte lineal (z); el alcance total = z + esa constante.'
    },
    {
      id: 'toptoys-worked', kind: 'worked', title: 'Resuelto (mismo tipo: presupuesto con mínimos y topes): MegaAds', constant: 1300, integerNote: true,
      statement: 'MegaAds planea publicidad por radio y TV. Un comercial de radio cuesta $200 y uno de TV $1500, presupuesto total $12 000. Debe haber al menos un comercial de cada medio y ninguno puede superar el 80% del presupuesto ($9600 en cada medio). El primer anuncio de radio llega a 2000 personas y cada uno adicional a 1000 nuevas; el primer anuncio de TV llega a 1800 y cada uno adicional a 1500. Maximizar el alcance total.',
      varNames: ['x1', 'x2'], varDesc: ['x1 = cantidad de comerciales de radio', 'x2 = cantidad de comerciales de TV'],
      sense: 'max', c: [1000, 1500],
      constraints: [
        { a: [200, 1500], op: '<=', b: 12000, label: 'presupuesto', explain: 'Costo total no supera el presupuesto de $12 000.' },
        { a: [200, 0], op: '<=', b: 9600, label: 'tope radio', explain: 'Tope del 80 % del presupuesto para radio: 0.8 × $12 000 = $9600.' },
        { a: [0, 1500], op: '<=', b: 9600, label: 'tope TV', explain: 'Tope del 80 % del presupuesto para TV: 0.8 × $12 000 = $9600.' },
        { a: [1, 0], op: '>=', b: 1, label: 'mínimo radio', explain: 'Al menos un comercial de radio.' },
        { a: [0, 1], op: '>=', b: 1, label: 'mínimo TV', explain: 'Al menos un comercial de TV.' }
      ],
      formulaNote: 'Fórmula del alcance: el primer anuncio de radio llega a 2000 personas y cada uno adicional a 1000 nuevas ⇒ alcance radio = 2000 + 1000(x1 − 1) = 1000x1 + 1000. El primer anuncio de TV llega a 1800 y cada uno adicional a 1500 ⇒ alcance TV = 1800 + 1500(x2 − 1) = 1500x2 + 300. Alcance total = 1000x1 + 1500x2 + 1300.'
    },
    {
      id: 'material', kind: 'task', title: '6. Material escolar (resuélvalo usted)', integerNote: true,
      statement: 'Se ofrecen 600 cuadernos, 500 carpetas y 400 bolígrafos empaquetados de dos formas: paquete 1 (2 cuadernos, 1 carpeta, 2 bolígrafos, $6.5) y paquete 2 (3 cuadernos, 1 carpeta, 1 bolígrafo, $7). Maximizar el beneficio.',
      varNames: ['x1', 'x2'], sense: 'max', c: [6.5, 7],
      constraints: [
        { a: [2, 3], op: '<=', b: 600, label: 'cuadernos' },
        { a: [1, 1], op: '<=', b: 500, label: 'carpetas' },
        { a: [2, 1], op: '<=', b: 400, label: 'bolígrafos' }
      ],
      hints: [
        'Cada paquete consume una cantidad distinta de cada insumo escolar: hay tantas restricciones como insumos.',
        'El stock disponible de cada insumo es el lado derecho de su restricción.',
        'Ningún insumo puede superar su disponibilidad total entre ambos paquetes.'
      ]
    },
    {
      id: 'material-worked', kind: 'worked', title: 'Resuelto (mismo tipo: paquetes con varios insumos): Kit Escolar Plus', integerNote: true,
      statement: 'Se ofrecen 480 cuadernos, 200 carpetas y 300 bolígrafos, empaquetados como: paquete 1 (3 cuadernos, 1 carpeta, 1 bolígrafo, $5) y paquete 2 (2 cuadernos, 1 carpeta, 2 bolígrafos, $6). Maximizar el beneficio.',
      varNames: ['x1', 'x2'], varDesc: ['x1 = paquetes tipo 1 vendidos', 'x2 = paquetes tipo 2 vendidos'],
      sense: 'max', c: [5, 6],
      constraints: [
        { a: [3, 2], op: '<=', b: 480, label: 'cuadernos', explain: 'Consumo de cuadernos por paquete, hasta el stock de 480.' },
        { a: [1, 1], op: '<=', b: 200, label: 'carpetas', explain: 'Cada paquete usa 1 carpeta; stock de 200.' },
        { a: [1, 2], op: '<=', b: 300, label: 'bolígrafos', explain: 'Consumo de bolígrafos por paquete, hasta el stock de 300.' }
      ]
    },
    {
      id: 'pastillas', kind: 'task', title: '7. Pastillas (resuélvalo usted)', integerNote: true,
      statement: 'Se dispone de 600 g de un fármaco para pastillas grandes (40 g, ganancia $2) y pequeñas (30 g, ganancia $1). Se necesitan al menos 3 pastillas grandes, y al menos el doble de pequeñas que de grandes. Maximizar el beneficio.',
      varNames: ['x1', 'x2'], sense: 'max', c: [2, 1],
      constraints: [
        { a: [40, 30], op: '<=', b: 600, label: 'fármaco' },
        { a: [1, 0], op: '>=', b: 3, label: 'mínimo grandes' },
        { a: [-2, 1], op: '>=', b: 0, label: 'proporción' }
      ],
      hints: [
        'Hay una restricción de recurso total (el fármaco) y además restricciones de mínimo y de proporción.',
        '"Al menos" se traduce como mayor o igual, no como igualdad.',
        'La proporción entre los dos tamaños de pastilla se escribe como una desigualdad entre las dos variables, no fijando una cantidad de cada lado.'
      ]
    },
    {
      id: 'pastillas-worked', kind: 'worked', title: 'Resuelto (mismo tipo: mínimos y proporciones): Cápsulas', integerNote: true,
      statement: 'Se dispone de 500 g de un fármaco para cápsulas grandes (50 g, ganancia $3) y pequeñas (20 g, ganancia $2). Se necesitan al menos 2 cápsulas grandes, y al menos el triple de pequeñas que de grandes. Maximizar el beneficio.',
      varNames: ['x1', 'x2'], varDesc: ['x1 = cápsulas grandes', 'x2 = cápsulas pequeñas'],
      sense: 'max', c: [3, 2],
      constraints: [
        { a: [50, 20], op: '<=', b: 500, label: 'fármaco', explain: 'Consumo de fármaco por cápsula, hasta el stock de 500 g.' },
        { a: [1, 0], op: '>=', b: 2, label: 'mínimo grandes', explain: 'Al menos 2 cápsulas grandes.' },
        { a: [-3, 1], op: '>=', b: 0, label: 'proporción', explain: 'Pequeñas ≥ 3·grandes ⇒ x2 − 3x1 ≥ 0.' }
      ]
    },
    {
      id: 'calculadoras', kind: 'task', title: '8. Calculadoras (resuélvalo usted)',
      statement: 'Una compañía produce calculadoras C1 (1 h de fabricación, costo $30, ganancia $10) y C2 (4 h, costo $20, ganancia $8). Dispone de 1600 horas y $18 000 para gastos. Maximizar la ganancia.',
      varNames: ['x1', 'x2'], sense: 'max', c: [10, 8],
      constraints: [
        { a: [1, 4], op: '<=', b: 1600, label: 'horas' },
        { a: [30, 20], op: '<=', b: 18000, label: 'presupuesto' }
      ],
      hints: [
        'Hay dos recursos que limitan la producción: uno de tiempo y otro de dinero.',
        'Cada recurso tiene su propia restricción, con su propio lado derecho.',
        'Este ejercicio no tiene restricciones de mínimo ni de proporción entre las variables.'
      ]
    },
    {
      id: 'calculadoras-worked', kind: 'worked', title: 'Resuelto (mismo tipo: horas y costo combinados): Electrónica ProCalc',
      statement: 'ProCalc produce calculadoras E1 (1 h de fabricación, costo $25, ganancia $12) y E2 (3 h, costo $15, ganancia $9). Dispone de 1200 horas y $15 000 para gastos. Maximizar la ganancia.',
      varNames: ['x1', 'x2'], varDesc: ['x1 = calculadoras E1 producidas', 'x2 = calculadoras E2 producidas'],
      sense: 'max', c: [12, 9],
      constraints: [
        { a: [1, 3], op: '<=', b: 1200, label: 'horas', explain: 'E1 usa 1 h y E2 usa 3 h; tope de 1200 h disponibles.' },
        { a: [25, 15], op: '<=', b: 15000, label: 'presupuesto', explain: 'Costo de fabricación no supera los $15 000 disponibles.' }
      ]
    }
  ];

  /* ---- widget de TAREA: enunciado + veredicto GLOBAL por categoría + pistas + intentos ---- */
  function mountModelBuilder(root, def) {
    var n = def.varNames.length, m = def.constraints.length;
    var html = '<p><b>' + esc(def.title) + '.</b> ' + def.statement + '</p>';
    if (def.integerNote) html += '<p class="muted">' + esc(INTEGER_NOTE) + '</p>';
    if (def.constantNote) html += '<p class="muted">' + esc(def.constantNote) + '</p>';
    html += '<p class="muted">Arme el modelo y pulse «Verificar». Se da un veredicto global (no se muestra el modelo correcto, ni el óptimo, ni qué línea falló).</p>';
    html += '<div class="row"><b>Función objetivo</b> (' + (def.sense === 'max' ? 'maximizar' : 'minimizar') + '): z = ';
    for (var i = 0; i < n; i++) {
      html += '<input type="number" step="any" class="input-grid" data-role="objc" data-i="' + i + '" style="width:4.5em"> ' + esc(def.varNames[i]) + (i < n - 1 ? ' + ' : '');
    }
    html += '</div><div data-role="conslist">';
    for (var r = 0; r < m; r++) {
      html += '<div class="row">';
      for (i = 0; i < n; i++) html += '<input type="number" step="any" class="input-grid" data-role="consa" data-r="' + r + '" data-i="' + i + '" style="width:4.5em"> ' + esc(def.varNames[i]) + (i < n - 1 ? ' + ' : ' ');
      html += '<select data-role="consop" data-r="' + r + '"><option value="<=">≤</option><option value=">=">≥</option><option value="=">=</option></select>';
      html += '<input type="number" step="any" class="input-grid" data-role="consb" data-r="' + r + '" style="width:5em">';
      html += '</div>';
    }
    html += '</div>';
    html += '<div class="row">' +
      '<button class="btn btn-primary btn-sm" data-role="verify">Verificar</button>' +
      '<span class="muted" data-role="attempts">Intentos: 0</span>' +
      '<button class="btn btn-sm" data-role="hint">Pista (0/' + (def.hints ? def.hints.length : 0) + ')</button>' +
      '</div>';
    html += '<div class="callout callout-def" data-role="result" hidden></div>';
    html += '<ul data-role="hintlist"></ul>';
    root.innerHTML = html;

    var attempts = 0;
    var hintsShown = 0;
    var maxHints = def.hints ? def.hints.length : 0;

    root.querySelector('[data-role="verify"]').addEventListener('click', function () {
      attempts++;
      root.querySelector('[data-role="attempts"]').textContent = 'Intentos: ' + attempts;
      var userC = [];
      for (i = 0; i < n; i++) userC.push(parseFloat(root.querySelector('[data-role="objc"][data-i="' + i + '"]').value) || 0);
      var userCons = [];
      for (r = 0; r < m; r++) {
        var a = [];
        for (i = 0; i < n; i++) a.push(parseFloat(root.querySelector('[data-role="consa"][data-r="' + r + '"][data-i="' + i + '"]').value) || 0);
        var op = root.querySelector('[data-role="consop"][data-r="' + r + '"]').value;
        var b = parseFloat(root.querySelector('[data-role="consb"][data-r="' + r + '"]').value) || 0;
        userCons.push({ a: a, op: op, b: b });
      }
      var correct = { c: def.c, sense: def.sense, constraints: def.constraints.map(function (k) { return { a: k.a, op: k.op, b: k.b }; }) };
      var v = verifyModel({ c: userC, sense: def.sense }, userCons, correct);

      var result = root.querySelector('[data-role="result"]');
      result.hidden = false;
      result.className = 'callout ' + (v.verdict.level === 'ok' ? 'callout-tip' : (v.verdict.level === 'warn' ? 'callout-warn' : 'callout-warn'));
      result.textContent = v.verdict.text;
    });

    root.querySelector('[data-role="hint"]').addEventListener('click', function () {
      if (!def.hints || hintsShown >= maxHints) return;
      var li = document.createElement('li');
      li.textContent = def.hints[hintsShown];
      root.querySelector('[data-role="hintlist"]').appendChild(li);
      hintsShown++;
      var btn = root.querySelector('[data-role="hint"]');
      btn.textContent = 'Pista (' + hintsShown + '/' + maxHints + ')';
      if (hintsShown >= maxHints) btn.disabled = true;
    });
  }

  /* ---- widget de ejemplo RESUELTO: enunciado + modelo + explicación + óptimo (con otros números) ---- */
  function renderWorkedSolution(def) {
    var html = '';
    if (def.integerNote) html += '<p class="muted">' + esc(INTEGER_NOTE) + '</p>';
    html += '<div class="formula">Variables: ' + def.varDesc.join('; ') + '<br>' +
      (def.sense === 'max' ? 'max' : 'min') + ' z = ' + def.c.map(function (v, i) { return signedTerm(v, def.varNames[i], i === 0); }).join(' ') +
      (def.constant ? ' &nbsp;(alcance total = z + ' + def.constant + ')' : '') + '<br>s.a. ' +
      def.constraints.map(function (k) {
        return k.a.map(function (v, i) { return signedTerm(v, def.varNames[i], i === 0); }).join(' ') + ' ' + opSym(k.op) + ' ' + k.b + ' &nbsp;(' + esc(k.label) + ')';
      }).join('<br>&nbsp;&nbsp;&nbsp;&nbsp;') + '<br>' + def.varNames.join(', ') + ' ≥ 0</div>';
    if (def.formulaNote) html += '<p class="callout callout-def">' + esc(def.formulaNote) + '</p>';
    html += '<ul>' + def.constraints.map(function (k) { return '<li>' + esc(k.explain) + '</li>'; }).join('') + '</ul>';
    if (def.varNames.length === 2 && window.IO && IO.__cap2) {
      var g = def.constraints.map(function (k) { return { a: k.a[0], b: k.a[1], op: k.op, c: k.b }; });
      var r = IO.__cap2.solveLP(g, def.c[0], def.c[1], def.sense);
      if (r.optimal) {
        html += '<table class="data"><thead><tr><th>Vértice</th><th>' + esc(def.varNames[0]) + '</th><th>' + esc(def.varNames[1]) + '</th><th>z</th></tr></thead><tbody>';
        r.vertices.forEach(function (v, idx) {
          var isOpt = Math.abs(v.z - r.optimal.z) < 1e-6;
          html += '<tr' + (isOpt ? ' class="hl"' : '') + '><td>V' + (idx + 1) + '</td><td>' + fmtNum(v.x) + '</td><td>' + fmtNum(v.y) + '</td><td>' + fmtNum(v.z) + '</td></tr>';
        });
        html += '</tbody></table>';
        var totalZ = r.optimal.z + (def.constant || 0);
        html += '<p><b>Óptimo:</b> ' + esc(def.varNames[0]) + ' = ' + fmtNum(r.optimal.x) + ', ' + esc(def.varNames[1]) + ' = ' + fmtNum(r.optimal.y) +
          ', z = ' + fmtNum(r.optimal.z) + (def.constant ? ' (alcance total = ' + fmtNum(totalZ) + ')' : '') + '.</p>';
      } else {
        html += '<p class="badge badge-err">' + esc(r.status) + '</p>';
      }
    }
    return html;
  }

  function mountWorkedExample(root, def) {
    root.innerHTML = '<p><b>' + esc(def.title) + '.</b> ' + def.statement + '</p>' + renderWorkedSolution(def);
  }

  /* ---- Ejercicio 1 (precio-demanda): tarea (solo enunciado) + ejercicio resuelto (otros números) ---- */
  var EX1_TASK_STATEMENT =
    'Para la mayoría de los productos, precios altos bajan la demanda y precios bajos la suben. Sea d la demanda anual (unidades) y p el precio por unidad, con la relación d = 800 − 10p, donde p está entre $20 y $70. a) ¿Cuántas unidades se venden a p=$20? b) Modele el ingreso total IT (precio por demanda). c) Entre p=$30, $40 y $50, ¿cuál maximiza IT? d) ¿Cuál es la demanda y el ingreso total con el precio recomendado? Resuélvalo usted; no hay widget de autocorrección para este ejercicio de una sola variable.';

  function mountPriceDemandWorked(root) {
    root.innerHTML =
      '<p><b>Resuelto (mismo tipo: precio-demanda): Tienda Norte.</b> Tienda Norte estima la relación precio-demanda d = 600 − 6p, con p entre $30 y $80. a) ¿Cuántas unidades se venden a p=$30? b) Modele el ingreso total IT. c) Entre p=$40, $50 y $60, ¿cuál maximiza IT? d) ¿Cuál es la demanda y el ingreso total con el precio recomendado?</p>' +
      '<div class="row"><label>Precio p ($): <input type="range" data-role="p" min="30" max="80" step="1" value="50" style="width:220px"> <span data-role="pval"></span></label></div>' +
      '<div class="kv" data-role="live"></div>' +
      '<table class="data" data-role="table"></table>' +
      '<div class="callout callout-def" data-role="answers"></div>';

    var pRange = root.querySelector('[data-role="p"]');
    function calc(p) { var d = 600 - 6 * p; return { d: d, it: p * d }; }
    function update() {
      var p = parseFloat(pRange.value);
      var r = calc(p);
      root.querySelector('[data-role="pval"]').textContent = 'p = $' + p;
      root.querySelector('[data-role="live"]').innerHTML =
        '<div><b>Demanda d:</b> ' + r.d + ' unidades</div><div><b>Ingreso total IT = p·d:</b> $' + fmtNum(r.it) + '</div>';
    }
    pRange.addEventListener('input', update);

    var rows = [40, 50, 60].map(function (p) {
      var r = calc(p); var isMax = p === 50;
      return '<tr' + (isMax ? ' class="hl"' : '') + '><td>$' + p + '</td><td>' + r.d + '</td><td>$' + fmtNum(r.it) + '</td></tr>';
    }).join('');
    root.querySelector('[data-role="table"]').innerHTML = '<thead><tr><th>p</th><th>d = 600−6p</th><th>IT = p·d</th></tr></thead><tbody>' + rows + '</tbody>';

    root.querySelector('[data-role="answers"]').innerHTML =
      '<p><b>a)</b> A p=$30: d = 600−6(30) = <b>420 unidades</b>.</p>' +
      '<p><b>b)</b> Modelo del ingreso total: IT(p) = p·d = p(600−6p) = 600p − 6p².</p>' +
      '<p><b>c)</b> Entre $40, $50 y $60, maximiza <b>p=$50</b> con IT = <b>$15 000</b> (los otros dos dan $14 400).</p>' +
      '<p><b>d)</b> El óptimo irrestricto también cae en p=$50 (vértice de la parábola, derivada 600−12p=0 ⇒ p=50): demanda <b>d = 300</b>, ingreso total <b>IT = $15 000</b>.</p>';

    update();
  }

  /* =========================================================================
   * B) SIMPLEX EN EL FORMATO DE LA CLASE (tabla Básicas | Z | vars | holguras | R)
   * Ejemplos con números que NO coinciden con ninguna tarea de la clase (2 variables,
   * 3–4 restricciones ≤), para no resolverle a nadie el ejercicio del simplex de la clase.
   * No depende de IO.Simplex.solve (motor propio, en Frac exacto) para no acoplarse a su
   * opción `rule` — la regla de entrada usada aquí es siempre "el más negativo, y en
   * empate el de menor índice", igual al formato de la clase.
   * ========================================================================= */

  var SIMPLEX_EXAMPLES = {
    sombreros: {
      label: 'Sombreros del Sur', varNames: ['X1', 'X2'], c: [6, 4],
      constraints: [{ a: [3, 1], b: 300 }, { a: [1, 0], b: 80 }, { a: [0, 1], b: 150 }]
    },
    procalc: {
      label: 'Electrónica ProCalc', varNames: ['X1', 'X2'], c: [12, 9],
      constraints: [{ a: [1, 3], b: 1200 }, { a: [25, 15], b: 15000 }]
    },
    tallerdelta: {
      label: 'Taller Delta (4 restricciones)', varNames: ['X1', 'X2'], c: [4, 3],
      constraints: [{ a: [1, 0], b: 10 }, { a: [0, 1], b: 15 }, { a: [2, 1], b: 28 }, { a: [1, 2], b: 40 }]
    }
  };

  function cloneSnap(rows, RHS, basis) {
    return { rows: rows.map(function (r) { return r.slice(); }), RHS: RHS.slice(), basis: basis.slice() };
  }

  function fmtMultiplierLabel(mult, pivotRowNum, curRowNum) {
    var part;
    if (mult.eq(Frac.ONE)) part = 'R' + pivotRowNum;
    else if (mult.eq(Frac.ONE.neg())) part = '-R' + pivotRowNum;
    else part = mult.toString() + ' R' + pivotRowNum;
    return part + ' + R' + curRowNum;
  }

  /** Construye el simplex tabular al estilo de la clase (solo restricciones ≤, sin M).
   * varNames: nombres de variables de decisión. c: array de Frac (coeficientes objetivo,
   * se maximiza). constraints: [{a:[Frac...], b:Frac}] (todas ≤). Regla de entrada: el
   * coeficiente más negativo de la fila Z; en empate, el de MENOR ÍNDICE (primero encontrado).
   * Devuelve {stages, varNames} — stages es una lista de iteraciones (con tableauBefore,
   * pivotCol, ratios, pivotRow, pivotVal, normalizeLabel, tableauAfterC, elimLabels,
   * tableauAfterD, zAfter) terminada por {type:'final', tableau, z}. */
  function buildTableauSteps(varNames, c, constraints) {
    var n = varNames.length, m = constraints.length;
    var slackNames = []; for (var i = 0; i < m; i++) slackNames.push('S' + (i + 1));
    var allNames = varNames.concat(slackNames);
    var totalCols = n + m;
    var Z = [];
    for (var j = 0; j < n; j++) Z.push(c[j].neg());
    for (j = 0; j < m; j++) Z.push(Frac.ZERO);
    var rows = [Z];
    var RHS = [Frac.ZERO];
    for (i = 0; i < m; i++) {
      var row = [];
      for (j = 0; j < n; j++) row.push(constraints[i].a[j]);
      for (j = 0; j < m; j++) row.push(j === i ? Frac.ONE : Frac.ZERO);
      rows.push(row);
      RHS.push(constraints[i].b);
    }
    var basis = [null];
    for (i = 0; i < m; i++) basis.push(n + i);

    var stages = [];
    var maxIter = 50;
    for (var iterCount = 0; iterCount < maxIter; iterCount++) {
      var pivotCol = -1, best = null;
      for (j = 0; j < totalCols; j++) {
        // "el más negativo"; en empate (cmp === 0) no se reemplaza, así que gana el de menor índice
        if (rows[0][j].isNeg()) {
          if (best === null || rows[0][j].cmp(best) < 0) { best = rows[0][j]; pivotCol = j; }
        }
      }
      if (pivotCol === -1) {
        stages.push({ type: 'final', tableau: cloneSnap(rows, RHS, basis), z: RHS[0] });
        break;
      }
      var tableauBefore = cloneSnap(rows, RHS, basis);
      var ratios = []; var pivotRow = -1; var minRatio = null;
      for (i = 1; i <= m; i++) {
        var coef = rows[i][pivotCol];
        if (coef.isPos()) {
          var ratio = RHS[i].div(coef);
          ratios.push({ row: i, value: ratio, valid: true });
          if (minRatio === null || ratio.cmp(minRatio) < 0) { minRatio = ratio; pivotRow = i; }
        } else {
          ratios.push({ row: i, value: null, valid: false });
        }
      }
      if (pivotRow === -1) {
        stages.push({ type: 'unbounded', pivotCol: pivotCol, tableau: tableauBefore });
        break;
      }
      var pivotVal = rows[pivotRow][pivotCol];
      var normRow = rows[pivotRow].map(function (x) { return x.div(pivotVal); });
      var normRHS = RHS[pivotRow].div(pivotVal);
      var tableauAfterC = cloneSnap(
        rows.map(function (r, idx) { return idx === pivotRow ? normRow : r; }),
        RHS.map(function (v, idx) { return idx === pivotRow ? normRHS : v; }),
        basis
      );

      var rowsD = rows.map(function (r, idx) { return idx === pivotRow ? normRow.slice() : r.slice(); });
      var RHSd = RHS.slice(); RHSd[pivotRow] = normRHS;
      var basisD = basis.slice(); basisD[pivotRow] = pivotCol;
      var elimLabels = [];
      for (i = 0; i <= m; i++) {
        if (i === pivotRow) continue;
        var factor = rows[i][pivotCol];
        if (factor.isZero()) continue;
        var mult = factor.neg();
        for (j = 0; j < totalCols; j++) rowsD[i][j] = rowsD[i][j].sub(factor.mul(normRow[j]));
        RHSd[i] = RHSd[i].sub(factor.mul(normRHS));
        elimLabels.push({ row: i, label: fmtMultiplierLabel(mult, pivotRow + 1, i + 1) });
      }

      stages.push({
        iter: iterCount, tableauBefore: tableauBefore, pivotCol: pivotCol, pivotRow: pivotRow, ratios: ratios,
        pivotVal: pivotVal, normalizeLabel: '(1/' + pivotVal.toString() + ') R' + (pivotRow + 1),
        tableauAfterC: tableauAfterC, elimLabels: elimLabels,
        tableauAfterD: cloneSnap(rowsD, RHSd, basisD), zAfter: RHSd[0]
      });
      rows = rowsD; RHS = RHSd; basis = basisD;
    }
    return { stages: stages, varNames: allNames };
  }

  function tableauHTML(snap, varNames, opts) {
    opts = opts || {};
    var m = snap.rows.length - 1;
    var html = '<table class="tableau wide"><thead><tr><th>Básicas</th><th>Z</th>';
    varNames.forEach(function (nm, j) {
      var cls = (opts.pivotCol === j) ? ' class="pivot-col"' : '';
      var clickAttr = opts.clickableCols ? ' data-role="pivotcolbtn" data-col="' + j + '" tabindex="0"' : '';
      html += '<th' + cls + clickAttr + '>' + esc(nm) + '</th>';
    });
    html += '<th>R</th>';
    if (opts.ratios) html += '<th>Cociente</th>';
    html += '</tr></thead><tbody>';
    html += '<tr class="z-row"><th>Z</th><td>1</td>';
    snap.rows[0].forEach(function (v, j) {
      var cls = (opts.pivotCol === j) ? ' class="pivot-col"' : '';
      html += '<td' + cls + '>' + v.toHTML() + '</td>';
    });
    html += '<td>' + snap.RHS[0].toHTML() + '</td>';
    if (opts.ratios) html += '<td>—</td>';
    html += '</tr>';
    for (var i = 1; i <= m; i++) {
      var basicIdx = snap.basis[i];
      var basicName = (basicIdx === null || basicIdx === undefined) ? '?' : varNames[basicIdx];
      var isPivotRow = opts.pivotRow === i;
      var rowClickAttr = opts.clickableRows ? ' data-role="pivotrowbtn" data-row="' + i + '" tabindex="0"' : '';
      html += '<tr' + (isPivotRow ? ' class="pivot-row"' : '') + '><th class="basic"' + rowClickAttr + '>' + esc(basicName) + '</th><td>0</td>';
      snap.rows[i].forEach(function (v, j) {
        var classes = [];
        if (opts.pivotCol === j) classes.push('pivot-col');
        if (isPivotRow) classes.push('pivot-row');
        if (isPivotRow && opts.pivotCol === j) classes.push('pivot-cell');
        html += '<td' + (classes.length ? ' class="' + classes.join(' ') + '"' : '') + '>' + v.toHTML() + '</td>';
      });
      html += '<td>' + snap.RHS[i].toHTML() + '</td>';
      if (opts.ratios) {
        var rr = opts.ratios[i - 1];
        var txt = (rr && rr.valid) ? rr.value.toHTML() : 'No válido';
        html += '<td' + (rr && rr.valid && opts.pivotRow === i ? ' class="hl"' : '') + '>' + txt + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
  }

  function mountSimplexClassWidget(root) {
    root.innerHTML =
      '<p class="muted"><b>Paso 1 (previo a la tabla):</b> convertir las restricciones a igualdades agregando una variable de holgura por cada una (S1..Sm), y escribir la función objetivo como Z − c1X1 − c2X2 (− … ) = 0. Cuando X1 = X2 = 0 (no básicas), las variables básicas son las holguras — por eso la tabla inicial ya arranca en una solución factible.</p>' +
      '<div class="row"><label class="muted">Ejemplo: <select class="example-picker" data-role="ex"></select></label>' +
      '<label class="row" style="gap:4px"><input type="checkbox" data-role="doit"> Modo «Hazlo tú»</label></div>' +
      '<div class="step-bar">' +
      '<button class="btn btn-sm" data-role="prev">◀ Anterior</button>' +
      '<button class="btn btn-sm" data-role="next">Siguiente ▶</button>' +
      '<button class="btn btn-sm" data-role="solveall">Resolver todo</button>' +
      '<button class="btn btn-sm" data-role="reset">Reiniciar</button>' +
      '</div>' +
      '<div class="step-text" data-role="steptext"></div>' +
      '<div data-role="tableauhost"></div>' +
      '<div class="kv" data-role="results"></div>';

    var exSel = root.querySelector('[data-role="ex"]');
    Object.keys(SIMPLEX_EXAMPLES).forEach(function (key) {
      var o = document.createElement('option'); o.value = key; o.textContent = SIMPLEX_EXAMPLES[key].label; exSel.appendChild(o);
    });

    var state = { key: 'sombreros', data: null, idx: 0, doit: false, userCol: null, userRow: null, currentStageRef: null };

    function buildSteps(key) {
      var ex = SIMPLEX_EXAMPLES[key];
      var c = ex.c.map(function (v) { return Frac.from(v); });
      var cons = ex.constraints.map(function (k) { return { a: k.a.map(function (v) { return Frac.from(v); }), b: Frac.from(k.b) }; });
      var built = buildTableauSteps(ex.varNames, c, cons);
      var flat = [{ kind: 'initial', s: built.stages[0] }];
      built.stages.forEach(function (s) {
        if (s.type === 'final' || s.type === 'unbounded') { flat.push({ kind: s.type, s: s }); return; }
        flat.push({ kind: 'a', s: s }); flat.push({ kind: 'b', s: s }); flat.push({ kind: 'c', s: s }); flat.push({ kind: 'd', s: s });
      });
      return { built: built, flat: flat, varNames: built.varNames };
    }

    function loadExample(key) {
      state.key = key;
      state.data = buildSteps(key);
      state.idx = 0; state.userCol = null; state.userRow = null; state.currentStageRef = null;
      render();
    }

    function render() {
      var d = state.data;
      var step = d.flat[state.idx];
      var host = root.querySelector('[data-role="tableauhost"]');
      var stepText = root.querySelector('[data-role="steptext"]');
      var results = root.querySelector('[data-role="results"]');
      results.innerHTML = '';

      if (step.kind === 'a' && state.currentStageRef !== step.s) {
        state.currentStageRef = step.s; state.userCol = null; state.userRow = null;
      }

      if (step.kind === 'initial') {
        host.innerHTML = tableauHTML(step.s.tableauBefore, d.varNames, {});
        stepText.textContent = 'Tabla inicial: X1=X2=0 (no básicas), las variables de holgura son básicas. La fila Z lleva los coeficientes −c_j.';
      } else if (step.kind === 'a') {
        var s = step.s;
        var clickableA = state.doit && state.userCol === null;
        host.innerHTML = tableauHTML(s.tableauBefore, d.varNames, { pivotCol: clickableA ? null : s.pivotCol, clickableCols: clickableA });
        if (clickableA) {
          stepText.textContent = 'Modo «Hazlo tú»: haga clic en el encabezado de la columna pivote (la variable no básica con el coeficiente más negativo en la fila Z; en caso de empate, la de menor índice).';
          host.querySelectorAll('[data-role="pivotcolbtn"]').forEach(function (btn) {
            btn.style.cursor = 'pointer';
            btn.addEventListener('click', function () { state.userCol = parseInt(btn.getAttribute('data-col'), 10); render(); });
          });
        } else {
          var verdictA = '';
          if (state.doit && state.userCol !== null) {
            verdictA = state.userCol === s.pivotCol ? ' <span class="badge badge-ok">Correcto.</span>' :
              ' <span class="badge badge-err">La columna correcta era ' + esc(d.varNames[s.pivotCol]) + '.</span>';
          }
          stepText.innerHTML = 'a) Columna pivote: <b>' + esc(d.varNames[s.pivotCol]) + '</b> (el coeficiente más negativo de la fila Z; en empate, la de menor índice).' + verdictA;
        }
      } else if (step.kind === 'b') {
        var s2 = step.s;
        var clickableB = state.doit && state.userRow === null;
        host.innerHTML = tableauHTML(s2.tableauBefore, d.varNames, { pivotCol: s2.pivotCol, pivotRow: clickableB ? null : s2.pivotRow, ratios: s2.ratios, clickableRows: clickableB });
        if (clickableB) {
          stepText.textContent = 'Modo «Hazlo tú»: haga clic en la fila con el cociente positivo más pequeño (regla de la razón mínima).';
          host.querySelectorAll('[data-role="pivotrowbtn"]').forEach(function (btn) {
            btn.style.cursor = 'pointer';
            btn.addEventListener('click', function () { state.userRow = parseInt(btn.getAttribute('data-row'), 10); render(); });
          });
        } else {
          var leavingName = d.varNames[s2.tableauBefore.basis[s2.pivotRow]];
          var verdictB = '';
          if (state.doit && state.userRow !== null) {
            verdictB = state.userRow === s2.pivotRow ? ' <span class="badge badge-ok">Correcto.</span>' :
              ' <span class="badge badge-err">La fila correcta era la de ' + esc(leavingName) + '.</span>';
          }
          stepText.innerHTML = 'b) Cocientes R/coeficiente de la columna pivote (coeficiente ≤ 0: «No válido»). Sale <b>' + esc(leavingName) + '</b>.' + verdictB;
        }
      } else if (step.kind === 'c') {
        var s3 = step.s;
        var snapC = { rows: s3.tableauBefore.rows.map(function (r, idx) { return idx === s3.pivotRow ? s3.tableauAfterC.rows[idx] : r; }), RHS: s3.tableauBefore.RHS.map(function (v, idx) { return idx === s3.pivotRow ? s3.tableauAfterC.RHS[idx] : v; }), basis: s3.tableauBefore.basis };
        host.innerHTML = tableauHTML(snapC, d.varNames, { pivotCol: s3.pivotCol, pivotRow: s3.pivotRow });
        stepText.innerHTML = 'c) Normalizar la fila pivote: <span class="eq">' + esc(s3.normalizeLabel) + '</span> (se divide toda la fila entre el elemento pivote para volverlo 1).';
      } else if (step.kind === 'd') {
        var s4 = step.s;
        host.innerHTML = tableauHTML(s4.tableauAfterD, d.varNames, { pivotCol: s4.pivotCol, pivotRow: s4.pivotRow });
        var labelsHtml = s4.elimLabels.map(function (l) {
          var rowName = l.row === 0 ? 'Z' : esc(d.varNames[s4.tableauAfterD.basis[l.row]]);
          return '<li>Fila ' + rowName + ': <span class="eq">' + esc(l.label) + '</span></li>';
        }).join('');
        stepText.innerHTML = 'd) Hacer cero el resto de la columna pivote:<ul>' + labelsHtml + '</ul>¿Seguimos? Sí, mientras haya coeficientes negativos en la fila Z.';
      } else if (step.kind === 'final') {
        var s5 = step.s;
        host.innerHTML = tableauHTML(s5.tableau, d.varNames, {});
        stepText.textContent = 'Solución óptima alcanzada: ya no hay coeficientes negativos en la fila Z.';
        var rows2 = [['Z', s5.z.toHTML()]];
        d.varNames.forEach(function (nm, j) {
          var basicRow = s5.tableau.basis.indexOf(j);
          rows2.push([nm, basicRow === -1 ? '0' : s5.tableau.RHS[basicRow].toHTML()]);
        });
        results.innerHTML = rows2.map(function (rr) { return '<div><b>' + rr[0] + ' =</b> ' + rr[1] + '</div>'; }).join('');
      } else if (step.kind === 'unbounded') {
        host.innerHTML = tableauHTML(step.s.tableau, d.varNames, { pivotCol: step.s.pivotCol });
        stepText.textContent = 'La columna pivote no tiene coeficientes positivos: el problema no está acotado.';
      }

      var blockNext = false;
      if (state.doit) {
        if (step.kind === 'a' && state.userCol === null) blockNext = true;
        if (step.kind === 'b' && state.userRow === null) blockNext = true;
      }
      root.querySelector('[data-role="prev"]').disabled = state.idx === 0;
      root.querySelector('[data-role="next"]').disabled = state.idx >= d.flat.length - 1 || blockNext;
    }

    root.querySelector('[data-role="prev"]').addEventListener('click', function () { if (state.idx > 0) { state.idx--; render(); } });
    root.querySelector('[data-role="next"]').addEventListener('click', function () { if (state.idx < state.data.flat.length - 1) { state.idx++; render(); } });
    root.querySelector('[data-role="solveall"]').addEventListener('click', function () { state.idx = state.data.flat.length - 1; render(); });
    root.querySelector('[data-role="reset"]').addEventListener('click', function () { state.idx = 0; state.userCol = null; state.userRow = null; state.currentStageRef = null; render(); });
    root.querySelector('[data-role="doit"]').addEventListener('change', function (e) { state.doit = e.target.checked; state.userCol = null; state.userRow = null; render(); });
    exSel.addEventListener('change', function () { loadExample(exSel.value); });

    loadExample('sombreros');
  }

  /* =========================================================================
   * C) DEL DUAL AL PRIMAL (HOLGURA COMPLEMENTARIA)
   * Ejemplo resuelto paso a paso (similar, verificado con IO.Simplex, no es el de la clase
   * ni el TOYCO del libro que ya aparece en cap 3/4) y un segundo ejemplo fijo para el
   * modo «Hazlo tú». Advertencia permanente: la regla de holgura complementaria es de una
   * sola dirección.
   * ========================================================================= */

  var DUAL_GUIDED = {
    label: 'Ejemplo resuelto', sense: 'max',
    context: 'Un taller fabrica tres artículos con dos recursos compartidos.',
    varNames: ['x1', 'x2', 'x3'], c: [3, 3, 5],
    A: [[1, 1, 2], [3, 1, 1]], b: [70, 50], y: [2, 1],
    dualLabels: ['y1 + 3y2 ≥ 3', 'y1 + y2 ≥ 3', '2y1 + y2 ≥ 5']
  };
  /* y* = (2,1) verificado en tests/tareas.test.js con solveComplementarySlackness y con
   * IO.Simplex.sensitivity sobre el primal (ver script de verificación del PR). */
  var DUAL_PRACTICE = {
    label: 'Hazlo tú', sense: 'max',
    context: 'Otro taller, con los mismos dos recursos repartidos distinto entre los tres artículos.',
    varNames: ['x1', 'x2', 'x3'], c: [2, 5, 4],
    A: [[1, 2, 1], [2, 1, 2]], b: [60, 50], y: [2, 1],
    dualLabels: ['y1 + 2y2 ≥ 2', '2y1 + y2 ≥ 5', 'y1 + 2y2 ≥ 4']
  };
  /* y* = (2,1) para este ejemplo también se obtiene con IO.Simplex.parse/solve sobre el
   * primal (sensitivity.duals) — verificado en tests/tareas.test.js. */
  var DUAL_EXAMPLES = { guided: DUAL_GUIDED, practice: DUAL_PRACTICE };

  var DUAL_WARNING_NOTE =
    'Advertencia: la regla de holgura complementaria es de una sola dirección. y_i = 0 NO implica que la restricción primal i tenga holgura (podría cumplirse como igualdad igual); y una restricción dual en igualdad NO implica que la x_j asociada sea mayor que 0 (puede seguir siendo 0). Solo se puede afirmar lo que dice la regla en el sentido en que está escrita: holgura dual ⇒ x_j=0, y y_i&gt;0 ⇒ igualdad primal.';

  /** Resuelve el primal a partir de la solución dual óptima por holgura complementaria.
   * model: {c:[Frac...] (n), A:[[Frac...]] (m x n), b:[Frac...] (m), y:[Frac...] (m)}.
   * Devuelve {lhs, slacks, zeroVars, eqRows, freeIdx, x, z, w, singular}. Si el sistema 2x2
   * (o 1x1) resultante es singular (determinante 0), devuelve singular:true y x=z=null en
   * lugar de dividir por cero. eqRows se arma SOLO con y_i>0 (nunca asumiendo holgura). */
  function solveComplementarySlackness(model) {
    var n = model.c.length, m = model.A.length;
    var lhs = [], slacks = [];
    for (var j = 0; j < n; j++) {
      var acc = Frac.ZERO;
      for (var i = 0; i < m; i++) acc = acc.add(model.A[i][j].mul(model.y[i]));
      lhs.push(acc);
      slacks.push(acc.sub(model.c[j]));
    }
    var zeroVars = slacks.map(function (e) { return e.isPos(); });
    var freeIdx = []; for (j = 0; j < n; j++) if (!zeroVars[j]) freeIdx.push(j);
    var eqRows = []; for (i = 0; i < m; i++) if (model.y[i].isPos()) eqRows.push(i);
    var x = new Array(n).fill(Frac.ZERO);
    var singular = false;
    if (eqRows.length === 2 && freeIdx.length === 2) {
      var i1 = eqRows[0], i2 = eqRows[1], j1 = freeIdx[0], j2 = freeIdx[1];
      var a11 = model.A[i1][j1], a12 = model.A[i1][j2], b1 = model.b[i1];
      var a21 = model.A[i2][j1], a22 = model.A[i2][j2], b2 = model.b[i2];
      var det = a11.mul(a22).sub(a12.mul(a21));
      if (det.isZero()) {
        singular = true;
      } else {
        x[j1] = b1.mul(a22).sub(a12.mul(b2)).div(det);
        x[j2] = a11.mul(b2).sub(b1.mul(a21)).div(det);
      }
    } else if (eqRows.length === 1 && freeIdx.length === 1) {
      if (model.A[eqRows[0]][freeIdx[0]].isZero()) singular = true;
      else x[freeIdx[0]] = model.b[eqRows[0]].div(model.A[eqRows[0]][freeIdx[0]]);
    }
    var z = singular ? null : (function () { var acc2 = Frac.ZERO; for (var jj = 0; jj < n; jj++) acc2 = acc2.add(model.c[jj].mul(x[jj])); return acc2; })();
    var w = Frac.ZERO; for (i = 0; i < m; i++) w = w.add(model.b[i].mul(model.y[i]));
    return { lhs: lhs, slacks: slacks, zeroVars: zeroVars, eqRows: eqRows, freeIdx: freeIdx, x: singular ? null : x, z: z, w: w, singular: singular };
  }

  /** Paso 0: ¿y* cumple todas las restricciones duales (lado izq. ≥ lado der.)? */
  function checkDualFeasible(def) {
    var c = def.c.map(function (v) { return Frac.from(v); });
    var A = def.A.map(function (row) { return row.map(function (v) { return Frac.from(v); }); });
    var y = def.y.map(function (v) { return Frac.from(v); });
    var n = c.length, m = A.length;
    var rows = [];
    for (var j = 0; j < n; j++) {
      var lhs = Frac.ZERO;
      for (var i = 0; i < m; i++) lhs = lhs.add(A[i][j].mul(y[i]));
      rows.push({ j: j, lhs: lhs, rhs: c[j], feasible: lhs.cmp(c[j]) >= 0 });
    }
    return { rows: rows, feasible: rows.every(function (r) { return r.feasible; }) };
  }

  var DUAL_STEP_LABELS = [
    'Paso 0: comprobar que y* es factible en el dual',
    'Paso 1: evaluar cada restricción dual con y*',
    'Paso 2: identificar qué restricciones primales son igualdades',
    'Paso 3: plantear y resolver el sistema',
    'Paso 4: verificar z* = w*'
  ];

  function computeCS(def) {
    var c = def.c.map(function (v) { return Frac.from(v); });
    var A = def.A.map(function (row) { return row.map(function (v) { return Frac.from(v); }); });
    var b = def.b.map(function (v) { return Frac.from(v); });
    var y = def.y.map(function (v) { return Frac.from(v); });
    return solveComplementarySlackness({ c: c, A: A, b: b, y: y });
  }

  function renderDualStep0(def) {
    var chk = checkDualFeasible(def);
    var rows = chk.rows.map(function (r) {
      return '<tr><td>' + esc(def.dualLabels[r.j]) + '</td><td>' + r.lhs.toHTML() + '</td><td>' + r.rhs.toHTML() + '</td><td>' + (r.feasible ? 'Sí' : 'No') + '</td></tr>';
    }).join('');
    var html = '<table class="data"><thead><tr><th>Restricción dual</th><th>Lado izq. con y*</th><th>Lado der.</th><th>¿Se cumple?</th></tr></thead><tbody>' + rows + '</tbody></table>';
    html += chk.feasible
      ? '<p class="badge badge-ok">y* es factible en el dual: se puede continuar.</p>'
      : '<p class="badge badge-err">y* NO es factible en el dual: no se puede continuar con este y*.</p>';
    return html;
  }

  function renderDualStep1(def, cs) {
    var rows = def.varNames.map(function (nm, j) {
      var rhs = Frac.from(def.c[j]);
      var concl = cs.zeroVars[j]
        ? (esc(nm) + ' = 0 (hay holgura, e = ' + cs.slacks[j].toHTML() + ' &gt; 0)')
        : (esc(nm) + ' puede ser mayor que 0 (sin holgura)');
      return '<tr><td>' + esc(nm) + '</td><td>' + esc(def.dualLabels[j]) + '</td><td>' + cs.lhs[j].toHTML() + '</td><td>' + rhs.toHTML() + '</td><td>' + cs.slacks[j].toHTML() + '</td><td>' + concl + '</td></tr>';
    }).join('');
    return '<table class="data"><thead><tr><th>Variable</th><th>Restricción dual</th><th>Lado izq.</th><th>Lado der.</th><th>Holgura e_j</th><th>Conclusión</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function renderDualStep2(def) {
    var items = def.y.map(function (yi, i) {
      var isPos = Frac.from(yi).isPos();
      var text = isPos
        ? ('y' + (i + 1) + ' = ' + yi + ' &gt; 0 ⇒ la restricción primal ' + (i + 1) + ' es una igualdad.')
        : ('y' + (i + 1) + ' = ' + yi + ' (no aporta igualdad; NO implica que la restricción primal ' + (i + 1) + ' tenga holgura).');
      return '<li>' + text + '</li>';
    }).join('');
    return '<ul>' + items + '</ul>';
  }

  function renderDualStep3(def, cs) {
    if (cs.singular) {
      return '<p class="badge badge-err">El sistema queda singular (determinante 0): con esta combinación de igualdades primales y variables fijadas en 0 no hay solución única. Revise qué restricciones son igualdad (Paso 2).</p>';
    }
    var lines = [];
    lines.push('Variables fijadas en 0: ' + (def.varNames.filter(function (nm, j) { return cs.zeroVars[j]; }).join(', ') || '(ninguna)') + '.');
    cs.eqRows.forEach(function (i) {
      var terms = cs.freeIdx.map(function (j) { return def.A[i][j] + esc(def.varNames[j]); }).join(' + ');
      lines.push('Restricción primal ' + (i + 1) + ' (eliminando las variables en 0): ' + terms + ' = ' + def.b[i] + '.');
    });
    lines.push('Resolviendo el sistema (despeje y sustitución): ' + cs.freeIdx.map(function (j) { return esc(def.varNames[j]) + ' = ' + cs.x[j].toHTML(); }).join(', ') + '.');
    return '<p>' + lines.join('</p><p>') + '</p>';
  }

  function renderDualStep4(def, cs) {
    if (cs.singular) {
      return '<p class="badge badge-err">No se puede verificar z* = w*: el paso 3 quedó singular.</p>';
    }
    var zTerms = def.c.map(function (v, j) { return v + '·' + cs.x[j].toHTML(); }).join(' + ');
    var wTerms = def.b.map(function (v, i) { return v + '·' + def.y[i]; }).join(' + ');
    var ok = cs.z.eq(cs.w);
    return '<p>z* = ' + zTerms + ' = ' + cs.z.toHTML() + '.</p>' +
      '<p>w* = ' + wTerms + ' = ' + cs.w.toHTML() + '.</p>' +
      '<p>' + (ok ? '<span class="badge badge-ok">z* = w*, la solución es correcta.</span>' : '<span class="badge badge-err">z* ≠ w*.</span>') + '</p>';
  }

  function modelDescHTML(def) {
    return (def.context ? '<div class="muted">' + esc(def.context) + '</div>' : '') +
      '<div><b>Primal:</b> max z = ' + def.c.map(function (v, i) { return signedTerm(v, def.varNames[i], i === 0); }).join(' ') + '</div>' +
      def.A.map(function (row, i) { return '<div>s.a. ' + row.map(function (v, j) { return signedTerm(v, def.varNames[j], j === 0); }).join(' ') + ' ≤ ' + def.b[i] + '</div>'; }).join('') +
      '<div><b>Dual:</b> min w = ' + def.b.map(function (v, i) { return signedTerm(v, 'y' + (i + 1), i === 0); }).join(' ') + '</div>' +
      def.dualLabels.map(function (l) { return '<div>s.a. ' + esc(l) + '</div>'; }).join('') +
      '<div><b>y* = (' + def.y.join(', ') + ')</b></div>';
  }

  function mountDualToPrimalWidget(root) {
    root.innerHTML =
      '<div class="callout callout-warn">' + DUAL_WARNING_NOTE + '</div>' +
      '<div class="panel-title">Ejemplo resuelto paso a paso</div>' +
      '<div class="kv" data-role="modeldesc"></div>' +
      '<div class="step-bar">' +
      '<button class="btn btn-sm" data-role="prev">◀ Anterior</button>' +
      '<button class="btn btn-sm" data-role="next">Siguiente ▶</button>' +
      '<button class="btn btn-sm" data-role="solveall">Resolver todo</button>' +
      '<button class="btn btn-sm" data-role="reset">Reiniciar</button>' +
      '</div>' +
      '<div class="step-text" data-role="steptext"></div>' +
      '<div data-role="stepbody"></div>' +
      '<div class="panel" data-role="practice" style="margin-top:14px">' +
      '<div class="panel-title">Hazlo tú: identifique la holgura complementaria (otro modelo)</div>' +
      '<div class="kv" data-role="practicemodel"></div>' +
      '<div data-role="practicebody"></div>' +
      '</div>';

    var guided = DUAL_GUIDED;
    var guidedCS = computeCS(guided);
    var state = { idx: 0 };

    function render() {
      root.querySelector('[data-role="modeldesc"]').innerHTML = modelDescHTML(guided);
      var stepText = root.querySelector('[data-role="steptext"]');
      var body = root.querySelector('[data-role="stepbody"]');
      stepText.textContent = DUAL_STEP_LABELS[state.idx];
      if (state.idx === 0) body.innerHTML = renderDualStep0(guided);
      else if (state.idx === 1) body.innerHTML = renderDualStep1(guided, guidedCS);
      else if (state.idx === 2) body.innerHTML = renderDualStep2(guided);
      else if (state.idx === 3) body.innerHTML = renderDualStep3(guided, guidedCS);
      else body.innerHTML = renderDualStep4(guided, guidedCS);
      root.querySelector('[data-role="prev"]').disabled = state.idx === 0;
      root.querySelector('[data-role="next"]').disabled = state.idx === DUAL_STEP_LABELS.length - 1;
    }

    function renderPractice() {
      var def = DUAL_PRACTICE;
      var cs = computeCS(def);
      root.querySelector('[data-role="practicemodel"]').innerHTML = modelDescHTML(def);
      var body = root.querySelector('[data-role="practicebody"]');
      var html = '<div class="row"><b>¿Qué x_j valen 0?</b> ' + def.varNames.map(function (nm, j) {
        return '<label style="margin-right:10px"><input type="checkbox" data-role="pzero" data-j="' + j + '"> ' + esc(nm) + '</label>';
      }).join('') + '</div>';
      html += '<div class="row"><b>¿Qué restricciones primales son igualdad?</b> ' + def.b.map(function (v, i) {
        return '<label style="margin-right:10px"><input type="checkbox" data-role="peq" data-i="' + i + '"> Restricción ' + (i + 1) + '</label>';
      }).join('') + '</div>';
      html += '<div class="row"><b>x*:</b> ' + def.varNames.map(function (nm, j) {
        return esc(nm) + '= <input type="number" step="any" class="input-grid" data-role="px" data-j="' + j + '" style="width:5em">';
      }).join(' ') + '</div>';
      html += '<div class="row"><b>z* =</b> <input type="number" step="any" class="input-grid" data-role="pz" style="width:6em"></div>';
      html += '<div class="row"><button class="btn btn-primary btn-sm" data-role="pcheck">Corregir</button><span class="badge" data-role="presult"></span></div>';
      body.innerHTML = html;

      body.querySelector('[data-role="pcheck"]').addEventListener('click', function () {
        var okZero = true, okEq = true, okX = true, okZ = true;
        def.varNames.forEach(function (nm, j) {
          var checked = body.querySelector('[data-role="pzero"][data-j="' + j + '"]').checked;
          if (checked !== cs.zeroVars[j]) okZero = false;
        });
        def.b.forEach(function (v, i) {
          var checked = body.querySelector('[data-role="peq"][data-i="' + i + '"]').checked;
          var expected = Frac.from(def.y[i]).isPos();
          if (checked !== expected) okEq = false;
        });
        def.varNames.forEach(function (nm, j) {
          var val = parseFloat(body.querySelector('[data-role="px"][data-j="' + j + '"]').value);
          if (isNaN(val) || (!cs.singular && Math.abs(val - cs.x[j].toNumber()) > 1e-6)) okX = false;
        });
        var zval = parseFloat(body.querySelector('[data-role="pz"]').value);
        if (isNaN(zval) || (!cs.singular && Math.abs(zval - cs.z.toNumber()) > 1e-6)) okZ = false;
        var badge = body.querySelector('[data-role="presult"]');
        var ok = okZero && okEq && okX && okZ;
        badge.className = 'badge ' + (ok ? 'badge-ok' : 'badge-err');
        badge.textContent = ok ? 'Correcto' : ('Revisar: ' + [!okZero && 'variables en 0', !okEq && 'igualdades', !okX && 'x*', !okZ && 'z*'].filter(Boolean).join(', '));
      });
    }

    root.querySelector('[data-role="prev"]').addEventListener('click', function () { if (state.idx > 0) { state.idx--; render(); } });
    root.querySelector('[data-role="next"]').addEventListener('click', function () { if (state.idx < DUAL_STEP_LABELS.length - 1) { state.idx++; render(); } });
    root.querySelector('[data-role="solveall"]').addEventListener('click', function () { state.idx = DUAL_STEP_LABELS.length - 1; render(); });
    root.querySelector('[data-role="reset"]').addEventListener('click', function () { state.idx = 0; render(); });

    render();
    renderPractice();
  }

  /* =========================================================================
   * SECCIONES HTML + QUIZ + REGISTRO DEL CAPÍTULO
   * ========================================================================= */

  function taskPanel(def, idx) {
    return '<div class="panel exercise" data-model-idx="' + idx + '" style="margin-bottom:14px">' +
      '<div class="widget" data-widget="model-builder" data-idx="' + idx + '"></div>' +
      '</div>';
  }

  function workedPanel(def, idx) {
    return '<div class="panel" data-model-idx="' + idx + '" style="margin-bottom:14px">' +
      '<div class="widget" data-widget="worked-example" data-idx="' + idx + '"></div>' +
      '</div>';
  }

  var sA1 =
    '<div class="callout callout-def"><b>Ejercicio 1 (no es PL, resuélvalo usted).</b> ' + EX1_TASK_STATEMENT + '</div>' +
    '<p class="muted">Debajo, en «Ejemplos resueltos», hay una versión con otros números ya resuelta paso a paso para que vea el método.</p>';

  function buildSectionATasks() {
    var html = '<p>Estas son las 8 tareas de la clase: resuélvalas por su cuenta en papel. El corrector da un veredicto GLOBAL (objetivo / restricciones / dominio), sin decir qué línea falló, y ofrece hasta 3 pistas semánticas sin números. Lleva un contador de intentos.</p>' + sA1;
    MODEL_EXERCISES.forEach(function (def, idx) {
      if (def.kind === 'task') html += taskPanel(def, idx);
    });
    return html;
  }

  function buildSectionAWorked() {
    var html = '<p>Un ejercicio de cada tipo, con otros números y contexto, resuelto completo (modelo, explicación de cada restricción, vértices y óptimo) para que vea el método antes de aplicarlo usted mismo a las tareas de arriba.</p>' +
      '<div class="widget wide" data-widget="price-demand-worked"></div>';
    MODEL_EXERCISES.forEach(function (def, idx) {
      if (def.kind === 'worked') html += workedPanel(def, idx);
    });
    return html;
  }

  var examCallout =
    '<div class="callout callout-exam"><b>Lo que suele tomar el parcial:</b> plantear (variables, objetivo, restricciones) ejercicios de modelado con números distintos a los vistos en clase; resolver un simplex de 2 variables por tabla reproduciendo el formato exacto de la clase (columna pivote, cocientes, normalizar, hacer ceros); y aplicar holgura complementaria para pasar de una solución dual óptima a la primal (Paso 0 factibilidad, evaluar restricciones duales, identificar igualdades primales, resolver el sistema y verificar z*=w*, recordando que la regla es de una sola dirección).</div>';

  var quiz = [
    { q: 'En el ejercicio de precio-demanda resuelto (Tienda Norte, d=600−6p), ¿qué precio entre $40, $50 y $60 maximiza el ingreso total?', options: ['$40', '$50', '$60', 'Los tres dan lo mismo'], answer: 1, explain: 'IT(50)=$15 000 supera a IT(40)=IT(60)=$14 400.' },
    { q: 'En un modelo tipo Reddy Mikks (mezcla de dos recursos para dos productos), ¿qué representa la restricción de "demanda relativa" (por ejemplo x2 − x1 ≤ 1)?', options: ['Que la demanda de un producto no exceda a la del otro en más de cierta cantidad', 'El costo total de producción', 'La disponibilidad de materia prima', 'La utilidad por unidad'], answer: 0, explain: 'Ese tipo de restricción liga la demanda relativa entre dos productos, no un recurso ni un costo.' },
    { q: 'En el ejercicio resuelto "Sombreros del Sur" (simplex formato de la clase), ¿cuánto vale X1 en la solución óptima?', type: 'number', answer: 50, tol: 0.5, explain: 'El óptimo de ese ejemplo es (X1,X2)=(50,150).' },
    { q: 'Si un enunciado dice "la radio debe usarse al menos el triple que la TV" (x1 ≥ 3x2), ¿cómo se escribe con lado derecho 0?', options: ['x1 − 3x2 ≥ 0', '3x1 − x2 ≥ 0', 'x1 + 3x2 ≥ 0', 'x1 = 3x2 exactamente'], answer: 0, explain: 'x1 ≥ 3x2 se reescribe como x1 − 3x2 ≥ 0.' },
    { q: 'En el simplex formato de la clase, la columna pivote se elige como…', options: ['La de mayor coeficiente positivo en la fila Z', 'La de menor coeficiente en la fila Z (el más negativo); en empate, la de menor índice', 'La primera columna siempre', 'La que tenga el lado derecho más grande'], answer: 1, explain: 'Se busca el coeficiente más negativo de la fila Z; si hay empate, entra la variable de menor índice.' },
    { q: 'En la prueba de cociente para elegir la fila pivote, un cociente es "No válido" cuando…', options: ['El coeficiente de la columna pivote en esa fila es ≤ 0', 'El resultado es un número entero', 'El lado derecho es distinto de cero', 'La fila ya es la fila Z'], answer: 0, explain: 'Coeficiente negativo (razón negativa) o cero (división indefinida) invalidan el cociente.' },
    { q: 'En el ejemplo resuelto de holgura complementaria de la sección C, la restricción dual de x1 se cumple con holgura estricta. ¿Qué se concluye?', options: ['x1 = 0', 'x1 es la mayor de las tres variables', 'La restricción primal 1 es una igualdad', 'y1 debe valer 0'], answer: 0, explain: 'Holgura en la restricción dual de x1 (lado izquierdo mayor que el lado derecho) ⇒ x1 = 0 por la regla de holgura complementaria.' },
    { q: 'Regla de holgura complementaria: si una variable dual y_i es mayor que 0, entonces…', options: ['La restricción primal i se cumple como igualdad estricta', 'La variable primal x_i vale 0', 'La restricción dual i tiene holgura', 'z* nunca puede igualar a w*'], answer: 0, explain: 'y_i > 0 ⇒ la restricción primal i es una igualdad (Paso 2 del procedimiento). Ojo: la regla NO vale al revés (y_i=0 no implica holgura primal).' }
  ];

  IO.registerChapter({
    id: 'tareas', num: 6,
    title: 'Ejercicios de clase',
    summary: 'Las 8 tareas de modelado de la clase para resolver por su cuenta (veredicto global por categoría, pistas y contador de intentos, sin revelar la solución), un ejercicio resuelto de cada tipo, el simplex en el formato exacto de la clase con otros ejemplos, y el procedimiento del dual al primal por holgura complementaria.',
    css:
      '#tareas .panel{border:1px solid var(--line);border-radius:8px;padding:12px 14px;background:var(--paper-2);margin-bottom:10px}' +
      '#tareas .panel-title{font-family:"Archivo",sans-serif;font-weight:700;margin-bottom:6px}' +
      '#tareas table.data td, #tareas table.data th, #tareas table.tableau td, #tareas table.tableau th{font-family:"JetBrains Mono",monospace;font-variant-numeric:tabular-nums}' +
      '#tareas .frac{border-bottom:1px dotted var(--ink-2);cursor:help}',
    sections: [
      { id: 'tareas-s1', title: 'A. Ejercicios de modelado (tareas)', html: buildSectionATasks() },
      { id: 'tareas-s1w', title: 'A. Ejemplos resueltos (mismo tipo, otros números)', html: buildSectionAWorked() },
      {
        id: 'tareas-s2', title: 'B. Simplex en el formato de la clase',
        html: '<p>Tabla con columnas Básicas | Z | variables | holguras | R, tal como se ve en la clase. Paso a paso: a) columna pivote, b) fila pivote (cocientes), c) normalizar la fila pivote, d) hacer ceros en el resto de la columna. Estos ejemplos usan números distintos a los de la tarea de simplex de la clase; use el modo «Hazlo tú» para practicar eligiendo usted los pivotes (no se resalta ninguna columna ni fila de antemano).</p>' +
          '<div class="widget wide" data-widget="simplex-class"></div>'
      },
      {
        id: 'tareas-s3', title: 'C. Del dual al primal (holgura complementaria)',
        html: '<p>Procedimiento de la clase: Paso 0 comprobar que y* es factible en el dual; Paso 1 evaluar cada restricción dual con y*; Paso 2 identificar qué restricciones primales son igualdades; Paso 3 resolver el sistema; Paso 4 verificar z*=w*.</p>' +
          '<div class="widget wide" data-widget="dual-to-primal"></div>' + examCallout
      }
    ],
    mount: function (root) {
      root.querySelectorAll('[data-widget]').forEach(function (el) {
        var w = el.getAttribute('data-widget');
        if (w === 'price-demand-worked') mountPriceDemandWorked(el);
        else if (w === 'model-builder') mountModelBuilder(el, MODEL_EXERCISES[parseInt(el.getAttribute('data-idx'), 10)]);
        else if (w === 'worked-example') mountWorkedExample(el, MODEL_EXERCISES[parseInt(el.getAttribute('data-idx'), 10)]);
        else if (w === 'simplex-class') mountSimplexClassWidget(el);
        else if (w === 'dual-to-primal') mountDualToPrimalWidget(el);
      });
    },
    quiz: quiz
  });

  /* Hook interno de verificación (no forma parte del contrato público). El modelo correcto y el
   * óptimo de las tareas (MODEL_EXERCISES kind==='task') solo se usan aquí, en node/tests — nunca
   * se invoca IO.__cap2.solveLP ni se imprime el óptimo para esos ítems en el DOM. */
  IO.__tareas = {
    MODEL_EXERCISES: MODEL_EXERCISES, SIMPLEX_EXAMPLES: SIMPLEX_EXAMPLES, DUAL_EXAMPLES: DUAL_EXAMPLES,
    verifyModel: verifyModel, classifyObjective: classifyObjective, constraintsEquivalent: constraintsEquivalent,
    proportionalPositive: proportionalPositive, proportionalNegative: proportionalNegative, proportionalNonzero: proportionalNonzero,
    buildTableauSteps: buildTableauSteps, solveComplementarySlackness: solveComplementarySlackness, checkDualFeasible: checkDualFeasible
  };
})();
