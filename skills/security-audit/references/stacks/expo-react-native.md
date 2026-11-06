# React Native and Expo

Audit checklist for mobile apps, from the React Native and Expo security docs and OWASP MASVS themes. The app binary is untrusted: anyone can unpack the bundle and read it. Server-side checks matter more than client-side ones.

## Secrets in the bundle
- **Never ship secrets.** Anything in JS, `app.json`/`app.config.*` `extra`, `.env` files bundled via `react-native-config`/`react-native-dotenv`, and every `EXPO_PUBLIC_*` variable is readable in plain text from the app. Flag private API keys, service credentials, signing keys, database URLs with passwords, and third-party secret keys. Fix: a backend that holds the key and makes the call.
- Public identifiers (Google Maps SDK keys with restrictions, Sentry DSN, Firebase config) are acceptable when restricted by app/bundle id or server rules. Check those restrictions exist when the key is billable.

## Token and data storage
- Tokens, refresh tokens, session cookies, passwords, PII: `expo-secure-store` (Keychain / Android Keystore) or `react-native-keychain`. **Not** AsyncStorage, MMKV without encryption, SQLite, Redux-persist of whole state, or files. AsyncStorage is unencrypted and readable on rooted or backed-up devices.
- SecureStore options: iOS `keychainAccessible` should not be the deprecated `ALWAYS`; use `WHEN_UNLOCKED` or stricter. `*_THIS_DEVICE_ONLY` entries don't migrate on backup restore. `requireAuthentication` for high-value items (biometrics; entries invalidate on biometric change, so handle null). SecureStore is not a source of truth for irreplaceable data.
- Android backup: with a custom backup config, SecureStore and sensitive prefs must be excluded (`allowBackup`, `dataExtractionRules`).
- Persisted state: don't persist whole state trees containing sensitive forms. Clear secrets on logout. Don't copy tokens or PII to analytics, crash reporters (Sentry, Crashlytics breadcrumbs), or logs (`console.log` in release builds).
- Clipboard, screenshots, and app-switcher previews for sensitive screens (`FLAG_SECURE`, blur on background) when the data warrants it.

## Authentication
- OAuth: authorization code flow with **PKCE** (`expo-auth-session`, `react-native-app-auth`), system browser (`expo-web-browser` / ASWebAuthenticationSession / Custom Tabs), not an embedded WebView and not the implicit flow. Don't put client secrets in the app.
- Better Auth on Expo: see better-auth.md (SecureStore storage, `trustedOrigins` with the app scheme, no `exp://` wildcards in production).
- Biometrics (`expo-local-authentication`) are a UX gate, not authentication. They must protect a server-verifiable credential or a SecureStore entry, not just flip a boolean in JS.
- Authorization is the server's job. Client checks (hidden screens, `if (user.isAdmin)`) are not controls; not a finding by themselves, but flag any API that relies on them.

## Deep links and navigation
- Custom URL schemes (`myapp://`) can be claimed by any other app. Never carry tokens, codes, or secrets in them without PKCE. Prefer universal links (iOS) and verified app links (Android) for sensitive flows.
- Treat deep-link parameters as untrusted input: validate before navigating, fetching, or performing actions (`expo-router` params, `Linking.addEventListener`). Check for actions triggered directly by a link (delete, pay, change email) with no confirmation.
- Android: exported activities, intent filters, and `autoVerify`. iOS: Associated Domains file served correctly.

## Network
- HTTPS only. Flag `usesCleartextTraffic`, `NSAllowsArbitraryLoads`, `http://` endpoints, and disabled certificate checks. `app.json` `ios.infoPlist` ATS exceptions and Android `networkSecurityConfig` that trust user CAs in production.
- Certificate pinning for high-risk apps (finance, health): plan for certificate rotation, or the app breaks.
- WebViews (`react-native-webview`): `originWhitelist` restricted, `javaScriptEnabled` only if needed, no `allowFileAccess`/universal access, don't expose native bridges (`onMessage`, injected JS) to untrusted pages, validate `postMessage` origin. Loading user-provided or remote HTML is XSS with native reach.

## Updates and build
- OTA updates (EAS Update / `expo-updates`): code signing enabled for sensitive apps; the update channel and runtime version are controlled; the EAS access token and signing keys are not in the repo.
- Release builds: no dev menu, no debug flags, source maps not shipped publicly with secrets, `__DEV__`-gated logging removed. Hermes bytecode is not obfuscation.
- Native modules and config plugins: unmaintained or typosquatted npm packages, `postinstall` scripts, and `npm audit`.
- Root/jailbreak and tamper detection are defense in depth, not a replacement for server-side controls. Don't report their absence unless the app's threat model requires it.
