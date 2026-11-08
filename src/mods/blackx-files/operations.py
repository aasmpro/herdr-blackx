"""Blackx file operations. Invoked with a JSON request, never shell paths."""
import json, os, pathlib, shutil, subprocess, sys, tempfile, hashlib, ctypes

def run_system(args):
    result=subprocess.run(args,capture_output=True,text=True)
    if result.returncode:
        raise OSError(result.stderr.strip() or result.stdout.strip() or 'System operation failed')

def trash(path):
    if sys.platform == 'darwin':
        # Native filesystem API: no Finder automation, alias resolution, or stdout pollution.
        script="ObjC.import('Foundation'); function run(argv) { var error = Ref(); if (!$.NSFileManager.defaultManager.trashItemAtURLResultingItemURLError($.NSURL.fileURLWithPath(argv[0]), null, error)) throw Error(ObjC.unwrap(error[0].localizedDescription)); }"
        run_system(['osascript','-l','JavaScript','-e',script,str(path)])
    elif os.name == 'nt':
        script='Add-Type -AssemblyName Microsoft.VisualBasic; $p=$args[0]; if (Test-Path -LiteralPath $p -PathType Container) {[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($p,"OnlyErrorDialogs","SendToRecycleBin")} else {[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p,"OnlyErrorDialogs","SendToRecycleBin")}'
        run_system(['powershell','-NoProfile','-Command',script,str(path)])
    else:
        run_system(['gio','trash','--',str(path)])

def fingerprint(p):
    out={}
    for q in [p]+(sorted(p.rglob('*')) if p.is_dir() and not p.is_symlink() else []):
        key=str(q.relative_to(p.parent))
        if q.is_symlink(): out[key]=('link',os.readlink(q))
        elif q.is_dir(): out[key]=('dir',)
        elif q.is_file():
            h=hashlib.sha256()
            with q.open('rb') as f:
                for block in iter(lambda:f.read(1048576),b''):h.update(block)
            out[key]=('file',q.stat().st_size,h.hexdigest())
        else: raise ValueError('Unsupported file type')
    return out

def child_name(value):
    if not isinstance(value,str) or not value.strip() or value in ('.','..') or '\0' in value or '/' in value or (os.name=='nt' and ('\\' in value or ':' in value)):
        raise ValueError('Enter a single file or folder name')
    return value

def rename_exclusive(source,destination):
    # os.rename overwrites files on Unix. Use each OS's no-replace primitive.
    if os.name=='nt':return os.rename(source,destination)
    libc=ctypes.CDLL(None,use_errno=True)
    if sys.platform=='darwin':
        fn=libc.renamex_np;fn.argtypes=[ctypes.c_char_p,ctypes.c_char_p,ctypes.c_uint]
        result=fn(os.fsencode(source),os.fsencode(destination),4)  # RENAME_EXCL
    elif sys.platform.startswith('linux'):
        fn=libc.renameat2;fn.argtypes=[ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint]
        result=fn(-100,os.fsencode(source),-100,os.fsencode(destination),1)  # RENAME_NOREPLACE
    else:raise OSError('Safe rename is unavailable on this platform')
    if result:
        error=ctypes.get_errno();raise OSError(error,os.strerror(error),str(destination))

def write_text(r):
    original=pathlib.Path(r['path']);p=original.resolve(strict=True)
    expected=r['expected'];text=r['text']
    if not isinstance(expected,str) or not isinstance(text,str) or '\0' in text:
        raise ValueError('Expected UTF-8 text')
    def read():
        with p.open('r',encoding='utf-8',newline='') as f:return f.read()
    if read()!=expected:raise ValueError('File changed on disk; reopen or reconcile your draft before saving')
    stat=p.stat();name=None
    try:
        with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',newline='',dir=p.parent,prefix='.blackx-save-',delete=False) as f:
            name=f.name;f.write(text);f.flush();os.fsync(f.fileno());os.chmod(name,stat.st_mode & 0o777)
        if original.resolve(strict=True)!=p or read()!=expected or (p.stat().st_dev,p.stat().st_ino)!=(stat.st_dev,stat.st_ino):
            raise ValueError('File changed on disk; your draft was not written')
        os.replace(name,p);name=None
        return {'saved':True}
    finally:
        if name is not None:os.unlink(name)

def perform(r):
    p=pathlib.Path(r['path'])
    action=r['action']
    if action=='write-text':return write_text(r)
    if action in ('add-file','add-folder'):
        dest=pathlib.Path(r['destination'])/child_name(r.get('name'))
        if action=='add-file':
            with dest.open('xb'):pass
        else:dest.mkdir()
        return {'destination':str(dest)}
    if action=='rename':
        dest=p.with_name(child_name(r.get('name')))
        if p==dest:
            if not os.path.lexists(p):raise FileNotFoundError(str(p))
            return {'destination':str(dest)}
        rename_exclusive(p,dest)
        return {'destination':str(dest),'renamed':{'from':str(p),'to':str(dest)}}
    if r['action']=='delete': trash(p); return {}
    if r['action']=='reveal':
        if sys.platform=='darwin': args=['open','-R',str(p)]
        elif os.name=='nt': args=['explorer.exe',str(p) if p.is_dir() else '/select,'+str(p)]
        else: args=['xdg-open',str(p if p.is_dir() else p.parent)]
        run_system(args); return {}
    if action!='paste':raise ValueError('Unknown file operation')
    dest=pathlib.Path(r['destination'])/p.name
    same_source=os.path.normcase(str(p.parent.resolve()/p.name))==os.path.normcase(str(dest.parent.resolve()/dest.name))
    if same_source and r.get('move'):
        if not os.path.lexists(p):raise FileNotFoundError(str(p))
        return {'destination':str(p),'unchanged':True}
    if p.is_dir() and not p.is_symlink() and not same_source and p.resolve() in dest.resolve().parents:
        raise ValueError('Cannot paste a folder inside itself')
    if same_source and r.get('choice') not in (None,'keep'):
        raise ValueError('Choose Keep both to duplicate an item in its own folder')
    if os.path.lexists(dest):
        choice=r.get('choice')
        if not choice: return {'collision':str(dest),'sameSource':same_source}
        if choice=='keep':
            n=2
            while os.path.lexists(dest):
                dest=dest.with_name(p.stem+' ('+str(n)+')'+p.suffix); n+=1
        elif choice!='replace': raise ValueError('Invalid collision choice')
    before=fingerprint(p)
    with tempfile.TemporaryDirectory(prefix='.blackx-',dir=dest.parent) as temp:
        staged=pathlib.Path(temp)/p.name
        if p.is_symlink(): staged.symlink_to(os.readlink(p),target_is_directory=p.is_dir())
        elif p.is_dir(): shutil.copytree(p,staged,symlinks=True)
        elif p.is_file(): shutil.copy2(p,staged)
        else: raise ValueError('Unsupported file type')
        if before!=fingerprint(staged) or before!=fingerprint(p): raise ValueError('Source changed or copy verification failed')
        if os.path.lexists(dest):
            if r.get('choice')!='replace': raise ValueError('Destination appeared during paste; retry')
            trash(dest)
        os.rename(staged,dest)
    if r.get('move'):
        if before!=fingerprint(p): raise ValueError('Destination copied; source changed and was retained')
        trash(p)
    return {'destination':str(dest)}
def main(r):
    if r['action'] not in ('paste','add-file','add-folder','rename','write-text'):return perform(r)
    parent=pathlib.Path(r['path']).parent if r['action'] in ('rename','write-text') else pathlib.Path(r['destination'])
    lock=parent/'.blackx-write-lock'
    try:lock.mkdir()
    except FileExistsError:raise ValueError('Another operation is using this folder; retry when it finishes')
    try:return perform(r)
    finally:lock.rmdir()

if __name__=='__main__':
    try: print(json.dumps(main(json.load(sys.stdin) if sys.argv[1]=='--stdin' else json.loads(sys.argv[1]))))
    except Exception as e: print(json.dumps({'error':str(e)})); sys.exit(1)
