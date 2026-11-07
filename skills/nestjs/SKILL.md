---
name: nestjs
description: Build, review and debug NestJS backends. Covers project structure, modules and dependency injection, controllers and the request pipeline (middleware, guards, interceptors, pipes, exception filters), DTO validation, config, persistence and transactions, Better Auth, testing, health checks, graceful shutdown, and the differences between Nest 10, 11 and 12. Use whenever the repo depends on @nestjs/core, when adding or changing a module, controller, provider, guard, pipe, interceptor or filter, when "Nest can't resolve dependencies" appears, or when reviewing NestJS code. Security checks are in the security-audit skill's NestJS checklist.
---

# NestJS

Working practice for NestJS backends. Follow the project's own conventions first; this skill fills the gaps. Written for this plugin from the official docs and the most-starred community NestJS skills (see the credits in the README). Detail lives in `references/`:

- [architecture.md](references/architecture.md): layering, DI tokens, dynamic modules, circular dependencies
- [versions.md](references/versions.md): what changed in Nest 10, 11 and 12
- [troubleshooting.md](references/troubleshooting.md): the errors you will actually hit
- [review-checklist.md](references/review-checklist.md): a checklist for reviewing NestJS changes

## 1. Detect before you write

Read `package.json` and the config before suggesting anything:
- **Nest version** (`@nestjs/core`). 12 needs Node 20.19+ or 22.12+ and ships ESM; 11 made Express 5 the default and reversed the order of termination hooks; behavior differs (see versions.md). Don't paste 10-era snippets into a 12 project.
- **Platform adapter** (Express or Fastify), **ORM** (Prisma, TypeORM, Drizzle, Mongoose), **test runner** (Jest or Vitest), **module format** (CommonJS or ESM), **validation** (class-validator, or Standard Schema such as Zod on 12), **auth** (Better Auth via `@thallesp/nestjs-better-auth`, or Passport), **monorepo** (`nest-cli.json`, `apps/`, `libs/`).
- **archlast-forge project** (`archlast-forge.json`): its skill, `archlast-forge:archlast-forge`, wins over this one wherever they differ (Nest imports come from `@archlast/forge-runtime/nest`; its blueprint and built-ins replace custom code).
- The nearest existing module is the pattern to copy. Match its file layout, naming, DTO style and test style.

## 2. Structure

```
src/
  main.ts            bootstrap only; the app setup lives in one function reused by tests
  app.module.ts
  common/            cross-cutting filters, guards, interceptors, pipes, decorators
  config/            typed config namespaces and env validation
  modules/<feature>/ <feature>.module.ts, controller, service, dto/, entities or schema, guards/ if module-local
```

Domain code stays in its feature module. Only genuinely shared things go in `common/`. DTOs live with the module that owns them.

## 3. Layers and injection (rules)

- **Controllers are thin:** parse and validate HTTP input, call one provider, return a response DTO. No business logic, no ORM calls, no multi-step writes.
- **Services own the business rules and the unit of work** (the transaction). Persistence sits behind a provider (repository or the ORM client wrapped), and repositories do not inject each other: composition happens in a service.
- **A provider with more than about 8 dependencies is doing too much.** Split by responsibility.
- Constructor injection by class. For interfaces or ports use an injection token (`Symbol` or string) with `@Inject(TOKEN)` and `{ provide: TOKEN, useClass | useFactory | useValue }`. Never `new SomeService()` in application code.
- **Modules:** export only what other modules need; import modules, not other modules' providers. `@Global()` only for config or logging-like infrastructure. Shared code that two modules want is a third module, not a `forwardRef` (a last resort that usually hides a design problem).
- **Scopes:** default singleton. A request-scoped provider makes everything that injects it request-scoped too, which costs performance. For per-request context (current user, tenant, correlation id) prefer `AsyncLocalStorage` (for example `nestjs-cls`) over request scope.
- More patterns (dynamic modules, port tokens, breaking cycles): [references/architecture.md](references/architecture.md).

## 4. The request pipeline: what goes where

Order: **middleware, guards, interceptors (before), pipes, handler, interceptors (after), exception filters** (on a throw).

| Piece | Use it for | Not for |
|---|---|---|
| Middleware | raw request work: correlation id, logging, body limits | anything needing the route's metadata |
| Guard | allow or deny (authentication, roles), using `Reflector` metadata | business rules, loading and mutating data |
| Interceptor | cross-cutting around the handler: timing, caching, response mapping, serialization | business logic |
| Pipe | validate and transform one argument (`ParseUUIDPipe`, `ValidationPipe`) | authorization |
| Exception filter | turn errors into one consistent response and log the unexpected ones | swallowing errors |

Register globals as providers (`{ provide: APP_GUARD, useClass: AuthGuard }`, same for `APP_PIPE`, `APP_INTERCEPTOR`, `APP_FILTER`) so they can inject dependencies; `app.useGlobalGuards(new X())` cannot. Custom metadata: `Reflector.createDecorator()` or `SetMetadata`, read with `Reflector.getAllAndOverride`. Custom parameter decorators: `createParamDecorator`.

## 5. DTOs and validation

- One global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. Set it in the shared app-setup function so tests use the same one.
- `enableImplicitConversion` turns the string `"false"` into `true` for boolean fields; convert booleans explicitly with `@Transform` or `@Type`.
- A nested object needs `@ValidateNested()` **and** `@Type(() => Nested)`, or it is not validated. Arrays: `@ValidateNested({ each: true })`.
- Request bodies are classes (interfaces vanish at runtime). Never `@Body() body: any`. Separate Create and Update DTOs; derive with `PartialType`, `PickType`, `OmitType` (from `@nestjs/mapped-types` or `@nestjs/swagger`).
- Validate path and query params: `ParseUUIDPipe`, `ParseIntPipe`, `ParseEnumPipe`.
- Responses: dedicated response DTOs, or `ClassSerializerInterceptor` with `@Exclude()` / `@Expose()`. Never return an ORM entity that carries password hashes, tokens or audit columns.
- On Nest 12 you can validate with any Standard Schema library (`schema` option on `@Body()` and friends, or `StandardSchemaValidationPipe`). Pick one validation approach per project.

## 6. Errors

- Throw `HttpException` subclasses for expected client errors (`BadRequestException`, `NotFoundException`, `ConflictException`). Keep the domain layer free of HTTP: throw domain errors and map them in an exception filter.
- One error envelope across the API. Log and wrap the unexpected centrally; don't leak stack traces or driver messages.
- Never `catch {}` and carry on, and never return `null` for a failure the caller needs to know about.

## 7. Config

`ConfigModule.forRoot({ isGlobal: true, load: [...], validate })` and **fail at boot** on a bad environment, not on the first request. Use `registerAs` namespaces and inject typed config (`ConfigType<typeof appConfig>`); `ConfigService.getOrThrow` for required values. No `process.env` reads in feature code. Use `forRootAsync` when one module's options depend on another's config.

## 8. Persistence

The service owns the transaction (Prisma `$transaction`, TypeORM `DataSource.transaction` or a `QueryRunner`, Drizzle `db.transaction`). Pass the transaction handle down explicitly, or carry it with `AsyncLocalStorage`. Multi-step writes never live in a controller. Migrations are versioned files, never auto-sync in production. Close connections in `onModuleDestroy`. Page large lists (cursor pagination) and look for N+1 queries.

## 9. Auth with Better Auth

With `@thallesp/nestjs-better-auth` (community package, needs `better-auth` 1.5 or newer):
- Create the app with `bodyParser: false`; the module re-adds body parsers for non-auth routes. `rawBody: true` on `NestFactory.create` then has no effect: set `bodyParser.rawBody` in `AuthModule.forRoot()` (webhooks need it).
- `AuthModule.forRoot({ auth })` registers a **global `AuthGuard`, so every route is protected by default**. Opt out with `@AllowAnonymous()`, make it optional with `@OptionalAuth()`. Read the session with `@Session()`.
- Roles: `@Roles()` checks only the system-level `user.role` (admin plugin); `@OrgRoles()` and `@RequireActiveOrg()` are the organization-level ones. They are separate on purpose; don't use `@Roles()` for org permissions.
- Guards give the coarse yes or no. Ownership checks ("is this order the caller's?") belong in the service. See the `security-audit` skill's NestJS and Better Auth checklists. With Passport instead: keep strategies and guards module-local.

## 10. Testing

- **Unit:** `Test.createTestingModule({ providers: [Service, { provide: Dep, useValue: mock }] })`, or `useMocker`. Business rules in plain classes can be tested with `new`, without Nest.
- **Integration and e2e:** import the real module, `overrideProvider` for external systems, apply the same global pipes, filters and guards as production (call the shared `configureApp(app)`), drive it with supertest, and `await app.close()` in `afterAll`. Scoped providers: `moduleRef.resolve()`, not `get()`.
- Test every guard by request: unauthenticated, wrong role, another user's resource.
- Runner on 12: ESM projects default to Vitest, CommonJS to Jest. Jest loads the ESM-only v12 packages only on Node 24.9 or newer; older Node gives `ERR_REQUIRE_ASYNC_MODULE`.
- Use the project's runner and conventions; the `test-driven-development` skill's loop applies.

## 11. Production

- `NestFactory.create(AppModule, { bufferLogs: true })`, `app.enableShutdownHooks()`, explicit `enableCors`, `helmet`, compression, `setGlobalPrefix`, and `enableVersioning` if the API is versioned.
- **Health:** `@nestjs/terminus` with separate liveness and readiness. On 12 the legacy `HealthIndicator` API is removed: use `HealthIndicatorService` (`check(key)`, then `up()`, `down()` or `attempt()`).
- **Lifecycle:** `OnModuleInit`, `OnApplicationBootstrap`, `OnModuleDestroy`, `BeforeApplicationShutdown`, `OnApplicationShutdown`. On 12 hooks run by hierarchy level, so don't depend on cross-module ordering. Express now drains in-flight requests on shutdown.
- **Logging:** structured, with a correlation id; on 12 `ConsoleLogger` attaches object params to the entry (`structuredParams`, `flattenParams`).
- **Background work:** `@nestjs/schedule` crons run on every instance unless you guard them (single runner or a lock); queues with `@nestjs/bullmq`. Consumers live in their own modules, never in an HTTP controller.
- **Rate limiting:** `@nestjs/throttler` (v6 takes `throttlers: [{ ttl, limit }]`, ttl in milliseconds); behind a proxy configure the tracker and trust proxy so users are not all one IP.
- Caching with `@nestjs/cache-manager`; Swagger with `@nestjs/swagger` and its CLI plugin, with the DTO classes as the source of truth.

## 12. Before you say it is done

`tsc --noEmit`, the linter, unit and e2e tests that touch the changed module, and a request-level test for any new guard, pipe or filter. Run `ctx impact` on the module: other modules that import it are where a changed export breaks. Then the `verification-before-completion` skill. For a review, use [references/review-checklist.md](references/review-checklist.md) with `/agents-kit:code-review`.
