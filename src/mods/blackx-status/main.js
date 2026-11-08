import { icon as svg } from "./icons.js";
import { dispatch as run, openStyled as openOverlay, rememberViewport } from "./routing.js";
import { styles } from "./style.js";
import {View, div} from "gpui-kit";
import { h_flex } from "gpui-base";
import {spaces, agents, theme,  window, keys, exec, appHome, focused, terminals} from "herdr";

export default class WorkspaceStatus extends View {
  init(_props, cx) {
    this.usage = null; this.cache = {}; this.provider = "codex";
    this.refresh = cx => {
      if (this.busy) return;
      this.busy = true;
      cx.spawn(async cx => {
        try {
          const provider = this.provider;
          const result = await exec("python3", [appHome() + "/mods/blackx-status/usage.py", provider]);
          const data = JSON.parse(result.stdout);
          if (data.error) this.error = data.error;
          else { this.cache[provider] = data; this.error = null; }
          this.usage = this.cache[this.provider] ?? null;
          this.lastRefresh = Date.now();
        } catch (error) { this.error = String(error); }
        finally { this.busy = false; cx.notify(); }
      });
    };
    this.refresh(cx);
    cx.timer.every(60000, cx => cx.notify());
    cx.timer.every(15000, cx => { this.refresh(cx); });
  }

  usageBar(icon, value, t) {
    value = value || {};
    const valid = typeof value.used_percent === "number" && Number.isFinite(value.used_percent) && Number(value.resets_at) * 1000 > Date.now();
    const percent = valid ? Math.max(0, Math.min(100, 100 - value.used_percent)) : null;
    const secondsLeft = Number(value.resets_at) - Date.now() / 1000;
    const minutesLeft = Math.max(0, Math.ceil(secondsLeft / 60));
    const days = Math.floor(minutesLeft / 1440);
    const hours = Math.floor((minutesLeft % 1440) / 60);
    const minutes = minutesLeft % 60;
    const resetText = value.resets_at == null || !Number.isFinite(secondsLeft)
      ? "—"
      : secondsLeft <= 0 ? "reset pending"
      : days > 0 ? `${days}d ${hours}h ${minutes}m`
      : hours > 0 ? `${hours}h ${minutes}m`
      : `${minutes}m`;
    return h_flex().id(`usage-${icon}`).gap(styles.spacing.v6).items_center().cursor_pointer()
      .tooltip("click for update")
      .on_click((_event, cx) => this.refresh(cx))
      .child(svg(`mods/blackx-status/${icon}.svg`).size(styles.components.status.glyph13).text_color(t.muted))
      .child(percent == null ? "—" : `${Math.round(percent)}%`)
      .child(div().text_color(t.dim).child(`(${resetText})`));
  }

  // The palette key as actually bound, not a hardcoded one; without a
  // binding the hint stays useful ("commands") instead of lying.
  hint(t) {
    const mac = window()?.platform === "macos";
    const mod = { cmd: mac ? "⌘" : "Ctrl+", ctrl: mac ? "⌃" : "Ctrl+", shift: mac ? "⇧" : "Shift+", alt: mac ? "⌥" : "Alt+", option: mac ? "⌥" : "Alt+" };
    const b = keys().find((k) => k.section === "layout:blackx" && k.action === "blackx-chrome.palette") ?? keys().find((k) => k.section === "global" && k.action === "app.palette");
    const parts = b && b.keys.endsWith("--") ? [...b.keys.slice(0, -2).split("-"), "-"] : b?.keys.split("-");
    const key = parts && parts.map((p) => mod[p.toLowerCase()] ?? p.toUpperCase()).join("");
    return key ? `${key}  commands` : "commands";
  }

  render(cx) {
    rememberViewport(cx);
    const terminal = terminals().find(t => t.address === focused()?.terminal);
    const agent = agents().find(a => a.address === focused()?.terminal);
    const provider = /claude/i.test(JSON.stringify((agent || terminal)?.program || "")) ? "claude" : "codex";
    if (provider !== this.provider) { this.provider = provider; this.usage = this.cache[provider] ?? null; this.error = null; this.refresh(cx); }
    const t = theme();
    const space = spaces().find(s => s.active);
    const list = space ? agents().filter(a => a.space === space.id) : [];
    const needs = list.filter(a => a.status === "blocked").length;
    const label = (icon, text) => h_flex().gap(styles.spacing.v6).items_center().child(svg(`mods/workspace-chrome/${icon}.svg`).size(styles.components.status.glyph13)).child(text);
    return h_flex().size_full().px(styles.spacing.v14).gap(styles.spacing.v16).items_center().bg(t.chrome).border_t(styles.border.v1).border_color(t.border).text_size(styles.components.status.statusText).text_color(t.muted)
      .child(label(space?.machine ? "server" : "monitor", space?.machine ?? "This computer"))
      .when(Boolean(space?.branch), el => el.child(label("branch", space.branch)))
      .child(h_flex().gap(styles.spacing.v6).items_center().child(div().size(styles.components.status.glyph6).rounded(styles.radius.v3).bg(t.dim)).child(`${list.length} ${list.length === 1 ? "agent" : "agents"}`)
        .when(needs > 0, el => el.child(div().text_color(t.blocked).child(`· ${needs} needs you`))))
      .child(div().flex_1())
      .child(div().child(`${this.provider === "claude" ? "Claude" : "Codex"}${space?.machine ? " (local)" : ""}${this.error || (this.usage && Date.now()/1000-this.usage.timestamp>300) ? " · stale" : ""}`))
      .when(Boolean(this.usage), el => el
        .child(this.usageBar("clock", this.usage.primary, t))
        .child(this.usageBar("calendar", this.usage.secondary, t))
        .when(this.usage.credits?.balance != null || this.usage.credits?.unlimited, el => el.child(
          h_flex().id("usage-credits").gap(styles.spacing.v6).items_center().cursor_pointer().on_click((_event, cx) => this.refresh(cx))
            .child(svg("mods/blackx-status/coin.svg").size(styles.components.status.glyph13).text_color(t.muted))
            .child(this.usage.credits.unlimited ? "∞" : Math.round(Number(this.usage.credits.balance)).toLocaleString()))))
      .when(!this.usage, el => el.child(div().id("usage-retry").cursor_pointer().on_click((_event, cx) => this.refresh(cx)).tooltip("click for update").child("Usage unavailable · Retry")));
  }
}
