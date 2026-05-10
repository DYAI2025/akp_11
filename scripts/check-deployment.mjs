import { once } from 'node:events';
import { createServer } from '../server.mjs';

const server = createServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');

const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;
const failures = [];

async function check(path, validate) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.text();
  const result = await validate(response, body);
  if (!result.ok) {
    failures.push(`${path}: ${result.message}`);
  }
}

try {
  await check('/health', async (response, body) => {
    const payload = JSON.parse(body);
    return {
      ok: response.ok && payload.ok === true && payload.prompts > 0,
      message: `expected healthy JSON, got ${response.status} ${body}`,
    };
  });

  await check('/', async (response, body) => ({
    ok: response.ok
      && body.includes('AKP 11 Prompt Browser')
      && body.includes('/app.js')
      && response.headers.get('content-security-policy')?.includes("object-src 'none'")
      && response.headers.get('x-frame-options') === 'DENY',
    message: `expected secured frontend shell, got ${response.status}`,
  }));

  await check('/index.json', async (response, body) => {
    const index = JSON.parse(body);
    return {
      ok: response.ok && Array.isArray(index) && index.length > 0 && index.every((entry) => entry.route?.startsWith('/prompts/')),
      message: 'expected non-empty prompt index with prompt routes',
    };
  });

  await check('/prompts/../README.md', async (response) => ({
    ok: response.status >= 400,
    message: `expected traversal protection, got ${response.status}`,
  }));
} finally {
  server.close();
  await once(server, 'close');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Deployment smoke checks passed at ${baseUrl}`);
