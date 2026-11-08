import { icon as svg, badge as identityBadge } from "./icons.js";
import { dispatch as run, openStyled as openOverlay, rememberViewport } from "./routing.js";
import { styles } from "./style.js";
import {View, div,  image} from "gpui-kit";
import { h_flex } from "gpui-base";
import {spaces, panes,   theme, window, shared, layout, settings} from "herdr";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

export default class Tabs extends View {
  init() {
    this.pressed = null;
    this.panels = JSON.parse(localStorage.getItem("panels") ?? "{}");
  }

  // The side panel is remembered per space: switching shows that space's choice
  // (closed if it never had one), and opening or closing it records it.
  syncPanel(space, panel, body, enabled) {
    if (!space || !panel) return;
    const now = panel.hidden ? null : body?.active ?? null;
    if (space.id !== this.space) {
      const first = this.space === undefined;
      this.space = space.id; this.pending = null;
      if (!(first && !(space.id in this.panels))) {
        const stored = this.panels[space.id] ?? null, want = enabled.includes(stored) ? stored : null;
        if (want !== now) {
          this.pending = { want, until: Date.now() + 1000 };
          if (want) { run("layout.select", { stack: "panel-body", child: want }); run("layout.show", { id: "panel" }); }
          else run("layout.hide", { id: "panel" });
          return;
        }
      }
    }
    // Until the restore lands (or something else won), the old state isn't a choice.
    if (this.pending) {
      if (this.pending.want !== now && Date.now() < this.pending.until) return;
      this.pending = null;
    }
    if (this.panels[space.id] === now) return;
    this.panels[space.id] = now;
    localStorage.setItem("panels", JSON.stringify(this.panels));
  }

  render(cx) {
    rememberViewport(cx);
    const t = theme();
    const space = spaces().find(p => p.active);
    const shown = space?.tabs ?? [];
    const stop = (_e, cx) => cx.stop_propagation();
    const button = (id, label, action) => div().id(id).size(styles.components.tabs.glyph26).flex_none().flex().items_center().justify_center().rounded(styles.radius.v6).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", stop).on_click(action).child(label);
    const item = (c, i) => {
      const program = panes().find(p => p.tab === c.id && p.program?.agent)?.program ?? panes().find(p => p.tab === c.id)?.program;
      const name = /^tb\d+$/.test(c.name) ? program?.name ?? "Terminal" : c.name;
      return h_flex().id(`tab-${c.id}`).h_full().min_w(styles.components.tabs.tabMinWidth).px(styles.spacing.v10).gap(styles.spacing.v7).rounded(styles.radius.v0).items_center().flex_none().text_size(styles.components.tabs.labelText)
        .when(i > 0, el => el.border_l(styles.border.v1)).border_color(t.border).when(i === shown.length - 1, el => el.border_r(styles.border.v1)).bg(c.active ? t.selected : t.chrome).text_color(c.active ? t.foreground : t.muted)
        .hover(s => s.bg(c.active ? t.selected : t.hover))
        .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i; if (e.click_count === 2) run("tab.rename", { id: c.id }); })
        .on_mouse_up("left", () => {
          const from = this.pressed; this.pressed = null;
          if (from !== null && from !== i) run("tab.move", { id: shown[from].id, index: space.tabs.findIndex(x => x.id === c.id) + 1 });
          else run("tab.select", { id: c.id });
        })
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "blackx-menu", kind: "popup", width: styles.components.tabs.menuWidth, props: { tab: "tab", target: { id: c.id, space: space.id } } }); })
        .child(identityBadge(program))
        .child(div().flex_1().min_w(0).max_w(styles.components.tabs.labelMaxWidth).truncate().child(c.zoomed ? `${name} Z` : name))
        .when(c.status === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(styles.components.tabs.glyph12).flex_none().text_color(t.working).spin(styles.motion.spinner)))
        .when(c.status === "blocked" || c.status === "done", el => el.child(div().size(styles.components.tabs.glyph6).rounded(styles.radius.v3).bg(t[c.status])))
        .when(c.active, el => el.child(div().id(`close-${c.id}`).text_color(t.dim).on_mouse_down("left", stop).on_click((_e, cx) => { cx.stop_propagation(); run("tab.close", { id: c.id }); }).child(svg("mods/pane/close.svg").size(styles.components.tabs.glyph12))));
    };
    const root = layout(), sidebar = find(root, "sidebar"), w = window();
    // Old saved rails and a dragged-narrow sidebar can be smaller than the window buttons.
    const lightsPadding = w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && root?.traffic_lights
      ? Math.max(0, (root.traffic_lights[0] + styles.components.tabs.trafficLightsWidth) / settings().zoom - (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0))
      : 0;
    const panel = find(root, "panel"), body = find(root, "panel-body");
    const enabled = shared("workspace.panels") ?? ["files", "changes"];
    this.syncPanel(space, panel, body, enabled);
    const panelButton = (id, label, icon) => {
      const on = panel && !panel.hidden && body?.active === id;
      return h_flex().id(`panel-${id}`).h_full().px(styles.spacing.v8).gap(styles.spacing.v5).flex_none().items_center().rounded(styles.radius.v0)
        .text_size(styles.components.tabs.controlText).bg(on ? t.selected : t.chrome).text_color(on ? t.foreground : t.muted)
        .hover(s => s.bg(t.hover)).on_mouse_down("left", stop)
        .on_click(() => {
          if (on) run("layout.hide", { id: "panel" });
          else { run("layout.select", { stack: "panel-body", child: id }); run("layout.show", { id: "panel" }); }
        }).child(svg(icon).size(styles.components.tabs.glyph14)).child(label);
    };
    return h_flex().size_full().min_w(0).px(styles.spacing.v0).pl(lightsPadding).gap(styles.spacing.v0).items_center().bg(t.chrome).border_b(styles.border.v1).border_color(t.border)
      .on_mouse_up("left", () => { this.pressed = null; })
      .on_scroll_wheel(e => { if (Math.abs(e.delta.y) >= 1) run(e.delta.y > 0 ? "tab.prev" : "tab.next"); })
      .child(h_flex().id("tab-scroll").flex_1().min_w(0).h_full().items_center().gap(styles.spacing.v0).overflow_x_scrollbar().children(shown.map(item))
        .child(button("tab-new", svg("mods/blackx-tabs/plus.svg").size(styles.components.tabs.glyph14).text_color(theme().foreground), () => openOverlay({ mod: "blackx-new-menu", kind: "popup", width: styles.components.tabs.newMenuWidth, height: styles.components.tabs.newMenuHeight })).h_full().w(styles.components.tabs.newTabWidth).rounded(styles.radius.v0).p(styles.spacing.v0).text_color(theme().foreground).cursor_pointer().tooltip("New tab")))
      .when(enabled.includes("files"), el => el.child(panelButton("files", "Files", "mods/files/file.svg")))
      .when(enabled.includes("changes"), el => el.child(panelButton("changes", "Changes", "mods/changes/changes.svg")))
      .when(w?.buttons, el => el.child(button("minimize", w.platform === "windows" ? svg("mods/blackx-tabs/win-min.svg").size(styles.components.tabs.glyph16) : svg("minus").size(14), () => run("window.minimize")))
        .child(button("maximize", w.platform === "windows" ? svg(`mods/blackx-tabs/${w.maximized ? "win-restore" : "win-max"}.svg`).size(styles.components.tabs.glyph16) : svg("square").size(14), () => run("window.maximize")))
        .child(button("close-window", w.platform === "windows" ? svg("mods/blackx-tabs/win-close.svg").size(styles.components.tabs.glyph16) : svg("mods/pane/close.svg").size(styles.components.tabs.glyph13), () => run("window.close"))));
  }
}
