# React review checklist

Rewritten for this plugin from react.dev, the react-patterns, react-testing and frontend-a11y skills in affaan-m/ECC (MIT), and the react-expert skill in Jeffallan/claude-skills (MIT). Use it with `/agents-kit:code-review`: flag only what you can show is wrong, not preferences. Security findings follow the `security-audit` skill; visual design findings follow the `frontend-design` skill.

## Components and props
- [ ] Rendering is pure: no mutation of props, state or module variables, no fetching, no `Date.now()` or `Math.random()` in the output.
- [ ] No component defined inside another component.
- [ ] Lists use stable keys (not the index for lists that reorder, insert or delete).
- [ ] Props are not copied into state; derived values are computed, not stored; state holds the minimum (an id, not the object).
- [ ] Boolean-prop pileups became variants or composition; the component has one job.
- [ ] The file follows the project's layout and naming; no 18-era patterns (`defaultProps`, string refs, `ReactDOM.render`) in a 19 project.

## Hooks and effects
- [ ] Hooks are called at the top level; `eslint-plugin-react-hooks` is clean and no `exhaustive-deps` or `rules-of-hooks` disable was added.
- [ ] Every effect syncs with an external system. Derived state, event-driven work, resets, parent notification and data fetching are not in effects.
- [ ] Every effect cleans up what it starts and survives Strict Mode's setup, cleanup, setup.
- [ ] An effect that fetches handles the race (ignore flag or abort), or the fetch moved to a query library or loader.
- [ ] `useEffectEvent` is used only for event-like logic called from an effect, is never a dependency, and is not used to dodge a dependency.
- [ ] No `ref.current` access during render; no `setState` straight inside an effect to derive state.
- [ ] A custom hook has one concern, a stable return shape, and is named `useX` because it calls hooks.

## State, context and forms
- [ ] State lives at the lowest level that works; server data is not copied into local state; shareable state (filters, tab, page) is in the URL.
- [ ] Context holds rarely-changing values, is split by concern, and is read through a hook that throws outside its provider; fast-changing state uses a store with selectors.
- [ ] State updates are immutable; updates that depend on the previous value use the updater form.
- [ ] Forms use native actions where they fit; `useFormStatus` is called in a child of the form; `useActionState` actions return error state instead of throwing for expected failures; `useOptimistic` is set inside an Action and the real state is the source of truth.
- [ ] `use` is not in `try/catch` and its promise is stable across renders.
- [ ] Validation exists on the server (or a shared schema); client checks are only for speed.

## Data, Suspense and errors
- [ ] No app data fetched in an effect; query keys contain every input of the query function; mutations invalidate or update the affected keys.
- [ ] Independent requests are parallel (no avoidable waterfall); loading, error and empty states are all handled.
- [ ] Suspense boundaries sit close to the data and the fallback reserves space; navigation and filter updates use a transition where the old UI should stay.
- [ ] Error boundaries exist around routes or features with a retry path; handler and async errors are caught explicitly and shown.

## Performance
- [ ] Any optimization is backed by a measurement (Profiler or a slow-render symptom), not a guess.
- [ ] With the Compiler on: no new blanket `useMemo`, `useCallback` or `memo`; any manual one has a reason (effect dependency, expensive plain function, library identity); any `"use no memo"` is commented and temporary.
- [ ] With the Compiler off: `memo` children receive stable props; no inline object, array or function props on memoized children in hot paths.
- [ ] Long lists are paginated or virtualized; heavy routes and libraries are lazy loaded; no render-time work that belongs in an event handler.

## Accessibility
- [ ] Native elements for buttons, links, labels, lists and dialogs; no `div` with `onClick` and no keyboard support.
- [ ] Every input has a label; errors are linked with `aria-describedby`; icon-only buttons have an accessible name; async status is announced.
- [ ] Focus moves on route change and dialog open or close, and returns to the trigger; no positive `tabIndex`.

## TypeScript
- [ ] No `any` for props, events or handlers; variant props use discriminated unions; events use specific types.
- [ ] No `!` on refs or query data without a reason; nullable state is typed `T | null`.
- [ ] 19 typing rules followed (`useRef` argument, `React.JSX`, ref callback returns).

## Testing
- [ ] New behavior has a test that goes through the UI (role and label queries, awaited `userEvent`), not through state or hook internals.
- [ ] The network is mocked with MSW (matching the project's MSW major), unhandled requests fail the test, handlers reset after each test, and each test has its own `QueryClient`.
- [ ] No snapshot used as the only assertion; no mocking of React or of the component under test.
- [ ] Browser-only behavior and whole flows are in Playwright (headless), not forced into jsdom.

## Server Components (only if the app uses them)
- [ ] `'use client'` is placed as low as possible; props crossing the boundary are serializable; secrets are not imported by client files.
- [ ] Every Server Function authenticates, authorizes and validates its input; React and `react-server-dom-*` are on a patched version (see versions.md).

## Versions
- [ ] The code fits the project's React version and tooling (19.2 `useEffectEvent` and `<Activity>`, 19.3 `<ViewTransition>`, MSW 3 imports, Vitest 5 mock clearing). See [versions.md](versions.md).
