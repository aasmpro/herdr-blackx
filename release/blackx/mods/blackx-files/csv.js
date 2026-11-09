// RFC-style delimited text: every value remains a string.
export function parseCSV(text, delimiter=',') {
  const rows=[]; let row=[],cell='',quoted=false,closed=false;
  for(let i=0;i<text.length;i++) {const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
    if(c==='"'&&!cell&&!closed){quoted=true;continue;}
    if(c===delimiter){row.push(cell);cell='';closed=false;continue;}
    if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';closed=false;continue;}
    if(closed)throw Error('Unexpected character after closing quote');
    if(c==='"')throw Error('Unexpected quote');cell+=c;
  }
  if(quoted)throw Error('Unclosed quoted cell');
  if(cell||row.length||closed||!rows.length){row.push(cell);rows.push(row);}return rows;
}
export function serializeCSV(rows, delimiter=',', newline='\n') {return rows.map(row=>row.map(value=>{value=String(value);return value.includes(delimiter)||/["\r\n]/.test(value)?'"'+value.replace(/"/g,'""')+'"':value;}).join(delimiter)).join(newline);}
