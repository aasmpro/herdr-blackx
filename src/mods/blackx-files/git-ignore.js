import { exec } from "herdr";

// Use Git's rules, including negations and tracked-file exceptions, with NUL
// delimiters so spaces, quotes and newlines in names stay intact.
const CHECK = 'import json,subprocess,sys; paths=json.loads(sys.argv[1]); r=subprocess.run(["git","check-ignore","-z","--stdin"],input=("\\0".join(paths)+"\\0").encode("utf-8"),capture_output=True); print(json.dumps(r.stdout.decode("utf-8").split("\\0")[:-1] if r.returncode in (0,1) else []))';

export async function ignoredPaths(root, paths, on) {
  const ignored = new Set();
  let batch = [], length = 0;
  const flush = async () => {
    if (!batch.length) return;
    try {
      const result = await exec('python3', ['-c', CHECK, JSON.stringify(batch)], {cwd:root, on});
      if (result.code === 0) for (const path of JSON.parse(result.stdout || '[]')) ignored.add(path);
    } catch { /* Non-Git folders or unavailable Git keep the normal text color. */ }
    batch = []; length = 0;
  };
  for (const path of paths) {
    const size = JSON.stringify(path).length + 1;
    if (length + size > 16000) await flush();
    batch.push(path); length += size;
  }
  await flush();
  return ignored;
}
