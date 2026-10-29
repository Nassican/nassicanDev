"""Compile a licensed reference map into local SVG paths; no runtime geocoding."""
import hashlib
import json
import math
import os
from pathlib import Path

source_dir = Path(os.environ["TEMP"]) / "nassican-pricing-map"
raw = (source_dir / "departamentos.geojson").read_bytes()
features = json.loads(raw)["features"]
codes = dict(zip(
    "ANT ATL DC BOL BOY CAL CAQ CAU CES COR CUN CHO HUI LAG MAG MET NAR NSA QUI RIS SAN SUC TOL VAC ARA CAS PUT SAP AMA GUA GUV VAU VID".split(),
    "05 08 11 13 15 17 18 19 20 23 25 27 41 44 47 50 52 54 63 66 68 70 73 76 81 85 86 88 91 94 95 97 99".split(),
))

def polygons(feature):
    geometry = feature["geometry"]
    assert geometry["type"] in ("Polygon", "MultiPolygon")
    return [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]

points = [p for f in features for poly in polygons(f) for ring in poly for p in ring]
min_lon, max_lon = min(p[0] for p in points), max(p[0] for p in points)
min_lat, max_lat = min(p[1] for p in points), max(p[1] for p in points)
scale = 34

def project(point):
    lon, lat = point[:2]
    assert math.isfinite(lon) and math.isfinite(lat)
    return [round((lon - min_lon) * scale + 12, 2), round((max_lat - lat) * scale + 12, 2)]

def simplify(points, tolerance=0.7):
    keep, pending = {0, len(points)-1}, [(0, len(points)-1)]
    while pending:
        first, last = pending.pop()
        a, b = points[first], points[last]
        dx, dy = b[0]-a[0], b[1]-a[1]
        length = dx*dx + dy*dy
        farthest, distance = first, tolerance*tolerance
        for i in range(first+1, last):
            p = points[i]
            t = max(0, min(1, ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)) if length else 0
            squared = (p[0]-a[0]-t*dx)**2 + (p[1]-a[1]-t*dy)**2
            if squared > distance:
                farthest, distance = i, squared
        if farthest != first:
            keep.add(farthest)
            pending.extend([(first, farthest), (farthest, last)])
    result = [points[i] for i in sorted(keep)]
    return result if len(result) >= 4 else points

departments = []
for f in features:
    props = f["properties"]
    code = codes[props["shapeISO"].split("-")[1]]
    paths, projected = [], []
    for poly in polygons(f):
        for ring in poly:
            ring_points = [project(p) for p in ring]
            # Repeated coordinates at this display scale do not add useful detail.
            compact = [p for i, p in enumerate(ring_points) if i == 0 or p != ring_points[i - 1]]
            compact = simplify(compact) if len(compact) > 4 else compact
            if len(compact) < 3:
                continue
            projected.extend(compact)
            paths.append("M" + "L".join(f"{p[0]},{p[1]}" for p in compact) + "Z")
    assert projected
    x0, x1 = min(p[0] for p in projected), max(p[0] for p in projected)
    y0, y1 = min(p[1] for p in projected), max(p[1] for p in projected)
    departments.append({"code": code, "name": "Bogotá D.C." if code == "11" else props["shapeName"], "path": "".join(paths), "bounds": [x0, y0, round(x1-x0, 2), round(y1-y0, 2)]})
assert len(departments) == 33 and len({d["code"] for d in departments}) == 33
result = {
    "source": "geoBoundaries gbOpen / OpenStreetMap, Wambacher",
    "sourceUrl": "https://www.geoboundaries.org/api/current/gbOpen/COL/ADM1/",
    "geometryUrl": "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/COL/ADM1/geoBoundaries-COL-ADM1_simplified.geojson",
    "referenceYear": 2017,
    "license": "ODbL 1.0",
    "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
    "sha256": hashlib.sha256(raw).hexdigest(),
    "projection": "Equirectangular, display reference only",
    "viewBox": [0, 0, round((max_lon-min_lon)*scale+24, 2), round((max_lat-min_lat)*scale+24, 2)],
    "departments": sorted(departments, key=lambda d: d["code"]),
}
target = Path("apps/admin/src/lib/data/pricing-colombia-map.json")
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"Compiled {len(departments)} departments, {target.stat().st_size} bytes; source attribution and ODbL license retained.")
