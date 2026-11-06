# Exclusions and precedents

Do not report these unless the user explicitly asks for them or the impact is concrete and severe. Adapted and reworded from the false-positive filtering rules in Anthropic's claude-code-security-review (MIT).

## Do not report

1. Denial of service, resource exhaustion, memory or CPU exhaustion, and regex denial of service.
2. Rate-limiting gaps.
3. Secrets stored on disk that are otherwise protected.
4. Missing validation on non-security-critical fields with no proven security impact.
5. Missing hardening or best practices. Only concrete vulnerabilities count.
6. Race conditions and timing attacks that are theoretical. Report only if concretely exploitable.
7. Outdated third-party dependencies (tracked separately), unless asked.
8. Memory-safety issues (buffer overflow, use after free) in memory-safe languages such as Rust, Go, Java, Python.
9. Files that are only tests or only used to run tests.
10. Log spoofing from unsanitized user input in logs.
11. SSRF that controls only the path. It matters only if the attacker controls the host or protocol.
12. User-controlled content in AI prompts, and regex injection.
13. Findings in documentation files such as Markdown.
14. Missing audit logs.
15. Resource leaks (memory, file descriptors).

## Precedents

- Logging secrets, passwords, or PII in plaintext is a vulnerability. Logging URLs and non-sensitive data is not.
- UUIDs can be treated as unguessable.
- Environment variables and CLI flags are trusted. An attack that needs control of them is not valid in a secure environment.
- Low-impact web issues (tabnabbing, XS-Leaks, prototype pollution, open redirects) only with very high confidence.
- React and Angular escape output by default. Report XSS there only for explicit escape hatches (`dangerouslySetInnerHTML`, `bypassSecurityTrustHtml`, and similar).
- Missing auth or permission checks in client-side code are not vulnerabilities. The server must enforce them; review the server.
- CI/workflow and notebook issues are rarely exploitable. Report only with a concrete attack path from untrusted input.
- Command injection in shell scripts is rarely reachable from untrusted input. Report only with a concrete path.

## Signal check for what remains

Is there a concrete attack path? A real risk and not just a best practice? Exact code locations? Would a security team act on it? If any answer is no, drop it or move it to "Needs a human look".
