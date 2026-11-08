import { run, openOverlay as nativeOverlay, spaces, settings } from "herdr";
const names = {help:"blackx-help",feedback:"blackx-feedback",welcome:"blackx-welcome",whatsnew:"blackx-whatsnew",settings:"blackx-settings",palette:"blackx-palette",picker:"blackx-picker",menu:"blackx-menu","new-menu":"blackx-new-menu",prompt:"blackx-prompt",confirm:"blackx-confirm",worktree:"blackx-worktree","machine-add":"blackx-machine-add"};
let viewport = null;
export function rememberViewport(cx) { viewport = window.viewport_size(); }
export function openStyled(options) {
 options = {...options, mod: names[options.mod] ?? options.mod};
 if (options.mod === names.palette && viewport) {
  const zoom = settings().zoom ?? 1, margin = 16;
  const w = viewport.width, h = viewport.height;
  const width = Math.min(640, w - margin * 2), height = Math.min(420, h - margin * 2);
  options = {...options,width,height,at:{x:Math.max(margin,(w-width)/2),y:Math.max(margin,h-height-margin)}};
 }
 return nativeOverlay({...options, frame: "none"});
}
function openScreen(name) {
 const settings = name === names.settings, compact = !settings && ![names.palette,names.picker].includes(name);
 return openStyled({mod:name,kind:settings ? "dialog":"popup",width:settings ? 1000:compact ? 460:640,height:settings ? 700:compact ? 300:420});
}
const openOverlay = openStyled;
export function dispatch(name, args = {}) {
  const screens = {"app.help":[names.help,640,560],"app.feedback":[names.feedback,720,650],"app.welcome":[names.welcome,780,700],"app.whats_new":[names.whatsnew,780,650]};
  if (screens[name]) { const [mod,width,height] = screens[name]; return openStyled({mod,kind:"dialog",width,height,props:args}); }
  if (name === "app.settings") return openScreen(names.settings);
  if (name === "app.palette") return openScreen(names.palette);
  if (name === "mod.open" && (names[args.name] || Object.values(names).includes(args.name))) return openScreen(names[args.name] ?? args.name);
  const space = spaces().find(s=>s.active), tab = space?.tabs?.find(t=>t.active);
  if ((name === "tab.rename" || name === "space.rename") && args.name === undefined) {
    const target = args.id ? (name === "tab.rename" ? spaces().flatMap(s => s.tabs ?? []).find(t => t.id === args.id) : spaces().find(s => s.id === args.id)) : (name === "tab.rename" ? tab : space);
    const id = args.id ?? target?.id;
    if (id) return openOverlay({mod:names.prompt,kind:"dialog",width:460,props:{title:"Rename",value:target?.name ?? "",command:{name,args:{...args,id}}}});
  }
  if ((name === "tab.close" || name === "space.close") && !args.confirmed) {
    const id = args.id ?? (name === "tab.close" ? tab?.id : space?.id);
    if (id) return openOverlay({mod:names.confirm,kind:"dialog",width:460,height:220,props:{title:name === "tab.close" ? "Close tab?" : "Close space?",detail:"This ends its terminals.",command:{name,args:{...args,id,confirmed:true}}}});
  }
  return run(name,args);
}
