# Security Policy

## Supported Use

`mcp-gateway-lite` is intended to expose read-only MCP endpoints for trusted internal systems.

Before deploying it:

- Place it behind network controls or a reverse proxy.
- Use a strong bearer token and rotate it regularly.
- Scope backend credentials to the minimum read-only permissions required.
- Keep query audit logging at `redacted` or `minimal` unless you explicitly need full text logging.

## Reporting a Vulnerability

Please do not open a public issue for security-sensitive reports.

Send vulnerability reports to the maintainer through a private channel first. Include:

- affected version or commit
- reproduction steps
- impact assessment
- suggested mitigation if available

The maintainer should acknowledge the report, confirm severity, and coordinate a fix before public disclosure.

## Hardening Notes

- Do not store bearer tokens or backend passwords in YAML files committed to git.
- Prefer separate read-only credentials for Postgres, Redis, and ClickHouse.
- Review exposed routes such as `/health` and `/metrics` before enabling public access.
- Validate reverse proxy and TLS settings in the deployment environment.
