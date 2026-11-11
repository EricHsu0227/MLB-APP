"""Build the team sheet page: public/team-sheet/index.html + public/team-sheet/data/<season>.js (each season loads only when picked).
usage: python make_site.py            (reads template.html, libs/, data/*.json)"""
import json, glob, os
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
site = os.path.join(root, "public", "team-sheet")  # served by MLB-APP at /team-sheet/; os.makedirs(os.path.join(site, "data"), exist_ok=True)
seasons = []
for f in sorted(glob.glob(os.path.join(here, "data", "*.json"))):
    d = json.load(open(f)); y = d["season"]; seasons.append(y)
    payload = json.dumps(d, separators=(",", ":")).replace("</", "<\\/")
    open(os.path.join(site, "data", f"{y}.js"), "w", encoding="utf-8").write(f"window.BUILTIN=window.BUILTIN||{{}};window.BUILTIN[{y}]={payload};")
html = open(os.path.join(here, "template.html"), encoding="utf-8").read()
libs = "".join("<script>" + open(f, encoding="utf-8").read().replace("</script", "<\\/script") + "</script>\n"
               for f in sorted(glob.glob(os.path.join(here, "libs", "*.js"))))
import hashlib
ver = {y: hashlib.sha1(open(os.path.join(site, "data", f"{y}.js"), "rb").read()).hexdigest()[:10] for y in seasons}
html = html.replace("<!--__LIBS__-->", libs).replace("window.BUILTIN = /*__DATA__*/{};", f"window.MANIFEST = {json.dumps(sorted(seasons, reverse=True))}; window.DATAVER = {json.dumps({str(k): v for k, v in ver.items()})}; window.BUILTIN = {{}};")
open(os.path.join(site, "index.html"), "w", encoding="utf-8").write(html)
print("public/team-sheet/ built with seasons", seasons)
