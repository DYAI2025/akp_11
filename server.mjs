import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PROMPTS_DIR = path.join(__dirname, 'all-prompts');
const INDEX_PATH = path.join(__dirname, 'index.json');
const ROOT_FILES = new Map([
  ['/index.json', INDEX_PATH],
  ['/catalog.md', path.join(__dirname, 'catalog.md')],
]);

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

const SECURITY_HEADERS = {
  'content-security-policy': [
    "default-src 'self'",
    "base-uri 'none'",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
  ].join('; '),
  'cross-origin-opener-policy': 'same-origin',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

function securityHeaders(extraHeaders = {}) {
  return { ...SECURITY_HEADERS, ...extraHeaders };
}

function decodeRequestPath(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    if (error instanceof URIError) {
      return null;
    }
    throw error;
  }
}

function safeJoin(baseDir, requestedPath) {
  const normalized = path.normalize(requestedPath).replace(/^([/\\])+/, '');
  const resolved = path.resolve(baseDir, normalized);
  const base = path.resolve(baseDir);

  if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) {
    return null;
  }

  return resolved;
}

async function getPromptIndex() {
  return JSON.parse(await readFile(INDEX_PATH, 'utf8'));
}

async function getAllowedPromptPaths() {
  const index = await getPromptIndex();
  return new Set(index.map((entry) => entry.path.replace(/^all-prompts\//, '')));
}

async function sendFile(req, res, filePath, statusCode = 200) {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendJson(req, res, 404, { error: 'Not found' });
      return;
    }

    const extension = path.extname(filePath);
    const headers = securityHeaders({
      'content-length': fileStat.size,
      'content-type': MIME_TYPES.get(extension) ?? 'application/octet-stream',
    });
    res.writeHead(statusCode, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      sendJson(req, res, 404, { error: 'Not found' });
      return;
    }
    sendJson(req, res, 500, { error: 'Internal server error' });
  }
}

function sendJson(req, res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, securityHeaders({
    'content-length': Buffer.byteLength(body),
    'content-type': 'application/json; charset=utf-8',
  }));
  res.end(req.method === 'HEAD' ? undefined : body);
}

export function createServer() {
  return createHttpServer(async (req, res) => {
    if (!req.url || !req.method || !['GET', 'HEAD'].includes(req.method)) {
      sendJson(req, res, 405, { error: 'Method not allowed' });
      return;
    }

    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/health') {
      try {
        const index = await getPromptIndex();
        sendJson(req, res, 200, { ok: true, prompts: index.length });
      } catch {
        sendJson(req, res, 500, { ok: false, error: 'Index unavailable' });
      }
      return;
    }

    if (ROOT_FILES.has(url.pathname)) {
      await sendFile(req, res, ROOT_FILES.get(url.pathname));
      return;
    }

    if (url.pathname.startsWith('/prompts/')) {
      const requested = decodeRequestPath(url.pathname.slice('/prompts/'.length));
      if (!requested) {
        sendJson(req, res, 400, { error: 'Invalid prompt path' });
        return;
      }

      const allowedPromptPaths = await getAllowedPromptPaths();
      if (!allowedPromptPaths.has(requested)) {
        sendJson(req, res, 404, { error: 'Prompt not found or unsupported file type' });
        return;
      }

      const filePath = safeJoin(PROMPTS_DIR, requested);
      if (!filePath) {
        sendJson(req, res, 400, { error: 'Invalid prompt path' });
        return;
      }
      await sendFile(req, res, filePath);
      return;
    }

    const publicPath = url.pathname === '/' ? 'index.html' : decodeRequestPath(url.pathname);
    if (!publicPath) {
      sendJson(req, res, 400, { error: 'Invalid asset path' });
      return;
    }

    const filePath = safeJoin(PUBLIC_DIR, publicPath);
    if (!filePath) {
      sendJson(req, res, 400, { error: 'Invalid asset path' });
      return;
    }
    await sendFile(req, res, filePath);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  createServer().listen(port, host, () => {
    console.log(`akp_11 prompt browser listening on http://${host}:${port}`);
  });
}
