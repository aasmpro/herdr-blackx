import { div } from "gpui-kit";
import { theme } from "herdr";

// File menus and confirmation actions use the same row, spacing and hover state.
export function menuItem(id, label, onClick, enabled = true, icon = null) {
  const t = theme();
  return div().id(id).w_full().px(12).py(7)
    .text_color(enabled ? t.foreground : t.dim)
    .when(enabled, row => row.cursor_pointer().hover(s => s.bg(t.hover)).on_click(onClick))
    .when(Boolean(icon), row => row.flex().items_center().gap(8).child(icon))
    .child(label);
}
