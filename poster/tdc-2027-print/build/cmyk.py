# Swap each placeholder RGB operator for its hand-set CMYK value.
# Paper is left unprinted (0/0/0/0); opacity over unprinted paper = a straight tint.
import re, sys, json, pikepdf
src, dst, mapf, title = sys.argv[1:5]
BASE = {  # C M Y K, percent
  '#faf9f4': (0, 0, 0, 0),      # paper: no ink
  '#141109': (0, 0, 0, 100),    # ink: K only, crisp small type
  '#8f5fc0': (52, 71, 0, 0),    # P purple
  '#ef7409': (0, 67, 100, 0),   # O orange
  '#3f5162': (77, 61, 44, 27),  # W steel
  '#2f83c8': (77, 41, 0, 0),    # B blue
  '#6f5c44': (48, 54, 73, 30),  # X ochre
}
idx = {i: tuple(round(v * a) / 100 for v in BASE[h]) for h, a, i in json.load(open(mapf))}
pdf = pikepdf.open(src)
pg = pdf.pages[0]
streams = [pg.Contents] if isinstance(pg.Contents, pikepdf.Stream) else list(pg.Contents)
seen, bad = set(), set()
def fmt(c): return ' '.join(('%.2f' % v).rstrip('0').rstrip('.') or '0' for v in c)
def sub(m):
    r, g, b = (round(float(x) * 255) for x in m.group(1, 2, 3))
    op = m.group(4)
    if (r, g, b) == (255, 255, 255): c = (0, 0, 0, 0)
    elif g == 3 and b == 5 and r in idx: c = idx[r]; seen.add(r)
    else: bad.add((r, g, b)); return m.group(0)
    return (fmt(c) + (' K' if op == b'RG' else ' k')).encode()
for s in streams:
    data = s.read_bytes()
    new = re.sub(rb'(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (RG|rg)\b', sub, data)
    s.write(new)
assert not bad, bad
for name, gs in pg.Resources.ExtGState.items():
    for k in ('/ca', '/CA'):
        assert float(gs.get(k, 1)) == 1, (name, k, gs.get(k))
    assert '/SMask' not in gs or gs.SMask == pikepdf.Name.None_, name
assert not [o for o in pdf.objects if isinstance(o, pikepdf.Dictionary) and o.get('/Type') == '/XObject'], 'unexpected xobjects'
mb = pg.MediaBox
pg.TrimBox = mb; pg.BleedBox = mb
with pdf.open_metadata() as meta:
    meta['dc:title'] = title
    meta['dc:creator'] = ['Si Zheng']
pdf.docinfo['/Title'] = title
pdf.docinfo['/Author'] = 'Si Zheng'
pdf.save(dst)
print(dst, 'mapped', sorted(seen), 'of', sorted(idx))
