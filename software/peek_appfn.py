import io, re
for slug in ("rename", "ledger", "clipboard", "snippets"):
    s = io.open(r"D:\xkmyth-eco\xkmyth.github.io\software\%s\app.js" % slug, encoding="utf-8").read()
    names = re.findall(r"function\s+([A-Za-z_$][\w$]*)\s*\(", s)
    print(slug, len(s), "字节，函数:", ", ".join(names))
    ids = sorted(set(re.findall(r"\$\('([\w-]+)'\)", s)))
    print("   ids:", ", ".join(ids[:18]))
