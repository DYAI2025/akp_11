import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('generated catalog is plain UTF-8 text for PR and deployment renderers', () => {
  const catalog = readFileSync('catalog.md');
  assert.ok(catalog.length > 0, 'catalog should not be empty');
  assert.equal(catalog.includes(0), false, 'catalog must not contain NUL bytes');
  assert.equal(new TextDecoder('utf-8', { fatal: true }).decode(catalog).startsWith('# Prompt Catalog'), true);
});

test('generated catalog links to server prompt routes', () => {
  const catalog = readFileSync('catalog.md', 'utf8');
  assert.match(catalog, /\]\(\/prompts\//, 'catalog links should resolve through the deployed prompt endpoint');
  assert.doesNotMatch(catalog, /\]\(all-prompts\//, 'catalog should not link to unserved repository paths');
});
