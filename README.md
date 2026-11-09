# blackx

Black canvas. Compact controls. Your local projects and remote machines, connected through one file workflow.

Blackx brings 21 native mods together into one Herdr workspace: edit Markdown and CSV previews, view images and PDFs, copy files between machines, and keep an eye on agent usage from the status bar.

[Install blackx](#install-blackx) · [Explore the features](docs/FEATURES.md) · [Make it yours](#make-it-yours)

![blackx with agent workspaces, split terminals, and the Files panel](docs/screenshots/preview.png)

## Your workflow, your settings

Open **Settings → blackx** to choose where the Files panel looks and how it opens your files.

- **Choose the directory.** Stay with the workspace, follow the active terminal as you move around, or point to a custom absolute folder. Files and Changes use the same selection.
- **Choose the editor.** Use the built-in editor, your machine’s `$EDITOR`, or a custom command. External editors open in a new Herdr tab, with the file path passed in automatically.
- **Keep remote files remote.** Directory paths and editor commands use the workspace’s machine, so a server file opens in that server’s editor.

The file tree uses yellow for modified files and existing folders with changed contents, and green for new files and folders—without Git status letter badges. Colors carry up through the parent folders.

Built-in editing includes editable Markdown and CSV/TSV previews, retained drafts, conflict checks, and line wrapping. External editor modes give the file tree the full panel width.

![The blackx configuration menu with directory source and editor choices](docs/screenshots/configs.png)

## More than a source editor

Select **Built-in** under Settings → blackx to view and edit files inside Files.

| File type | Built-in view | Editing |
| --- | --- | --- |
| Markdown (`.md`, `.markdown`, `.mdown`, `.mkd`) | Rendered preview by default; eye icon switches to source | Click a block, edit its Markdown inline, then choose Done |
| CSV / TSV | Table preview by default; the same eye icon switches to source | Click a cell to edit, including multiline values |
| PNG, JPEG, WebP, GIF, SVG | Standalone image preview, fitted to the content width | Read only; decoding depends on Herdr's image loader |
| PDF | All pages in one vertical scroll; total page count at the header's right | Read only |
| HTML, CSS, JavaScript and other text | Source editor | Text editing; no live HTML/CSS/JavaScript preview |

Markdown and CSV/TSV share the **eye icon in the content header** and open in preview by default. Source and preview use the same draft. Editing does not write to disk until **Save / Cmd-S**, and local/remote saves retain their conflict checks.

### CSV tables you can edit

Column letters, row numbers, cell borders, and horizontal scrolling keep values aligned. Click a cell to edit it in place. The **+ strip below the rows** spans the table width; the **+ strip on the right** spans the table's actual height. Both icons are centered. Trash icons on row and column headers ask for confirmation before removal; Cancel or Escape leaves the draft unchanged. The bottom status row shows only row and column counts.

Large tables use pages of 100 rows, with Previous/Next controls above the table. Values stay strings, preserving leading zeros and avoiding automatic formula/date conversion.

![Editable CSV table with row and column controls](docs/screenshots/files.csv.png)

### Images and PDFs inside Files

Images keep their filename in the header and show the picture without page controls inside the content area.

![Standalone image displayed inside Files](docs/screenshots/files.image.png)

PDF pages load progressively in order, including mixed portrait/landscape documents. Scroll through every page without Previous/Next buttons; the page total stays in the header. Poppler renders pages locally, including PDFs staged from connected machines.

![PDF pages stacked vertically with the page total in the header](docs/screenshots/files.pdf.png)

Text editing is limited to 400,000 characters; image/PDF source previews are limited to 50 MiB. Inline Markdown media and audio/video playback are not implemented. See [file preview behavior and limits](docs/FEATURES.md#file-previews-and-editing) for details.

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

## Dependencies

Installation and updates install missing runtime dependencies automatically using Homebrew on macOS or apt, dnf, pacman, or zypper on Linux. Existing commands on `PATH` are reused. Package-manager failures stop installation before blackx files are replaced. Downloads use the package manager's configured repositories and write outside the blackx folder; Linux may request sudo. Homebrew itself must already be installed on macOS.

| Dependency | Purpose | Where needed |
| --- | --- | --- |
| Herdr app and `hc` | Native interface, terminals, connected machines | Install Herdr first; blackx does not replace/update it |
| Python 3 (`python3`) | File operations, transfers, preview helpers, usage | Local computer and participating remote endpoints |
| Git (`git`) | Status, diffs, commits, worktrees | Local computer and participating remote endpoints |
| Poppler (`pdfinfo`, `pdftoppm`) | Read-only PDF page rendering | Local computer, including remote PDF previews |
| POSIX `sh` or native PowerShell | Directory queries and editor launching | Operating-system prerequisite |
| `gio` | Move deleted files to Trash | Linux endpoints |
| `xdg-open` | Reveal local files/folders | Local Linux desktop |
| `osascript`, `open` | Trash and Reveal | Built into macOS |

Run `make dependencies` from the repository, or `sh install-dependencies.sh` from the portable package. `make install`, `make update`, and `make sync-style` run dependency setup automatically. For manual portable-package installation, run its dependency script before copying the package files. Use `sh src/install-dependencies.sh --check` in the repository, or `sh install-dependencies.sh --check` in the portable package, for a read-only check. On a connected Unix endpoint, copy the script there and run `sh install-dependencies.sh --endpoint`; this installs Python/Git and Linux Trash support without local-only PDF/Reveal packages. Local installation does not modify connected machines automatically.

Node.js and Make are development-only requirements for the complete test suite and maintainer targets; installed mods do not need Node.js. Fonts and icons are bundled. Codex CLI with an authenticated account, Claude's external usage bridge, and a chosen external editor are optional integrations and are not installed or authenticated by dependency setup. The current Codex helper uses a machine-specific executable path. Windows automatic dependency installation is not supported; its Python/Git/Poppler and native tools must be provisioned manually. Linux package-manager mappings are included but only macOS setup is verified on this host.

## Install blackx

Already using Herdr? Give your agent this prompt:

```text
Install the blackx layout from:
https://github.com/aasmpro/herdr-blackx/tree/master/release/blackx

Read my installed Herdr AGENTS.md, then the package README, RECIPE.md,
including its dependencies and access, and all package files.
Preserve my settings and shortcuts, resolve name collisions, validate
all blackx mods, run its dependency setup script for missing runtime tools,
and switch to the blackx layout and palette.
```

The [ready-to-install folder](release/blackx) includes the layout, mods, fonts, icons, themes, recipe, screenshots, and dependency setup script. Recipients need no build tools. See the [package instructions](release/blackx/README.md) for manual installation and optional configuration fragments.

Tested with **Herdr 0.1.13 and 0.1.14 on macOS**. File operations need Python 3 on participating machines; Linux Trash needs `gio`. Usage reporting needs provider setup, including adapting the current Codex helper’s executable path or supplying Claude’s usage bridge file. See [features and limitations](docs/FEATURES.md) before relying on a particular platform or integration.

## Make it yours

The source is here too. Change the style tokens, adjust a mod, rebuild the package, and try it locally.

```sh
make help       # Available commands
make dependencies # Install missing runtime tools
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
