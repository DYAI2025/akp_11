import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.mjs';

async function withServer(callback) {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();

  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('serves frontend shell and health endpoint with strict security headers', async () => {
  await withServer(async (baseUrl) => {
    const home = await fetch(`${baseUrl}/`);
    const html = await home.text();
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-type'), /text\/html/);
    assert.match(home.headers.get('content-security-policy'), /default-src 'self'/);
    assert.match(home.headers.get('content-security-policy'), /object-src 'none'/);
    assert.equal(home.headers.get('x-frame-options'), 'DENY');
    assert.equal(home.headers.get('referrer-policy'), 'no-referrer');
    assert.match(html, /id="search"/);
    assert.match(html, /id="results"/);

    const catalog = await fetch(`${baseUrl}/catalog.md`);
    const catalogBody = await catalog.text();
    assert.equal(catalog.status, 200);
    assert.match(catalog.headers.get('content-type'), /text\/markdown/);
    assert.match(catalogBody, /# Prompt Catalog/);

    const health = await fetch(`${baseUrl}/health`);
    const payload = await health.json();
    assert.equal(health.status, 200);
    assert.equal(payload.ok, true);
    assert.ok(payload.prompts > 0);
  });
});

test('serves indexed prompt files and blocks traversal or unsupported files', async () => {
  await withServer(async (baseUrl) => {
    const [firstPrompt] = JSON.parse(readFileSync('index.json', 'utf8'));
    const promptResponse = await fetch(`${baseUrl}${firstPrompt.route}`);
    assert.equal(promptResponse.status, 200);
    assert.match(promptResponse.headers.get('content-type'), /charset=utf-8/);
    assert.ok((await promptResponse.text()).length > 0);

    const traversal = await fetch(`${baseUrl}/prompts/..%2FREADME.md`);
    assert.equal(traversal.status, 404);

    const hiddenBinary = await fetch(`${baseUrl}/prompts/.DS_Store`);
    assert.equal(hiddenBinary.status, 404);

    const malformed = await fetch(`${baseUrl}/prompts/%E0%A4%A`);
    assert.equal(malformed.status, 400);

    const stillHealthy = await fetch(`${baseUrl}/health`);
    assert.equal(stillHealthy.status, 200);
  });
});
