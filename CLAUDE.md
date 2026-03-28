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
cli/            # CLI companion (@kairos-tracker/cli) — built from source, not yet on npm
```

Note: `vscode-extension/` and `browser-extension/` were removed in the v1.0.0-alpha audit
(no dist, version mismatch, missing icons). Do not recreate without a proper milestone plan.

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

### Critical: week-boundary tests

Never use a hardcoded day offset (e.g. `Date.now() - 5 * 86_400_000`) to represent
"a date outside the current week" — the offset can land inside the current Mon–Sun week
depending on which day of the week CI runs. Always compute relative to the actual
Monday of the current week using `getWeekDates(today)[0]`.

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
- **API key in OS credential store** — stored via Windows Credential Manager (`save_secret`/`load_secret`), never in plaintext or localStorage

## Versioning Rules

- Version is tracked in three files that must stay in sync: `package.json`, `src-tauri/Cargo.toml`, and `src/version.ts`
- `src-tauri/tauri.conf.json` uses only the numeric part (e.g. `1.0.0`) because the MSI bundler rejects non-numeric pre-release identifiers like `-alpha`. Pre-release status is communicated through the GitHub tag (e.g. `v1.0.0-alpha`).
- Every version bump must have a corresponding entry in `CHANGELOG.md` before the PR is merged.
- The `tag-on-merge` workflow auto-creates the git tag when a PR lands on `main`, reading the version from `package.json`. If the tag already exists, no new tag is created (idempotent).

## CI/CD Pipeline

### Workflows

| File | Trigger | Purpose |
|------|---------|---------|
| `ci.yml` | push/PR to main or dev | Tests, Vite build, CLI type-check, cargo check (Linux + Windows), cargo deny |
| `security.yml` | push/PR + Monday 08:00 UTC | gitleaks, npm audit, cargo deny, Semgrep SAST |
| `tag-on-merge.yml` | PR merged to main | Auto-creates version tag from `package.json` → triggers Release |
| `release.yml` | tag push `v*.*.*` | Full Tauri Windows build → uploads `.msi` to GitHub release |

### Key decisions

- **`cargo deny` over `cargo audit`**: `deny.toml` allows structured, documented, audited exceptions with justification. `cargo audit --ignore` is banned — exceptions must be in `deny.toml` with a comment explaining why they are safe.
- **`EmbarkStudios/cargo-deny-action@v2`** is used instead of `cargo install cargo-deny` to avoid reinstalling the binary on every run.
- **`cargo check` not `cargo build`** in CI: full link is only done in the Release workflow (Windows runner). This is intentional for speed — `cargo check` validates correctness in ~4 min vs ~10 min for a full build.
- **`release.yml` needs `permissions: contents: write`** — without it, `tauri-action` cannot create or update GitHub releases even with `GITHUB_TOKEN`.
- **`prerelease: ${{ contains(github.ref_name, '-') }}`** — tags like `v1.0.0-alpha` auto-mark as pre-release; `v1.0.0` marks as stable release.
- **Node 22** is used across all workflows (Node 20 is deprecated on GitHub Actions runners as of June 2026).

### Dependency audit exceptions (deny.toml)

All exceptions are documented in `src-tauri/deny.toml`. Current audited exceptions:

- `RUSTSEC-2023-0071` — RSA Marvin Attack: transitive via `sqlx-macros-core → sqlx-mysql → rsa`. Compile-time only; we use SQLite exclusively; no RSA operations at runtime.
- `RUSTSEC-2024-0411..0420` — GTK3 crates unmaintained: transitive via Tauri's Linux UI layer. Windows-only app; these never execute at runtime on the target platform.
- `RUSTSEC-2025-0057` — `fxhash` unmaintained: transitive via Tauri's stylesheet parser. No CVE.
- `RUSTSEC-2024-0370` — `proc-macro-error` unmaintained: transitive proc-macro dep. No CVE.
- `RUSTSEC-2025-0075/0080/0081/0098/0100` — `unic-*` crates unmaintained: transitive via wry. No CVE.

When adding a new exception to `deny.toml`, always include: crate name, root cause (dependency chain), why it is safe to ignore, and the audit date.

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
ci: improve cargo-deny-action integration
chore(release): bump version to 1.1.0
```

Never use `--no-verify`.

## Release Process

1. Bump version in `package.json`, `src-tauri/Cargo.toml`, and `src/version.ts` (keep them in sync).
2. Add a `## [X.Y.Z] — YYYY-MM-DD` section to `CHANGELOG.md` summarising what changed.
3. Open PR from `dev` → `main`. CI and Security must pass before merging.
4. Merge the PR. The `tag-on-merge` workflow automatically creates the git tag.
5. The `release` workflow triggers on the tag, builds the `.msi` on Windows, and uploads it to the GitHub release.
6. Verify the release page has the `.msi` asset and the correct pre-release flag.

**Do not create tags or releases manually** unless recovering from a CI failure.

## Current Status (as of 2026-03-28)

**Version: 1.0.0-alpha — 62+ milestones complete. 80%+ line coverage.**

### v1.0.0-alpha (2026-03-28) — first public pre-release

Delivered in the repo audit + security hardening sprint:

**Removed (dead code / unfinished extensions):**
- `vscode-extension/` — no dist, no tests, version mismatch with app
- `browser-extension/` — missing icons, no package.json
- `src/services/contextClassifier.ts` — fully implemented but never called
- `src/domain/distractionRecovery.ts` + tests — orphaned, no UI connection
- Dead SettingKeys: `WebhookUrl`, `SlackToken`, `NotionToken`, `NotionDatabaseId`
- Dead i18n strings: webhook, Slack, Notion integration strings
- `tauri-plugin-updater` — registered but capabilities missing; frontend already has update check via GitHub API

**Added / changed:**
- `src/version.ts` — single source of truth for app version string
- `src-tauri/deny.toml` — structured dependency audit configuration
- `CHANGELOG.md` — full feature inventory for v1.0.0-alpha
- `CONTRIBUTING.md` — release process section
- CI: `cargo-check-windows` job (validates WinAPI-only Rust code)
- CI: `cargo deny check` replaces `cargo audit` (structured exceptions, no `--ignore` flags)
- CI: CLI `tsc --noEmit` type-check added to `test` job
- CI: `EmbarkStudios/cargo-deny-action@v2` replaces `cargo install cargo-deny`
- Security: `tag-on-merge` workflow — auto-creates git tag when PR merges to main
- Security: `release.yml` gains `permissions: contents: write` (required for tauri-action)
- `picomatch` bumped 4.0.3 → 4.0.4 (ReDoS + method injection fixes)
- `cli/package-lock.json` committed (required for `npm ci` in CI)

**Known limitations (tracked for v1.1.0):**
- Passive capture and screenshots are Windows-only
- CLI must be built from source — not yet published to npm
- No branch protection rules enforced on GitHub yet
- `cargo check` in CI does not guarantee the final binary links (full build only in Release workflow)

### Previous notable milestones

- Boot load reduced from 60 to 7 days
- API key encrypted via Windows Credential Manager (`save_secret`/`load_secret`)
- `accumulated_ms` removed from read path — always computed from sessions
- Schema migrations via `PRAGMA user_version` runner in `tauriStorage.ts`
- `Storage` interface split into `CategoryStorage | SessionStorage | SettingsStorage | IntentionStorage`
- Icon extraction cached in `AppState` (Rust `Mutex<HashMap>`)
- `since_date` validated by `get_git_log` (YYYY-MM-DD regex)
- PowerShell injection fixed (env var for screenshot path)
- `llm.ts` moved from `domain/` to `services/`
- `SettingKey` typed enum replaces raw setting key strings
