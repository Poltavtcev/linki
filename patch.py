import re

with open('/Users/admin/.hermes/config.yaml', 'r') as f:
    content = f.read()

content = re.sub(
    r'\s*linki:.*?(?=\n#|\Z)', 
    '\n  linki:\n    url: http://localhost:3000/api/mcp\n    transport: sse\n    headers:\n      Authorization: Bearer d1c0b9a8f7e6d5c4b3a2f1e6d7c9b8a1\n', 
    content, 
    flags=re.DOTALL
)

with open('/Users/admin/.hermes/config.yaml', 'w') as f:
    f.write(content)
