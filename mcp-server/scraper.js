/**
 * Playwright-based scraper for the Kmart Kosmos Design System Storybook.
 *
 * Strategy:
 * - Token pages (colour, spacing, radius, etc.) are scraped eagerly at startup.
 * - Component pages are scraped lazily on first request and cached.
 * - A single headless Firefox instance is kept open for the server's lifetime.
 *
 * Firefox is used because the parent project installs it via `postinstall`.
 * This module is imported by index.js which runs from the project root, so
 * `playwright` resolves from the root node_modules without a separate install.
 */

const STORYBOOK_BASE = 'https://kmartau.github.io/kosmos-ds';
const INDEX_URL = `${STORYBOOK_BASE}/index.json`;

// In-memory caches
const tokenCache = new Map();   // category (string) → { rows: [{variable, value, description}], rawText: string }
const componentCache = new Map(); // normalised title → { props: [...], stories: [...], docsUrl: string }

/** Storybook index — populated once at init */
let storybookIndex = null;

/** The shared Playwright browser instance */
let browser = null;

/** Whether token scraping has finished (or failed) */
let tokensReady = false;

/** Set if index.json could not be fetched */
let indexError = null;

/**
 * Initialise the scraper:
 *  1. Fetch index.json
 *  2. Launch Firefox
 *  3. Scrape all token/foundation pages in the background
 *
 * Returns immediately; token scraping runs async in the background.
 */
export async function initScraper() {
  try {
    storybookIndex = await fetchIndex();
  } catch (err) {
    indexError = err.message;
    tokensReady = true; // don't leave tools in permanent "loading" state
    console.error('[scraper] failed to fetch index.json:', err.message);
    return;
  }

  // Dynamically import playwright so the server starts even if playwright isn't
  // installed yet (it will degrade gracefully and return URLs only).
  let firefox;
  try {
    const pw = await import('playwright');
    firefox = pw.firefox;
  } catch {
    console.error('[scraper] playwright not available — tools will return URLs only');
    tokensReady = true; // skip scraping
    return;
  }

  browser = await firefox.launch({ headless: true });

  // Scrape tokens in the background — don't block server startup
  scrapeTokensEagerly().catch(err =>
    console.error('[scraper] token scraping error:', err)
  );
}

/** Tear down the browser when the server exits */
export async function closeScraper() {
  if (browser) await browser.close();
}

// ---------------------------------------------------------------------------
// Public API used by index.js tools
// ---------------------------------------------------------------------------

/**
 * Return structured token data for a given category (e.g. "colour").
 * Falls back to returning the Storybook URL if scraping hasn't completed.
 */
export function getTokens(category) {
  if (indexError) return { status: 'error', error: indexError };
  if (!storybookIndex) return { status: 'loading' };

  const normalisedCategory = (category || '').toLowerCase().trim();

  // Find matching token entries
  const matches = findTokenEntries(normalisedCategory);
  if (matches.length === 0) {
    const all = listTokenCategories();
    return { status: 'not_found', available: all };
  }

  // Build result for all matching entries
  const results = [];
  for (const entry of matches) {
    const cached = tokenCache.get(entry.id);
    if (cached) {
      results.push({ title: entry.title, ...cached, docsUrl: docsUrl(entry.id) });
    } else {
      results.push({
        title: entry.title,
        status: 'loading',
        docsUrl: docsUrl(entry.id),
      });
    }
  }
  return { status: tokensReady ? 'ready' : 'loading', results };
}

/**
 * Return all available token categories (just names, no values).
 */
export function listTokenCategories() {
  if (!storybookIndex) return [];
  return findTokenEntries('').map(e => ({
    category: tokenCategory(e.title),
    id: e.id,
    url: docsUrl(e.id),
  }));
}

/**
 * Return the full Storybook component index grouped by top-level category.
 */
export function listComponents() {
  if (indexError || !storybookIndex) return {};

  const groups = {};
  for (const entry of Object.values(storybookIndex.entries)) {
    if (isTokenEntry(entry)) continue;
    const parts = entry.title.split('/');
    const group = parts[0];
    if (!groups[group]) groups[group] = [];
    groups[group].push({
      name: parts.slice(1).join('/') || parts[0],
      title: entry.title,
      type: entry.type,
      url: entry.type === 'docs' ? docsUrl(entry.id) : storyUrl(entry.id),
    });
  }
  return groups;
}

/**
 * Search for components by keyword (case-insensitive).
 * Returns matching entries with their URLs.
 */
export function searchComponents(keyword) {
  if (!storybookIndex) return [];
  const kw = (keyword || '').toLowerCase();
  return Object.values(storybookIndex.entries)
    .filter(e => !isTokenEntry(e) && e.title.toLowerCase().includes(kw))
    .map(e => ({
      title: e.title,
      type: e.type,
      url: e.type === 'docs' ? docsUrl(e.id) : storyUrl(e.id),
    }));
}

/**
 * Get full component details (props + stories) for a named component.
 * Scrapes lazily and caches.
 */
export async function getComponent(name) {
  if (indexError) return { status: 'error', error: indexError };
  if (!storybookIndex) return { status: 'loading' };

  const normName = (name || '').toLowerCase();
  const docsEntry = Object.values(storybookIndex.entries).find(e =>
    e.type === 'docs' &&
    !isTokenEntry(e) &&
    e.title.toLowerCase().includes(normName)
  );

  if (!docsEntry) {
    const suggestions = searchComponents(normName).slice(0, 5);
    return { status: 'not_found', suggestions };
  }

  const cacheKey = docsEntry.id;
  if (componentCache.has(cacheKey)) {
    return { status: 'ready', ...componentCache.get(cacheKey) };
  }

  if (!browser) {
    return { status: 'no_browser', docsUrl: docsUrl(docsEntry.id) };
  }

  // Scrape the component docs page
  const data = await scrapePage(docsEntry.id);
  data.docsUrl = docsUrl(docsEntry.id);
  data.title = docsEntry.title;

  // Add individual story links
  const stories = Object.values(storybookIndex.entries).filter(e =>
    e.type === 'story' &&
    e.title === docsEntry.title
  );
  data.stories = stories.map(s => ({ name: s.name, url: storyUrl(s.id) }));

  componentCache.set(cacheKey, data);
  return { status: 'ready', ...data };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function fetchIndex() {
  const res = await fetch(INDEX_URL);
  if (!res.ok) throw new Error(`Failed to fetch index.json: ${res.status}`);
  return res.json();
}

function isTokenEntry(entry) {
  return /^(tokens?|foundations?)\//i.test(entry.title);
}

function tokenCategory(title) {
  return title.split('/').pop().toLowerCase();
}

function findTokenEntries(category) {
  if (!storybookIndex) return [];
  return Object.values(storybookIndex.entries).filter(e => {
    if (!isTokenEntry(e) || e.type !== 'docs') return false;
    if (!category) return true;
    return tokenCategory(e.title).includes(category) || e.title.toLowerCase().includes(category);
  });
}

function docsUrl(id) {
  return `${STORYBOOK_BASE}/?path=/docs/${id.replace(/--docs$/, '')}`;
}

function storyUrl(id) {
  return `${STORYBOOK_BASE}/?path=/story/${id}`;
}

async function scrapeTokensEagerly() {
  const tokenEntries = findTokenEntries('');
  console.error(`[scraper] scraping ${tokenEntries.length} token pages...`);

  for (const entry of tokenEntries) {
    try {
      const data = await scrapePage(entry.id);
      tokenCache.set(entry.id, data);
      console.error(`[scraper] cached tokens: ${entry.title}`);
    } catch (err) {
      console.error(`[scraper] failed to scrape ${entry.id}:`, err.message);
      tokenCache.set(entry.id, { rows: [], rawText: '', error: err.message });
    }
  }

  tokensReady = true;
  console.error('[scraper] all token pages scraped');
}

/**
 * Scrape a single Storybook docs page and extract table data.
 * Returns { rows: [{headers, cells}], rawText }
 */
async function scrapePage(entryId) {
  const url = `${STORYBOOK_BASE}/iframe.html?id=${entryId}&viewMode=docs`;
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });

    // Wait for content to appear
    await page.waitForSelector(
      '#storybook-docs, .sbdocs-content, .sbdocs-wrapper, table, .docblock-argstable',
      { timeout: 15000 }
    ).catch(() => {}); // continue even if selector not found

    // Extract tables
    const tables = await page.$$eval('table', tables =>
      tables.map(table => {
        const headers = [...table.querySelectorAll('th')].map(th => th.innerText.trim());
        const rows = [...table.querySelectorAll('tbody tr')].map(tr =>
          [...tr.querySelectorAll('td')].map(td => td.innerText.trim().replace(/\n+/g, ' '))
        ).filter(row => row.some(cell => cell.length > 0));
        return { headers, rows };
      })
    ).catch(() => []);

    // Extract all visible text as fallback
    const rawText = await page.$eval(
      '#storybook-docs, .sbdocs-content, body',
      el => el.innerText
    ).catch(() => '');

    return { tables, rawText: rawText.slice(0, 8000) }; // cap raw text
  } finally {
    await page.close();
  }
}
