import re

with open(r'C:\Users\HUAWEI\.openclaw\workspace\xkmyth-temp\index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find all PS module blocks and remove the second one
ps_blocks = list(re.finditer(
    r'<!-- =====+ -->\n<!-- 模块4：PS 设计快捷键.*?</div>\n</div>',
    content,
    re.DOTALL
))

if len(ps_blocks) >= 2:
    # Remove second occurrence
    start = ps_blocks[1].start()
    end = ps_blocks[1].end()
    new_content = content[:start] + content[end:]
    with open(r'C:\Users\HUAWEI\.openclaw\workspace\xkmyth-temp\index.html', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f'Removed duplicate PS module at position {start}-{end}')
else:
    print(f'Found {len(ps_blocks)} PS module(s)')
