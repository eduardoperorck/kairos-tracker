# Contributing to Kairos Tracker

Thanks for your interest in contributing! This project is built with strict incremental TDD practices — every contribution follows the same workflow used to build it.

## Before You Start

- Check [open issues](../../issues) to avoid duplicate work
- For large changes, open an issue first to discuss the approach
- For bug fixes and small improvements, a PR is fine without a prior issue

## Development Setup

```bash
# Prerequisites: Node.js 18+, Rust toolchain (https://rustup.rs)
git clone https://github.com/pichau/kairos-tracker
cd kairos-tracker
npm install
npm run tauri dev
```

## TDD Workflow

This project follows RED → GREEN → REFACTOR strictly:

1. **RED** — Write a failing test for the behavior you want
2. **GREEN** — Write the minimal code to make the test pass
3. **REFACTOR** — Clean up without breaking tests

Domain logic lives in `src/domain/` — pure TypeScript, no React, no Tauri. Every domain file has a matching `.test.ts`. This is the right place for most logic contributions.

```bash
npm test              # run all tests
npm test -- --watch  # watch mode
```

## Architecture

```
src/domain/      ← pure business logic, start here
src/services/    ← external integrations (LLM, classifier)
src/store/       ← Zustand global state
src/hooks/       ← side-effects and Tauri bridges
src/components/  ← React UI
src/persistence/ ← Storage interface + SQLite / in-memory adapters
```

Domain logic must have **zero UI or Tauri dependencies** — it should be fully testable in Node without any mocking of Tauri APIs.

## Code Style

- TypeScript strict mode — zero `any`, zero `@ts-ignore`
- Explicit types over inference for public interfaces
- Simple functions, minimal dependencies
- No premature abstractions — three similar lines beats a premature helper
- No error handling for impossible cases

## Pull Request Guidelines

- One PR per milestone (keep it small and reviewable)
- All tests must pass: `npm test`
- TypeScript must be clean: `npm run typecheck`
- Describe *what* and *why* in the PR description
- Link to the relevant issue if one exists

## Security

Please do **not** open public issues for security vulnerabilities. Instead, email the maintainer directly. See the Security section in the README for the project's security model.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
