# Style tokens

All maintained visual values live in `styles.json`. Values can be numbers, strings, arrays, objects, or `{"$ref":"path.to.token"}` aliases. Missing references and cycles fail the build. Native output contains only resolved values.

| Group | Purpose |
| --- | --- |
| `colors` | Herdr semantic palette: surfaces, text, borders, hover, selected rows and agent statuses |
| `terminal` | ANSI palette, cursor, and theme terminal selection |
| `overrides.blackxSelection` | Original blackx selection override, retained separately from the theme selection |
| `native.inputSelectionAccent` | Native commit-input selection accent before GPUI's 50% opacity |
| `alpha` | Hex alpha suffixes for blocked badges, diff rows and transparent state marks |
| `fonts` | Optional installed font preferences and typography fallback values |
| `sidebar` | Expanded width, compact threshold and platform rail widths |
| `layout` | Bar heights, panel widths, pane framing, padding and window controls |
| `components` | Component-specific text, glyph, row, control, popup and viewport dimensions |
| `spacing` | Shared spacing scale in logical pixels, including the existing negative tree-line offset |
| `radius` / `border` | Existing rounding scale and border widths |
| `motion` | Native spinner duration in milliseconds |
| `spaceMarkers` | Existing named space-marker palette, separate from terminal ANSI colors |

Example: change `colors.border` once to update generated theme, layout and optional settings. Change `sidebar.expanded` to update both the layout default and sidebar expand fallbacks. Change `components.changes.diffRowHeight` to update both rendered diff rows and native virtual-list geometry. Current user-resized sidebar/panel widths take precedence over defaults until changed through Herdr.

`spacing.v8` means the existing 8px spacing step; renaming it is unnecessary when changing its value. `glyph14` means the established glyph-size role in that component. Numeric suffixes identify the original scale slot; they do not constrain the new value. Component text tokens have semantic names such as `bodyText`, `captionText`, and `badgeText`. Do not merge unrelated roles merely because their defaults are equal.

Mods obtain reactive palette colors from `theme()` during rendering. Non-palette color roles and geometry come from their generated `styles` object. This lets Herdr's theme picker continue to work. Black-theme selection (`#383838`), blackx's selection override (`#282828`), selected rows (`#282828`), and native input selection accent (`#505050`) remain separate roles intentionally.

Files resolves typography using layout overrides, then the existing settings precedence, then fallbacks. Changes preserves its original diff-font policy (`settings().font_family`, otherwise JetBrains Mono). Both policies now live in the shared module template; the refactor does not force different components to acquire the same font or text size. A changed font preference is installed only with an explicit style-settings sync or manual merge.

A few zero-valued layout constraints (`min_w(0)`, flex sizing) remain structural code. SVG path geometry and artwork remain asset source. Polling intervals, file limits, truncation limits and commands remain behavior constants in mods. They are not style variables.

Native layout structure lives in `src/layout.json`; use `$ref` for its visual values. New mod visual properties should refer to a semantic palette role or a token, not introduce literals. Edit `src/shared/style.js` for common typography policies. Every mod receives a generated local copy at build time.

For each edit: build, run tests, check every affected mod with `herdr-app check`, install, inspect status/errors, then exercise the changed view. Initial-render checks do not cover async states or deferred virtual rows. Windows, remote-machine paths and every agent lifecycle state require their own runtime validation before a broader compatibility claim.
