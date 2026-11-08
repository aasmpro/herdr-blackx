import { h_flex } from "gpui-base";
import { theme } from "herdr";
import { styles } from "./style.js";
import { svg } from "gpui-kit";
const aliases = {"arrow-right":"chevron-right", "messages":"panels-top-left","caret-left": "chevron-left", "caret-right": "chevron-right", "branch": "git-branch", "changes": "git-compare", "close": "x", "codex-mono": "brand-codex", "agent": "bot", "shell": "terminal", "coin": "coins", "collapse-all": "folder-closed", "refresh": "refresh-cw", "sidebar": "panel-left", "spinner": "loader-circle", "split-down": "rows-2", "split-right": "columns-2", "zoom": "maximize", "unzoom": "minimize", "win-close": "x", "win-max": "square", "win-min": "minus", "win-restore": "panels-top-left", "codex": "brand-codex", "claude": "brand-claude", "gemini": "bot", "opencode": "brand-opencode", "aider": "bot", "cursor": "bot", "copilot": "bot", "claude-code": "brand-claude", "pi": "brand-pi", "pi-coding-agent": "brand-pi", "open-code": "brand-opencode"};
const available = ["file-plus","copy","link","scissors","clipboard-paste","folder-open","trash-2","replace","copy-plus","wrap-text", "app-window", "archive", "bell", "bot", "calendar", "check", "chevron-down", "chevron-left", "chevron-right", "circle-check", "clock", "code", "coins", "columns-2", "command", "container", "database", "eye", "eye-off", "file", "file-text", "files", "folder", "folder-closed", "folder-plus", "git-branch", "git-compare", "keyboard", "layers", "loader-circle", "maximize", "minimize", "minus", "monitor", "palette", "panel-left", "panel-right", "panels-top-left", "pin", "pin-off", "plus", "refresh-cw", "rows-2", "search", "server", "settings", "shield", "square", "square-pen", "terminal", "x", "brand-codex", "brand-claude", "brand-pi", "brand-opencode"];
export function icon(path) {
 const name = String(path ?? "").split("/").pop().replace(/\.svg$/, "");
 const mapped = aliases[name] ?? name;
 return svg("mods/blackx-new-menu/icons/" + (available.includes(mapped) ? mapped : "app-window") + ".svg");
}

// Shared identity treatment for spaces, agents, headers and tabs.
export function badge(program) {
 const t = theme(), s = styles.identityIcon;
 const name = typeof program === "string" ? program : ["codex","claude","pi","opencode"].includes(program?.key) ? program.key : program?.icon ?? "agent";
 return h_flex().size(s.tileSize).flex_none().rounded(s.radius)
   .border(s.borderWidth).border_color(t.border).items_center().justify_center()
   .text_color(t.foreground).child(icon(name).size(s.glyphSize).text_color(t.foreground));
}
