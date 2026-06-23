#!/bin/bash
# 抓取 6 个站点预览图 -> 480px JPEG -> shots.json。--headless=new + kill -9 看门狗，逐站日志。
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT=/Users/wangzhongcheng/2claudecode
mkdir -p "$OUT/thumbs"

keys=(scoreboard threek brawl expedition volvme quiz)
urls=(
  "https://myskme.github.io/myskme-scoreboard/"
  "https://myskme.github.io/three-kingdoms-classroom-scoreboard/"
  "https://myskme.github.io/myskme-brawl/"
  "https://myskme-expedition.netlify.app"
  "https://myskme-volvme-ii.netlify.app"
  "https://myskme-games.netlify.app/"
)

for i in "${!keys[@]}"; do
  k="${keys[$i]}"; u="${urls[$i]}"; png="$OUT/thumbs/$k.png"
  rm -f "$png"; rm -rf "/tmp/cs-$k"
  echo ">> capturing $k  $u"
  "$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
    --hide-scrollbars --force-device-scale-factor=1 --window-size=1280,800 \
    --user-data-dir="/tmp/cs-$k" --screenshot="$png" "$u" >"/tmp/cs-$k.log" 2>&1 &
  p=$!
  ( sleep 11; kill -9 $p 2>/dev/null ) & w=$!
  wait $p 2>/dev/null; kill $w 2>/dev/null
  pkill -9 -f "/tmp/cs-$k" 2>/dev/null; sleep 1
  if [ -s "$png" ]; then
    sips -Z 480 -s format jpeg -s formatOptions 60 "$png" --out "$OUT/thumbs/$k.jpg" >/dev/null 2>&1
    echo "   ok: $(stat -f%z "$OUT/thumbs/$k.jpg" 2>/dev/null) bytes"
  else
    echo "   FAILED (ssl/net errors: $(grep -cE 'handshake failed|net_error|ERR_' /tmp/cs-$k.log 2>/dev/null))"
  fi
  rm -rf "/tmp/cs-$k"
done

echo ">> building shots.json"
python3 - "$OUT" <<'PY'
import sys, os, base64, json
out=sys.argv[1]; d=os.path.join(out,"thumbs")
keys=["scoreboard","threek","brawl","expedition","volvme","quiz"]
shots={}
for k in keys:
    p=os.path.join(d,k+".jpg")
    if os.path.exists(p) and os.path.getsize(p)>800:
        shots[k]="data:image/jpeg;base64,"+base64.b64encode(open(p,"rb").read()).decode()
json.dump(shots, open(os.path.join(out,"shots.json"),"w"))
print("shots.json keys:", list(shots.keys()), "| total KB:", round(sum(len(v) for v in shots.values())/1024,1))
PY
echo ">> DONE"
