"""Embed every data/<season>.json into the app template -> one offline-capable HTML file.
usage: python make_app.py template.html data_dir out.html"""
import sys, json, glob, os
tpl, ddir, out = sys.argv[1:4]
data = {}
for f in sorted(glob.glob(os.path.join(ddir, "*.json"))):
    d = json.load(open(f)); data[str(d["season"])] = d
html = open(tpl, encoding="utf-8").read()
assert "/*__DATA__*/{}" in html
payload = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
libs = ""
for f in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(tpl)), "libs", "*.js"))):
    libs += "<script>" + open(f, encoding="utf-8").read().replace("</script", "<\\/script") + "</script>\n"
html = html.replace("<!--__LIBS__-->", libs)
open(out, "w", encoding="utf-8").write(html.replace("/*__DATA__*/{}", payload))
print("wrote", out, os.path.getsize(out) // 1024, "KB with seasons", list(data))
