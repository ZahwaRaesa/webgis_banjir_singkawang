import shapefile
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
import json, os

SRC = '/home/claude/webgis_banjir/extracted/WEBGIS'
OUT = '/home/claude/webgis_banjir/geojson'
os.makedirs(OUT, exist_ok=True)

def read_shapes(fname):
    sf = shapefile.Reader(shp=open(os.path.join(SRC, fname), 'rb'))
    geoms = []
    for s in sf.shapes():
        gi = s.__geo_interface__
        try:
            g = shape(gi)
            if not g.is_valid:
                g = g.buffer(0)
            if not g.is_empty:
                geoms.append(g)
        except Exception as e:
            print('skip', e)
    return geoms

def count_points(geom):
    t = geom.geom_type
    if t == 'Polygon':
        n = len(geom.exterior.coords)
        for i in geom.interiors: n += len(i.coords)
        return n
    if t == 'MultiPolygon':
        return sum(count_points(g) for g in geom.geoms)
    if t == 'LineString':
        return len(geom.coords)
    if t == 'MultiLineString':
        return sum(count_points(g) for g in geom.geoms)
    if t == 'GeometryCollection':
        return sum(count_points(g) for g in geom.geoms)
    return 0

# ---- Flood levels: dissolve per level, simplify, save single-feature geojson ----
flood_files = {
    1.0: 'singkawang1meter.shp', 1.5: 'singkawang1.5meter.shp',
    2.0: 'singkawang2meter.shp', 2.5: 'singkawang2.5meter.shp',
    3.0: 'singkawang3meter.shp', 3.5: 'singkawang3.5meter.shp',
    4.0: 'singkawang4meter.shp',
}
TOL_FLOOD = 0.00025

flood_geoms = {}
for level, fname in flood_files.items():
    geoms = read_shapes(fname)
    merged = unary_union(geoms)
    simp = merged.simplify(TOL_FLOOD, preserve_topology=True)
    flood_geoms[level] = simp
    print('flood', level, 'pts', count_points(simp), 'area_deg2', round(simp.area,6))

# combined geojson (all levels) - deepest first so shallow draws on top when z-order applied client side we still send all
features = []
for level in sorted(flood_geoms.keys()):
    g = flood_geoms[level]
    features.append({
        "type": "Feature",
        "properties": {"level_m": level, "nama": f"Genangan {level} m"},
        "geometry": mapping(g)
    })
with open(f'{OUT}/genangan_all.geojson', 'w') as f:
    json.dump({"type": "FeatureCollection", "features": features}, f)

for level, g in flood_geoms.items():
    fc = {"type": "FeatureCollection", "features": [{
        "type": "Feature", "properties": {"level_m": level, "nama": f"Genangan {level} m"},
        "geometry": mapping(g)
    }]}
    with open(f'{OUT}/genangan_{level}.geojson', 'w') as f:
        json.dump(fc, f)

# ---- Kecamatan (admin polygon) ----
kec_geoms = read_shapes('ADMINISTRASIKECAMATAN_AR_50K.shp')
TOL_ADM = 0.00012
kec_features = []
for i, g in enumerate(kec_geoms):
    gs = g.simplify(TOL_ADM, preserve_topology=True)
    kec_features.append({
        "type": "Feature",
        "properties": {"id": i+1, "nama": f"Kecamatan {i+1}"},
        "geometry": mapping(gs)
    })
with open(f'{OUT}/kecamatan.geojson', 'w') as f:
    json.dump({"type": "FeatureCollection", "features": kec_features}, f)
print('kecamatan features', len(kec_features), 'pts', sum(count_points(shape(ft['geometry'])) for ft in kec_features))

# dissolve kecamatan into single batas kota outline
kota_merged = unary_union(kec_geoms).simplify(TOL_ADM, preserve_topology=True)
with open(f'{OUT}/batas_kota.geojson', 'w') as f:
    json.dump({"type":"FeatureCollection","features":[{"type":"Feature","properties":{"nama":"Batas Kota Singkawang"},"geometry":mapping(kota_merged)}]}, f)
print('batas_kota pts', count_points(kota_merged))

# ---- Administrasi garis (batas admin lines) ----
ln_geoms = read_shapes('ADMINISTRASI_LN_50K.shp')
TOL_LN = 0.00015
ln_features = []
for i, g in enumerate(ln_geoms):
    gs = g.simplify(TOL_LN, preserve_topology=True)
    if gs.is_empty: continue
    ln_features.append({"type":"Feature","properties":{"id":i+1,"nama":"Batas Administrasi"},"geometry":mapping(gs)})
with open(f'{OUT}/batas_administrasi.geojson', 'w') as f:
    json.dump({"type":"FeatureCollection","features":ln_features}, f)
print('admin line features', len(ln_features), 'pts', sum(count_points(shape(ft['geometry'])) for ft in ln_features))

# ---- Danau (lake polygon) ----
danau_geoms = read_shapes('DANAU_AR_50K.shp')
TOL_DANAU = 0.00008
danau_features = []
for i, g in enumerate(danau_geoms):
    gs = g.simplify(TOL_DANAU, preserve_topology=True)
    if gs.is_empty: continue
    danau_features.append({"type":"Feature","properties":{"id":i+1,"nama":f"Danau {i+1}"},"geometry":mapping(gs)})
with open(f'{OUT}/danau.geojson', 'w') as f:
    json.dump({"type":"FeatureCollection","features":danau_features}, f)
print('danau features', len(danau_features), 'pts', sum(count_points(shape(ft['geometry'])) for ft in danau_features))

print('DONE')
