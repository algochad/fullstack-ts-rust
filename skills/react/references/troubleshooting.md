# React troubleshooting

Rewritten for this plugin from react.dev (the hook and API references, the React 19 upgrade guide, You Might Not Need an Effect), the react-testing and react-patterns skills in affaan-m/ECC (MIT), and the migration notes of Vite, Next.js, React Router, Vitest and MSW. Reproduce first (the `systematic-debugging` skill), then use this to find where to look. Warning wording changes between versions, so match on the meaning.

## "Too many re-renders" or "Maximum update depth exceeded"

State is set during render (`onClick={setOpen(true)}` instead of `onClick={() => setOpen(true)}`), or an effect sets state that is its own dependency, or a dependency is a new object, array or function every render. Move the set into a handler, derive the value instead of storing it, or stabilize the dependency (move it into the effect, hoist it out of the component).

## "Cannot update a component while rendering a different component"

A render body (or an updater function) calls another component's setter or a parent callback. Move the call to an event handler or an effect, or lift the state.

## Hydration mismatch

The server HTML differs from the first client render. Causes, most common first: `Date`, `Math.random()`, locale or time zone in the output; `typeof window` or `localStorage` branches; invalid nesting (`div` inside `p`, `a` inside `a`); a browser extension injecting nodes; ids built by hand. Render the same thing on both sides and read browser-only values after mount (state set in an effect, or `use(browser())` on 19.3), use `useId` for ids, and use `suppressHydrationWarning` only on a leaf text node you know differs. React 19 skips unexpected `<head>` and `<body>` nodes inserted by third-party scripts.

## An effect runs twice in development

Strict Mode runs setup, cleanup, setup on mount (and on hydration since 19.3). If the second run breaks something, the cleanup is missing or the effect is doing a one-time job: add the cleanup, or move one-time work out of the effect. Do not remove Strict Mode.

## Stale value inside a timer, listener or async callback

The callback closed over an old render. Use the updater form (`setN(n => n + 1)`), list the value as a dependency, read the latest through a ref, or use `useEffectEvent` (19.2+) when the effect should not re-subscribe. Silencing `exhaustive-deps` is what creates this.

## Infinite fetch loop or a request on every render

An effect depends on a new object, array or function each render, or sets state that feeds its own dependencies. Move construction into the effect, depend on primitives, and move the fetch to a query library or loader.

## An input loses focus or resets on every keystroke

The component (or the input's wrapper) is defined inside another component, or its `key` changes each render (a random or index-based key). Define it at module level and use a stable key.

## State did not update

The object or array was mutated in place, so the reference is unchanged. Create a new one. If a later line reads the state right after setting it, it still sees the old value: use the new value you computed, or an updater. Inside a transition, a set after an `await` needs its own `startTransition`.

## "Invalid hook call" or "Rendered more hooks than during the previous render"

Hooks are called conditionally, after an early return, in a loop, or from a plain function. Or there are two copies of React (mismatched `react` and `react-dom` versions, a linked package with its own `react`): `npm ls react react-dom` must show one version, and bundler `resolve.dedupe` or a peer-dependency fix removes the extra copy.

## "Each child in a list should have a unique key"

Add a stable `key` from the data (an id). If you generate ids, generate them once when the item is created, not in render.

## "A component was suspended by an uncached promise"

The promise passed to `use` is created in render or by an uncached function, so it is new on every render. Create it in a loader, a Server Component, a query library or a cache keyed by input, and pass the same promise down.

## "Suspense Exception: This is not a real error!"

`use` was called inside `try/catch`. Remove the `try/catch` and wrap the component in an error boundary.

## The Suspense fallback never shows, or shows again and again

A fetch in an effect is invisible to Suspense: use `use` with a cached promise, `lazy`, or a Suspense-aware library. If the fallback flashes on every navigation, wrap the update in `startTransition` so React keeps the current UI. If it appears when typing, `useDeferredValue` the query instead.

## `useFormStatus` always returns `pending: false`

It reads the parent form. Move the call into a child component rendered inside the `<form>`; it does not see a form rendered by the same component.

## An optimistic update shows briefly, then reverts

`useOptimistic`'s setter ran outside an Action. Call it inside the form action or inside `startTransition(async () => { ... })`. It reverts to the real value when the action ends, so the real state must be updated by then.

## "An async function with useActionState was called outside of a transition"

You called the dispatch function from a plain handler. Wrap it in `startTransition`, or pass it to a form `action` or another Action prop.

## The form cleared after submit and the user's input is gone

React 19 resets the uncontrolled fields of a form when its action completes, and a returned validation error is still a completed action. Return the submitted values in the action's state and use them as `defaultValue`, or use controlled inputs.

## Queued actions silently stop

A thrown error in an action cancels every queued call and goes to the error boundary. Catch expected failures in the action and return an error state.

## "not wrapped in act(...)" warnings in tests

A state update happened after the test moved on. `await` every `userEvent` call, wait with `findBy*` or `waitFor` for the result, and import `act` from `react` (`react-dom/test-utils` is gone in 19). Fix the test; don't silence the warning.

## A test passes alone and fails in the suite

Shared state: a module-level cache, a `QueryClient` reused between tests (create one per test, `retry: false`), MSW handlers not reset (`server.resetHandlers()` after each), fake timers not restored, or an expected `console.error` spy not restored.

## jsdom errors: `matchMedia`, `ResizeObserver`, `IntersectionObserver`, `scrollIntoView` is not a function

jsdom lacks them. Stub them in the test setup, or move the behavior to a Playwright test where layout is real.

## Input feels slow, or a list scrolls badly

Profile before changing anything. Typing: the whole tree re-renders per keystroke, so move the input's state down, `useDeferredValue` the heavy view, or memoize the heavy child. Lists: stable keys, paginate, virtualize. With the compiler on, check that the slow component actually compiled (the "Memo" badge) and read the lint output for why not.

## "Objects are not valid as a React child" or `0` rendered on screen

An object, Promise or `Date` is rendered directly: render a field of it, or format it. A `0` comes from `{count && <X />}`: use `{count > 0 ? <X /> : null}`.

## Server Components (Next.js App Router)

- "You're importing a component that needs `useState`" (wording varies): add `'use client'` at the top of the file that uses hooks or browser APIs, or move that part into a small client component and pass it `children`.
- "Only plain objects can be passed to Client Components": a function, class instance or other non-serializable value crossed the boundary. Pass data, or call a Server Function.
- Next 15 and 16 `params` and `searchParams` are Promises: `await props.params`. `middleware` is `proxy` in 16.

## After upgrading to React 19

- `ReactDOM.render is not a function`, `findDOMNode`, string refs, `react-dom/test-utils`: replaced as in [versions.md](versions.md); run `npx codemod@latest react/19/migration-recipe`.
- TypeScript: `Expected 1 arguments, but got 0` on `useRef()` (pass `undefined`), `Cannot find namespace 'JSX'` (`React.JSX`), a ref callback returning a value, `props` of `ReactElement` now `unknown`: `npx types-react-codemod@latest preset-19 ./path`.
- `defaultProps` or `propTypes` seem ignored on a function component: they are. Use default parameters and TypeScript.
- "Your app is using an outdated JSX transform": set `"jsx": "react-jsx"` (or the bundler's automatic runtime).
- Uncaught render errors no longer rethrow, so a test or error tracker that relied on that sees nothing: use the root `onUncaughtError`, `onCaughtError` and `onRecoverableError` options.
- A snapshot or selector on ids breaks: `useId` now returns `_r_` style ids (19.2).
- A library using React internals fails on install or at runtime: upgrade it, or pin React until it supports 19.

## After enabling React Compiler

- A component shows no "Memo" badge: it broke a Rule of React and was skipped. Read the `eslint-plugin-react-hooks` output (`purity`, `refs`, `immutability`, `set-state-in-render`, `incompatible-library`) and fix it, or add a commented `"use no memo"` while you do.
- An effect fires more or less often than before: memoization changed the identity of a dependency. Stabilize the dependency on purpose (a manual `useMemo` is the documented escape hatch) or fix the effect.
- Builds got slower on Next.js: expected, the compiler relies on Babel; use `compilationMode: 'annotation'` to adopt gradually.
- Vite: `react({ babel: ... })` does nothing after `@vitejs/plugin-react` 6; use `@rolldown/plugin-babel` with `reactCompilerPreset()`.

## After upgrading tooling

- **Vite 8:** needs Node 20.19+ or 22.12+; a config with `esbuild` or `rollupOptions` is auto-converted, but read the migration guide when a plugin misbehaves.
- **React Router 8:** peer dependency errors mean Node below 22.22 or React below 19.2.7; replace `react-router-dom` imports with `react-router` (and `react-router/dom` for DOM-only exports); `meta` and `useMatches` use `loaderData`, not `data`.
- **Vitest 5:** call-count assertions fail because mocks are now cleared before each test (`clearMocks`); `vi.mock` inside a block or test throws (hoist it to the top level, or use `vi.doMock`); Node must be 22.12+.
- **MSW 3:** `import { http } from 'msw'` fails: import from `msw/http`; `onUnhandledRequest` becomes `onUnhandledFrame`; `worker.stop()` returns a promise.
- **Next.js 16:** `next lint` is gone (run ESLint directly); Turbopack is the default, and a custom `webpack` config fails `next build` until you opt out with `--webpack` or migrate it.
