<?php
/**
 * Endpoint tunggal untuk mengambil layer spasial dari MySQL sebagai GeoJSON.
 *
 * Penggunaan:
 *   api/get_layer.php?layer=genangan            -> semua level genangan (FeatureCollection)
 *   api/get_layer.php?layer=genangan&level=2.5   -> genangan level 2.5 m saja
 *   api/get_layer.php?layer=batas_kota
 *   api/get_layer.php?layer=kecamatan
 *   api/get_layer.php?layer=batas_administrasi
 *   api/get_layer.php?layer=danau
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/db.php';

$allowed_layers = ['genangan', 'batas_kota', 'kecamatan', 'batas_administrasi', 'danau'];
$layer = $_GET['layer'] ?? '';

if (!in_array($layer, $allowed_layers, true)) {
    http_response_code(400);
    echo json_encode([
        'error' => 'Parameter "layer" tidak valid.',
        'layer_tersedia' => $allowed_layers,
    ]);
    exit;
}

$conn = get_db_connection();

switch ($layer) {
    case 'genangan':
        $sql = 'SELECT id, level_meter, nama, warna_hex, luas_km2, keterangan, ST_AsGeoJSON(geom) AS geojson
                FROM genangan_banjir';
        if (isset($_GET['level']) && is_numeric($_GET['level'])) {
            $level = $conn->real_escape_string($_GET['level']);
            $sql .= " WHERE level_meter = '$level'";
        }
        $sql .= ' ORDER BY level_meter ASC';
        $prop_builder = function (array $row) {
            return [
                'id'         => (int) $row['id'],
                'level_m'    => (float) $row['level_meter'],
                'nama'       => $row['nama'],
                'warna'      => $row['warna_hex'],
                'luas_km2'   => $row['luas_km2'] !== null ? (float) $row['luas_km2'] : null,
                'keterangan' => $row['keterangan'],
            ];
        };
        break;

    case 'batas_kota':
        $sql = 'SELECT id, nama, ST_AsGeoJSON(geom) AS geojson FROM batas_kota';
        $prop_builder = fn(array $row) => ['id' => (int) $row['id'], 'nama' => $row['nama']];
        break;

    case 'kecamatan':
        $sql = 'SELECT id, nama, ST_AsGeoJSON(geom) AS geojson FROM kecamatan ORDER BY id ASC';
        $prop_builder = fn(array $row) => ['id' => (int) $row['id'], 'nama' => $row['nama']];
        break;

    case 'batas_administrasi':
        $sql = 'SELECT id, nama, ST_AsGeoJSON(geom) AS geojson FROM batas_administrasi ORDER BY id ASC';
        $prop_builder = fn(array $row) => ['id' => (int) $row['id'], 'nama' => $row['nama']];
        break;

    case 'danau':
        $sql = 'SELECT id, nama, ST_AsGeoJSON(geom) AS geojson FROM danau ORDER BY id ASC';
        $prop_builder = fn(array $row) => ['id' => (int) $row['id'], 'nama' => $row['nama']];
        break;
}

$result = $conn->query($sql);

if ($result === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Query gagal.', 'detail' => $conn->error]);
    exit;
}

$features = [];
while ($row = $result->fetch_assoc()) {
    $features[] = [
        'type'       => 'Feature',
        'properties' => $prop_builder($row),
        'geometry'   => json_decode($row['geojson'], true),
    ];
}

echo json_encode([
    'type'     => 'FeatureCollection',
    'features' => $features,
], JSON_UNESCAPED_UNICODE);

$conn->close();
