/* Canvas 3D scenes for the study page. No libraries. Global: IO.Viz3D */
(function (global) {
  'use strict';
  var IO = global.IO = global.IO || { chapters: [] };
  IO.registerCleanup = IO.registerCleanup || function (fn) {
    (IO._cleanups = IO._cleanups || []).push(fn);
  };

  var REDDY_POLY = [
    [0, 0], [4, 0], [3, 1.5], [2, 2], [1, 2], [0, 1]
  ];

  function prefersReduced() {
    try {
      return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function cssVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name);
      return (v && v.trim()) || fallback;
    } catch (e) { return fallback; }
  }

  function isDark() {
    try {
      var t = document.documentElement.getAttribute('data-theme');
      if (t === 'dark') return true;
      if (t === 'light') return false;
      return !!(global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch (e) { return false; }
  }

  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return { r: 31, g: 42, b: 68 };
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* Rotate then perspective-project a 3D point. */
  function project(x, y, z, cam) {
    var cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    var x1 = x * cy + z * sy;
    var z1 = -x * sy + z * cy;
    var y1 = y * cp - z1 * sp;
    var z2 = y * sp + z1 * cp;
    var denom = cam.dist + z2;
    var f = cam.dist / (denom === 0 ? 0.001 : denom);
    return {
      x: cam.cx + x1 * cam.scale * f,
      y: cam.cy - y1 * cam.scale * f,
      z: z2,
      f: f
    };
  }

  function faceDepth(pts) {
    var s = 0;
    for (var i = 0; i < pts.length; i++) s += pts[i].z;
    return s / pts.length;
  }

  function shade(hex, nDotL, alpha) {
    var c = hexToRgb(hex);
    var k = 0.35 + 0.65 * clamp(nDotL, 0, 1);
    return 'rgba(' + Math.round(c.r * k) + ',' + Math.round(c.g * k) + ',' + Math.round(c.b * k) + ',' + alpha + ')';
  }

  function normal3(a, b, c) {
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    var vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    var nx = uy * vz - uz * vy;
    var ny = uz * vx - ux * vz;
    var nz = ux * vy - uy * vx;
    var len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    return [nx / len, ny / len, nz / len];
  }

  var LIGHT = [0.35, 0.8, 0.45];

  function Engine(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext ? canvas.getContext('2d') : null;
    this.yaw = 0.7;
    this.pitch = 0.45;
    this.dist = 8;
    this.scale = 70;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.t0 = Date.now();
    this.scene = 'lp-prism';
    this.raf = 0;
    this.running = true;
    this.auto = !prefersReduced();
    this._bind();
  }

  Engine.prototype._bind = function () {
    var self = this;
    var c = this.canvas;
    if (!c) return;
    this._onDown = function (e) {
      self.dragging = true;
      self.auto = false;
      var p = e.touches ? e.touches[0] : e;
      self.lastX = p.clientX;
      self.lastY = p.clientY;
    };
    this._onMove = function (e) {
      if (!self.dragging) return;
      var p = e.touches ? e.touches[0] : e;
      var dx = p.clientX - self.lastX;
      var dy = p.clientY - self.lastY;
      self.yaw += dx * 0.008;
      self.pitch = clamp(self.pitch + dy * 0.008, -0.2, 1.3);
      self.lastX = p.clientX;
      self.lastY = p.clientY;
      if (e.preventDefault) e.preventDefault();
    };
    this._onUp = function () { self.dragging = false; };
    c.addEventListener('mousedown', this._onDown);
    c.addEventListener('touchstart', this._onDown, { passive: true });
    window.addEventListener('mousemove', this._onMove);
    window.addEventListener('touchmove', this._onMove, { passive: false });
    window.addEventListener('mouseup', this._onUp);
    window.addEventListener('touchend', this._onUp);
    this._onTheme = function () { self.draw(self.now()); };
    window.addEventListener('themechange', this._onTheme);
  };

  Engine.prototype.destroy = function () {
    this.running = false;
    if (this.raf) {
      try { cancelAnimationFrame(this.raf); } catch (e) { /* ignore */ }
      this.raf = 0;
    }
    var c = this.canvas;
    if (c) {
      c.removeEventListener('mousedown', this._onDown);
      c.removeEventListener('touchstart', this._onDown);
    }
    window.removeEventListener('mousemove', this._onMove);
    window.removeEventListener('touchmove', this._onMove);
    window.removeEventListener('mouseup', this._onUp);
    window.removeEventListener('touchend', this._onUp);
    window.removeEventListener('themechange', this._onTheme);
  };

  Engine.prototype.now = function () {
    return (Date.now() - this.t0) / 1000;
  };

  Engine.prototype.cam = function () {
    var w = this._cssW || 640;
    var h = this._cssH || 360;
    return {
      yaw: this.yaw,
      pitch: this.pitch,
      dist: this.dist,
      scale: Math.min(w, h) * 0.22,
      cx: w / 2,
      cy: h * 0.55
    };
  };

  Engine.prototype.fit = function () {
    var c = this.canvas;
    var wrap = c.parentElement;
    var cssW = (wrap && wrap.clientWidth) ? wrap.clientWidth : 640;
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var cssH = Math.max(280, Math.min(420, Math.round(cssW * 0.52)));
    c.style.width = cssW + 'px';
    c.style.height = cssH + 'px';
    c.width = Math.round(cssW * dpr);
    c.height = Math.round(cssH * dpr);
    if (this.ctx && this.ctx.setTransform) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._cssW = cssW;
    this._cssH = cssH;
  };

  Engine.prototype.P = function (x, y, z) {
    return project(x, y, z, this.cam());
  };

  Engine.prototype.clear = function () {
    var ctx = this.ctx;
    if (!ctx) return;
    var w = this._cssW || 640, h = this._cssH || 360;
    var dark = isDark();
    var g = ctx.createLinearGradient(0, 0, 0, h);
    if (dark) {
      g.addColorStop(0, '#101624');
      g.addColorStop(1, '#1b2438');
    } else {
      g.addColorStop(0, '#eef2f8');
      g.addColorStop(1, '#d9e0ec');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };

  Engine.prototype.drawGrid = function () {
    var ctx = this.ctx;
    var ink = cssVar('--ink-2', '#4A5470');
    ctx.save();
    ctx.strokeStyle = rgba(ink, 0.18);
    ctx.lineWidth = 1;
    var i, a, b;
    for (i = -3; i <= 3; i++) {
      a = this.P(i, 0, -3); b = this.P(i, 0, 3);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      a = this.P(-3, 0, i); b = this.P(3, 0, i);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();
  };

  Engine.prototype.fillPoly = function (worldPts, color, alpha) {
    var ctx = this.ctx;
    if (!ctx || worldPts.length < 3) return;
    var proj = [];
    var i;
    for (i = 0; i < worldPts.length; i++) proj.push(this.P(worldPts[i][0], worldPts[i][1], worldPts[i][2]));
    var n = normal3(worldPts[0], worldPts[1], worldPts[2]);
    var nd = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
    ctx.beginPath();
    ctx.moveTo(proj[0].x, proj[0].y);
    for (i = 1; i < proj.length; i++) ctx.lineTo(proj[i].x, proj[i].y);
    ctx.closePath();
    ctx.fillStyle = shade(color, nd, alpha);
    ctx.fill();
    ctx.strokeStyle = rgba(cssVar('--ink', '#1F2A44'), 0.35);
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  Engine.prototype.line = function (a, b, color, width) {
    var ctx = this.ctx;
    var pa = this.P(a[0], a[1], a[2]);
    var pb = this.P(b[0], b[1], b[2]);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 2;
    ctx.stroke();
  };

  Engine.prototype.dot = function (p, r, color, glow) {
    var ctx = this.ctx;
    var q = this.P(p[0], p[1], p[2]);
    if (glow) {
      var g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 4);
      g.addColorStop(0, rgba(color, 0.85));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };

  Engine.prototype.label = function (p, text, color) {
    var ctx = this.ctx;
    var q = this.P(p[0], p[1], p[2]);
    ctx.font = '600 12px "Source Sans 3", sans-serif';
    ctx.fillStyle = color || cssVar('--ink', '#1F2A44');
    ctx.textAlign = 'center';
    ctx.fillText(text, q.x, q.y - 10);
  };

  Engine.prototype.caption = function (text) {
    var ctx = this.ctx;
    ctx.font = '600 13px "Source Sans 3", sans-serif';
    ctx.fillStyle = cssVar('--ink', '#1F2A44');
    ctx.textAlign = 'left';
    ctx.fillText(text, 14, 22);
  };

  /* Reddy Mikks: max z=5x1+4x2. Vértices exactos y z=5x+4y. */
  var REDDY_VERTS = [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 20 },
    { x: 3, y: 1.5, z: 21 },
    { x: 2, y: 2, z: 18 },
    { x: 1, y: 2, z: 13 },
    { x: 0, y: 1, z: 4 }
  ];
  function reddyZ(x, y) { return 5 * x + 4 * y; }
  var SIMPLEX_PATH = [
    { x: 0, y: 0, z: 0, note: 'inicio: x1=x2=0' },
    { x: 4, y: 0, z: 20, note: 'entra x1, sale holgura M1' },
    { x: 3, y: 1.5, z: 21, note: 'entra x2 · óptimo' }
  ];
  var TRANSPORT = {
    sources: [{ n: 'A', s: 5 }, { n: 'B', s: 10 }],
    dests: [{ n: 'T1', d: 8 }, { n: 'T2', d: 5 }, { n: 'T3', d: 2 }],
    flows: [
      { a: 0, b: 0, q: 5, c: 1 },
      { a: 1, b: 0, q: 3, c: 3 },
      { a: 1, b: 1, q: 5, c: 2 },
      { a: 1, b: 2, q: 2, c: 1 }
    ]
  };
  function transportCost() {
    var s = 0, i;
    for (i = 0; i < TRANSPORT.flows.length; i++) s += TRANSPORT.flows[i].q * TRANSPORT.flows[i].c;
    return s;
  }
  var MAXFLOW_STEPS = [
    { path: ['A', 'B', 'D', 'F'], bot: 6, acc: 6 },
    { path: ['A', 'B', 'E', 'F'], bot: 2, acc: 8 },
    { path: ['A', 'B', 'D', 'E', 'F'], bot: 1, acc: 9 },
    { path: ['A', 'C', 'E', 'F'], bot: 6, acc: 15 }
  ];
  var GA_F = function (x) { return Math.sin(x) * Math.sin(0.4 * x) + 1.2; };

  var LEGENDS = {
    'io-pipeline': {
      what: 'Las 4 fases de un estudio de IO (Taha §1.7).',
      how: 'Se lee de izquierda a derecha. No es un cálculo: es el orden del trabajo.',
      nums: '1 mundo real → 2 supuestos → 3 modelo → 4 solución.'
    },
    'lp-prism': {
      what: 'Reddy Mikks. La altura de cada punto es z = 5x1 + 4x2. El techo es un plano porque z es lineal.',
      how: 'El plano ámbar horizontal es una curva de nivel (z = k). Sube hasta tocar el pico: ahí está el óptimo.',
      nums: 'Vértices: (0,0) z=0 · (4,0) z=20 · (3, 1.5) z=21 · (2,2) z=18 · (1,2) z=13 · (0,1) z=4. Óptimo z=21.'
    },
    'lp-2d': {
      what: 'Método gráfico del examen: 2 variables, región factible, z en cada vértice.',
      how: '1) dibuje las rectas  2) sombreé lo que cumple todas  3) calcule z en los vértices  4) elija el mayor (max). La recta punteada es z = k y se desliza hasta el óptimo.',
      nums: 'z = 5x1+4x2. Óptimo (3, 1.5), z=21. Mismo ejemplo Reddy Mikks del libro.'
    },
    'simplex-walk': {
      what: 'Simplex sobre Reddy Mikks: camina vértices. Nunca entra al interior.',
      how: 'Empieza en (0,0). Entra la variable que más sube z. Sale la que se agota primero (razón mínima).',
      nums: '(0,0) z=0 → entra x1 → (4,0) z=20 → entra x2 → (3, 1.5) z=21. Es el mismo camino que el tableau.'
    },
    'transport-3d': {
      what: 'Transporte del examen 2: almacenes A,B y tiendas T1,T2,T3. Solo se dibujan los envíos óptimos.',
      how: 'Cada arco usado muestra cantidad × costo. Los arcos no usados no llevan cajas.',
      nums: 'A→T1: 5×1 · B→T1: 3×3 · B→T2: 5×2 · B→T3: 2×1. Z = 5+9+10+2 = 26. Oferta 15 = demanda 15.'
    },
    'maxflow-pipes': {
      what: 'Ford–Fulkerson en la red del examen 3. Origen A, destino F.',
      how: 'Un camino de aumento por vez. El cuello es el mínimo residual de esa ruta. Se suma al acumulado hasta que no queda camino.',
      nums: 'A-B-D-F +6 → A-B-E-F +2 → A-B-D-E-F +1 → A-C-E-F +6. Flujo 15. Corte mínimo D→F (6) + E→F (9) = 15.'
    },
    'ga-landscape': {
      what: 'Aptitud real del widget: f(x) = sen(x)·sen(0,4x)+1,2 en [0, 10].',
      how: 'Los puntos son una población. Con las generaciones se juntan cerca de un pico. No garantiza el máximo global.',
      nums: 'Heurística: mejora el fitness, no demuestra optimalidad. El examen pide el vocabulario, no este gráfico.'
    },
    'binary-cube': {
      what: 'Cubo 0-1 de 3 proyectos (1, 2 y 3) para poder verlo. El examen tiene 5 proyectos.',
      how: 'Cada eje es un sí/no. Verde = cabe en el presupuesto 20. Rojo = se pasa. Ámbar = el mejor de estos 3.',
      nums: 'Mejor del cubo: 110 (proyectos 1 y 2), capital 18, Z=2,8. Óptimo real del examen: proyectos 1, 3 y 4, Z=3,4.'
    },
    'dual-balance': {
      what: 'Metáfora de dualidad con los números de Reddy Mikks: z* = w* = 21.',
      how: 'Mientras las placas no coinciden, z ≤ w (dualidad débil). Cuando coinciden, hay óptimo (dualidad fuerte).',
      nums: 'Primal max z = 5x1+4x2 = 21. Dual min w = 24y1+6y2+y3+2y4 = 21. y* = (3/4, 1/2, 0, 0).'
    }
  };

  /* ---------- scenes ---------- */

  function extrudePoly(poly2, y0, y1) {
    var faces = [];
    var n = poly2.length;
    var top = [], bot = [], i, a, b;
    for (i = 0; i < n; i++) {
      top.push([poly2[i][0], y1, poly2[i][1]]);
      bot.push([poly2[i][0], y0, poly2[i][1]]);
      a = poly2[i];
      b = poly2[(i + 1) % n];
      faces.push({
        pts: [
          [a[0], y0, a[1]], [b[0], y0, b[1]],
          [b[0], y1, b[1]], [a[0], y1, a[1]]
        ],
        kind: 'side'
      });
    }
    faces.push({ pts: top.slice().reverse(), kind: 'top' });
    faces.push({ pts: bot, kind: 'bot' });
    return faces;
  }

  function wr(x1, x2) {
    var H = 2.2, cx = 1.6, cz = 0.9;
    return [x1 - cx, reddyZ(x1, x2) / 21 * H, x2 - cz];
  }

  function drawReddySurface(eng, t, walk) {
    var accent = cssVar('--accent', '#C77D1A');
    var ok = cssVar('--ok', '#2E7D5B');
    var paper = cssVar('--paper-2', '#fff');
    var ink = cssVar('--ink', '#1F2A44');
    var n = REDDY_VERTS.length;
    var faces = [];
    var roof = [], floor = [], i, a, b;
    for (i = 0; i < n; i++) {
      a = REDDY_VERTS[i];
      b = REDDY_VERTS[(i + 1) % n];
      roof.push(wr(a.x, a.y));
      floor.push([a.x - 1.6, 0, a.y - 0.9]);
      faces.push({
        pts: [
          [a.x - 1.6, 0, a.y - 0.9], [b.x - 1.6, 0, b.y - 0.9],
          wr(b.x, b.y), wr(a.x, a.y)
        ],
        kind: 'side'
      });
    }
    faces.push({ pts: roof.slice().reverse(), kind: 'top' });
    faces.push({ pts: floor, kind: 'bot' });
    faces.sort(function (A, B) {
      var pa = A.pts.map(function (q) { return eng.P(q[0], q[1], q[2]); });
      var pb = B.pts.map(function (q) { return eng.P(q[0], q[1], q[2]); });
      return faceDepth(pa) - faceDepth(pb);
    });
    for (i = 0; i < faces.length; i++) {
      var col = faces[i].kind === 'top' ? ok : (faces[i].kind === 'bot' ? paper : accent);
      eng.fillPoly(faces[i].pts, col, faces[i].kind === 'top' ? 0.88 : 0.5);
    }
    eng.line([-1.6, 0, -0.9], [3.2, 0, -0.9], rgba(ink, 0.7), 2);
    eng.line([-1.6, 0, -0.9], [-1.6, 0, 1.6], rgba(ink, 0.7), 2);
    eng.line([-1.6, 0, -0.9], [-1.6, 2.2, -0.9], rgba(ink, 0.7), 2);
    eng.label([3.2, 0.05, -0.9], 'x1', ink);
    eng.label([-1.6, 0.05, 1.7], 'x2', ink);
    eng.label([-1.6, 2.35, -0.9], 'z', ink);
    var k = 8 + (0.5 + 0.5 * Math.sin(t * 0.7)) * 13;
    var yk = k / 21 * 2.2;
    eng.fillPoly([
      [-2.0, yk, -1.5], [2.8, yk, -1.5], [2.8, yk, 1.7], [-2.0, yk, 1.7]
    ], accent, 0.18);
    for (i = 0; i < n; i++) {
      a = REDDY_VERTS[i];
      var p = wr(a.x, a.y);
      var isOpt = a.z === 21;
      eng.dot(p, isOpt ? 6 : 3.5, isOpt ? accent : ink, isOpt);
      eng.label(p, '(' + a.x + ', ' + a.y + ') z=' + a.z, isOpt ? accent : ink);
    }
    if (walk) {
      var cycle = t * 0.28;
      var idx = Math.floor(cycle) % (SIMPLEX_PATH.length - 1);
      var u = cycle % 1;
      var A = SIMPLEX_PATH[idx], B = SIMPLEX_PATH[idx + 1];
      var wx = lerp(A.x, B.x, u), wy = lerp(A.y, B.y, u);
      eng.dot(wr(wx, wy), 7, accent, true);
      for (i = 0; i < SIMPLEX_PATH.length - 1; i++) {
        eng.line(wr(SIMPLEX_PATH[i].x, SIMPLEX_PATH[i].y), wr(SIMPLEX_PATH[i + 1].x, SIMPLEX_PATH[i + 1].y), accent, 3);
      }
      eng.caption('Simplex: ' + A.note + ' → ' + B.note + '   z=' + reddyZ(wx, wy).toFixed(1));
    } else {
      eng.caption('Altura = z = 5x1+4x2. Plano ámbar: z=' + k.toFixed(0) + (k > 20.5 ? '  toca el óptimo 21' : ''));
    }
  }

  function drawSceneLpPrism(eng, t) { drawReddySurface(eng, t, false); }
  function drawSceneSimplexWalk(eng, t) { drawReddySurface(eng, t, true); }

  function map2d(eng, x, y, xr, yr) {
    var w = eng._cssW || 640, h = eng._cssH || 360;
    var padL = 48, padR = 18, padT = 36, padB = 36;
    return {
      x: padL + (x - xr[0]) / (xr[1] - xr[0]) * (w - padL - padR),
      y: h - padB - (y - yr[0]) / (yr[1] - yr[0]) * (h - padT - padB)
    };
  }

  function drawSceneLp2d(eng, t) {
    var ctx = eng.ctx;
    if (!ctx) return;
    var xr = [-0.4, 6.4], yr = [-0.4, 6.4];
    var ink = cssVar('--ink', '#1F2A44');
    var ink2 = cssVar('--ink-2', '#4A5470');
    var accent = cssVar('--accent', '#C77D1A');
    var ok = cssVar('--ok', '#2E7D5B');
    var pivot = cssVar('--pivot', 'rgba(199,125,26,.22)');
    var i, p, q, a;
    function P(x, y) { return map2d(eng, x, y, xr, yr); }
    ctx.strokeStyle = rgba(ink2, 0.35);
    ctx.lineWidth = 1;
    for (i = 0; i <= 6; i++) {
      p = P(i, 0); q = P(i, 6);
      ctx.beginPath(); ctx.moveTo(p.x, P(0, 6).y); ctx.lineTo(p.x, P(0, 0).y); ctx.stroke();
      p = P(0, i); q = P(6, i);
      ctx.beginPath(); ctx.moveTo(P(0, 0).x, p.y); ctx.lineTo(P(6, 0).x, p.y); ctx.stroke();
      ctx.fillStyle = ink2; ctx.font = '11px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText(String(i), P(i, 0).x, P(0, 0).y + 14);
      ctx.textAlign = 'right';
      ctx.fillText(String(i), P(0, 0).x - 6, P(0, i).y + 4);
    }
    ctx.strokeStyle = ink; ctx.lineWidth = 1.6;
    p = P(0, 0); q = P(6.2, 0);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    q = P(0, 6.2);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    ctx.fillStyle = ink; ctx.font = '12px "Source Sans 3", sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('x1', P(6.1, 0).x, P(6.1, 0).y - 8);
    ctx.fillText('x2', P(0, 6.1).x + 8, P(0, 6.1).y);
    ctx.beginPath();
    for (i = 0; i < REDDY_VERTS.length; i++) {
      p = P(REDDY_VERTS[i].x, REDDY_VERTS[i].y);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = pivot;
    ctx.fill();
    ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
    var lines = [
      { a: [4, 0], b: [0, 6], lab: '6x1+4x2=24' },
      { a: [6, 0], b: [0, 3], lab: 'x1+2x2=6' },
      { a: [0, 1], b: [5, 6], lab: '−x1+x2=1' },
      { a: [0, 2], b: [6, 2], lab: 'x2=2' }
    ];
    ctx.strokeStyle = ink2; ctx.lineWidth = 1.3; ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = ink2; ctx.textAlign = 'left';
    for (i = 0; i < lines.length; i++) {
      p = P(lines[i].a[0], lines[i].a[1]); q = P(lines[i].b[0], lines[i].b[1]);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      ctx.fillText(lines[i].lab, q.x + 4, q.y - 4);
    }
    var k = 6 + (0.5 + 0.5 * Math.sin(t * 0.8)) * 15;
    ctx.setLineDash([7, 5]); ctx.strokeStyle = ok; ctx.lineWidth = 2;
    p = P(0, k / 4); q = P(k / 5, 0);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    ctx.setLineDash([]);
    for (i = 0; i < REDDY_VERTS.length; i++) {
      a = REDDY_VERTS[i];
      p = P(a.x, a.y);
      ctx.beginPath(); ctx.arc(p.x, p.y, a.z === 21 ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = a.z === 21 ? accent : ink; ctx.fill();
      ctx.fillStyle = a.z === 21 ? accent : ink;
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('(' + a.x + ',' + a.y + ') z=' + a.z, p.x + 8, p.y - 6);
    }
    eng.caption('Método gráfico · z=' + k.toFixed(0) + ' (punteada) · óptimo (3, 1.5) z=21');
  }

  function drawScenePipeline(eng, t) {
    var labels = ['Mundo real', 'Supuestos', 'Modelo', 'Solución'];
    var accent = cssVar('--accent', '#C77D1A');
    var ok = cssVar('--ok', '#2E7D5B');
    var paper = cssVar('--paper-2', '#fff');
    var i, x, y, z, pulse;
    for (i = 0; i < 4; i++) {
      x = (i - 1.5) * 1.7;
      y = 0.35 + 0.12 * Math.sin(t * 1.4 + i);
      z = 0.2 * Math.sin(t * 0.8 + i);
      pulse = 0.55 + 0.08 * Math.sin(t * 2 + i);
      var box = [
        [x - 0.7, y, z - 0.45], [x + 0.7, y, z - 0.45],
        [x + 0.7, y, z + 0.45], [x - 0.7, y, z + 0.45]
      ];
      var top = box.map(function (p) { return [p[0], p[1] + pulse, p[2]]; });
      eng.fillPoly(box, paper, 0.9);
      eng.fillPoly(top, i === 3 ? ok : accent, 0.8);
      eng.label([x, y + pulse + 0.15, z], labels[i], cssVar('--ink', '#1F2A44'));
      if (i < 3) {
        eng.line([x + 0.75, y + 0.3, z], [x + 1.0, y + 0.3, z], accent, 3);
      }
    }
    eng.caption('Un estudio de IO: del mundo real a una decisión, pasando por un modelo');
  }

  function drawSceneTransport(eng, t) {
    var spos = [[-2.2, 0.4, -0.8], [-2.2, 0.4, 0.9]];
    var dpos = [[2.2, 0.4, -1.2], [2.2, 0.4, 0], [2.2, 0.4, 1.2]];
    var accent = cssVar('--accent', '#C77D1A');
    var ok = cssVar('--ok', '#2E7D5B');
    var ink = cssVar('--ink', '#1F2A44');
    var i, s, d, f, u, mid;
    for (i = 0; i < TRANSPORT.sources.length; i++) {
      s = TRANSPORT.sources[i];
      eng.dot(spos[i], 10, ok, true);
      eng.label([spos[i][0], spos[i][1] + 0.55, spos[i][2]], s.n + ' oferta ' + s.s, ink);
    }
    for (i = 0; i < TRANSPORT.dests.length; i++) {
      d = TRANSPORT.dests[i];
      eng.dot(dpos[i], 10, accent, true);
      eng.label([dpos[i][0], dpos[i][1] + 0.55, dpos[i][2]], d.n + ' dem. ' + d.d, ink);
    }
    for (i = 0; i < TRANSPORT.flows.length; i++) {
      f = TRANSPORT.flows[i];
      s = spos[f.a]; d = dpos[f.b];
      eng.line(s, d, rgba(ok, 0.7), 2.5);
      mid = [(s[0] + d[0]) / 2, (s[1] + d[1]) / 2 + 0.25, (s[2] + d[2]) / 2];
      eng.label(mid, f.q + '×$' + f.c, ink);
      u = (t * 0.25 + i * 0.18) % 1;
      eng.dot([lerp(s[0], d[0], u), lerp(s[1], d[1], u) + 0.2 * Math.sin(u * Math.PI), lerp(s[2], d[2], u)], 4, accent, false);
    }
    eng.caption('Óptimo: Z = 5×1 + 3×3 + 5×2 + 2×1 = ' + transportCost());
  }

  function drawSceneMaxflow(eng, t) {
    var nodes = {
      A: [-2.4, 0.5, 0], B: [-0.8, 1.1, -1.1], C: [-0.8, 0.2, 1.1],
      D: [0.8, 1.1, -1.1], E: [0.8, 0.2, 1.1], F: [2.4, 0.5, 0]
    };
    var arcs = [
      ['A', 'B', 9], ['A', 'C', 7], ['B', 'D', 7], ['B', 'E', 2],
      ['C', 'D', 4], ['C', 'E', 6], ['D', 'E', 3], ['D', 'F', 6], ['E', 'F', 9]
    ];
    var stepIdx = Math.min(MAXFLOW_STEPS.length - 1, Math.floor((t * 0.35) % (MAXFLOW_STEPS.length + 1)));
    if (stepIdx < 0) stepIdx = 0;
    var done = Math.floor((t * 0.35) % (MAXFLOW_STEPS.length + 1)) >= MAXFLOW_STEPS.length;
    var active = done ? null : MAXFLOW_STEPS[stepIdx];
    var accent = cssVar('--accent', '#C77D1A');
    var ok = cssVar('--ok', '#2E7D5B');
    var ink = cssVar('--ink', '#1F2A44');
    var k, a, b, key, onPath;
    function isOn(u, v) {
      if (!active) return false;
      var j;
      for (j = 0; j < active.path.length - 1; j++) {
        if (active.path[j] === u && active.path[j + 1] === v) return true;
      }
      return false;
    }
    for (k = 0; k < arcs.length; k++) {
      a = nodes[arcs[k][0]];
      b = nodes[arcs[k][1]];
      onPath = isOn(arcs[k][0], arcs[k][1]);
      eng.line(a, b, onPath ? accent : rgba(ok, 0.45), onPath ? 4 : 1.5);
      key = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.18, (a[2] + b[2]) / 2];
      eng.label(key, String(arcs[k][2]), ink);
    }
    Object.keys(nodes).forEach(function (name) {
      eng.dot(nodes[name], name === 'A' || name === 'F' ? 9 : 6, name === 'F' ? accent : ok, true);
      eng.label([nodes[name][0], nodes[name][1] + 0.38, nodes[name][2]], name, ink);
    });
    if (active) {
      var u = (t * 1.2) % 1;
      var segs = active.path.length - 1;
      var si = Math.min(segs - 1, Math.floor(u * segs));
      var su = u * segs - si;
      var n0 = nodes[active.path[si]], n1 = nodes[active.path[si + 1]];
      eng.dot([lerp(n0[0], n1[0], su), lerp(n0[1], n1[1], su), lerp(n0[2], n1[2], su)], 6, accent, true);
      eng.caption('Paso ' + (stepIdx + 1) + ': ' + active.path.join('→') + '  cuello ' + active.bot + '  acumulado ' + active.acc);
    } else {
      eng.caption('No queda camino. Flujo máximo = 15 = corte D→F(6)+E→F(9)');
    }
  }

  function drawSceneGa(eng, t) {
    var ctx = eng.ctx;
    if (!ctx) return;
    var xr = [-0.5, 10.5], yr = [0, 2.4];
    var ink = cssVar('--ink', '#1F2A44');
    var ink2 = cssVar('--ink-2', '#4A5470');
    var accent = cssVar('--accent', '#C77D1A');
    var ok = cssVar('--ok', '#2E7D5B');
    function P(x, y) { return map2d(eng, x, y, xr, yr); }
    var i, p, q, x;
    ctx.strokeStyle = ink; ctx.lineWidth = 1.5;
    p = P(0, 0); q = P(10, 0);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    q = P(0, 2.2);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    ctx.fillStyle = ink; ctx.font = '12px "Source Sans 3", sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('x', P(10, 0).x, P(10, 0).y - 8);
    ctx.fillText('f(x)', P(0, 2.2).x + 8, P(0, 2.2).y);
    ctx.beginPath();
    ctx.strokeStyle = ok; ctx.lineWidth = 2;
    for (i = 0; i <= 80; i++) {
      x = i / 80 * 10;
      p = P(x, GA_F(x));
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    var gen = Math.min(8, Math.floor((t * 0.5) % 9));
    var seed = 3 + gen * 17;
    function rnd() {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    }
    var pop = [], best = 0, bestX = 0;
    for (i = 0; i < 12; i++) {
      x = 1.5 + rnd() * (8 - gen * 0.6) * rnd();
      if (gen > 4) x = 3.5 + (rnd() - 0.5) * 2.2;
      pop.push(x);
      if (GA_F(x) > best) { best = GA_F(x); bestX = x; }
    }
    for (i = 0; i < pop.length; i++) {
      p = P(pop[i], GA_F(pop[i]));
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = accent; ctx.fill();
    }
    eng.caption('f(x)=sen(x)·sen(0,4x)+1,2  · generación ' + gen + '  mejor f≈' + best.toFixed(2) + ' en x≈' + bestX.toFixed(1));
  }

  function drawSceneBinary(eng, t) {
    var bits = [
      [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
      [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]
    ];
    var w = [6, 12, 10];
    var gain = [1, 1.8, 1.6];
    var accent = cssVar('--accent', '#C77D1A');
    var ok = cssVar('--ok', '#2E7D5B');
    var err = cssVar('--err', '#B23A3A');
    var ink = cssVar('--ink', '#1F2A44');
    var i, a, b, p, used, feas, g, best = -1, bestG = -1;
    for (i = 0; i < bits.length; i++) {
      a = bits[i];
      used = w[0] * a[0] + w[1] * a[1] + w[2] * a[2];
      g = gain[0] * a[0] + gain[1] * a[1] + gain[2] * a[2];
      if (used <= 20 && g > bestG) { bestG = g; best = i; }
    }
    var edges = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]];
    for (i = 0; i < edges.length; i++) {
      a = bits[edges[i][0]]; b = bits[edges[i][1]];
      eng.line(
        [(a[0] - 0.5) * 2, a[2] * 1.6, (a[1] - 0.5) * 2],
        [(b[0] - 0.5) * 2, b[2] * 1.6, (b[1] - 0.5) * 2],
        rgba(ink, 0.35), 1.5
      );
    }
    var blink = 0.5 + 0.5 * Math.sin(t * 3);
    for (i = 0; i < bits.length; i++) {
      a = bits[i];
      used = w[0] * a[0] + w[1] * a[1] + w[2] * a[2];
      feas = used <= 20;
      g = gain[0] * a[0] + gain[1] * a[1] + gain[2] * a[2];
      p = [(a[0] - 0.5) * 2, a[2] * 1.6, (a[1] - 0.5) * 2];
      eng.dot(p, i === best ? 8 : 5, i === best ? accent : (feas ? ok : err), i === best && blink > 0.3);
      eng.label(p, '' + a[0] + a[1] + a[2] + (feas ? ' Z=' + g : ' no'), ink);
    }
    eng.label([0, 2.2, 0], 'ejes: proy.1 · proy.2 · proy.3', ink);
    eng.caption('Cubo de 3 proyectos. Mejor acá 110 Z=2,8. Examen (5 proy.): 1,3,4 Z=3,4');
  }

  function drawSceneDual(eng, t) {
    var accent = cssVar('--accent', '#C77D1A');
    var ok = cssVar('--ok', '#2E7D5B');
    var ink = cssVar('--ink', '#1F2A44');
    var s = 0.5 + 0.5 * Math.sin(t * 0.9);
    var zVal = 12 + s * 9;
    var wVal = 30 - s * 9;
    var yL = 0.25 + (zVal / 21) * 0.9;
    var yR = 0.25 + (wVal / 21) * 0.9;
    var left = [[-2.2, yL, -0.8], [-0.4, yL, -0.8], [-0.4, yL, 0.8], [-2.2, yL, 0.8]];
    var right = [[0.4, yR, -0.8], [2.2, yR, -0.8], [2.2, yR, 0.8], [0.4, yR, 0.8]];
    eng.fillPoly(left, ok, 0.8);
    eng.fillPoly(right, accent, 0.8);
    eng.label([-1.3, yL + 0.4, 0], 'Primal z=' + zVal.toFixed(0), ink);
    eng.label([1.3, yR + 0.4, 0], 'Dual w=' + wVal.toFixed(0), ink);
    if (Math.abs(zVal - wVal) < 0.8) {
      eng.caption('Dualidad fuerte: z* = w* = 21  (Reddy Mikks)');
    } else {
      eng.caption('Dualidad débil: z=' + zVal.toFixed(0) + ' ≤ w=' + wVal.toFixed(0) + '  hasta el óptimo 21=21');
    }
  }

  var SCENES = {
    'io-pipeline': drawScenePipeline,
    'lp-prism': drawSceneLpPrism,
    'lp-2d': drawSceneLp2d,
    'simplex-walk': drawSceneSimplexWalk,
    'transport-3d': drawSceneTransport,
    'maxflow-pipes': drawSceneMaxflow,
    'ga-landscape': drawSceneGa,
    'binary-cube': drawSceneBinary,
    'dual-balance': drawSceneDual
  };
  var FLAT = { 'lp-2d': 1, 'ga-landscape': 1 };

  Engine.prototype.draw = function (t) {
    if (!this.ctx) return;
    this.clear();
    if (!FLAT[this.scene]) this.drawGrid();
    var fn = SCENES[this.scene] || drawSceneLpPrism;
    fn(this, t);
  };

  Engine.prototype.loop = function () {
    var self = this;
    function frame() {
      if (!self.running) return;
      if (self.auto && !self.dragging && !FLAT[self.scene]) self.yaw += 0.004;
      self.draw(self.now());
      self.raf = requestAnimationFrame(frame);
    }
    if (prefersReduced()) {
      this.draw(0);
      return;
    }
    this.raf = requestAnimationFrame(frame);
  };

  function mount(el) {
    if (!el) return null;
    var name = el.getAttribute('data-viz3d') || 'lp-prism';
    var caption = el.getAttribute('data-caption') || '';
    el.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'viz3d-wrap canvas-wrap wide';
    var canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', caption || ('Animación 3D: ' + name));
    wrap.appendChild(canvas);
    var hint = document.createElement('p');
    hint.className = 'muted viz3d-hint';
    hint.textContent = FLAT[name] ? 'Gráfico del método (no gira).' : 'Arrastre para girar. La escena gira sola.';
    wrap.appendChild(hint);
    var L = LEGENDS[name];
    if (L) {
      var box = document.createElement('div');
      box.className = 'viz3d-legend';
      box.innerHTML = '<p><strong>Qué muestra.</strong> ' + L.what + '</p>' +
        '<p><strong>Cómo se lee.</strong> ' + L.how + '</p>' +
        '<p><strong>Números.</strong> ' + L.nums + '</p>';
      wrap.appendChild(box);
    }
    el.appendChild(wrap);
    var eng = new Engine(canvas);
    eng.scene = SCENES[name] ? name : 'lp-prism';
    eng.fit();
    eng.loop();
    var onResize = function () { eng.fit(); };
    window.addEventListener('resize', onResize);
    IO.registerCleanup(function () {
      window.removeEventListener('resize', onResize);
      eng.destroy();
    });
    return eng;
  }

  function mountAll(root) {
    if (!root) return;
    var nodes = root.querySelectorAll('[data-viz3d]');
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  IO.Viz3D = {
    mount: mount,
    mountAll: mountAll,
    project: project,
    scenes: Object.keys(SCENES),
    reddyPoly: REDDY_POLY,
    reddyVerts: REDDY_VERTS,
    reddyZ: reddyZ,
    simplexPath: SIMPLEX_PATH,
    transportCost: transportCost,
    maxflowSteps: MAXFLOW_STEPS,
    gaF: GA_F,
    legends: LEGENDS,
    Engine: Engine
  };
})(typeof window !== 'undefined' ? window : globalThis);
