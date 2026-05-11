import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const railwayJson = JSON.parse(readFileSync('railway.json', 'utf8'));
const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8');

test('Railway configuration uses the generated index build, Node start command, and healthcheck', () => {
  assert.equal(railwayJson.build.builder, 'NIXPACKS');
  assert.equal(railwayJson.build.buildCommand, 'npm run build');
  assert.equal(railwayJson.deploy.startCommand, 'npm start');
  assert.equal(railwayJson.deploy.healthcheckPath, '/health');
  assert.equal(railwayJson.deploy.restartPolicyType, 'ON_FAILURE');
});

test('package scripts expose reproducible build, smoke, and generated-artifact checks', () => {
  assert.equal(packageJson.engines.node, '>=20');
  assert.equal(packageJson.scripts.build, 'node scripts/generate-index.mjs');
  assert.match(packageJson.scripts['check:generated'], /npm run build/);
  assert.match(packageJson.scripts['check:generated'], /git diff --exit-code -- index\.json catalog\.md/);
  assert.match(packageJson.scripts['check:generated'], /git diff --cached --exit-code -- index\.json catalog\.md/);
  assert.equal(packageJson.scripts.smoke, 'node scripts/check-deployment.mjs');
  assert.equal(packageJson.scripts.start, 'node server.mjs');
  assert.equal(packageJson.scripts.test, 'node --test');
});

test('CI blocks generated artifact drift before test and smoke deployment checks', () => {
  const checkGeneratedIndex = ciWorkflow.indexOf('npm run check:generated');
  const testIndex = ciWorkflow.indexOf('npm test');
  const smokeIndex = ciWorkflow.indexOf('npm run smoke');
  assert.ok(checkGeneratedIndex > -1, 'CI should verify generated artifacts');
  assert.ok(testIndex > checkGeneratedIndex, 'tests should run after artifact verification');
  assert.ok(smokeIndex > testIndex, 'smoke checks should run after tests');
});
