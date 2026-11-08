import { icon as svg } from "./icons.js";
import { dispatch as run } from "./routing.js";
import { syncTextSelection, styles } from "./style.js";
// The keybind list (Herdr's prefix+?), grouped, filterable by typing.
// Reads keys.json through keys(); edit keys.json to change any of them.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { keys, props, closeOverlay, theme } from "herdr";

const GROUPS = [
  ["spaces", /^space\./],
  ["tabs", /^tab\./],
  ["panes", /^pane\./],
  ["agents", /^agent\./],
  ["terminal", /^terminal\.|^send:/],
  ["window", /./],
];

function label(action) {
  if (action.startsWith("send:")) return "type " + JSON.stringify(action.slice(5));
  const [name, arg] = action.split(":");
  const words = name.replace(/[._]/g, " ");
  return arg ? `${words} ${arg}` : words;
}

export default class Help extends View {
  init(_props, cx) {
    this.filter = "";
    this.input = InputState.new({ placeholder: "Type to filter…" });
    this.input.on("change", (_e, cx) => { this.filter = this.input.value(); cx.notify(); });
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    this.handle = cx.focus_handle();
  }

  render(cx) {
    syncTextSelection(cx);
    return this.renderContent(cx).border(styles.secondary.border).border_color(theme().border);
  }

  renderContent(cx) {
    const t = theme();
    const f = this.filter.toLowerCase();
    const all = keys().filter((k) => !f || k.keys.includes(f) || label(k.action).includes(f));
    const seen = new Set();
    const groups = GROUPS.map(([name, re]) => {
      const rows = all.filter((k) => !seen.has(k) && re.test(k.action) && (seen.add(k) || true));
      return [name, rows];
    }).filter(([, rows]) => rows.length > 0);
    return v_flex()
      .id("help")
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "escape") return closeOverlay(props().overlay);
      })
      .size_full()
      .min_h(0)
      .p(styles.secondaryValues.help_p_18)
      .gap(styles.secondaryValues.help_gap_14)
      .bg(t.background)
      .text_size(styles.secondaryValues.help_text_size_12)
      .child(
        h_flex()
          .h(styles.secondaryValues.help_h_22)
          .items_center()
          .justify_between()
          .child(div().text_size(styles.secondaryValues.help_text_size_15).font_semibold().text_color(t.foreground).child("Keybinds"))
          .child(div().text_size(styles.secondaryValues.help_text_size_11).text_color(t.dim).child("Esc")),
      )
      .child(Input.new(this.input).h(styles.secondaryValues.help_h_36).flex_none().px(styles.secondaryValues.help_px_10).rounded(styles.radius.v0).border_1().border_color(t.accent).bg(t.background).text_size(styles.secondaryValues.help_text_size_12_8).text_color(t.foreground))
      .child(
        v_flex()
          .flex_1()
          .min_h(0)
          .overflow_y_scrollbar()
          .py(styles.secondaryValues.help_py_2)
          .gap(styles.secondaryValues.help_gap_10)
          .children(
            groups.map(([name, rows]) =>
              v_flex()
                .gap(styles.secondaryValues.help_gap_2)
                .child(div().text_size(styles.secondaryValues.help_text_size_11_5).font_medium().text_color(t.dim).child(name))
                .children(
                  rows.map((k) =>
                    h_flex()
                      .h(styles.secondaryValues.help_h_32)
                      .px(styles.secondaryValues.help_px_8)
                      .rounded(styles.radius.v0)
                      .items_center()
                      .child(div().w(styles.secondaryValues.help_w_190).text_color(t.accent).child(k.keys + (k.section !== "global" ? `  (${k.section})` : "")))
                      .child(div().text_color(t.foreground).child(label(k.action))),
                  ),
                ),
            ),
          ),
      );
  }
}
