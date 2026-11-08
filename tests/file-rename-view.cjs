const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/../src/mods/blackx-files/main.js','utf8').replace(/^import .*;\n/gm,'').replace('export default class Files','class Files')+'\nFiles;';
const Files=vm.runInNewContext(source,{View:class{}});
const files=new Files(),doc={path:'/work/old/name.txt',dirty:true,code:{value:()=> 'unsaved draft'}};
files.root='/work';files.on=null;files.context={key:'context'};files.file='old/name.txt';files.document=doc;files.drafts=new Map([['context\nold/name.txt',doc]]);files.folders=new Set(['old','old/sub','other']);files.entries=new Map([['old',[]]]);files.loading=true;files.watched='/work';
const oldContext=files.context;files.applyRename({from:'/work/old',to:'/work/new',on:null},{});
assert.equal(files.file,'new/name.txt');assert.equal(doc.path,'/work/new/name.txt');assert(doc.dirty);assert.equal(doc.code.value(),'unsaved draft');assert(files.drafts.has('context\nnew/name.txt'));assert.deepEqual(Array.from(files.folders),['new','new/sub','other']);assert.notEqual(files.context,oldContext);assert.equal(files.loading,false);assert(Number.isFinite(files.fileRequest));
console.log('Rename preserves drafts and retargets selected files and expanded folders.');
