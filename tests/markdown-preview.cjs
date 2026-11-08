const fs=require('fs'),vm=require('vm'),assert=require('assert');
const load=p=>fs.readFileSync(__dirname+'/../src/mods/blackx-files/'+p,'utf8').replace(/^import .*;\n/gm,'').replace('export default class','class');
let markdownParses=0,editorBuilds=0,parentRenders=0,valueReads=0,focuses=0,lastText;
class Element {when(on,fn){return on?fn(this):this;}}
for(const method of ['id','relative','flex_1','min_h','size_full','overflow_y_scrollbar','p','child','absolute','inset_0','invisible'])Element.prototype[method]=function(){return this;};
const context={notify(){parentRenders++;},new(Class,props){const view=new Class();view.init?.(props,context);view.render(context);return {set_props(p){view.update?.(p);view.render(context);}};}};
const sandbox={View:class{},v_flex:()=>new Element(),styles:{spacing:{v12:12}},Editor:{new(){editorBuilds++;return new Element();}},TextView:{markdown(id,text){markdownParses++;lastText=text;return new Element();}}};
vm.createContext(sandbox);vm.runInContext(load('markdown-content.js')+'\n'+load('main.js')+'\nglobalThis.FilesClass=Files;',sandbox);
const files=new sandbox.FilesClass();let text='# Original draft';
const code={value(){valueReads++;return text;},focus(){focuses++;}};
files.file='notes.md';files.code=code;files.document={code,editable:true,dirty:true,baseline:'# Saved'};
assert(files.ensureMarkdown(context));assert.equal(markdownParses,1);assert.equal(editorBuilds,0);
const initialReads=valueReads;
for(let i=0;i<100;i++)files.toggleMarkdown(context);
assert.equal(markdownParses,1);assert.equal(editorBuilds,0);assert.equal(valueReads,initialReads);assert.equal(parentRenders,100);assert.equal(focuses,0);
text='# New unsaved draft';files.document.markdownDirty=true;files.toggleMarkdown(context);
assert.equal(markdownParses,2);assert.equal(lastText,text);assert.equal(editorBuilds,0);assert.equal(parentRenders,101);
files.toggleMarkdown(context);assert.equal(markdownParses,2);assert(files.document.dirty);assert.equal(files.document.baseline,'# Saved');assert.equal(files.document.code,code);
console.log('100 mode switches reuse the Markdown preview without reparsing or rereading text; changed drafts refresh once and editor state is preserved.');
