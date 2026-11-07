# NestJS troubleshooting

Rewritten for this plugin. The cases come from the official docs and from the recurring failures catalogued in the community NestJS skills. Reproduce first (the `systematic-debugging` skill), then use this to find where to look.

## "Nest can't resolve dependencies of the X (?, +)"

The message names the provider (X) and marks the failing constructor parameter with `?`. Check, in order:
1. **Is the dependency registered as a provider** in a module that X's module can see? Add it to `providers` (and `exports` if another module consumes it).
2. **Is its module imported** by X's module, and does that module **export** the provider? Importing a module only gives you what it exports.
3. **Is the parameter an interface or type?** Those do not exist at runtime. Use an injection token with `@Inject(TOKEN)`.
4. **Is the class missing `@Injectable()`**, or is the parameter a primitive or an unregistered config value?
5. **Is it a file import cycle?** If the `?` is the first parameter and both files import each other, the class was `undefined` when decorated. Break the cycle (see architecture.md), or `@Inject(forwardRef(() => Dep))`.
6. **A `@Global()` module that is not imported anywhere**, or a custom provider token that is spelled differently in the two places.
7. **In a test:** the testing module only has what you list. Add the provider or a mock (`{ provide: Dep, useValue: {} }`), or use `useMocker`. For a repository, provide the ORM's token (for example `getRepositoryToken(Entity)` with TypeORM).
8. **A subclass on Nest 12:** the parent's `@Optional()` markers are not inherited by a subclass that has its own constructor. Redeclare them.

## Circular dependency

See architecture.md. Two kinds: a file import cycle (shows up as `undefined` and the `?` above) and a provider cycle (Nest says it cannot create the module instance or that there is a circular dependency). Extract a shared module or use an event; `forwardRef` last.

## e2e test cannot resolve dependencies

Importing a feature module in the test imports only that module's tree. Providers that production gets from a global module or from `AppModule` (config, database, auth guard) are missing. Either import the same global modules, or `overrideProvider` / `overrideModule` them. Apply the same global pipes, filters and guards as `main.ts`, or tests pass while production behaves differently.

## `Unknown authentication strategy "jwt"`

The Passport strategy class is not registered as a provider in a module that is loaded, or `PassportModule` is not imported where the guard is used. Add the strategy to `providers` and make sure its module is imported. The strategy name given to `PassportStrategy(Strategy, 'jwt')` must match `AuthGuard('jwt')`.

## `secretOrPrivateKey must have a value` (JWT)

`JwtModule.register({ secret: process.env.JWT_SECRET })` ran before the environment was loaded. Use `JwtModule.registerAsync` with `ConfigService`, and validate the variable at boot.

## 401 "Missing credentials" with passport-jwt

The extractor does not match how the client sends the token (`ExtractJwt.fromAuthHeaderAsBearerToken()` needs `Authorization: Bearer <token>`), the secret or algorithm differs between sign and verify, the token expired, or the guard runs before the one that sets the request user. With Better Auth there is no Passport: the global `AuthGuard` reads the session cookie or bearer token, and `bodyParser: false` must be set on `NestFactory.create`.

## A module "exports itself" and consumers still cannot inject

Export the **provider**, not the module class: `exports: [UsersService]`. (Re-exporting an imported module, `exports: [OtherModule]`, is the way to pass its providers through.)

## Database will not connect at boot

`TypeOrmModule.forRoot({ host: process.env.DB_HOST })` evaluated before config loaded. Use `forRootAsync` with `ConfigService`. A connection error that "crashes the app" is correct fail-fast behavior; add `retryAttempts` and `retryDelay` if the database starts after the app. Several databases need distinct connection names (or separate modules) and the matching `@InjectRepository(Entity, 'name')`.

## Memory grows in production

Look for: request-scoped providers holding large objects; listeners added per request and never removed (event emitters, RxJS subscriptions without `takeUntil`); unbounded in-memory caches or maps keyed by user; a global array of promises; large payloads buffered instead of streamed. Take a heap snapshot under load before guessing.

## After upgrading to Nest 11

- **Wildcards:** a bare `*` is auto-converted, but if a route or middleware does not match as before, write the named form (`*splat`, `forRoutes('{*splat}')`); `?` in a path is no longer valid (use braces).
- **Nested query parameters arrive flat:** Express 5's default parser is "simple". `app.set('query parser', 'extended')`.
- **Shutdown or cleanup runs in a new order:** termination hooks now run in reverse of init. Middleware from global modules runs first.
- **`Reflector.getAllAndOverride` can be `undefined`; `getAllAndMerge` returns an object for a single entry:** fix the call sites.
- **Cache returns `{ value, expires }` objects or the store option errors:** move to Keyv stores and update code that reads raw entries.
- **Environment variables seem ignored (`@nestjs/config` 4):** internal config now wins over `process.env`; see `validatePredefined` and `skipProcessEnv`.
- **Fastify rejects a PUT or PATCH from the browser:** only CORS-safelisted methods are allowed by default; set `methods`.

## After upgrading to Nest 12

- `ERR_REQUIRE_ASYNC_MODULE` in Jest: use Node 24.9+, or move to Vitest.
- `UnknownDependenciesException` in a subclass: redeclare `@Optional()`.
- Health endpoint always healthy, or the app will not compile: the legacy `HealthIndicator` and `HealthCheckError` path is gone; move to `HealthIndicatorService`.
- Startup or shutdown steps run in a different order: remove cross-module ordering assumptions.
- Peer dependency conflicts: `npm update ts-jest typescript-eslint`, and install `typescript@^6` with `@nestjs/schematics@12`.
