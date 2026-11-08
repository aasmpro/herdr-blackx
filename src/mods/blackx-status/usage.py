import json, subprocess, sys, time, select, os
from pathlib import Path
provider = sys.argv[1] if len(sys.argv)>1 else "codex"
try:
 if provider == "claude":
  d=json.loads((Path.home()/".ai-usage-bridge/claude.json").read_text())
  def window(k):
   w=d.get(k) or {}
   return {"used_percent":w.get("usedPercentage"),"resets_at":w["resetsAt"]/1000 if w.get("resetsAt") else None}
  result={"timestamp":d.get("updatedAt",0)/1000,"primary":window("fiveHour"),"secondary":window("sevenDay")}
 else:
  proc=subprocess.Popen(["/Users/ross/.nvm/versions/node/v24.20.0/bin/codex","app-server"],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL, env={**os.environ, "PATH": "/Users/ross/.nvm/versions/node/v24.20.0/bin:" + os.environ.get("PATH", "/usr/bin:/bin")}, bufsize=0)
  try:
   def send(x):
    proc.stdin.write((json.dumps(x)+"\n").encode()); proc.stdin.flush()
   send({"id":1,"method":"initialize","params":{"clientInfo":{"name":"herdr_usage","version":"1.0"}}})
   deadline=time.monotonic()+10
   result=None
   while time.monotonic()<deadline:
    if not select.select([proc.stdout],[],[],max(0,deadline-time.monotonic()))[0]: break
    line=proc.stdout.readline()
    if not line: break
    msg=json.loads(line)
    if msg.get("id")==1:
     if "error" in msg: raise RuntimeError("Codex initialization failed")
     send({"method":"initialized"}); send({"id":2,"method":"account/rateLimits/read"})
    if msg.get("id")==2:
     if "error" in msg: raise RuntimeError("Codex rate-limit request failed")
     data=msg["result"]; r=(data.get("rateLimitsByLimitId") or {}).get("codex") or data.get("rateLimits") or {}
     def window(k):
      w=r.get(k) or {}
      return {"used_percent":w.get("usedPercent"),"resets_at":w.get("resetsAt")}
     result={"timestamp":time.time(),"primary":window("primary"),"secondary":window("secondary"),"credits":r.get("credits")}; break
   if result is None: raise RuntimeError("Codex request timed out")
  finally:
   proc.terminate()
   try: proc.wait(timeout=1)
   except subprocess.TimeoutExpired: proc.kill(); proc.wait()
 print(json.dumps(result))
except Exception as e:
 print(json.dumps({"error":str(e)}))
