# Implementación de mejoras verificadas

## Instrucción principal

Implementar las correcciones descritas en este documento dentro del proyecto
`Investigación en Operaciones`.

Antes de modificar código:

1. Leer `SPEC.md` y este documento por completo.
2. Revisar los archivos involucrados y reproducir cada error.
3. Preservar la arquitectura actual: JavaScript sin frameworks, scripts globales y
   funcionamiento offline.
4. Priorizar exactitud matemática, pruebas automáticas y cambios pequeños.
5. No modificar los PDF ni hacer cambios estéticos innecesarios.
6. No hacer commits salvo petición expresa.

El artefacto final generado es `../IO-Parcial1-Taha.html`.

## 1. Corregir `Frac.from`

Archivo: `js/lib/frac.js`.

### Problemas reproducidos

- `Frac.from(1e-7)` devuelve `0`.
- La conversión falla con notación científica.
- Entradas inválidas pueden convertirse silenciosamente en cero.
- Una cadena como `1/2/3` no debe aceptarse como `1/2`.

### Requisitos

- Soportar correctamente `1e-7`, `2.5e-4`, `-3e2` y valores equivalentes.
- Mantener numerador y denominador reducidos.
- Rechazar fracciones mal formadas y entradas no numéricas con un error claro,
  salvo cuando una API existente necesite explícitamente otro comportamiento.
- Mantener correctas todas las operaciones existentes.

## 2. Corregir el motor simplex

Archivo: `js/lib/simplex.js`.

### 2.1 Transición de fase I a fase II

Caso mínimo:

```js
{
  type: 'max',
  c: [1],
  constraints: [
    { a: [-1], op: '=', b: 0 }
  ]
}
```

Resultado correcto:

- estado óptimo;
- `x1 = 0`;
- `z = 0`.

Problema actual: con `method: 'twophase'` devuelve `unbounded`, aunque Big M
devuelve correctamente el óptimo.

Corregir la transición de fase I a fase II:

- pivotear fuera las artificiales básicas nulas cuando sea posible;
- eliminar restricciones redundantes cuando una artificial básica nula no pueda
  abandonar la base;
- eliminar columnas artificiales antes de fase II;
- actualizar índices de la base;
- reconstruir correctamente la fila objetivo.

### 2.2 Ciclaje y límite de iteraciones

Caso de regresión:

```js
{
  type: 'max',
  c: [10, -57, -9, -24],
  constraints: [
    { a: [0.5, -5.5, -2.5, 9], op: '<=', b: 0 },
    { a: [0.5, -1.5, -0.5, 1], op: '<=', b: 0 },
    { a: [1, 0, 0, 0], op: '<=', b: 1 }
  ]
}
```

La implementación actual alcanza 60 iteraciones y devuelve `z=0` como solución
degenerada, aunque `(1,0,1,0)` es factible y produce `z=1`.

Requisitos:

- implementar una regla anticiclado determinista, preferentemente Bland;
- conservar el historial educativo de iteraciones;
- distinguir `optimal`, `alternative`, `degenerate`, `unbounded`, `infeasible` e
  `iteration_limit`;
- nunca presentar como óptimo un resultado que solo agotó el límite.

### 2.3 Rangos de optimalidad

Caso mínimo:

```js
{
  type: 'max',
  c: [1],
  constraints: [
    { a: [1], op: '<=', b: 2 }
  ]
}
```

Resultado correcto:

- `x1 = 2`;
- `z = 2`;
- el rango del coeficiente de `x1` que conserva la base es `[0,+inf)`;
- en `c=0` existen múltiples óptimos.

Problema actual: informa aproximadamente `(-inf,2]`.

Requisitos:

- corregir fórmulas y signos para variables básicas y no básicas;
- contemplar maximización y minimización;
- representar correctamente límites infinitos;
- comprobar también los datos de sensibilidad de TOYCO;
- no cambiar resultados del material sin demostración matemática.

## 3. Corregir el solucionador gráfico

Archivo: `js/cap2.js`.

La detección actual de no acotación compara óptimos dentro de dos cajas
artificiales. Esto confunde óptimos alejados con problemas no acotados.

Caso de regresión:

```js
const constraints = [
  { a: 1,  b: -1,    op: '<=', c: 1 },
  { a: -1, b: 1.001, op: '<=', c: 0 }
];
const c1 = 1;
const c2 = 1;
const sense = 'max';
```

Resultado correcto:

- problema acotado;
- óptimo `(1001,1000)`;
- `z = 2001`.

Requisitos:

- no determinar no acotación comparando cajas arbitrarias;
- analizar matemáticamente las direcciones de recesión o aplicar un
  procedimiento equivalente correcto para PL de dos variables;
- ajustar automáticamente la escala para mostrar óptimos alejados;
- conservar los estados `optimal`, `alternative`, `unbounded` e `infeasible`.

## 4. Reparar el simulacro

Archivo: `js/app.js`.

### Problemas detectados

- Navegar fuera destruye el DOM, pero puede dejar el temporizador activo.
- Al regresar se pierde el intento y sus respuestas.
- Si vence el tiempo fuera de la vista, el código puede intentar modificar
  elementos inexistentes.

### Requisitos

- conservar en memoria y `localStorage` las preguntas, respuestas, hora final,
  estado entregado y resultado;
- restaurar exactamente el intento al regresar a `#simulacro`;
- calcular el tiempo desde `endTime`, no contando ticks;
- detener intervalos al desmontar una vista;
- finalizar de forma segura si el tiempo vence fuera de la pantalla;
- ofrecer `Nuevo simulacro`, con confirmación si existe uno activo;
- evitar temporizadores y listeners duplicados.

## 5. Limpiar listeners globales

Archivo principal: `js/cap2.js`. Revisar también los demás capítulos.

Los widgets agregan listeners de `resize`, `themechange` y `matchMedia` cada vez
que se montan y no siempre los retiran.

Requisitos:

- establecer un mecanismo de desmontaje de vistas o widgets;
- limpiar listeners, intervalos y demás recursos al cambiar de ruta;
- evitar que visitar repetidamente un capítulo multiplique ejecuciones;
- si los widgets escuchan `themechange`, hacer que `app.js` lo emita al cambiar
  el tema o sustituirlo por un mecanismo coherente.

## 6. Documentación y compilación

### Corregir `SPEC.md`

La especificación contiene `b3 >= 20` para TOYCO, mientras el capítulo indica
correctamente `b3 >= 400`. Verificar primero el cálculo con la base óptima y
actualizar la especificación.

### Endurecer `build_single.py`

Actualmente un JavaScript local faltante puede omitirse y producir un HTML
incompleto.

Requisitos:

- fallar con código distinto de cero si falta un CSS o JavaScript local;
- identificar claramente el archivo faltante;
- mantener sin inlinear enlaces externos como Google Fonts;
- continuar generando correctamente `../IO-Parcial1-Taha.html` cuando todas las
  dependencias existen;
- no agregar dependencias de terceros.

### Crear documentación de uso

Crear `README.md` dentro de esta carpeta. Debe explicar:

- cómo abrir la aplicación;
- cómo levantar un servidor local;
- cómo ejecutar las pruebas;
- cómo regenerar el HTML único;
- qué archivos son fuentes y cuál es generado;
- cómo se conserva, exporta o elimina el progreso.

## 7. Pruebas automáticas

Crear una suite en `tests/`, preferentemente con `node:test` y `assert`, sin
instalar dependencias.

Debe cubrir como mínimo:

### Fracciones

- enteros, decimales, negativos y fracciones;
- notación científica;
- división por cero;
- entradas inválidas.

### Simplex

- Reddy Mikks: `z=21`;
- TOYCO: `z=1350`;
- dos fases con `-x=0`;
- problemas inviables y no acotados;
- óptimos alternativos y degeneración;
- el caso de ciclaje anterior;
- sensibilidad de variables básicas y no básicas.

### Método gráfico

- óptimo normal;
- óptimos alternativos;
- problema inviable;
- problema no acotado;
- caso acotado con óptimo `(1001,1000)`.

### Transporte y asignación

- SunRay: NW `520`, costo mínimo `475`, Vogel `475`, MODI `435`;
- MG Auto: `313200`;
- Joboco: `27`;
- balanceo y degeneración.

### Build

- generación correcta;
- fallo al faltar una dependencia local;
- inclusión de todos los módulos en el HTML final.

Si `app.js` no puede probarse sin un DOM, extraer la gestión del estado del
simulacro a funciones puras testeables en vez de agregar un framework pesado.

## 8. Criterios de aceptación

La implementación se considera terminada únicamente cuando:

- todos los errores anteriores tienen pruebas de regresión;
- todas las pruebas pasan;
- no hay errores de sintaxis JavaScript;
- se mantienen estos resultados:
  - Reddy Mikks: `21`;
  - TOYCO: `1350`;
  - SunRay: `435`;
  - MG Auto: `313200`;
  - Joboco: `27`;
- `max x` sujeto a `-x=0` devuelve `x=0`, `z=0`;
- el caso gráfico alejado devuelve `(1001,1000)`, `z=2001`;
- agotar iteraciones no devuelve `optimal` ni `degenerate`;
- navegar fuera y dentro del simulacro no pierde las respuestas;
- no quedan temporizadores ni listeners duplicados;
- `python3 build_single.py` regenera `../IO-Parcial1-Taha.html`;
- el HTML generado queda actualizado;
- no se introducen dependencias externas en la aplicación.

## 9. Forma de trabajo

1. Reproducir cada error antes de corregirlo.
2. Implementar cambios pequeños y localizados.
3. Ejecutar las pruebas después de cada grupo de cambios.
4. No hacer pasar pruebas reduciendo precisión o cambiando resultados esperados.
5. No reemplazar soluciones matemáticas por heurísticas de tamaño de ventana.
6. No eliminar las explicaciones y vistas paso a paso de los widgets.
7. Regenerar el HTML único solamente después de aprobar todas las pruebas.

## 10. Informe final obligatorio

Al terminar, informar:

1. archivos modificados y creados;
2. causa raíz de cada error;
3. solución aplicada;
4. comandos ejecutados;
5. resultados de las pruebas;
6. confirmación de regeneración de `IO-Parcial1-Taha.html`;
7. limitaciones o tareas pendientes;
8. resumen del diff.

