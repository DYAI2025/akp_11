import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const railwayConfig = JSON.parse(readFileSync('railway.json', 'utf8'));
const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

test('Railway uses reproducible build, start and healthcheck commands', () => {
  assert.equal(packageJson.scripts.build, 'node scripts/generate-index.mjs');
  assert.equal(packageJson.scripts.start, 'node server.mjs');
  assert.equal(packageJson.scripts.smoke, 'node scripts/check-deployment.mjs');
  assert.match(packageJson.engines.node, />=20/);

  assert.equal(railwayConfig.build.builder, 'NIXPACKS');
  assert.equal(railwayConfig.build.buildCommand, 'npm run build');
  assert.equal(railwayConfig.deploy.startCommand, 'npm start');
  assert.equal(railwayConfig.deploy.healthcheckPath, '/health');
  assert.ok(railwayConfig.deploy.healthcheckTimeout >= 30);
});

test('CI gates deployment artifacts, server behavior and smoke checks', () => {
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /git diff --exit-code index\.json catalog\.md/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run smoke/);
});
