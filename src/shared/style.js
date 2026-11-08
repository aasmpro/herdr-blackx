import { set_theme } from "gpui-base";
// Generated into each mod with resolved style tokens. No cross-mod dependency.
import { settings, layout, theme } from "herdr";
export const styles = __STYLE_TOKENS__;

// Preserve the existing Files and diff font policies; these are intentionally distinct.
export function typography(target = "files") {
  const config = settings(), root = layout();
  if (target === "diff") return { font: root?.font ?? config.font_family ?? config.font ?? styles.fonts.fallbackTerminal };
  return {
    size: Number(root?.font_size ?? config.font_size ?? styles.fonts.fallbackSize),
    font: root?.font ?? config.font_family ?? config.font ?? styles.fonts.fallbackTerminal,
    uiFont: root?.ui_font ?? config.ui_font ?? config.font_family ?? config.font ?? styles.fonts.fallbackUi,
  };
}

// Native inputs blend accent at 50%. The native editor additionally dims
// selection internally; its opacity is not exposed by the installed API.
// Apply through a host task because set_theme is not legal during render.
let selectionPending = false;
export function syncTextSelection(cx) {
  const t = theme(), base = cx.theme();
  if (base.colors.selection === t.selected && base.colors.accent === styles.native.inputSelectionAccent) return;
  if (selectionPending) return;
  selectionPending = true;
  cx.spawn(async (cx) => {
    try {
      const current = cx.theme();
      set_theme({ appearance: current.appearance, tokens: {
        colors: { ...current.colors, selection: theme().selected, primary: theme().accent, accent: styles.native.inputSelectionAccent },
        spacing: current.spacing, radius: current.radius,
      } });
    } finally { selectionPending = false; }
  });
}
