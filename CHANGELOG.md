# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1] - 2026-04-06

### Added

- Published `mcp-gateway-lite` to npm.
- Added CLI execution support via `mcp-gateway-lite` and `npx mcp-gateway-lite`.
- Added Codecov upload to GitHub Actions CI.
- Added `README.en.md` for English documentation.
- Added `CONTRIBUTING.md` and `SECURITY.md` for open-source collaboration.

### Changed

- Reworked the main README for open-source release and npm distribution.
- Switched the default README language to Korean with a linked English version.
- Updated package metadata for public distribution, including repository links and keywords.
- Added packaging checks with `prepack`, `pack:check`, and `publish:check`.
- Updated Docker startup to use `node dist/main.js`.

### Removed

- Removed tracked local `config.yml` from the repository.

## [0.1.0] - 2026-04-06

### Added

- Initial public release of `mcp-gateway-lite`.
- Streamable HTTP MCP gateway for Postgres, Redis, and ClickHouse.
- Shared bearer token authentication, rate limiting, structured audit logging, health checks, and Prometheus metrics.
- Read-only SQL guards for Postgres and ClickHouse.
- Allowlist-based read-only Redis command guards.
- Dockerfile, docker-compose example, and Vitest-based test coverage.
