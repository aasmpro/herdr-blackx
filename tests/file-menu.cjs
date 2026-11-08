const fs=require('fs'), vm=require('vm'), assert=require('assert');
const load=p=>fs.readFileSync(__dirname+'/../'+p,'utf8').replace(/^import .*;\n/gm,'').replace(/export function /g,'function ');
class Element {
 constructor(){this.childrenList=[];this.values={};}
 child(x){this.childrenList.push(x);return this;}
 children(xs){xs.forEach(x=>this.child(x));return this;}
 when(v,fn){return v?fn(this):this;}
 on_click(fn){this.click=fn;return this;}
 hover(fn){this.hoverFn=fn;return this;}
}
for(const name of ['id','w_full','px','py','p','text_color','text_size','bg','border_1','border_color','cursor_pointer','h','mx','flex','items_center','gap','size','flex_none'])Element.prototype[name]=function(...args){this.values[name]=args;return this;};
const state=new Map(),calls=[],tasks=[],closed=[],notifications=[],clipboard=[];
let response={}, params={overlay:'menu',path:'/workspace/source.txt',destination:'/workspace/target',on:null};
const owner={nameInput:{text:'',set_value(s){this.text=s;},value(){return this.text;},set_selected_range(){},focus(){}}};
const ctx={notify(){},timer:{after(_ms,fn){fn();}},write_to_clipboard:s=>clipboard.push(s),spawn:fn=>tasks.push(fn(ctx))};
const sandbox={icon:name=>new Element().id("icon-"+name),styles:{secondaryValues:{new_menu_p_5:5},components:{files:{glyph14:14}}},Input:{new:()=>new Element()},div:()=>new Element(),v_flex:()=>new Element(),theme:()=>({foreground:'white',muted:'gray',dim:'dim',background:'black',border:'border',hover:'hover'}),props:()=>params, owner,
 shared:key=>state.get(key),setShared:(key,value)=>state.set(key,structuredClone(value)),closeOverlay:id=>closed.push(id),notify:n=>notifications.push(n),appHome:()=>'/app',readTextFile:async()=> 'helper',exec:async(...args)=>{calls.push(args);return {code:0,stdout:JSON.stringify(response)};}};
vm.createContext(sandbox);vm.runInContext(load('src/shared/menu-item.js')+'\n'+load('src/mods/blackx-files/context-menu.js')+'\nglobalThis.draw=()=>menu(null,props(),owner);globalThis.basename=fileName;',sandbox);
const find=(el,label)=>el.childrenList.includes(label)?el:el.childrenList.filter(x=>x instanceof Element).map(x=>find(x,label)).find(Boolean);
function clickable(el,label){return el.click&&el.childrenList.includes(label)?el:el.childrenList.filter(x=>x instanceof Element).map(x=>clickable(x,label)).find(Boolean);}
function click(label){const row=clickable(sandbox.draw(),label);assert(row&&row.click,'Missing clickable '+label);row.click({},ctx);return row;}
async function settle(){await Promise.all(tasks.splice(0));}
function reset(){state.clear();calls.length=0;closed.length=0;notifications.length=0;response={};}
(async()=>{
 const first=sandbox.draw().childrenList.slice(0,3).map(row=>row.childrenList.find(x=>typeof x==='string'));assert.deepEqual(first,['Add file','Add folder','Rename']);
 for (const [label,action] of [['Add file','add-file'],['Add folder','add-folder'],['Rename','rename']]) {
  reset();click(label);assert.equal(calls.length,0);
  if(action==='rename')assert.equal(owner.nameInput.value(),'source.txt');
  owner.nameInput.set_value('new name');click(label);await settle();const request=JSON.parse(calls[0][1][2]);assert.equal(request.action,action);assert.equal(request.name,'new name');assert.equal(request.destination,params.destination);
  reset();click(label);click('Cancel');assert.equal(calls.length,0);
 }
 reset();
 assert.equal(sandbox.basename('/a/source.txt'),'source.txt');assert.equal(sandbox.basename('C:\\a\\source.txt'),'source.txt');assert.equal(sandbox.basename('/a/back\\slash.txt'),'back\\slash.txt');
 reset();click('Add file');owner.nameInput.set_value('taken.txt');response={error:'Already exists'};sandbox.draw();owner.submitName(ctx);await settle();assert(owner.nameError.includes('Already exists'));assert.equal(closed.length,0);assert.equal(state.get('blackx.files.busy'),false);
 reset();params={...params,rootMenu:true};assert(!find(sandbox.draw(),'Rename').click);params={...params,rootMenu:false};
 reset();const base=click('Copy');assert.equal(state.get('blackx.files.clipboard').path,params.path);assert.equal(calls.length,0);
 click('Copy path');assert.equal(clipboard.at(-1),params.path);
 reset();click('Move');assert.equal(calls.length,0);click('Paste');await settle();assert.equal(JSON.parse(calls[0][1][2]).move,true);assert.equal(state.get('blackx.files.clipboard'),null);
 reset();click('Copy');response={collision:'/workspace/target/source.txt'};click('Paste');await settle();let tree=sandbox.draw();assert(find(tree,'Already exists: source.txt'));assert(!find(tree,'Already exists: /workspace/target/source.txt'));
 let cancel=find(tree,'Cancel'),replace=find(tree,'Replace');assert.deepEqual(cancel.values, {...replace.values,id:['file-menu-Cancel']});assert(cancel.hoverFn);click('Cancel');assert.equal(calls.length,1);
 state.set('blackx.files.clipboard',{path:'/other/item',on:null});response={};click('Keep both');await settle();assert.equal(JSON.parse(calls.at(-1)[1][2]).path,'/workspace/source.txt');
 reset();click('Delete');assert.equal(calls.length,0);tree=sandbox.draw();assert(find(tree,'Move to Trash? source.txt'));cancel=find(tree,'Cancel');let del=find(tree,'Delete');assert.deepEqual(cancel.values,{...del.values,id:['file-menu-Cancel']});click('Delete');await settle();assert.equal(JSON.parse(calls[0][1][2]).action,'delete');assert.equal(notifications.length,0);
 reset();click('Copy');response={collision:'/workspace/source.txt',sameSource:true};click('Paste');await settle();assert(!find(sandbox.draw(),'Replace'));assert(find(sandbox.draw(),'Keep both'));
 reset();state.set('blackx.files.clipboard',{path:'/remote/folder',on:'machine-a'});params={...params,on:'machine-b'};click('Paste');await settle();assert(calls[0][1][0].endsWith('/transfer.py'));assert.equal(calls[0][2].timeout,600000);params={...params,on:null};
 reset();click('Copy');response={skipped:[{path:'.local/runtime.sock',reason:'runtime socket'}],warnings:[]};click('Paste');await settle();assert.equal(notifications[0].level,'warning');assert.match(notifications[0].body,/runtime.sock/);assert(closed.length>0);
 reset();click('Reveal');await settle();assert.equal(JSON.parse(calls[0][1][2]).action,'reveal');
 params={...params,on:'remote'};assert(!find(sandbox.draw(),'Reveal').click);
 console.log('File menu action, confirmation, filename, snapshot and styling regressions passed.');
})().catch(e=>{console.error(e);process.exit(1);});
