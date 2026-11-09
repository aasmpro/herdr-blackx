# blackx

A black Herdr workspace for local projects and remote machines. Edit Markdown and CSV previews, view images and PDFs, copy files between computers, and keep provider usage in view—all through 21 native blackx mods.

![blackx running in Herdr](../docs/screenshots/preview.png)

## Configure your workflow

Open **Settings → blackx** to choose a directory source and editor. Stay with the workspace folder, follow the active terminal, or use a custom absolute directory; Files and Changes share the choice. Open source in the built-in editor, use `$EDITOR`, or supply a custom command. External editors launch on the file’s machine in a new Herdr tab, with the path appended automatically.

Built-in mode offers editable Markdown/CSV previews, image/PDF viewing, Save/Cmd-S, retained drafts, conflict checks, and line wrapping. External modes give the file tree the full panel width.

![blackx directory and editor configuration](../docs/screenshots/configs.png)

## File previews and editing

Choose **Built-in** in Settings → blackx to use the content panel.

| File type | Built-in view | Editing |
| --- | --- | --- |
| Markdown (`.md`, `.markdown`, `.mdown`, `.mkd`) | Rendered preview by default; eye icon switches to source | Click a block, edit its Markdown inline, then choose Done |
| CSV / TSV | Table preview by default; the same eye icon switches to source | Click a cell to edit, including multiline values |
| PNG, JPEG, WebP, GIF, SVG | Standalone image preview, fitted to the content width | Read only; decoding depends on Herdr's image loader |
| PDF | All pages in one vertical scroll; total page count at the header's right | Read only |
| HTML, CSS, JavaScript and other text | Source editor | Text editing; no live HTML/CSS/JavaScript preview |

### Markdown and the preview switch

Markdown and CSV/TSV open in preview by default. Use the **eye icon in the content header** to switch between preview and source. Click a rendered Markdown block to open its inline text editor; **Done** renders the block again. You edit Markdown syntax inside that block, rather than using a rich-text formatting toolbar. Blank separators and surrounding blocks stay in the same draft.

Preview edits and source edits share one document. Use **Save / Cmd-S** to write changes with the existing local/remote conflict checks. Switching views or editing a table does not save automatically. Failed saves preserve the draft.

### CSV and TSV tables

- Aligned cells, column letters, row numbers, and horizontal scrolling. Click a cell to edit it inline, including multiline text. The first record remains editable and is included in the row count.
- A centered **+ button across the full table width below the rows** adds a row. A centered **+ button along the table's right edge**, matching its actual height, adds a column. Added rows appear on their last page.
- Trash icons in every row/column header request confirmation. Delete changes the draft; Cancel or Escape keeps it unchanged. If the draft changes while confirmation is open, choose the target again. Removing the final row/column leaves an empty editable placeholder.
- Pages of **100 rows**, with Previous/Next controls above large tables. The bottom status row shows only **N rows · M columns**.
- Strings stay strings: leading zeros, empty cells, Unicode, quoted delimiters, escaped quotes, multiline values, UTF-8 BOM and LF/CRLF conventions are supported. Table edits can normalize CSV quoting while preserving cell values. Invalid CSV can be repaired through Source. Spreadsheet formulas, sorting and filtering are not provided.

![CSV preview with editable cells and row/column controls](../docs/screenshots/files.csv.png)

### Standalone images

PNG, JPEG, WebP, GIF and SVG files open as read-only images using Herdr's image loader. The filename stays in the header; the content contains the image, without PDF page navigation or read-only captions. The picture fits the content width and can be scrolled vertically. Animation, zoom controls, and inline Markdown media are not implemented.

![Image displayed inside the Files content panel](../docs/screenshots/files.image.png)

### Read-only PDFs

PDF pages render progressively, one after another in a **single vertical scroll**. The total page count appears at the **right side of the content header**. There are no Previous/Next page controls in the PDF content. Poppler renders each page locally; subsequent pages reuse the staged PDF snapshot. If a later page fails, earlier rendered pages remain visible with an error message.

![Continuous PDF pages with the total count in the header](../docs/screenshots/files.pdf.png)

PDF viewing is raster-only: no text selection/search, PDF editing, password entry or zoom controls. Mixed page sizes fit the available width. Protected or damaged files may fail to render.

### Limits and connected machines

Text up to **400,000 characters** is editable. Larger text is truncated/read-only; it cannot be saved from the truncated preview. Image/PDF source files are capped at **50 MiB** and remote previews are also subject to `hc` transport limits. Unsupported or unreadable files show an explanation.

Images and PDFs are staged into `blackx-preview-cache/` under the selected Herdr home, including copies of files from connected machines. This is separate from the Copy/Move clipboard. Cache folders older than 24 hours are cleaned when the preview helper runs. Reopen an image/PDF to load external file changes. Poppler is needed locally, not on the remote PDF endpoint. Remote preview behavior and Windows support have not been comprehensively validated.

HTML, CSS and JavaScript are editable as source. Live HTML rendering, embedded audio/video playback, and automatic loading of Markdown image references are not implemented. The sample HTML/CSS/JS files in the source repository are test inputs, not a claim of browser-preview support.

## Copy on a server, paste locally

1. Open Files in a connected server workspace and right-click **Copy** on a file or folder.
2. Switch to your local workspace and navigate to the destination folder.
3. Right-click **Paste**. If the name already exists, choose Replace, Keep both, or Cancel.

The same workflow works from local to server or between servers. Blackx’s shared file clipboard remembers the source machine across workspace switches. **Copy path** is separate and copies only a text path.

Transfers use your existing Herdr connections, chunked snapshots, and destination checksums. Copy retains the original; Move checks the source before removal. Failed transfers retain sources and report recovery staging paths when applicable. Machines must already be connected and have Python 3 available.

![Remote workspace with its server Files tree](../docs/screenshots/machine.png)

Copy, Move, Paste, and file-management actions are available directly in the Files context menu.

![The blackx Files context menu](../docs/screenshots/files.png)

## Keep usage in view

The status bar follows the focused program with **Claude or Codex usage**, remaining percentages, reset countdowns, and Codex credits when reported. It refreshes every 15 seconds and on click, alongside machine, branch, and agent-attention information. Stale or unavailable readings are marked.

Provider readings are **local**, including while a remote workspace is selected; the bar adds a local label. Codex needs an authenticated local app-server and adaptation of the helper’s machine-specific executable path. Claude needs an external process writing `~/.ai-usage-bridge/claude.json`; that bridge is not bundled. These readings describe provider allowances, not usage per project or remote account.

## Install

Ask your agent to install this folder in Herdr. Read `RECIPE.md` and all package files first, including the listed external commands and filesystem access.

1. On macOS/Linux, run `sh install-dependencies.sh` to provision missing runtime tools, then check for name collisions. Windows requires manual dependency provisioning and file copying. Copy `layouts/blackx.json`, both files in `themes/`, and the 21 folders in `mods/` into the matching folders of your Herdr home. If a name is taken, rename the incoming file/folder and update its layout, asset paths and self-overlay references before installation; never overwrite unrelated customizations.
2. Keep each generated `style.js` with its `main.js`. No build tool is required.
3. Run `herdr-app check` for each installed `blackx-*` mod.
4. Select blackx and blackx:

```sh
herdr-app do layout.switch '{"name":"blackx"}'
herdr-app do app.theme '{"name":"blackx"}'
```

Leave `README.md`, `RECIPE.md`, and `preview.png` outside the app home. Current settings and shortcuts are included as optional merge fragments under `preferences/`; merge selected values and preserve unrelated preferences. Font preferences remain yours; the sample screenshot uses JetBrainsMono Nerd Font, which is bundled in `mods/blackx-chrome/fonts`. Herdr's built-in fonts remain available.

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

Run `make dependencies` from the repository, or `sh install-dependencies.sh` from the portable package. `make install`, `make update`, and `make sync-style` run dependency setup automatically. For manual portable-package installation, run its dependency script before copying the package files. Use `sh install-dependencies.sh --check` for a read-only check. On a connected Unix endpoint, copy the script there and run `sh install-dependencies.sh --endpoint`; this installs Python/Git and Linux Trash support without local-only PDF/Reveal packages. Local installation does not modify connected machines automatically.

Node.js and Make are development-only requirements for the complete test suite and maintainer targets; installed mods do not need Node.js. Fonts and icons are bundled. Codex CLI with an authenticated account, Claude's external usage bridge, and a chosen external editor are optional integrations and are not installed or authenticated by dependency setup. The current Codex helper uses a machine-specific executable path. Windows automatic dependency installation is not supported; its Python/Git/Poppler and native tools must be provisioned manually. Linux package-manager mappings are included but only macOS setup is verified on this host.

## Compatibility and access

Tested with Herdr 0.1.13 and 0.1.14 on macOS. Uses native GPUI/gpui-base APIs and Herdr overlays. Git provides status/diffs; Commit explicitly runs `git add -A` then `git commit`. Directory browsing uses sh or PowerShell locally or on the selected machine. File operations and transfers use Python 3 and hc; Linux Trash needs gio. Saves write project files with conflict checks. Machine controls use hc and configured network connections; worktree operations may fetch through Git. Usage runs Python 3: Codex starts a local app-server and reads account rate limits, while Claude reads `~/.ai-usage-bridge/claude.json`. The current Codex helper has a machine-specific executable path; adapt it for another installation. No credentials or usage data are bundled. Feedback sends only through Herdr's API after the person clicks Send; updates use Herdr's built-in APIs.

## Share

Place this folder in a public GitHub repository and add the repo topic `herdr-layout`, following Herdr's sharing instructions. This is one layout bundle, not 21 separately published mods. See `RECIPE.md` for behavior and acceptance checks. Maintainer style sources and optional build tools are kept outside this native release folder.

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

Choose Built-in, System default, or Custom under Settings → blackx. Built-in provides editable Markdown/CSV previews, source editing, image/PDF viewing, Save/Cmd-S, line wrapping and retained drafts; see File previews and editing above. System default uses `$EDITOR` on the file's machine; Custom accepts an executable and quoted arguments. Both external modes append the file path and launch a new Herdr tab; shell substitutions and control operators are rejected. Save dirty native drafts before launching an external editor. Passive refresh/restoration does not launch editor tabs.

Directory source can use the workspace path, follow the terminal, or use a custom absolute path on the workspace's machine. This applies to Files and Changes.

In either external editor mode, Files shows only the full-width tree; the content column and divider are hidden. Selecting a file opens the chosen external editor in a new tab. Built-in mode restores the split view and its saved tree width. Launch errors remain visible below the tree.

### Git colors in the file tree

Git status appears through filename and icon colors, without A/M/D/U letter badges. File sizes and directory counts keep their neutral styling.

| Item | Color |
| --- | --- |
| Modified file | Yellow |
| Added or untracked file | Green |
| Existing directory containing changed or added descendants | Yellow |
| New directory containing added/untracked files | Green |
| File with a deletion or conflict status | Red |
| Unchanged file or directory | Normal foreground |
| Git-ignored entry | Dimmed |

Directory colors propagate through every parent, including collapsed folders. For example, adding `src/new-folder/file.txt` makes an existing `src` yellow, while the new `new-folder` and `file.txt` are green. A modification to an existing nested file makes its existing ancestor directories yellow. Once changes are committed or reverted and the tree refreshes, clean entries return to their normal color.

“Existing” means present in Git’s last commit. Git does not track empty directories, so a previously empty folder receiving its first untracked file is treated as new. Before the first commit, added directories are green. Colors use the active theme’s ANSI palette; blackx-mono renders these roles in grayscale. Selection and hover backgrounds remain unchanged.


Directory-tree icons use Nerd Fonts 3.5.1 glyphs from the bundled JetBrainsMono Nerd Font, with 110 extension mappings, special config/manifest filenames, open/closed folders, and a generic fallback. Labels and glyphs retain muted monochrome styling. Other controls continue using Lucide and the selected brand marks.

Files context menu: Copy and Move use Blackx’s shared file clipboard; Copy path uses the system text clipboard. Paste targets a folder, a file’s parent, or empty-space root. Duplicates offer Replace, Keep both, or Cancel. Delete confirms and uses system Trash, never permanent deletion. Reveal is local-only. File operations require python3 on participating machines; Linux Trash requires gio. Cross-machine transfers stream via existing hc connections, verify content hashes, and retain the source on transfer failure. Failed transfers report their staging folder for recovery. Windows requires python3 on PATH. The dependency setup script installs missing runtime tools; see Dependencies above.

Files menu starts with Add file, Add folder, and Rename. Creation targets the clicked folder, a clicked file’s parent, or the root on empty-space clicks. Prompts accept one item name, support Enter/Cancel, and retain input on errors. Existing items are never overwritten by these actions. Rename follows the selected file, expanded folders, and retained drafts. Empty-space menus disable Rename.

Copy/Paste in the source folder offers Keep both or Cancel; Move into the same folder is a no-op. Real folder descendants are still rejected. Cross-machine folder transfers expand hard links into ordinary files while preserving symlinks, and allow up to ten minutes for large transfers. Remote text files up to the existing editor limit are editable; saves use private transient request files, streamed stdin, conflict checks, and atomic replacement. Failed saves keep the draft.

Cross-machine copies use private per-file snapshots and 2 MiB chunks to stay below hc’s 8 MiB message limit. Runtime sockets, pipes/devices, and entries that disappear during Copy are skipped and reported in a warning. Checksums verify every archived file at the destination. Move retains stricter source-change checks and does not remove a source containing uncopied runtime entries.

## Current configuration fragments

`preferences/settings.fragment.json` contains the current blackx settings (palette overrides, fonts, zoom, appearance, ligatures, contrast and sounds). `preferences/keys.fragment.json` contains the current global, terminal and blackx shortcut configuration. Merge selected values into personal files; do not replace unrelated settings or bindings. Root `keys.json` remains the minimal blackx-only shortcut fragment. Runtime workspace state, machine connections and backups are not part of the portable package.

Text selection targets the active directory row color (`#282828`). Native inputs compensate for their 50% selection blend. Herdr’s native content editor additionally dims selections according to focus; the installed API does not expose that opacity, so editor highlights can appear darker than the selected tree row.
