# blackx for Herdr

blackx is a compact black Herdr layout with spaces, agents, flat tabs, pane controls, Files, Changes and a usage status bar.

See [FEATURES.md](FEATURES.md) for the detailed feature inventory, optional setup, and limitations.

**The ready-to-install package is [release/blackx](../release/blackx).** It is committed alongside the source and follows Herdr's documented folder structure: `layouts/`, `mods/`, `themes/`, `RECIPE.md`, and an actual `preview.png` screenshot. Its 21 custom mods use the `blackx-*` namespace. Recipients do not need a build step.

This repository also contains optional maintainer tooling. The style tokens, Python builder and local installer are project conveniences, not official Herdr packaging requirements. Recipients do not need the builder or installer.

## Install the native package

Read the [package README](../release/blackx/README.md) and [recipe](../release/blackx/RECIPE.md). Give an agent the `release/blackx` folder or its GitHub folder link. Installation copies native files after reviewing dependencies and checking names; it does not replace personal settings or shortcuts.

## Develop

Run `make help` for the maintainer commands:

```sh
make build        # Generate release/blackx
make test         # Run Python and JavaScript tests
make verify       # Check freshness, tests, and native mod rendering
make install      # First install; refuses collisions
make update       # Back up and replace installed blackx files
make sync-style   # Update and merge palette/font settings
make release      # Build, verify, and create dist/blackx.tar.gz
```

`make check` detects stale output without rebuilding. `make archive` archives a checked package without running tests. Release preparation never publishes. Install targets preserve personal shortcuts; merge the package's shortcut fragments separately. Use `make update HERDR_HOME="/path/to/herdr-home"` to target another instance. Tool paths can be overridden with `PYTHON`, `NODE`, and `HERDR_APP`; archive paths with `DIST_DIR` or `ARCHIVE`.

`make test-remote` runs the real Incus/hc integration suite using `MACHINE_A` and `MACHINE_B` (defaults below). It requires running, connected endpoints and retains its fixtures. `make status` inspects the selected Herdr instance.

Edit [styles.json](../src/styles.json), then run from this repository:

```sh
python3 tools/build.py
python3 tools/build.py --check
python3 -m unittest discover -s tests -v
```

Use [STYLES.md](STYLES.md) for token roles. Maintain behavior in `src/mods/blackx-*/main.js` and structure in `src/layout.json`. Generated files live in `release/blackx`; do not edit them directly. Each installed mod contains its own resolved style module. No cross-mod code imports or runtime build dependency are required.

A maintainer may use the optional local installer:

```sh
python3 tools/install.py
```

It refuses existing names. After reviewing collisions, `--update` backs up and replaces package files. `--sync-style-settings` additionally merges only generated palette/font values; every other preference and all shortcuts remain untouched. `--home /path/to/herdr-home` selects another installation. Build alone never writes to Herdr's home.

Personal preferences and shortcuts remain separate source examples at `src/optional-settings.json` and `src/optional-keys.json`; their resolved values are included as `preferences/settings.fragment.json` and `preferences/keys.fragment.json` in the native release. Resolve their style references through the builder when inspecting them, and merge only chosen preferences/bindings. Do not replace another person's files with these examples.

## Release

Keep source and the generated `release/blackx` package in this repository. After source changes, run `make build` and `make verify`, review the generated changes, and commit them alongside the source. `make release` additionally creates an optional archive in `dist/`; archives remain ignored by Git. All build, test, and release commands run locally, with no GitHub Actions or automatic publishing.

Publish this repository publicly and add the topic `herdr-layout` for Herdr discovery. The installable folder is `release/blackx`, containing the layout, its mods, recipe, and preview together. This is one layout bundle; `herdr-mod` is not required for its supporting mods. Repository publication and topic changes are separate from local build commands.

`src/RECIPE.md` explains visuals, behavior, APIs, external commands, dependencies and checks. The maintained screenshot is `docs/screenshots/preview.png`; the builder copies it to `release/blackx/preview.png`. It is an actual capture of the running Herdr UI. Private screenshots, rollback backups and migration data remain outside the package and ignored by Git.

Validated baseline: Herdr 0.1.13 on macOS. Broader Windows/remote compatibility is not yet validated. Preserve clone provenance and review the redistribution terms of upstream code and artwork before public release; this repository does not assert a new license for them.

## Rollback

The optional installer reports its backup directory. Restore replaced files from there to their matching paths in the Herdr home. Never edit app-owned `data/`, layout state, shared state or other bookkeeping directly. A one-time local rename migration preserved existing mod preferences using the app's localStorage API; no personal migration payload is included in the release.

## Secondary interfaces

Includes namespaced Settings, command palette, picker, menus, prompts, confirmations and machine/worktree dialogs. Merge package keys.json into personal bindings; it contains layout:blackx overrides for settings, palette, picker, close tab, rename tab/space, and keybind help. Never replace personal keys.json. Blackx routes close/rename shortcuts, keybind help, feedback, welcome, and release notes through its styled dialogs. Direct CLI commands and OS menu actions still use Herdr screens because the app exposes no global dialog override. Personal copies are pinned to the inspected Herdr version and require review after upgrades.

Two palettes are bundled: `blackx` preserves colored ANSI terminal output; `blackx-mono` uses the existing grayscale Monochrome palette. Select either in the theme picker.

The blackx palette uses Gruvbox Dark neutral/bright red, green, yellow, blue, purple and aqua for ANSI color slots (https://github.com/morhetz/gruvbox). Neutral UI colors remain black/gray/white; blackx-mono remains grayscale.

## Agent themes (optional)

Codex: copy `integrations/codex/blackx.tmTheme` into `$CODEX_HOME/themes` and select blackx with `/theme` (or set `tui.theme = "blackx"`). This styles code/diff syntax; fixed application accents are not universally overridable. Claude Code: merge `integrations/claude/settings.fragment.json` into your user settings to use `dark-ansi`, which follows the active terminal palette. Do not overwrite existing agent settings. Agent settings are global to those tools, not scoped to the Herdr layout. Restart or reselect the theme in existing sessions.

Codex also includes `integrations/codex/blackx-mono.tmTheme`: install alongside blackx and choose `blackx-mono` with `/theme`. For Claude Code, keep `dark-ansi` and select Herdr’s `blackx-mono` palette; it follows the terminal automatically, with no separate Claude theme file.

## Bundled fonts and defaults

JetBrainsMono Nerd Font (Nerd Fonts 3.5.1 / upstream 2.304) is bundled unchanged, including 16 weight/italic faces, OFL.txt and embedded copyright notices in `mods/blackx-chrome/fonts`. Herdr loads bundled fonts on startup or the next look change. Layout defaults explicitly use this family for both UI and terminals at 13px; existing component-specific text sizes remain intact. `preferences/font-defaults.json` additionally records zoom 1.1, ligatures off, and minimum_contrast 1. Merge this fragment into settings.json to reproduce the complete preference setup, preserving unrelated keys; do not replace the file. Maintainers can use `tools/install.py --update --sync-style-settings` to apply those preferences.

## Icons

All custom UI icon rendering resolves through bundled Lucide static 1.70.0, with generic Lucide symbols replacing program/agent brand marks. Icons are tinted by the design system; layout preview images remain actual artwork. Each mod includes local icon assets and LICENSE. Merge package programs.json icon overrides into personal programs.json to apply generic icons in built-in Herdr screens, preserving existing run/match settings. No app-owned icons or frame files are replaced. Terminal applications draw their own logos separately.

Brand exceptions: Codex, Claude, Pi and OpenCode use monochrome Lobe Icons 1.102.0 SVG marks (currentColor, 24×24); Terminal and the remaining UI use Lucide. Lobe licensing/attribution is bundled alongside the SVGs. These override the earlier generic Bot mapping for those four agents.

## Configured file editor

Choose Built-in, System default, or Custom under Settings → blackx. Built-in edits source with Save/Cmd-S, line wrapping, retained drafts, and a Markdown preview toggle. System default uses `$EDITOR` on the file's machine; Custom accepts an executable and quoted arguments. Both external modes append the file path and launch a new Herdr tab; shell substitutions and control operators are rejected. Save dirty native drafts before launching an external editor. Passive refresh/restoration does not launch editor tabs.

Directory source can use the workspace path, follow the terminal, or use a custom absolute path on the workspace's machine. This applies to Files and Changes.

In either external editor mode, Files shows only the full-width tree; the content column and divider are hidden. Selecting a file still opens the system editor in a new tab. Built-in mode restores the split view and its saved tree width. Launch errors remain visible below the tree.

Directory-tree icons use Nerd Fonts 3.5.1 glyphs from the bundled JetBrainsMono Nerd Font, with 110 extension mappings, special config/manifest filenames, open/closed folders, and a generic fallback. Labels and glyphs retain muted monochrome styling. Other controls continue using Lucide and the selected brand marks.

Files context menu: Copy and Move use Blackx’s shared file clipboard; Copy path uses the system text clipboard. Paste targets a folder, a file’s parent, or empty-space root. Duplicates offer Replace, Keep both, or Cancel. Delete confirms and uses system Trash, never permanent deletion. Reveal is local-only. File operations require python3 on participating machines; Linux Trash requires gio. Cross-machine transfers stream via existing hc connections, verify content hashes, and retain the source on transfer failure. Failed transfers report their staging folder for recovery. Windows requires python3 on PATH. No dependencies are installed automatically.

Files menu starts with Add file, Add folder, and Rename. Creation targets the clicked folder, a clicked file’s parent, or the root on empty-space clicks. Prompts accept one item name, support Enter/Cancel, and retain input on errors. Existing items are never overwritten by these actions. Rename follows the selected file, expanded folders, and retained drafts. Empty-space menus disable Rename.

Copy/Paste in the source folder offers Keep both or Cancel; Move into the same folder is a no-op. Real folder descendants are still rejected. Cross-machine folder transfers expand hard links into ordinary files while preserving symlinks, and allow up to ten minutes for large transfers. Remote text files up to the existing editor limit are editable; saves use private transient request files, streamed stdin, conflict checks, and atomic replacement. Failed saves keep the draft.

Cross-machine copies use private per-file snapshots and 2 MiB chunks to stay below hc’s 8 MiB message limit. Runtime sockets, pipes/devices, and entries that disappear during Copy are skipped and reported in a warning. Checksums verify every archived file at the destination. Move retains stricter source-change checks and does not remove a source containing uncopied runtime entries.

## Incus integration tests

The local test server is the Lima VM `blackx-incus` (2 CPUs, 3 GiB RAM, 16 GiB sparse disk, no host mounts). Incus runs inside this VM with containers `blackx-a` and `blackx-b`. Herdr connects as `blackx-incus-a` and `blackx-incus-b` through `limactl shell … sudo incus exec … -- sh -lc`; no public server port is exposed.

Run `python3 tests/remote_files.py blackx-incus-a blackx-incus-b` to exercise local/remote and remote/remote operations. The test creates a unique `/tmp/blackx-files-*` fixture folder per container and retains fixtures, Trash entries, and failed-transfer staging data for inspection. It tests same-machine copy/move, duplicates, Unicode and literal backslash names, binary files, symlinks, Trash, truncated exports, changed sources, and unavailable Trash. These are real hc connections; fault cases deliberately inject endpoint failures.

Inspect containers with `limactl shell blackx-incus sudo incus list`. Stop the test server with `limactl stop blackx-incus`; resume it with `limactl start -y blackx-incus`. Test results from the initial run are in the ignored `verification/incus-files-results.json`. This setup validates Linux remote endpoints from macOS; Windows remains unverified.

Files menu starts with Add file, Add folder, and Rename. Creation targets the clicked folder, a clicked file’s parent, or the root on empty-space clicks. Prompts accept one item name, support Enter/Cancel, and retain input on errors. Existing items are never overwritten by these actions. Rename follows the selected file, expanded folders, and retained drafts. Empty-space menus disable Rename.

Copy/Paste in the source folder offers Keep both or Cancel; Move into the same folder is a no-op. Real folder descendants are still rejected. Cross-machine folder transfers expand hard links into ordinary files while preserving symlinks, and allow up to ten minutes for large transfers. Remote text files up to the existing editor limit are editable; saves use private transient request files, streamed stdin, conflict checks, and atomic replacement. Failed saves keep the draft.

Cross-machine copies use private per-file snapshots and 2 MiB chunks to stay below hc’s 8 MiB message limit. Runtime sockets, pipes/devices, and entries that disappear during Copy are skipped and reported in a warning. Checksums verify every archived file at the destination. Move retains stricter source-change checks and does not remove a source containing uncopied runtime entries.

## Current configuration fragments

`preferences/settings.fragment.json` contains the current blackx settings (palette overrides, fonts, zoom, appearance, ligatures, contrast and sounds). `preferences/keys.fragment.json` contains the current global, terminal and blackx shortcut configuration. Merge selected values into personal files; do not replace unrelated settings or bindings. Root `keys.json` remains the minimal blackx-only shortcut fragment. Runtime workspace state, machine connections and backups are not part of the portable package.
