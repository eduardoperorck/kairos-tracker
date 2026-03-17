# Time Tracker CLI

Command-line companion for the [Time Tracker](../) Tauri app.
Reads and writes the same SQLite database used by the desktop app — no running server required.

## Usage

```bash
# Start tracking a category
npx @productivity-challenge/cli start work

# Stop the active timer
npx @productivity-challenge/cli stop

# Check what's currently running
npx @productivity-challenge/cli status

# Show today's totals by category
npx @productivity-challenge/cli today
```

### Output examples

```
▶ Active: Work · 01:23:45 elapsed

■ Stopped: Work · 1h 23m

Today — 2026-03-16
  Work              2h 15m
  Study             0h 45m
──────────────────────────
  Total             3h 00m
```

## Installation

```bash
# Run without installing (recommended)
npx @productivity-challenge/cli status

# Or install globally
npm install -g @productivity-challenge/cli
time-tracker status
```

## Requirements

The Time Tracker desktop app must have been run at least once to create the database.

## Database locations

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\productivity-challenge\timetracker.db` |
| macOS | `~/Library/Application Support/productivity-challenge/timetracker.db` |
| Linux | `~/.local/share/productivity-challenge/timetracker.db` |

## How it works

The CLI opens the SQLite database directly using `better-sqlite3`. Write commands (`start`, `stop`) open the database in read-write mode. Read commands (`status`, `today`) open it read-only to avoid locking the desktop app.

Category names are matched case-insensitively and by prefix — `npx ... start w` will match `Work` if it's the only category starting with "w".

## Security

- No network requests — reads/writes local SQLite only
- No shell string interpolation — all subprocess calls use argument arrays
- On Unix, warns if the database file is world-readable (`chmod o-r` suggested)
