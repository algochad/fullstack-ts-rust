# NestJS review checklist

Rewritten for this plugin from the NestJS code-review guide in awesome-skills/code-review-skill (MIT) and the official docs. Use it with `/agents-kit:code-review`: flag only what you can show is wrong, not preferences. Security findings follow the `security-audit` skill's NestJS checklist.

## Layering
- [ ] Controllers only parse input, call a provider and return a DTO (no business logic, no ORM or SQL, no multi-step writes).
- [ ] Business rules and transactions are in services; persistence is behind a provider.
- [ ] Repositories do not inject other repositories; a service with more than about 8 dependencies is split.
- [ ] No ORM entity is returned from an endpoint; no password hash, token or audit column in a response.

## Dependency injection and modules
- [ ] Interfaces are injected through tokens with `@Inject(TOKEN)`.
- [ ] A module exports only what others need, and imports modules rather than their providers.
- [ ] No `forwardRef` unless the cycle was considered and cannot be removed; no `@Global()` for feature code.
- [ ] No request-scoped provider where `AsyncLocalStorage` would do; nothing instantiated with `new` that should be injected.
- [ ] Dynamic modules read config through `forRootAsync`, not `process.env` at import time.

## Validation
- [ ] A global `ValidationPipe` with `whitelist` and `forbidNonWhitelisted` (or the Standard Schema pipe on Nest 12), shared by tests.
- [ ] Body, query and params are validated; params use `Parse*Pipe`; no `@Body() x: any` or interface body.
- [ ] Nested objects have `@ValidateNested()` and `@Type()`; Create and Update DTOs are separate.
- [ ] Booleans from query strings are converted explicitly (implicit conversion makes `"false"` truthy).

## Guards, interceptors, pipes, filters
- [ ] Guards decide allow or deny only; ownership and business rules are in services.
- [ ] Interceptors are cross-cutting only; global ones are registered through `APP_*` providers when they need injection.
- [ ] Exception filters give one error shape; unexpected errors are logged and not leaked.
- [ ] A new public route has an explicit authentication decision (with Better Auth every route is protected unless `@AllowAnonymous()`).

## Errors
- [ ] No empty `catch` and no swallowed rejection; no `null` returned for a failure the caller must handle.
- [ ] Expected client errors use `HttpException` subclasses; the domain layer does not import HTTP.

## Config and lifecycle
- [ ] Environment is validated at boot; no `process.env` in feature code; no secrets in the repo.
- [ ] Connections and consumers close on shutdown (`enableShutdownHooks`, `onModuleDestroy`).
- [ ] Crons guard against running on every replica; queue jobs are idempotent.

## Testing
- [ ] New behavior has a unit test; new guards, pipes and filters have a request-level test (unauthenticated, wrong role, other user's resource, invalid input).
- [ ] e2e tests use the same global pipes, filters and guards as production and call `app.close()`.
- [ ] Mocks replace external systems only, not the code under test.

## Versions
- [ ] The code fits the project's Nest version (wildcards on 11+, Standard Schema and `HealthIndicatorService` on 12, hook-order assumptions on 12). See versions.md.
