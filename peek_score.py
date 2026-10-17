import io, re
for p in (r"D:\xkmyth-eco\xkmyth.github.io\sub.js", r"D:\xkmyth-eco\xkmyth.github.io\js\site-search.js"):
    s = io.open(p, encoding="utf-8").read()
    i = s.find("function score")
    if i < 0:
        i = s.find("score:")
    print("=== ", p)
    print(s[max(0,i-400):i+900])
