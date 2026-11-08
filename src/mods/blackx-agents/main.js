import Spaces from "./space-view.js";
import { icon as svg, badge as identityBadge } from "./icons.js";
import { dispatch as run, openStyled as openOverlay, rememberViewport } from "./routing.js";
import { styles } from "./style.js";
// Agents in grouped or priority views; parents take their most urgent sub-agent's place.
// A viewed done agent stays in Done until left.

import {View, div, image} from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import {agents, terminals, panes, focused, spaces, machines, theme, shared, setShared, setAgentOrder,  closeOverlay, props, window, layout} from "herdr";

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
  run("layout.resize", { id: "sidebar", px: narrow() ? (shared("sidebar.width") ?? styles.sidebar.expanded) : window()?.platform === "macos" ? styles.sidebar.macRail : styles.sidebar.rail });
}

const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

function leadPanes(all) {
  const leads = new Map();
  for (const p of all) {
    if (!p.terminal) continue;
    const current = leads.get(p.tab);
    // First agent, else first focused terminal, else first terminal in the tab.
    if (!current || (!current.program?.agent && (p.program?.agent || (!current.focused && p.focused)))) leads.set(p.tab, p);
  }
  return leads;
}

function title(tab, l) {
  const prog = l?.program?.name;
  const live = clean(l?.title);
  const telling = live && live !== prog && !/^[~/]|^[A-Za-z]:\\/.test(live) && !live.includes("@") && live.toLowerCase() !== l?.program?.key;
  return (tab.name === prog || !tab.named) && telling ? live : tab.name;
}
const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
// A sub-agent without a pane isn't in agents(): its raw word, error counting as
// blocked. It's never done: it reports to its parent, and the parent's done is the news.
const kidStatus = (k, listed) => {
  const s = listed.get(k.address) ?? k.status;
  return s === "error" ? "blocked" : s === "done" ? "idle" : s;
};
const SORTS = [
  { id: "priority", label: "Priority", icon: "clock" },
  { id: "grouped", label: "Grouped by space", icon: "layers" },
];
const sortOf = () => SORTS.find((s) => s.id === shared("agents.sort")) ?? SORTS[0];
const SECTION = { 4: "Needs you", 3: "Done", 2: "Working", 1: "Idle" };
const SECTION_STATUS = { 4: "blocked", 3: "done", 2: "working" };

function duration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

// Program icons tinted to match the monochrome UI.
function icon(p) { return identityBadge(p); }

export default class Agents extends Spaces {
  init(_props, cx) {
    if (props()?.sortMenu) return;
    super.init(_props, cx);
    this.folded = new Set(JSON.parse(localStorage.getItem("combined.folded") ?? "[]"));
    // Each agent's last state and when it changed (ms), kept across restarts.
    this.changed = JSON.parse(localStorage.getItem("changed") ?? "{}");
    this.pendingPins = JSON.parse(localStorage.getItem("pins") ?? "[]");
    if (!this.pendingPins.length) localStorage.removeItem("pins");
    this.migratingPins = new Set();
    cx.timer.every(30000, (cx) => cx.notify());
  }

  // Stamps agents whose state changed. Done and idle count as one: looking at a
  // finished agent turns done into idle, and looking isn't the agent doing anything.
  track(list, now) {
    let dirty = false;
    for (const a of list) {
      const s = a.status === "done" ? "idle" : a.status;
      if (this.changed[a.address]?.s === s) continue;
      this.changed[a.address] = { s, at: now };
      dirty = true;
    }
    if (!dirty) return;
    // Gone and old: the list alone is empty right after a start.
    const listed = new Set(list.map((a) => a.address));
    for (const [k, c] of Object.entries(this.changed)) if (!listed.has(k) && now - c.at > 30 * 86400000) delete this.changed[k];
    localStorage.setItem("changed", JSON.stringify(this.changed));
  }

  // Keep offline pins until their terminal returns, and keep each pending until
  // core echoes the label so a failed write doesn't erase the old pin.
  migratePins(all) {
    const listed = new Map(all.filter((t) => t.state === "live").map((t) => [t.address, t]));
    const pending = this.pendingPins.filter((address) => {
      const terminal = listed.get(address);
      if (!terminal) return true;
      if (terminal.labels?.["herdr.pinned"]) return false;
      if (!this.migratingPins.has(address)) {
        this.migratingPins.add(address);
        run("terminal.pin", { terminal: address, pinned: true });
      }
      return true;
    });
    if (pending.length === this.pendingPins.length) return;
    this.pendingPins = pending;
    if (pending.length) localStorage.setItem("pins", JSON.stringify(pending));
    else localStorage.removeItem("pins");
  }

  since(a) {
    return this.changed[a.address]?.at ?? 0;
  }

  // Looking at a done agent makes it idle; it stays with Done until you leave
  // it rather than drop away under you. Any other change moves it at once.
  hold(list) {
    const cur = list.find((a) => a.focused);
    const same = cur && cur.address === this.held?.address;
    // Arriving, or any change but done turning idle, sets what it was.
    if (!same || cur.status !== "idle") this.held = cur ? { address: cur.address, rank: RANK[cur.status] ?? 0 } : null;
  }

  rank(a) {
    const sawDone = a.address === this.held?.address && this.held.rank === RANK.done && a.status === "idle";
    return sawDone ? RANK.done : RANK[a.status] ?? 0;
  }

  sortMenu(t) {
    const on = sortOf().id;
    return v_flex()
      .w_full()
      .p(styles.spacing.v5)
      .bg(t.popover)
      .text_size(styles.components.agents.labelText)
      .child(div().px(styles.spacing.v8).pt(styles.spacing.v4).pb(styles.spacing.v6).text_size(styles.components.agents.captionText).text_color(t.dim).child("Sort agents"))
      .children(SORTS.map((s) => h_flex()
        .id(`sort-${s.id}`)
        .h(styles.components.agents.sortRowHeight)
        .px(styles.spacing.v8)
        .gap(styles.spacing.v9)
        .rounded(styles.radius.v0)
        .items_center()
        .text_color(t.foreground)
        .hover((el) => el.bg(t.hover))
        .on_click(() => {
          setShared("agents.sort", s.id);
          closeOverlay(props().overlay);
        })
        .child(svg(`mods/workspace-chrome/${s.icon}.svg`).size(styles.components.agents.glyph14).flex_none().text_color(t.muted))
        .child(div().flex_1().child(s.label))
        .when(s.id === on, (el) => el.child(svg("mods/workspace-chrome/check.svg").size(styles.components.agents.glyph14).flex_none().text_color(t.foreground)))));
  }

  peek(addr) {
    run("terminal.peek", { terminal: addr });
  }

  // Live sub-agents of `addr`, depth first, each with the tree lines in front of it.
  tree(all, addr, lead = []) {
    const kids = all.filter((k) => k.parent === addr && k.state === "live");
    return kids.flatMap((k, i) => {
      const last = i === kids.length - 1;
      return [
        { t: k, lines: [...lead, last ? "└" : "├"] },
        ...this.tree(all, k.address, [...lead, last ? "" : "│"]),
      ];
    });
  }

  subRow(t, s, shown, compact) {
    const k = s.t;
    const st = kidStatus(k, this.listed);
    const pic = icon(k.program, styles.components.agents.subagentIconSize, t.foreground);
    const on = k.address === shown;
    return h_flex()
      .id(`sub-${k.address}`)
      .pl(styles.spacing.v39)
      .pr(styles.spacing.v8)
      .rounded(styles.radius.v0)
      .h(styles.components.agents.subagentRowHeight)
      .flex_none()
      .gap(styles.spacing.v0)
      .items_center()
      .text_size(styles.components.agents.subagentText)
      .when(on, (el) => el.bg(t.raised))
      .hover((s) => s.bg(t.raised).text_color(t.foreground))
      .on_click(() => this.peek(k.address))
      .children(s.lines.map(l => div().self_start().mt(styles.spacing.vneg4).w(styles.components.agents.treeLineWidth).h(styles.components.agents.treeLineHeight).mr(styles.spacing.v4).flex_none()
        .when(Boolean(l), el => el.border_l(styles.border.v1).border_color(t.border))
        .when(l === "└" || l === "├", el => el.border_b(styles.border.v1).rounded_bl(styles.radius.v6))))
      .when(Boolean(pic), el => el.child(div().mr(styles.spacing.v8).child(pic)))
      .child(div().flex_1().truncate().text_color(on ? t.foreground : t.muted).child(k.name || k.template || k.program?.name || k.address))
      .child(this.status(t, { status: st }, compact));
  }

  // compact: a ! for blocked where a header already says "Needs you".
  status(t, a, compact = false) {
    const color = t[a.status] ?? t.dim;
    if (a.status === "working") return svg("mods/workspace-chrome/spinner.svg").size(styles.components.agents.glyph12).mx(styles.spacing.v1).flex_none().text_color(t.working).spin(styles.motion.spinner);
    if (a.status === "blocked" && compact) return div().size(styles.components.agents.glyph14).flex_none().rounded(styles.radius.v4).bg(t.blocked + styles.alpha.blocked).text_size(styles.components.agents.badgeText).font_bold().text_color(t.blocked).flex().items_center().justify_center().child("!");
    if (a.status === "blocked") return div().flex_none().px(styles.spacing.v6).h(styles.components.agents.badgeHeight).rounded(styles.radius.v5).bg(t.blocked + styles.alpha.blocked).text_size(styles.components.agents.badgeText).font_semibold().text_color(t.blocked).flex().items_center().child("Needs you");
    // Idle: a ring; done: a dot.
    if (a.status === "idle") return div().size(styles.components.agents.glyph7).mx(styles.spacing.v3).flex_none().rounded(styles.radius.v4).border(styles.border.v1).border_color(t.border);
    return div().size(styles.components.agents.glyph7).mx(styles.spacing.v3).flex_none().rounded(styles.radius.v4).bg(a.status === "done" ? color : t.dim + styles.alpha.transparent);
  }

  render(cx) {
    rememberViewport(cx);
    const t = theme();
    if (props()?.sortMenu) return this.sortMenu(t);
    const collapsed = narrow();
    const sort = sortOf();
    let list = agents();
    this.listed = new Map(list.map((a) => [a.address, a.status]));
    const all = terminals();

    const shown = focused()?.agent;
    const now = Date.now();
    this.track(list, now);
    this.hold(list);
    const byPriority = true;
    const urgency = new Map(list.map((a) => [a.address, Math.max(this.rank(a), ...this.tree(all, a.address).map((s) => RANK[kidStatus(s.t, this.listed)] ?? 0))]));
    const rankOf = (a) => urgency.get(a.address);
    if (byPriority) list = [...list].sort((x, y) => rankOf(y) - rankOf(x) || this.since(y) - this.since(x) || y.seq - x.seq);

    setAgentOrder(list.map((a) => a.address));

    const withKids = (a, i) => {
      const subs = collapsed ? [] : this.tree(all, a.address);
      const r = row(a, i, subs);

      return [r, ...subs.map((s) => this.subRow(t, s, shown, byPriority))];
    };

    // A row reads "space \u00b7 detail": the detail is a tab someone named or the
    // agent's own title, never an automatic tab number unless two rows would
    // otherwise read the same.
    // Read the pane snapshot once: every host read copies the whole list into JS.
    const leads = leadPanes(panes());
    const tabLabels = new Map(spaces().flatMap(s => s.tabs).map(tab => [tab.id, title(tab, leads.get(tab.id))]));
    const labels = new Map(list.map(a => [a.address, tabLabels.get(a.tab) ?? (a.title || a.program?.name || "")]));
    const label = (a) => labels.get(a.address);
    const detail = new Map(list.map(a => [a.address, /^\d+$/.test(label(a)) ? null : label(a)]));
    const seen = {};
    for (const a of list) { const k = `${a.space_name}\u0000${detail.get(a.address) ?? ""}`; seen[k] = (seen[k] ?? 0) + 1; }
    for (const a of list) {
      if (detail.get(a.address) == null && seen[`${a.space_name}\u0000`] > 1) detail.set(a.address, label(a));
    }

    const row = (a, i, subs = []) => {
      const pic = icon(a.program, styles.components.agents.agentIconSize, t.foreground);
      const more = detail.get(a.address);
      if (collapsed) {
        return h_flex()
          .id(`ag-${a.address}`)
          .h(styles.components.agents.rowHeight)
          .px(styles.spacing.v0)
          .flex_none()
          .items_center()
          .justify_center()
          .gap(styles.spacing.v4)
          .when(a.focused, (el) => el.bg(t.raised))
          .hover((s) => s.bg(t.raised).text_color(t.foreground))
          .on_click(() => run("pane.focus", { pane: a.pane }))
          .child(div().flex_none().whitespace_nowrap().text_center().text_color(a.focused ? t.foreground : t.muted).child(String(i + 1)))
          .child(h_flex().w(styles.components.agents.statusWidth).flex_none().items_center().justify_center().child(this.status(t, a, true)));
      }
      const when = this.since(a);
      const idle = a.status === "idle" && !a.focused;
      const full = false;
      const name = full ? a.space_name || label(a) : more ?? (/^\d+$/.test(label(a)) ? a.program?.name || label(a) : label(a));
      return h_flex()
        .id(`ag-${a.address}`)
        .px(styles.spacing.v8)
        .h(styles.components.agents.rowHeight)
        .flex_none()
        .rounded(styles.radius.v0)
        .items_center()
        .gap(styles.spacing.v9)
        .when(a.focused, (el) => el.bg(t.raised))
        .cursor_pointer()
        .hover((s) => s.bg(t.raised).text_color(t.foreground))
        .on_hover((on, cx) => {
          if (on) this.hovered = a.address;
          else if (this.hovered === a.address) this.hovered = null;
          cx.notify();
        })
        .on_click(() => run("pane.focus", { pane: a.pane }))
        .when(Boolean(pic), el => el.child(pic))
        .child(h_flex().flex_1().min_w(0).gap(styles.spacing.v5).items_center()
          .child(div().min_w(0).max_w(full && more ? styles.components.agents.detailNameMaxWidth : styles.components.agents.nameMaxWidth).truncate().text_color(idle ? t.muted : t.foreground).child(name))
          .when(full && Boolean(more), el => el.child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(`\u00b7 ${more}`))))
        .child(h_flex().flex_none().items_center().gap(8)
          .when(Boolean(when), el => el.child(div().flex_none().text_size(styles.components.agents.captionText).text_color(t.dim).child(duration(now - when))))
          .child(h_flex().w(20).flex_none().items_center().justify_center().child(this.status(t, a, byPriority))));
    };

    const original = spaces();
    if (shared("blackx.workspacePins") == null) setShared("blackx.workspacePins", [...new Set(list.filter(a => a.pinned).map(a => a.space))]);
    const workspacePins = shared("blackx.workspacePins") ?? [];
    const groups = original.map((w, i) => {
      const members = list.filter(a => a.space === w.id);
      return {w, i, members, pin: workspacePins.includes(w.id), rank: Math.max(0, ...members.map(rankOf))};
    }).sort((a,b) => Number(b.pin)-Number(a.pin) || b.rank-a.rank || a.i-b.i);
    setAgentOrder(groups.flatMap(g => g.members.map(a => a.address)));
    const spaceRows = (g) => {
      const id = "space-" + g.w.id;
      const record = {w:g.w, i:g.i, g:this.git[JSON.stringify([g.w.machine ?? null, panes().find(p => g.w.tabs.some(tab => tab.id === p.tab) && p.cwd)?.cwd || g.w.folder])] ?? null, tree:null};
      if (collapsed) return [this.compact(record,t)];
      const head = h_flex().w_full().items_center().flex_none().pr(8)
        .bg(g.w.active ? t.selected : t.chrome)
        .hover(el => el.bg(g.w.active ? t.selected : t.hover))
        .child(div().flex_1().min_w(0).child(this.row(record,t)))
        .child(h_flex().flex_none().items_center().gap(8)
          .child(div().text_size(styles.components.agents.captionText).text_color(t.dim).child(String(g.members.length)))
          .child(h_flex().w(20).flex_none().items_center().justify_center().child(this.status(t,{status: Object.keys(RANK).find(k => RANK[k] === g.rank) ?? "idle"},true))));
      return [head, ...g.members.flatMap(a => withKids(a, list.indexOf(a)).map(r => div().w_full().pl(22).flex_none().when(a.focused, el => el.bg(t.raised)).hover(el => el.bg(t.raised)).child(r)))];
    };
    // Read the reactive machine list so empty and unavailable machines stay visible.
    const machineList = [...machines()].sort((a, b) => Number(b.name === null) - Number(a.name === null));
    const rows = machineList.map((m, index) => {
      const members = groups.filter(g => (g.w.machine ?? null) === m.name);
      const ready = m.layout === "ready";
      const key = m.name ?? "local";
      const header = h_flex().id(`machine-${key}`).w_full().h(30).px(8)
        .flex_none().items_center().gap(8).text_color(t.muted)
        .child(div().flex_1().min_w(8).h(1).bg(t.border))
        .when(!collapsed, el => el
          .child(div().min_w(0).max_w(180).truncate().child(m.name ?? "This computer"))
          .when(!ready, row => row.child(div().text_size(10).text_color(t.dim)
            .child(m.layout === "loading" ? "Connecting…" : "Unavailable"))))
        .when(!collapsed, el => el.child(div().flex_1().min_w(8).h(1).bg(t.border)));
      return v_flex().id(`machine-section-${key}`).w_full().flex_none().pb(6)
        .when(index > 0, el => el.pt(6))
        .when(m.name !== null, el => el.child(header)).children(members.flatMap(spaceRows))
        .child(div().id(`machine-new-${key}`).w_full().h(30).flex_none()
          .flex().items_center().justify_center().text_color(ready ? t.muted : t.dim)
          .when(ready, el => el.cursor_pointer().hover(s => s.bg(t.hover))
            .on_click(() => openOverlay({ mod: "blackx-new-menu", kind: "popup", width: 280, height: 110, props: { mode: "spaces", machine: m.name ?? "" } })))
          .child(svg("plus").size(14)));
    });

    return v_flex()
      .size_full()
      .min_h(0)
      .bg(t.chrome)
      .border_r(styles.border.v1)
      
      .border_color(t.border)
      .text_size(styles.components.agents.bodyText)
      .child(v_flex().id("ag-list").flex_1().min_h(0).px(styles.spacing.v0).overflow_y_scrollbar().mode("always").children(rows));
  }
}
