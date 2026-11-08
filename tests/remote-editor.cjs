const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/../src/mods/blackx-files/main.js','utf8').replace(/^import .*;\n/gm,'').replace('export default class Files','class Files')+'\nFiles;';
const tasks=[],writes=[];let fail=false,finish;
const cx={notify(){},spawn(fn){tasks.push(fn(cx));}};
const Files=vm.runInNewContext(source,{View:class{},shared:key=>key==='blackx.editor'?'builtin':null,readTextFile:async()=> 'remote text\r\n',writeDocument:(...args)=>{writes.push(args);return fail?Promise.reject(Error('File changed on disk')):new Promise(resolve=>finish=resolve);}});
const files=new Files();files.context={key:'remote context'};files.root='/remote';files.on='machine-a';files.drafts=new Map();files.current=c=>c===files.context;
files.editor=(text,path,editable)=>({text,editable,value(){return this.text;},on(event,fn){this.changed=fn;},focus(){}});
(async()=>{
 files.show('file.txt',cx);await Promise.all(tasks.splice(0));
 const doc=files.document;assert(doc.editable);assert.equal(doc.on,'machine-a');assert(doc.code.editable);assert.equal(doc.message,'');
 doc.code.text='saved text';doc.code.changed({},cx);assert(doc.dirty);
 files.on='machine-b';files.save(cx);assert.equal(writes.length,1);assert.deepEqual(writes[0],['/remote/file.txt','saved text','remote text\r\n','machine-a']);
 doc.code.text='newer unsaved draft';finish();await Promise.all(tasks.splice(0));assert.equal(doc.baseline,'saved text');assert(doc.dirty);assert.equal(doc.code.value(),'newer unsaved draft');
 fail=true;files.save(cx);await Promise.all(tasks.splice(0));assert(doc.dirty);assert.match(doc.message,/changed on disk/);assert.match(doc.message,/edits are kept/);assert.equal(doc.code.value(),'newer unsaved draft');
 console.log('Remote content opens editable, saves to its originating machine, and retains newer/conflicting drafts.');
})().catch(e=>{console.error(e);process.exit(1);});
