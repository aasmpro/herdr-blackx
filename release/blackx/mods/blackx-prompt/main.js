import { icon as svg } from "./icons.js";
import { dispatch as run, openStyled as openOverlay, rememberViewport } from "./routing.js";
import { syncTextSelection, styles } from "./style.js";
// A text prompt. Enter saves, Esc cancels.
import {View, div} from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import {props, closeOverlay, theme} from "herdr";

export default class Prompt extends View {
  init(_props, cx) {
    this.text = props()?.value ?? "";
    this.input = InputState.new({ value: this.text });
    if (this.text) this.input.set_selected_range({ start: 0, end: this.text.length });
    this.input.on("change", (_e, cx) => { this.text = this.input.value(); cx.notify(); });
    this.input.on("submit", () => this.submit());
    this.inputFocused = true;
    this.input.on("focus", (_e, cx) => { this.inputFocused = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.inputFocused = false; cx.notify(); });
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    this.handle = cx.focus_handle();
  }

  submit() {
    const p = props();
    closeOverlay(p.overlay);
    run(p.command.name, { ...(p.command.args ?? {}), name: this.text });
  }

  key(e, cx) {
    if (e.key === "escape") { closeOverlay(props().overlay); cx.stop_propagation(); }
  }

  render(cx) {
    syncTextSelection(cx);
    rememberViewport(cx);
    return this.renderContent(cx).border(styles.secondary.border).border_color(theme().border);
  }

  renderContent() {
    const t = theme();
    const p = props() ?? {};
    const label = (text) => div().pt(styles.secondaryValues.prompt_pt_16).pb(styles.secondaryValues.prompt_pb_7).text_size(styles.secondaryValues.prompt_text_size_11_5).text_color(t.dim).child(text);
    const button = (id, text, primary, action) => h_flex().id(id).h(styles.secondaryValues.prompt_h_32).px(styles.secondaryValues.prompt_px_14).items_center().rounded(styles.secondary.radius)
      .border_1().border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.raised)
      .text_color(primary ? t.solid_foreground : t.foreground).text_size(styles.secondaryValues.prompt_text_size_12_5).font_medium().cursor_pointer()
      .hover(s => s.opacity(0.88)).on_click(action).child(text);
    return v_flex().id("prompt").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .w_full().min_h(0).p(styles.secondaryValues.prompt_p_18).bg(t.background).text_color(t.foreground)
      .child(h_flex().items_center().child(div().flex_1().text_size(styles.secondaryValues.prompt_text_size_15).font_semibold().child((p.title ?? "").replace(/^./, (c) => c.toUpperCase())))
        .child(div().text_size(styles.secondaryValues.prompt_text_size_11).text_color(t.dim).child("Esc")))
      .child(label("Name"))
      .child(Input.new(this.input).h(styles.secondaryValues.prompt_h_36).px(styles.secondaryValues.prompt_px_10).rounded(styles.secondary.radius).border_1().border_color(this.inputFocused ? t.accent : t.input).bg(t.background).text_size(styles.secondaryValues.prompt_text_size_12_8).text_color(t.foreground))
      .when(Boolean(p.hint), el => el.child(div().pt(styles.secondaryValues.prompt_pt_6).text_size(styles.secondaryValues.prompt_text_size_11_5).text_color(t.dim).child(p.hint)))
      .child(h_flex().pt(styles.secondaryValues.prompt_pt_20).gap(styles.secondaryValues.prompt_gap_8).justify_end()
        .child(button("pm-cancel", "Cancel", false, () => closeOverlay(p.overlay)))
        .child(button("pm-save", "Save", true, () => this.submit())));
  }
}
