/* Exact rational arithmetic. Global: Frac.
 * Usage: Frac.of(3,4), Frac.from(0.75), a.add(b), a.sub(b), a.mul(b), a.div(b),
 * a.neg(), a.cmp(b) (-1|0|1), a.isZero(), a.isNeg(), a.isPos(), a.toNumber(), a.toString() -> "3/4".
 * Frac.from('2/3') and Frac.from(2.5) are supported. Values are immutable.
 *
 * Frac.from(v) input policy (see MEJORAS-PENDIENTES.md §1):
 *  - Frac instance -> returned as-is.
 *  - '' (empty/whitespace string) and `undefined` -> Frac.ZERO. This is kept on
 *    purpose: js/cap4.js reads `F.from(input.value)` directly from live <input>
 *    "change" listeners (see e.g. its ".a-cell"/".b1"/".c1" handlers), and those
 *    fields can be legitimately empty while the user is editing — throwing there
 *    would crash an unrelated widget. simplex.js also calls `F.from(m === undefined
 *    ? 0 : m)`, so `undefined` never actually reaches this path from there, but the
 *    fallback is kept for any other caller relying on the documented behavior.
 *  - Any other non-numeric or malformed input (non-numeric strings like 'abc',
 *    malformed fractions like '1/2/3', NaN) throws a clear Error instead of
 *    silently becoming 0 — this was the actual bug (silent data corruption).
 *  - Numbers/numeric strings in scientific notation (1e-7, 2.5e-4, -3e2, '1e-7')
 *    are converted to an exact fraction by decomposing the value's shortest exact
 *    decimal representation (via `toExponential()`) into digits + a base-10
 *    exponent, instead of relying on `toString()` + fixed decimal-place counting
 *    (which silently truncated very small magnitudes like 1e-7 to 0).
 */
(function (global) {
  'use strict';
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a || 1; }
  function Frac(n, d) {
    if (d === undefined) d = 1;
    if (d === 0) throw new Error('Frac: division by zero');
    if (d < 0) { n = -n; d = -d; }
    var g = gcd(n, d);
    this.n = n / g; this.d = d / g;
    if (this.n === 0) this.n = 0; // normalize -0 to 0 (Object.is(-0, 0) is false)
    Object.freeze(this);
  }
  Frac.of = function (n, d) { return new Frac(n, d === undefined ? 1 : d); };

  var NUMERIC_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

  // Decompose a finite JS number into an exact Frac using its shortest exact
  // decimal representation (toExponential with no argument never loses digits).
  function numberToFrac(v) {
    if (Number.isInteger(v)) return new Frac(v, 1);
    var expStr = v.toExponential();
    var m = /^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(expStr);
    if (!m) throw new Error('Frac.from: no se pudo convertir el número ' + v);
    var sign = m[1] === '-' ? -1 : 1;
    var fracDigits = m[3] || '';
    var digits = m[2] + fracDigits;
    var exponent = parseInt(m[4], 10) - fracDigits.length;
    var numerator = sign * Number(digits);
    if (exponent >= 0) return new Frac(numerator * Math.pow(10, exponent), 1);
    return new Frac(numerator, Math.pow(10, -exponent));
  }

  // Validate + convert a single numeric token (used directly, and for each side
  // of an 'n/d' fraction string). Throws a clear Error on anything non-numeric.
  function tokenToFrac(tok) {
    if (typeof tok !== 'string' || !NUMERIC_RE.test(tok)) {
      throw new Error('Frac.from: entrada no numérica "' + tok + '"');
    }
    var num = Number(tok);
    if (!isFinite(num)) throw new Error('Frac.from: valor no finito "' + tok + '"');
    return numberToFrac(num);
  }

  Frac.from = function (v) {
    if (v instanceof Frac) return v;
    if (v === undefined) return Frac.ZERO;
    if (typeof v === 'string') {
      var raw = v;
      v = v.trim();
      if (v === '') return Frac.ZERO;
      if (v.indexOf('/') >= 0) {
        var p = v.split('/');
        if (p.length !== 2) throw new Error('Frac.from: fracción mal formada "' + raw + '"');
        var numF = tokenToFrac(p[0].trim());
        var denF = tokenToFrac(p[1].trim());
        return numF.div(denF);
      }
      return tokenToFrac(v);
    }
    if (typeof v !== 'number') {
      throw new Error('Frac.from: tipo de dato no soportado (' + typeof v + ')');
    }
    if (isNaN(v)) throw new Error('Frac.from: NaN no es un valor numérico válido');
    if (!isFinite(v)) throw new Error('Frac.from: valor no finito (' + v + ')');
    return numberToFrac(v);
  };
  var P = Frac.prototype;
  P.add = function (o) { o = Frac.from(o); return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); };
  P.sub = function (o) { o = Frac.from(o); return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); };
  P.mul = function (o) { o = Frac.from(o); return new Frac(this.n * o.n, this.d * o.d); };
  P.div = function (o) { o = Frac.from(o); if (o.n === 0) throw new Error('Frac: division by zero'); return new Frac(this.n * o.d, this.d * o.n); };
  P.neg = function () { return new Frac(-this.n, this.d); };
  P.abs = function () { return new Frac(Math.abs(this.n), this.d); };
  P.cmp = function (o) { o = Frac.from(o); var l = this.n * o.d, r = o.n * this.d; return l < r ? -1 : l > r ? 1 : 0; };
  P.eq = function (o) { return this.cmp(o) === 0; };
  P.lt = function (o) { return this.cmp(o) < 0; };
  P.gt = function (o) { return this.cmp(o) > 0; };
  P.isZero = function () { return this.n === 0; };
  P.isNeg = function () { return this.n < 0; };
  P.isPos = function () { return this.n > 0; };
  P.toNumber = function () { return this.n / this.d; };
  P.toString = function () { return this.d === 1 ? String(this.n) : this.n + '/' + this.d; };
  P.toFixed = function (k) { return this.toNumber().toFixed(k === undefined ? 2 : k); };
  /* HTML: fraction with decimal in title tooltip */
  P.toHTML = function () {
    if (this.d === 1) return String(this.n);
    return '<span class="frac" title="' + this.toFixed(4) + '">' + this.n + '/' + this.d + '</span>';
  };
  Frac.ZERO = new Frac(0, 1);
  Frac.ONE = new Frac(1, 1);
  global.Frac = Frac;
})(typeof window !== 'undefined' ? window : globalThis);
