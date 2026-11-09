const fs=require('fs'),vm=require('vm'),assert=require('assert');const scope={};vm.createContext(scope);vm.runInContext(fs.readFileSync('src/mods/blackx-files/csv.js','utf8').replace(/export /g,''),scope);
for(const rows of [[['a,b','x"y'],['line\nbreak','']], [['001','true','2026-01-01']]]) {const out=scope.parseCSV(scope.serializeCSV(rows));assert.equal(JSON.stringify(out),JSON.stringify(rows));}
assert.throws(()=>scope.parseCSV('"unclosed'));assert.equal(scope.parseCSV('a\tb\r\nc\td','\t')[1][1],'d');console.log('CSV round trips passed');
