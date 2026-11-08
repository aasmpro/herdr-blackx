const fs=require('fs'),os=require('os'),path=require('path'),vm=require('vm'),assert=require('assert'),cp=require('child_process'),{promisify}=require('util');
const execFile=promisify(cp.execFile);
const source=fs.readFileSync(__dirname+'/../src/mods/blackx-files/git-ignore.js','utf8').replace(/^import .*;\n/gm,'').replace('export async function','async function')+'\nignoredPaths;';
const ignoredPaths=vm.runInNewContext(source,{exec:async(cmd,args,opts)=>{
 const actual=opts.on?['hc',['exec','--on',opts.on,'--cwd',opts.cwd,cmd,...args]]:[cmd,args];
 const r=await execFile(...actual,{cwd:opts.on?undefined:opts.cwd});return {code:0,stdout:r.stdout};
}});
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'blackx-ignore-'));
 try {
  cp.execFileSync('git',['init','-q',root]);
  fs.writeFileSync(path.join(root,'.gitignore'),'.cache/\n*.log\n!keep.log\ntracked.txt\nwith spaces.txt\n');
  fs.mkdirSync(path.join(root,'.cache'));fs.writeFileSync(path.join(root,'.cache','nested'),'x');
  for(const name of ['app.log','keep.log','tracked.txt','normal.txt','with spaces.txt','line\nbreak.log'])fs.writeFileSync(path.join(root,name),'x');
  cp.execFileSync('git',['-C',root,'add','-f','tracked.txt']);
  const names=['.cache','.cache/nested','app.log','keep.log','tracked.txt','normal.txt','with spaces.txt','line\nbreak.log'];
  const result=await ignoredPaths(root,names,null);
  assert.deepEqual(Array.from(result).sort(),['.cache','.cache/nested','app.log','with spaces.txt','line\nbreak.log'].sort());
  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'blackx-non-git-'));
  try{assert.equal((await ignoredPaths(outside,['normal.txt'],null)).size,0);}finally{fs.rmdirSync(outside);}
  for(const machine of process.argv.slice(2)) {
   const remoteRoot='/tmp/blackx-ignore-'+require('crypto').randomUUID();
   const setup='import pathlib,subprocess,sys,json; p=pathlib.Path(sys.argv[1]);p.mkdir();subprocess.run(["git","init","-q",str(p)],check=True);(p/".gitignore").write_text(".cache/\\n*.log\\n!keep.log\\ntracked.txt\\nwith spaces.txt\\n");(p/".cache").mkdir();[(p/n).write_text("x") for n in json.loads(sys.argv[2]) if n!=".cache"];subprocess.run(["git","-C",str(p),"add","-f","tracked.txt"],check=True)';
   const available=cp.spawnSync('hc',['exec','--on',machine,'python3','-c','import shutil,sys;sys.exit(0 if shutil.which("git") else 1)']).status===0;
   if(!available) {
    cp.execFileSync('hc',['exec','--on',machine,'python3','-c','import pathlib,sys;pathlib.Path(sys.argv[1]).mkdir()',remoteRoot]);
    try{assert.equal((await ignoredPaths(remoteRoot,names,machine)).size,0);console.log(machine+': missing-Git normal-color fallback passed.');}
    finally{cp.execFileSync('hc',['exec','--on',machine,'python3','-c','import shutil,sys;shutil.rmtree(sys.argv[1])',remoteRoot]);}
    continue;
   }
   cp.execFileSync('hc',['exec','--on',machine,'python3','-c',setup,remoteRoot,JSON.stringify(names)]);
   try {
    const remoteResult=await ignoredPaths(remoteRoot,names,machine);
    assert.deepEqual(Array.from(remoteResult).sort(),Array.from(result).sort());
    console.log(machine+': remote ignore classification passed.');
   } finally {cp.execFileSync('hc',['exec','--on',machine,'python3','-c','import shutil,sys;shutil.rmtree(sys.argv[1])',remoteRoot]);}
  }
  console.log('Git ignore rules, negations, tracked files, folder descendants and unusual names passed.');
 } finally {fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1);});
