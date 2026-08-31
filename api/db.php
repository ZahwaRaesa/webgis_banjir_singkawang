<?php
/**
 * Konfigurasi koneksi database (MySQL via XAMPP).
 * Sesuaikan DB_USER / DB_PASS jika kredensial MySQL Anda berbeda dari default XAMPP.
 */
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'webgis_banjir_singkawang');

function get_db_connection(): mysqli
{
    mysqli_report(MYSQLI_REPORT_OFF);
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

    if ($conn->connect_error) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'error' => 'Koneksi database gagal. Pastikan MySQL di XAMPP aktif dan database "webgis_banjir_singkawang" sudah diimpor.',
            'detail' => $conn->connect_error,
        ]);
        exit;
    }

    $conn->set_charset('utf8mb4');
    return $conn;
}
