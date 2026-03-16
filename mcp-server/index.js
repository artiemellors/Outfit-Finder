/**
 * Kmart Kosmos Design System — MCP Server
 *
 * Provides Claude Code with real design token values and component prop definitions
 * by scraping the Storybook SPA at https://kmartau.github.io/kosmos-ds using Playwright.
 *
 * Tools:
 *   get_design_tokens   — actual CSS variable names + values for a token category
 *   get_component       — prop definitions + story links for a named component
 *   list_components     — all available components grouped by category
 *   search_components   — search components by keyword
 *
 * Run from the project root so that `playwright` resolves from root node_modules:
 *   node mcp-server/index.js
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  initScraper,
  closeScraper,
  getTokens,
  listTokenCategories,
  listComponents,
  searchComponents,
  getComponent,
} from './scraper.js';

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'kmart-design-system', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_design_tokens',
      description:
        'Returns actual CSS variable names and values for a Kosmos design token category ' +
        '(colour, spacing, radius, typography, breakpoints, icons). ' +
        'Always call this before choosing any colour, spacing, or border-radius value. ' +
        'Use the returned CSS variable names — never hardcode hex or px values.',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description:
              'Token category to fetch. One of: colour, spacing, radius, typography, ' +
              'breakpoints, icons. Leave empty to list all available categories.',
          },
        },
      },
    },
    {
      name: 'get_component',
      description:
        'Returns prop definitions (name, type, default, description) and story links for a ' +
        'named Kosmos component. Always call this before building any UI element to check ' +
        'if a Kosmos component exists and to use the correct prop API.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Component name to look up, e.g. "Button", "Card", "Input".',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'list_components',
      description:
        'Lists all available Kosmos components grouped by category (inputs, layout, etc.). ' +
        'Use this to discover what components are available before searching or fetching details.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'search_components',
      description:
        'Searches for Kosmos components by keyword. Returns matching component names and URLs.',
      inputSchema: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: 'Search keyword, e.g. "modal", "badge", "nav".',
          },
        },
        required: ['keyword'],
      },
    },
  ],
}));

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'get_design_tokens':
      return handleGetTokens(args?.category);

    case 'get_component':
      return handleGetComponent(args?.name);

    case 'list_components':
      return handleListComponents();

    case 'search_components':
      return handleSearchComponents(args?.keyword);

    default:
      return text(`Unknown tool: ${name}`);
  }
});

// ---------------------------------------------------------------------------
// Handler implementations
// ---------------------------------------------------------------------------

function handleGetTokens(category) {
  if (!category) {
    const categories = listTokenCategories();
    if (categories.length === 0) {
      return text(
        '**Design System index is still loading.** Try again in a few seconds.\n\n' +
        `Storybook: https://kmartau.github.io/kosmos-ds/?path=/docs/tokens-colour`
      );
    }
    const lines = categories.map(c => `- **${c.category}** — ${c.url}`).join('\n');
    return text(`## Available Token Categories\n\n${lines}`);
  }

  const result = getTokens(category);

  if (result.status === 'error') {
    return text(
      `**Could not reach the Kosmos design system** (network error: ${result.error}).\n\n` +
      `Browse tokens directly in Storybook:\n` +
      `https://kmartau.github.io/kosmos-ds/?path=/docs/tokens-${encodeURIComponent(category)}`
    );
  }

  if (result.status === 'loading' && !result.results) {
    return text(
      `**Design system is still loading.** Token scraping started at server startup.\n` +
      `Try again in ~30 seconds.\n\n` +
      `Storybook: https://kmartau.github.io/kosmos-ds/?path=/docs/tokens-${encodeURIComponent(category)}`
    );
  }

  if (result.status === 'not_found') {
    const available = (result.available || []).map(c => `\`${c.category}\``).join(', ');
    return text(`No token category found for "${category}".\n\nAvailable: ${available}`);
  }

  const sections = (result.results || []).map(r => formatTokenResult(r)).join('\n\n---\n\n');
  const loadingNote = result.status === 'loading'
    ? '\n\n> ⚠️ Some pages are still loading — results above may be partial.\n'
    : '';

  return text(sections + loadingNote);
}

function formatTokenResult(r) {
  if (r.status === 'loading') {
    return `## ${r.title}\n\n_Still loading..._ [View in Storybook](${r.docsUrl})`;
  }

  if (!r.tables || r.tables.length === 0) {
    // Fall back to raw text
    const preview = (r.rawText || '').slice(0, 2000);
    return (
      `## ${r.title}\n\n` +
      `[View in Storybook](${r.docsUrl})\n\n` +
      (preview ? `\`\`\`\n${preview}\n\`\`\`` : '_No structured data extracted._')
    );
  }

  const tableMd = r.tables
    .filter(t => t.rows.length > 0)
    .map(t => formatTable(t))
    .join('\n\n');

  return `## ${r.title}\n\n[View in Storybook](${r.docsUrl})\n\n${tableMd}`;
}

async function handleGetComponent(name) {
  if (!name) {
    return text('Please provide a component name, e.g. `get_component("Button")`');
  }

  const result = await getComponent(name);

  if (result.status === 'error') {
    return text(
      `**Could not reach the Kosmos design system** (network error: ${result.error}).\n\n` +
      `Browse components directly in Storybook: https://kmartau.github.io/kosmos-ds`
    );
  }

  if (result.status === 'loading') {
    return text('Design system index is still loading. Try again in a moment.');
  }

  if (result.status === 'no_browser') {
    return text(
      `**Playwright not available** — cannot scrape component details.\n\n` +
      `View ${name} in Storybook: ${result.docsUrl}`
    );
  }

  if (result.status === 'not_found') {
    const suggestions = (result.suggestions || [])
      .map(s => `- [${s.title}](${s.url})`)
      .join('\n');
    return text(
      `No component found matching "${name}".\n\n` +
      (suggestions ? `**Suggestions:**\n${suggestions}` : 'No close matches found.')
    );
  }

  // Format component result
  const lines = [`## ${result.title}`, '', `[View docs](${result.docsUrl})`];

  if (result.tables && result.tables.length > 0) {
    lines.push('', '### Props', '');
    result.tables.forEach(t => {
      if (t.rows.length > 0) lines.push(formatTable(t));
    });
  } else if (result.rawText) {
    lines.push('', '### Documentation', '', '```', result.rawText.slice(0, 3000), '```');
  }

  if (result.stories && result.stories.length > 0) {
    lines.push('', '### Stories', '');
    result.stories.forEach(s => lines.push(`- [${s.name}](${s.url})`));
  }

  return text(lines.join('\n'));
}

function handleListComponents() {
  const groups = listComponents();
  if (Object.keys(groups).length === 0) {
    return text('Design system index is still loading. Try again in a moment.');
  }

  const lines = ['## Kosmos Components', ''];
  for (const [group, entries] of Object.entries(groups)) {
    lines.push(`### ${group}`, '');
    // Show unique component names (docs entries preferred, deduplicated)
    const seen = new Set();
    entries.forEach(e => {
      const key = e.name;
      if (!seen.has(key)) {
        seen.add(key);
        lines.push(`- [${e.name}](${e.url})`);
      }
    });
    lines.push('');
  }

  return text(lines.join('\n'));
}

function handleSearchComponents(keyword) {
  if (!keyword) {
    return text('Please provide a search keyword.');
  }

  const results = searchComponents(keyword);

  if (results.length === 0) {
    return text(`No components found matching "${keyword}".`);
  }

  const lines = [`## Search results for "${keyword}"`, ''];
  // Deduplicate by title, prefer docs entries
  const seen = new Set();
  results.forEach(r => {
    if (!seen.has(r.title)) {
      seen.add(r.title);
      lines.push(`- [${r.title}](${r.url}) _(${r.type})_`);
    }
  });

  return text(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function formatTable({ headers, rows }) {
  if (!rows || rows.length === 0) return '';

  const cols = headers.length || Math.max(...rows.map(r => r.length));
  const hdrs = headers.length > 0 ? headers : Array.from({ length: cols }, (_, i) => `Col ${i + 1}`);

  const header = `| ${hdrs.join(' | ')} |`;
  const divider = `| ${hdrs.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => {
    const cells = Array.from({ length: hdrs.length }, (_, i) => (row[i] ?? '').replace(/\|/g, '\\|'));
    return `| ${cells.join(' | ')} |`;
  }).join('\n');

  return [header, divider, body].join('\n');
}

function text(content) {
  return { content: [{ type: 'text', text: content }] };
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  // Start scraping in background (non-blocking)
  initScraper().catch(err =>
    console.error('[mcp] scraper init error:', err)
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[mcp] Kmart Design System MCP server running');
}

main().catch(err => {
  console.error('[mcp] fatal error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await closeScraper();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await closeScraper();
  process.exit(0);
});
