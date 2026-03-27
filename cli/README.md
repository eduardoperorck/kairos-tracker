# Kairos Tracker CLI

Command-line companion for the [Time Tracker](../) Tauri app.
Reads and writes the same SQLite database used by the desktop app — no running server required.

## Usage

```bash
# Start tracking a category
npx @kairos-tracker/cli start work

# Stop the active timer
npx @kairos-tracker/cli stop

# Check what's currently running
npx @kairos-tracker/cli status

# Show today's totals by category
npx @kairos-tracker/cli today
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
npx @kairos-tracker/cli status

# Or install globally
npm install -g @kairos-tracker/cli
kairos-tracker status
```

## Requirements

The Kairos Tracker desktop app must have been run at least once to create the database.

## Database locations

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\com.kairostacker.app\kairos.db` |
| macOS | `~/Library/Application Support/com.kairostacker.app/kairos.db` |
| Linux | `~/.local/share/com.kairostacker.app/kairos.db` |

## How it works

The CLI opens the SQLite database directly using `better-sqlite3`. Write commands (`start`, `stop`) open the database in read-write mode. Read commands (`status`, `today`) open it read-only to avoid locking the desktop app.

Category names are matched case-insensitively and by prefix — `npx ... start w` will match `Work` if it's the only category starting with "w".

## Security

- No network requests — reads/writes local SQLite only
- No shell string interpolation — all subprocess calls use argument arrays
- On Unix, warns if the database file is world-readable (`chmod o-r` suggested)
