const fs=require('fs'),os=require('os'),path=require('path'),vm=require('vm'),assert=require('assert'),cp=require('child_process');
const source=fs.readFileSync(__dirname+'/../src/mods/blackx-files/git-status.js','utf8').replace('export function','function')+'\ngitMarks;';
const gitMarks=vm.runInNewContext(source);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'blackx-directory-status-'));
const git=(...args)=>cp.execFileSync('git',['-C',root,...args],{encoding:'utf8'});
const write=(file,text)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),text);};
try {
 git('init','-q');
 write('existing/nested/old.txt','original');write('untouched/file.txt','original');
 git('add','.');git('-c','user.name=Blackx Test','-c','user.email=blackx@example.invalid','commit','-qm','baseline');
 write('existing/nested/old.txt','changed');
 write('existing/added.txt','new');write('existing/new/sub/file.txt','new');
 write('new-top/sub/new.txt','new');write('staged/sub/new.txt','new');git('add','staged');
 const status=git('status','--porcelain=v1','-z','--no-renames','--untracked-files=all');
 const trees=git('ls-tree','-r','-d','--name-only','-z','HEAD');
 const marks=gitMarks(root,status,trees);
 for(const directory of ['existing','existing/nested'])assert.equal(marks[root+'/'+directory],'M');
 for(const directory of ['existing/new','existing/new/sub','new-top','new-top/sub','staged','staged/sub'])assert.equal(marks[root+'/'+directory],'A');
 assert.equal(marks[root+'/untouched'],undefined);
 assert.equal(marks[root+'/existing/added.txt'],'A');assert.equal(marks[root+'/existing/nested/old.txt'],'M');
 // Existing directories containing only added descendants still count as modified.
 assert.equal(gitMarks(root,'?? existing/new.txt\0',trees)[root+'/existing'],'M');
 // An unborn repository has no committed directories.
 assert.equal(gitMarks(root,'A  first/deep/file.txt\0','')[root+'/first'],'A');
 assert.equal(gitMarks(root,'?? unicode space/子/file.txt\0','')[root+'/unicode space/子'],'A');
 assert.equal(Object.keys(gitMarks(root,'',trees)).length,0,'Clean status clears all colors');
 assert.equal(git('status','--porcelain=v1','-z','--no-renames','--untracked-files=all'),status,'Reading marks never stages files');
 console.log('Existing/new directory colors propagate through nested, staged, untracked and unborn cases.');
} finally {fs.rmSync(root,{recursive:true,force:true});}
