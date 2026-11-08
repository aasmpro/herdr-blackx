"""Exercise Blackx against two already connected disposable hc machines."""
import argparse, importlib.util, json, pathlib, subprocess, tempfile, uuid, os
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('transfer',ROOT/'src/mods/blackx-files/transfer.py');transfer=importlib.util.module_from_spec(spec);spec.loader.exec_module(transfer)
HELPER=(ROOT/'src/mods/blackx-files/operations.py').read_text()
def remote(machine,code,*args):
 r=subprocess.run(['hc','exec',*(['--on',machine] if machine else []),'--timeout','60','python3','-c',code,*args],capture_output=True,text=True)
 if r.returncode:raise RuntimeError(r.stdout+r.stderr)
 return json.loads(r.stdout or '{}')
def operation(machine,request):return remote(machine,HELPER,json.dumps(request))
def main(a,b):
 results=[];root='/tmp/blackx-files-'+uuid.uuid4().hex
 setup='''import pathlib,sys,json
p=pathlib.Path(sys.argv[1]);p.mkdir();(p/'source').mkdir();(p/'dest').mkdir();q=p/'source'/'世界 folder';q.mkdir();(q/'a file;literal.txt').write_text('hello 世界');(q/'binary').write_bytes(bytes(range(256))*4096);(q/'link').symlink_to('a file;literal.txt');__import__('os').link(q/'binary',q/'binary hardlink');(q/'.hidden').write_text('hidden content');(q/'empty').mkdir();print('{}')'''
 for m in [a,b]:remote(m,setup,root)
 for machine in [a,b]:
  operation(machine,{'action':'add-file','path':root,'destination':root,'name':"new 世界's file.txt"})
  operation(machine,{'action':'add-folder','path':root,'destination':root,'name':'new folder'})
  renamed=operation(machine,{'action':'rename','path':root+"/new 世界's file.txt",'name':'renamed.txt'})
  assert renamed['destination']==root+'/renamed.txt'
  operation(machine,{'action':'rename','path':root+'/new folder','name':'renamed folder'})
  for request in [
   {'action':'add-file','path':root,'destination':root,'name':'renamed.txt'},
   {'action':'add-folder','path':root,'destination':root,'name':'renamed folder'},
   {'action':'rename','path':root+'/renamed.txt','name':'renamed folder'}]:
   try:operation(machine,request)
   except RuntimeError:pass
   else:raise AssertionError('Collision accepted')
  same={'action':'paste','path':root+'/renamed.txt','destination':root}
  assert operation(machine,same)['sameSource']
  assert operation(machine,{**same,'choice':'keep'})['destination']==root+'/renamed (2).txt'
  assert operation(machine,{**same,'move':True})['unchanged']
  results.append(machine+' same-folder file duplicate')
  results.extend([machine+' create file/folder',machine+' rename file/folder',machine+' refuse create/rename collisions'])
 with tempfile.TemporaryDirectory(prefix='blackx-remote-local-') as temp:
  local=pathlib.Path(temp);(local/'dest').mkdir();f=local/'local.txt';f.write_text('local data')
  odd=local/'back\\slash 世界.txt';odd.write_text('literal backslash')
  def run(label,source,on,destination,to,**kw):
   result=transfer.transfer({'source':{'path':str(source),'on':on,'move':kw.pop('move',False)},'target':{'destination':str(destination),'on':to},**kw});results.append(label);return result
  # Exercise the same private-file + stdin coordinator used by the mod, including > argv limit.
  for machine in [a,b]:
   large='old\r\n';remote(machine,"import pathlib,sys,json;pathlib.Path(sys.argv[1]).write_bytes(b'old\\r\\n');print('{}')",root+'/editable.txt')
   content=('Unicode 世界 and CRLF\r\n'*15000)
   def save_remote(expected,text):
    folder=pathlib.Path(tempfile.mkdtemp(prefix='.blackx-save-',dir=local))
    (folder/'request.json').write_text(json.dumps({'action':'write-text','path':root+'/editable.txt','expected':expected,'text':text,'on':machine}))
    result=subprocess.run(['python3',str(ROOT/'src/mods/blackx-files/remote_save.py'),str(folder)],capture_output=True,text=True)
    assert not folder.exists()
    return result
   saved=save_remote(large,content);assert saved.returncode==0,saved.stdout+saved.stderr
   checksum=remote(machine,"import pathlib,sys,hashlib,json;print(json.dumps(hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest()))",root+'/editable.txt')
   assert checksum==__import__('hashlib').sha256(content.encode()).hexdigest()
   conflict=save_remote(large,'stale write');assert conflict.returncode!=0 and 'changed on disk' in conflict.stdout
   results.extend([machine+' remote edit/save large Unicode CRLF file',machine+' stale save preserves remote file'])
  runtime=root+'/source/runtime folder'
  remote(a,"import pathlib,sys,json,socket,os;p=pathlib.Path(sys.argv[1]);p.mkdir();(p/'large.bin').write_bytes(bytes(range(256))*49152);s=socket.socket(socket.AF_UNIX);s.bind(str(p/'service.sock'));s.close();os.mkfifo(p/'events.fifo');print('{}')",runtime)
  local_runtime=local/'runtime-destination';local_runtime.mkdir()
  copied=run('remote→local >8 MiB with socket and FIFO',runtime,a,local_runtime,None)
  assert len(copied['skipped'])==2 and copied['verifiedFiles']==1
  assert (local_runtime/'runtime folder'/'large.bin').stat().st_size==12*1024*1024
  assert not (local_runtime/'runtime folder'/'service.sock').exists()
  assert not (local_runtime/'runtime folder'/'events.fifo').exists()
  copied=run('remote→remote >8 MiB with socket and FIFO',runtime,a,root+'/dest',b)
  assert len(copied['skipped'])==2 and copied['verifiedFiles']==1
  assert run('local→remote',f,None,root+'/dest',a)['destination']
  assert run('literal backslash and Unicode filename',odd,None,root+'/dest',a)['destination'].endswith(odd.name)
  assert run('remote→local',root+'/dest/local.txt',a,local/'dest',None)['destination']
  assert (local/'dest/local.txt').read_text()=='local data'
  local_folder=run('remote→local folder with hardlinks',root+'/source/世界 folder',a,local/'dest',None)['destination']
  assert (pathlib.Path(local_folder)/'binary').read_bytes()==(pathlib.Path(local_folder)/'binary hardlink').read_bytes()
  assert (pathlib.Path(local_folder)/'.hidden').read_text()=='hidden content'
  assert (pathlib.Path(local_folder)/'link').is_symlink()
  assert run('remote→remote folder + binary + symlink + hardlink',root+'/source/世界 folder',a,root+'/dest',b)['destination']
  assert 'collision' in run('duplicate detection',root+'/source/世界 folder',a,root+'/dest',b)
  assert '(2)' in run('keep both',root+'/source/世界 folder',a,root+'/dest',b,choice='keep')['destination']
  assert run('replace → Trash',root+'/source/世界 folder',a,root+'/dest',b,choice='replace')['destination']
  operation(a,{'action':'paste','path':root+'/source/世界 folder','destination':root+'/dest'});results.append('same-remote folder copy')
  operation(a,{'action':'paste','path':root+'/dest/世界 folder','destination':root+'/source','move':True,'choice':'keep'});results.append('same-remote folder move with Keep both')
  result=run('remote move',root+'/dest/local.txt',a,root+'/dest',b,move=True)
  exists='import pathlib,sys,json; print(json.dumps(pathlib.Path(sys.argv[1]).exists()))'
  assert not remote(a,exists,root+'/dest/local.txt')
  assert remote(b,exists,result['destination'])
  operation(b,{'action':'delete','path':result['destination']});assert not remote(b,exists,result['destination']);results.append('delete → Trash')
  trash='import pathlib,json;print(json.dumps([p.name for p in (pathlib.Path.home()/".local/share/Trash/files").iterdir()]))'
  assert remote(b,trash);results.append('Trash recoverability')
  try:run('unreachable destination',root+'/source/世界 folder',a,root+'/missing/child',b)
  except Exception:pass
  else:raise AssertionError('Missing destination accepted')
  assert remote(a,exists,root+'/source/世界 folder');results.append('failed transfer preserves source')
 # Inject a truncated chunk on a real remote endpoint.
 original_command=transfer.command
 def truncated(machine,request):
  if request['action']=='chunk-read':
   return ['hc','exec','--on',machine,'python3','-c',"import sys;sys.stdout.buffer.write(b'truncated archive');sys.exit(42)"]
  return original_command(machine,request)
 transfer.command=truncated
 try:
  try:transfer.transfer({'source':{'path':root+'/source/世界 folder','on':a,'move':True},'target':{'destination':root+'/dest','on':b}})
  except RuntimeError as error:assert 'source retained' in str(error)
  else:raise AssertionError('Truncated export accepted')
 finally:transfer.command=original_command
 assert remote(a,exists,root+'/source/世界 folder');results.append('interrupted remote stream preserves move source')
 # Change a source after its baseline manifest but before final verification.
 original_call=transfer.call;counts={}
 def changed(machine,request):
  if machine==a and request['action']=='manifest-hash':
   counts['manifest']=counts.get('manifest',0)+1
   if counts['manifest']==2:
    remote(a,"import pathlib,sys;pathlib.Path(sys.argv[1]).write_text('changed during transfer')",root+'/source/世界 folder/a file;literal.txt')
  return original_call(machine,request)
 transfer.call=changed
 try:
  try:transfer.transfer({'source':{'path':root+'/source/世界 folder','on':a,'move':True},'target':{'destination':root+'/dest','on':b}})
  except RuntimeError as error:assert 'source retained' in str(error)
  else:raise AssertionError('Changed source accepted')
 finally:transfer.call=original_call
 assert remote(a,exists,root+'/source/世界 folder');results.append('concurrent source change aborts move')
 # Trash must fail closed when the remote OS tool is unavailable.
 unavailable="import os;os.environ['PATH']='';"+HELPER
 try:remote(a,unavailable,json.dumps({'action':'delete','path':root+'/source/世界 folder'}))
 except RuntimeError:pass
 else:raise AssertionError('Delete succeeded without Trash')
 assert remote(a,exists,root+'/source/世界 folder');results.append('unavailable Trash preserves source')
 print(json.dumps({'machines':[a,b],'fixture_root':root,'passed':results},ensure_ascii=False,indent=2))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('machine_a');p.add_argument('machine_b');args=p.parse_args();main(args.machine_a,args.machine_b)
