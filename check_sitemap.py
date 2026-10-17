import io, os, re
root = r"D:\xkmyth-eco\xkmyth.github.io"
pages = []
for dp, dns, fns in os.walk(root):
    dns[:] = [d for d in dns if d not in (".git", "node_modules")]
    if "index.html" in fns:
        rel = os.path.relpath(dp, root).replace("\\", "/")
        url = "/" if rel == "." else "/" + rel + "/"
        pages.append(url)
sm = io.open(os.path.join(root, "sitemap.xml"), encoding="utf-8").read()
locs = set(re.findall(r"<loc>https://xkmyth\.github\.io([^<]*)</loc>", sm))
missing = [p for p in pages if p not in locs]
print("主站页面", len(pages), "sitemap", len(locs))
print("缺:", missing)
