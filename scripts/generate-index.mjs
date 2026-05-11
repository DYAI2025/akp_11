import { isUtf8 } from 'node:buffer';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PROMPTS_DIR = path.join(ROOT_DIR, 'all-prompts');
const INDEX_JSON = path.join(ROOT_DIR, 'index.json');
const CATALOG_MD = path.join(ROOT_DIR, 'catalog.md');
const MAX_PREVIEW_LENGTH = 260;

function isIgnoredName(name) {
  return name === '__MACOSX' || name === '.DS_Store' || name.startsWith('._') || name.startsWith('.');
}

function isTextBuffer(buffer) {
  return isUtf8(buffer) && !buffer.includes(0);
}

function normalizeText(value) {
  return value.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
}

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function encodeRoutePath(relativePath) {
  return relativePath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
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
const skippedBinaryFiles = [];

for (const filePath of files) {
  const relativePath = toPosixPath(path.relative(ROOT_DIR, filePath));
  const promptRelativePath = toPosixPath(path.relative(PROMPTS_DIR, filePath));
  const fileStat = await stat(filePath);
  const rawBuffer = await readFile(filePath);

  if (!isTextBuffer(rawBuffer)) {
    skippedBinaryFiles.push(relativePath);
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
    route: `/prompts/${encodeRoutePath(promptRelativePath)}`,
    size: fileStat.size,
    category,
    subcategory: subpath.length > 1 ? subpath.slice(0, -1).join('/') : '',
    language: detectLanguage(rawContent),
    preview,
  });
}

await writeFile(INDEX_JSON, `${JSON.stringify(records, null, 2)}\n`);

const categories = new Map();
for (const record of records) {
  categories.set(record.category, (categories.get(record.category) ?? 0) + 1);
}

const md = [
  '# Prompt Catalog',
  '',
  `Generated from \`all-prompts\` with ${records.length} text prompt files.`,
  skippedBinaryFiles.length > 0 ? `Skipped ${skippedBinaryFiles.length} unsupported binary file(s).` : 'Skipped 0 unsupported binary files.',
  '',
  '## Categories',
  '',
  ...[...categories.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en')).map(([category, count]) => `- ${category}: ${count}`),
  '',
  '## Prompts',
  '',
  ...records.map((record) => `- [${record.title}](${record.route}) — ${record.category}, ${record.size} bytes`),
  '',
].join('\n');

await writeFile(CATALOG_MD, md);
console.log(`Generated ${records.length} prompt records. Skipped ${skippedBinaryFiles.length} unsupported binary file(s).`);
