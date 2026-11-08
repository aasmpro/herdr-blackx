const fs = require('fs'), vm = require('vm'), assert = require('assert');
const directorySource = fs.readFileSync(__dirname+'/../src/mods/blackx-files/directory-context.js','utf8').replace(/^import .*;\n/gm,'').replace('export function location', 'function location');
const source = directorySource + '\n' + fs.readFileSync(__dirname+'/../src/mods/blackx-files/main.js','utf8').replace(/^import .*;\n/gm,'').replace('export default class Files','class Files')+'\nFiles;';
async function scenario(choice, command, {dirty=false, available=true}={}) {
 const calls=[],tasks=[];
 const sandbox={View:class{},shared:(key)=>key === "blackx.editor" ? choice : key === "blackx.editor.command" ? command : null,spaces:()=>[{id:'space',active:true,machine:null,folder:'/tmp',tabs:[]}],focused:()=>({pane:'p'}),panes:()=>[{pane:'p',cwd:'/tmp'}],notify:(args)=>calls.push(["notification",args]),run:(...args)=>calls.push(args),exec:async(_cmd,args)=>({code:args[1].startsWith('command -v')&&!available?1:0,stdout:args[1].startsWith('command -v')?'/bin/editor':command})};
 const Files=vm.runInNewContext(source,sandbox),files=new Files();
 files.document={path:'/tmp/a file;literal.txt',editable:true,dirty,code:{focus(){calls.push(['focus']);}}};files.root='/tmp';files.on=null;
 files.editConfigured({notify(){},spawn(fn){tasks.push(fn({notify(){}}));}});await Promise.all(tasks);
 return {calls,doc:files.document};
}
(async()=>{
 let result=await scenario('system',`nvim -u 'config with spaces'`);
 assert.equal(result.calls[0][0],'tab.new');assert.deepEqual(Array.from(result.calls[0][1].argv),['nvim','-u','config with spaces','--','/tmp/a file;literal.txt']);assert.equal(result.calls[0][1].space,'space');
 result=await scenario('nvim','nvim',{dirty:true});assert.equal(result.calls.length,0);assert.match(result.doc.message,/Save your draft/);
 result=await scenario('system','nvim; echo bad');assert.equal(result.calls.length,0);assert.match(result.doc.message,/unsupported/);
 result=await scenario('system',`nvim 'unclosed`);assert.equal(result.calls.length,0);assert.match(result.doc.message,/Unclosed/);
 result=await scenario('nvim','nvim',{available:false});assert.equal(result.calls.length,0);assert.match(result.doc.message,/unavailable/);
 result=await scenario('system','');assert.equal(result.calls[0][0],"notification");assert.match(result.calls[0][1].body,/\$EDITOR is not set/);assert.equal(result.doc.message,"");
 result=await scenario('builtin','');assert.equal(result.calls[0][0],'focus');
 console.log('Editor launch scenarios passed.');
})().catch(e=>{console.error(e);process.exit(1);});
