# my-agent-pimd

## Project
name: my-agent-pimd
description: My Agent with Pi.md + SOUL.md + Skills Evolution + Web UI + Gateway
language: TypeScript

## Project Structure
- public/ - Public assets
- src/ - Source code
- advanced/
- tools/
- types/
- kb/
- tui/
- web/
- providers/
- agent/
- mcp/
- cli/
- extensions/
- plugins/
- pimd/

## Dependencies

### Production

### Development
- bun-types (@^1.0.0)
- typescript (@^5.3.0)

## Commands
- dev: bun run ./src/cli/evolution-cli.ts - Start development server
- dev:soul: bun run ./src/cli/soul-cli.ts
- dev:pi: bun run ./src/cli/pimd-cli.ts
- web: bun run ./src/cli/web-cli.ts
- web:dev: bun run ./src/cli/web-cli.ts --interactive
- gateway: bun run ./src/cli/gateway-cli.ts
- init: bun run ./src/cli/evolution-cli.ts /init
- soul: bun run ./src/cli/evolution-cli.ts /soul
- evolution: bun run ./src/cli/evolution-cli.ts /evolution
- typecheck: tsc --noEmit - Type check

## Coding Standards

// TODO: Add coding standards for this project


## Rules

// TODO: Add project-specific rules
- Follow existing code style
- Write tests for new features


## Custom Instructions

// TODO: Add any project-specific instructions or context