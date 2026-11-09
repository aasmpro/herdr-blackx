const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('src/mods/blackx-files/main.js','utf8').replace(/^import .*;\n/gm,'').replace('export default class','class');
async function exercise({fail=0,switchAt=0}={}) {
  let files,calls=[],notifications=0;
  const sandbox={View:class{},appHome:()=>'/app',exec:async(_,args)=>{
    const page=Number(args[4]);calls.push([...args]);
    if(page===switchAt)files.fileRequest++;
    if(page===fail)return {code:1,stdout:JSON.stringify({error:'render failed'})};
    return {code:0,stdout:JSON.stringify({path:`cache/page-${page}.png`,pages:3,page})};
  }};
  vm.createContext(sandbox);vm.runInContext(source+'\nglobalThis.Files=Files;',sandbox);
  files=new sandbox.Files();files.fileRequest=1;files.context={};files.current=()=>true;
  let pending;const cx={spawn(fn){pending=fn(cx);},notify(){notifications++;}};
  files.loadAsset(cx,1,1,files.context,'/example.pdf',null);await pending;
  return {files,calls,notifications};
}
(async()=>{
  let result=await exercise();
  assert.deepEqual(Array.from(result.files.asset.paths),['cache/page-1.png','cache/page-2.png','cache/page-3.png']);
  assert.equal(result.files.asset.pages,3);assert.equal(result.files.fileLoading,false);
  assert(!result.calls[0].includes('--cached'));assert(result.calls.slice(1).every(args=>args.includes('--cached')));
  result=await exercise({switchAt:2});assert.equal(result.calls.length,2);assert.equal(result.files.asset.paths.length,1);
  result=await exercise({fail:2});assert.equal(result.files.asset.paths.length,1);assert.match(result.files.asset.error,/render failed/);assert.equal(result.files.fileLoading,false);
  console.log('PDF pages append in order, reuse staged source, and preserve pages on failure without applying stale results.');
})().catch(e=>{console.error(e);process.exitCode=1;});
