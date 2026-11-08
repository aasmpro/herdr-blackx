import { icon as svg } from "./icons.js";
import { dispatch as run } from "./routing.js";
import { styles } from "./style.js";
// One window for this launch's unpresented spotlights. The app supplies the
// release range; only entries shown in full here count as presented.
import { View, div, image } from "gpui-kit";
import { v_flex, h_flex, Scrollbar } from "gpui-base";
import { theme, props, closeOverlay, presentUpdateNotes, updates } from "herdr";
import { versionHeader, releaseItems } from "./release-notes.js";

export default class WhatsNew extends View {
  init(_props, cx) {
    this.notes = props()?.notes ?? updates().notes ?? [];
    presentUpdateNotes(this.notes.filter(n => n.spotlight).map(n => n.version));
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(600, () => this.handle.focus());
  }

  done() {
    closeOverlay(props().overlay);
  }

  releaseNotes(t) {
    const body = v_flex().gap(styles.secondaryValues.whatsnew_gap_18);
    for (const note of this.notes) {
      const current = updates().notes?.find(n => n.version === note.version) ?? note;
      const entry = v_flex().gap(styles.secondaryValues.whatsnew_gap_16)
        .child(versionHeader(t, note))
        .child(releaseItems(t, current, { width: this.notesWidth, onSizeChange: (size, cx) => { this.notesWidth = size.width; cx.notify(); } }));
      body.child(entry);
    }
    return body;
  }

  render(cx) {
    return this.renderContent(cx).border(styles.secondary.border).border_color(theme().border);
  }

  renderContent(cx) {
    const t = theme();
    return v_flex()
      .id("whatsnew").track_focus(this.handle).size_full().bg(t.background)
      .on_key_down((e, cx) => {
        if (e.key === "escape" || e.key === "enter") {
          this.done();
          cx.stop_propagation();
        }
      })
      .child(h_flex().flex_none().h(styles.secondaryValues.whatsnew_h_52).cursor_grab().pl(styles.secondaryValues.whatsnew_pl_20).pr(styles.secondaryValues.whatsnew_pr_12).gap(styles.secondaryValues.whatsnew_gap_10).items_center().border_b(1).border_color(t.border)
        .child(svg("terminal").size(styles.secondaryValues.whatsnew_w_24).flex_none())
        .child(div().text_size(styles.secondaryValues.whatsnew_text_size_14).font_semibold().text_color(t.foreground).child("What's new in Herdr"))
        .child(div().flex_1())
        .child(div().id("wn-close").size(styles.secondaryValues.whatsnew_size_26).rounded(styles.radius.v0).flex().items_center().justify_center()
          .text_color(t.muted).cursor_pointer().hover(s => s.bg(t.hover).text_color(t.foreground))
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click(() => this.done()).child(svg("mods/workspace-chrome/x.svg").size(styles.secondaryValues.whatsnew_size_14))))
      .child(div().relative().flex_1().min_h(0)
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .child(div().id("wn-body").size_full().overflow_y_scroll()
          .child(div().px(styles.secondaryValues.whatsnew_px_22).pt(styles.secondaryValues.whatsnew_pt_20).pb(styles.secondaryValues.whatsnew_pb_20).child(this.releaseNotes(t))))
        .child(Scrollbar.vertical("wn-body").mode("always").absolute().inset_0()))
      .child(h_flex().flex_none().px(styles.secondaryValues.whatsnew_px_16).py(styles.secondaryValues.whatsnew_py_12).gap(styles.secondaryValues.whatsnew_gap_8).items_center().border_t(1).border_color(t.border)
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .child(div().pl(styles.secondaryValues.whatsnew_pl_6).flex_1().text_size(styles.secondaryValues.whatsnew_text_size_12).text_color(t.dim).child("Something off or missing? Settings › Send feedback."))
        .child(h_flex().id("wn-done").h(styles.secondaryValues.whatsnew_h_30).px(styles.secondaryValues.whatsnew_px_12).items_center().rounded(styles.radius.v0).cursor_pointer()
          .text_size(styles.secondaryValues.whatsnew_text_size_12_5).font_medium().bg(t.solid).text_color(t.solid_foreground).hover(s => s.opacity(0.88))
          .on_click(() => this.done()).child("Got it")));
  }
}
