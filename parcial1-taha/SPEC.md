# SPEC — "Parcial 1 · IO" (Taha 9ª ed., capítulos 1–5)

Página HTML interactiva para estudiar la materia **Electiva: Investigación de Operaciones**
(UNI Itapúa, Ing. Informática). Parcial: **lunes 14 de septiembre de 2026**. Hoy: 5-sep-2026.
Libro base: Taha, *Investigación de operaciones*, 9ª edición. Se rinde hasta el capítulo 5 inclusive.

Todo el contenido visible al usuario va en **español** (rioplatense/paraguayo neutro, voseo NO, usar "usted"/impersonal).
Código, identificadores y comentarios en inglés.

## 1. Estructura de archivos (cada archivo tiene UN solo dueño)

```
parcial1-taha/
  index.html          (A)  shell: topbar, sidebar, <main id="view">, carga css + js en este orden:
                            js/lib/frac.js, js/quiz.js, js/plan.js, js/resumen.js,
                            js/cap1.js, js/cap2.js, js/lib/simplex.js, js/cap3.js, js/cap4.js, js/cap5.js, js/app.js
  css/style.css       (A)
  js/app.js           (A)  router, progreso, countdown, plan, simulacro, render de capítulos
  js/quiz.js          (A)  motor de autoevaluación
  js/plan.js          (A)  datos del plan de estudio (ver §6)
  js/resumen.js       (A)  hoja resumen de fórmulas y procedimientos, cap 1–5
  js/cap1.js          (A)
  js/cap2.js          (B)
  js/lib/simplex.js   (C)  motor simplex (tablas, Big-M, dos fases, sensibilidad)
  js/cap3.js          (C)
  js/cap4.js          (D)  (implementa su propio pivoteo con Frac; NO depende de simplex.js)
  js/cap5.js          (E)
  js/tareas.js        (F)  «Ejercicios de clase»: tareas del profesor (modelado, simplex formato clase, dual→primal) con ejemplos similares
  js/lib/frac.js      (Fable, ya escrito) aritmética exacta de fracciones
  build_single.py     (A)  genera ../IO-Parcial1-Taha.html con todo inline (css+js) para compartir/publicar
```

Sin frameworks. Sin fetch. Sin módulos ES (usar globals). Debe funcionar abriendo `index.html` con doble clic (file://).
Sin KaTeX/MathJax: las fórmulas se escriben con HTML (`<sub>`, `<sup>`) y la clase `.formula`.

## 2. Contrato entre módulos (OBLIGATORIO)

```js
window.IO = window.IO || { chapters: [] };
IO.registerChapter = IO.registerChapter || function (ch) { IO.chapters.push(ch); };

IO.registerChapter({
  id: 'cap3',                      // 'cap1'..'cap5'
  num: 3,
  title: 'Método simplex y análisis de sensibilidad',
  summary: 'Una o dos frases.',
  css: '#cap3 .foo { ... }',       // opcional; TODOS los selectores prefijados con #cap3
  sections: [                      // se renderizan en orden dentro de <section id="cap3">
    { id: 'cap3-s1', title: '3.1 Modelo de PL en forma de ecuación', html: '<p>...</p><div class="widget" data-widget="simplex-eqform"></div>' },
  ],
  mount(root) { /* root = elemento <section id="cap3">; buscar root.querySelectorAll('[data-widget]') y montar */ },
  quiz: [
    { q: 'Pregunta', options: ['a','b','c','d'], answer: 1, explain: 'Por qué.' },
    { q: 'Valor de z óptimo…', type: 'number', answer: 21, tol: 0.01, explain: '...' }
  ]
});
```

- `app.js` inyecta `css`, renderiza `sections` (cada una con `<h2>` + botón «Marcar como estudiado»), llama `mount(root)`, y al final agrega el bloque de **Autoevaluación** con `quiz` mediante `IO.Quiz.render(container, quiz, storageKey)`.
- `quiz.js` expone `IO.Quiz = { render(container, questions, key), grade(...) }` y `IO.Quiz.randomFrom(chapters, n)` para el simulacro.
- Progreso en `localStorage`: `io_progress` (JSON `{sectionId: true}`), `io_plan` (`{dayId: {taskIdx: true}}`), `io_quiz_<capId>` (último puntaje), `io_theme` ('light'|'dark'|null). Envolver cada acceso en try/catch.
- **Desmontaje y limpieza (obligatorio):** `app.js` mantiene `IO._cleanups = []` y expone `IO.registerCleanup(fn)`. Antes de renderizar cualquier vista, `app.js` ejecuta todas las funciones registradas (en try/catch), vacía la lista y llama `ch.unmount(root)` si el capítulo lo define. Todo widget que agregue listeners globales (`resize`, `themechange`, `matchMedia`), intervalos o timeouts debe registrarlos con `IO.registerCleanup`. Los módulos definen el fallback `IO.registerCleanup = IO.registerCleanup || function (fn) { (IO._cleanups = IO._cleanups || []).push(fn); };`.
- **Tema:** al cambiar el tema, `app.js` emite `window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }))`. Los widgets que dibujan en canvas escuchan ese evento (y lo limpian con `registerCleanup`).
- Router por hash: `#inicio`, `#cap1`…`#cap5`, `#resumen`, `#simulacro`, y `#cap3-s4` scrollea a la sección.
- Cada widget arranca **con un ejemplo cargado y resuelto/visible** (nunca vacío).
- Widgets paso a paso usan una barra `.step-bar` con botones «◀ Anterior», «Siguiente ▶», «Resolver todo», «Reiniciar» y un `.step-text` que explica el paso en español.

## 3. Clases CSS que define A y usan todos

`.panel`, `.panel-title`, `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-sm`, `.row` (flex wrap gap), `.grid-2`, `.grid-3`,
`.callout`, `.callout-def` (definición), `.callout-tip`, `.callout-warn`, `.callout-exam` (típico de parcial),
`.formula` (bloque mono centrado), `.eq` (inline mono), `.tableau` (tabla simplex: `th`, `td`, `.pivot-row`, `.pivot-col`, `.pivot-cell`, `.basic`, `.hl`),
`table.data`, `.input-grid` (inputs numéricos chicos), `.kv` (lista label/valor), `.badge`, `.badge-ok`, `.badge-warn`, `.badge-err`,
`.muted`, `.wide` (widget que ocupa todo el ancho), `.step-bar`, `.step-text`, `.canvas-wrap` (canvas responsive),
`.example-picker` (select de ejemplos precargados), `.solution` (bloque colapsable `<details>` para soluciones de ejercicios), `.exercise`.

Los módulos B–E **solo** usan estas clases más su CSS propio prefijado.

## 4. Diseño visual (tokens; A los implementa, todos los respetan)

Concepto: *cuaderno de cálculo de ingeniería*. Papel cuadriculado tenue, tinta índigo, marcas en ámbar como lápiz de corrección.
Utilitario y pulido. Sin hero gigante. Sin emojis como marcadores.

Colores (light): `--paper #F7F8FA`, `--paper-2 #FFFFFF`, `--grid rgba(31,42,68,.07)`, `--ink #1F2A44`, `--ink-2 #4A5470`,
`--line #D5D9E3`, `--accent #C77D1A` (ámbar), `--accent-ink #7A4A08`, `--ok #2E7D5B`, `--warn #B8860B`, `--err #B23A3A`, `--pivot rgba(199,125,26,.22)`.
Dark: `--paper #141824`, `--paper-2 #1B2130`, `--grid rgba(255,255,255,.05)`, `--ink #E6E9F0`, `--ink-2 #A9B0C3`, `--line #2E3548`, `--accent #E39A3B`, `--accent-ink #F3C98B`, `--pivot rgba(227,154,59,.25)`.
Tres estados de tema: `:root` (light), `@media (prefers-color-scheme: dark)` con `:root:not([data-theme="light"])`, y `:root[data-theme="dark"]`. Toggle en topbar. `body` con `background: var(--paper)` explícito y fondo cuadriculado con `background-image` de dos `linear-gradient` de `--grid` cada 24px.

Tipografía (Google Fonts): display **Archivo** (700/800, `font-stretch` condensada donde exista), cuerpo **Source Sans 3** (400/600), mono **JetBrains Mono** (400/600) para tablas simplex, fórmulas y números. Fallbacks reales. Texto corrido máx. 72ch. `tabular-nums` en tablas.

Layout: sidebar izquierda fija 260px (en móvil se colapsa a menú superior) con: countdown «Faltan N días», lista Inicio/Cap 1–5/Resumen/Simulacro, barra de progreso por capítulo (% de secciones marcadas). Main con `padding: 32px 40px`. Widgets `.wide` ocupan hasta 1100px.

## 5. Contenido por capítulo (teoría + práctica). Fidelidad al índice de Taha 9ª ed.

Cada sección: teoría clara (definiciones en `.callout-def`), 1 ejemplo resuelto del libro, y 1–3 ejercicios con `<details class="solution">`.
Al final de cada capítulo: `.callout-exam` «Lo que suele tomar el parcial» y quiz de **10–14 preguntas** (mezclar opción múltiple y numéricas).

### Cap 1 — Qué es la investigación de operaciones (A)
1.1 Introducción · 1.2 Modelos de IO (alternativas, restricciones, criterio; ej. rectángulo de perímetro L: max área; ej. cruce de calles) · 1.3 Solución del modelo (óptima, heurística, simulación) · 1.4 Colas y simulación (solo idea) · 1.5 Arte del modelado (mundo real → supuesto → modelo) · 1.6 Más que matemáticas (aspectos humanos; ejemplos del libro: ascensores con espejos, línea de espera única) · 1.7 Fases de un estudio de IO (definición del problema, construcción del modelo, solución, validación, implementación).
Widget: «Clasificador de modelos» — tarjetas con situaciones; el usuario elige tipo (PL / entero / red / colas / simulación) y recibe corrección.

### Cap 2 — Modelado con programación lineal (B)
2.1 Modelo con dos variables: **Reddy Mikks** (max z = 5x1 + 4x2; 6x1+4x2 ≤ 24; x1+2x2 ≤ 6; −x1+x2 ≤ 1; x2 ≤ 2; x ≥ 0; óptimo (3, 1.5), z = 21). Propiedades: proporcionalidad, aditividad, certidumbre, no negatividad.
2.2 Solución gráfica: max (Reddy Mikks) y min (**problema de la dieta**: min z = 0.3x1 + 0.9x2; x1+x2 ≥ 800; 0.21x1 − 0.30x2 ≤ 0; 0.03x1 − 0.01x2 ≥ 0; óptimo (470.6, 329.4), z = 437.64).
   **Widget «Solucionador gráfico»** (canvas): hasta 6 restricciones de 2 variables (a·x1 + b·x2 {≤,≥,=} c), objetivo, max/min. Dibuja rectas, sombrea región factible, calcula vértices (intersecciones factibles), tabla de vértices con z, marca óptimo, y **slider de recta iso-z** que se desplaza. Detecta no acotado / no factible. Ejemplos precargados: Reddy Mikks, Dieta, y 3 más (óptimos alternativos, no acotado, no factible).
   **Widget «Sensibilidad gráfica»** (adelanta 3.6.1 porque el libro lo hace en gráfico): sliders de c1 y c2 muestran cómo cambia el vértice óptimo y el rango de c1/c2 en el que el óptimo NO cambia (regla de pendientes: −a1/a2 ≤ −c1/c2 ≤ −b1/b2); slider de lado derecho b_i mostrando el **precio dual** (valor por unidad) y su rango de factibilidad.
2.3 Solver/AMPL: solo una nota breve (no entra en parcial escrito), con la forma de plantear en Excel Solver.
2.4 Aplicaciones (formulación, sin resolver a mano): inversión (Bank One), producción e inventario, mano de obra (plan de buses), desarrollo urbano, mezcla y refinación. Para cada una: enunciado resumido, variables, modelo completo.
   **Widget «Entrenador de formulación»**: 6 enunciados; el usuario arma el modelo eligiendo variables/objetivo/restricciones entre opciones (drag no; usar selects/checkbox) y se corrige. Más 4 ejercicios de formulación con solución desplegable.

### Cap 3 — Método simplex y análisis de sensibilidad (C)
3.1 Forma de ecuación: holguras, excedentes, variables no restringidas (x = x⁺ − x⁻), RHS no negativo.
3.2 Transición gráfica → algebraica: soluciones básicas, variables básicas/no básicas, número de soluciones básicas C(n,m), puntos extremos ⇔ soluciones básicas factibles.
3.3 Método simplex: naturaleza iterativa, condición de optimalidad (max: entra la no básica con coeficiente más negativo en fila z), condición de factibilidad (razón mínima), operaciones de Gauss-Jordan (fila pivote, filas restantes), resumen del algoritmo.
3.4 Solución artificial inicial: **método M** y **dos fases** (ejemplo: min z = 4x1 + x2; 3x1 + x2 = 3; 4x1 + 3x2 ≥ 6; x1 + 2x2 ≤ 4; óptimo (2/5, 9/5), z = 17/5).
3.5 Casos especiales: degeneración (max 3x1+9x2; x1+4x2 ≤ 8; x1+2x2 ≤ 4), óptimos alternativos (max 2x1+4x2; x1+2x2 ≤ 5; x1+x2 ≤ 4), no acotado (max 2x1+x2; x1−x2 ≤ 10; 2x1 ≤ 40), no factible (max 3x1+2x2; 2x1+x2 ≤ 2; 3x1+4x2 ≥ 12).
3.6 Sensibilidad: gráfica (referir al widget de cap 2), algebraica — cambios en el lado derecho (precios duales/valores por unidad, rangos de factibilidad) y cambios en la función objetivo (costos reducidos, rangos de optimalidad). Ejemplo **TOYCO**: max z = 3x1 + 2x2 + 5x3; x1 + 2x2 + x3 ≤ 430; 3x1 + 2x3 ≤ 460; x1 + 4x2 ≤ 420; óptimo x2 = 100, x3 = 230, z = 1350; duales y = (1, 2, 0); rangos de factibilidad b1 ∈ [230, 440], b2 ∈ [440, 860], b3 ≥ 400 (B⁻¹ óptima: fila 3 = (−2, 1, 1); x_B = B⁻¹b ≥ 0 ⇒ −860 + 460 + b3 ≥ 0 ⇒ b3 ≥ 400).
3.7 Temas de cálculo (nota breve: tamaño, degeneración, simplex revisado sólo como idea).
   **`js/lib/simplex.js`** expone `IO.Simplex`:
   - `parse({ type:'max'|'min', c:[...], constraints:[{a:[...], op:'<='|'>='|'=', b}], varNames })` → modelo estándar con holguras/excedentes/artificiales (usando `Frac`).
   - `solve(model, { method:'bigM'|'twophase'|'auto' })` → `{ status:'optimal'|'unbounded'|'infeasible'|'degenerate'|'alternative', iterations:[{tableau, basis, entering, leaving, ratios, pivot:{r,c}, note}], optimal:{x, z} , sensitivity:{...} }`. Cada `tableau` es matriz de `Frac`. `note` = explicación en español del paso.
   - `sensitivity(finalIteration, model)` → duales, costos reducidos, rangos de RHS y de coeficientes objetivo.
   - `toHTML(iteration, varNames)` → tabla `.tableau` con pivote resaltado.
   **Widget «Simplex paso a paso»**: editor del modelo (n vars ≤ 5, m restr ≤ 5), elección de método (M / dos fases), «Siguiente ▶» muestra: variable de entrada (columna resaltada), cocientes, variable de salida (fila resaltada), pivote, y explicación. Al final muestra caso detectado y solución. Ejemplos precargados: Reddy Mikks, TOYCO, el de dos fases, y los 4 casos especiales.
   **Widget «Sensibilidad algebraica»**: a partir del tableau óptimo de TOYCO (u otro) muestra precios duales, rangos de factibilidad y optimalidad, y permite «¿Qué pasa si b_i = …?» / «¿si c_j = …?» y contesta si sigue óptimo/factible.

### Cap 4 — Dualidad y análisis postóptimo (D)
4.1 Definición del dual: tabla de reglas (max ↔ min; restricción ≤ en max → variable dual ≥ 0; = → irrestricta; ≥ en max → ≤ 0; y viceversa para min). Ejemplos: Reddy Mikks dual (min w = 24y1 + 6y2 + y3 + 2y4; 6y1 + y2 − y3 ≥ 5; 4y1 + 2y2 + y3 + y4 ≥ 4; y ≥ 0; óptimo y = (3/4, 1/2, 0, 0), w = 21) y dos ejemplos con = e irrestrictas.
4.2 Relaciones primal-dual: repaso de matrices (producto, inversa), diseño de la tabla simplex (B⁻¹ bajo las columnas de las variables iniciales), **solución dual óptima** (3 métodos: y = c_B B⁻¹; coeficiente z de la holgura + costo original; fórmula y_i = z_j − c_j de la variable inicial), cálculos con la tabla (columna de restricción = B⁻¹ · a_j; fila z = c_B B⁻¹ a_j − c_j). Dualidad débil/fuerte: z ≤ w en max, iguales en el óptimo.
4.3 Interpretación económica: variables duales = valor por unidad de recurso (TOYCO: y1 = 1, y2 = 2, y3 = 0 → recurso 3 abundante); restricciones duales = costo reducido = costo de recursos − ingreso; «vale la pena producir» si costo reducido ≤ 0.
4.4 Algoritmos adicionales: **simplex dual** (arranca óptimo no factible: sale la variable con RHS más negativo; entra la que da min |z_j − c_j| / |a_rj| con a_rj < 0). Ejemplo: min z = 3x1 + 2x2; 3x1 + x2 ≥ 3; 4x1 + 3x2 ≥ 6; x1 + x2 ≤ 3; óptimo (3/5, 6/5), z = 21/5. **Simplex generalizado**: idea (alternar dual/primal cuando no es ni óptimo ni factible).
4.5 Análisis postóptimo: cambios que afectan factibilidad (nuevo b → X_B = B⁻¹ b; si negativo, simplex dual; agregar restricción) y cambios que afectan optimalidad (nuevo c → recomputar fila z; agregar actividad/variable: costo reducido con y·a_j − c_j). Ejemplos con TOYCO.
   **Widget «Constructor del dual»**: editor de primal (≤ 5×5, con ≤/≥/=, variables ≥0/≤0/irrestrictas); genera el dual con explicación regla por regla.
   **Widget «Simplex dual paso a paso»** (pivoteo propio con `Frac`): tabla inicial, fila que sale, cocientes, entrada, pivote; detecta no factible (fila negativa sin coeficientes negativos).
   **Widget «Postóptimo TOYCO»**: cambiar b (recalcula B⁻¹b y dice si hace falta simplex dual, y lo corre) y cambiar c o agregar variable (recalcula fila z y dice si sigue óptimo; corre simplex primal si no). Muestra B⁻¹ y c_B B⁻¹.

### Cap 5 — Modelo de transporte y sus variantes (E)
5.1 Definición: fuentes/destinos, oferta/demanda, costos, balanceo con fuente/destino ficticio. Ejemplo **MG Auto** (3 plantas: LA 1000, Detroit 1500, Nueva Orleans 1200; 2 centros: Denver 2300, Miami 1400; costos [[80,215],[100,108],[102,68]]; óptimo 313 200) y el caso desbalanceado (Detroit 1300 → destino ficticio).
5.2 Modelos no tradicionales: producción-inventario como transporte (períodos = fuentes/destinos, costo de almacenamiento por período, M para producir hacia atrás), modelo de recolección de herramientas (ejemplo del libro). Explicar cómo mapearlos.
5.3 Algoritmo de transporte: solución de inicio por **esquina noroeste**, **costo mínimo** y **Vogel**; cálculos iterativos con **método de multiplicadores (MODI, u_i + v_j = c_ij en básicas; u_i + v_j − c_ij en no básicas; entra la más positiva en min)**; ciclo cerrado; variable que sale; degeneración (m+n−1 básicas, asignar 0). Ejemplo **SunRay Transport**: oferta (15, 25, 10), demanda (5, 15, 15, 15), costos [[10,2,20,11],[12,7,9,20],[4,14,16,18]]; óptimo z = 435 (NW: 520; costo mínimo: 475; Vogel: 475). 5.3.3 explicación de multiplicadores con el simplex (dual del transporte).
5.4 Modelo de asignación: **método húngaro** (restar mínimo de filas, luego columnas, cubrir ceros con mínimas líneas, si líneas < n: restar el mínimo no cubierto y sumar en intersecciones). Ejemplo Joboco (3 hijos × 3 tareas, costos [[15,10,9],[9,15,10],[10,12,8]]; óptimo 27) y el ejemplo 4×4 del libro. 5.4.2 relación con simplex (idea).
   **Widget «Transporte paso a paso»**: matriz editable (hasta 5×5) con oferta/demanda, botón «Balancear» (agrega ficticio), método de inicio a elegir, paso a paso del inicio (celda que se asigna resaltada, oferta/demanda restante), luego MODI iterativo: muestra u_i, v_j, evaluaciones de no básicas, celda entrante, **ciclo cerrado dibujado** (signos +/−), θ, nueva tabla, hasta óptimo. Ejemplos: SunRay, MG Auto, desbalanceado, degenerado.
   **Widget «Húngaro paso a paso»**: matriz hasta 5×5, pasos con celdas/líneas resaltadas, asignación final y costo. Ejemplos: Joboco, 4×4 del libro, y uno de maximización (convertir restando del máximo).

### Ejercicios de clase (`js/tareas.js`, ruta `#tareas`)
Fuente: PDFs del profesor en la carpeta de la materia (`EjerciciosModelado.pdf`, `Copia de seguridad de Metodo Simplex.pdf`, `Dual_a_Primal.pdf`).
Se registra con `id: 'tareas'`, `num: 6`, título «Ejercicios de clase». `app.js` lo muestra en el menú después del Cap 5, sin el prefijo «Cap N.», y lo excluye del simulacro (solo entran cap1–cap5).
- A. Modelado: los 8 ejercicios de la clase con widget «Armar el modelo» (inputs de coeficientes, verificación línea por línea) y solución paso a paso; cada uno con un ejercicio similar.
- B. Simplex en el formato de la clase (columnas Básicas | Z | vars | holguras | R; sub-pasos a–d con operaciones «5R2 + R1»); modo «Hazlo tú».
- C. Del dual al primal por holgura complementaria (4 pasos de la clase); modo «Hazlo tú».
Funciones puras en `IO.__tareas`; pruebas en `tests/tareas.test.js`.

## 6. Plan de estudio (datos para `js/plan.js`; A también lo muestra en Inicio con checkboxes)

Fecha de hoy 2026-09-05 (sábado). Parcial lunes 2026-09-14. Sesiones de 3 h con técnica 50/10.

| Día | Fecha | Tema | Tareas |
|---|---|---|---|
| 1 | Sáb 5 sep | Cap 1 + 2.1–2.2 | Leer 1.1–1.7; Reddy Mikks a mano; dieta a mano; widget gráfico con 3 ejemplos; quiz cap 1 |
| 2 | Dom 6 sep | Cap 2.4 formulación | Formular 5 aplicaciones sin mirar; entrenador de formulación; 4 ejercicios; quiz cap 2 |
| 3 | Lun 7 sep | Cap 3.1–3.3 simplex | Forma de ecuación; soluciones básicas; Reddy Mikks por simplex a mano (3 tablas) y verificar con widget |
| 4 | Mar 8 sep | Cap 3.4–3.5 | Método M y dos fases a mano; identificar los 4 casos especiales en tableau |
| 5 | Mié 9 sep | Cap 3.6 sensibilidad | TOYCO: duales, rangos de factibilidad y optimalidad; sensibilidad gráfica; quiz cap 3 |
| 6 | Jue 10 sep | Cap 4.1–4.3 dualidad | Escribir el dual de 5 problemas; y = c_B B⁻¹; interpretación económica; dualidad débil/fuerte |
| 7 | Vie 11 sep | Cap 4.4–4.5 | Simplex dual a mano; postóptimo TOYCO (cambiar b, cambiar c, nueva variable); quiz cap 4 |
| 8 | Sáb 12 sep | Cap 5 transporte y asignación | SunRay: NW, costo mínimo, Vogel, MODI hasta óptimo a mano; húngaro 3×3 y 4×4; quiz cap 5 |
| 9 | Dom 13 sep | Simulacro y repaso | Simulacro 90 min sin apuntes; corregir; releer Resumen; rehacer los ejercicios fallados |
| 10 | Lun 14 sep | Parcial | Repaso de 30 min del Resumen; dormir bien; llevar calculadora |

## 7. Simulacro (A)
`#simulacro`: elige 20 preguntas al azar (4 por capítulo) del banco de todos los capítulos, cronómetro de 90 min visible, botón «Entregar», nota sobre 100, revisión con explicaciones, y lista «temas a repasar» (capítulos con < 70 %).

## 8. Calidad
- Sin errores en consola. Probar cada widget con sus ejemplos precargados y verificar los óptimos indicados en §5 (son valores del libro).
- Aritmética exacta con `Frac` en simplex/dual/postóptimo; mostrar fracciones (`3/4`) y decimal en tooltip/paréntesis.
- Todo botón con `:focus-visible`. `prefers-reduced-motion` respetado.
- Sin dependencias externas salvo Google Fonts.
- Pruebas automáticas en `tests/` con `node:test` + `assert` (sin dependencias). Cargador común: `tests/helpers/load.js` (`loadScripts([...rutas relativas a parcial1-taha])` devuelve el contexto `vm` con `IO`, `Frac`, `window`, `document` mínimo y `localStorage` en memoria). Ejecutar con `node --test tests/`.
- `build_single.py` falla (exit ≠ 0, nombre del archivo faltante) si falta un CSS o JS local; los enlaces externos (Google Fonts) se mantienen sin inlinear.
