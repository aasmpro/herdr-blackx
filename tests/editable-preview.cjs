const fs=require('fs'),vm=require('vm'),assert=require('assert');
// A lightweight native builder records rendered content; event work is exercised directly.
function node(){let self;const target={nodes:[]};self=new Proxy(target,{get(t,key){if(key in t)return t[key];return (...args)=>{if(key==='when'){if(args[0])args[1](self);}else if(key==='child')t.nodes.push(args[0]);else if(key==='children')t.nodes.push(...args[0]);else if(key==='id')t.name=args[0];return self;};}});return self;}
const scope={View:class{},div:node,v_flex:node,h_flex:node,TextView:{markdown:(_,text)=>{const n=node();n.nodes.push(text);return n;}},styles:{spacing:{v12:12,v8:8}},
 TextareaState:{new({value}){return {text:value,callbacks:{},value(){return this.text;},on(name,fn){this.callbacks[name]=fn;},focus(){},release(){this.released=true;}};}},Textarea:{new:node},
 location:()=>({cwd:'/repo'}),shared:()=> 'builtin',readTextFile:async()=> 'id,name\n001,Notebook\n',MarkdownContent:class{}};
vm.createContext(scope);
const load=name=>fs.readFileSync('src/mods/blackx-files/'+name,'utf8').replace(/^import .*;\n/gm,'').replace(/export default class/g,'class').replace(/export function/g,'function');
vm.runInContext(load('markdown-blocks.js')+'\n'+load('main.js')+'\nglobalThis.Files=Files;',scope);
const files=new scope.Files(),cx={notify(){},new(){return {set_props(){}};}};
const original='# Heading\r\n\r\nFirst paragraph\r\n\r\n```js\r\nconst n = 1;\r\n\r\nconsole.log(n);\r\n```\r\n\r\nLast paragraph';
const blocks=scope.markdownBlocks(original);assert.equal(blocks.length,4);assert(blocks[2].text.includes('\r\n\r\n'));
let text=original,focuses=0;const code={value:()=>text,set_value:next=>{text=next;},focus(){focuses++;}};
const doc=files.document={path:'/repo/readme.md',code,editable:true,baseline:original};files.code=code;files.file='readme.md';
assert(files.previewFile());assert.equal(files.markdownPreview({}).name,'markdown-editable-preview');
files.editConfigured(cx);assert.notEqual(doc.preview,false);assert.equal(focuses,0);
files.editMarkdownBlock(doc,blocks[1],cx);let input=doc.markdownEdit.input;input.text='Changed **bold** paragraph\r\n';input.callbacks.change({},cx);
assert.equal(text,original.slice(0,blocks[1].start)+input.text+original.slice(blocks[1].end));assert(doc.dirty);assert.notEqual(doc.preview,false);
files.toggleMarkdown(cx);assert.equal(doc.preview,false);assert(input.released);files.toggleMarkdown(cx);assert.equal(doc.preview,true);assert(text.includes('Changed **bold**'));
// Starting an edit on a later block preserves changes to an earlier block,
// even when that edit changed the source length and introduced blank lines.
let current=scope.markdownBlocks(text);files.editMarkdownBlock(doc,current[0],cx);input=doc.markdownEdit.input;input.text='# Longer heading\n\nExtra paragraph\n';input.callbacks.change({},cx);
const last=doc.markdownEdit.blocks.at(-1);files.editMarkdownBlock(doc,last,cx);input=doc.markdownEdit.input;input.text='Last edited paragraph';input.callbacks.change({},cx);files.finishMarkdownEdit(doc);
assert(text.startsWith('# Longer heading'));assert(text.endsWith('Last edited paragraph'));assert(text.includes('Changed **bold**'));assert(text.includes('console.log(n)'));
// Initial file opening chooses preview, including the normal builtin-editor click path.
(async()=>{
 for(const name of ['sample.csv','readme.md']){
  const viewer=new scope.Files();viewer.context={};viewer.root='/repo';viewer.drafts=new Map();viewer.current=()=>true;
  viewer.editor=(text)=>({value:()=>text,on(){},focus(){throw Error('Preview must not focus the source editor');}});viewer.ensureMarkdown=()=>{};
  let pending;const context={notify(){},spawn(fn){pending=fn(context);}};
  viewer.show(name,context,true,true);await pending;assert.equal(viewer.document.preview,true);viewer.toggleMarkdown(context);assert.equal(viewer.document.preview,false);viewer.toggleMarkdown(context);assert.equal(viewer.document.preview,true);
 }
 console.log('CSV and Markdown default to preview; header toggles preserve edits; Markdown block edits preserve surrounding source and fenced code.');
})().catch(e=>{console.error(e);process.exitCode=1;});
