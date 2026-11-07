# NestJS

In an archlast-forge project (`archlast-forge.json`) the engine supplies security headers, the WAF and request validation, and `agents-kit:archlast-forge` says which are built in: do not report their absence as findings, and do not suggest adding helmet, a custom validation pipe or auth wrappers; review what the project adds on top. This is the security checklist. For how to build, structure, test and debug NestJS code, and for what changed in Nest 11 and 12, use the `agents-kit:nestjs` skill; its review checklist covers non-security review.

Audit checklist for NestJS backends, from the NestJS security docs (authentication, helmet, CORS, CSRF, rate limiting) plus common Nest pitfalls. Newer Nest versions (12.1+) add built-ins such as `app.useSecurityHeaders()` and `app.enableCsrfProtection()`; older ones use `helmet`, `csurf` alternatives, and `@nestjs/throttler`. Check which version the project is on.

## Authentication and guards
- Every route needs a decision. Prefer a global guard (`APP_GUARD`) with an explicit public marker (`@Public()`), so a forgotten decorator fails closed. Flag controllers with no guard where the rest are guarded, and `@Public()` on routes that touch account data.
- Guards must check **authorization**, not just authentication: role or ownership checked against the resource (`@Roles()` + `RolesGuard`, or a policy check in the service). IDOR is the most common Nest bug: `findOne(id)` with no `userId` / tenant filter.
- Guards, middleware, and filters run outside handler scope; don't assume request-scoped context exists there.
- JWT: `JwtModule` needs a strong secret from config (not a literal or fallback like `'secret'`), `expiresIn` set, and verification pinned to the expected algorithm, issuer, and audience. Don't use `decode()` where `verify()` is required. Short access-token TTL; refresh tokens stored hashed, rotated, revocable. Don't put roles in long-lived tokens when they need to be revocable.
- Passwords: bcrypt/argon2/scrypt with a cost factor; never `md5`/`sha*` plain; never returned from the API. `ClassSerializerInterceptor` with `@Exclude()` or explicit response DTOs, or the entity leaks `password`, tokens, and internal fields.
- Login and reset endpoints should return the same response whether or not the account exists, and compare in constant time (`crypto.timingSafeEqual`).
- WebSocket gateways and microservice transports need their own auth (HTTP guards don't cover them by default): check `handleConnection`, `@UseGuards` on gateways, and the origin on handshakes.

## Validation and mass assignment
- Bind `ValidationPipe` globally with `whitelist: true` and `forbidNonWhitelisted: true` (and `transform: true` where needed). Without `whitelist`, extra properties pass through and can set `role`, `isAdmin`, `tenantId`.
- DTO classes use `class-validator` decorators. Interfaces and untyped `@Body() body: any` get no validation at all. Validate params and queries too (`ParseUUIDPipe`, `ParseIntPipe`). Bound string lengths, array sizes, and pagination limits.
- Don't pass request objects straight to ORM `create`/`update`; map from a DTO.

## Injection
- TypeORM/Prisma/Knex raw queries: `query()`, `$queryRawUnsafe`, `QueryBuilder.where()` with a template string, `sequelize.literal`. Parameterize. Also check dynamic `orderBy`/column names from the query string (allowlist them).
- Mongo/Mongoose: operator injection through unvalidated objects (`{ "$ne": null }` in a login body). Validate types; strip `$` keys.
- `child_process`, `eval`, `new Function`, `vm`, dynamic `require`, `fs` paths built from input (path traversal), file uploads (Multer: size limits, mimetype is client-supplied, store outside web root, random names), `HttpService` calls to user-supplied URLs (SSRF to host/protocol).

## Headers, CORS, CSRF
- Security headers: `helmet()` (Express) or `@fastify/helmet`, registered before other middleware. Flag `contentSecurityPolicy: false` without reason, `'unsafe-inline'` in `script-src`, and GraphQL playground/Swagger CSP relaxations left on in production.
- CORS: `app.enableCors({ origin: [exact origins], credentials: true })`. Flag `origin: true`, `'*'` with credentials, reflecting the `Origin` header, or regexes that match more than intended (`/example.com$/` matches `evilexample.com`).
- CSRF: needed only when auth uses cookies. Cookie sessions require SameSite plus CSRF tokens or an Origin check on state-changing routes. Bearer-token APIs are not CSRF-exposed. `csurf` is deprecated; use maintained alternatives or the framework's built-in protection.
- Cookies: `httpOnly`, `secure`, `sameSite`; `trust proxy` set correctly behind a load balancer, or `req.ip` and `secure` cookies misbehave.

## Rate limiting and abuse
- `@nestjs/throttler` globally (`APP_GUARD`), stricter limits on login, signup, password reset, OTP, and expensive endpoints. Multi-instance deployments need shared storage (Redis); the default is in-memory per process. Behind a proxy the limiter must see the real client IP (`trust proxy`). Report missing limits on auth endpoints only (general DoS is excluded by default).

## Configuration and information disclosure
- Secrets come from `ConfigModule` / environment, validated at startup (`Joi`/`zod`); no `.env` in version control, no secrets in `main.ts` or entities.
- Production errors: don't return stack traces or ORM errors. Custom exception filters should not echo internals. `synchronize: true` (TypeORM) in production can alter or drop schema.
- Swagger/OpenAPI, GraphQL introspection and playground, health or metrics endpoints, and `/debug` routes exposed in production without auth.
- Logging: no tokens, passwords, or full request bodies in logs or APM.
- `@nestjs/serve-static` or custom static routes exposing source, `.env`, or uploads.

## Dependencies
- `npm audit`, lockfile committed, and no abandoned auth or crypto packages (`jsonwebtoken` old versions, `passport-*` unmaintained strategies).
