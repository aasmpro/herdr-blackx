import { gitMarks } from "./git-status.js";
import MarkdownContent from "./markdown-content.js";
import { ignoredPaths } from "./git-ignore.js";
import { writeDocument } from "./write-document.js";
import { menu, initMenu } from "./context-menu.js";
import { props } from "herdr";
import { fileGlyph } from "./file-icons.js";
import { icon as svg } from "./icons.js";
import { dispatch as run, openStyled as openOverlay, rememberViewport } from "./routing.js";
import { syncTextSelection, styles, typography } from "./style.js";
// File browser with local editing, retained drafts, and conflict-safe saves.
import {View, div} from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState } from "gpui-base";
import {spaces, shared, panes, focused, notify, exec, readTextFile, watchFolder, theme, settings, window, layout} from "herdr";

import { location } from "./directory-context.js";
const key = () => JSON.stringify(location());
const LANG = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", toml: "yaml", jsonc: "json", svelte: "html", vue: "html" };
const PER_FOLDER = 500, TOTAL = 5000;
const eyeIcon = off => svg(`mods/blackx-files/${off ? "eye-off" : "eye"}.svg`).size(styles.components.files.glyph14).flex_none().text_color(theme().foreground);



async function directory(path, on) {
  const windowsDirectory = async () => {
    // Windows PowerShell otherwise uses the console code page; exec decodes UTF-8.
    // Links keep directory attributes even when dangling; check their target.
    // Other reparse points (OneDrive's folders) have no LinkType and are folders.
    // PowerShell reads curly single quotes as quotes too, so they're doubled like '.
    const r = await exec("powershell", ["-NoProfile", "-Command", "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); & { param($p) @(Get-ChildItem -LiteralPath $p -Force -ErrorAction Stop | Where-Object Name -ne '.git' | Select-Object -First 501 | ForEach-Object { @{ name=$_.Name; size=$(if (-not $_.PSIsContainer) { $_.Length } else { $null }); count=$(if ($_.PSIsContainer) { try { @(Get-ChildItem -LiteralPath $_.FullName -Force -ErrorAction Stop | Where-Object Name -ne '.git').Count } catch { $null } } else { $null }); dir=($_.PSIsContainer -and (-not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -or -not $_.LinkType -or ($_.Target -and [IO.Directory]::Exists(([IO.Path]::Combine([IO.Path]::GetDirectoryName($_.FullName), $_.Target[0])))))) } }) | ConvertTo-Json -Compress } '" + path.replace(/['‘’‚‛]/g, "$&$&") + "'"], { on });
    if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
    const result = JSON.parse(r.stdout || "[]");
    return Array.isArray(result) ? result : [result];
  };
  if (!on && window()?.platform === "windows") return windowsDirectory();
  const script = "n=0; for p in \"$1\"/* \"$1\"/.[!.]* \"$1\"/..?*; do [ -e \"$p\" ] || [ -L \"$p\" ] || continue; name=${p##*/}; [ \"$name\" = .git ] && continue; meta=; if [ -d \"$p\" ]; then kind=d; if [ -r \"$p\" ] && [ -x \"$p\" ]; then meta=0; for c in \"$p\"/* \"$p\"/.[!.]* \"$p\"/..?*; do [ -e \"$c\" ] || [ -L \"$c\" ] || continue; [ \"${c##*/}\" = .git ] && continue; meta=$((meta+1)); done; fi; else kind=f; if [ -f \"$p\" ]; then meta=$(stat -L -f %z \"$p\" 2>/dev/null) || meta=$(stat -L -c %s \"$p\" 2>/dev/null) || meta=; fi; fi; printf \"%s\\0%s\\0%s\\0\" \"$kind\" \"$name\" \"$meta\"; n=$((n+1)); [ \"$n\" -gt 500 ] && break; done; test -d \"$1\"";
  let r;
  try { r = await exec("sh", ["-c", script, "files", path], { on }); }
  catch (e) {
    if (on && String(e).includes("cannot start sh: program not found")) return windowsDirectory();
    throw e;
  }
  if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
  const fields = r.stdout.split("\0"), out = [];
  for (let i = 0; i + 2 < fields.length; i += 3) out.push({ name: fields[i + 1], dir: fields[i] === "d", [fields[i] === "d" ? "count" : "size"]: /^\d+$/.test(fields[i + 2]) ? Number(fields[i + 2]) : null });
  return out;
}

function sizeLabel(bytes) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const unit = bytes === 0 ? 0 : Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1000)));
  return `${Number((bytes / 1000 ** unit).toFixed(unit ? 1 : 0))} ${units[unit]}`;
}

export default class Files extends View {
  init(_props, cx) {
    this.wrapLines = localStorage.getItem("wrap-lines") === "true";
    this.showHidden = localStorage.getItem("show-hidden") !== "false";
    this.saved = new Map();
    this.drafts = new Map();
    this.entries = new Map(); this.folders = new Set(); this.pending = new Set(); this.marks = {};
    if (props()?.fileMenu) { initMenu(this, cx); return; }
    this.refresh(cx);
    cx.timer.every(10000, cx => this.refresh(cx));
  }

  watch(root, cx) {
    if (this.on || this.watched === root) return;
    this.watched = root;
    const context = this.context;
    cx.spawn(async cx => {
      try { while (this.context === context) { await watchFolder(root); if (this.current(context)) this.refresh(cx); } }
      catch { if (this.context === context) this.watched = null; }
    });
  }

  current(context) {
    return this.context === context && key() === context.key;
  }

  async loadFolder(path, context) {
    const { on, cwd: root } = context;
    const entries = await directory(path ? `${root}/${path}` : root, on);
    if (!this.current(context) || (path && !this.folders.has(path))) return;
    const used = [...this.entries.entries()].filter(([p]) => p !== path).reduce((n, [, e]) => n + e.length, 0);
    const visible = entries.slice(0, Math.max(0, Math.min(PER_FOLDER, TOTAL - used)));
    const relative = entry => path ? `${path}/${entry.name}` : entry.name;
    const ignored = await ignoredPaths(root, visible.map(relative), on);
    if (!this.current(context) || (path && !this.folders.has(path))) return;
    this.entries.set(path, visible.map(entry => ({...entry, ignored:ignored.has(relative(entry))})).sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name)));
    if (entries.length > PER_FOLDER || used + entries.length > TOTAL) this.limited = true;
  }

  refreshDocument(cx) {
    const doc = this.document;
    if (!doc || doc.saving || doc.refreshing) return;
    const baseline = doc.baseline, on = this.on;
    doc.refreshing = true;
    cx.spawn(async cx => {
      try {
        const text = await readTextFile(doc.path, {on});
        if (text === null) { doc.message="File is no longer available; any draft is preserved."; return; }
        if (text === baseline || doc.baseline !== baseline) return;
        if (doc.dirty) { doc.message = "File changed on disk; your draft is preserved. Save will check for conflicts."; return; }
        if (text.includes("\0") || text.length > 400000) { doc.message = "File changed on disk; reopen it to refresh this preview."; return; }
        const old = doc.code;
        doc.baseline = text; doc.code = this.editor(text,doc.path,doc.editable);
        if (doc.editable) doc.code.on("change", (_e,cx)=>{doc.dirty=doc.code.value()!==doc.baseline;doc.markdownDirty=true;doc.message="";cx.notify();});
        if (this.document === doc) this.code = doc.code;
        this.updateMarkdown(doc);
        old.release(); doc.message = "Reloaded changes from disk.";
      } catch (error) { doc.message = "Cannot refresh file: " + String(error); }
      finally { doc.refreshing = false; cx.notify(); }
    });
  }

  refresh(cx, notify = true) {
    this.refreshDocument(cx);
    const { cwd, on } = location(), next = key();
    if (next !== this.context?.key) {
      if (this.context) this.saved.set(this.context.key, { folders: this.folders, file: this.file });
      const saved = this.saved.get(next);
      this.context = { key: next, cwd, on }; this.root = cwd; this.on = on; this.entries = new Map(); this.folders = new Set(saved?.folders);
      this.pending = new Set(); this.marks = {}; this.show(null); this.watched = null; this.error = null; this.limited = false;
      this.loading = false;
      if (saved?.file) this.show(saved.file, cx, notify);
    }
    if (!cwd || this.loading) return;
    const context = this.context;
    this.loading = true;
    this.limited = false;
    cx.spawn(async cx => {
      try {
        for (const path of ["", ...this.folders]) {
          if (!this.current(context)) return;
          await this.loadFolder(path, context);
        }
        const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on }).catch(() => null);
        let marks = {};
        if (top?.code === 0) {
          // Writes nothing under .git (index lock, fsmonitor cookie): the folder watch would refresh again.
          const status = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"], { cwd, on }).catch(() => null);
          if (status?.code === 0) {
            const tree = await exec("git", ["ls-tree", "-r", "-d", "--name-only", "-z", "HEAD"], { cwd: top.stdout.trim(), on }).catch(() => null);
            // With no initial commit every added directory is new.
            marks = gitMarks(top.stdout.trim(), status.stdout, tree?.code === 0 ? tree.stdout : "", TOTAL);
          }
        }
        if (!this.current(context)) return;
        this.marks = marks; this.error = null; this.watch(cwd, cx);
      } catch (e) { if (this.current(context)) this.error = String(e); }
      finally { if (this.context === context) this.loading = false; cx.notify(); }
    });
  }

  toggle(path, cx) {
    if (this.folders.has(path)) {
      for (const folder of [...this.folders]) if (folder === path || folder.startsWith(path + "/")) {
        this.folders.delete(folder);
        this.entries.delete(folder);
      }
    } else {
      this.folders.add(path);
      if (!this.entries.has(path) && !this.pending.has(path)) {
        const context = this.context;
        this.pending.add(path);
        cx.spawn(async cx => {
          try { await this.loadFolder(path, context); }
          catch (e) { if (this.current(context)) this.error = String(e); }
          finally { if (this.context === context) this.pending.delete(path); cx.notify(); }
        });
      }
    }
    cx.notify();
  }

  show(path, cx, notify = true, openEditor = false) {
    // Cached switches must repaint too; repeated clicks must not restart a read.
    if (path && path === this.file && (this.document || this.fileLoading)) { if (openEditor && this.document) this.editConfigured(cx); return; }
    const request = this.fileRequest = (this.fileRequest ?? 0) + 1;
    this.fileLoading = false;
    this.code = null; this.document = null; this.file = path; this.fileError = null;
    const draftKey = `${this.context?.key}\n${path}`;
    const cached = this.drafts.get(draftKey);
    if (path && cached) { this.document = cached; this.code = cached.code; this.ensureMarkdown(cx); if (notify) cx?.notify(); if (openEditor) this.editConfigured(cx); return; }
    if (!path || !cx) return;
    const context = this.context, root = this.root, on = this.on;
    this.fileLoading = true;
    if (notify) cx.notify();
    cx.spawn(async cx => {
      try {
        const text = await readTextFile(`${root}/${path}`, { on });
        if (this.fileRequest !== request || !this.current(context)) return;
        if (text === null) { this.fileError = "This file is no longer available"; return; }
        if (text.includes("\0")) { this.fileError = "Binary file · no text preview"; return; }
        const editable = text.length <= 400000;
        this.code = this.editor(text.length > 400000 ? text.slice(0, 400000) + "\n… (file truncated)" : text, path, editable);
        const doc = { code: this.code, baseline: text, path: `${root}/${path}`, editable, on, dirty: false, saving: false, message: editable ? "" : "Truncated preview · read only" };
        this.document = doc;
        this.drafts.set(draftKey, doc);
        this.ensureMarkdown(cx);
        if (editable) doc.code.on("change", (_event, cx) => { doc.dirty = doc.code.value() !== doc.baseline; doc.markdownDirty = true; doc.message = ""; cx.notify(); });
              if (openEditor && this.document) this.editConfigured(cx);
      } catch { if (this.fileRequest === request && this.current(context)) this.fileError = "Cannot preview this file (binary, too large, or unreadable)"; }
      finally {
        if (this.fileRequest === request && this.current(context)) { this.fileLoading = false; cx.notify(); }
      }
    });
  }

  editConfigured(cx) {
    const doc = this.document, context = location(), choice = shared("blackx.editor") ?? "builtin";
    if (!doc || this.editorLaunching) return;
    if (choice === "builtin") { if (doc.editable) { doc.preview = false; this.updateMarkdown(doc); doc.code.focus(); } else doc.message = "Built-in editing is unavailable for this file."; cx.notify(); return; }
    if (doc.dirty) { doc.message = "Save your draft before opening a terminal editor."; cx.notify(); return; }
    const path = doc.path, on = this.on, space = context.space, cwd = this.root;
    const customCommand = shared("blackx.editor.command") ?? "";
    this.editorLaunching = true;
    cx.spawn(async cx => {
      try {
        const script = 'printf "%s" "$EDITOR"';
        const command = choice === "custom" ? customCommand.trim() : (await exec("sh", ["-lc",script,"editor",choice], {on})).stdout.trim();
        if (!command) {
          doc.message = "";
          notify({title:"Editor not configured",body:choice === "custom" ? "Set a custom editor command in Settings → blackx." : "$EDITOR is not set on this machine.",level:"error"});
          return;
        }
        // Parse executable and quoted flags, never evaluate shell substitutions.
        if (!command || /[;$`|&<>\n\r]/.test(command)) throw new Error("Editor is missing or contains unsupported shell syntax.");
        const argv = []; let word = "", quote = null, escape = false;
        for (const c of command) {
          if (escape) { word += c; escape = false; }
          else if (c === "\\" && quote !== "'") escape = true;
          else if (quote) { if (c === quote) quote = null; else word += c; }
          else if (c === "'" || c === '"') quote = c;
          else if (/\s/.test(c)) { if (word) {argv.push(word);word="";} }
          else word += c;
        }
        if (quote || escape) throw new Error("Unclosed quote in editor command.");
        if (word) argv.push(word);
        if (!argv.length) throw new Error("No editor configured.");
        const found = await exec("sh",["-lc",'command -v "$1"',"editor",argv[0]],{on});
        if (found.code !== 0 || !found.stdout.trim()) throw new Error("Editor executable is unavailable on this machine.");
        run("tab.new",{space,folder:cwd,name:"Edit: "+path.split("/").pop(),argv:[...argv,"--",path]});
        doc.message = "";
      } catch (error) { doc.message = String(error); }
      finally { this.editorLaunching = false; cx.notify(); }
    });
  }

  editor(text, path, editable) {
    const t = theme(), type = typography("files"), ext = path.split(".").pop().toLowerCase();
    return EditorState.new({ language: LANG[ext] ?? ext, readonly: !editable, value: text,
      font_family: type.font, font_size: type.size, soft_wrap: Boolean(this.wrapLines),
      syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 } });
  }

  save(cx) {
    const doc = this.document;
    if (!doc?.editable || !doc.dirty || doc.saving) return;
    const text = doc.code.value(), path = doc.path, baseline = doc.baseline, on = doc.on ?? null;
    doc.saving = true; doc.message = "Saving…"; cx.notify();
    cx.spawn(async cx => {
      try {
        await writeDocument(path, text, baseline, on);
        doc.baseline = text; doc.dirty = doc.code.value() !== text;
        doc.message = "Saved";
      } catch (error) { doc.message = `Save failed: ${String(error)}. Your edits are kept.`; }
      finally { doc.saving = false; cx.notify(); }
    });
  }

  markdownFile() {
    return Boolean(this.document && /\.(md|markdown|mdown|mkd)$/i.test(this.file ?? ''));
  }

  updateMarkdown(doc, refreshText = true) {
    if (!doc.markdownContent) return;
    if (refreshText) { doc.markdownText = doc.code.value(); doc.markdownDirty = false; }
    doc.markdownContent.set_props({code:doc.code, text:doc.markdownText, preview:Boolean(doc.preview)});
  }

  ensureMarkdown(cx) {
    if (!this.markdownFile() || this.document.markdownContent) return false;
    const doc = this.document;
    doc.markdownText = doc.code.value(); doc.markdownDirty = false;
    doc.markdownContent = cx.new(MarkdownContent, {code:doc.code, text:doc.markdownText, preview:Boolean(doc.preview)});
    return true;
  }

  toggleMarkdown(cx) {
    if (!this.markdownFile()) return;
    this.ensureMarkdown(cx);
    const doc = this.document;
    doc.preview = !doc.preview;
    this.updateMarkdown(doc, Boolean(doc.preview && doc.markdownDirty));
    // Native editor attachment requires the containing panel to relayout.
    cx.notify();
  }

  fileContent(t) {
    if (!this.file) return div().p(styles.spacing.v12).text_color(t.dim).child('Select a file to edit');
    if (!this.code) return div().p(styles.spacing.v12).text_color(t.dim).child(this.fileError || 'Loading file…');
    if (this.markdownFile() && this.document.preview && this.document.markdownContent) return this.document.markdownContent;
    return Editor.new(this.code).w_full().min_w(0).flex_1().min_h(0);
  }

  rows(prefix, depth, out, t) {
    if (out.length >= TOTAL || depth > 40) return out;
    for (const entry of this.entries.get(prefix) ?? []) {
      if (out.length >= TOTAL) break;
      if (!this.showHidden && entry.name.startsWith(".")) continue;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name, open = this.folders.has(path), mark = this.marks[`${this.root}/${path}`];
      const color = entry.ignored ? t.dim : mark === "A" ? t.ansi2 : mark === "M" ? t.ansi3 : mark === "D" || mark === "U" ? t.ansi1 : t.foreground;
      out.push(h_flex().id(`file-${path}`).h(styles.components.files.fileRowHeight).flex_none().pl(styles.spacing.v8 + depth * styles.components.files.treeIndent).pr(styles.spacing.v8).gap(styles.spacing.v7).items_center().rounded(styles.radius.v0).cursor_pointer().text_color(color)
        .when(!entry.dir && this.file === path, el => el.bg(t.selected))
        .hover(s => s.bg(!entry.dir && this.file === path ? t.selected : t.hover))
        .on_mouse_down("right", (_e,cx)=>{cx.stop_propagation();openOverlay({mod:"blackx-files",kind:"popup",width:280,height:400,props:{fileMenu:true,path:`${this.root}/${path}`,destination:entry.dir?`${this.root}/${path}`:(path.includes("/")?`${this.root}/${path.slice(0,path.lastIndexOf("/"))}`:this.root),on:this.on}});})
        .on_click((_e, cx) => entry.dir ? this.toggle(path, cx) : this.show(path, cx, true, true))
        .child(entry.dir
          ? svg(open ? "folder-closed" : "folder").size(styles.components.files.glyph14).flex_none().text_color(color)
          : div().w(styles.components.files.glyph14).flex_none().font_family(styles.fonts.terminal).text_size(styles.components.files.glyph14).text_center().text_color(color).child(fileGlyph(entry.name)))
        .child(div().flex_1().min_w(0).truncate().child(entry.name))
        .child(div().flex_none().text_size(styles.components.files.captionText).text_color(entry.ignored ? t.dim : t.foreground).child(entry.dir ? entry.count == null ? "" : String(entry.count) : sizeLabel(entry.size))));
      if (entry.dir && open) this.rows(path, depth + 1, out, t);
    }
    return out;
  }

  applyRename(event, cx) {
    if (!event || (event.on ?? null) !== (this.on ?? null)) return;
    const windows = /^[A-Za-z]:[\\/]|^\\\\/.test(this.root ?? '');
    const clean = path => windows ? path.replace(/\\/g, '/') : path;
    const from = clean(event.from), to = clean(event.to), root = clean(this.root ?? '');
    const rewrite = path => path === from ? to : path.startsWith(from + '/') ? to + path.slice(from.length) : path;
    const relative = path => rewrite(root + '/' + path).slice(root.length + 1);
    for (const [key, doc] of [...this.drafts]) {
      if (!key.startsWith(this.context.key + '\n')) continue;
      const next = rewrite(clean(doc.path));
      if (next === clean(doc.path)) continue;
      this.drafts.delete(key); doc.path = next;
      this.drafts.set(this.context.key + '\n' + next.slice(root.length + 1), doc);
    }
    if (this.file) this.file = relative(this.file);
    this.folders = new Set([...this.folders].map(relative));
    this.entries.clear();
    this.fileRequest = (this.fileRequest ?? 0) + 1;
    this.context = {...this.context};
    this.loading = false; this.fileLoading = false; this.watched = null;
    this.pending = new Set();
    if (this.file && !this.document) this.show(this.file, cx);
  }

  render(cx) {
    syncTextSelection(cx);
    if (props()?.fileMenu) return menu(cx, props(), this);
    const revision=shared("blackx.files.revision");
    if(this.operationRevision!==revision){
      this.operationRevision=revision;
      const renamed=shared("blackx.files.rename");
      if(renamed?.revision===revision && this.context) this.applyRename(renamed,cx);
      this.refresh(cx);
    }
    rememberViewport(cx);
    // This render already paints restored state; only async completion needs a redraw.
    if (key() !== this.context?.key) this.refresh(cx, false);
    const t = theme();
    const type = typography("files"), signature = JSON.stringify([type, t.ansi1, t.ansi2, t.ansi3, t.ansi4, t.ansi5, t.ansi6, t.dim]);
    if (this.typographySignature && this.typographySignature !== signature) {
      // Native state and retained-view props must update outside render.
      cx.spawn(async cx => {
        for (const doc of this.drafts.values()) {
          const old = doc.code;
          doc.code = this.editor(old.value(), doc.path, doc.editable);
          if (doc.editable) doc.code.on("change", (_event, cx) => { doc.dirty = doc.code.value() !== doc.baseline; doc.markdownDirty = true; doc.message = ""; cx.notify(); });
          if (this.document === doc) this.code = doc.code;
          this.updateMarkdown(doc);
          old.release();
        }
        cx.notify();
      });
    }
    this.typographySignature = signature;
    const systemMode = (shared("blackx.editor") ?? "builtin") !== "builtin";
    if (systemMode) this.dividerDrag = null;
    return v_flex().id("files").on_size_change((size, cx) => { if (this.panelHeight !== size.height) { this.panelHeight = size.height; cx.notify(); } }).size_full().min_h(0).rounded(styles.radius.v0).overflow_hidden().bg(t.background).border_l(styles.border.v1).border_color(t.border).text_color(t.foreground).font_family(type.uiFont).text_size(type.size)
      .on_key_down((event, cx) => { if (event.keystroke === "cmd-s") { cx.stop_propagation(); this.save(cx); } })
      .child(h_flex().id("files-browser-split").items_stretch().h(this.panelHeight ?? styles.components.files.fallbackHeight).w_full()
        .on_size_change((size, cx) => { this.splitWidth = size.width; })
        .on_mouse_move((event, cx) => {
          if (!this.dividerDrag) return;
          this.treeWidth = Math.max(styles.components.files.treeMinWidth, Math.min((this.splitWidth ?? styles.components.files.fallbackWidth) - styles.components.files.treeMinWidth, this.dividerDrag.width + event.position.x - this.dividerDrag.x));
          cx.notify();
        })
        .on_mouse_up("left", (_event, cx) => { if (this.dividerDrag) { this.dividerDrag = null; localStorage.setItem("tree-width", String(this.treeWidth)); cx.notify(); } })
        .on_hover((hovered, cx) => { if (!hovered && this.dividerDrag) { this.dividerDrag = null; cx.notify(); } })
      .child(v_flex().min_h(0).when(systemMode, el => el.flex_1().w_full()).when(!systemMode, el => el.w(Math.max(styles.components.files.treeMinWidth, Math.min(this.treeWidth ?? Number(localStorage.getItem("tree-width") || styles.components.files.treeDefaultWidth), (this.splitWidth ?? styles.components.files.fallbackWidth) - styles.components.files.treeMinWidth))).flex_none())
        .child(h_flex().h(styles.components.files.headerHeight).flex_none().pl(styles.spacing.v14).pr(styles.spacing.v0).items_center().border_b(styles.border.v1).border_color(t.border)
          .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(this.root ?? "Files"))
          .child(div().id("files-hidden").h_full().w(styles.components.files.actionWidth).flex_none().flex().items_center().justify_center().cursor_pointer()
            .text_color(t.foreground).hover(s => s.bg(t.hover))
            .tooltip(this.showHidden ? "Hide hidden files" : "Show hidden files")
            .on_click((_event, cx) => { this.showHidden = !this.showHidden; localStorage.setItem("show-hidden", String(this.showHidden)); cx.notify(); })
            .child(eyeIcon(!this.showHidden)))
          .child(div().id("files-collapse").h_full().w(styles.components.files.actionWidth).flex_none().flex().items_center().justify_center().cursor_pointer()
            .text_color(t.foreground).hover(s => s.bg(t.hover).text_color(t.foreground)).tooltip("Collapse all folders")
            .on_click((_event, cx) => { this.folders.clear(); for (const path of [...this.entries.keys()]) if (path) this.entries.delete(path); cx.notify(); })
            .child(svg("mods/blackx-files/collapse-all.svg").size(styles.components.files.glyph14))))
      .child(v_flex().id("files-tree").on_mouse_down("right", (_e,cx)=>{cx.stop_propagation();if(this.root)openOverlay({mod:"blackx-files",kind:"popup",width:280,height:400,props:{fileMenu:true,rootMenu:true,path:this.root,destination:this.root,on:this.on}});}).flex_1().min_w(0).min_h(0).overflow_y_scrollbar().pt(styles.components.files.treePaddingTop).pb(styles.components.files.treePaddingBottom).px(styles.spacing.v0).children(this.rows("", 0, [], t))
        .when(Boolean(this.error) || !this.entries.get("")?.length, el => el.child(div().p(styles.spacing.v8).text_size(type.size).text_color(t.dim).child(this.error || (this.loading ? "Loading files…" : this.root ? "No files" : "No folder"))))
        .when(systemMode && Boolean(this.fileError || this.document?.message), el => el.child(div().px(styles.spacing.v8).py(styles.spacing.v4).text_color(t.muted).child(this.fileError || this.document?.message)))
        .when(this.limited, el => el.child(div().p(styles.spacing.v8).text_size(styles.components.files.captionText).text_color(t.dim).child("File list limited to 500 entries per folder and 5,000 total")))))
      .when(!systemMode, el => el.child(div().id("files-divider").relative().w(styles.components.files.dividerWidth).flex_none().cursor_col_resize().flex().justify_center()
        .on_mouse_down("left", (event, cx) => {
          cx.stop_propagation();
          this.dividerDrag = { x: event.position.x, width: this.treeWidth ?? Number(localStorage.getItem("tree-width") || styles.components.files.treeDefaultWidth) };
        })
        .child(div().w(styles.components.files.dividerWidth).h_full().bg(t.border))
        .child(div().absolute().top(styles.components.files.topOffset29).left(0).w(styles.components.files.dividerWidth).h(styles.components.files.dividerJointHeight).bg(t.border))))
      .when(!systemMode, el => el.child(v_flex().id("files-contents").flex_1().min_w(0).min_h(0).overflow_hidden()
        .child(h_flex().h(styles.components.files.headerHeight).flex_none().pl(styles.spacing.v14).pr(styles.spacing.v0).items_center().border_b(styles.border.v1).border_color(t.border)
          .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child((this.file ?? "Content") + (this.document?.dirty ? " *" : "")))
          .when(Boolean(this.code), el => el.child(div().id("file-wrap").h_full().w(styles.components.files.actionWidth).flex_none().flex().items_center().justify_center().cursor_pointer()
            .bg(this.wrapLines ? t.selected : t.background).text_color(t.foreground).hover(s => s.bg(t.hover))
            .tooltip(this.wrapLines ? "Disable line wrapping" : "Wrap text lines")
            .on_click((_event, cx) => { this.wrapLines = !this.wrapLines; localStorage.setItem("wrap-lines", String(this.wrapLines));
              for (const doc of this.drafts.values()) {
                const old = doc.code;
                doc.code = this.editor(old.value(), doc.path, doc.editable);
                if (doc.editable) doc.code.on("change", (_e, cx) => { doc.dirty = doc.code.value() !== doc.baseline; doc.markdownDirty = true; doc.message = ""; cx.notify(); });
                if (this.document === doc) this.code = doc.code;
                this.updateMarkdown(doc);
                old.release();
              }
              cx.notify(); })
            .child(svg("wrap-text").size(styles.components.files.glyph14).flex_none())))
          .when(this.markdownFile(), el => el.child(div().id("file-preview").h_full().w(styles.components.files.actionWidth).flex_none().flex().items_center().justify_center().cursor_pointer()
            .text_color(t.foreground).hover(s => s.bg(t.hover)).tooltip(this.document?.preview ? "Hide Markdown preview" : "Show Markdown preview")
            .on_click((_event, cx) => this.toggleMarkdown(cx))
            .child(eyeIcon(!this.document?.preview))))
          .when(Boolean(this.document?.editable && this.document?.dirty), el => el.child(div().id("file-save").h_full().px(styles.spacing.v8).flex_none().flex().items_center().rounded(styles.radius.v0).text_size(styles.components.files.controlText).bg(t.chrome).cursor_pointer()
            .text_color(t.foreground).hover(s => s.bg(t.hover))
            .on_click((_event, cx) => this.save(cx)).child(this.document.saving ? "Saving…" : "Save"))))
        .child(this.fileContent(t))
        .when(Boolean(this.document?.message), el => el.child(div().flex_none().px(styles.spacing.v8).py(styles.spacing.v4).text_size(styles.components.files.captionText).text_color(t.muted).child(this.document.message))))));
  }
}
