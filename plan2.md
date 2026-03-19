# plan2.md — Time Tracker: Modern Automation Roadmap

> Source of truth for all improvement work.
> Tasks are NEVER deleted. Use status markers: [ ] todo | [x] done | [~] in-progress | [-] deferred
> Add "Note:" annotations when a task can be improved, not removed.

---

## Product Direction

Transform this from a "manual time tracker" into an **autonomous productivity layer** that:
- Tracks time with zero manual input (passive capture)
- Surfaces insights without requiring analysis
- Requires setup once, then runs itself
- Works from terminal, tray, IDE, and app equally

**Core principle:** The best feature is the one the user doesn't need to think about.

---

## Batch 1 — Foundation & Automation Gaps (HIGH IMPACT)

### A1. Expand DEFAULT_DEV_RULES [x]
**Why:** Only 11 rules exist. Users see classification prompts for every app (Chrome, Firefox, Notion, Figma, etc.).
**Action:** Add 50+ common process patterns covering browsers, design tools, office apps, communication, games.
**Impact:** Reduces first-run classification friction by ~80%.

### A2. Auto-restore active timer from active_entries on startup [x]
**Why:** If app crashes or timer is started via CLI, the app doesn't pick it up — timer is silently lost.
**Action:** Add `loadActiveEntry()` to Storage. In `useInitStore`, restore `activeEntry` from DB.
**Impact:** Eliminates timer loss on crash. Enables CLI↔app interop.

### A3. Implement get_input_activity in Rust (keyboard/mouse accumulator) [x]
**Why:** N7 Input Intelligence is completely broken — `get_input_activity` returns zeros (stub).
**Action:** Background polling thread using `GetAsyncKeyState` + `GetCursorPos` accumulated in AppState Mutex.
**Impact:** Unblocks DWS boost calculation, InputIntelligenceWidget shows real data.

### A4. Wire up update_tray_status (live elapsed time in tray) [x]
**Why:** Tray tooltip shows nothing — users must open app to see elapsed time.
**Action:** Add `tray-icon` feature to Tauri, create tray in setup, implement `update_tray_status`.
**Impact:** Zero-friction time awareness — never need to open app to check timer.

### A5. CLI: add `week` and `categories` commands [x]
**Why:** CLI only has start/stop/status/today. No weekly overview or category management.
**Action:** Add `week` (this week's totals) and `categories` (list all with weekly goals) commands.
**Impact:** Power users can track progress from terminal without opening app.

### A6. Smart session tag heuristics (no LLM) [x]
**Why:** Session tags require LLM (Claude/Ollama setup). Most users never tag sessions.
**Action:** Derive tags from window title patterns: "PR #", "issue", "bug" → "review"; "build", "error" → "debugging"; etc.
**Impact:** Auto-tags >60% of coding sessions without any LLM setup.

### A7. Auto-backup when SyncPath is configured [x]
**Why:** Backup requires manual click in Settings. Users forget, data is at risk.
**Action:** On app startup, if SyncPath is set and today's backup doesn't exist, write JSON snapshot silently.
**Impact:** Zero-friction data safety for users who have SyncPath configured.

### A8. Goal milestone notifications (25/50/75/100%) [x]
**Why:** Users only get notified at 100% goal — missing motivational checkpoints.
**Action:** Fire desktop notification at 25%, 50%, 75% weekly goal milestones. Track which milestones fired per week.
**Impact:** Increases goal engagement, surfaces progress during the week.

### A9. Session duration warning (>90 min without break) [x]
**Why:** Long unbroken sessions are tracked but not surfaced. FocusGuard has break logic but no duration warning.
**Action:** Banner/notification after 90 min of continuous tracking without a break stop.
**Impact:** Proactively surfaces unhealthy patterns. Pairs with FocusDebt.

### A10. Auto-detect repo path from active window [x]
**Why:** CodeQualityView requires manual GitHub username + repo path. Most users never set it.
**Action:** When VSCode is the active window, extract workspace path from window title (pattern: "— project-name").
**Impact:** Auto-populates git context without any settings configuration.

---

## Batch 2 — UX Polish & Friction Reduction (MEDIUM IMPACT)

### B1. Single-key category start from tracker view [ ]
**Why:** Starting a timer requires click → CategoryItem → Start button. Two clicks minimum.
**Action:** Keyboard shortcuts 1–9 for top 9 categories when no input is focused.
**Impact:** <500ms to start a timer from keyboard.

### B2. Smart window title → category suggestion (title-based auto-start) [ ]
**Why:** Auto-start only fires for `mode:'auto'` rules. Most rules are `mode:'suggest'`.
**Action:** When a `suggest` rule matches, show a banner asking to auto-start. One-click confirm elevates to `auto`.
**Impact:** Progressive automation — app learns user patterns and self-improves.

### B3. Category archive (hide without delete) [ ]
**Why:** Old categories accumulate. Delete removes history. No middle ground.
**Action:** Add `archived: boolean` to Category. Archived categories hide from tracker but appear in history.
**Impact:** Cleaner workspace without data loss.

### B4. Bulk session edit in HistoryView [ ]
**Why:** Editing or re-tagging sessions one-by-one is tedious. No batch operations exist.
**Action:** Multi-select sessions, bulk assign category/tag, bulk delete.
**Impact:** Reduces time spent on cleanup after a day of untracked work.

### B5. Compact mode toggle [ ]
**Why:** Category list takes significant vertical space. Power users with 8+ categories need to scroll.
**Action:** Toggle between comfortable (current) and compact (2-line per category) view.
**Impact:** Users with many categories see more at once.

### B6. Daily recap banner on app open [ ]
**Why:** Users open the app in the morning not knowing yesterday's performance.
**Action:** On first open of the day, show a one-line summary: "Yesterday: 4h 20m tracked across 3 categories."
**Impact:** Reinforces habit loop and provides instant context.

### B7. Window size persistence [ ]
**Why:** App always opens at default 800×600. Users resize and lose it on restart.
**Action:** Save/restore window bounds to settings on resize/move.
**Impact:** Zero friction — app is always where the user expects.

### B8. Offline LLM fallback for NLP entry [ ]
**Why:** NLPTimeEntry requires LLM setup. Without it, the input bar is non-functional.
**Action:** If no LLM available, parse "2h work coding" with regex fallback (no AI needed).
**Impact:** NLP time entry works for everyone out of the box.

### B9. Process rules visible + editable in real-time [ ]
**Why:** SettingsView shows rules list but requires restart/re-open to see new classifications.
**Action:** Rules list updates reactively when assign/dismiss happens. Live preview of which rule matches current window.
**Impact:** Users understand the rule system and trust automation more.

### B10. CSV export with configurable columns [ ]
**Why:** CSV export always includes all columns. Different tools need different formats.
**Action:** Column picker for exports (Toggl format, Clockify format, custom).
**Impact:** Frictionless integration with invoicing/billing tools.

---

## Batch 3 — Intelligence & Insights (AI-POWERED)

### C1. Auto-generate weekly review draft [ ]
**Why:** Evening review is blank. Users don't know what to write.
**Action:** Pre-fill evening review with session summary: "Spent 3h on Work (above goal), 1h on Study. Top app: VSCode."
**Impact:** 10x more users complete evening reviews.

### C2. Pattern-based focus recommendations without LLM [ ]
**Why:** RecommendationsView requires complex session history. Simple heuristics work for most.
**Action:** "You focus best on Tuesday mornings (avg 2.4h). Consider protecting 9-11am."
**Impact:** Actionable insights without AI setup.

### C3. Weekly goal auto-calibration [ ]
**Why:** Weekly goals are set manually and never updated. Users either always hit or always miss.
**Action:** After 4 weeks of data, suggest new goal = (avg actual + 10%). One-click accept.
**Impact:** Goals stay motivating, not discouraging.

### C4. Distraction pattern detection [ ]
**Why:** Distraction budget is set manually. Users don't know their actual patterns.
**Action:** After 7 days of passive capture, auto-identify "distraction apps" (apps with <5 min continuous blocks).
**Impact:** Proactively surface what's fragmenting focus without any configuration.

### C5. Daily focus score (0-100) on tracker [ ]
**Why:** Users see DWS per session but no aggregate "how focused was today" score.
**Action:** Compute composite score: (total deep work time + avg DWS + session count penalty). Show as ring gauge.
**Impact:** Single motivating metric for the whole day.

---

## Batch 4 — Reliability & Production Readiness

### D1. Schema migration: add `archived` column to categories [ ]
**Action:** Migration v3 adds `archived INTEGER NOT NULL DEFAULT 0` to categories.

### D2. Crash reporter (offline) [ ]
**Why:** Errors are silent. Users don't know why things fail.
**Action:** Catch unhandled errors in React, log to local file, show "Something went wrong" with copy-to-clipboard details.

### D3. Auto-update check [ ]
**Why:** Users have no way to know a new version is available.
**Action:** On startup, check a GitHub releases API endpoint for a newer version. Show banner if available.
**Note:** Requires publishing a release to GitHub.

### D4. Windows startup integration [ ]
**Why:** Users must remember to open the app. Power users want it always running.
**Action:** Add "Start on login" toggle in Settings using Tauri's autostart plugin.
**Impact:** Zero-friction daily activation.

### D5. Tauri app integrity: verify active_entries on startup [x]
**Why:** CLI can write stale `active_entries` rows (e.g., crash mid-session). App picks up ghost timer.
**Action:** On startup, if active_entry.started_at is >16h ago, auto-close it and create a session.
**Note:** Implemented in tauriStorage.loadActiveEntry — 16h stale guard discards ghost entries.

---

## Batch 5 — Integrations & Export

### E1. Notion export [ ]
**Why:** Notion is the most common personal knowledge base. Sessions + intentions map cleanly to Notion databases.
**Action:** Export sessions to Notion database via Notion API key in settings.

### E2. Obsidian daily note integration [ ]
**Why:** Many developers use Obsidian. Daily note could auto-populate with time tracked.
**Action:** Write a markdown daily note to a configurable Obsidian vault path.
**Note:** This could build on the existing SyncPath/FS write infrastructure.

### E3. Slack status auto-update [ ]
**Why:** When in "Focus" mode, Slack status should reflect that automatically.
**Action:** POST to Slack API when timer starts/stops. Status: "⏱ Focused: Work · 45m".

### E4. Google Calendar import [ ]
**Why:** Meetings are tracked manually. Calendar events could auto-create sessions.
**Action:** OAuth + Calendar API to import today's events as sessions.

### E5. Webhook payload enrichment [ ]
**Why:** Current webhooks are minimal. Integrators need more context.
**Action:** Add DWS, session count, category breakdown to webhook payloads.

---

## Completed Tasks (reference)

- [x] Timer start/stop/switch (core loop)
- [x] Multiple categories with weekly goals
- [x] SQLite persistence via Tauri plugin
- [x] Passive window capture (P1) — polls active window every 5s
- [x] Unclassified process prompt with icon + display name
- [x] Auto-start timer when classified app gains focus
- [x] Attention residue banner (N1)
- [x] Burnout risk badge (N2)
- [x] Maker/Manager day badge (N3)
- [x] Session naming via AI (N4)
- [x] Dead time recovery widget (N5)
- [x] Distraction budget (N6)
- [x] Input intelligence widget (N7) — NOTE: Rust stub returns zeros; see A3
- [x] Minimum Viable Day tracker (N8)
- [x] Code quality + git correlation (I3)
- [x] Screenshots timeline (I6)
- [x] Focus presets (Pomodoro, 52-17, Ultradian, custom)
- [x] Focus guard with strict mode
- [x] NLP time entry (Claude/Ollama)
- [x] Weekly AI digest
- [x] Webhook events
- [x] Desktop notifications
- [x] Command palette (Cmd+K)
- [x] Onboarding wizard
- [x] CSV/JSON/HTML/Markdown export
- [x] EN + PT i18n
- [x] CLI companion (start/stop/status/today)
- [x] VS Code extension (status bar)
- [x] GitHub activity correlation (I1)
- [x] PowerShell injection fixed (env var)
- [x] API key in Windows Credential Manager
- [x] accumulated_ms computed from sessions (not stored)
- [x] Schema migrations via PRAGMA user_version
- [x] llm.ts moved to services/
- [x] SettingKey typed enum
- [x] Storage ISP (4 sub-interfaces)
- [x] Icon extraction cached in AppState
- [x] since_date validation
- [x] Boot load 7 days
- [x] Input stub guard (windowMs === 0)
- [x] VS Code CLI timeout configurable
- [x] CLI active_entries table guard
- [x] DEFAULT_DEV_RULES expanded (see A1)
