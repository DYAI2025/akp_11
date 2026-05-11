import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const generator = readFileSync('scripts/generate-index.mjs', 'utf8');
const server = readFileSync('server.mjs', 'utf8');

test('index generator rejects unsupported binary files before decoding', () => {
  assert.match(generator, /import \{ isUtf8 \} from 'node:buffer'/);
  assert.match(generator, /function isTextBuffer/);
  assert.match(generator, /!buffer\.includes\(0\)/);
  assert.match(generator, /skippedBinaryFiles\.push/);
  assert.match(generator, /CATALOG_MD/);
  assert.doesNotMatch(generator, /_index\.md/);
});

test('server wraps asynchronous request handling before responding', () => {
  assert.match(server, /async function handleRequest/);
  assert.match(server, /handleRequest\(req, res\)\.catch/);
  assert.match(server, /sendJson\(req, res, 500, \{ error: 'Internal server error' \}\)/);
});

test('server ships strict frontend security headers', () => {
  for (const directive of [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ]) {
    assert.ok(server.includes(directive), `missing CSP directive: ${directive}`);
  }
  assert.match(server, /x-frame-options.*DENY/s);
  assert.match(server, /permissions-policy/);
  assert.match(server, /referrer-policy.*no-referrer/s);
});
