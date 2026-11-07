---
name: react
description: Build, review and debug React web apps (React 19.x era). Covers detecting the setup (Vite, Next.js, React Router, TanStack, TypeScript, state and test libraries), component and hook design, when not to use an effect, state and context, forms and the React 19 actions APIs (useActionState, useOptimistic, use), data fetching, Suspense and error boundaries, rendering performance and React Compiler, accessibility, testing, and what changed from React 18 to 19.3. Use whenever the repo depends on react, when adding or changing a .tsx or .jsx component or hook, or when reviewing React code. Not for React Native or Expo. Visual design is in frontend-design, security in security-audit.
---

# React

Working practice for React on the web (React 19.x, with notes for 18). Follow the project's own conventions first; this skill fills the gaps. Written for this plugin from react.dev and the most-starred community React skills (see the credits in the README). **Out of scope: React Native and Expo.** For their security checks see the `security-audit` skill's [Expo and React Native checklist](../security-audit/references/stacks/expo-react-native.md); for testing and run notes see the `developer` agent's Expo notes. Other skills own these: visual design is `frontend-design`; XSS, auth, secrets and Server Function exposure are `security-audit`; process is `test-driven-development`, `systematic-debugging` and `verification-before-completion`. Detail lives in `references/`:

- [patterns.md](references/patterns.md): short worked examples for the rules below
- [versions.md](references/versions.md): what changed from React 18 to 19.3, the Compiler, and the tooling around it
- [troubleshooting.md](references/troubleshooting.md): the errors and symptoms you will actually hit
- [review-checklist.md](references/review-checklist.md): a checklist for reviewing React changes

## 1. Detect before you write

Read `package.json`, the lockfile and the config before suggesting anything:
- **React version** (`react`, `react-dom`, `@types/react`). 19 removed `propTypes` and `defaultProps` on function components, string refs and `ReactDOM.render`; `ref` is a plain prop; 19.2 added `useEffectEvent` and `<Activity>`; 19.3 made `<ViewTransition>` stable. Don't paste 18-era code into a 19 project, or 19-only APIs into an 18 one ([versions.md](references/versions.md)).
- **App shell:** Vite SPA, Next.js (App Router or Pages), React Router (declarative, data or framework mode), TanStack Router or Start. Routing, loaders and caching follow that framework's docs, and Server Components exist only where the framework implements them.
- **TypeScript** (`strict`, `"jsx": "react-jsx"`), **state and data** (TanStack Query, SWR, Redux Toolkit, Zustand, Jotai, loaders), **forms** (native actions, React Hook Form, TanStack Form, Zod), **test runner** (Vitest or Jest, Testing Library, MSW, Playwright), **styling and components** (Tailwind, CSS modules, shadcn, Radix).
- **React Compiler** on or off (`babel-plugin-react-compiler`, `reactCompiler` in `next.config`, `reactCompilerPreset` in the Vite config) and the `eslint-plugin-react-hooks` version. They decide how much manual memoization is noise (section 9).
- The nearest existing component or hook is the pattern to copy: find it with `ctx where <name>` and match its file layout, naming, props style and test style.

## 2. Components and structure

- Group by feature: the component, its hook, test and styles side by side; shared primitives where the project keeps them (`components/ui` or similar). Don't invent a layout when the repo has one.
- **Rendering is pure.** Same props and state, same output: no mutating props, state or module variables, no fetching, no `Date.now()` or `Math.random()` in the output (hydration mismatches, and the compiler skips impure code). Side effects belong in event handlers or effects.
- **Never define a component inside another component.** It is a new type every render, so React remounts it and loses its state and input focus.
- Props: compose with `children` and slots rather than piling on boolean props; give variants their own components; don't copy props into state (the copy goes stale); spread `...rest` only onto the element meant to receive it.
- **Keys:** stable ids, never the array index for lists that reorder, insert or delete. Changing a `key` on purpose resets that subtree's state.
- On 19: `ref` is a regular prop on function components (no `forwardRef` in new code, though it still works), render `<ThemeContext value={x}>` instead of `.Provider`, and `useRef` needs an argument.
- One job per component. Split when it mixes data loading, layout and interaction, or when its name needs an "and".

## 3. Hooks

- Call hooks at the top level of a component or custom hook: not in conditions, loops, after an early return or in handlers. `use` is the exception (section 6). Keep `eslint-plugin-react-hooks` on with `rules-of-hooks` and `exhaustive-deps` as errors; from v7 its `recommended` preset also carries the compiler rules (`set-state-in-effect`, `refs`, `purity`, `immutability`, `static-components`).
- **Custom hooks** extract logic that is reused or that hides a concern (a subscription, a debounced value, a query). Name it `useX` only if it calls hooks, return a small stable shape, one concern each. No `useMount`-style lifecycle wrappers: they bring back the problems of section 4.
- State: `useState` for independent values, `useReducer` when updates are related or follow named transitions (discriminated-union actions), a lazy initializer (`useState(() => parse(x))`) for an expensive start, and the updater form (`setN(n => n + 1)`) whenever the next value depends on the previous one.
- `useRef` holds values that must survive renders without causing one (timers, DOM nodes, the latest callback). Never read or write `ref.current` during render.
- `useId` for label and aria ids (never `Math.random()`), `useSyncExternalStore` for any non-React store, `useImperativeHandle` rarely.

## 4. Effects: the escape hatch

An effect synchronizes the component with something outside React (a socket, a timer, a DOM API, a third-party widget). **No external system, no effect.** Instead:

| You wrote an effect to | Do this instead |
|---|---|
| compute a value from props or state | compute it during render (`useMemo` only if measured slow) |
| respond to a click, submit or drag | put it in the event handler |
| reset state when a prop changes | give the component a `key`; or keep an id and derive the object |
| tell the parent something changed | call `onChange` in the same handler, or lift the state up |
| subscribe to a browser or external store | `useSyncExternalStore` |
| fetch app data | a query library or the framework loader (section 7) |
| run once per app load | module scope or a module-level guard |

- **Dependencies are the truth.** List every reactive value the effect reads. Never silence `exhaustive-deps`; change the code: move the object or function into the effect, move the logic to a handler, or use `useEffectEvent` (19.2) for non-reactive "event" logic fired from an effect. An Effect Event is never a dependency and is only called from effects; using one to dodge a dependency hides a bug.
- **Clean up everything the effect starts** (listener, timer, observer, subscription, `AbortController`). In development Strict Mode runs setup, cleanup, setup on mount (and since 19.3 on hydration too): an effect that breaks under that is missing a cleanup. Fix the cleanup; don't remove Strict Mode.
- **Races:** an effect that fetches must ignore or abort the stale response (`let ignore = false` flipped in the cleanup, or abort), or a slower earlier request overwrites the newer one. Better not to write that effect at all.
- No `setState` straight inside an effect to derive state (an extra render, and the compiler lint flags it), and no chains of effects that set state for each other.

## 5. State: where it lives

Keep state as local as it can be and lift it only when two components need it. In order of preference:
1. Derived: compute it, don't store it. Store the minimum (an id, not the object; no `fullName` next to `first` and `last`).
2. Local `useState` or `useReducer`.
3. The URL (search and route params) for what should survive a reload or be shared: filters, pagination, tab, selected id.
4. Server state (what the backend owns) in a query library or loader cache, never copied into local state.
5. Form state in the form (uncontrolled, or an action), not in a global store.
6. Global client state last: a small store (Zustand, Jotai, Redux Toolkit) when many distant components read and write it often.

- **Context** suits values that change rarely (theme, locale, current user). Every consumer re-renders when the value changes, so don't put fast-changing or mixed state in one context: split by concern, expose a custom hook that throws outside its provider, and use a store with selectors for frequent updates. Memoize a provider value only when the compiler is off.
- Store selectors read the least they need (`useStore(s => s.count)`, not the whole store). A `useSyncExternalStore` snapshot must return the same reference until the data changes, or it loops.
- Update immutably: a mutated object doesn't re-render and breaks memoization.

## 6. Forms and the React 19 actions APIs

- Start native: `<form action={fn}>` hands `fn` a `FormData`, and uncontrolled inputs read from it. React resets an uncontrolled form after a successful action (`requestFormReset` does it by hand). Use controlled inputs only when the value drives other UI or live validation, and a form library only for dynamic, multi-step or cross-field forms.
- `useActionState(action, initialState)` returns `[state, formAction, isPending]`; the action receives `(previousState, formData)`. Return an error state for expected failures: a thrown error cancels the queued actions and goes to the nearest error boundary. Calls queue and run in order. After an `await` inside a transition, state updates need their own `startTransition`.
- `useFormStatus` reads the **parent** `<form>`: call it in a child rendered inside the form (the submit button), not in the component that renders the `<form>`, or `pending` is never true.
- `useOptimistic(value, reducer?)`: set the optimistic value inside an Action. It falls back to the real `value` when the action ends or fails, so keep `value` as the truth and the reducer pure.
- `use(promise)` and `use(Context)` run in render only, never inside `try/catch` (a rejected promise goes to an error boundary). The promise must be the same one across renders, from a loader, a Server Component, a query library or a cache: one created in render is new every time and re-shows the fallback ("uncached promise"). `use(Context)` may be conditional.
- Validate on the server (or with a schema shared by client and server); client validation is for speed, not trust. Server Functions are public endpoints: authenticate and authorize inside them (`security-audit`).

## 7. Data fetching

- Use what the project has: framework loaders (React Router `loader`, TanStack Router loaders, Server Components in Next) or TanStack Query or SWR on the client. **Don't fetch app data in `useEffect`:** no cache, dedupe, retry or Suspense, and it races. A one-off, unshared read with cleanup is the exception.
- TanStack Query (v5): one `QueryClient` for the app; a `queryKey` holding every input of the `queryFn`; a pure `queryFn` that throws on a non-2xx response so the error reaches `error`; handle pending, error and empty states every time; invalidate related keys after a mutation. Optimistic updates, two ways: render the mutation's `variables` while it is pending when one place shows the result, or write the cache in `onMutate` (after `cancelQueries`) with a rollback in `onError` and `invalidateQueries` in `onSettled` when several places do.
- **Avoid waterfalls:** start independent requests together (`Promise.all`, sibling Suspense boundaries, a prefetch in the loader or on hover), and never nest a fetch inside the component that waits for its parent's.
- Mutations run from handlers and actions, never from effects. Validate the response shape at the boundary when the project has a schema library.

## 8. Suspense, transitions and error boundaries

- **Suspense** sees `lazy`, `use` on a cached promise and Suspense-aware libraries or frameworks; it cannot see a fetch inside an effect. Put boundaries close to the data so the rest of the page renders, reserve space in the fallback to limit layout shift, and nest them for staged reveals.
- **Transitions** (`startTransition`, `useTransition`) mark non-urgent updates (navigation, tab switches, filters) so React keeps the current UI instead of showing a fallback. They can't control a text input. For a heavy derived view that should lag behind, use `useDeferredValue`.
- **Error boundaries** catch render-time errors below them, including a rejected `use` or a failed `lazy`. They do not catch event handlers, timers and other async code, SSR, or errors in the boundary itself (errors thrown inside a transition function are caught). There is no hook version: use `react-error-boundary` or a small class with `getDerivedStateFromError`. Put one near the root and one per route or feature, each with a way to retry (`resetKeys` or a changed `key`). Handle handler and async errors with try/catch and visible UI state. Report through `componentDidCatch` or the root options `onCaughtError`, `onUncaughtError` and `onRecoverableError`.
- `<Activity mode="hidden">` (19.2) keeps a hidden subtree's state while unmounting its effects: good for tabs and back navigation. `<ViewTransition>` (19.3) animates transitions; how it should look is `frontend-design`.

## 9. Rendering performance

Measure first (React DevTools Profiler, the React tracks in Chrome's Performance panel since 19.2, Lighthouse). Fix in this order: do less work (derive less, render fewer items), restructure (move state down, pass `children` so a parent's updates don't re-render them, split context), then memoize.

- **React Compiler** (1.0 since Oct 2025) memoizes components and hooks at build time when the code follows the Rules of React; code it can't prove safe is skipped, and the lint rules say why. It does not memoize plain functions outside components and hooks, share work between components, fix impure code or change effect logic, and it can change when an effect fires. With it on, don't add `useMemo`, `useCallback` or `memo` by default and leave existing ones in place; keep a manual one for a value used as an effect dependency, an expensive plain-function result, or a library that needs a stable identity. Look for the "Memo" badge in DevTools. `"use no memo"` is a temporary, commented opt-out. Pin the plugin with `--save-exact` unless the tests are strong.
- **Compiler off:** `memo`, `useMemo` and `useCallback` earn their place when a profile shows wasted renders or a slow calculation (about 1 ms or more, per the docs), when a value goes to a `memo` child, or when it is a hook dependency. An "always new" prop (inline object, array or function) defeats `memo` on that child.
- **Long lists:** stable keys, paginate first, then virtualize (`@tanstack/react-virtual` or the project's choice) once rows are many and costly.
- **Code splitting:** route-level `lazy` with `Suspense` (or the framework's dynamic import), heavy libraries loaded on use, `import()` or preload on hover or focus. Read a bundle analyzer before guessing.
- Keep typing responsive: separate the input's state from the heavy view (`useDeferredValue`) and don't re-render the page per keystroke.

## 10. Server Components (framework-specific; Next.js App Router)

Only where the framework implements them; routing, caching and params follow its docs. Components are server-only by default and `'use client'` marks the client boundary: everything a client file imports ships to the browser. Props crossing the boundary must be serializable; pass Server Components to client ones as `children`. `'use server'` functions are public endpoints (validate, authenticate and authorize inside), secrets stay out of client files, and module-level mutable state is shared across requests, so don't keep any. `React.cache` dedupes per request on the server only. Keep `react` and the `react-server-dom-*` packages patched: a critical RCE (CVE-2025-55182) and follow-up DoS and source-exposure fixes landed in Dec 2025 ([versions.md](references/versions.md)).

## 11. Accessibility

Visual polish is `frontend-design`; this is the code-level floor.
- Native elements first: `button` for actions, `a href` for navigation, `label` tied to its input (`htmlFor` with `useId`), `dialog` or a tested primitive library (Radix, React Aria, Headless UI) for modals, menus and comboboxes instead of a hand-rolled `div role=...`. A `div onClick` has no keyboard or screen-reader support.
- ARIA only where native HTML can't express it, and a role brings its keyboard behavior with it. Icon-only buttons need an accessible name; decorative images get `alt=""`.
- Link an error to its field with `aria-describedby` and `aria-invalid`; announce async results in a live region (`role="status"`) that already exists in the DOM.
- Move focus on route changes and when a dialog opens or closes, and return it to the trigger. No positive `tabIndex`, nothing focusable inside `aria-hidden`.
- Test by role and label (section 12); run axe in component tests if the project has it; confirm focus and keyboard flow in a real browser.

## 12. Testing

- Test what the user sees and does: `render`, queries by role then label then text (`getByRole`, `getByLabelText`), `userEvent.setup()` with every call awaited, `findBy*` for what appears later, `queryBy*` to assert absence. Don't assert on state, hook calls or render counts; don't mock React or child components by default; prefer explicit assertions to DOM snapshots.
- Wrap the providers a component needs in one `renderWithProviders` helper, with a fresh `QueryClient` (`retry: false`) per test.
- Mock the network with **MSW** (handlers per test, reset after each, unhandled requests fail the test) rather than mocking `fetch` or the query hook. Check the MSW major: 3 imports `http` and `HttpResponse` from `msw/http` and names the option `onUnhandledFrame`; 2 used `msw` and `onUnhandledRequest`.
- Custom hooks: `renderHook`, with `act` (import it from `react`) around state changes.
- Runner: the project's. Vitest on Vite projects (5 clears mocks before each test by default and needs Node 22.12+), Jest elsewhere. jsdom has no layout, real CSS or scrolling and lacks many browser APIs: put those, and whole user flows, in **Playwright**, run headless (never `--headed` or `--ui`).
- Test-first with the `test-driven-development` skill: the first failing test goes through the UI (role, label), so refactors don't break it. Async Server Components usually need e2e or framework-level tests; check the framework's testing docs.

## 13. TypeScript with React

- Props are a `type`; extend native elements with `React.ComponentPropsWithoutRef<'button'>`, add `ref?: React.Ref<HTMLButtonElement>` on 19, and type `children` as `React.ReactNode`. Use **discriminated unions** so invalid combinations don't compile (`{ kind: 'link'; href: string } | { kind: 'button'; onClick: () => void }`).
- Generic components infer from their props (`function List<T extends { id: string }>(props: { items: T[] })`); don't cast at the call site.
- Events: `React.ChangeEvent<HTMLInputElement>`, `React.FormEvent<HTMLFormElement>`, `React.MouseEvent<HTMLButtonElement>`; read the element from `currentTarget`. A form action is `(formData: FormData) => void | Promise<void>`.
- `useState<User | null>(null)` for unions, `useRef<HTMLInputElement>(null)` for DOM nodes, `useReducer` with a discriminated-union action (let the reducer's types be inferred; don't pass the whole reducer type), `createContext<T | null>(null)` plus a hook that throws, `as const` for tuple returns.
- 19 types: `useRef` requires an argument, `React.JSX` replaces the global `JSX`, a ref callback must not return anything but a cleanup, and `ReactElement` props are `unknown`. No `any` for handlers or props; no `!` on a ref without a reason.

## 14. Before you say it is done

`tsc --noEmit`, the linter (a clean `eslint-plugin-react-hooks`, no new disables), the tests that touch the changed components, and the project build. Watch the dev console: key warnings, act warnings, hydration mismatches and hook warnings are bugs. For anything a user sees, check a real render with the project's own e2e setup, Claude's built-in browser pane, or the bundled headless Playwright server (`mcp__plugin_agents-kit_playwright__*`, `http` or `https` URLs only, so serve the app first). Do not open a visible window, Claude in Chrome or computer use, and say what you could not see. Run `ctx impact` on a shared component or hook: its callers are where a changed prop breaks. Then the `verification-before-completion` skill. For a review use [references/review-checklist.md](references/review-checklist.md) with `/agents-kit:code-review`.
