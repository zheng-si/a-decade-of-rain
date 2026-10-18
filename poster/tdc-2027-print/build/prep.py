# Flatten every (fill, fill-opacity) pair into a unique solid placeholder colour,
# so the PDF has no transparency and each placeholder maps to one exact CMYK value.
import re, sys, json
src, dst, mapf = sys.argv[1:4]
s = open(src).read()
pairs = {}
def sub(m):
    tag, attrs = m.group(1), m.group(2)
    f = re.search(r'fill="(#[0-9a-fA-F]{6})"', attrs)
    if not f: return m.group(0)
    o = re.search(r'fill-opacity="([\d.]+)"', attrs)
    if tag == 'tspan': assert o, 'tspan without own opacity'
    key = (f.group(1).lower(), float(o.group(1)) if o else 1.0)
    if key not in pairs: pairs[key] = len(pairs) + 1
    i = pairs[key]
    ph = '#%02x%02x%02x' % (i, 3, 5)
    attrs = re.sub(r'\s*fill-opacity="[\d.]+"', '', attrs)
    attrs = attrs.replace(f.group(0), f'fill="{ph}"')
    return f'<{tag}{attrs}>'
out = re.sub(r'<(text|tspan|rect)([^>]*)>', sub, s)
assert 'opacity' not in out
open(dst, 'w').write(out)
json.dump([[k[0], k[1], i] for k, i in pairs.items()], open(mapf, 'w'))
print(dst, len(pairs), 'colour/opacity pairs')
