import re

with open(r'C:\Users\HUAWEI\.openclaw\workspace\xkmyth-temp\index.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

cards = re.findall(r'<div class="tool-card">(.*?)</div>\s*</div>', content, re.DOTALL)

print(f'Total cards: {len(cards)}\n')

# Find cards with fewer items than expected
for card in cards:
    title = re.search(r'<h3>(.*?)</h3>', card)
    items = len(re.findall(r'<br>', card))
    desc = re.search(r'<p>(.*?)</p>', card)
    # Cards should typically have 6-8 items
    if title and items < 5:
        print(f'[{items}条] {title.group(1)} - {desc.group(1) if desc else ""}')
