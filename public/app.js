const MAX_PROMPTS = 2_000;
const MAX_TEXT_LENGTH = 2_000_000;
const MAX_FIELD_LENGTH = 2_000;
const PROMPT_ROUTE_PREFIX = '/prompts/';

const state = {
  prompts: [],
  query: '',
  category: '',
  activePrompt: null,
  activePromptText: '',
  readerFontSize: 16,
  readerWrap: true,
};

const elements = Object.freeze({
  category: document.querySelector('#category'),
  categoryCount: document.querySelector('#category-count'),
  copyLink: document.querySelector('#copy-link'),
  copyPrompt: document.querySelector('#copy-prompt'),
  dialog: document.querySelector('#prompt-dialog'),
  dialogContent: document.querySelector('#dialog-content'),
  dialogMeta: document.querySelector('#dialog-meta'),
  dialogTitle: document.querySelector('#dialog-title'),
  readerLarger: document.querySelector('#reader-larger'),
  readerSmaller: document.querySelector('#reader-smaller'),
  readerStatus: document.querySelector('#reader-status'),
  results: document.querySelector('#results'),
  search: document.querySelector('#search'),
  status: document.querySelector('#status'),
  toggleWrap: document.querySelector('#toggle-wrap'),
  totalCount: document.querySelector('#total-count'),
  visibleCount: document.querySelector('#visible-count'),
});

function requireElements() {
  for (const [name, element] of Object.entries(elements)) {
    if (!element) {
      throw new Error(`Missing required UI element: ${name}`);
    }
  }
}

function sanitizeString(value, maxLength = MAX_FIELD_LENGTH) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, maxLength);
}

function isSafePromptRoute(route) {
  if (typeof route !== 'string' || !route.startsWith(PROMPT_ROUTE_PREFIX)) {
    return false;
  }

  try {
    const url = new URL(route, window.location.origin);
    const decodedPath = decodeURIComponent(url.pathname);
    return url.origin === window.location.origin
      && decodedPath.startsWith(PROMPT_ROUTE_PREFIX)
      && !decodedPath.includes('..')
      && !decodedPath.includes('\\')
      && !decodedPath.includes('\u0000');
  } catch {
    return false;
  }
}

function normalizePrompt(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const path = sanitizeString(candidate.path);
  const route = sanitizeString(candidate.route);
  if (
    !path.startsWith('all-prompts/')
    || path.includes('__MACOSX')
    || path.includes('/._')
    || path.endsWith('/.DS_Store')
    || path.includes('/.DS_Store/')
    || !isSafePromptRoute(route)
  ) {
    return null;
  }

  return Object.freeze({
    title: sanitizeString(candidate.title) || 'Unbenannter Prompt',
    slug: sanitizeString(candidate.slug),
    path,
    route,
    size: Number.isSafeInteger(candidate.size) && candidate.size >= 0 ? candidate.size : 0,
    category: sanitizeString(candidate.category) || 'Uncategorized',
    subcategory: sanitizeString(candidate.subcategory),
    language: sanitizeString(candidate.language, 12) || 'unknown',
    preview: sanitizeString(candidate.preview, 320),
  });
}

function normalizeIndex(payload) {
  if (!Array.isArray(payload) || payload.length > MAX_PROMPTS) {
    throw new Error('Der Index hat ein unerwartetes Format.');
  }

  const prompts = payload.map(normalizePrompt).filter(Boolean);
  if (prompts.length === 0) {
    throw new Error('Der Index enthält keine unterstützten Text-Prompts.');
  }

  return Object.freeze(prompts);
}

function formatBytes(bytes) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(bytes / 1024) + ' KB';
}

function matchesPrompt(prompt) {
  const haystack = `${prompt.title} ${prompt.category} ${prompt.subcategory} ${prompt.preview}`.toLowerCase();
  return (!state.category || prompt.category === state.category) && (!state.query || haystack.includes(state.query));
}

function setReaderStatus(message) {
  elements.readerStatus.textContent = message;
}

function applyReaderPreferences() {
  elements.dialogContent.style.fontSize = `${state.readerFontSize}px`;
  elements.dialogContent.classList.toggle('reader--wrap', state.readerWrap);
  elements.toggleWrap.setAttribute('aria-pressed', String(state.readerWrap));
  elements.toggleWrap.textContent = state.readerWrap ? 'Umbruch an' : 'Umbruch aus';
}

function renderCategories() {
  const categories = [...new Set(state.prompts.map((prompt) => prompt.category))].sort((a, b) => a.localeCompare(b, 'de'));
  elements.categoryCount.textContent = String(categories.length);
  elements.category.replaceChildren(new Option('Alle Kategorien', ''));

  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    elements.category.append(option);
  }
}

function createCard(prompt) {
  const card = document.createElement('article');
  card.className = 'card';

  const title = document.createElement('h3');
  title.textContent = prompt.title;

  const meta = document.createElement('p');
  meta.className = 'card__meta';
  meta.textContent = `${prompt.category}${prompt.subcategory ? ` / ${prompt.subcategory}` : ''} · ${formatBytes(prompt.size)} · ${prompt.language}`;

  const preview = document.createElement('p');
  preview.className = 'card__preview';
  preview.textContent = prompt.preview || 'Keine Vorschau verfügbar.';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Prompt öffnen';
  button.addEventListener('click', () => openPrompt(prompt));

  card.append(title, meta, preview, button);
  return card;
}

function renderResults() {
  const filtered = state.prompts.filter(matchesPrompt);
  elements.visibleCount.textContent = String(filtered.length);
  elements.results.replaceChildren(...filtered.map(createCard));
  elements.status.textContent = filtered.length ? 'Bereit.' : 'Keine Treffer gefunden.';
}

async function safeFetchText(route) {
  if (!isSafePromptRoute(route)) {
    throw new Error('Unsichere Prompt-Route blockiert.');
  }

  const response = await fetch(route, {
    credentials: 'same-origin',
    headers: { accept: 'text/plain, text/markdown, */*;q=0.1' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const text = await response.text();
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error('Prompt ist zu groß für den Browser-Reader.');
  }

  return sanitizeString(text, MAX_TEXT_LENGTH);
}

async function writeClipboard(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) {
    throw new Error('Clipboard nicht verfügbar.');
  }
}

async function copyActivePrompt() {
  if (!state.activePromptText) {
    setReaderStatus('Noch kein Prompt geladen.');
    return;
  }

  await writeClipboard(state.activePromptText);
  setReaderStatus('Prompt wurde kopiert.');
}

async function copyActiveLink() {
  if (!state.activePrompt) {
    setReaderStatus('Noch kein Prompt ausgewählt.');
    return;
  }

  const url = new URL(state.activePrompt.route, window.location.origin);
  await writeClipboard(url.href);
  setReaderStatus('Link wurde kopiert.');
}

async function openPrompt(prompt) {
  state.activePrompt = prompt;
  state.activePromptText = '';
  elements.dialogTitle.textContent = prompt.title;
  elements.dialogMeta.textContent = `${prompt.path} · ${formatBytes(prompt.size)}`;
  elements.dialogContent.textContent = 'Prompt wird geladen…';
  setReaderStatus('Reader bereit.');
  applyReaderPreferences();
  elements.dialog.showModal();

  try {
    const text = await safeFetchText(prompt.route);
    state.activePromptText = text;
    elements.dialogContent.textContent = text;
    setReaderStatus(`${formatBytes(new Blob([text]).size)} geladen. Kopieren und Reader-Einstellungen sind verfügbar.`);
  } catch (error) {
    elements.dialogContent.textContent = `Der Prompt konnte nicht geladen werden: ${error.message}`;
    setReaderStatus('Laden fehlgeschlagen.');
  }
}

async function init() {
  requireElements();

  try {
    const response = await fetch('/index.json', {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    state.prompts = normalizeIndex(await response.json());
    elements.totalCount.textContent = String(state.prompts.length);
    renderCategories();
    renderResults();
  } catch (error) {
    elements.status.textContent = `Index konnte nicht geladen werden: ${error.message}`;
  }
}

elements.search.addEventListener('input', (event) => {
  state.query = sanitizeString(event.target.value, 200).trim().toLowerCase();
  renderResults();
});

elements.category.addEventListener('change', (event) => {
  state.category = sanitizeString(event.target.value);
  renderResults();
});

elements.copyPrompt.addEventListener('click', () => copyActivePrompt().catch((error) => setReaderStatus(error.message)));
elements.copyLink.addEventListener('click', () => copyActiveLink().catch((error) => setReaderStatus(error.message)));
elements.readerSmaller.addEventListener('click', () => {
  state.readerFontSize = Math.max(12, state.readerFontSize - 1);
  applyReaderPreferences();
});
elements.readerLarger.addEventListener('click', () => {
  state.readerFontSize = Math.min(24, state.readerFontSize + 1);
  applyReaderPreferences();
});
elements.toggleWrap.addEventListener('click', () => {
  state.readerWrap = !state.readerWrap;
  applyReaderPreferences();
});

init();
