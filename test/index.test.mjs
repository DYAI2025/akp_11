import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const index = JSON.parse(readFileSync('index.json', 'utf8'));

test('generated index contains only deployable prompt files', () => {
  assert.ok(index.length > 0, 'index should not be empty');

  const slugs = new Set();
  for (const entry of index) {
    assert.ok(existsSync(entry.path), `${entry.path} should exist`);
    assert.ok(entry.path.startsWith('all-prompts/'), `${entry.path} should stay inside all-prompts`);
    assert.ok(!entry.path.includes('__MACOSX'), `${entry.path} should not include macOS metadata`);
    assert.ok(!entry.path.includes('/._'), `${entry.path} should not include AppleDouble files`);
    assert.ok(!entry.path.endsWith('.DS_Store'), `${entry.path} should not include Finder metadata`);
    assert.ok(entry.title, 'entry should expose a title for the frontend');
    assert.ok(entry.route.startsWith('/prompts/'), 'entry should expose a prompt route');
    assert.ok(entry.preview.length <= 260, 'preview should be bounded');
    assert.doesNotMatch(entry.preview, /\u0000/, 'preview should not contain NUL bytes');
    assert.ok(!slugs.has(entry.slug), `duplicate slug ${entry.slug}`);
    slugs.add(entry.slug);
  }
});

test('index is sorted for stable CI diffs', () => {
  const paths = index.map((entry) => entry.path);
  assert.deepEqual(paths, [...paths].sort((left, right) => left.localeCompare(right, 'en')));
});
