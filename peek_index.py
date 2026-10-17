import io, json
d = json.load(io.open(r"D:\xkmyth-eco\xkmyth.github.io\search-index.json", encoding="utf-8"))
print("count", d.get("count"), "items", len(d["items"]))
tools = [i for i in d["items"] if i["url"].startswith("/Timarsky/tools/")]
print("tools", len(tools))
for i in tools[:4]:
    print(json.dumps(i, ensure_ascii=False))
