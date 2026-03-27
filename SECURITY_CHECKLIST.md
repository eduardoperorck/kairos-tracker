# Developer Security Checklist

Use this checklist before every PR that touches security-sensitive areas.

---

## Secrets & Credentials

- [ ] No API keys, tokens, or passwords hardcoded in source files
- [ ] No secrets in `.env` files committed to the repo
- [ ] New credentials use `saveCredential()` / `loadCredential()` from `src/services/credentials.ts`
- [ ] New `SettingKey` entries for sensitive data are routed through the OS keystore, not SQLite

## Input Handling

- [ ] All SQL queries use parameterized placeholders (`?`) — no string interpolation
- [ ] User-supplied strings passed to Claude prompts are wrapped in `JSON.stringify()`
- [ ] File paths from user settings are validated with `isValidAbsolutePath()` (rejects `..`)
- [ ] GitHub usernames validated against `/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/` before use in URLs
- [ ] Webhook URLs validated with `isSafeWebhookUrl()` before any HTTP request
- [ ] No `eval()`, `Function()`, `innerHTML`, or `dangerouslySetInnerHTML`

## Shell & Process Execution

- [ ] Shell commands use argument arrays (`spawnSync(cmd, [arg1, arg2])`) — never template strings
- [ ] `shell: false` is set on all `spawnSync` / `execFile` calls
- [ ] No user input reaches shell command strings

## External HTTP

- [ ] New external domains are added to the CSP `connect-src` in `tauri.conf.json`
- [ ] API keys transmitted in headers — never in query string parameters or URL paths
- [ ] Webhook destinations validated (HTTPS only, no localhost, no private IPs)

## Local HTTP Server (`localhost:27183`)

- [ ] New endpoints added to `handle_http_connection` include origin validation via `is_trusted_origin()`
- [ ] Request bodies parsed with `serde_json::from_str` — no manual string parsing
- [ ] New payloads use typed structs (`#[derive(serde::Deserialize)]`)

## File System

- [ ] New file write paths validated against `isValidAbsolutePath()` before use
- [ ] Filenames are timestamp/UUID-based — never derived from user input directly
- [ ] Crash logs (`crash-YYYY-MM-DD.log`) do not contain sensitive session data or window titles

## Dependencies

- [ ] New npm packages checked with `npm audit` before adding
- [ ] New Rust crates checked with `cargo audit` before adding
- [ ] Prefer well-maintained packages with recent releases and high download counts
- [ ] Pin major versions — avoid `*` or `latest` specifiers

## CI/CD

- [ ] New secrets added to GitHub Secrets — never hardcoded in workflow YAML
- [ ] Workflow files do not `echo` or `print` secret values
- [ ] Third-party Actions referenced at a fixed major version (e.g., `@v4`)

## Tauri-Specific

- [ ] CSP in `tauri.conf.json` is not set to `null` or `"default-src *"`
- [ ] New Tauri commands (`#[tauri::command]`) do not expose internal state unnecessarily
- [ ] `shell: false` verified for any Tauri shell plugin usage

---

## Automated Checks (run on every PR)

These are enforced by CI — your PR will not merge if they fail:

| Check | Workflow | Tool |
|-------|---------|------|
| Secrets in git history | `security.yml` | gitleaks |
| npm vulnerabilities (high+) | `security.yml` | npm audit |
| Rust CVEs | `security.yml` | cargo audit |
| Supply chain (OSV) | `security.yml` | osv-scanner |
| SAST patterns | `security.yml` | semgrep |
| Tests pass | `ci.yml` | vitest |
| TypeScript clean | `ci.yml` | tsc |

---

## Long-Term Recommendations

1. **Non-Windows secret storage**: Implement `libsecret` (Linux) and `Keychain` (macOS) backends for the `save_secret` / `load_secret` commands — currently non-Windows falls back to unencrypted SQLite
2. **Screenshot privacy**: Before OCR/AI analysis, blur or redact windows containing password fields (`IsPasswordField` on Windows)
3. **Database encryption**: Consider SQLCipher for encrypting the local SQLite database at rest
4. **Zero-trust for integrations**: When Slack/Notion integrations are implemented, request only the minimum OAuth scopes needed
5. **Rate limiting**: Add per-IP rate limiting to the local HTTP server to prevent abuse from browser-based attacks
