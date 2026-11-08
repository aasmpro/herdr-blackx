import { icon as svg, badge as identityBadge } from "./icons.js";
import { dispatch as run, openStyled as openOverlay, rememberViewport } from "./routing.js";
import { styles } from "./style.js";
// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "blackx-pane" } } } }
// Shows the program's icon (the app's program table), the agent's name or
// the terminal's title, the folder, and the agent's status; buttons split, zoom and close
// this pane. Props from the app: { pane, terminal }. Click: focus the pane.

import {View, div,  image} from "gpui-kit";
import { h_flex } from "gpui-base";
import {panes, props,  theme, home} from "herdr";

function icon(p) { return identityBadge(p); }

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class Pane extends View {
  init() { this.hovered = false; }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  button(t, id, icon, command, args) {
    return div()
      .id(id)
      .h_full().w(styles.components.pane.actionWidth).flex_none().flex().items_center().justify_center().cursor_pointer()
      .rounded(styles.radius.v0)
      .text_color(t.muted)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`mods/blackx-pane/${icon}.svg`).size(styles.components.pane.glyph14));
  }

  render(cx) {
    rememberViewport(cx);
    const t = theme();
    const p = this.me();
    if (!p) return div();
    const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const pic = icon(p.program, 14, t.dim);
    const st = p.status;
    const pane = p.pane;
    return h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      .pl(styles.spacing.v10).pr(styles.spacing.v0)
      .gap(styles.spacing.v8)
      .items_center()
      .bg(t.background)
      .border_b(styles.border.v1)
      .border_color(t.border)
      .text_size(styles.components.pane.controlText)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_none().truncate().max_w(styles.components.pane.titleMaxWidth).font_medium().text_color(t.foreground).child(name))
      .child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
      .child(h_flex().h_full().flex_none().gap(styles.spacing.v0).items_center()
      .when(st === "working", el => el.child(div().h_full().w(styles.components.pane.actionWidth).flex_none().flex().items_center().justify_center().child(svg("mods/workspace-chrome/spinner.svg").size(styles.components.pane.glyph14).text_color(t.working).spin(styles.motion.spinner))))
      .when(st === "blocked", el => el.child(div().flex_none().px(styles.spacing.v6).h(styles.components.pane.badgeHeight).flex().items_center().rounded(styles.radius.v5).bg(t.blocked + styles.alpha.blocked).text_size(styles.components.pane.badgeText).font_semibold().text_color(t.blocked).child("Needs you")))
      .when(st === "done", el => el.child(div().size(styles.components.pane.glyph7).flex_none().rounded(styles.radius.v4).bg(t.done)))
      .when(this.hovered, el => el
        .child(this.button(t, `ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(this.button(t, `ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
        .child(this.button(t, `ph-x-${pane}`, "close", "pane.close", { pane }))));
  }
}
