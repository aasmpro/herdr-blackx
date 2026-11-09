"""Bounded, private local image/PDF staging for the native Files viewer."""
import hashlib,json,pathlib,shutil,subprocess,sys,time

def preview(home,path,machine,page=1,cached=False):
    cache=pathlib.Path(home)/'blackx-preview-cache';cache.mkdir(mode=0o700,exist_ok=True)
    for p in cache.iterdir():
        if p.is_dir() and time.time()-p.stat().st_mtime>86400:shutil.rmtree(p)
    folder=cache/hashlib.sha256((str(machine)+'\0'+path).encode()).hexdigest();folder.mkdir(mode=0o700,exist_ok=True)
    source=folder/('source'+pathlib.Path(path).suffix.lower())
    if cached and source.is_file():
        pass  # Subsequent pages use the same staged PDF snapshot.
    elif machine:
        script="import pathlib,sys; p=pathlib.Path(sys.argv[1]); n=p.stat().st_size; assert n<=52428800, 'Preview exceeds 50 MiB'; sys.stdout.buffer.write(p.read_bytes())"
        r=subprocess.run(['hc','exec','--on',machine,'--timeout','60','python3','-c',script,path],capture_output=True,timeout=70)
        if r.returncode:raise ValueError(r.stderr.decode(errors='replace'))
        if len(r.stdout)>52428800:raise ValueError('Preview exceeds 50 MiB')
        source.write_bytes(r.stdout)
    else:
        p=pathlib.Path(path)
        if p.stat().st_size>52428800:raise ValueError('Preview exceeds 50 MiB')
        shutil.copyfile(p,source)
    if source.suffix=='.pdf':
        if not shutil.which('pdfinfo') or not shutil.which('pdftoppm'):raise ValueError('PDF preview requires Poppler: brew install poppler')
        info=subprocess.run(['pdfinfo',str(source)],capture_output=True,text=True,timeout=30,check=True).stdout
        pages=int(next(line.split(':',1)[1] for line in info.splitlines() if line.startswith('Pages:')))
        page=max(1,min(page,pages));out=folder/('page-'+str(page))
        subprocess.run(['pdftoppm','-f',str(page),'-l',str(page),'-scale-to','1600','-singlefile','-png',str(source),str(out)],capture_output=True,timeout=60,check=True)
        source=out.with_suffix('.png')
    else:pages=1
    return {'path':str(source.relative_to(home)),'pages':pages,'page':page}
if __name__=='__main__':
    try:print(json.dumps(preview(sys.argv[1],sys.argv[2],sys.argv[3] or None,int(sys.argv[4]),len(sys.argv)>5 and sys.argv[5]=='--cached')))
    except Exception as e:print(json.dumps({'error':str(e)}));sys.exit(1)
