import { spaces, panes, focused, shared } from "herdr";
const remembered = new Map();
export function location() {
  const space = spaces().find(s => s.active);
  const f = focused();
  const pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
  const on = space?.machine ?? null;
  if (space && f?.terminal && f.cwd && (!pane || pane.cwd)) remembered.set(space.id, {cwd: pane?.cwd || f.cwd, on});
  const mode = shared("blackx.directory.mode") ?? "workspace";
  // Match Blackx's workspace path: first live terminal in the workspace.
  const workspacePath = panes().find(p => p.cwd && space?.tabs.some(tab => tab.id === p.tab))?.cwd || space?.folder;
  let cwd = workspacePath;
  if (mode === "terminal") cwd = remembered.get(space?.id)?.cwd || cwd;
  if (mode === "custom") {
    const value = String(shared("blackx.directory.custom") ?? "").trim();
    cwd = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(value) ? value : null;
  }
  return {cwd, on, space: space?.id};
}
