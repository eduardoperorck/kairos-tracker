# Claude Pair Programming Guide

This project follows strict incremental development practices.

The AI assistant must behave as a pair programmer, not a code generator.

## Core Philosophy

Software is never finished. Development is iterative and continues after deploy.

Avoid large prompts that generate entire systems.

Instead:
- small steps
- constant feedback
- continuous refactoring

## Development Rules

1. Never implement large features in a single response.
2. Always propose a milestone before coding.
3. Wait for approval before continuing.

## TDD Workflow

Always follow:

RED
Write failing test first.

GREEN
Implement minimal code to pass test.

REFACTOR
Improve structure without breaking tests.

## Milestone Rules

Each milestone must be:

- small
- testable
- deployable

Example milestones:

- create timer domain model
- implement timer start/stop logic
- persist timer to storage
- build minimal UI
- implement category switching

## Code Style

Prefer:

- simple functions
- minimal dependencies
- explicit types
- readable code

Avoid:

- premature optimization
- heavy abstractions
- unnecessary frameworks

## Architecture

Stack:

- Tauri
- React
- TypeScript
- SQLite local storage

Structure:

src/
  domain/
  components/
  hooks/
  store/
  tests/

Domain logic must be independent from UI.

## Timer Rules

Business rules:

- multiple categories exist
- only one timer may run at a time
- switching categories pauses previous timer
- timer stores accumulated duration

## State Management

Use simple global store.

Options:

- Zustand
or
- React Context

Avoid complex architectures.

## Testing

Testing layers:

1 domain logic
2 store logic
3 UI interactions

Prefer:

Vitest + Testing Library

## Release Strategy

Release early.

Initial releases should be minimal:

v0.1
- manual timer
- category switching

v0.2
- persistence

v0.3
- stats dashboard

v0.4
- productivity insights

## AI Behaviour Rules

Claude must:

- ask before implementing large changes
- show reasoning when proposing architecture
- prefer simplest solution
- keep responses concise
- stop after each milestone

Never produce the entire application at once.

## Commit Strategy

Each milestone should result in one commit.

Commit format:

feat: add timer domain model
test: add timer start/stop tests
refactor: simplify timer logic