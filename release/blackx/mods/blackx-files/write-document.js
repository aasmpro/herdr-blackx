import { exec, writeTextFile, appHome } from "herdr";

export async function writeDocument(path, text, expected, on) {
  if (!on) return writeTextFile(path, text, expected);
  let folder;
  const helper = appHome() + '/mods/blackx-files/remote_save.py';
  try {
    const staged = await exec('python3', ['-c', 'import json,sys,tempfile; print(json.dumps(tempfile.mkdtemp(prefix=".blackx-save-",dir=sys.argv[1])))', appHome()]);
    if (staged.code) throw Error(staged.stderr || 'Cannot stage remote save');
    folder = JSON.parse(staged.stdout);
    await writeTextFile(folder + '/request.json', JSON.stringify({action:'write-text', path, text, expected, on}), null);
    const saved = await exec('python3', [helper, folder], {timeout:600000});
    const result = JSON.parse(saved.stdout || '{}');
    if (saved.code || result.error || !result.saved) throw Error(result.error || saved.stderr || 'Remote save failed');
  } finally {
    if (folder) await exec('python3', [helper, '--cleanup', folder]).catch(() => null);
  }
}
