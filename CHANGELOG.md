# Changelog

All notable changes to Kairos Tracker are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.0.0-alpha] — 2026-03-27

First public release.

### Added

**Core tracking**
- Multi-category timer with one-active-at-a-time enforcement
- Session history with start/end timestamps, context tags, and undo stack
- Manual time entry (form-based) and NLP time entry ("worked 3h on deep work yesterday morning")
- Calendar import (ICS/iCal) — detected focus blocks count toward history

**Passive capture (Windows)**
- Rust background thread polls the active window every 5 seconds
- Auto-starts the timer when a classified app gains focus — no user action needed
- Smart classify overlay: unknown apps identified by name and icon; rule remembered after one assignment
- Workspace classification — VS Code workspace folders tracked independently of the process
- Domain rules — map known sites to categories automatically
- Correction learning — after 3 manual overrides the rule is promoted permanently
- Tracking Accuracy Score (TAS) — weekly composite score for auto-classification quality
- Idle detection — timer pauses after 5 minutes of keyboard/mouse inactivity

**Focus system**
- Focus Guard — mandatory break system (Pomodoro / 52-17 / Ultradian / Custom presets)
- Strict mode — no skip or postpone allowed
- Focus Lock — fullscreen circular timer with flow state pulse animation
- Focus Debt — accumulates on skipped breaks, credited on flow sessions and rest

**Insights**
- Energy score banner — real-time peak/valley hour from 30-day pattern
- Deep Work Score (DWS 0–100) — composite cognitive session quality metric
- Context Switching Score — app switches per hour with focus classification
- Interrupt Cost Widget — estimated time lost per context switch
- Focus Recommendations — heuristic coaching from personal patterns
- Adaptive Cycles — learns natural focus rhythm from actual session data
- GitHub-style 13-week activity heatmap with optional GitHub commit overlay
- Flow state detection — sessions ≥ 45 min flagged automatically
- Weekly AI Digest — Claude API or local Ollama weekly summary
- Productivity Wrapped — monthly reveal (Spotify Wrapped style)

**Organization**
- Daily Intentions — morning brief + evening review with mood score
- Minimum Viable Day — 1–3 must-complete goals, checkable inline
- Category colors, weekly goals, and smart goal suggestions
- Command palette (Ctrl+K) and keyboard shortcuts (1–9, Ctrl+Shift+T)

**Ecosystem**
- Export: CSV, JSON, Markdown, HTML weekly report
- Import: Toggl Track CSV
- Auto-backup to any local folder (OneDrive/Dropbox sync-ready)
- Obsidian daily note export
- System tray with live timer
- Native OS notifications (goal reached, daily reminder, long-session alert)
- CLI companion: `npx @kairos-tracker/cli` for terminal access
- pt-BR / English i18n

**Security**
- Claude API key stored in OS credential store (Windows Credential Manager)
- CSP restricts network access to `api.anthropic.com` and `api.github.com`
- Context injection HTTP server bound to `127.0.0.1:27183` only
- All user inputs JSON-serialized before interpolation into AI prompts
- Backup restore validates every field before writing to the database

**Infrastructure**
- SQLite persistence via `tauri-plugin-sql` with schema migrations
- In-memory storage adapter for tests and CI
- CI: tests + Vite build + CLI `tsc --noEmit` (Ubuntu), `cargo check` (Ubuntu + Windows)
- Security pipeline: gitleaks (full history), npm audit (root + CLI), cargo deny (advisories + licenses), Semgrep SAST (TypeScript + React + OWASP Top 10)
- `cargo deny` with `deny.toml` — 18 audited exceptions, all documented with root cause and justification
- Automatic release workflow: PR merge to `main` → auto-tag → Windows build → `.msi` uploaded to GitHub release
- 80%+ line coverage, 75%+ branch coverage enforced by Vitest thresholds

### Known limitations

- Passive capture and screenshots are Windows-only (macOS/Linux builds compile but core features are no-ops)
- CLI companion (`@kairos-tracker/cli`) must be built from source — not yet published to npm
- Update check is informational only; the `.msi` from the release page must be downloaded manually

---

## [0.1.0-alpha] — 2026-03-15

Internal pre-release used during development. Not distributed publicly.
