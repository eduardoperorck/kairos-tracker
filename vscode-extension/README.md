# Time Tracker — VS Code Extension

Shows your [Time Tracker](../) active timer in the VS Code status bar and lets you start/stop timers without leaving the editor.

## Features

- **Status bar** — displays the current timer (e.g. `⏱ Work · 01:23:45`) updated every 30 seconds
- **Start timer** — pick a category from a quick-pick dropdown
- **Stop timer** — one click from the status bar or Command Palette
- **No window switching** — full control without leaving VS Code

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| Time Tracker: Start Timer | `Ctrl+Shift+P` → start | Pick a category and start tracking |
| Time Tracker: Stop Timer | click status bar | Stop the active timer |
| Time Tracker: Show Status | `Ctrl+Shift+P` → status | Show current timer in a notification |

## Requirements

1. The [@productivity-challenge/cli](../cli/) package must be accessible via `npx @productivity-challenge/cli`
2. The [Time Tracker desktop app](../) must have been run at least once to create the database

## Installation

**From source:**

```bash
cd vscode-extension
npm install
npm run build
code --install-extension time-tracker-vscode-0.1.0.vsix
```

**From Marketplace:** coming soon.

## How it works

The extension calls the CLI companion (`npx @productivity-challenge/cli`) via `spawnSync` with `shell: false`. The CLI reads/writes the same SQLite database as the desktop app. No local server or WebSocket required.

Status is polled every 30 seconds. Clicking the status bar item stops the active timer (if one is running) or prompts to start one.
