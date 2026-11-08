import importlib.util
from pathlib import Path
import tempfile
import sys
import subprocess
import json
import unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('operations',Path(__file__).resolve().parents[1]/'src/mods/blackx-files/operations.py')
ops=importlib.util.module_from_spec(spec);spec.loader.exec_module(ops)
class FileOperations(unittest.TestCase):
 def test_copy_conflict_keep_both_and_move(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);src=root/'a';src.mkdir();dst=root/'b';dst.mkdir();p=src/'世界 file.txt';p.write_text('hello')
   r={'action':'paste','path':str(p),'destination':str(dst)}
   self.assertIn('destination',ops.main(r));self.assertIn('collision',ops.main(r))
   self.assertTrue(ops.main({**r,'choice':'keep'})['destination'].endswith('(2).txt'))
   with patch.object(ops,'trash') as trash:
    ops.main({**r,'choice':'replace','move':True});self.assertEqual(trash.call_count,2)
 def test_descendant_and_trash_failure_preserve_source(self):
  with tempfile.TemporaryDirectory() as t:
   p=Path(t);folder=p/'folder';folder.mkdir()
   with self.assertRaises(ValueError):ops.main({'action':'paste','path':str(folder),'destination':str(folder)})
   f=p/'file';f.write_text('keep')
   with patch.object(ops,'trash',side_effect=OSError('unavailable')):
    with self.assertRaises(OSError):ops.main({'action':'delete','path':str(f)})
   self.assertEqual(f.read_text(),'keep')

 @unittest.skipUnless(sys.platform=='darwin','macOS native Trash integration')
 def test_macos_delete_json_and_symlink_target(self):
  with tempfile.TemporaryDirectory(prefix='blackx-trash-regression-') as t:
   root=Path(t);target=root/'target.txt';target.write_text('keep target')
   link=root/(root.name+'-link.txt');link.symlink_to(target)
   folder=root/(root.name+"-世界's folder");folder.mkdir();(folder/'nested.txt').write_text('disposable')
   file=root/(root.name+"-世界's file.txt");file.write_text('disposable')
   for path in [link,folder,file]:
    result=subprocess.run([sys.executable,str(Path(ops.__file__)),json.dumps({'action':'delete','path':str(path)})],capture_output=True,text=True)
    self.assertEqual(result.returncode,0,result.stderr+result.stdout)
    self.assertEqual(json.loads(result.stdout),{})
    self.assertFalse(path.exists());self.assertFalse(path.is_symlink())
   self.assertEqual(target.read_text(),'keep target')
 def test_system_output_does_not_pollute_json(self):
  with patch.object(ops.subprocess,'run',return_value=subprocess.CompletedProcess([],0,'native success output','')):
   self.assertIsNone(ops.run_system(['example']))
 def test_reveal_uses_literal_path_argument(self):
  with tempfile.TemporaryDirectory() as t:
   p=Path(t)/"a file; 'quote.txt";p.write_text('disposable')
   with patch.object(ops,'run_system') as run:
    self.assertEqual(ops.main({'action':'reveal','path':str(p)}),{})
    self.assertIn(str(p),run.call_args.args[0][-1])

 def test_create_and_rename_without_overwrite(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);name="世界's file.txt"
   req={'action':'add-file','path':str(root),'destination':str(root),'name':name}
   self.assertEqual(ops.main(req)['destination'],str(root/name));self.assertEqual((root/name).read_bytes(),b'')
   (root/name).write_text('keep')
   with self.assertRaises(FileExistsError):ops.main(req)
   self.assertEqual((root/name).read_text(),'keep')
   folder=ops.main({**req,'action':'add-folder','name':'new folder'})['destination'];self.assertTrue(Path(folder).is_dir())
   renamed=ops.main({'action':'rename','path':str(root/name),'name':'renamed.txt'})
   self.assertEqual((root/'renamed.txt').read_text(),'keep');self.assertFalse((root/name).exists())
   self.assertEqual(renamed['renamed']['from'],str(root/name))
   (root/'occupied.txt').write_text('existing')
   with self.assertRaises(OSError):ops.main({'action':'rename','path':str(root/'renamed.txt'),'name':'occupied.txt'})
   self.assertEqual((root/'occupied.txt').read_text(),'existing');self.assertTrue((root/'renamed.txt').exists())
   ops.main({'action':'rename','path':folder,'name':'renamed folder'});self.assertTrue((root/'renamed folder').is_dir())
 def test_create_rename_validation_and_symlinks(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);f=root/'original';f.write_text('content');link=root/'link';link.symlink_to(f)
   for name in ['', '   ','.','..','../escape','a/b','bad\0name']:
    for action in ['add-file','add-folder','rename']:
     with self.assertRaises(ValueError):ops.main({'action':action,'path':str(f),'destination':str(root),'name':name})
   ops.main({'action':'rename','path':str(link),'name':'new link'})
   self.assertTrue((root/'new link').is_symlink());self.assertEqual(f.read_text(),'content')

 def test_same_folder_copy_offers_keep_both_without_replacing_source(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);file=root/'file.txt';file.write_text('original')
   request={'action':'paste','path':str(file),'destination':str(root)}
   result=ops.main(request);self.assertTrue(result['sameSource']);self.assertEqual(result['collision'],str(file))
   with self.assertRaises(ValueError):ops.main({**request,'choice':'replace'})
   copied=ops.main({**request,'choice':'keep'});self.assertEqual(Path(copied['destination']).read_text(),'original');self.assertEqual(file.read_text(),'original')
   self.assertTrue(ops.main({**request,'move':True})['unchanged']);self.assertTrue(file.exists())
   folder=root/'folder';folder.mkdir();(folder/'nested').write_text('nested')
   copied=ops.main({'action':'paste','path':str(folder),'destination':str(root),'choice':'keep'})
   self.assertEqual((Path(copied['destination'])/'nested').read_text(),'nested')
 def test_text_save_preserves_newlines_and_rejects_stale_or_missing_file(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);file=root/'file.txt';file.write_bytes(b'old\r\n')
   request={'action':'write-text','path':str(file),'expected':'old\r\n','text':'new 世界\r\n'}
   self.assertTrue(ops.main(request)['saved']);self.assertEqual(file.read_bytes(),'new 世界\r\n'.encode())
   with self.assertRaises(ValueError):ops.main(request)
   self.assertEqual(file.read_bytes(),'new 世界\r\n'.encode())
   with self.assertRaises(FileNotFoundError):ops.main({**request,'path':str(root/'missing')})
   self.assertEqual(list(root.glob('.blackx-save-*')),[])
