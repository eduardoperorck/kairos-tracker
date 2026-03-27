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
cli/            # CLI companion (@kairos-tracker/cli)
vscode-extension/
```

Domain logic must be independent from UI and Tauri.

## Timer Rules

Business rules:

- multiple categories exist
- only one timer may run at a time
- switching categories pauses previous timer
- timer stores accumulated duration
- **passive capture rules auto-start the timer**: when a classified app/workspace gains focus, the timer starts automatically for the matched category — no user confirmation needed. This is the intended, correct behavior.
- assigning a process or workspace to a category immediately starts the timer for that category
- `mode: 'auto'` rules (created when user assigns an app to a category) trigger immediate timer start via `suggestedCategoryId` → `handleStart` in App.tsx — never show a "start timer?" banner
- `mode: 'suggest'` rules (default rules before user classifies an app) only trigger scoring/suggestions; the user must classify the app first before auto-start activates
- UI text must reflect this: auto = starts automatically, suggest = user decides when to start

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

## Current Status (as of 2026-03-18)

**Version: 1.0.0-alpha — 62 milestones complete. 80%+ line coverage.**

Recent changes (deep-QA pass):
- PowerShell injection fixed (env var for screenshot path)
- API key encrypted via Windows Credential Manager (`save_secret`/`load_secret`)
- `accumulated_ms` removed from read path — always computed from sessions
- Schema migrations via `PRAGMA user_version` runner in `tauriStorage.ts`
- `llm.ts` moved from `domain/` to `services/`
- `SettingKey` typed enum replaces raw setting key strings
- `Storage` interface split into `CategoryStorage | SessionStorage | SettingsStorage | IntentionStorage`
- Icon extraction cached in `AppState` (Rust Mutex<HashMap>)
- `since_date` validated by `get_git_log` (YYYY-MM-DD regex)
- Boot load reduced from 60 to 7 days
- InputIntelligenceWidget hidden when `windowMs === 0` (stub guard)
- VS Code extension CLI timeout configurable via `timeTracker.cliTimeoutMs`
- CLI adds `active_entries` table guard on write operations
