from pathlib import Path

path = Path('index.html')
html = path.read_text(encoding='utf-8')
bad = "}).join('\n'));".replace('\\n', '\n')
good = "}).join('\\n'));"
if bad not in html:
    raise RuntimeError('Expected malformed live-model join was not found')
html = html.replace(bad, good, 1)
path.write_text(html, encoding='utf-8')
print('Fixed live-model result newline escaping')
