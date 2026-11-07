# React versions: what changed

Rewritten for this plugin from react.dev (the React 19, 19.2 and 19.3 posts, the React 19 upgrade guide, the React Compiler docs, the December 2025 security posts and the hook references), the npm registry, and the Vite, Next.js, React Router, Vitest and MSW docs.

Verified on 2026-11-07: the latest `react` and `react-dom` were 19.3.1 (npm, published 2026-10-14) and `@types/react` 19.3.0. When the project's version is older than the code you are about to write, check here first. Anything marked "not verified" was not re-checked today.

## Releases

| Version | Date | Source |
|---|---|---|
| 18.0.0 | 2022-03-29 | npm, react.dev/versions |
| 18.3.1 | 2024-04-26 | npm |
| 19.0.0 | 2024-12-05 | npm, react.dev/blog |
| 19.1.0 | 2025-03-28 | npm, react.dev/versions (the 19.2 post says "June"; the registry and the changelog say March) |
| 19.2.0 | 2025-10-01 | npm, react.dev/blog |
| 19.3.0 | 2026-09-09 | npm, react.dev/blog |
| 19.3.1 | 2026-10-14 | npm (not itemized here) |

Older lines kept getting patches: on 2026-10-14 npm also published 19.0.9, 19.1.10 and 19.2.9.

## 18 (baseline, not re-fetched today)

`createRoot` and `hydrateRoot`, automatic batching, transitions (`startTransition`, `useTransition`, `useDeferredValue`), Suspense with streaming SSR, `useId`, `useSyncExternalStore`, and Strict Mode running effects setup, cleanup, setup in development. **18.3** (April 2024) matches 18.2 and adds warnings for the APIs that 19 removes; the upgrade guide recommends (does not require) installing it first.

## 19.0 (2024-12-05)

**Added:**
- **Actions:** functions that use async transitions manage pending state, errors, optimistic updates and forms. `useActionState(action, initialState)` (replaces the Canary `useFormState`), `useOptimistic`, `useFormStatus` (from `react-dom`, reads the parent `<form>`).
- `use(promise)` and `use(Context)`: callable conditionally, render only; promises created in render are not supported (the "uncached promise" warning).
- `<form action>` and `formAction` accept functions; uncontrolled forms reset after a successful action; `requestFormReset`.
- `ref` as a prop on function components (`forwardRef` "will be deprecated in a future release"); ref callbacks may return a cleanup; `<Context value>` replaces `<Context.Provider>` (which will be deprecated).
- `<title>`, `<meta>` and `<link>` hoisted to `<head>`; `<link rel="stylesheet" precedence>`; deduplicated async scripts; `preload`, `preinit`, `preconnect`, `prefetchDNS` from `react-dom`; full custom element support; `useDeferredValue(value, initialValue)`.
- `react-dom/static` (`prerender`), stable Server Components and Server Functions (`'use server'` marks Server Functions; there is no directive for Server Components), one hydration error with a diff instead of several warnings, root options `onCaughtError`, `onUncaughtError`, `onRecoverableError`.

**Removed or changed** (upgrade guide):

| Removed | Use instead |
|---|---|
| `propTypes`, and `defaultProps` on function components (propTypes is silently ignored; classes keep `defaultProps`) | TypeScript types, default parameters |
| legacy context (`contextTypes`, `getChildContext`) | `createContext` and `contextType` |
| string refs | ref callbacks |
| module-pattern factories, `React.createFactory` | functions returning JSX |
| `ReactDOM.render`, `hydrate`, `unmountComponentAtNode`, `findDOMNode` | `createRoot`, `hydrateRoot`, `root.unmount()`, DOM refs |
| `react-dom/test-utils` (only `act` moved) | `import { act } from 'react'` |
| `react-test-renderer/shallow`, and `react-test-renderer` is deprecated | `react-shallow-renderer`, Testing Library |
| UMD builds | an ESM CDN or a bundler |

**Behavior changes:** errors in render are no longer re-thrown (uncaught go to `window.reportError`, caught to `console.error`; customize with the root options). Strict Mode reuses `useMemo` and `useCallback` results from the first render and double-invokes ref callbacks on mount. A suspending component commits the nearest fallback immediately and then pre-warms its siblings. The **new JSX transform is required**.

**TypeScript:** `useRef` needs an argument (`useRef(undefined)`), `MutableRef` is deprecated, `ReactElement` props are `unknown` instead of `any`, the global `JSX` namespace is gone (`React.JSX`), a ref callback may return only a cleanup (use a block body), and don't pass the full reducer type to `useReducer`.

**Codemods:** `npx codemod@latest react/19/migration-recipe` (render, string refs, `act`, `useFormState`, prop types) and `npx types-react-codemod@latest preset-19 ./path-to-app` for the types.

## 19.1 (2025-03-28)

Not itemized here (not verified). Read the changelog on react.dev/versions.

## 19.2 (2025-10-01)

- **`<Activity mode="visible" | "hidden">`:** hidden keeps state, unmounts effects and defers updates. **`useEffectEvent`:** non-reactive logic called from an effect; not a dependency; only callable from effects of the same component or hook. **`cacheSignal`** (Server Components only).
- Performance Tracks ("Scheduler" and "Components") in Chrome DevTools profiles.
- Partial pre-rendering APIs (`resume`, `resumeToPipeableStream`, `resumeAndPrerender`, `resumeAndPrerenderToNodeStream`); SSR batches Suspense reveals; Web Streams for Node SSR (the docs still recommend Node streams there).
- `useId` prefix changed from `:r:` (19.0) and the 19.1 form to `_r_`, so ids are valid for `view-transition-name` and XML names: tests or CSS that matched the old format need updating.
- `eslint-plugin-react-hooks` 6 (below).

## 19.3 (2026-09-09)

- **`<ViewTransition>` is stable**, with `addTransitionType`; animations run only for transitions (including a Suspense reveal and `useDeferredValue`). **Fragment refs** (`ref` on `<Fragment>`). **`browser()`** from `react-dom` (used with `use`) opts a component out of server rendering through Suspense. **Trusted Types** support. `<Context>` can be rendered directly in Server Components when imported from a `'use client'` module.
- Other changes: transitions render independently of each other; Strict Mode double-invokes effects during hydration; `onReset` fires after a Server Action resets a form; a warning for incorrect conditional `use`; fixes for `useDeferredValue` sticking on an old value, `useEffectEvent` in `memo` and `forwardRef` components, and hidden `<Activity>`. The post lists no breaking changes or minimum versions.

## Security: Server Components advisories (Dec 2025)

- **CVE-2025-55182** (CVSS 10.0, unauthenticated remote code execution through how React decodes payloads sent to Server Function endpoints). Affected: `react-server-dom-webpack`, `-parcel` and `-turbopack` 19.0, 19.1.0, 19.1.1 and 19.2.0. Fixed in 19.0.1, 19.1.2 and 19.2.1.
- **CVE-2025-55184, CVE-2025-67779, CVE-2026-23864** (denial of service, high) and **CVE-2025-55183** (source code exposure, medium). The first fixes (19.0.3, 19.1.4, 19.2.3) were incomplete. Fixed in **19.0.4, 19.1.5 and 19.2.4**; anything at or above 19.3 is newer.
- Affected only if the app runs Server Components through a framework or bundler plugin that supports them (the posts name next, react-router, waku, @parcel/rsc, @vitejs/plugin-rsc and rwsdk). Hosting mitigations are temporary: upgrade. Apps with no server-side React are not affected.

## React Compiler

- **1.0 stable since 2025-10-07** (`babel-plugin-react-compiler` 1.0.0, still the only 1.x release on npm today). Works with React 17 and up; below 19 set `target` and add `react-compiler-runtime`. Install with `--save-exact` and pin unless the test coverage is strong, because later versions may memoize differently.
- Memoizes components and hooks only, not every function, and not across components. Guidance: new code relies on the compiler; existing `useMemo`, `useCallback` and `memo` stay (removing them can change output); keep a manual `useMemo` when a value is an effect dependency.
- `compilationMode`: `'infer'` (default, PascalCase components and `use`-prefixed hooks that create JSX or call hooks), `'annotation'` (only `"use memo"`, for incremental adoption), `'syntax'` (Flow only), `'all'` (not recommended). `"use no memo"` always opts a function out. Check the "Memo" badge in React DevTools.
- Setup: **Next.js 16** has `reactCompiler: true` (stable in 16.0.0, off by default, install the plugin; `compilationMode: 'annotation'` is supported). **Vite:** `@vitejs/plugin-react` 6 dropped its inline Babel option; use `@rolldown/plugin-babel` with `reactCompilerPreset()` from the plugin, or on plugin 5 the `babel.plugins` option. The Vite `react-compiler` and `react-compiler-ts` templates set it up. Babel setups must put the compiler plugin first.

## eslint-plugin-react-hooks

5.2 (flat config), 6.1 (2025-10-01: the `recommended` preset became flat config, `recommended-legacy` for eslintrc), **7.0 (2025-10-08): two presets, `recommended` and `recommended-latest`, with the compiler rules on by default**, 7.1 (2026-04-16: ESLint 10 support), 7.1.1 latest. Compiler rules include `set-state-in-effect`, `set-state-in-render`, `refs`, `purity`, `immutability`, `static-components`, `use-memo`, `preserve-manual-memoization` and `incompatible-library`. A violation makes the compiler skip that component, not fail the build.

## Tooling around React (verified 2026-11-07)

| Tool | Current | What matters |
|---|---|---|
| Vite | 8 (8.0 on 2026-03-12, 8.1 on 2026-06-23) | Rolldown replaces esbuild and Rollup; Node 20.19+ or 22.12+. `@vitejs/plugin-react` 6 (needs Vite 8) uses Oxc for React Refresh, no Babel inside; plugin 5 still works with Vite 8 |
| Next.js | 16 (npm 16.4.5) | Node 20.9+, TypeScript 5.1+, Turbopack default, `params`, `searchParams`, `cookies()` and `headers()` are async only, `middleware` is renamed `proxy`, `next lint` removed, App Router runs the React Canary with 19.2 features, `revalidateTag` takes a second argument |
| React Router | 8 (8.0.0 on 2026-06-17; npm 8.5.1) | Needs Node 22.22+, `react` and `react-dom` 19.2.7+, and Vite 7+ in framework mode; `react-router-dom` removed (import from `react-router` and `react-router/dom`); modes: declarative, data, framework |
| TanStack Query | 5 (npm 5.107.1) | Optimistic updates via `variables` or the cache (`onMutate`, rollback, `invalidateQueries`); minimum React version not verified |
| Testing Library | `@testing-library/react` 16.3.3 | Peer `@testing-library/dom` 10; React 18 or 19; `user-event` 14 |
| Vitest | 5 (npm 5.1.0) | Node 22.12+ and Vite 6.4+; `clearMocks` defaults to true; `vi.mock` must be top-level |
| MSW | 3 (npm 3.0.4) | Node 22.12+; `http` and `HttpResponse` from `msw/http`; `onUnhandledRequest` is now `onUnhandledFrame` |
| Playwright | 1.65 | Node 20+; runs headless by default |

## Left out

React 19.1 and 19.3.1 contents; TanStack Router and Start versions; Jest 30 and TypeScript 7 specifics (npm latest 30.5.2 and 7.0.2); the React Foundation move (announced 2026-02-24), which changes nothing for application code.
