import io, re
s = io.open(r"D:\xkmyth-eco\xkmyth.github.io\changelog\index.html", encoding="utf-8").read()
i = s.find("site-log")
print(s[i-60:i+1900])
