# NestJS architecture patterns

Rewritten for this plugin. Ideas from the NestJS docs and the community guides listed in the README.

## Controller, service, repository

```ts
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto, @Session() session: UserSession) {
    return this.orders.create(session.user.id, dto);   // thin: parse, delegate, return
  }
}

@Injectable()
export class OrdersService {
  constructor(private readonly repo: OrdersRepository, private readonly stock: StockService) {}

  async create(userId: string, dto: CreateOrderDto) {
    // business rules and the transaction live here
    return this.repo.transaction(async (tx) => {
      await this.stock.reserve(dto.items, tx);
      return this.repo.insert({ userId, ...dto }, tx);
    });
  }
}
```

- A repository knows one aggregate's storage. **Repositories do not inject other repositories**; a service composes them. If a service needs six repositories, it is two services.
- **God service smell:** more than about 8 constructor dependencies, or methods that never touch the same fields. Split along the business capability, not along technical layers.
- Return response DTOs from services or map in the controller; don't let an ORM entity cross the HTTP boundary.

## Ports and adapters with injection tokens

When a service depends on something you may swap or fake (mail, payments, clock, storage), depend on an interface through a token:

```ts
export const MAILER = Symbol('MAILER');
export interface Mailer { send(to: string, subject: string, body: string): Promise<void> }

@Module({ providers: [{ provide: MAILER, useClass: SmtpMailer }], exports: [MAILER] })
export class MailModule {}

@Injectable()
export class SignupService {
  constructor(@Inject(MAILER) private readonly mailer: Mailer) {}
}
```

Tests then use `{ provide: MAILER, useValue: fakeMailer }`. An interface cannot be a DI token by itself (it does not exist at runtime): that is the "Nest can't resolve dependencies of X (?)" error when you forget `@Inject(TOKEN)`.

## Keeping the domain framework-free (optional, for larger apps)

Layers: `domain/` (entities, value objects, domain errors, no imports from `@nestjs/*`), `application/` (use cases, ports), `infrastructure/` (repositories, adapters), `presentation/` (controllers, DTOs, filters). Use cases are plain classes you can test with `new`. Don't add this ceremony to a small CRUD service; use it where the rules are rich enough to deserve being tested without a Nest container.

## Dynamic modules

For a reusable module with options, use `ConfigurableModuleBuilder` so `register`, `forRoot` and the async variants come for free and options are injectable:

```ts
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<AuditOptions>().setClassMethodName('forRoot').build();

@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule extends ConfigurableModuleClass {}

// consumer
AuditModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({ sink: config.getOrThrow('AUDIT_SINK') }),
});
```

Use `forRootAsync` (not `forRoot`) when the options come from config, so they are read after `ConfigModule` has loaded. Reading `process.env` at import time is the usual cause of "value is undefined only in some environments".

## Circular dependencies

Two kinds. A **file import cycle** (A.ts imports B.ts imports A.ts) gives `undefined` at decoration time and the error `Nest can't resolve dependencies of X (?)` with a `?` where the cycle is. A **provider cycle** (A injects B, B injects A) gives `Nest cannot create the module instance ... circular dependency`.

Fix order of preference:
1. Extract the shared piece into a third provider or module that both depend on.
2. Replace the direct call with an event (`@nestjs/event-emitter`) when one side only needs to notify.
3. Move the logic so the dependency points one way.
4. `forwardRef(() => B)` in the constructor with `@Inject(forwardRef(() => B))`, and on the module imports for module cycles. A last resort: it hides the cycle rather than removing it.

## Request-scoped providers

`@Injectable({ scope: Scope.REQUEST })` creates a new instance per request, and every provider that injects it becomes request-scoped (the scope bubbles up to the controller). That is slower and breaks singleton assumptions (caches, connections). For "who is the current user or tenant" use `AsyncLocalStorage` (for example `nestjs-cls`), which keeps providers singleton. If you must use request scope, keep the scoped surface tiny and resolve it with `moduleRef.resolve()` in tests.

## Events, queues and schedules

- Side effects that should not block the response (emails, webhooks, projections): an event or a queue job, not an `await` in the controller.
- `@nestjs/bullmq` for work that must survive a restart and be retried; give jobs idempotency keys.
- `@nestjs/schedule` runs on every instance. With more than one replica, guard the cron (a lock, or a single scheduler instance).
- Consumers and handlers live in their own module and call services; they are not controllers in disguise.
