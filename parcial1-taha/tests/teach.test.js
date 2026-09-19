'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load');

const ctx = loadScripts(['js/lib/viz3d.js', 'js/lib/teach.js']);
const Teach = ctx.IO.Teach;

test('Teach catalog covers every cap1–cap5 section with a YouTube id', () => {
  const expected = [];
  for (let i = 1; i <= 7; i++) expected.push('cap1-s' + i);
  for (let i = 1; i <= 4; i++) expected.push('cap2-s' + i);
  for (let i = 1; i <= 7; i++) expected.push('cap3-s' + i);
  for (let i = 1; i <= 5; i++) expected.push('cap4-s' + i);
  for (let i = 1; i <= 4; i++) expected.push('cap5-s' + i);
  expected.forEach((id) => {
    const L = Teach.lessons[id];
    assert.ok(L, 'missing lesson ' + id);
    assert.ok(L.video && L.video.id, 'missing video id for ' + id);
    assert.ok(L.video.id.length >= 8, 'youtube id too short for ' + id);
    assert.equal(L.video.lang, 'español', 'video must be Spanish for ' + id);
    assert.ok(L.primer && L.primer.length > 80, 'primer too short for ' + id);
    assert.ok(L.refs && L.refs.length >= 1, 'missing refs for ' + id);
    L.refs.forEach(function (r) {
      assert.ok(!/en\.wikipedia\.org/.test(r.url || ''), 'English Wikipedia in ' + id);
    });
  });
});

test('videoCard emits nocookie embed and watch link', () => {
  const html = Teach.videoCard({
    id: '2uJiJYviiIw', title: 'LP 1', dur: '6 min', lang: 'español', why: 'corto'
  });
  assert.ok(html.includes('youtube-nocookie.com/embed/2uJiJYviiIw'));
  assert.ok(html.includes('youtube.com/watch?v=2uJiJYviiIw'));
  assert.ok(html.includes('corto'));
});

test('block() for cap2-s1 includes from-zero primer, 3D hook and video', () => {
  const html = Teach.block(Teach.lessons['cap2-s1']);
  assert.ok(html.includes('teach-block'));
  assert.ok(html.includes('De cero'));
  assert.ok(html.includes('data-viz3d="lp-prism"'));
  assert.ok(html.includes('youtube-nocookie.com/embed/2uJiJYviiIw'));
  assert.ok(html.includes('callout-exam'));
});
