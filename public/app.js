const MAX_FONT_SIZE = 22;
const MIN_FONT_SIZE = 13;

const state = {
  prompts: [],
  query: '',
  category: '',
  currentPromptText: '',
  readerFontSize: 16,
  readerWrap: true,
};

const elements = {
  category: document.querySelector('#category'),
  categoryCount: document.querySelector('#category-count'),
  copyPrompt: document.querySelector('#copy-prompt'),
  decreaseFont: document.querySelector('#decrease-font'),
  dialog: document.querySelector('#prompt-dialog'),
  dialogContent: document.querySelector('#dialog-content'),
  dialogMeta: document.querySelector('#dialog-meta'),
  dialogTitle: document.querySelector('#dialog-title'),
  increaseFont: document.querySelector('#increase-font'),
  rawPrompt: document.querySelector('#raw-prompt'),
  readerStats: document.querySelector('#reader-stats'),
  results: document.querySelector('#results'),
  search: document.querySelector('#search'),
  status: document.querySelector('#status'),
  toggleWrap: document.querySelector('#toggle-wrap'),
  totalCount: document.querySelector('#total-count'),
  visibleCount: document.querySelector('#visible-count'),
};

function assertRequiredElements() {
  for (const [name, element] of Object.entries(elements)) {
    if (!element) {
      throw new Error(`Missing required UI element: ${name}`);
    }
  }
}

function formatBytes(bytes) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(bytes / 1024) + ' KB';
}

function matchesPrompt(prompt) {
  const haystack = `${prompt.title} ${prompt.category} ${prompt.subcategory} ${prompt.preview}`.toLowerCase();
  return (!state.category || prompt.category === state.category) && (!state.query || haystack.includes(state.query));
}

function getReaderStats(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 220));
  return `${new Intl.NumberFormat('de-DE').format(words)} Wörter · ca. ${minutes} Min. Lesezeit`;
}

function setStatus(message) {
  elements.status.textContent = message;
}

function applyReaderSettings() {
  elements.dialogContent.style.fontSize = `${state.readerFontSize}px`;
  elements.dialogContent.classList.toggle('is-nowrap', !state.readerWrap);
  elements.toggleWrap.textContent = state.readerWrap ? 'Umbruch an' : 'Umbruch aus';
  elements.toggleWrap.setAttribute('aria-pressed', String(state.readerWrap));
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

  const actions = document.createElement('div');
  actions.className = 'card__actions';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Prompt öffnen';
  button.addEventListener('click', () => openPrompt(prompt));

  const rawLink = document.createElement('a');
  rawLink.className = 'button-link button-link--secondary';
  rawLink.href = prompt.route;
  rawLink.rel = 'noopener';
  rawLink.textContent = 'Rohtext';

  actions.append(button, rawLink);
  card.append(title, meta, preview, actions);
  return card;
}

function renderResults() {
  const filtered = state.prompts.filter(matchesPrompt);
  elements.visibleCount.textContent = String(filtered.length);
  elements.results.replaceChildren(...filtered.map(createCard));
  setStatus(filtered.length ? 'Bereit.' : 'Keine Treffer gefunden.');
}

async function copyCurrentPrompt() {
  if (!state.currentPromptText) {
    elements.copyPrompt.textContent = 'Nichts zu kopieren';
    return;
  }

  try {
    await navigator.clipboard.writeText(state.currentPromptText);
    elements.copyPrompt.textContent = 'Kopiert!';
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(elements.dialogContent);
    selection.removeAllRanges();
    selection.addRange(range);
    elements.copyPrompt.textContent = 'Text markiert';
  }

  window.setTimeout(() => {
    elements.copyPrompt.textContent = 'Prompt kopieren';
  }, 1600);
}

async function openPrompt(prompt) {
  elements.dialogTitle.textContent = prompt.title;
  elements.dialogMeta.textContent = `${prompt.path} · ${formatBytes(prompt.size)}`;
  elements.readerStats.textContent = '';
  elements.rawPrompt.href = prompt.route;
  elements.dialogContent.textContent = 'Prompt wird geladen…';
  state.currentPromptText = '';
  applyReaderSettings();
  elements.dialog.showModal();

  try {
    const response = await fetch(prompt.route, {
      headers: { accept: 'text/plain, text/markdown;q=0.9, */*;q=0.1' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    state.currentPromptText = text;
    elements.readerStats.textContent = getReaderStats(text);
    elements.dialogContent.textContent = text;
  } catch (error) {
    elements.dialogContent.textContent = `Der Prompt konnte nicht geladen werden: ${error.message}`;
  }
}

async function init() {
  assertRequiredElements();

  try {
    const response = await fetch('/index.json', {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    state.prompts = await response.json();
    elements.totalCount.textContent = String(state.prompts.length);
    renderCategories();
    renderResults();
  } catch (error) {
    setStatus(`Index konnte nicht geladen werden: ${error.message}`);
  }
}

elements.search.addEventListener('input', (event) => {
  state.query = event.target.value.trim().toLowerCase();
  renderResults();
});

elements.category.addEventListener('change', (event) => {
  state.category = event.target.value;
  renderResults();
});

elements.copyPrompt.addEventListener('click', copyCurrentPrompt);

elements.decreaseFont.addEventListener('click', () => {
  state.readerFontSize = Math.max(MIN_FONT_SIZE, state.readerFontSize - 1);
  applyReaderSettings();
});

elements.increaseFont.addEventListener('click', () => {
  state.readerFontSize = Math.min(MAX_FONT_SIZE, state.readerFontSize + 1);
  applyReaderSettings();
});

elements.toggleWrap.addEventListener('click', () => {
  state.readerWrap = !state.readerWrap;
  applyReaderSettings();
});

init();
