# Better Auth

Audit checklist for apps using [Better Auth](https://www.better-auth.com). Based on its security reference, rate-limit, Expo and NestJS docs. Report only what is concrete in the code under review.

## Secrets and config
- `BETTER_AUTH_SECRET` must be set from the environment, long and random, and never committed or defaulted in code. A missing or weak secret breaks session and state encryption. For rotation use `secrets` / `BETTER_AUTH_SECRETS`.
- `baseURL` should be a static HTTPS URL in production. Cookies are `secure` by default only when `baseURL` is HTTPS.

## Origins and CSRF (highest-value checks)
- `trustedOrigins` must be exact origins. Flag `localhost`, `http://` origins, broad wildcards, and `exp://**`-style patterns reachable in production. Dev-only origins belong behind a `NODE_ENV === "development"` check.
- `advanced.disableCSRFCheck: true` or `advanced.disableOriginCheck: true`: high severity. Either lets cross-origin requests act as the logged-in user; `disableOriginCheck` also turns off callback/redirect URL validation (open redirects).
- Custom routes that call `auth.api.*` skip the handler's origin and callback checks. Look for cookie-authenticated, state-changing custom routes that don't validate `Origin` (for example with `(await auth.$context).isTrustedOrigin(origin)`), and for `callbackURL`, `errorCallbackURL`, `newUserCallbackURL`, or `redirectTo` taken from the request without validation.
- A `trustedOrigins` function runs on every request. Origins it derives from request data must also be honored in any custom origin check.
- GET handlers that mutate state.

## Proxies and IP
- `advanced.trustedProxyHeaders: true` derives the base URL from `X-Forwarded-Host/Proto`. Safe only if the proxy overwrites those headers and users can't set them; otherwise forged headers poison redirects and callbacks.
- Rate limiting reads the client IP from `X-Forwarded-For` by default, which is forgeable when the server is reachable directly. The proxy must overwrite it, or set `advanced.ipAddress.ipAddressHeaders` to one proxy-set header and list `trustedProxies`. With `ipAddressHeaders: []` and direct connections, every client shares one counter.

## Rate limiting
- Disabled in development by default; confirm `rateLimit.enabled` is true (or defaulted on) in production.
- Default storage is in memory: per-process, lost on restart, useless on serverless or multiple instances. Expect `storage: "database"`, `"secondary-storage"`, or an atomic `customStorage.consume`.
- `customRules` set to `false` for sign-in, password reset, 2FA, or OTP paths; limits looser than the built-in strict ones (sign-in is 3 per 10 s).
- Server-side `auth.api` calls are not rate limited. A custom public endpoint that wraps them needs its own limit.

## Sessions and cookies
- Defaults are good: encrypted, `httpOnly`, `SameSite=Lax`, 7-day expiry. Flag overrides in `advanced.defaultCookieAttributes` that weaken them (`sameSite: "none"` without need, `secure: false`, `httpOnly: false`).
- `crossSubDomainCookies` shares sessions across subdomains. Flag it unless every subdomain is equally trusted (a takeover of one subdomain compromises the session).
- Authorization decisions must use the server session (`auth.api.getSession`), not a client-supplied user id or role. Check every protected route and server action actually calls it.
- Sensitive actions (change email, password, delete account) should require a fresh session or re-verification.

## Credentials and flows
- Passwords: scrypt by default. A custom `password.hash`/`verify` must use a slow, salted algorithm. Check password length limits exist.
- Email: `requireEmailVerification` and a consistent response for existing vs new emails limit enumeration. Flag custom endpoints that reveal whether an email exists.
- OAuth: leave state and PKCE checks on. Account linking should trust only verified emails from the provider; flag settings that link unverified provider emails (account pre-hijacking).
- Plugins (2FA, passkey, magic link, OTP, API keys, organization, admin): confirm tokens are short-lived and single-use, OTPs are rate limited, API keys are hashed and revocable, and organization/admin routes check role and membership server-side (IDOR across orgs).
- `hooks` and `databaseHooks` that trust request input for roles, `emailVerified`, or user id on create/update (mass assignment). User `additionalFields` that are writable by the user but should not be (for example `role`, `isAdmin`: set `input: false`).

## With Expo / React Native
- `expoClient({ storage: SecureStore })`: tokens and cookies belong in SecureStore, never AsyncStorage.
- App scheme in `trustedOrigins` (`myapp://`), separate schemes per environment. `exp://` wildcards in dev only.
- `idToken` sign-in is limited to google, apple, facebook; the server verifies the token.

## With NestJS
- Set `bodyParser: false` in `NestFactory.create()` so Better Auth reads the raw body, then re-add body parsing for your own routes. With the community `@thallesp/nestjs-better-auth` module the `AuthGuard` is global (routes protected by default). Flag `@AllowAnonymous()` / `@OptionalAuth()` on routes that read or write account data, and routes that do `@OptionalAuth()` then assume a user exists.
- Authorize with the session user (`@Session()`), not ids from the body or query.
