import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('generated catalog is plain UTF-8 text for PR and deployment renderers', () => {
  const catalog = readFileSync('catalog.md');
  assert.ok(catalog.length > 0, 'catalog should not be empty');
  assert.equal(catalog.includes(0), false, 'catalog must not contain NUL bytes');
  assert.equal(new TextDecoder('utf-8', { fatal: true }).decode(catalog).startsWith('# Prompt Catalog'), true);
});
