import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('generated catalog is plain UTF-8 text for PR and deployment renderers', () => {
  const catalog = readFileSync('catalog.md');
  assert.ok(catalog.length > 0, 'catalog should not be empty');
  assert.equal(catalog.includes(0), false, 'catalog must not contain NUL bytes');
  assert.equal(new TextDecoder('utf-8', { fatal: true }).decode(catalog).startsWith('# Prompt Catalog'), true);
});

test('generated catalog links point at served prompt routes, not raw repository paths', () => {
  const catalog = readFileSync('catalog.md', 'utf8');
  const promptLinks = [...catalog.matchAll(/^- \[[^\n]+?\]\(([^)]+)\)/gm)].map((match) => match[1]);
  assert.ok(promptLinks.length > 0, 'catalog should contain prompt links');
  assert.ok(promptLinks.every((link) => link.startsWith('/prompts/')), 'all catalog links should target server prompt routes');
  assert.ok(!promptLinks.some((link) => link.startsWith('all-prompts/')), 'catalog should not link to unserved repository paths');
});
