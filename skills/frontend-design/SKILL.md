---
name: frontend-design
description: Visual and interaction design for UI you build or reshape, in React web, React Native with Expo, and Tauri desktop or mobile. Use when creating a page, screen, component or flow, or restyling one, so the result fits the product and its users instead of a generic template. Covers following an existing design system, choosing a direction, type, color, layout, motion, copy, states, accessibility, and checking the result in a real render.
---

# Frontend design

Make choices for this product and these users, not the defaults you would produce for any similar page. Ideas adapted and reworded from Anthropic's `frontend-design` skill (Apache-2.0); stack notes are this plugin's.

## 1. Existing project: its system wins

Before designing anything, look at what the project already has: component library (`components/ui`, shadcn, Tamagui, NativeWind, a theme file), tokens, spacing and type scale, icon set, existing screens. A change in an existing product matches it. Reuse its components and tokens, and extend them only when nothing fits. Everything below is for new surfaces or a brief that asks for a fresh look. The brief's own words always beat these defaults.

## 2. Ground it in the subject

State, in a line each: what the product is, who uses it, and the primary job of this screen. If the brief doesn't say, propose them and confirm. A clinic ledger, a trading tool, a kids' game and a field-service app should not look alike. Draw materials, vocabulary and density from the subject (a ledger is dense, tabular and calm; a consumer onboarding is spacious and warm).

## 3. Plan before you build (two passes)

Write a compact plan, then critique it against the brief, then build.
- **Color:** 4 to 6 named hex values (background, surface, text, one accent, state colors). Check contrast of text on every surface (4.5:1 body, 3:1 large text and UI).
- **Type:** one family or two that are clearly different, a defined scale, weights with a job. Line length under about 80 characters.
- **Layout:** one sentence of concept plus an ASCII wireframe; say how content aligns.
- **One memorable thing:** spend the boldness in one place and keep the rest quiet.

Then ask: would this plan come out the same for any similar prompt? Where it would, change that part and say what you changed.

## 4. Defaults that read as templated

Treat these as choices to justify, not starting points:
- Cream background with a high-contrast serif and a terracotta accent; near-black with one acid accent; hairline broadsheet columns with zero radius.
- The card kit: everything in identical rounded cards, one radius and one grey shadow everywhere, gradient washes as decoration.
- Chrome that appears whatever the subject: an ALL-CAPS tracked eyebrow above every heading, `A · B · C` meta strings, `→` on every link, numbered `01 / 02 / 03` markers on content that is not a sequence, one word of a headline in a different color.
- Fade-and-slide-up on every section and hover motion on every card. Use unprompted motion once, for one moment; motion that answers a person's action is fine.
- A big number, small label and gradient accent as the hero.

## 5. Stack notes

- **React web (Tailwind, shadcn and similar):** the library's look is the default, so make a deliberate decision about radius, density and color rather than shipping it as-is. Build responsive from the narrow width up; check keyboard focus, `prefers-reduced-motion` and `prefers-color-scheme`.
- **React Native / Expo:** follow platform conventions (back gesture, sheets, native pickers) unless the brief says otherwise. Respect safe areas and the keyboard, touch targets of at least 44x44 pt, dynamic type, and both light and dark. Use `FlatList` for long lists, not `ScrollView`. Animate with the native driver or Reanimated, not layout in JS.
- **Tauri desktop:** desktop is denser than mobile and expects keyboard use: tab order, shortcuts, menus, resizable windows, and a sensible minimum size. Mind window chrome and drag regions. Mobile Tauri follows the React Native points above. Don't invent new patterns for file, window or system dialogs; use the platform's.

## 6. Every screen has states

Design empty, loading, error, partial and long-content states, not only the happy path. An error says what happened and what to do, never apologizes vaguely. An empty screen invites the next action. Test with long names, 0 items, 1 item and 1000 items, and right-to-left or non-Latin text when the product could meet it.

## 7. Words are design

Name things by what the user understands, not how the system is built. Buttons say what happens ("Save changes", not "Submit") and the same action keeps its name through the flow. Sentence case, active voice, no filler. Don't write marketing copy into a tool.

## 8. Check it in a real render

Look at the result before calling it done: the project's e2e setup, Claude's built-in browser pane, or headless Playwright with screenshots at phone and desktop widths, in the order the `developer` agent already uses. Don't open Claude in Chrome or computer use unless asked. Expo device runs and Tauri windows are not launched; say what you could not see. Remove one decoration before you stop.

## Quality floor, always

Responsive to a narrow screen, visible keyboard focus, labels on inputs, alt text or accessible names, color never the only signal, reduced motion respected, no text on a busy image without a scrim, contrast met.
