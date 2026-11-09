# blackx

Black canvas. Compact controls. Your local projects and remote machines, connected through one file workflow.

Blackx brings 21 native mods together into one Herdr workspace: configure how files open, copy them between machines, and keep an eye on your agent usage from the status bar.

[Install blackx](#install-blackx) · [Explore the features](docs/FEATURES.md) · [Make it yours](#make-it-yours)

![blackx with agent workspaces, split terminals, and the Files panel](docs/screenshots/preview.png)

## Your workflow, your settings

Open **Settings → blackx** to choose where the Files panel looks and how it opens your files.

- **Choose the directory.** Stay with the workspace, follow the active terminal as you move around, or point to a custom absolute folder. Files and Changes use the same selection.
- **Choose the editor.** Use the built-in editor, your machine’s `$EDITOR`, or a custom command. External editors open in a new Herdr tab, with the file path passed in automatically.
- **Keep remote files remote.** Directory paths and editor commands use the workspace’s machine, so a server file opens in that server’s editor.

The file tree uses yellow for modified files and existing folders with changed contents, and green for new files and folders—without Git status letter badges. Colors carry up through the parent folders.

Built-in editing includes retained drafts, conflict checks, line wrapping, and Markdown preview. External editor modes give the file tree the full panel width.

![The blackx configuration menu with directory source and editor choices](docs/screenshots/configs.png)

## Copy on the server. Paste on local. Easy files!

Find a file in a connected server’s **Files** panel, right-click **Copy**, switch to your local workspace, and **Paste** into the destination folder. The same workflow works in reverse, or between two connected servers—including folders.

Blackx keeps the source file and its machine together in a shared file clipboard, then transfers through your existing Herdr connections. You choose the files and destination in the panel, without composing a separate transfer command.

- **Handle duplicates.** Replace, keep both, or cancel when the destination already exists.
- **Check the arrival.** Cross-machine transfers verify file contents with checksums.
- **Recover from interruptions.** Failed transfers retain the source and report staging paths when recovery is needed.
- **Move deliberately.** Move uses stricter source checks before removing the original.

You need connected machines and Python 3 on each participating endpoint. **Copy path** is separate: it copies the path as text, while **Copy / Move / Paste** use blackx’s file clipboard.

![A connected server workspace with its remote Files tree in blackx](docs/screenshots/machine.png)

The Files context menu puts Copy, Move, Paste, and the rest of your file actions in one place.

![The blackx Files context menu](docs/screenshots/files.png)

## Know how much agent usage is left

The bottom bar keeps available **Codex or Claude usage** beside the workspace you’re working in: remaining percentages, reset countdowns, and Codex credit balance when reported.

It follows the focused program, refreshes every 15 seconds, and lets you click for an update. Machine, branch, agent count, and agents needing attention stay nearby. Stale or missing readings are marked so you can tell when the data needs refreshing.

Usage comes from your **local** provider setup, even when a remote workspace is selected; the bar labels it accordingly. Codex uses a local app-server, and Claude needs a usage bridge file. See [usage setup and limitations](docs/FEATURES.md#status-bar-and-usage) for the current requirements.

## Install blackx

Already using Herdr? Give your agent this prompt:

```text
Install the blackx layout from:
https://github.com/aasmpro/herdr-blackx/tree/master/release/blackx

Read my installed Herdr AGENTS.md, then the package README, RECIPE.md,
including its dependencies and access, and all package files.
Preserve my settings and shortcuts, resolve name collisions, validate
all blackx mods, and switch to the blackx layout and palette.
```

The [ready-to-install folder](release/blackx) includes the layout, mods, fonts, icons, themes, recipe, and preview. Recipients need no build tools. See the [package instructions](release/blackx/README.md) for manual installation and optional configuration fragments.

Tested with **Herdr 0.1.13 and 0.1.14 on macOS**. File operations need Python 3 on participating machines; Linux Trash needs `gio`. Usage reporting needs provider setup, including adapting the current Codex helper’s executable path or supplying Claude’s usage bridge file. See [features and limitations](docs/FEATURES.md) before relying on a particular platform or integration.

## Make it yours

The source is here too. Change the style tokens, adjust a mod, rebuild the package, and try it locally.

```sh
make help       # Available commands
make build      # Generate release/blackx
make verify     # Check the package, tests, and native mods
make install    # First install; refuses existing names
make update     # Back up and update installed blackx files
make release    # Validate and create an optional local archive
```

| Looking for… | Start here |
| --- | --- |
| Everything blackx does | [Feature inventory](docs/FEATURES.md) |
| Setup, development, and releases | [Maintainer guide](docs/DEVELOPMENT.md) |
| Colors, typography, and spacing | [Style guide](docs/STYLES.md) |
| The installable package | [release/blackx](release/blackx) |
| Code and package sources | [src](src) |

Maintain source in `src/`, documentation and screenshots in `docs/`, and commit rebuilt `release/blackx` files alongside source changes. The package stays in this repository; optional archives live in the ignored `dist/` folder.
