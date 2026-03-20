# Time Tracker

> A science-backed productivity tracker built with Tauri + Claude AI that learns your energy patterns.

![CI](https://github.com/pichau/productivity-challenge/actions/workflows/ci.yml/badge.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-2.x-24c8d8?logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=black)
![Vitest](https://img.shields.io/badge/Tested_with-Vitest-6e9f18?logo=vitest&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Why this exists

Most productivity tools count hours. This one **understands them**.

After 30 days of data, Time Tracker identifies your personal peak and valley hours, detects when you enter a flow state, computes your Deep Work Score, tracks your Focus Debt, and generates a Claude AI-powered weekly digest — all without your data ever leaving your machine. Supports both Claude API and local Ollama as AI backends.

---

## Features

### Core Tracking
- **Multi-category timer** — track Work, Study, Exercise, or any custom category
- **One active timer** — switching categories pauses the previous one automatically
- **Session history** — every session stored with start/end timestamps and optional context tag
- **NLP time entry** — log past sessions in natural language ("worked 3h on deep work yesterday morning")

### Science-Backed Focus
- **Focus Guard** — mandatory break system based on ultradian rhythm research (Pomodoro / 52-17 / 90-20 / Custom)
- **Strict mode** — no skips, no delays — for users who want real commitment
- **Focus Lock** — fullscreen circular timer with flow state pulse animation
- **Auto-pause** — detects inactivity and pauses the timer automatically

### Insights & Intelligence
- **Energy score banner** — tells you in real time if you're in a peak or valley hour based on your last 30 days
- **Inline insights** — streak, peak hour, and flow count visible directly on each category
- **GitHub-style heatmap** — 13 weeks of activity with optional GitHub commit overlay
- **Flow state detection** — sessions ≥ 45 min automatically flagged as flow sessions
- **Deep Work Score (DWS 0–100)** — composite score measuring cognitive session quality
- **Context Switching Score** — tracks app switches per hour (🟢 focused / 🟡 moderate / 🔴 fragmented)
- **Focus Debt** — accumulates when you skip breaks or work late; credits flow sessions and rest
- **Focus Recommendations** — actionable, data-driven coaching from your own patterns
- **Adaptive Cycles** — learns your natural focus rhythm from actual session data
- **Distraction Recovery Time** — measures how long each distraction costs you
- **Weekly AI Digest** — Claude API or local Ollama summarises your week in natural language
- **Productivity Wrapped** — monthly reveal in the style of Spotify Wrapped

### Organization
- **Daily Intentions** — morning brief + evening review with mood score
- **Context tags** — label sessions as deep work / meeting / admin / learning / blocked
- **Category colors** — 6 color swatches per category
- **Weekly goals** — with progress bars and smart suggestions based on your 4-week average
- **Shareable stat card** — generate and copy a weekly summary image to clipboard

### Ecosystem
- **Export** — CSV, JSON, Markdown (Notion/Obsidian-ready), and standalone HTML weekly report
- **Import** — Toggl Track CSV history
- **Backup / Restore** — full database backup to any folder
- **OneDrive / Dropbox sync** — multi-device without a server
- **Webhooks** — POST events to Discord, Zapier, n8n, Philips Hue, or any HTTPS URL
- **System tray** — live timer in the tray, control without opening the window
- **Global shortcuts** — Ctrl+Shift+T to toggle, Ctrl+K for command palette
- **Native notifications** — goal reached, daily reminder, long-session alert
- **CLI companion** — `npx @productivity-challenge/cli start work` from any terminal
- **VS Code extension** — timer in the status bar, start/stop without leaving the editor
- **pt-BR / English** — full i18n support

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Desktop shell | **Tauri 2** | 10× smaller binary than Electron, native Rust performance |
| UI | **React 18 + TypeScript** | Component model, strong typing |
| Styling | **Tailwind CSS** | Utility-first, no runtime overhead |
| State | **Zustand** | Minimal global store, no boilerplate |
| Persistence | **SQLite via tauri-plugin-sql** | Local-first, offline-always |
| Tests | **Vitest + Testing Library** | Fast, ESM-native, no Jest config overhead |
| AI | **Claude API + Ollama support** | Weekly digest + NLP time entry; Ollama enables 100% offline AI |

---

## Architecture

```
src/
├── domain/         # Pure business logic — no React, no Tauri
│   ├── timer.ts              category + session model, streak computation
│   ├── history.ts            heatmap, energy pattern, flow detection, exports
│   ├── focusGuard.ts         break scheduling, compliance metrics
│   ├── intentions.ts         daily planning model
│   ├── digest.ts             Claude API integration (digest + NLP parsing)
│   ├── passiveCapture.ts     smart capture rule engine + block aggregation
│   ├── contextSwitching.ts   app-switch rate + focus status classification
│   ├── deepWorkScore.ts      DWS 0–100 composite metric
│   ├── focusDebt.ts          cognitive debt accumulation model
│   ├── adaptiveCycles.ts     natural cycle inference from real session data
│   ├── distractionRecovery.ts  DRT — time lost per interruption source
│   ├── focusRecommendations.ts  heuristic coaching engine
│   └── llm.ts                unified LLM backend (Ollama + Claude API)
│
├── store/          # Zustand global state
│   └── useTimerStore.ts
│
├── hooks/          # Side-effects and Tauri bridges
│   ├── useInitStore.ts       load from SQLite on startup
│   ├── useWebhooks.ts        fire-and-forget HTTPS events
│   ├── useGitHubActivity.ts  GitHub commit overlay for heatmap
│   ├── useNotifications.ts   native OS notifications
│   └── useGlobalShortcuts.ts
│
├── components/     # React UI
│   ├── App.tsx                 orchestrator (~150 lines)
│   ├── TrackerView.tsx         timer + category list + focus debt banner
│   ├── CategoryItem.tsx        timer row with inline insights
│   ├── StatsView.tsx           heatmap, energy curve, recommendations
│   ├── DigestView.tsx          AI weekly digest panel
│   ├── FocusGuard.tsx          mandatory break overlay
│   ├── FocusLock.tsx           fullscreen circular timer
│   ├── FocusDebtBanner.tsx     focus debt level display
│   ├── RecommendationsView.tsx data-driven coaching panel
│   ├── IntentionsView.tsx      daily planning + evening review
│   ├── NLPTimeEntry.tsx        natural language session logging
│   ├── OnboardingWizard.tsx    first-run 3-step wizard
│   ├── CommandPalette.tsx      Ctrl+K universal search
│   ├── EnergyScoreBanner.tsx   real-time peak/valley indicator
│   ├── CircularTimer.tsx       SVG arc timer component
│   ├── WeeklyStatCard.tsx      shareable SVG stat card generator
│   └── ProductivityWrapped.tsx Spotify-style monthly reveal
│
├── persistence/    # Storage abstraction
│   ├── storage.ts          interface
│   ├── tauriStorage.ts     SQLite implementation
│   └── inMemoryStorage.ts  test & browser fallback
│
cli/                # CLI companion (separate npm package)
└── vscode-extension/  # VS Code extension
```

**Data flow:** `domain` → `store` → `hooks` → `components` → `persistence`

Domain logic has zero UI or Tauri dependencies — fully testable in Node.

---

## Getting Started

### Prerequisites

- [Node.js 18+](https://nodejs.org)
- [Rust toolchain](https://rustup.rs) (for Tauri)
- Windows 10+ (primary target; macOS/Linux builds untested)

### Development

```bash
npm install
npm run tauri dev
```

### Tests

```bash
npm test
```

### Production build

```bash
npm run tauri build
```

Produces a signed `.msi` installer in `src-tauri/target/release/bundle/msi/`.

---

## CLI Companion

```bash
npx @productivity-challenge/cli start work
npx @productivity-challenge/cli stop
npx @productivity-challenge/cli status
npx @productivity-challenge/cli today
```

Reads and writes the same SQLite database as the desktop app. See [cli/README.md](./cli/README.md).

---

## VS Code Extension

Shows the active timer in the VS Code status bar. Start and stop timers without leaving the editor.

See [vscode-extension/README.md](./vscode-extension/README.md) for installation instructions.

---

## Configuration

| Setting | Where | Notes |
|---------|-------|-------|
| Focus preset | Settings tab | Pomodoro / 52-17 / Ultradian / Custom |
| Strict mode | Settings tab | Disables skip/postpone on breaks |
| Claude API key | Settings tab | Stored locally, never sent elsewhere |
| Webhook URL | Settings tab | Any HTTPS endpoint |
| Sync folder | Settings tab | Point to OneDrive / Dropbox folder |
| GitHub username | Settings tab | Public username for commit overlay |
| Language | Settings tab | EN / PT-BR |
| AI Backend | Settings tab | Claude API key or auto-detected local Ollama |

---

## Security

All sensitive data stays local:
- API keys stored in SQLite on-device, never logged or transmitted
- Webhook calls only to HTTPS endpoints; localhost and private IPs blocked
- Claude prompts use structured JSON serialization — category names cannot inject prompt text
- Tauri CSP restricts network access to `api.anthropic.com` and `api.github.com` only
- Backup restore validates every field before writing to the database
- SVG stat cards escape all user content to prevent XSS in shareable output
- Sync paths validated — rejects `..`, UNC paths, and relative paths before any filesystem operation
- Ollama option: run AI features 100% offline — zero data leaves the device

---

## Development Guide

This project follows strict incremental TDD practices. Every feature starts with a failing test.

See [CLAUDE.md](./CLAUDE.md) for the full pair-programming guide used to build this project with Claude Code.

Development diary and milestone history: [PLAN.md](./PLAN.md)

Scientific foundations for every metric and analysis: [SCIENCE.md](./SCIENCE.md)

---

## Built with Claude Code

This entire project was built incrementally through pair programming sessions with [Claude Code](https://claude.ai/claude-code) — Anthropic's CLI for Claude.

Every feature followed the TDD workflow in CLAUDE.md:
1. Write a failing test (RED)
2. Implement minimal code to pass (GREEN)
3. Refactor without breaking tests

62 milestones. 422 tests. 80%+ line coverage. Zero skipped hooks. TypeScript strict — zero errors. Version 0.1.0 (pre-release).

---

## License

MIT
