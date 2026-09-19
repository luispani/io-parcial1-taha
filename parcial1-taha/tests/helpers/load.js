'use strict';
/* Loads the project's global scripts into a vm context that mimics the browser
 * just enough for logic tests. Usage:
 *   const { loadScripts } = require('./helpers/load');
 *   const ctx = loadScripts(['js/lib/frac.js', 'js/lib/simplex.js']);
 *   ctx.IO.Simplex ...
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');

function makeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
    key: (i) => Array.from(m.keys())[i] || null,
    get length() { return m.size; },
  };
}

function makeElement(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [], childNodes: [], attributes: {}, style: {}, dataset: {},
    className: '', id: '', innerHTML: '', textContent: '', value: '', hidden: false,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(c) { this.children.push(c); this.childNodes.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; },
    append() { for (const c of arguments) if (c && typeof c === 'object') this.appendChild(c); },
    insertBefore(c) { this.children.unshift(c); return c; },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; },
    removeAttribute(k) { delete this.attributes[k]; },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    getElementsByTagName() { return []; }, closest() { return null; },
    focus() {}, blur() {}, click() {}, remove() {},
    getContext() { return new Proxy({}, { get: () => () => {} }); },
    getBoundingClientRect() { return { width: 800, height: 400, top: 0, left: 0, right: 800, bottom: 400 }; },
    clientWidth: 800, clientHeight: 400, offsetWidth: 800, offsetHeight: 400,
  };
  return el;
}

function makeDocument() {
  const doc = {
    documentElement: makeElement('html'),
    head: makeElement('head'),
    body: makeElement('body'),
    createElement: (t) => makeElement(t),
    createElementNS: (_ns, t) => makeElement(t),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
    createDocumentFragment: () => makeElement('fragment'),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    readyState: 'complete', title: '',
  };
  return doc;
}

function makeWindow() {
  const listeners = new Map();
  const w = {
    IO: undefined,
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
    document: makeDocument(),
    location: { hash: '', href: 'http://localhost/', pathname: '/', search: '' },
    history: { replaceState() {}, pushState() {} },
    navigator: { userAgent: 'node', language: 'es' },
    devicePixelRatio: 1,
    innerWidth: 1200, innerHeight: 800,
    matchMedia: () => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
    setTimeout, clearTimeout, setInterval, clearInterval,
    console, Math, Date, JSON, Number, String, Array, Object, Map, Set, Promise, Error, RegExp,
    parseFloat, parseInt, isNaN, isFinite, Infinity, NaN,
    addEventListener(t, fn) { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t).add(fn); },
    removeEventListener(t, fn) { if (listeners.has(t)) listeners.get(t).delete(fn); },
    dispatchEvent(ev) { const s = listeners.get(ev.type); if (s) for (const fn of Array.from(s)) fn(ev); return true; },
    listenerCount(t) { const s = listeners.get(t); return s ? s.size : 0; },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
    Event: function Event(type) { this.type = type; },
  };
  w.window = w; w.globalThis = w; w.self = w;
  return w;
}

function loadScripts(files, opts) {
  const w = makeWindow();
  if (opts && opts.setup) opts.setup(w);
  const ctx = vm.createContext(w);
  for (const f of files) {
    const abs = path.isAbsolute(f) ? f : path.join(ROOT, f);
    const code = fs.readFileSync(abs, 'utf8');
    vm.runInContext(code, ctx, { filename: abs });
  }
  return ctx;
}

module.exports = { loadScripts, ROOT, makeWindow, makeElement };
