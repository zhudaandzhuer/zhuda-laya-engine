# Compares the page state logged at every shot (detplay log files): the scene tick it was taken at
# and the fields the page shows (mode, meters, overlay, title, result, buttons). usage: states.py a.log b.log …
import json, sys
FIELDS = ['mode', 'hp', 'stamina', 'foe', 'overlay', 'title', 'result', 'strike', 'hint', 'pad']
def load(p):
    log = json.loads(open(p).read().strip().splitlines()[-1])
    return {x['shot']: (x['at'], {k: x['state'].get(k) for k in FIELDS}) for x in log if isinstance(x, dict) and 'shot' in x}, log[-1]
base, errs = load(sys.argv[1])
print(sys.argv[1], 'errors:', errs)
for other in sys.argv[2:]:
    o, e = load(other)
    bad = [s for s in base if base[s] != o.get(s)]
    print(other, 'shots', len(o), 'same state+tick' if not bad and len(o) == len(base) else f'DIFFER {bad}', 'errors:', e)
for s, (at, st) in base.items(): print(' ', s, at, st)
