import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PROMPTS_DIR = path.join(ROOT_DIR, 'all-prompts');
const INDEX_JSON = path.join(ROOT_DIR, 'index.json');
const MAX_PREVIEW_LENGTH = 260;
const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;

function isIgnoredName(name) {
  return name === '__MACOSX' || name === '.DS_Store' || name.startsWith('._') || name.startsWith('.');
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

function normalizeText(value) {
  return value.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
}

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function detectLanguage(content) {
  const sample = content.slice(0, 4000);
  const germanSignals = [' der ', ' die ', ' das ', ' und ', ' nicht ', ' ist ', ' du ', ' sie '];
  const lower = ` ${sample.toLowerCase()} `;
  const hits = germanSignals.filter((signal) => lower.includes(signal)).length;
  return hits >= 3 ? 'de' : 'en';
}

function makeSlug(relativePath) {
  return relativePath
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (isIgnoredName(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = (await walk(PROMPTS_DIR)).sort((left, right) => left.localeCompare(right, 'en'));
const records = [];
const skipped = [];

for (const filePath of files) {
  const relativePath = toPosixPath(path.relative(ROOT_DIR, filePath));
  const promptRelativePath = toPosixPath(path.relative(PROMPTS_DIR, filePath));
  const fileStat = await stat(filePath);

  if (fileStat.size > MAX_TEXT_FILE_BYTES) {
    skipped.push(`${relativePath} (too large for text index)`);
    continue;
  }

  const rawBuffer = await readFile(filePath);
  if (isProbablyBinary(rawBuffer)) {
    skipped.push(`${relativePath} (binary file)`);
    continue;
  }

  const rawContent = rawBuffer.toString('utf8');
  const preview = normalizeText(rawContent).slice(0, MAX_PREVIEW_LENGTH);
  const [category = 'Uncategorized', ...subpath] = promptRelativePath.split('/');
  const title = path.basename(filePath).replace(/\.[^.]+$/, '');

  records.push({
    title,
    slug: makeSlug(promptRelativePath),
    path: relativePath,
    route: `/prompts/${encodeURI(promptRelativePath).replace(/#/g, '%23')}`,
    size: fileStat.size,
    category,
    subcategory: subpath.length > 1 ? subpath.slice(0, -1).join('/') : '',
    language: detectLanguage(rawContent),
    preview,
  });
}

await writeFile(INDEX_JSON, `${JSON.stringify(records, null, 2)}\n`);

console.log(`Generated ${records.length} prompt records.`);
if (skipped.length > 0) {
  console.warn(`Skipped ${skipped.length} unsupported files:\n${skipped.map((entry) => `- ${entry}`).join('\n')}`);
}
