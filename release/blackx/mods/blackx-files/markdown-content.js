import { View } from "gpui-kit";
import { v_flex, TextView } from "gpui-base";
import { styles } from "./style.js";

class Preview extends View {
  init(p) { this.text = p.text; }
  update(p) { this.text = p.text; }
  render() {
    return v_flex().id('file-markdown-preview').size_full().min_h(0).overflow_y_scrollbar().p(styles.spacing.v12)
      .child(TextView.markdown('file-markdown', this.text));
  }
}

// Retain the rendered preview between modes so unchanged text is parsed once.
export default class MarkdownContent extends View {
  init(p, cx) {
    this.code = p.code; this.text = p.text; this.preview = p.preview;
    this.rendered = cx.new(Preview, {text:p.text});
  }
  update(p) {
    this.code = p.code;
    if (p.text !== this.text) { this.text = p.text; this.rendered.set_props({text:p.text}); }
    this.preview = p.preview;
  }
  render() {
    return v_flex().id('file-markdown-content').size_full().flex_1().min_h(0)
      .child(this.rendered);
  }
}
