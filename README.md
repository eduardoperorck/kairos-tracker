# Time Tracker

A desktop time tracking application built with Tauri, React, TypeScript, and SQLite.

## Features

- Create named categories (e.g. Work, Study, Exercise)
- Start and stop timers per category
- Only one timer runs at a time — switching categories auto-pauses the previous one
- Rename categories inline (click the name)
- Delete categories with inline confirmation
- Live elapsed time display per category
- Daily statistics view with per-category progress bars
- Persistent local storage via SQLite

## Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri v2](https://tauri.app) |
| UI | [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| State | [Zustand](https://zustand-demo.pmnd.rs) |
| Storage | SQLite via [tauri-plugin-sql](https://github.com/tauri-apps/plugins-workspace) |
| Testing | [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com) |
| Bundler | [Vite](https://vitejs.dev) |

## Project Structure

```
src/
  domain/       # Pure business logic (no framework dependencies)
    timer.ts    # Category & TimerEntry types, startTimer/stopTimer/getElapsed
    store.ts    # Pure reducer: addCategory, startCategoryTimer, removeCategory, renameCategory...
    format.ts   # formatElapsed(ms) → "mm:ss"
    stats.ts    # computeStats(categories) → sorted StatEntry[]
  components/
    App.tsx         # Root component, view toggle (tracker / stats)
    CategoryItem.tsx # Row with inline rename, start/stop, delete confirm
    StatsView.tsx   # Statistics view with progress bars
  hooks/
    useElapsed.ts      # Ticking elapsed-ms hook
    useInitStore.ts    # Loads categories from storage on mount
  store/
    useTimerStore.ts     # Zustand vanilla store wrapping domain reducer
    useTimerStoreHook.ts # React hook bridge
  persistence/
    storage.ts          # Storage interface
    inMemoryStorage.ts  # In-memory implementation (used in tests)
    tauriStorage.ts     # SQLite implementation via Tauri plugin
  tests/
    setup.ts  # jest-dom setup
src-tauri/    # Rust/Tauri native shell
```

## Development

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Rust](https://rustup.rs) (for Tauri native build)
- Tauri system dependencies ([Linux](https://tauri.app/v1/guides/getting-started/prerequisites#setting-up-linux) / [Windows](https://tauri.app/v1/guides/getting-started/prerequisites#setting-up-windows) / [macOS](https://tauri.app/v1/guides/getting-started/prerequisites#setting-up-macos))

### Install

```bash
npm install
```

### Run (web only, no Tauri)

```bash
npm run dev
```

### Run (full Tauri desktop app)

```bash
npm run tauri dev
```

### Test

```bash
npm test
```

### Type check

```bash
npm run typecheck
```

### Build

```bash
npm run build        # frontend only
npm run tauri build  # full desktop app
```

## Development Methodology

Built with strict TDD following an incremental milestone approach:

1. Write failing tests (RED)
2. Implement minimal code to pass (GREEN)
3. Refactor without breaking tests (REFACTOR)

Each milestone results in one commit. No large features are implemented in a single step.

## Milestones

| # | Milestone | Tests |
|---|---|---|
| 1 | Timer domain model | 10 |
| 2 | Category store (pure reducer) | 11 |
| 3 | Zustand store wrapper | 6 |
| 4 | Minimal React UI | 9 |
| 5 | Elapsed time display | 11 |
| 6 | SQLite persistence via Tauri | 18 |
| 7 | Tailwind CSS styling | — |
| 8 | Daily statistics view | 14 |
| 9 | Build verification & typecheck | — |
| 10 | Delete category | 12 |
| 11 | Rename category (inline edit) | 9 |

**Total: 95 tests**

## Roadmap

- `v0.1` ✅ Manual timer + category switching
- `v0.2` ✅ SQLite persistence
- `v0.3` ✅ Stats dashboard
- `v0.4` — Productivity insights (streaks, daily goals)
