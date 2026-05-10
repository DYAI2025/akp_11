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
    'copy-link',
    'reader-smaller',
    'reader-larger',
    'toggle-wrap',
    'reader-status',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /<script type="module" src="\/app.js"><\/script>/);
  assert.ok(existsSync('public/styles.css'), 'stylesheet should exist');
});

test('frontend renders untrusted prompt data as text, not HTML', () => {
  assert.match(app, /title\.textContent = prompt\.title/);
  assert.match(app, /preview\.textContent = prompt\.preview/);
  assert.match(app, /elements\.dialogContent\.textContent = text/);
  assert.doesNotMatch(app, /innerHTML\s*=/);
  assert.doesNotMatch(html, / on[a-z]+=\"/i);
});

test('frontend validates prompt index data and unsafe routes before rendering', () => {
  assert.match(app, /function normalizeIndex/);
  assert.match(app, /function normalizePrompt/);
  assert.match(app, /function isSafePromptRoute/);
  assert.match(app, /!decodedPath\.includes\('\.\.'\)/);
  assert.match(app, /credentials: 'same-origin'/);
  assert.match(app, /MAX_TEXT_LENGTH/);
});

test('frontend preserves reader comfort features', () => {
  assert.match(app, /navigator\.clipboard/);
  assert.match(app, /execCommand\('copy'\)/);
  assert.match(app, /readerFontSize/);
  assert.match(app, /readerWrap/);
  assert.match(app, /copyActivePrompt/);
  assert.match(app, /copyActiveLink/);
});
