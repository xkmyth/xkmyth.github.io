import io
lines = io.open(r"D:\xkmyth-eco\xkmyth.github.io\software\wallpaper\app.js", encoding="utf-8").read().splitlines()
for i in range(100, 122):
    print("%4d %s" % (i+1, lines[i]))
