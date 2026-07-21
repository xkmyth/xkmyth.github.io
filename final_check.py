import re, os
from pathlib import Path

path = r'C:\Users\HUAWEI\.openclaw\workspace\xkmyth-temp\index.html'
content = Path(path).read_text('utf-8')

print(f'File size: {len(content)} chars')
print(f'Has head: {"<head>" in content}')
print(f'Has body: {"<body>" in content}')
print(f'Has /body: {"</body>" in content}')
print(f'Has /html: {"</html>" in content}')
print(f'Has style.css: {content.count("style.css") > 0}')
print(f'Has main.js: {content.count("main.js") > 0}')
print(f'Has script.js: {content.count("script.js") > 0}')
print(f'Has search: {"searchInput" in content}')
print(f'Has backToTop: {"backToTop" in content}')

modules = len(re.findall(r'class="module" id="m', content))
cards = len(re.findall(r'class="tool-card"', content))
m4 = len(re.findall(r'id="m4"', content))
print(f'Modules: {modules}')
print(f'Cards: {cards}')
print(f'id=m4 duplicates: {m4}')
print('OK' if m4 == 1 else 'DUP!')
