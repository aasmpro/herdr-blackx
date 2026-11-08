import { icon as svg } from "./icons.js";
import { dispatch as run, openStyled as openOverlay, rememberViewport } from "./routing.js";
import { syncTextSelection, styles } from "./style.js";
// Add a machine: the hosts in ~/.ssh/config to pick from (or type one),
// each added with one click (`hc machine add`). When the machine needs
// something first (herdr-core installed there, a password, a new host
// key), the same command opens in a small terminal window where you answer
// it; the list sees the machine once it's added. Opened as a dialog
// (`mod.open machine-add`); the sidebars' Add machine and the welcome
// open it.

import {View, div} from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import {hc, exec, home, readTextFile, theme, props, closeOverlay} from "herdr";

const I = (name) => `mods/workspace-chrome/${name}.svg`;

// An Include's files, as ssh finds them: ~ is home, a relative path is
// under ~/.ssh, and a pattern matches files (through sh; none where there's no sh).
async function includeFiles(value) {
  const paths = (value.match(/"[^"]*"|\S+/g) ?? [])
    .map((p) => p.replace(/^"|"$/g, ""))
    .map((p) => (p.startsWith("~/") ? `${home()}/${p.slice(2)}` : p.startsWith("/") || /^[a-z]:[\\/]/i.test(p) ? p : `${home()}/.ssh/${p}`));
  const files = [];
  for (const p of paths) {
    if (!/[*?[]/.test(p)) {
      files.push(p);
      continue;
    }
    const r = await exec("sh", ["-c", 'for f in $1; do [ -f "$f" ] && printf "%s\\n" "$f"; done', "sh", p]).catch(() => null);
    files.push(...(r?.stdout ?? "").split("\n").filter(Boolean));
  }
  return files;
}

// Host entries people can pick: named ones, not patterns, from the file
// and the files it includes (ssh stops 16 deep).
async function parseConfig(text, hosts = [], depth = 0) {
  let cur = null;
  for (const raw of (text ?? "").split("\n")) {
    const m = raw.trim().match(/^([^\s#=]+)\s*=?\s*(.*)$/);
    if (!m) continue;
    const [key, value] = [m[1].toLowerCase(), m[2].trim()];
    if (key === "host" || key === "match") {
      const names = key === "host" ? value.split(/\s+/).filter((h) => h && !/[*?!]/.test(h) && !hosts.some((x) => x.alias === h || x.aliases.includes(h))) : [];
      cur = names.length ? { alias: names[0], aliases: names.slice(1), hostname: null, user: null } : null;
      if (cur) hosts.push(cur);
    } else if (key === "include" && depth < 16) {
      for (const f of await includeFiles(value)) await parseConfig(await readTextFile(f).catch(() => null), hosts, depth + 1);
    } else if (cur && key === "hostname") cur.hostname = value;
    else if (cur && key === "user") cur.user = value;
  }
  return hosts;
}

export default class MachineAdd extends View {
  init(_props, cx) {
    this.hosts = null;
    this.added = [];
    this.state = {}; // target -> "adding" | "terminal" | error text
    this.typed = "";
    this.input = InputState.new({ placeholder: "user@host" });
    this.input.on("change", (_e, cx) => { this.typed = this.input.value(); cx.notify(); });
    this.input.on("submit", (_e, cx) => this.add(this.typed, cx));
    this.inputFocused = true;
    this.input.on("focus", (_e, cx) => { this.inputFocused = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.inputFocused = false; cx.notify(); });
    if (props()?.part !== "bar") {
      this.input.focus();
      cx.timer.after(600, () => this.input.focus());
    }
    this.macs = {}; // target -> { name, core } for an added Mac
    this.opened = {};
    this.handle = cx.focus_handle();
    cx.spawn(async (cx) => {
      this.hosts = await parseConfig(await readTextFile(`${home()}/.ssh/config`).catch(() => null));
      await this.refresh();
      cx.notify();
    });
    // While a terminal finishes an add, the list catches up.
    cx.timer.every(3000, (cx) => {
      if (!Object.values(this.state).includes("terminal")) return;
      cx.spawn(async (cx) => {
        await this.refresh();
        cx.notify();
      });
    });
  }

  async refresh() {
    const r = await hc(["machine", "ls", "--json"]).catch(() => null);
    try {
      this.added = r?.code === 0 ? (JSON.parse(r.stdout).machines ?? []).filter((m) => !m.temporary) : [];
    } catch {
      this.added = [];
    }
    for (const m of this.added) {
      if (this.state[m.target] !== "terminal") continue;
      delete this.state[m.target];
      await this.checkMac(m.target);
    }
  }

  isAdded(target) {
    return this.added.some((m) => m.target === target || m.name === target || m.host === target);
  }

  add(target, cx) {
    target = target.trim();
    if (!target || this.state[target] === "adding") return;
    this.state[target] = "adding";
    cx.notify();
    cx.spawn(async (cx) => {
      const r = await hc(["machine", "add", target, "--json"]).catch((e) => ({ code: 1, stderr: String(e), stdout: "" }));
      let why = null;
      try {
        why = r.code === 0 ? null : (JSON.parse(r.stdout || r.stderr).error ?? { message: (r.stderr || r.stdout).trim() });
      } catch {
        why = { message: (r.stderr || r.stdout || "it didn't answer").trim() };
      }
      if (!why) {
        delete this.state[target];
        this.input.set_value("");
        this.typed = "";
        await this.refresh();
        await this.checkMac(target);
      } else if (["hc_missing", "incompatible", "login_needed", "auth_failed", "host_key"].includes(why.kind) || /password|passphrase|host key|permission denied|login/i.test(why.message ?? "")) {
        this.state[target] = "terminal";
        await this.inTerminal(target);
      } else this.state[target] = why.message || "it didn't work";
      await this.refresh();
      cx.notify();
    });
  }

  // macOS asks on its own screen before anything reads Desktop, Documents
  // or Downloads, and the asking program waits: say so once, with the way
  // to allow it for good.
  async checkMac(target) {
    const m = this.added.find((x) => x.target === target || x.name === target);
    if (!m) return;
    const r = await exec("sh", ["-c", 'uname; command -v herdr-core || echo "$HOME/.local/bin/herdr-core"'], { on: m.name }).catch(() => null);
    const [os, core] = (r?.stdout ?? "").trim().split("\n");
    if (os === "Darwin") this.macs[target] = { name: m.name, core: core ?? "~/.local/bin/herdr-core" };
  }

  macCard(t, target) {
    const mac = this.macs[target];
    return v_flex()
      .mx(10)
      .mb(8)
      .p(styles.secondaryValues.machine_add_p_12)
      .gap(styles.secondaryValues.machine_add_gap_8)
      .rounded(styles.secondary.radius)
      .bg(t.blocked + "14")
      .border_1()
      .border_color(t.blocked + "40")
      .child(div().text_size(styles.secondaryValues.machine_add_text_size_12_8).font_semibold().text_color(t.foreground).child(`${mac.name} is a Mac: allow its folders once`))
      .child(
        div()
          .text_size(styles.secondaryValues.machine_add_text_size_12_5)
          .line_height("18px")
          .text_color(t.muted)
          .child("macOS asks on the Mac's own screen before an agent reads Desktop, Documents or Downloads, and waits until someone answers. Give herdr-core Full Disk Access there and it never asks again: in the list, press + and pick this file:"),
      )
      .child(div().px(styles.secondaryValues.machine_add_px_8).py(styles.secondaryValues.machine_add_py_4).rounded(styles.secondary.radius).bg(t.background).border_1().border_color(t.border).text_size(styles.secondaryValues.machine_add_text_size_12).text_color(t.foreground).child(mac.core))
      .child(
        h_flex()
          .gap(styles.secondaryValues.machine_add_gap_8)
          .items_center()
          .child(
            div()
              .id(`ma-mac-${target}`)
              .h(styles.secondaryValues.machine_add_h_28)
              .px(styles.secondaryValues.machine_add_px_12)
              .flex()
              .items_center()
              .rounded(styles.secondary.radius)
              .bg(t.solid)
              .text_color(t.solid_foreground)
              .text_size(styles.secondaryValues.machine_add_text_size_12)
              .font_medium()
              .cursor_pointer()
              .hover((s) => s.opacity(0.88))
              .on_click((_e, cx) => {
                exec("open", ["x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"], { on: mac.name }).catch(() => null);
                this.opened[target] = true;
                cx.notify();
              })
              .child(`Open the setting on ${mac.name}`),
          )
          .when(Boolean(this.opened[target]), (el) => el.child(div().text_size(styles.secondaryValues.machine_add_text_size_12).text_color(t.dim).child("It's open on the Mac's screen."))),
      );
  }

  // The same add in a terminal, for what only the person can answer.
  async inTerminal(target) {
    const r = await hc(["run", "--bg", "--json", "--no-parent", "--name", `add-${target.replace(/[^a-z0-9_-]/gi, "-").toLowerCase()}`.slice(0, 32), "--", "hc", "machine", "add", target]).catch(() => null);
    let address = null;
    try {
      address = r?.code === 0 ? JSON.parse(r.stdout).address : null;
    } catch {}
    if (!address) {
      this.state[target] = "Couldn't open a terminal for it. Run `hc machine add " + target + "` in one.";
      return;
    }
    openOverlay({
      kind: "dialog",
      key: `machine-add-${target}`,
      width: 640,
      height: 300,
      layout: {
        type: "column",
        children: [
          { type: "block", size: { px: 30 }, content: { mod: "blackx-machine-add", props: { part: "bar", target } } },
          { type: "block", content: { terminal: address } },
        ],
      },
    });
  }

  close() {
    closeOverlay(props().overlay);
  }

  key(e, cx) {
    if (e.key === "escape") { this.close(); cx.stop_propagation(); }
  }

  // The terminal window's title bar.
  bar(t) {
    return h_flex()
      .size_full()
      .px(styles.secondaryValues.machine_add_px_12)
      .gap(styles.secondaryValues.machine_add_gap_8)
      .items_center()
      .bg(t.chrome)
      .border_b(styles.secondaryValues.machine_add_border_b_1)
      .border_color(t.border)
      .text_size(styles.secondaryValues.machine_add_text_size_12_5)
      .text_color(t.muted)
      .child(svg(I("server")).size(styles.secondaryValues.machine_add_size_14))
      .child(div().flex_1().child(`Adding ${props().target}: answer it here`))
      .child(
        div()
          .id("ma-bar-close")
          .w(styles.secondaryValues.machine_add_w_22)
          .h(styles.secondaryValues.machine_add_h_22)
          .rounded(styles.secondary.radius)
          .flex()
          .items_center()
          .justify_center()
          .cursor_pointer()
          .hover((s) => s.bg(t.hover))
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click(() => closeOverlay(props().overlay))
          .child(svg(I("x")).size(styles.secondaryValues.machine_add_size_12)),
      );
  }

  row(t, target, label, sub) {
    const st = this.state[target];
    const done = this.isAdded(target);
    const right = done
      ? h_flex().gap(styles.secondaryValues.machine_add_gap_5).items_center().text_size(styles.secondaryValues.machine_add_text_size_12).text_color(t.ansi2).child(svg(I("circle-check")).size(styles.secondaryValues.machine_add_size_13)).child("Added")
      : st === "adding"
        ? h_flex().gap(styles.secondaryValues.machine_add_gap_6).items_center().text_size(styles.secondaryValues.machine_add_text_size_12).text_color(t.muted).child(svg(I("spinner")).size(styles.secondaryValues.machine_add_size_12).text_color(t.working).spin(900)).child("Connecting")
        : st === "terminal"
          ? div().text_size(styles.secondaryValues.machine_add_text_size_12).text_color(t.blocked).child("Waiting in its terminal")
          : div()
              .id(`ma-add-${target}`)
              .px(styles.secondaryValues.machine_add_px_10)
              .h(styles.secondaryValues.machine_add_h_26)
              .flex()
              .items_center()
              .rounded(styles.secondary.radius)
              .border_1()
              .border_color(t.input)
              .bg(t.raised)
              .text_size(styles.secondaryValues.machine_add_text_size_12)
              .font_medium()
              .cursor_pointer()
              .hover((s) => s.bg(t.hover))
              .on_click((_e, cx) => this.add(target, cx))
              .child("Add");
    const idle = !done && !st;
    return v_flex()
      .flex_none()
      .child(
        h_flex()
          .id(`ma-row-${target}`)
          .h(styles.secondaryValues.machine_add_h_40)
          .px(styles.secondaryValues.machine_add_px_10)
          .gap(styles.secondaryValues.machine_add_gap_10)
          .items_center()
          .rounded(styles.secondary.radius)
          .hover((s) => s.bg(t.hover))
          .when(idle, (el) => el.cursor_pointer().on_click((_e, cx) => this.add(target, cx)))
          .child(svg(I("server")).size(styles.secondaryValues.machine_add_size_15).text_color(t.muted))
          .child(div().flex_none().text_size(styles.secondaryValues.machine_add_text_size_13).text_color(t.foreground).child(label))
          .child(div().flex_1().min_w(0).truncate().text_size(styles.secondaryValues.machine_add_text_size_12).text_color(t.dim).child(sub ?? ""))
          .child(right),
      )
      .when(typeof st === "string" && !["adding", "terminal"].includes(st), (el) => el.child(div().px(styles.secondaryValues.machine_add_px_35).pb(styles.secondaryValues.machine_add_pb_6).text_size(styles.secondaryValues.machine_add_text_size_12).text_color(t.blocked).child(st)))
      .when(Boolean(this.macs[target]), (el) => el.child(this.macCard(t, target)));
  }

  render(cx) {
    syncTextSelection(cx);
    rememberViewport(cx);
    return this.renderContent(cx).border(styles.secondary.border).border_color(theme().border);
  }

  renderContent() {
    const t = theme();
    if (props()?.part === "bar") return this.bar(t);
    const hosts = this.hosts ?? [];
    return v_flex()
      .id("machine-add")
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .w_full()
      .min_h(0)
      .p(styles.secondaryValues.machine_add_p_18)
      .bg(t.background)
      .text_color(t.foreground)
      .child(h_flex().items_center().child(div().flex_1().text_size(styles.secondaryValues.machine_add_text_size_15).font_semibold().child("Add a machine")).child(div().text_size(styles.secondaryValues.machine_add_text_size_11).text_color(t.dim).child("Esc")))
      .child(
        div()
          .pt(styles.secondaryValues.machine_add_pt_6)
          .text_size(styles.secondaryValues.machine_add_text_size_12_8)
          .line_height("19px")
          .text_color(t.muted)
          .child("A VPS, a Mac mini, a box at home: Herdr reaches it over ssh, and agents there keep running while your laptop sleeps."),
      )
      .child(div().pt(styles.secondaryValues.machine_add_pt_16).pb(styles.secondaryValues.machine_add_pb_6).text_size(styles.secondaryValues.machine_add_text_size_11_5).font_medium().text_color(t.dim).child(hosts.length ? "From your ssh config" : "Your ssh config lists no hosts"))
      .child(
        v_flex()
          .id("ma-hosts")
          .max_h(280)
          .min_h(0)
          .flex_shrink(1)
          .overflow_y_scroll()
          .children(
            this.hosts === null
              ? [div().px(styles.secondaryValues.machine_add_px_10).py(styles.secondaryValues.machine_add_py_8).text_size(styles.secondaryValues.machine_add_text_size_12_5).text_color(t.dim).child("Reading ~/.ssh/config…")]
              : hosts.map((h) => this.row(t, h.alias, h.alias, [h.user, h.hostname].filter(Boolean).join("@") || (h.aliases.length ? `also ${h.aliases.join(", ")}` : ""))),
          ),
      )
      .child(div().pt(styles.secondaryValues.machine_add_pt_14).pb(styles.secondaryValues.machine_add_pb_6).text_size(styles.secondaryValues.machine_add_text_size_11_5).font_medium().text_color(t.dim).child("Or type how ssh reaches it"))
      .child(
        h_flex()
          .gap(styles.secondaryValues.machine_add_gap_8)
          .child(
            Input.new(this.input)
              .flex_1()
              .h(styles.secondaryValues.machine_add_h_34)
              .px(styles.secondaryValues.machine_add_px_10)
              .gap(styles.secondaryValues.machine_add_gap_6)
              .items_center()
              .rounded(styles.secondary.radius)
              .border_1()
              .border_color(this.inputFocused ? t.accent : t.input)
              .bg(t.background)
              .text_size(styles.secondaryValues.machine_add_text_size_13)
              .text_color(t.foreground),
          )
          .child(
            div()
              .id("ma-add-typed")
              .h(styles.secondaryValues.machine_add_h_34)
              .px(styles.secondaryValues.machine_add_px_14)
              .flex()
              .items_center()
              .rounded(styles.secondary.radius)
              .bg(t.solid)
              .text_color(t.solid_foreground)
              .text_size(styles.secondaryValues.machine_add_text_size_12_5)
              .font_medium()
              .when(!this.typed.trim(), (el) => el.opacity(0.4))
              .cursor_pointer()
              .on_click((_e, cx) => this.add(this.typed, cx))
              .child("Add"),
          ),
      )
      .when(Boolean(this.typed.trim() && this.state[this.typed.trim()]), (el) => el.child(div().pt(styles.secondaryValues.machine_add_pt_6).text_size(styles.secondaryValues.machine_add_text_size_12).text_color(t.blocked).child(String(this.state[this.typed.trim()]))));
  }
}
