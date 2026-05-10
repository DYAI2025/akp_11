import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PROMPTS_DIR = path.join(__dirname, 'all-prompts');
const ROOT_FILES = new Map([
  ['/index.json', path.join(__dirname, 'index.json')],
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
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "font-src 'self'",
    "require-trusted-types-for 'script'",
    'trusted-types default',
  ].join('; '),
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'origin-agent-cluster': '?1',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self), clipboard-read=(), clipboard-write=(self)',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

function safeJoin(baseDir, requestedPath) {
  const normalized = path.normalize(requestedPath).replace(/^([/\\])+/, '');
  const resolved = path.resolve(baseDir, normalized);
  const base = path.resolve(baseDir);

  if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) {
    return null;
  }

  return resolved;
}

function isProbablyBinary(buffer) {
  if (buffer.length === 0) {
    return false;
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  if (sample.includes(0)) {
    return true;
  }

  let suspicious = 0;
  for (const byte of sample) {
    const isCommonTextByte = byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126) || byte >= 128;
    if (!isCommonTextByte) {
      suspicious += 1;
    }
  }

  return suspicious / sample.length > 0.08;
}

async function assertTextFile(filePath) {
  const handle = await readFile(filePath);
  if (isProbablyBinary(handle)) {
    const error = new Error('Binary files are not supported');
    error.code = 'UNSUPPORTED_BINARY';
    throw error;
  }
}

function withSecurityHeaders(headers = {}) {
  return { ...SECURITY_HEADERS, ...headers };
}

async function sendFile(req, res, filePath, statusCode = 200, options = {}) {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    if (options.textOnly) {
      await assertTextFile(filePath);
    }

    const extension = path.extname(filePath);
    res.writeHead(statusCode, withSecurityHeaders({
      'content-length': fileStat.size,
      'content-type': MIME_TYPES.get(extension) ?? 'text/plain; charset=utf-8',
    }));

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }
    if (error?.code === 'UNSUPPORTED_BINARY') {
      sendJson(res, 415, { error: 'Binary files are not supported' });
      return;
    }
    sendJson(res, 500, { error: 'Internal server error' });
  }
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, withSecurityHeaders({
    'content-length': Buffer.byteLength(body),
    'content-type': 'application/json; charset=utf-8',
  }));
  res.end(body);
}

export function createServer() {
  return createHttpServer(async (req, res) => {
    if (!req.url || !req.method || !['GET', 'HEAD'].includes(req.method)) {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }

    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      sendJson(res, 400, { error: 'Invalid URL' });
      return;
    }

    if (url.pathname === '/health') {
      try {
        const index = JSON.parse(await readFile(path.join(__dirname, 'index.json'), 'utf8'));
        sendJson(res, 200, { ok: true, prompts: index.length });
      } catch {
        sendJson(res, 500, { ok: false, error: 'Index unavailable' });
      }
      return;
    }

    if (ROOT_FILES.has(url.pathname)) {
      await sendFile(req, res, ROOT_FILES.get(url.pathname), 200, { textOnly: true });
      return;
    }

    if (url.pathname.startsWith('/prompts/')) {
      const requested = decodeURIComponent(url.pathname.slice('/prompts/'.length));
      const filePath = safeJoin(PROMPTS_DIR, requested);
      if (!filePath) {
        sendJson(res, 400, { error: 'Invalid prompt path' });
        return;
      }
      await sendFile(req, res, filePath, 200, { textOnly: true });
      return;
    }

    const publicPath = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname);
    const filePath = safeJoin(PUBLIC_DIR, publicPath);
    if (!filePath) {
      sendJson(res, 400, { error: 'Invalid asset path' });
      return;
    }
    await sendFile(req, res, filePath, 200, { textOnly: true });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  createServer().listen(port, host, () => {
    console.log(`akp_11 prompt browser listening on http://${host}:${port}`);
  });
}
