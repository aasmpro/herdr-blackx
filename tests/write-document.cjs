const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/../src/mods/blackx-files/write-document.js','utf8').replace(/^import .*;\n/gm,'').replace('export async function','async function')+'\nwriteDocument;';
const calls=[],payloads=[];
const write=vm.runInNewContext(source,{appHome:()=>'/app',writeTextFile:async(...args)=>payloads.push(args),exec:async(cmd,args,options)=>{calls.push({cmd,args,options});return args[0]==='-c'?{code:0,stdout:'"/app/.blackx-save-test"'}:{code:0,stdout:args[1]==='--cleanup'?'{}':'{"saved":true}'};}});
(async()=>{
 await write('/local/file','new','old',null);assert.deepEqual(payloads[0],['/local/file','new','old']);assert.equal(calls.length,0);
 const text='x'.repeat(200000);await write('/remote/file',text,'old','machine-a');
 const payload=JSON.parse(payloads.at(-1)[1]);assert.equal(payload.on,'machine-a');assert.equal(payload.text,text);assert.equal(payload.expected,'old');assert.equal(payloads.at(-1)[2],null);
 assert(calls.every(c=>!c.args.some(arg=>arg.includes(text))));assert.equal(calls[1].options.timeout,600000);assert.equal(calls.at(-1).args[1],'--cleanup');
 console.log('Remote saves stage private request files, stream content outside argv, and clean up.');
})().catch(e=>{console.error(e);process.exit(1);});
