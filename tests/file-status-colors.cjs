const fs=require('fs'),vm=require('vm'),assert=require('assert');
class Element {
 constructor(){this.children=[];this.values={};}
 child(value){this.children.push(value);return this;}
 when(value,fn){return value?fn(this):this;}
 hover(fn){this.hoverStyle=fn;return this;}
}
for(const method of ['id','h','flex_none','pl','pr','gap','items_center','rounded','cursor_pointer','text_color','bg','on_mouse_down','on_click','size','w','font_family','text_size','text_center','flex_1','min_w','truncate'])Element.prototype[method]=function(value){this.values[method]=value;return this;};
const source=fs.readFileSync(__dirname+'/../src/mods/blackx-files/main.js','utf8').replace(/^import .*;\n/gm,'').replace('export default class Files','class Files')+'\nFiles;';
const Files=vm.runInNewContext(source,{View:class{},h_flex:()=>new Element(),div:()=>new Element(),svg:()=>new Element(),fileGlyph:()=>'*',styles:{components:{files:{fileRowHeight:24,treeIndent:12,glyph14:14,captionText:11}},spacing:{v8:8,v7:7},radius:{v0:0},fonts:{terminal:'mono'}}});
const files=new Files();files.root='/work';files.folders=new Set();files.showHidden=true;files.file='modified.txt';
const entries=[['added.txt','A'],['modified.txt','M'],['conflict.txt','U'],['deleted.txt','D'],['normal.txt',null],['ignored.txt','M']];
files.entries=new Map([['',entries.map(([name])=>({name,size:10,dir:false,ignored:name==='ignored.txt'}))]]);
files.marks=Object.fromEntries(entries.filter(([,status])=>status).map(([name,status])=>['/work/'+name,status]));
const t={ansi1:'red',ansi2:'green',ansi3:'yellow',foreground:'white',dim:'gray',selected:'selected',hover:'hover'};
const rows=files.rows('',0,[],t);
const expected=['green','yellow','red','red','white','gray'];
rows.forEach((row,i)=>{
 assert.equal(row.values.text_color,expected[i]);
 assert.equal(row.children[0].values.text_color,expected[i]);
 assert.equal(row.children[1].children[0],entries[i][0]);
 assert.equal(row.children.length,3,'Only icon, filename and size; no status-letter badge');
 assert.equal(row.children[2].values.text_color,i===5?'gray':'white');
});
assert.equal(rows[1].values.bg,'selected','Selected changed files retain their selection background');
console.log('File-tree status colors, neutral sizes, ignored entries and selection passed.');
