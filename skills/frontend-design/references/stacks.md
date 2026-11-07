# Stack notes for frontend-design (agents-kit)

Written for this plugin; not part of Anthropic's skill.

- **React web (Tailwind, shadcn and similar):** the library's look is the default, so make a deliberate decision about radius, density and color rather than shipping it as-is. Build from the narrow width up. Check visible keyboard focus, `prefers-reduced-motion` and `prefers-color-scheme`.
- **React Native / Expo:** follow platform conventions (back gesture, sheets, native pickers) unless the brief says otherwise. Respect safe areas and the keyboard, touch targets of at least 44x44 pt, dynamic type, and light and dark. Use `FlatList` for long lists, not `ScrollView`. Animate with the native driver or Reanimated, not layout in JS.
- **Tauri desktop:** denser than mobile and used with the keyboard: tab order, shortcuts, menus, resizable windows with a sensible minimum size, window chrome and drag regions. Use the platform's own file, window and system dialogs. Tauri mobile follows the React Native points.
- **Content that breaks layouts:** test 0, 1 and 1000 items, very long names, and right-to-left or non-Latin text when the product could meet it.
- **Quality floor, always:** responsive to a narrow screen, visible keyboard focus, labels on inputs, accessible names or alt text, color never the only signal, reduced motion respected, contrast met (4.5:1 body text, 3:1 large text and UI).
