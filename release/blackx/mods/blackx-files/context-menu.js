import { icon } from "./icons.js";
import { styles } from "./style.js";
import { div } from "gpui-kit";
import { v_flex, InputState, Input } from "gpui-base";
import { props, shared, setShared, closeOverlay, theme, exec, readTextFile, appHome, notify } from "herdr";
import { menuItem } from "./menu-item.js";

export function fileName(path) {
  const value = String(path ?? "");
  const windows = /^[A-Za-z]:[\\/]|^\\\\/.test(value);
  return value.replace(windows ? /[\\/]+$/ : /\/+$/, "").split(windows ? /[\\/]/ : /\//).pop() || value;
}

export function initMenu(owner, cx) {
  owner.nameInput = InputState.new({value:''});
  owner.nameInput.on('change', (_event, cx) => { owner.nameError = ''; cx.notify(); });
  owner.nameInput.on('submit', (_event, cx) => owner.submitName?.(cx));
}

export function menu(cx, p = props(), owner = {}) {
  const t = theme(), dialogKey = 'blackx.files.dialog.' + p.overlay;
  const dialog = shared(dialogKey);
  const kind = typeof dialog === 'string' ? dialog : dialog?.kind;
  const act = (action, choice, cx) => {
    if (action === 'cancel') { closeOverlay(p.overlay); return; }
    if (shared('blackx.files.busy')) return;
    if (['add-file', 'add-folder', 'rename'].includes(action) && choice !== 'submit') {
      owner.nameInput.set_value(action === 'rename' ? fileName(p.path) : '');
      const value = owner.nameInput.value();
      owner.nameInput.set_selected_range({start:0,end:value.length});
      owner.nameError = '';
      setShared(dialogKey, {kind:action});
      cx.timer.after(50, () => owner.nameInput.focus());
      return;
    }
    if (action === 'copy' || action === 'move') {
      setShared('blackx.files.clipboard', {path:p.path, on:p.on, move:action === 'move'});
      closeOverlay(p.overlay); return;
    }
    if (action === 'path') { cx.write_to_clipboard(p.path); closeOverlay(p.overlay); return; }
    if (action === 'delete' && !choice) {
      setShared(dialogKey, {kind:'delete', name:fileName(p.path)}); return;
    }
    // A collision confirmation belongs to the item originally pasted.
    const clip = kind === 'collision' && dialog?.clipboard ? dialog.clipboard : shared('blackx.files.clipboard');
    if (action === 'paste' && !clip) return;
    setShared('blackx.files.busy', true);
    cx.spawn(async cx => {
      try {
        const code = await readTextFile(appHome() + '/mods/blackx-files/operations.py');
        const req = action === 'paste'
          ? {action, path:clip.path, destination:p.destination, move:clip.move, choice}
          : {action, path:p.path, ...(['add-file', 'add-folder', 'rename'].includes(action) ? {name:owner.nameInput.value(), destination:p.destination} : {})};
        const resultProcess = action === 'paste' && (clip.on ?? null) !== (p.on ?? null)
          ? await exec('python3', [appHome() + '/mods/blackx-files/transfer.py', JSON.stringify({source:clip, target:{on:p.on, destination:p.destination}, choice})], {timeout:600000})
          : await exec('python3', ['-c', code, JSON.stringify(req)], {on:p.on, timeout:600000});
        const result = JSON.parse(resultProcess.stdout || '{}');
        if (result.error || resultProcess.code) throw Error(result.error || resultProcess.stderr);
        if (result.collision) {
          setShared(dialogKey, {kind:'collision', name:fileName(result.collision), sameSource:Boolean(result.sameSource), clipboard:clip}); return;
        }
        const notices = [...(result.skipped ?? []), ...(result.warnings ?? [])];
        if (notices.length) notify({
          title:'Copy completed with warnings',
          body:`${result.skipped?.length ?? 0} entries skipped. ` + notices.slice(0, 3).map(item => `${item.path}: ${item.reason}`).join('; ') + (notices.length > 3 ? '; …' : ''),
          level:'warning', timeout:12000,
        });
        // Shared values may be deserialized; compare fields rather than object identity.
        const current = shared('blackx.files.clipboard');
        if (action === 'paste' && clip.move && current?.path === clip.path && (current.on ?? null) === (clip.on ?? null) && current.move) setShared('blackx.files.clipboard', null);
        const revision = Date.now();
        if (result.renamed) setShared('blackx.files.rename', {...result.renamed, on:p.on, revision});
        setShared('blackx.files.revision', revision);
        closeOverlay(p.overlay);
      } catch (error) {
        if (['add-file', 'add-folder', 'rename'].includes(action)) { owner.nameError = String(error); cx.notify(); return; }
        notify({title:'File operation failed', body:String(error), level:'error'});
      } finally { setShared('blackx.files.busy', false); }
    });
  };
  const icons = {'add-file':'file-plus', 'add-folder':'folder-plus', rename:'square-pen', copy:'copy', path:'link', move:'scissors', paste:'clipboard-paste', reveal:'folder-open', delete:'trash-2', cancel:'x'};
  const button = (label, action, choice, enabled = true) => menuItem('file-menu-' + label, label,
    (_event, cx) => act(action, choice, cx), enabled && !shared('blackx.files.busy'),
    icon(choice === 'replace' ? 'replace' : choice === 'keep' ? 'copy-plus' : icons[action]).size(styles.components.files.glyph14).flex_none());
  const naming = ['add-file', 'add-folder', 'rename'].includes(kind);
  owner.submitName = cx => act(kind, 'submit', cx);
  return v_flex().w_full().p(styles.secondaryValues.new_menu_p_5).bg(t.background).border_1().border_color(t.border).text_size(13)
    .when(!kind, el => el.children([
      button('Add file', 'add-file'), button('Add folder', 'add-folder'), button('Rename', 'rename', null, !p.rootMenu),
      button('Copy', 'copy'), button('Copy path', 'path'), button('Move', 'move'),
      button('Paste', 'paste', null, Boolean(shared('blackx.files.clipboard'))),
      button('Reveal', 'reveal', null, !p.on), button('Delete', 'delete')]))
    .when(naming, el => el
      .child(Input.new(owner.nameInput).w_full().h(36).px(8).border_1().border_color(t.input).bg(t.background).text_color(t.foreground))
      .when(Boolean(owner.nameError), el => el.child(div().p(12).text_color(t.muted).child(owner.nameError)))
      .child(button(kind === 'rename' ? 'Rename' : kind === 'add-file' ? 'Add file' : 'Add folder', kind, 'submit'))
      .child(button('Cancel', 'cancel')))
    .when(Boolean(kind) && !naming, el => el
      .child(div().p(12).text_color(t.muted).child((kind === 'delete' ? 'Move to Trash? ' : 'Already exists: ') + (dialog?.name || fileName(p.path))))
      .children(kind === 'delete'
        ? [button('Delete', 'delete', 'yes')]
        : [...(dialog?.sameSource ? [] : [button('Replace', 'paste', 'replace')]), button('Keep both', 'paste', 'keep')])
      .child(button('Cancel', 'cancel')));
}
