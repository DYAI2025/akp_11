import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const html = readFileSync('public/index.html', 'utf8');
const app = readFileSync('public/app.js', 'utf8');

test('frontend shell exposes critical deployment UI and reader hooks', () => {
  for (const id of [
    'search',
    'category',
    'status',
    'results',
    'prompt-dialog',
    'total-count',
    'visible-count',
    'copy-prompt',
    'raw-prompt',
    'reader-stats',
    'decrease-font',
    'increase-font',
    'toggle-wrap',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /<script type="module" src="\/app.js"><\/script>/);
  assert.ok(existsSync('public/styles.css'), 'stylesheet should exist');
});

test('frontend renders untrusted prompt data as text, not HTML', () => {
  assert.match(app, /textContent = prompt\.title/);
  assert.match(app, /preview\.textContent = prompt\.preview/);
  assert.match(app, /elements\.dialogContent\.textContent = text/);
  assert.doesNotMatch(app, /innerHTML\s*=/);
  assert.doesNotMatch(app, /insertAdjacentHTML\s*\(/);
  assert.doesNotMatch(app, /document\.write\s*\(/);
  assert.doesNotMatch(app, /eval\s*\(/);
  assert.doesNotMatch(app, /new Function\s*\(/);
  assert.doesNotMatch(html, / on[a-z]+=\"/i);
});

test('frontend includes copy and reader comfort controls without external dependencies', () => {
  assert.match(app, /navigator\.clipboard\.writeText/);
  assert.match(app, /getReaderStats/);
  assert.match(app, /readerFontSize/);
  assert.match(app, /readerWrap/);
  assert.doesNotMatch(html, /https?:\/\//i);
});

const css = readFileSync('public/styles.css', 'utf8');

test('frontend CSS keeps long prompt metadata readable and dialogs inside the viewport', () => {
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /max-height:\s*calc\(100vh - 2rem\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 800px\)/);
});
