import { icon as svg } from "./icons.js";
import { dispatch as run, openStyled as openOverlay, rememberViewport } from "./routing.js";
import { styles } from "./style.js";
import {View, div,  image} from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import {theme, spaces, panes, knownAgents,   closeOverlay, props, window, keys, shared, setShared} from "herdr";

// The last agents each machine reported, shown at once while knownAgents() checks again.
const KNOWN = "new-menu.agents";

function shortcut(name) {
  const k = keys().find(b => b.section === "global" && b.action === name);
  if (!k?.keys.trim()) return "";
  const mac = window()?.platform === "macos";
  const names = mac ? { ctrl: "⌃", alt: "⌥", shift: "⇧", cmd: "⌘", fn: "fn" } : { ctrl: "Ctrl", alt: "Alt", shift: "Shift", cmd: "Super", fn: "Fn" };
  const alias = { secondary: mac ? "cmd" : "ctrl", super: "cmd", win: "cmd" };
  return k.keys.trim().split(/\s+/).map(stroke => {
    const parts = stroke.split("-");
    let key = parts.pop();
    if (key === "") { key = "-"; parts.pop(); }
    const held = new Set(parts.map(m => alias[m.toLowerCase()] ?? m.toLowerCase()));
    if (/^[A-Z]$/.test(key)) held.add("shift");
    const label = key.length === 1 ? key.toUpperCase() : key[0].toUpperCase() + key.slice(1).toLowerCase();
    return [...Object.keys(names).filter(m => held.has(m)).map(m => names[m]), label].join(mac ? "" : "+");
  }).join(" ");
}

export default class NewMenu extends View {
  init(_props, cx) {
    const machine = spaces().find(s => s.active)?.machine;
    const where = machine ?? "";
    this.agents = shared(KNOWN)?.[where] ?? [];
    this.handle = cx.focus_handle();
    this.handle.focus();
    if (props()?.mode === "spaces") return;
    cx.spawn(async cx => {
      try {
        this.agents = await knownAgents({ on: machine });
        setShared(KNOWN, { ...shared(KNOWN), [where]: this.agents });
      }
      catch { this.failed = true; }
      cx.notify();
    });
  }
  row(id, icon, name, action, hint = "", enabled = true) {
    const t = theme();
    return h_flex().id(id).h(styles.secondaryValues.new_menu_h_31).px(styles.secondaryValues.new_menu_px_9).gap(styles.secondaryValues.new_menu_gap_10).rounded(styles.secondary.radius).items_center().flex_none()
      .text_color(enabled ? t.foreground : t.dim).when(enabled, el => el.hover(s => s.bg(t.selected)))
      .on_click(() => { if (enabled) { closeOverlay(props().overlay); action(); } })
      .child(icon).child(div().flex_1().child(name)).child(div().text_size(styles.secondaryValues.new_menu_text_size_11).text_color(t.dim).child(hint));
  }
  render(cx) {
    rememberViewport(cx);
    return this.renderContent(cx).border(styles.secondary.border).border_color(theme().border);
  }

  renderContent() {
    const t = theme();
    const machine = props()?.machine;
    const candidates = spaces().filter(s => machine === undefined || (s.machine ?? "") === machine);
    const space = candidates.find(s => s.active) ?? (machine !== undefined ? candidates[0] : undefined);
    const folder = space && (panes().find(p => p.focused && space.tabs.some(tab => tab.id === p.tab) && p.cwd)?.cwd
      ?? panes().find(p => space.tabs.some(tab => tab.id === p.tab) && p.cwd)?.cwd ?? space.folder);
    if (props()?.mode === "spaces") return v_flex().w_full().bg(t.background)
      .p(styles.secondaryValues.new_menu_p_5).text_size(styles.secondaryValues.new_menu_text_size_12_8)
      .id("space-new-menu").track_focus(this.handle)
      .child(this.row("space", svg("plus").size(styles.secondaryValues.new_menu_size_14), "New space", () => run("space.new", machine === undefined ? {} : { machine }), shortcut("space.new")))
      .child(this.row("worktree", svg("mods/workspace-chrome/branch.svg").size(styles.secondaryValues.new_menu_size_14), "New worktree…", () => openOverlay({ mod: "blackx-worktree", kind: "dialog", width: 460, height: 280, props: { space: space?.id, folder, action: "new" } }), "", Boolean(space)))
      .child(this.row("worktree-open", svg("mods/workspace-chrome/branch.svg").size(styles.secondaryValues.new_menu_size_14), "Open worktree\u2026", () => openOverlay({ mod: "blackx-worktree", kind: "dialog", width: 560, height: 480, props: { space: space?.id, folder, action: "open" } }), "", Boolean(space)));
    const installed = this.agents.filter(a => a.installed);
    const choices = [...installed, ...this.agents.filter(a => !a.installed).slice(0, 2)];
    return v_flex().w_full().bg(t.background).p(styles.secondaryValues.new_menu_p_5).text_size(styles.secondaryValues.new_menu_text_size_12_8)
      .id("new-menu").track_focus(this.handle)
      .on_key_down((e) => {
        if (e.modifiers.control || e.modifiers.platform || e.modifiers.alt) return;
        const agent = /^[1-9]$/.test(e.key) ? installed[Number(e.key) - 1] : null;
        if (!agent) return;
        closeOverlay(props().overlay);
        run("tab.new", { name: agent.name, space: space?.id, argv: agent.run });
      })
      .child(this.row("terminal", svg("icons/shell.svg").size(styles.secondaryValues.new_menu_size_14), "Terminal", () => run("tab.new", { space: space?.id }), shortcut("tab.new")))
      .children(choices.map((a, i) => this.row(a.key, a.tint ? svg(a.icon).size(styles.secondaryValues.new_menu_size_14).text_color(t.foreground) : svg(a.icon).size(styles.secondaryValues.new_menu_size_14), a.name,
        () => run("tab.new", { name: a.name, space: space?.id, argv: a.run }), a.installed ? (i < 9 ? String(i + 1) : "") : "not installed", a.installed)))
      .when(this.agents.length === 0, el => el.child(div().px(styles.secondaryValues.new_menu_px_9).py(styles.secondaryValues.new_menu_py_6).text_color(t.dim).child(this.failed ? "Could not load agents" : "Checking installed agents…")));
  }
}
