# blackx features

blackx is a native Herdr interface package with 21 namespaced mods, two palettes, bundled fonts and icons, file editing and transfer tools, Git controls, and agent monitoring. It uses Herdr’s existing terminals, workspaces, remote connections, and GPUI controls.

This inventory describes the maintained source. Optional integrations and machine-specific prerequisites are called out separately.

## Appearance and layout

- Black backgrounds, gray surfaces, white accents, thin borders, and mostly square controls.
- `blackx` palette: neutral interface with Gruvbox ANSI terminal colors.
- `blackx-mono` palette: grayscale terminal output.
- Bundled JetBrainsMono Nerd Font with 16 weight/italic faces and licensing.
- Default UI and terminal fonts at 13px; component-specific sizes remain independent.
- Optional defaults for 1.1 zoom, dark appearance, disabled ligatures, sounds, and contrast.
- Bundled Lucide interface icons and monochrome brand marks for Codex, Claude, Pi, and OpenCode.
- Custom title-bar composition with space for macOS window buttons.
- Expandable sidebar and compact icon rail, flat tab bar, pane headers, right-hand Files/Changes panel, and bottom status bar.

## Workspaces, tabs, and panes

- Workspace lists grouped by machine, with Git branch, change, and ahead/behind information.
- Worktree spaces nested beneath their main repository.
- Create, switch, rename, and close workspaces and tabs.
- Launch terminals or installed agents through the new-item menus.
- Remember the selected Files/Changes panel per workspace.
- Pane headers display program identity, directory, and agent state.
- Hover controls split right/down, zoom/restore, and close panes.
- Context menus act on the clicked workspace, tab, or pane.
- Switch terminal right-click handling between Herdr’s menu and the terminal program.
- Park supported sub-agent panes back under their parent.

Terminal execution, persistence after closing the app, split mechanics, and remote connections are provided by Herdr core.

## Agent monitoring

- Working, blocked, done, and idle indicators, including native animated working icons and “Needs you” badges.
- Priority sorting or grouping by workspace.
- Pinning, elapsed status durations, and nested live sub-agent trees.
- Next/previous agent navigation follows the displayed agent order.
- Terminal peeking for sub-agents through Herdr’s built-in peek interface; no separate blackx peek mod is bundled.

## Directory selection and file browsing

Files and Changes share a directory-source setting:

| Mode | Behavior |
| --- | --- |
| Workspace | Uses the first live terminal directory in the workspace, falling back to its stored folder. |
| Terminal | Follows the focused terminal directory and remembers its last usable location. |
| Custom | Uses an absolute directory on the workspace’s machine. |

- Expandable local and connected-machine directory trees.
- Retained expanded folders and selected files when switching directory contexts.
- File refresh behavior and dimmed Git-ignored entries.
- Nerd Font file icons with 110 extension mappings, special filenames, folder states, and a fallback glyph.
- Resizable tree/content split for built-in editing.
- Full-width tree when an external editor is selected.

## Editing

Three editor modes are available under Settings → blackx:

| Mode | Behavior |
| --- | --- |
| Built-in | Opens editable source inside Files, including Markdown source. |
| System default | Uses `$EDITOR` on the file’s machine and opens a terminal editor in a new Herdr tab. |
| Custom | Uses a configured editor command and appends the file path automatically. |

- Built-in Save button and `Cmd-S` binding, line wrapping, and a Markdown preview toggle.
- Retained unsaved drafts and conflict checks when files change on disk.
- Draft preservation after save failures.
- Local and remote text saves, including atomic remote replacement through private transient requests and streamed input.
- Dirty built-in drafts must be saved before launching a terminal editor.
- Passive refreshes and restored selections do not launch external editor tabs.
- Binary, oversized, and unreadable files are subject to editor limits; this is not an unrestricted binary editor.

## File and folder operations

The context menu offers Add file, Add folder, Rename, Copy, Move, Paste, Copy path, local Reveal, and Delete through system Trash.

- Creation targets the clicked folder, a file’s parent, or the tree root.
- Creation and rename refuse to overwrite existing entries; prompts retain input after errors.
- Rename follows selected files, expanded folders, and retained drafts.
- Copy and Move use blackx’s shared file clipboard; Copy path uses the system text clipboard.
- Duplicate handling offers Replace, Keep both, or Cancel.
- Copy into the source folder offers Keep both or Cancel; Move into the same folder is a no-op.
- Directory descendants are rejected as destinations.
- Delete requires confirmation and uses Trash rather than permanent deletion.

## Transfers between machines

- Local/remote and remote/remote transfers through existing `hc` connections.
- Private snapshots, chunked transfer, and destination checksum verification.
- Symlink preservation; cross-machine folder transfers expand hard links into ordinary files.
- Warnings for skipped sockets, pipes, devices, and entries disappearing during Copy.
- Sources retained on transfer failure, with staging paths reported for recovery.
- Stricter source-change checks for Move, including retaining sources with uncopied runtime entries.
- Up to ten minutes for large cross-machine operations.

Python 3 is required on participating machines. Linux Trash requires `gio`. Reveal is local-only. Dependencies are not automatically installed.

## Git Changes panel

- Repository detection for the selected directory context.
- Changed and untracked file lists, insertion/deletion counts, text diffs, and new-file content.
- Support for repositories without an initial commit.
- Explanatory messages for binary, oversized, or unreadable content.
- Virtualized diff rows for long changes.
- Commit-message field and Commit action.

Commit runs `git add -A` followed by `git commit`: it stages all changes, not a selected subset.

## Status bar and usage

- Current machine, available Git branch, workspace agent count, and count needing attention.
- Command-palette hint based on the actual shortcut binding.
- Codex/Claude usage selection based on the focused program.
- Remaining usage percentages and reset countdowns for available usage windows.
- Automatic refresh, click-to-refresh, stale-data markers, and unavailable/retry states.

Codex usage is queried through a local Codex app-server process. The current helper contains a machine-specific executable path and must be adapted on other installations. Claude usage requires an external process to populate `~/.ai-usage-bridge/claude.json`; the package does not supply that process. Remote workspaces label these usage readings as local. Missing data does not imply unlimited quota.

## Dialogs, search, and settings

Styled interfaces include Settings, fuzzy command palette, workspace/tab picker, context and new-item menus, rename prompts, close-tab/workspace confirmations, worktree dialogs, add-machine interface, keybinding help, feedback, welcome, and release notes.

- Palette supports recent commands, fuzzy search, and keyboard navigation.
- Keybinding help is searchable.
- Settings expose appearance, fonts, zoom, Option-key behavior, sounds, machine management, updates, privacy controls, and directory/editor choices.
- Worktree dialogs create, open, and remove worktrees using Herdr’s capabilities.
- Feedback supports screenshot attachments and an explicit Send action.

Styling covers actions routed through blackx. Direct CLI commands, OS menu actions, and some built-in interfaces can still open Herdr’s default screens. Herdr does not expose a global dialog override.

## Shortcuts and optional configuration

Merge the minimal package `keys.json` into personal bindings:

| Binding | Action |
| --- | --- |
| `cmd-,` | Settings |
| `cmd-shift-p` | Command palette |
| `cmd-p` | Workspace/tab picker |
| `cmd-w` | Close-tab confirmation |
| `f2` | Rename tab |
| `shift-f2` | Rename workspace |
| `cmd-/`, `cmd-shift-/` | Keybinding help |

Optional package files include full settings/shortcut merge fragments, font defaults, program-icon overrides, Codex `blackx` and `blackx-mono` syntax themes, and a Claude Code `dark-ansi` settings fragment.

These require explicit installation or merging. Agent themes affect those tools globally, not just this Herdr layout. Preserve unrelated settings, shortcuts, program launch commands, and matching rules. Runtime workspace state and machine connections are not distributed.

## Development and distribution

- Central style tokens in [styles.json](../src/styles.json).
- Deterministic Python builder producing self-contained native mod assets.
- Installer refuses collisions by default; updates create rollback backups.
- Optional palette/font settings sync preserves unrelated preferences.
- [Makefile](../Makefile) targets for building, tests, installation, updates, native checks, archives, and remote integration tests; run `make help`.
- Python and JavaScript test suites plus real `hc` endpoint integration tests.
- Local build, validation, and optional archive commands; no GitHub Actions or automatic publishing.
- Ready-to-install `release/blackx` package committed alongside source; optional `dist/` archives excluded from Git.

Before publishing, run local native Herdr checks and exercise changed views. Real remote endpoint tests require available, connected machines.

## Compatibility and documentation

The inspected baseline is Herdr 0.1.13 on macOS. Linux remote endpoints have dedicated integration tests; Windows and broader remote behavior remain incompletely validated. Personal copies of Herdr interfaces require review after Herdr upgrades.

The current source includes Custom editor commands, directory-source selection, Markdown preview, and Claude bridge-file usage reporting.

For installation and development, see [maintainer guide](DEVELOPMENT.md). For package behavior and dependencies, see [RECIPE.md](../src/RECIPE.md).
