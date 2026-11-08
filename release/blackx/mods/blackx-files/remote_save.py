"""Stream a private local save request through hc stdin, avoiding argv size limits."""
import json, pathlib, subprocess, sys

def cleanup(folder):
    folder=pathlib.Path(folder)
    if not folder.name.startswith('.blackx-save-'):raise ValueError('Invalid save request directory')
    (folder/'request.json').unlink(missing_ok=True)
    try:folder.rmdir()
    except FileNotFoundError:pass

def save(folder):
    folder=pathlib.Path(folder)
    if not folder.name.startswith('.blackx-save-'):raise ValueError('Invalid save request directory')
    try:
        payload=(folder/'request.json').read_bytes();request=json.loads(payload)
        helper=pathlib.Path(__file__).with_name('operations.py').read_text()
        machine=request['on']
        if not isinstance(machine,str) or not machine:raise ValueError('Missing remote machine')
        result=subprocess.run(['hc','exec','--on',machine,'--timeout','600','--stdin','python3','-c',helper,'--stdin'],input=payload,capture_output=True)
        if result.returncode:
            try:message=json.loads(result.stdout).get('error')
            except (ValueError,TypeError):message=None
            raise OSError(message or result.stderr.decode(errors='replace') or 'Remote save failed')
        return json.loads(result.stdout)
    finally:cleanup(folder)

if __name__=='__main__':
    try:
        if sys.argv[1]=='--cleanup':cleanup(sys.argv[2]);result={}
        else:result=save(sys.argv[1])
        print(json.dumps(result))
    except Exception as error:print(json.dumps({'error':str(error)}));sys.exit(1)
