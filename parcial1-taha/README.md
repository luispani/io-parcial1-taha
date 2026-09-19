# Parcial 1 · Investigación de Operaciones

Página de estudio interactiva para el parcial de Investigación de Operaciones.
Base: Taha, 9ª edición, capítulos 1 a 5. Extra (porque el examen los toma):
programación entera/binaria, flujo máximo y algoritmos evolutivos.

Cada sección de teoría empieza **desde cero**, tiene una animación 3D, el
mejor video corto del tema (YouTube) y referencias externas. Los videos
necesitan red; el resto de la página funciona offline.

Sin frameworks, sin `fetch`, sin módulos ES: scripts globales. Se puede
abrir el archivo con doble clic.

## Cómo abrir la aplicación

Hay dos formas, ambas funcionan sin instalar nada:

1. **Doble clic al archivo único**: `../IO-Parcial1-Taha.html` (un nivel
   arriba de esta carpeta). Es un solo archivo HTML con todo el CSS y el
   JavaScript incluidos adentro; se puede compartir o abrir con doble clic
   sin servidor.
2. **Doble clic a `index.html`** (dentro de esta carpeta). También funciona
   directo con `file://`, aunque en algunos navegadores es más prolijo
   levantar un servidor local (ver abajo).

## Cómo levantar un servidor local (opcional)

Desde la carpeta **padre** de `parcial1-taha` (para que las rutas relativas
funcionen igual que en `file://`):

```bash
python3 -m http.server 8765
```

Después abrir `http://localhost:8765/parcial1-taha/index.html` en el
navegador.

## Cómo ejecutar las pruebas

Requiere Node.js (con `node:test`, sin dependencias externas):

```bash
node --test tests/*.test.js
```

o, para correr toda la carpeta de pruebas:

```bash
node --test tests/
```

## Cómo regenerar el HTML único

```bash
python3 build_single.py
```

Esto lee `index.html`, incorpora (inline) `css/style.css` y todos los
`<script src="js/...">` en el orden en que aparecen, y escribe
`../IO-Parcial1-Taha.html`. El `<link>` de Google Fonts se deja como enlace
externo (no se incorpora).

Si falta algún CSS o JS local referenciado en `index.html`, el script falla
(código de salida distinto de cero) e imprime:

```
ERROR: Falta el archivo local: js/cap3.js
```

Para pruebas o compilaciones a un directorio distinto (sin pisar el artefacto
real), se pueden pasar rutas explícitas:

```bash
python3 build_single.py --index /ruta/a/index.html --out /ruta/a/salida.html
```

## Archivos fuente vs. archivo generado

- **Fuente** (se editan a mano): `index.html`, `css/style.css`, todo lo que
  hay bajo `js/` (incluida `js/lib/`), `build_single.py`, este `README.md` y
  todo lo que hay bajo `tests/`.
- **Generado** (nunca se edita a mano): `../IO-Parcial1-Taha.html`. Se
  reconstruye siempre con `python3 build_single.py` a partir de las fuentes
  de arriba.

## Progreso guardado (localStorage)

Todo el progreso se guarda **solo en este navegador**, en `localStorage`, con
estas claves:

| Clave | Contenido |
|---|---|
| `io_progress` | Qué secciones de cada capítulo están marcadas como estudiadas. |
| `io_plan` | Casilleros tildados del plan de estudio de 10 días. |
| `io_quiz_<capId>` | Último puntaje de la autoevaluación de ese capítulo (`cap1`…`cap5`). |
| `io_theme` | Tema elegido: `light`, `dark`, o ausente (automático, según el sistema). |
| `io_simulacro` | Intento de simulacro en curso o ya entregado (preguntas, respuestas, hora final, resultado). |

Como es `localStorage`, el progreso **no se sincroniza** entre navegadores o
equipos distintos, y se pierde si se borran los datos del sitio.

### Exportar, importar y borrar el progreso

En la página **Inicio** hay tres botones para administrar este progreso:

- **Exportar progreso**: abre un cuadro de texto con todo el progreso en
  formato JSON, listo para copiar y guardar en un archivo de respaldo.
- **Importar progreso**: pega un JSON exportado antes en el mismo cuadro de
  texto y lo restaura (por ejemplo, en otro navegador o equipo).
- **Borrar progreso**: pide confirmación en la misma página (no es un cartel
  del navegador) y, si se confirma, borra las claves `io_*` mencionadas
  arriba.
