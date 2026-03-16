# Outfit Finder — Claude Code Guide

## Project overview

Next.js app that helps users find outfits by scraping Kmart.com.au product data and
presenting AI-curated outfit recommendations. Uses Playwright (Firefox) for scraping
and the Anthropic SDK for outfit matching.

---

## Kmart Kosmos Design System (MCP)

The project has an MCP server that gives Claude direct access to the Kmart Kosmos design
system — real token values and component prop definitions, not just documentation links.

The MCP server (`mcp-server/`) launches automatically when Claude Code starts. It uses
Playwright to render the Storybook SPA and extract structured data.

### Available tools

| Tool | When to use |
|---|---|
| `get_design_tokens` | Get CSS variable names + values before using any colour, spacing, radius, or typography |
| `get_component` | Get real prop definitions before building any UI element |
| `list_components` | Discover what Kosmos components exist, grouped by category |
| `search_components` | Find a component when unsure of its exact name |

### Rules — follow strictly

1. **Before setting any colour** — call `get_design_tokens("colour")` and use the returned
   CSS variable names: `var(--color-brand-primary)`. Never hardcode hex values.

2. **Before setting any spacing or sizing** — call `get_design_tokens("spacing")` and use
   CSS variables: `var(--spacing-md)`. Never hardcode `px` values.

3. **Before building any UI component** — call `get_component("ComponentName")` or
   `search_components("keyword")` to check if Kosmos already has it. If it does, use that
   component with its documented prop API.

4. **Only reference confirmed tokens and components.** Do not guess CSS variable names or
   assume prop types — always check with the tools first.

### Notes on startup

- Token pages are scraped eagerly when the MCP server starts (~30–60s warm-up)
- Component pages are scraped lazily on first request
- If a tool returns "still loading", wait a moment and retry

---

## Development commands

```bash
npm run dev        # start Next.js dev server
npm run build      # production build
npm run test:scraper  # run the Kmart scraper smoke test (requires .env.local)
```

## Setup

```bash
npm install               # installs deps + downloads Firefox via postinstall
cd mcp-server && npm install  # installs MCP SDK
```

## Environment

Copy `.env.local.example` to `.env.local` and fill in:
- `ANTHROPIC_API_KEY` — for AI outfit matching

---

## Code conventions

- TypeScript for all source files (`src/`, `lib/`, `scripts/`)
- Tailwind CSS for styling — but use Kosmos CSS variables for all colour, spacing, and
  radius values (fetched via `get_design_tokens`)
- Playwright Firefox (not Chromium) — the project uses Firefox to avoid bot detection
