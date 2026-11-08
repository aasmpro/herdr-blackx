import { menuItem } from "./menu-item.js";
import { icon as svg } from "./icons.js";
import { dispatch as run, openStyled as openOverlay, rememberViewport } from "./routing.js";
import { styles } from "./style.js";
// Asks before something destructive, e.g. "Close space?". Opened as a
// dialog with props { title, detail, command: { name, args } }.
// Enter confirms (runs the command), Esc cancels.

import {View, div} from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import {props, closeOverlay, theme} from "herdr";

export default class Confirm extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
  }

  yes() {
    const p = props();
    closeOverlay(p.overlay);
    run(p.command.name, p.command.args ?? {});
  }

  render(cx) {
    rememberViewport(cx);
    return this.renderContent(cx).border(styles.secondary.border).border_color(theme().border);
  }

  renderContent(cx) {
    const t = theme();
    const p = props() ?? {};
    const button = (id, label, onClick) =>
      menuItem(id, label, onClick);
    return v_flex()
      .id("confirm")
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "enter") this.yes();
        else if (e.key === "escape") closeOverlay(props().overlay);
        else return;
        cx.stop_propagation();
      })
      .size_full()
      .min_h(0)
      .p(styles.secondaryValues.confirm_p_18)
      .gap(styles.secondaryValues.confirm_gap_12)
      .bg(t.background)
      .text_size(styles.secondaryValues.confirm_text_size_13)
      .child(h_flex().items_center().child(div().flex_1().text_size(styles.secondaryValues.confirm_text_size_15).font_semibold().text_color(t.foreground).child(p.title ?? "Are you sure?")).child(div().text_size(styles.secondaryValues.confirm_text_size_11).text_color(t.dim).child("Esc")))
      .child(div().flex_1().min_h(0).overflow_y_scrollbar().text_color(t.muted).child(p.detail ?? ""))
      .child(
        v_flex()
          .w_full()
          .gap(0)
          .text_size(styles.secondaryValues.confirm_text_size_12)
          .child(button("no", "Cancel", () => closeOverlay(props().overlay)))
          .child(button("yes", "Confirm", () => this.yes())),
      );
  }
}
