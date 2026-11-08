import { icon as svg } from "./icons.js";
import { nextCommand } from "herdr";
import { dispatch as run, openStyled as openOverlay, rememberViewport } from "./routing.js";
import { styles } from "./style.js";
import {View, div, image} from "gpui-kit";
import { h_flex, v_flex, set_theme } from "gpui-base";
import {theme,  props, window, shared, setShared, updates, layout} from "herdr";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < styles.sidebar.compactBelow;

// To the rail (on macOS wide enough for the traffic lights), or back to the width it had.
function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!narrow()) setShared("sidebar.width", width);
  // Mods edited before the rail went by width still read the flag.
  setShared("sidebar.collapsed", !narrow());
  run("layout.resize", { id: "sidebar", px: narrow() ? (shared("sidebar.width") ?? styles.sidebar.expanded) : styles.sidebar.rail });
}

export default class WorkspaceChrome extends View {
  init(_props, cx) { cx.spawn(async () => { for (;;) { const command = await nextCommand(); if (["close-tab", "close-space", "rename-tab", "rename-space", "help"].includes(command)) run({"close-tab":"tab.close","close-space":"space.close","rename-tab":"tab.rename","rename-space":"space.rename","help":"app.help"}[command]); else if (["settings", "palette", "picker"].includes(command)) run("mod.open", {name: "blackx-" + command}); } }); }
  button(id, label, action) {
    const t = theme();
    return div().id(id).h_full().flex_1().min_w(0).flex().items_center().justify_center().rounded(styles.radius.v0).text_color(t.foreground).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action).child(label);
  }
  render(cx) {
    const palette = theme(), selectionKey = `${palette.selected}:${cx.theme().appearance}`;
    if (this.selectionKey !== selectionKey) {
      this.selectionKey = selectionKey;
      cx.spawn(async (cx) => {
        const base = cx.theme(), palette = theme();
        // Native inputs blend accent at 50%; compensate to match selected rows.
        const rgb = palette.selected.replace("#", "").slice(0, 6);
        const inputAccent = "#" + [0, 2, 4].map(i => Math.min(255, parseInt(rgb.slice(i, i + 2), 16) * 2).toString(16).padStart(2, "0")).join("");
        set_theme({ appearance: base.appearance, tokens: {
          colors: { ...base.colors, selection: palette.selected, primary: palette.accent, accent: inputAccent },
          spacing: base.spacing, radius: base.radius,
        } });
      });
    }
    rememberViewport(cx);
    const t = theme();
    const collapsed = narrow();
    const root = h_flex().size_full().min_w(0).overflow_hidden().bg(t.chrome).border_r(styles.border.v1).border_b(styles.border.v1).border_color(t.border).px(styles.spacing.v0).gap(styles.spacing.v0).items_center();
    if (collapsed) {
      return root.px(styles.spacing.v0).justify_center().child(this.button("sidebar-toggle", svg("mods/blackx-chrome/caret-right.svg").size(styles.components.chrome.glyph14), toggleSidebar));
    }
    return root
      .when(window()?.platform === "macos" && !window()?.fullscreen, el => el.pl(styles.spacing.v76))
      .child(this.button("settings", svg("mods/blackx-chrome/settings.svg").size(styles.components.chrome.glyph14), () => run("mod.open", {name: "blackx-settings"})))
      .child(this.button("search", svg("mods/blackx-chrome/search.svg").size(styles.components.chrome.glyph14), () => run("mod.open", { name: "blackx-picker" })))
      .child(this.button("sidebar-toggle", svg("mods/blackx-chrome/caret-left.svg").size(styles.components.chrome.glyph14), toggleSidebar));
  }
}
