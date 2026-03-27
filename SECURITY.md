# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅ Yes     |
| < 1.0   | ❌ No      |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report vulnerabilities by emailing the maintainer directly. Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You can expect a response within **72 hours** and a patch within **7 days** for critical issues.

## Security Model

Kairos Tracker is a **local-first desktop application**. It:

- Stores all data locally in SQLite (`%APPDATA%\com.kairostacker.app\kairos.db`)
- Never transmits productivity data to any server
- Sends data to external APIs only when explicitly configured by the user (Claude API, Ollama)
- Stores API keys in the OS credential manager (Windows Credential Manager), not in files or the database

### External Connections

The app connects to external services only when the user enables them:

| Service | Purpose | Auth |
|---------|---------|------|
| `https://api.anthropic.com` | AI weekly digest | API key (OS keystore) |
| `http://localhost:11434` | Local Ollama inference | None (local) |
| `https://api.github.com` | Git activity widget | None (public API) |
| `http://localhost:27183` | Browser/VS Code extension bridge | Origin-validated |

### Local HTTP Server

The app runs a local HTTP server on `127.0.0.1:27183` for the browser extension and VS Code extension.

Security controls:
- Bound to `127.0.0.1` only — not accessible from the network
- Origin validation: rejects requests from web pages (CSRF protection)
- Accepts only `chrome-extension://`, `moz-extension://`, `edge-extension://`, and local tools (no Origin header)

## Known Limitations

- On non-Windows platforms, API keys fall back to unencrypted SQLite storage (Windows Credential Manager is Windows-only)
- Screenshots captured by the passive tracker are stored locally and are not encrypted

## Security Checklist for Developers

See [`SECURITY_CHECKLIST.md`](./SECURITY_CHECKLIST.md) for the developer security checklist.
