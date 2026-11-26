# Fetches named assets from Poly Haven (polyhaven.com; everything there is CC0) into <out>/<id>/,
# and writes <out>/../sources.json: page, authors, real-world size, each file's URL, bytes and MD5.
#   python3 -I local-results/E1/fetch-polyhaven.py textures <out dir> <id> [<id> ...]     colour, normal (OpenGL), roughness at 1K, JPEG
#   python3 -I local-results/E1/fetch-polyhaven.py hdris <out dir> <id> [<id> ...]        1K and 2K .hdr
import hashlib, json, os, sys, urllib.request

kind, out, ids = sys.argv[1], os.path.abspath(sys.argv[2]), sys.argv[3:]
AGENT = {"User-Agent": "asset-fetch-script/1.0"}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=AGENT), timeout=120) as r:
        return r.read()


listing = json.loads(get(f"https://api.polyhaven.com/assets?t={kind}"))
record = {"source": "https://polyhaven.com", "licence": "CC0 1.0 (https://polyhaven.com/license), as stated on the day of the download", "assets": {}}
for asset in ids:
    files = json.loads(get(f"https://api.polyhaven.com/files/{asset}"))
    if kind == "textures":
        wanted = {"colour": files["Diffuse"]["1k"]["jpg"], "normal-gl": files["nor_gl"]["1k"]["jpg"], "roughness": files["Rough"]["1k"]["jpg"]}
    else:
        wanted = {"1k": files["hdri"]["1k"]["hdr"], "2k": files["hdri"]["2k"]["hdr"]}
    folder = os.path.join(out, asset)
    os.makedirs(folder, exist_ok=True)
    meta = listing[asset]
    entry = {"page": f"https://polyhaven.com/a/{asset}", "name": meta.get("name"), "authors": meta.get("authors"), "categories": meta.get("categories"),
             "sizeMillimetres": meta.get("dimensions"), "files": {}}
    for label, f in wanted.items():
        data = get(f["url"])
        name = os.path.basename(f["url"])
        if hashlib.md5(data).hexdigest() != f["md5"]:
            raise SystemExit(f"{asset} {label}: MD5 differs from the one Poly Haven states")
        with open(os.path.join(folder, name), "wb") as h:
            h.write(data)
        entry["files"][label] = {"file": f"{asset}/{name}", "url": f["url"], "bytes": len(data), "md5": f["md5"]}
        print(asset, label, name, len(data))
    record["assets"][asset] = entry
with open(os.path.join(os.path.dirname(out), "sources.json"), "w") as h:
    json.dump(record, h, indent=2, ensure_ascii=False)
