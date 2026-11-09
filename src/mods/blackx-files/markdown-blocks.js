// Keep exact source offsets and blank separators when editing rendered blocks.
// Blank lines inside fenced code stay in the same block.
export function markdownBlocks(text) {
  const blocks=[];let start=0,offset=0,fence=null;
  const lines=text.match(/[^\n]*\n|[^\n]+$/g)||[];
  const push=end=>{if(end>start&&text.slice(start,end).trim())blocks.push({start,end,text:text.slice(start,end)});};
  for(const line of lines){
    const marker=line.match(/^ {0,3}(`{3,}|~{3,})(.*?)(?:\r?\n)?$/);
    if(marker){
      if(!fence)fence={char:marker[1][0],length:marker[1].length};
      else if(marker[1][0]===fence.char&&marker[1].length>=fence.length&&!marker[2].trim())fence=null;
    }
    if(!fence&&!line.trim()){push(offset);start=offset+line.length;}
    offset+=line.length;
  }
  push(text.length);
  if(!blocks.length)blocks.push({start:0,end:text.length,text});
  return blocks;
}
