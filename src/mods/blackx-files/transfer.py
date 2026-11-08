"""Copy verified snapshots through bounded hc messages, including live folders."""
import hashlib
import json
import pathlib
import subprocess

# machine.exec has an 8 MiB input/output cap. Each payload stays well below it.
CHUNK_SIZE = 2 * 1024 * 1024

ENDPOINT = r'''
import hashlib,json,os,pathlib,sys,tarfile,tempfile,shutil,stat
r=json.loads(sys.argv[1]); p=pathlib.Path(r['path'])
def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(1048576),b''):h.update(block)
 return h.hexdigest()
def manifest(p):
 out={}
 for q in [p]+(sorted(p.rglob('*')) if p.is_dir() and not p.is_symlink() else []):
  key=q.relative_to(p.parent).as_posix()
  if q.is_symlink():out[key]=['link',os.readlink(q)]
  elif q.is_dir():out[key]=['dir']
  elif q.is_file():out[key]=['file',q.stat().st_size,digest(q)]
  else:raise ValueError('Cannot move a live runtime entry: '+str(q))
 return out
def manifest_hash(value):
 return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()
if r['action']=='manifest-hash':
 print(json.dumps(manifest_hash(manifest(p))))
elif r['action']=='snapshot':
 # Private staging is outside the folder in normal use. Explicitly omit it if
 # copying an ancestor such as /tmp, so the archive never includes itself.
 folder=pathlib.Path(tempfile.mkdtemp(prefix='.blackx-export-'))
 copied={};skipped=[];warnings=[]
 try:
  with tarfile.open(folder/'archive.tar',mode='w') as archive:
   def emit(q):
    key=q.relative_to(p.parent).as_posix()
    if q==folder:
     skipped.append({'path':key,'reason':'transfer staging area'});return
    try:
     st=q.lstat()
     if not (stat.S_ISREG(st.st_mode) or stat.S_ISDIR(st.st_mode) or stat.S_ISLNK(st.st_mode)):
      if q==p:raise ValueError('Cannot copy a runtime entry directly: '+str(q))
      skipped.append({'path':key,'reason':'runtime socket, pipe or device'});return
     info=archive.gettarinfo(str(q),arcname=key)
     if stat.S_ISREG(st.st_mode):
      h=hashlib.sha256();size=0
      with q.open('rb') as source,tempfile.TemporaryFile(dir=folder) as snapshot:
       initial=os.fstat(source.fileno());remaining=initial.st_size
       while remaining:
        block=source.read(min(1048576,remaining))
        if not block:break
        snapshot.write(block);h.update(block);size+=len(block);remaining-=len(block)
       final=os.fstat(source.fileno())
       if (initial.st_size,initial.st_mtime_ns,initial.st_ctime_ns)!=(final.st_size,final.st_mtime_ns,final.st_ctime_ns):
        warnings.append({'path':key,'reason':'changed while copying; copied a file snapshot'})
       snapshot.seek(0);info.type=tarfile.REGTYPE;info.linkname='';info.size=size
       archive.addfile(info,snapshot)
      copied[key]=['file',size,h.hexdigest()]
     elif stat.S_ISLNK(st.st_mode):
      archive.addfile(info);copied[key]=['link',info.linkname]
     else:
      archive.addfile(info);copied[key]=['dir']
      for child in sorted(q.iterdir()):emit(child)
    except FileNotFoundError:
     if q==p:raise
     skipped.append({'path':key,'reason':'disappeared while copying'})
   emit(p)
  metadata={'root':p.name,'manifest':copied,'skipped':skipped,'warnings':warnings}
  (folder/'metadata.json').write_text(json.dumps(metadata),encoding='utf-8')
  files={name:{'size':(folder/name).stat().st_size,'sha256':digest(folder/name)} for name in ['archive.tar','metadata.json']}
  print(json.dumps({'directory':str(folder),'files':files}))
 except BaseException:
  shutil.rmtree(folder);raise
elif r['action']=='chunk-read':
 if not 0<r['size']<=2097152:raise ValueError('Invalid chunk size')
 with p.open('rb') as f:f.seek(r['offset']);sys.stdout.buffer.write(f.read(r['size']))
elif r['action']=='chunk-write':
 block=sys.stdin.buffer.read(2097153)
 if len(block)>2097152 or hashlib.sha256(block).hexdigest()!=r['sha256']:raise ValueError('Invalid transfer chunk')
 with p.open('xb' if r['offset']==0 else 'r+b') as f:
  f.seek(0,2)
  if f.tell()!=r['offset']:raise ValueError('Transfer chunk offset mismatch')
  f.write(block)
 print(json.dumps({'written':len(block)}))
elif r['action']=='import':
 # Expected hashes are small fixed-size values; the full manifest travels in chunks.
 for name,expected in r['files'].items():
  if name not in ('archive.tar','metadata.json'):raise ValueError('Invalid transfer artifact')
  if (p/name).stat().st_size!=expected['size'] or digest(p/name)!=expected['sha256']:raise ValueError('Transfer artifact checksum mismatch')
 metadata=json.loads((p/'metadata.json').read_text(encoding='utf-8'))
 root=metadata['root']
 if not root or root in ('.','..') or '/' in root or (os.name=='nt' and ('\\' in root or ':' in root)):raise ValueError('Invalid archive root')
 tree=p/'tree';tree.mkdir()
 with tarfile.open(p/'archive.tar',mode='r:') as archive:
  for m in archive:
   parts=pathlib.PurePosixPath(m.name)
   if parts.is_absolute() or '..' in parts.parts or not parts.parts or parts.parts[0]!=root or m.isdev() or m.isfifo() or m.islnk():raise ValueError('Unsafe archive entry')
   if os.name=='nt' and any('\\' in part or ':' in part for part in parts.parts):raise ValueError('Filename cannot be represented on Windows')
   target=tree.joinpath(*parts.parts)
   if any((tree/pathlib.Path(*parts.parts[:i])).is_symlink() for i in range(1,len(parts.parts))):raise ValueError('Archive traverses symlink')
   if m.isdir():target.mkdir(parents=True,exist_ok=True)
   elif m.issym():target.parent.mkdir(parents=True,exist_ok=True);target.symlink_to(m.linkname)
   elif m.isfile():
    target.parent.mkdir(parents=True,exist_ok=True)
    with target.open('xb') as f:shutil.copyfileobj(archive.extractfile(m),f)
    os.chmod(target,m.mode & 0o777)
   else:raise ValueError('Unsupported archive entry')
 after=manifest(tree/root)
 if after!=metadata['manifest']:raise ValueError('Copied file verification failed')
 print(json.dumps({'root':root,'manifestHash':manifest_hash(after),'verifiedFiles':sum(v[0]=='file' for v in after.values()),'skipped':metadata['skipped'],'warnings':metadata['warnings']}))
elif r['action']=='stage':
 print(json.dumps(tempfile.mkdtemp(prefix='.blackx-transfer-',dir=p)))
elif r['action']=='cleanup':
 if p.exists():shutil.rmtree(p)
'''


def command(machine, request):
    return ['hc', 'exec', *(['--on', machine] if machine else []), '--timeout', '600',
            '-i', 'python3', '-c', ENDPOINT, json.dumps(request)]


def execute(machine, request, payload=None):
    result = subprocess.run(command(machine, request), input=payload, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace'))
    return result.stdout


def call(machine, request, payload=None):
    return json.loads(execute(machine, request, payload) or b'{}')


def copy_artifact(source, target, source_path, target_path, expected):
    checksum = hashlib.sha256()
    for offset in range(0, expected['size'], CHUNK_SIZE):
        size = min(CHUNK_SIZE, expected['size'] - offset)
        block = execute(source, {'action': 'chunk-read', 'path': source_path, 'offset': offset, 'size': size})
        if len(block) != size:
            raise RuntimeError('Transfer chunk was truncated')
        checksum.update(block)
        saved = call(target, {'action': 'chunk-write', 'path': target_path, 'offset': offset,
                              'sha256': hashlib.sha256(block).hexdigest()}, block)
        if saved.get('written') != size:
            raise RuntimeError('Transfer chunk was not fully written')
    if checksum.hexdigest() != expected['sha256']:
        raise RuntimeError('Transfer artifact checksum mismatch')


def transfer(request):
    source, target = request['source'], request['target']
    snapshot = stage = None
    try:
        before = call(source.get('on'), {'action': 'manifest-hash', 'path': source['path']}) if source.get('move') else None
        snapshot = call(source.get('on'), {'action': 'snapshot', 'path': source['path']})
        stage = call(target.get('on'), {'action': 'stage', 'path': target['destination']})
        for name, expected in snapshot['files'].items():
            copy_artifact(source.get('on'), target.get('on'), snapshot['directory'] + '/' + name,
                          stage + '/' + name, expected)
        copied = call(target.get('on'), {'action': 'import', 'path': stage, 'files': snapshot['files']})
        if source.get('move') and (copied['skipped'] or copied['manifestHash'] != before or
                before != call(source.get('on'), {'action': 'manifest-hash', 'path': source['path']})):
            raise RuntimeError('Source changed or contains runtime entries')
        helper = pathlib.Path(__file__).with_name('operations.py').read_text()
        payload = {'action': 'paste', 'path': stage + '/tree/' + copied['root'],
                   'destination': target['destination'], 'choice': request.get('choice'), 'move': False}
        published = subprocess.run(['hc', 'exec', *(['--on', target['on']] if target.get('on') else []),
                                    '--timeout', '600', 'python3', '-c', helper, json.dumps(payload)],
                                   capture_output=True, text=True)
        result = json.loads(published.stdout or '{}')
        if published.returncode:
            raise RuntimeError(result.get('error') or published.stderr)
        if not result.get('collision') and source.get('move'):
            if before != call(source.get('on'), {'action': 'manifest-hash', 'path': source['path']}):
                raise RuntimeError('Destination copied; source changed')
            deleted = subprocess.run(['hc', 'exec', *(['--on', source['on']] if source.get('on') else []),
                                      'python3', '-c', helper, json.dumps({'action': 'delete', 'path': source['path']})],
                                     capture_output=True, text=True)
            if deleted.returncode:
                raise RuntimeError('Destination copied; source cleanup failed: ' + deleted.stdout + deleted.stderr)
        call(target.get('on'), {'action': 'cleanup', 'path': stage})
        stage = None
        result.update({key: copied[key] for key in ['skipped', 'warnings', 'verifiedFiles']})
        return result
    except Exception as error:
        recovery = ' Staging path: ' + stage if stage else ''
        raise RuntimeError(str(error) + '; source retained.' + recovery) from error
    finally:
        if snapshot:
            try: call(source.get('on'), {'action': 'cleanup', 'path': snapshot['directory']})
            except Exception: pass  # Source cleanup must not hide the operation outcome.


if __name__ == '__main__':
    import sys
    try:
        print(json.dumps(transfer(json.loads(sys.argv[1]))))
    except Exception as error:
        print(json.dumps({'error': str(error)}))
        sys.exit(1)
