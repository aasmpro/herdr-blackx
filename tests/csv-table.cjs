const fs=require('fs'),vm=require('vm'),assert=require('assert');
class Element {
  constructor(){this.nodes=[];return new Proxy(this,{get:(target,key)=>{
    if(key in target)return target[key];
    return (...args)=>{if(key==='when'){if(args[0])args[1](target.proxy);}else if(key==='child')target.nodes.push(args[0]);else if(key==='children')target.nodes.push(...args[0]);else if(key==='id')target.name=args[0];else if(key==='on_click')target.click=args[0];else if(key==='h')target.height=args[0];return target.proxy;};
  }});}
}
const element=()=>{const e=new Element();e.proxy=e;return e;};
let dialog=null;
const scope={theme:()=>({}),svg:element,View:class{},div:element,h_flex:element,v_flex:element,
  styles:{components:{files:{captionText:12}}},
  TextareaState:{new({value}){return {text:value,callbacks:{},value(){return this.text;},on(e,cb){this.callbacks[e]=cb;},focus(){},release(){this.released=true;}};}},
  Textarea:{new(state){const e=element();e.editor=state;return e;}},Editor:{new:element},
  v_virtual_list(){throw Error('Interactive cells must not run in a deferred virtual-list renderer');}
};
vm.createContext(scope);
vm.runInContext(fs.readFileSync('src/mods/blackx-files/csv.js','utf8').replace(/export /g,'')+'\n'+fs.readFileSync('src/mods/blackx-files/main.js','utf8').replace(/^import .*;\n/gm,'').replace('export default class','class')+'\nglobalThis.Files=Files;',scope);
const files=new scope.Files(),cx={notify(){dialog=files.document?.csv?.pendingDelete?files.csvDeleteConfirmation(files.document,files.document.csv,theme):null;},stop_propagation(){},focus_handle(){return {focus(){},release(){}};}},theme={};
// Manual viewer samples are intentionally editable; release tests own their input.
const baseline = "id,name,category,quantity,price,notes\n001,Notebook,Office,12,4.50,Plain text\n002,\"Cable, USB-C\",Electronics,5,9.99,\"Comma inside a quoted cell\"\n003,\"27\"\" Monitor\",Electronics,2,249.00,\"Escaped \"\"double quotes\"\"\"\n004,Desk lamp,Office,3,29.50,\"First line\nSecond line of the same cell\"\n005,Café mug,Kitchen,8,12.00,Unicode: café and 日本語\n006,Empty value,Test,,0.00,\n007,Leading zeros,Test,0005,001.20,Keep values as strings\n008,Long description,Test,1,1.00,A longer value for checking column widths and horizontal overflow.\n";
const code={text:baseline,value(){return this.text;},set_value(value){this.text=value;}};
const doc=files.document={path:'/sample.CSV',code,baseline,editable:true};
let tree=files.csvContent(theme);
assert.equal(code.text,baseline);
const flatten=e=>e instanceof Element?[e,...e.nodes.flatMap(flatten)]:[];
const textOf=e=>e instanceof Element?e.nodes.map(textOf).join(' '):String(e??'');
assert(flatten(tree).some(e=>e.name==='csv-cell-0-5'));
assert(textOf(tree).includes('Notebook'));assert(textOf(tree).includes('Café mug'));
assert(textOf(tree).includes('First line ↵ Second line'));
assert(!flatten(tree).some(e=>e.name==='csv-mode'));
assert.equal(flatten(tree).filter(e=>/^csv-delete-row-\d+$/.test(e.name)).length,9);
assert.equal(flatten(tree).filter(e=>/^csv-delete-column-\d+$/.test(e.name)).length,6);
assert(!flatten(tree).some(e=>['csv-remove-row','csv-remove-column'].includes(e.name)));
files.selectCSV(doc,1,1,cx);let input=doc.csv.input;
input.text='Edited, "quoted"\nsecond line';input.callbacks.change({},cx);
assert.equal(doc.dirty,true);assert.equal(scope.parseCSV(code.text)[1][1],input.text);
files.selectCSV(doc,2,2,cx);assert(input.released);input=doc.csv.input;input.text='Other cell';input.callbacks.change({},cx);
assert.equal(scope.parseCSV(code.text)[1][1],'Edited, "quoted"\nsecond line');assert.equal(scope.parseCSV(code.text)[2][2],'Other cell');
tree=files.csvContent(theme);assert.equal(flatten(tree).find(e=>e.name==='csv-row-2').height,80);
const find=name=>flatten(tree).find(e=>e.name===name);
find('csv-add-column').click({},cx);assert(scope.parseCSV(code.text).every(row=>row.length===7));
files.selectCSV(doc,1,6,cx);tree=files.csvContent(theme);
let before=code.text;
flatten(tree).find(e=>e.name==='csv-delete-column-6').click({},cx);
assert.equal(code.text,before);assert(dialog);assert(textOf(dialog).includes('Delete column G?'));
flatten(dialog).find(e=>e.name==='csv-delete-cancel').click({},cx);assert.equal(code.text,before);assert.equal(dialog,null);
flatten(tree).find(e=>e.name==='csv-delete-column-6').click({},cx);
flatten(dialog).find(e=>e.name==='csv-delete-confirm').click({},cx);
assert(scope.parseCSV(code.text).every(row=>row.length===6));assert.equal(dialog,null);
// Row icons target their own row, regardless of the selected cell.
files.selectCSV(doc,2,1,cx);tree=files.csvContent(theme);before=scope.parseCSV(code.text);
flatten(tree).find(e=>e.name==='csv-delete-row-1').click({},cx);assert.equal(scope.parseCSV(code.text).length,before.length);
flatten(dialog).find(e=>e.name==='csv-delete-confirm').click({},cx);
assert.equal(scope.parseCSV(code.text).length,before.length-1);assert.equal(scope.parseCSV(code.text)[1][0],before[2][0]);
// A stale confirmation cannot remove a different row after the draft changes.
tree=files.csvContent(theme);flatten(tree).find(e=>e.name==='csv-delete-row-1').click({},cx);
code.text+='\nnew,row';const changed=code.text;
flatten(dialog).find(e=>e.name==='csv-delete-confirm').click({},cx);assert.equal(code.text,changed);assert(doc.message.includes('CSV changed'));
// Deleting the final row/column leaves an editable empty CSV placeholder.
code.text='only';tree=files.csvContent(theme);flatten(tree).find(e=>e.name==='csv-delete-column-0').click({},cx);flatten(dialog).find(e=>e.name==='csv-delete-confirm').click({},cx);assert.equal(code.text,'');
code.text='only';tree=files.csvContent(theme);flatten(tree).find(e=>e.name==='csv-delete-row-0').click({},cx);flatten(dialog).find(e=>e.name==='csv-delete-confirm').click({},cx);assert.equal(code.text,'');

// Bounded eager pages keep handlers legal while preserving access to every row.
code.text='a,b\n'.repeat(1001);tree=files.csvContent(theme);
assert.equal(flatten(tree).filter(e=>/^csv-row-\d+$/.test(e.name)).length,100);
for(let page=0;page<10;page++){flatten(tree).find(e=>e.name==='csv-next').click({},cx);tree=files.csvContent(theme);}
assert(flatten(tree).some(e=>e.name==='csv-row-1000'));

// Bottom + appends a full-width empty row and brings its page into view.
code.text='a,b\n'.repeat(100);tree=files.csvContent(theme);
const footer=flatten(tree).find(e=>e.name==='csv-add-row-footer');
flatten(footer).find(e=>e.name==='csv-add-row').click({},cx);
assert.equal(scope.parseCSV(code.text).length,101);assert.equal(scope.parseCSV(code.text).at(-1).length,2);
tree=files.csvContent(theme);assert(flatten(tree).some(e=>e.name==='csv-row-100'));
assert(!textOf(tree).includes('+ Row'));assert(!textOf(tree).includes('+ Column'));

// Preserve BOM/newline conventions and string values on edits.
code.text='\uFEFFid,name\r\n001,Hello\r\n';files.selectCSV(doc,1,1,cx);input=doc.csv.input;input.text='New';input.callbacks.change({},cx);assert.equal(code.text,'\uFEFFid,name\r\n001,New\r\n');
code.text='"invalid';tree=files.csvContent(theme);assert(textOf(tree).includes('header preview icon'));assert.equal(code.text,'"invalid');
console.log('CSV defaults to a grid; inline edits preserve other cells, BOM/newlines, quoting and drafts; all rows remain accessible.');
