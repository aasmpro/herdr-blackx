import importlib.util
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('transfer',Path(__file__).resolve().parents[1]/'src/mods/blackx-files/transfer.py')
transfer=importlib.util.module_from_spec(spec);spec.loader.exec_module(transfer)

class SnapshotTests(unittest.TestCase):
 def endpoint(self,request,code=None):
  result=subprocess.run([sys.executable,'-c',code or transfer.ENDPOINT,json.dumps(request)],capture_output=True,text=True)
  self.assertEqual(result.returncode,0,result.stderr)
  return json.loads(result.stdout or '{}')

 @unittest.skipUnless(hasattr(socket,'AF_UNIX') and hasattr(os,'mkfifo'),'Unix runtime entries')
 def test_snapshot_skips_sockets_and_pipes_and_preserves_data(self):
  with tempfile.TemporaryDirectory(prefix='bx-') as temp:
   root=Path(temp)/'data';root.mkdir();(root/'file').write_bytes(b'payload')
   os.link(root/'file',root/'hardlink');(root/'symlink').symlink_to('file')
   server=socket.socket(socket.AF_UNIX)
   try:
    server.bind(str(root/'s'));os.mkfifo(root/'fifo')
    snapshot=self.endpoint({'action':'snapshot','path':str(root)})
    try:
     metadata=json.loads((Path(snapshot['directory'])/'metadata.json').read_text())
     self.assertEqual(len(metadata['skipped']),2)
     self.assertEqual(metadata['manifest']['data/file'],metadata['manifest']['data/hardlink'])
     self.assertEqual(metadata['manifest']['data/symlink'],['link','file'])
    finally:self.endpoint({'action':'cleanup','path':snapshot['directory']})
   finally:server.close()

 def test_snapshot_reports_disappearing_file(self):
  with tempfile.TemporaryDirectory(prefix='bx-') as temp:
   root=Path(temp)/'data';root.mkdir();(root/'keep').write_text('keep');(root/'vanish').write_text('temporary')
   code=transfer.ENDPOINT.replace('     st=q.lstat()',"     if q.name=='vanish':q.unlink()\n     st=q.lstat()")
   snapshot=self.endpoint({'action':'snapshot','path':str(root)},code)
   try:
    metadata=json.loads((Path(snapshot['directory'])/'metadata.json').read_text())
    self.assertIn('data/keep',metadata['manifest'])
    self.assertNotIn('data/vanish',metadata['manifest'])
    self.assertEqual(metadata['skipped'],[{'path':'data/vanish','reason':'disappeared while copying'}])
   finally:self.endpoint({'action':'cleanup','path':snapshot['directory']})
