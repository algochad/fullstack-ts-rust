---
name: security-audit
description: Security review of code, a diff, or a feature. Use when asked to audit, check for vulnerabilities, review auth, input handling, secrets, dependencies, or before shipping code that touches user input, authentication, payments, files, or external services. Reports findings; does not edit code.
---

# Security audit

Review for vulnerabilities and report. Do not modify code unless asked. Verify each issue by reading the code path before reporting it; don't flag guesses. Run it in the read-only `reviewer` agent for a fresh context.

## Scope first

Identify what is in scope (the diff, the files named, or the feature) and its trust boundaries: where data enters from users, the network, files, environment, or third parties, and where it reaches a database, shell, file system, template, or another service.

## Checklist

1. **Injection.** SQL/NoSQL built from strings, shell commands with user input, template or HTML output without escaping (XSS), unsafe `eval`/deserialization, path traversal in file access, SSRF in server-side URL fetches.
2. **Authentication and sessions.** Missing auth on routes, weak or hand-rolled password handling, session or token handling (expiry, storage, rotation), CSRF on state-changing requests, cookie flags.
3. **Authorization.** Checks that happen on the client only, missing ownership checks (IDOR: can user A read or change user B's record by changing an id), role checks missing on admin paths, mass assignment.
4. **Secrets and data exposure.** Keys, tokens, or passwords in code, config, logs, error messages, or client bundles; sensitive data in URLs; overly verbose errors; PII logged or returned in API responses.
5. **Input validation at trust boundaries.** Missing validation of type, length, range, and format; file uploads (type, size, storage location, execution); open redirects.
6. **Crypto.** Home-grown crypto, weak hashes for passwords, hardcoded keys or IVs, insecure randomness for tokens, disabled TLS verification.
7. **Dependencies and config.** Known-vulnerable or unpinned dependencies (use the project's audit command if it has one), debug mode on, permissive CORS, missing security headers, overly broad permissions.
8. **Denial of service and abuse.** Unbounded loops or payload sizes, missing rate limits on login or expensive endpoints, regex with catastrophic backtracking.

## Report

- **Verdict:** one line.
- **Findings,** most severe first. Each: severity (critical/high/medium/low), `file_path:line`, the vulnerability, how it could be exploited in one or two sentences, and the fix. Mark anything you couldn't confirm as "unverified".
- **Not checked:** what was out of scope or couldn't be verified (dependencies not audited, runtime config not seen).

Describe the class of problem and the fix. Don't write working exploit code.
