'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BUILD_SCRIPT = path.join(ROOT, 'build_single.py');

const LOCAL_JS = [
  'js/lib/frac.js',
  'js/quiz.js',
  'js/plan.js',
  'js/resumen.js',
  'js/cap1.js',
  'js/cap2.js',
  'js/lib/simplex.js',
  'js/cap3.js',
  'js/cap4.js',
  'js/cap5.js',
  'js/simulacro-state.js',
  'js/app.js'
];

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTree(s, d);
    else fs.copyFileSync(s, d);
  }
}

function makeSandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'io-build-'));
  const projectDir = path.join(dir, 'parcial1-taha');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(projectDir, 'index.html'));
  copyTree(path.join(ROOT, 'css'), path.join(projectDir, 'css'));
  copyTree(path.join(ROOT, 'js'), path.join(projectDir, 'js'));
  return { dir, projectDir };
}

function runBuild(indexPath, outPath) {
  return spawnSync('python3', [BUILD_SCRIPT, '--index', indexPath, '--out', outPath], {
    encoding: 'utf8'
  });
}

test('build_single.py generates a valid single-file HTML with every module inlined', () => {
  const { dir, projectDir } = makeSandbox();
  const outPath = path.join(dir, 'out.html');
  const result = runBuild(path.join(projectDir, 'index.html'), outPath);

  assert.equal(result.status, 0, 'exit code should be 0: ' + result.stderr);
  assert.ok(fs.existsSync(outPath), 'output file should exist');

  const html = fs.readFileSync(outPath, 'utf8');

  // Chapters register themselves with IO.registerChapter({ ... }); this marker
  // must appear once per chapter module inlined into the build.
  const registerMatches = html.match(/registerChapter\(\{/g) || [];
  assert.ok(registerMatches.length >= 5, 'expected at least 5 registerChapter( calls (cap1..cap5), got ' + registerMatches.length);

  assert.ok(html.includes('IO.Simplex'), 'js/lib/simplex.js should be inlined (IO.Simplex marker present)');
  assert.ok(html.includes('IO.SimulacroState'), 'js/simulacro-state.js should be inlined');
  assert.ok(html.includes('IO.Quiz'), 'js/quiz.js should be inlined');
  assert.ok(html.includes('IO.Teach'), 'js/lib/teach.js should be inlined');
  assert.ok(html.includes('IO.Viz3D'), 'js/lib/viz3d.js should be inlined');
  assert.ok(html.includes("id: 'peb'"), 'peb chapter should be inlined');
  assert.ok(html.includes("id: 'redes'"), 'redes chapter should be inlined');
  assert.ok(html.includes("id: 'evolutivos'"), 'evolutivos chapter should be inlined');

  // No local <script src="js/..."> or <link rel="stylesheet" href="css/..."> should remain.
  assert.ok(!/<script\s+src="js\//.test(html), 'no local script src="js/..." should remain');
  assert.ok(!/<link\s+rel="stylesheet"\s+href="css\//.test(html), 'no local stylesheet link should remain');

  // The external Google Fonts link must be preserved untouched.
  assert.ok(html.includes('fonts.googleapis.com'), 'Google Fonts link should stay as an external link');
  assert.ok(/<link[^>]+fonts\.googleapis\.com[^>]*>/.test(html), 'Google Fonts <link> tag should remain in the output');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('build_single.py fails with a non-zero exit code and names the missing file', () => {
  const { dir, projectDir } = makeSandbox();
  const outPath = path.join(dir, 'out.html');

  const missingRel = 'js/cap3.js';
  fs.unlinkSync(path.join(projectDir, missingRel));

  const result = runBuild(path.join(projectDir, 'index.html'), outPath);

  assert.notEqual(result.status, 0, 'exit code should be non-zero when a local JS file is missing');
  assert.ok(result.stderr.includes('Falta el archivo local'), 'stderr should include the required message');
  assert.ok(result.stderr.includes(missingRel), 'stderr should name the missing file: ' + result.stderr);
  assert.ok(!fs.existsSync(outPath), 'output file should not be written on failure');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('build_single.py also fails when a local CSS file is missing', () => {
  const { dir, projectDir } = makeSandbox();
  const outPath = path.join(dir, 'out.html');

  fs.unlinkSync(path.join(projectDir, 'css', 'style.css'));

  const result = runBuild(path.join(projectDir, 'index.html'), outPath);

  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes('Falta el archivo local'));
  assert.ok(result.stderr.includes('css/style.css'));

  fs.rmSync(dir, { recursive: true, force: true });
});

test('index.html references js/simulacro-state.js right before js/app.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scriptSrcs = Array.from(html.matchAll(/<script\s+src="([^"]+)"/g)).map((m) => m[1]);
  const simIdx = scriptSrcs.indexOf('js/simulacro-state.js');
  const appIdx = scriptSrcs.indexOf('js/app.js');
  assert.ok(simIdx !== -1, 'js/simulacro-state.js should be referenced in index.html');
  assert.ok(appIdx !== -1, 'js/app.js should be referenced in index.html');
  assert.equal(appIdx, simIdx + 1, 'js/simulacro-state.js must load immediately before js/app.js');
});
