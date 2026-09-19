/* Printable formula/procedure summary sheet, chapters 1-5. Global: IO.resumen = { html } */
(function (global) {
  'use strict';
  var IO = global.IO = global.IO || { chapters: [] };

  IO.resumen = {
    html: '' +
'<div class="resumen-sheet">' +

'<h2>1. Investigación de operaciones — ideas clave</h2>' +
'<ul>' +
'<li>Modelo = <strong>alternativas</strong> + <strong>restricciones</strong> + <strong>criterio (objetivo)</strong>.</li>' +
'<li>Fases de un estudio: definición del problema → construcción del modelo → solución → validación → implementación.</li>' +
'<li>Tipos de solución: óptima (exacta), heurística (aproximada), por simulación (imita el sistema).</li>' +
'</ul>' +

'<h2>2. Programación lineal — forma y solución</h2>' +
'<div class="kv">' +
'<div><span>Forma estándar</span><span class="eq">max/min z = Σ c<sub>j</sub>x<sub>j</sub> ; Σ a<sub>ij</sub>x<sub>j</sub> {≤,≥,=} b<sub>i</sub> ; x ≥ 0</span></div>' +
'<div><span>Propiedades del modelo LP</span><span>proporcionalidad, aditividad, certidumbre, no negatividad, divisibilidad</span></div>' +
'<div><span>Solución gráfica</span><span>dibujar rectas, sombrear región factible, evaluar z en vértices o deslizar recta iso-z</span></div>' +
'<div><span>No acotado</span><span>región factible se extiende infinitamente en la dirección de mejora de z</span></div>' +
'<div><span>No factible</span><span>no hay región común a todas las restricciones</span></div>' +
'</div>' +
'<p class="callout callout-def"><strong>Sensibilidad gráfica (2 variables):</strong> el vértice óptimo no cambia mientras la pendiente de z, −c<sub>1</sub>/c<sub>2</sub>, quede entre las pendientes de las dos restricciones activas en ese vértice.</p>' +

'<h2>3. Método simplex</h2>' +
'<table class="data">' +
'<thead><tr><th>Paso</th><th>Regla</th></tr></thead>' +
'<tbody>' +
'<tr><td>Forma de ecuación</td><td>agregar holgura (≤, +s), excedente (≥, −e), variables irrestrictas x = x⁺ − x⁻</td></tr>' +
'<tr><td>Condición de optimalidad (max)</td><td>entra la variable no básica con coeficiente <strong>más negativo</strong> en la fila z (si todos ≥ 0 → óptimo)</td></tr>' +
'<tr><td>Condición de optimalidad (min)</td><td>entra la variable no básica con coeficiente <strong>más positivo</strong> en la fila z</td></tr>' +
'<tr><td>Condición de factibilidad</td><td>sale la variable básica con <strong>razón mínima</strong> b<sub>i</sub>/a<sub>ir</sub>, solo entre a<sub>ir</sub> &gt; 0</td></tr>' +
'<tr><td>Gauss-Jordan</td><td>fila pivote ÷ elemento pivote; a cada otra fila restar (su coeficiente en columna pivote) × fila pivote</td></tr>' +
'</tbody></table>' +
'<p class="callout callout-def"><strong>Método M:</strong> variables artificiales con costo +M (min) o −M (max), M grande. <strong>Dos fases:</strong> fase 1 minimiza la suma de artificiales (debe dar 0); fase 2 continúa con el objetivo real desde esa base.</p>' +
'<table class="data"><thead><tr><th>Caso especial</th><th>Cómo se ve en el tableau</th></tr></thead><tbody>' +
'<tr><td>Degeneración</td><td>una o más variables básicas con valor 0</td></tr>' +
'<tr><td>Óptimos alternativos</td><td>coeficiente 0 en fila z de una variable no básica en el óptimo</td></tr>' +
'<tr><td>No acotado</td><td>columna entrante sin coeficientes positivos para la prueba de razón</td></tr>' +
'<tr><td>No factible</td><td>artificial queda positiva en la base al terminar fase 1 / con M</td></tr>' +
'</tbody></table>' +

'<h2>3.6 Sensibilidad algebraica</h2>' +
'<div class="kv">' +
'<div><span>Precio dual y<sub>i</sub></span><span>coeficiente de la holgura i en la fila z óptima (con signo del costo de oportunidad)</span></div>' +
'<div><span>Rango de factibilidad de b<sub>i</sub></span><span>rango donde B⁻¹b sigue ≥ 0 (la base óptima no cambia)</span></div>' +
'<div><span>Costo reducido de x<sub>j</sub></span><span>coeficiente de x<sub>j</sub> en la fila z óptima; si &gt; 0 (max) no conviene producirla</span></div>' +
'<div><span>Rango de optimalidad de c<sub>j</sub></span><span>rango de c<sub>j</sub> donde la base óptima actual sigue siendo óptima</span></div>' +
'</div>' +

'<h2>4. Dualidad</h2>' +
'<table class="data"><thead><tr><th>Primal (max)</th><th>Dual (min)</th></tr></thead><tbody>' +
'<tr><td>restricción ≤</td><td>variable dual y<sub>i</sub> ≥ 0</td></tr>' +
'<tr><td>restricción =</td><td>variable dual irrestricta</td></tr>' +
'<tr><td>restricción ≥</td><td>variable dual y<sub>i</sub> ≤ 0</td></tr>' +
'<tr><td>variable x<sub>j</sub> ≥ 0</td><td>restricción dual ≥</td></tr>' +
'<tr><td>variable x<sub>j</sub> irrestricta</td><td>restricción dual =</td></tr>' +
'</tbody></table>' +
'<p class="formula">y = c<sub>B</sub> B⁻¹ &nbsp;|&nbsp; columna de a<sub>j</sub> en la tabla = B⁻¹a<sub>j</sub> &nbsp;|&nbsp; fila z = c<sub>B</sub>B⁻¹a<sub>j</sub> − c<sub>j</sub></p>' +
'<p class="callout callout-def">Dualidad débil: z ≤ w para toda solución factible de max/min. Dualidad fuerte: z* = w* en el óptimo.</p>' +
'<p class="callout callout-def"><strong>Simplex dual:</strong> arranca con tabla óptima pero no factible (algún b<sub>i</sub> &lt; 0). Sale la fila con b<sub>i</sub> más negativo. Entra la variable que minimiza |z<sub>j</sub> − c<sub>j</sub>| / |a<sub>rj</sub>| entre los a<sub>rj</sub> &lt; 0 de esa fila. Si toda la fila de salida es ≥ 0 → problema no factible.</p>' +
'<p class="callout callout-def"><strong>Postóptimo:</strong> cambia b → recalcular X<sub>B</sub> = B⁻¹b (si algún componente &lt; 0, correr simplex dual). Cambia c o se agrega variable → recalcular fila z con y·a<sub>j</sub> − c<sub>j</sub> (si sigue óptimo, listo; si no, correr simplex primal).</p>' +

'<h2>5. Transporte y asignación</h2>' +
'<table class="data"><thead><tr><th>Método de inicio</th><th>Regla</th></tr></thead><tbody>' +
'<tr><td>Esquina noroeste (NW)</td><td>asignar lo máximo posible en la celda superior izquierda disponible, avanzar fila/columna</td></tr>' +
'<tr><td>Costo mínimo</td><td>asignar lo máximo posible en la celda de menor costo disponible, repetir</td></tr>' +
'<tr><td>Vogel</td><td>penalización = diferencia entre los 2 costos menores de cada fila/columna; asignar en la celda de menor costo de la fila/columna con mayor penalización</td></tr>' +
'</tbody></table>' +
'<p class="formula">MODI: u<sub>i</sub> + v<sub>j</sub> = c<sub>ij</sub> (básicas, u<sub>1</sub>=0) &nbsp;|&nbsp; evaluación no básica = u<sub>i</sub> + v<sub>j</sub> − c<sub>ij</sub> &nbsp;|&nbsp; entra la más positiva (en min); ciclo cerrado +/− ; θ = mínimo de las celdas con signo −; sale esa celda</p>' +
'<p class="callout callout-def">Balanceo: si oferta ≠ demanda, agregar fuente o destino ficticio con costo 0. Básicas necesarias = m + n − 1; si faltan, asignar 0 a una celda no básica (degeneración).</p>' +
'<p class="callout callout-def"><strong>Método húngaro:</strong> 1) restar el mínimo de cada fila; 2) restar el mínimo de cada columna; 3) cubrir todos los ceros con el mínimo número de líneas; 4) si líneas = n → asignación óptima (un cero por fila/columna); si líneas &lt; n → restar el mínimo no cubierto a todos los no cubiertos y sumarlo en las intersecciones cubiertas, repetir desde 3. Maximización: restar todos los costos del máximo de la matriz y aplicar el método normalmente.</p>' +

'<h2>Entera / binaria (examen · Taha cap. 9)</h2>' +
'<ul>' +
'<li>PEB: x<sub>j</sub> ∈ {0,1}. Relajación: 0 ≤ x<sub>j</sub> ≤ 1. Redondear el PL puede ser ilegal.</li>' +
'<li>Peterson &amp; Johnson: max 1x1+1,8x2+1,6x3+0,8x4+1,4x5, capital ≤ 20 → <strong>x=(1,0,1,1,0), Z=3,4</strong>.</li>' +
'<li>Really Big Shoe entero: 26 básquetbol + 12 fútbol = 38 equipos.</li>' +
'</ul>' +

'<h2>Flujo máximo (examen · Taha cap. 6)</h2>' +
'<ul>' +
'<li>Ford–Fulkerson: camino de aumento s→t, cuello = mínimo residual, sumar, repetir.</li>' +
'<li>Paro: no queda camino. Max-flow = min-cut.</li>' +
'<li>Red del examen A→F: <strong>flujo 15</strong>. Corte mínimo D→F (6) + E→F (9).</li>' +
'</ul>' +

'<h2>Algoritmos evolutivos (examen)</h2>' +
'<ul>' +
'<li>Exacto: garantiza óptimo (simplex, gráfico, Ford–Fulkerson).</li>' +
'<li>Heurístico: bueno y rápido, sin garantía (genético, tabú, recocido).</li>' +
'<li>AG: población, fitness, selección, cruce, mutación. Diversidad evita convergencia prematura. Paro: generaciones sin mejora.</li>' +
'</ul>' +

'<h2>Valores óptimos de referencia (verificar widgets)</h2>' +
'<table class="data"><thead><tr><th>Problema</th><th>Óptimo</th></tr></thead><tbody>' +
'<tr><td>Reddy Mikks</td><td>x=(3, 1.5), z=21</td></tr>' +
'<tr><td>Dieta</td><td>x=(470.6, 329.4), z=437.64</td></tr>' +
'<tr><td>Dos fases (min 4x1+x2)</td><td>x=(2/5, 9/5), z=17/5</td></tr>' +
'<tr><td>TOYCO</td><td>x2=100, x3=230, z=1350; y=(1,2,0)</td></tr>' +
'<tr><td>Dual Reddy Mikks</td><td>y=(3/4, 1/2, 0, 0), w=21</td></tr>' +
'<tr><td>Simplex dual (min 3x1+2x2)</td><td>x=(3/5, 6/5), z=21/5</td></tr>' +
'<tr><td>MG Auto (transporte)</td><td>z=313 200</td></tr>' +
'<tr><td>SunRay Transport</td><td>z=435 (NW=520, mín. costo=475, Vogel=475)</td></tr>' +
'<tr><td>Joboco (asignación)</td><td>z=27</td></tr>' +
'<tr><td>Lumbreras (examen 1)</td><td>x=0, y=40, Z=400; dual y1=2, y2=0</td></tr>' +
'<tr><td>Gráfico 3x+2y (examen 2)</td><td>(3, 12), Z=33</td></tr>' +
'<tr><td>Transporte A/B (examen 2)</td><td>Z=26</td></tr>' +
'<tr><td>Transporte C1/C2 (examen 4)</td><td>Z=27</td></tr>' +
'<tr><td>Plantas de energía (examen 3)</td><td>Z=49 710</td></tr>' +
'<tr><td>Peterson &amp; Johnson</td><td>proyectos 1,3,4 · Z=3,4</td></tr>' +
'<tr><td>Flujo A→F</td><td>15</td></tr>' +
'</tbody></table>' +
'</div>'
  };
})(typeof window !== 'undefined' ? window : globalThis);
