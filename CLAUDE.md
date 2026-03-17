# Claude Pair Programming Guide

This project follows strict incremental development practices.

The AI assistant must behave as a pair programmer, not a code generator.

## Core Philosophy

Software is never finished. Development is iterative and continues after deploy.

Avoid large prompts that generate entire systems.

Instead:
- small steps
- constant feedback
- continuous refactoring

## Development Rules

1. Never implement large features in a single response.
2. Always propose a milestone before coding.
3. Wait for approval before continuing.

## TDD Workflow

Always follow:

RED
Write failing test first.

GREEN
Implement minimal code to pass test.

REFACTOR
Improve structure without breaking tests.

## Milestone Rules

Each milestone must be:

- small
- testable
- deployable

## Code Style

Prefer:

- simple functions
- minimal dependencies
- explicit types
- readable code

Avoid:

- premature optimization
- heavy abstractions
- unnecessary frameworks

## Architecture

Stack:

- Tauri 2
- React 18
- TypeScript
- Tailwind CSS
- Zustand (global store)
- SQLite via tauri-plugin-sql

Structure:

```
src/
  domain/       # pure business logic — no React, no Tauri
  components/   # React UI
  hooks/        # side-effects and Tauri bridges
  store/        # Zustand store
  persistence/  # Storage interface + implementations
cli/            # CLI companion (@productivity-challenge/cli)
vscode-extension/
```

Domain logic must be independent from UI and Tauri.

## Timer Rules

Business rules:

- multiple categories exist
- only one timer may run at a time
- switching categories pauses previous timer
- timer stores accumulated duration

## State Management

Zustand — minimal global store, no boilerplate.

## Testing

Testing layers:

1. domain logic
2. store logic
3. UI interactions

Prefer: Vitest + Testing Library

### Critical: i18n in tests

All components that call `useI18n()` must be wrapped with `<I18nProvider>` in tests.
Use a local `renderWithI18n(ui)` helper in each test file.
Without the provider, `t(key)` returns the raw key string — assertions on visible text will fail.

### Critical: TimerEntry type

`TimerEntry = { startedAt: number; endedAt: number | null }`

Mocks for `activeEntry` must always include `endedAt: null`.

## Storage

`Storage` is an interface implemented by two adapters:

| Adapter | Used when |
|---------|-----------|
| `tauriStorage` | Running in Tauri (SQLite) |
| `inMemoryStorage` | Tests and browser fallback |

`main.tsx` detects `window.__TAURI_INTERNALS__` to pick the right adapter.
The web demo (M46) was cancelled — `demoStorage.ts` has been removed.

## i18n Types

```ts
// CORRECT — allows translated string values
const pt: { [K in keyof typeof en]: string } = { ... }
const translations: Record<Lang, { [K in keyof typeof en]: string }>

// WRONG — typeof en with as const requires identical literal values
const pt: typeof en = { ... }
```

## Security Rules

These are live rules, not suggestions:

- **No shell string interpolation** — use `spawnSync` with arg arrays and `shell: false`
- **No raw API errors to users** — catch and return generic messages by HTTP status code
- **Prompt inputs must be JSON-serialized** — `JSON.stringify(userInput)` before interpolating into Claude prompts
- **Webhook URLs validated** — only HTTPS, no localhost, no private IPs (`isSafeWebhookUrl()`)
- **File paths validated** — reject `..` and non-absolute paths before any `fs` operation
- **Backup JSON validated** — runtime type-check every field before calling `importSessions`
- **CSP enforced** — `tauri.conf.json` has a restrictive CSP; do not set `"csp": null`

## AI Behaviour Rules

Claude must:

- ask before implementing large changes
- show reasoning when proposing architecture
- prefer simplest solution
- keep responses concise
- stop after each milestone

Never produce the entire application at once.

## Commit Strategy

Each milestone should result in one commit.

Commit format:

```
feat: add timer domain model
test: add timer start/stop tests
refactor: simplify timer logic
fix: correct streak calculation on week boundary
docs: update README with CLI instructions
```

Never use `--no-verify`.

## Current Status (as of 2026-03-17)

**Version: 0.1.0 (unreleased) — 62 milestones complete. 422 tests. 80.37% line coverage.**

This session covered:
- **Part 9 (C1)**: Removed web demo artifacts (demoStorage.ts, vite.web.config.ts, build:web)
- **Part 9 (QA1)**: Security fixes — SVG XSS escape, path traversal hardening, promise .catch() handlers, NLPTimeEntry double-submit race condition, memory leak in idle detection interval
- **Part 9 (QA2)**: Tests for WeeklyStatCard, NLPTimeEntry, DigestView, ProductivityWrapped
- **Part 9 (QA3)**: App.tsx refactored to ~150-line orchestrator; TrackerView.tsx extracted
- **Part 8 domain**: passiveCapture, contextSwitching, deepWorkScore, focusRecommendations + full test suites
- **Part 8 Rust**: get_active_window() and get_git_log() commands added to lib.rs
- **Part 10**: llm.ts (Ollama + Claude abstraction), adaptiveCycles, focusDebt, distractionRecovery + full test suites
- **UI**: FocusDebtBanner, RecommendationsView, TrackerView, AI backend status in Settings
- **Coverage session**: SettingsView.test, FocusLock.test, HistoryView.test + extended storage/llm/domain tests → 67% → 80%+

The project is feature-complete and stable, pending first public release (v1.0.0). TypeScript strict — zero errors. 422 tests, 0 skipped hooks.
