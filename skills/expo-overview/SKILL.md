---
name: expo-overview
description: "Entry point and router for every Expo or EAS task. Load this skill first, before writing code and before choosing another expo-* skill — when the request, PRD, or spec mentions Expo, EAS, Expo Go, or an expo-* package, or the project has an `expo` dependency in `package.json`. Within that gate it also covers app specs and designs to implement (tabs, stacks, maps, lists, navigation, building from a screenshot), and phrasings like 'implement a mobile app', 'make my app look native', 'add navigation', 'fetch some data', 'upgrade my SDK', 'add Expo to my existing native app', 'ship to the App Store', or 'I'm new to Expo, where do I start'. A fully specified request (SDK pinned, libraries named, layout given) still routes through here — the shared setup rules still apply. Do NOT load it when neither signal is present: a bare React Native project with no `expo` dependency is not Expo work. Detects the real goal, routes to the right expo-* / eas-* skill, and owns the shared setup rules."
license: MIT
---

# `expo-overview` — router & shared rules for Expo / EAS

## Start Here — read before doing anything

**Do not guess the skill from project files alone.** Many Expo goals look similar from
the filesystem but need different skills.

1. **Confirm this is Expo or EAS work** — the request mentions Expo or EAS, or
   `package.json` has an `expo` dependency. Otherwise this skill does not apply.
   A native app using EAS for delivery qualifies without an Expo runtime.
2. **Read the user's goal** — what outcome do they want, in plain terms?
3. **Classify it** using the Skill Map below, translating casual phrasing to a goal.
4. **If the goal is ambiguous**, state the reading you are taking (a subagent cannot ask) and proceed.
5. **Trust the leaf skill** — it has its own detection logic and steps. Don't improvise.

## Skill Map (by goal)

Match the goal to a skill, then load that skill's `SKILL.md`. Only these Expo skills are bundled in agents-kit (the rest of upstream's set is listed under "In agents-kit" below).

- `expo-project-structure`: folder layout for a **new** Expo Router project: where screens, components and config live (never restructure an existing app to match)
- `expo-router`: navigation: file-based routes, tabs, stacks, modals, sheets, links, headers
- `expo-native-ui`: screens, styling, semantic colors, native controls, SF Symbols, media, layout
- `expo-ui`: native UI components from `@expo/ui` (BottomSheet, Picker, Slider, Switch, Menu, Button, grouped form sections, List) as real SwiftUI on iOS and Jetpack Compose on Android. Consult it first whenever you need a UI component.
- `expo-data-fetching`: network requests, React Query or SWR, caching, offline, route loaders
- `react-native-best-practices`: performance of any React Native app (re-renders, lists, JS thread, startup, bundle size, native memory); applies to Expo and bare React Native

### Translating vague asks

- "Make it look native" / grouped settings forms: `expo-ui`; screens and styling: `expo-native-ui`; navigation: `expo-router`.
- "It feels slow" / "it janks": `react-native-best-practices`.
- "I'm new / where do I start": scaffold first (see Shared setup rules), then route by goal.
- Motion, design tokens, native modules, store submission, OTA updates and SDK upgrades are not bundled (see "In agents-kit").

## Shared setup rules

Apply the rules that match the project and the requested task.

- **Starting a new Expo app?** Start one the standard way before routing to a feature skill:
  `npx create-expo-app@latest`, laying out folders per `expo-project-structure`. Then
  classify the user's goal and route.
- **Detect the SDK version** before giving version-specific advice: read the `expo`
  version in `package.json` (and `app.json` / `app.config.{js,ts}`). Many APIs and
  defaults differ by SDK.
- **Read the docs for that SDK, not `latest`.** Use the version-pinned URL, e.g.
  `https://docs.expo.dev/versions/v56.0.0/sdk/ui/` on SDK 56 instead of
  `https://docs.expo.dev/versions/latest/sdk/ui/` — the `latest` pages track the newest
  SDK and can document APIs the project does not have yet.
- **Moving to a newer SDK is its own task**: use `npx expo install --fix` and the SDK upgrade guide for that version; do not bump versions by hand.
- **Managed vs. bare/prebuild**: the presence of committed `ios/` and `android/`
  directories means native projects exist (prebuild or bare). Config-plugin and
  native-setup steps differ — note which one the project is in.
- **Install packages with `npx expo install <pkg>`**, not raw `npm`/`yarn`/`pnpm add`,
  so versions stay compatible with the project's SDK.

## When to skip the router hop

- Only when the user explicitly named a specific `expo-*` / `eas-*` skill → load that
  skill directly.
- A fully-specified task (SDK version pinned, file layout given, libraries named) is
  **not** a reason to skip: the shared rules above still apply — check them, then route
  to the matching leaf skill.

<!-- Modified by algochad for the agents-kit plugin: the section below was appended. Everything above is upstream (MIT, see licenses/expo-skills-MIT.txt). -->

## In agents-kit

- **Never launch an app, simulator, emulator or device**, and never open a window: no `npx expo start` for Expo Go, no `npx expo run:ios`/`run:android`, no `eas build`, no `agent-device`, no `xcrun simctl` or `adb`. Where this skill tells you to run or look at the app, verify by other means instead: `tsc --noEmit`, the linter, the project's Jest (`jest-expo`) and React Native Testing Library tests, `npx expo export --platform web` served over http and checked with the bundled headless Playwright server (when the app supports web), and `npx expo-doctor`. Say what you could not see on a device.
- **EAS builds, store submission, OTA updates and `eas login`** only when the user asks for them by name.
- **Secrets:** nothing secret in `EXPO_PUBLIC_*` variables, app config or AsyncStorage; use SecureStore. The security checklist is in `agents-kit:security-audit` (Expo and React Native).
- **A subagent cannot ask the user.** Where this skill says to confirm or ask, state your assumption at the top of your report and proceed.
- **Not bundled here:** upstream Expo skills this one mentions (`expo-animation`, `expo-design-system`, `expo-dom`, `expo-module`, `expo-dev-client`, `expo-tailwind-setup`, `expo-web-to-native`, `expo-upgrade`, `expo-examples`, `eas-*`) live in the `expo/skills` repository; use the SDK-pinned Expo docs for those topics, or install them if the user wants them.
- Visual design questions go to `agents-kit:frontend-design`; process to `agents-kit:test-driven-development`, `agents-kit:systematic-debugging` and `agents-kit:verification-before-completion`; finding code to `ctx where`. TypeScript questions go to `agents-kit:typescript`; React questions to `agents-kit:react` (React Native has no DOM, so its web-only parts do not apply).
