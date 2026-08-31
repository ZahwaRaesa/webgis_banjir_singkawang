# WebGIS Genangan Banjir — Kota Singkawang

WebGIS sederhana untuk menampilkan simulasi sebaran genangan banjir Kota Singkawang
pada 7 level ketinggian (1,0–4,0 m), dengan tema **Midnight Blue + Electric Blue**
bergaya *smart city*. Data geospasial disimpan di **MySQL** (bukan file statis) dan
disajikan ke peta melalui **endpoint PHP** dalam format GeoJSON.

Stack: Apache (PHP) + MySQL (XAMPP) + Leaflet.js.

---

## 1. Struktur folder

```
webgis_banjir_singkawang/
├── index.php                 # Halaman utama (peta + panel kontrol + legenda)
├── assets/
│   ├── css/style.css         # Tema Midnight Blue + Electric Blue
│   └── js/app.js             # Logika peta, toggle layer, simulasi, notifikasi
├── api/
│   ├── db.php                # Konfigurasi koneksi MySQL
│   └── get_layer.php         # Endpoint: DB -> GeoJSON
├── sql/
│   └── schema.sql            # CREATE DATABASE + CREATE TABLE + INSERT data spasial
├── data_referensi/           # GeoJSON hasil konversi shapefile (arsip/cadangan, TIDAK dipakai langsung oleh web)
└── README.md
```

Peta **tidak** membaca file `.shp`/GeoJSON secara langsung saat berjalan — semua
geometri sudah dikonversi dan disimpan sebagai kolom spasial (`GEOMETRY`) di MySQL,
lalu `api/get_layer.php` mengambilnya dengan `ST_AsGeoJSON()` dan mengirim ke
front-end sebagai JSON.

---

## 2. Langkah instalasi dari nol (XAMPP)

### a. Instal XAMPP
1. Unduh XAMPP (PHP 8.x) dari https://www.apachefriends.org/ dan instal seperti biasa.
2. Buka **XAMPP Control Panel**, klik **Start** pada modul **Apache** dan **MySQL**.

### b. Salin folder proyek
1. Salin seluruh folder `webgis_banjir_singkawang/` ke direktori `htdocs` instalasi XAMPP, contoh:
   - Windows: `C:\xampp\htdocs\webgis_banjir_singkawang\`
   - Linux/Mac: `/opt/lampp/htdocs/webgis_banjir_singkawang/`

### c. Buat database & impor data spasial
File `sql/schema.sql` berukuran sekitar 2 MB (berisi geometri poligon), jadi
**disarankan** mengimpor lewat command line agar tidak terhambat batas ukuran
upload default phpMyAdmin:

**Opsi 1 — via terminal / Command Prompt (disarankan):**
```bash
# Windows (jalankan dari folder xampp\mysql\bin, atau tambahkan ke PATH)
mysql -u root -p < "C:\xampp\htdocs\webgis_banjir_singkawang\sql\schema.sql"

# Linux/Mac
/opt/lampp/bin/mysql -u root -p < sql/schema.sql
```
Tekan Enter saja saat diminta password jika memakai kredensial default XAMPP (kosong).

**Opsi 2 — via phpMyAdmin:**
1. Buka `http://localhost/phpmyadmin`.
2. Jika `sql/schema.sql` gagal diunggah karena limit ukuran file, naikkan dulu
   `upload_max_filesize` dan `post_max_size` di `php.ini` (mis. jadi `16M`), lalu
   restart Apache.
3. Klik tab **Import**, pilih `sql/schema.sql`, klik **Go**.

Setelah berhasil, akan terbentuk database `webgis_banjir_singkawang` dengan 5 tabel:
`genangan_banjir`, `batas_kota`, `kecamatan`, `batas_administrasi`, `danau`.

### d. Sesuaikan kredensial koneksi (bila perlu)
Buka `api/db.php`. Default mengikuti kredensial standar XAMPP:
```php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'webgis_banjir_singkawang');
```
Ubah `DB_USER`/`DB_PASS` bila konfigurasi MySQL Anda berbeda.

### e. Buka di browser
```
http://localhost/webgis_banjir_singkawang/
```

---

## 3. Cara pakai WebGIS

- **Panel kiri (kontrol):** judul, deskripsi, kotak **pencarian lokasi**, dan *gauge*
  7 level genangan (1,0–4,0 m) — klik tiap baris (atau item di legenda) untuk
  menampilkan/menyembunyikan level tersebut. Warna mengikuti konsep lampu lalu
  lintas: hijau (dangkal) → kuning/oranye (menengah) → merah (terdalam). Panel
  bisa **diciutkan** lewat tombol panah di pojok kanan atas panel.
- **Slider transparansi layer:** mengatur opasitas seluruh layer genangan yang
  sedang tampil secara real-time.
- **Klik area genangan di peta** untuk membuka popup berisi level ketinggian dan
  estimasi luas area (km²).
- **Tombol "Simulasi Kenaikan Air":** memutar otomatis genangan dari level
  terendah ke tertinggi secara kumulatif, dengan efek berkedip pada level yang
  sedang aktif. Klik lagi untuk menghentikan simulasi.
- **Pemilih gaya peta dasar:** beralih antara basemap **Gelap** (default) dan
  **Satelit** (citra Esri World Imagery).
- **Layer pendukung:** batas kota, batas kecamatan, garis administrasi, dan
  danau/badan air — masing-masing punya sakelar sendiri.
- **Panel kanan (legenda):** skala warna genangan (item legenda juga bisa diklik
  untuk toggle layer), keterangan layer pendukung, dan **statistik luas genangan**
  per level dalam bentuk bar chart mini. Panel ini juga bisa diciutkan.
- **Tombol utilitas peta** (kiri bawah): lokasi saya (geolocation), kembali ke
  tampilan awal, dan layar penuh.
- **Kontrol zoom & skala peta** (kanan bawah): mengikuti tema gelap aplikasi.
- **Pembaca koordinat** (tengah bawah): menampilkan lintang/bujur kursor dan level zoom saat ini.
- **Notifikasi** (kanan atas area peta): muncul saat layer dimuat/disembunyikan, pencarian lokasi berhasil, atau saat terjadi error koneksi database.

---

## 4. Endpoint API

```
GET api/get_layer.php?layer=genangan                → semua level genangan
GET api/get_layer.php?layer=genangan&level=2.5      → genangan level 2,5 m saja
GET api/get_layer.php?layer=batas_kota
GET api/get_layer.php?layer=kecamatan
GET api/get_layer.php?layer=batas_administrasi
GET api/get_layer.php?layer=danau
```
Semua endpoint mengembalikan `FeatureCollection` GeoJSON standar (`Content-Type: application/json`).

---

## 5. Catatan penting soal data sumber

Beberapa hal berikut perlu diketahui karena berkaitan langsung dengan data yang diunggah:

1. **File pendukung shapefile tidak lengkap.** Yang diunggah hanya file `.shp`
   (geometri), tanpa `.dbf` (tabel atribut), `.shx`, maupun `.prj`. Akibatnya:
   - Tidak ada nama/atribut asli untuk kecamatan → tabel `kecamatan` diisi nama
     generik ("Kecamatan 1", "Kecamatan 2", dst). Jika Anda punya `.dbf` aslinya,
     nama sebenarnya bisa di-`UPDATE` langsung ke tabel `kecamatan`.
   - Tidak ada informasi sistem koordinat (`.prj`). Berdasarkan pemeriksaan
     rentang koordinat (≈108,7–109,25° BT, 0,75–1,25° LU), data sudah dalam
     **WGS 84 (EPSG:4326)** derajat desimal, sehingga langsung dipakai tanpa
     reprojeksi. Mohon dikonfirmasi ulang jika ternyata sistem koordinat aslinya berbeda.
2. **Tidak ada shapefile sungai.** File yang diunggah adalah batas kecamatan,
   garis administrasi, dan danau — **tidak ada** layer sungai. Legenda & palet
   warna cyan tetap disiapkan (dipakai untuk layer **danau**), tetapi jika Anda
   punya shapefile sungai terpisah, tinggal tambahkan tabel `sungai` (struktur
   sama seperti tabel `danau`) di `sql/schema.sql`, lalu tambahkan satu blok
   layer baru di `assets/js/app.js` (salin pola `loadSupportLayer('danau', ...)`)
   dan satu case baru di `api/get_layer.php`.
3. **Geometri disederhanakan (simplify).** Poligon hasil *Raster to Polygon*
   ArcMap awalnya sangat detail (puluhan–ratusan ribu titik per level, mengikuti
   bentuk kotak-kotak sel raster). Untuk performa web, geometri disederhanakan
   dengan algoritma Douglas–Peucker (toleransi ±20–25 m) sebelum disimpan ke
   database — luas area genangan tidak berubah signifikan (< 0,05%), hanya detail
   tepi antar-piksel yang dihaluskan. Skrip konversi (`data_referensi/`) disertakan
   sebagai arsip bila Anda ingin mengulang proses dengan toleransi berbeda.
4. **Basemap gelap dari OpenStreetMap (bukan CARTO).** Sempat memakai tile gelap
   CARTO (`dark_all`), namun per akhir Agustus 2026 CARTO mewajibkan API key untuk
   basemap raster gratisnya (tanpa key, tile ditandai watermark "API KEY REQUIRED").
   Agar tidak bergantung pada pendaftaran API key, basemap diganti memakai tile
   standar OpenStreetMap yang digelapkan lewat filter CSS (`invert` + `hue-rotate`)
   di kelas `.dark-basemap-tiles`. Ini gratis tanpa key dan tersedia di seluruh
   dunia termasuk Singkawang pada semua level zoom. Catatan: tile.openstreetmap.org
   punya kebijakan penggunaan wajar (tidak untuk trafik produksi tinggi) — untuk
   skripsi/demo/tugas kuliah ini aman, tapi bila nanti di-deploy publik dengan
   trafik besar, sebaiknya daftar API key gratis CARTO (https://carto.com/basemaps/apikey)
   atau penyedia tile lain (MapTiler, Stadia Maps) dan kembalikan `L.tileLayer` di
   `assets/js/app.js` ke URL tersebut.
5. **Kolom `luas_km2` pada tabel `genangan_banjir`.** Diisi otomatis saat
   pembuatan data (proyeksi ke UTM 49N / EPSG:32649 lalu dihitung luasnya).
   Angka ini estimasi geometris dari poligon hasil simplifikasi, **bukan**
   angka survei tervalidasi — tampil di popup peta dan panel statistik legenda.
6. **Fitur pencarian lokasi** memakai layanan geocoding gratis Nominatim
   (OpenStreetMap) langsung dari browser. Layanan ini punya kebijakan
   penggunaan wajar (maks. ±1 permintaan/detik) — cukup aman untuk pemakaian
   biasa, tapi jangan dipakai untuk pencarian otomatis/masif.

---

## 6. Menambah level atau data baru

Untuk menambah level genangan baru atau memperbarui geometri:
1. Konversi shapefile ke WKT (mis. lewat QGIS: klik kanan layer → Export → Simpan
   sebagai, atau proses seperti pada skrip referensi di `data_referensi/`).
2. `INSERT INTO genangan_banjir (level_meter, nama, warna_hex, geom) VALUES (...)`
   dengan `ST_GeomFromText('MULTIPOLYGON(...)', 4326)`.
3. Tambahkan entri baru pada array `LEVELS` di `assets/js/app.js` (level, warna, label)
   agar muncul otomatis di gauge dan legenda.

---

## 7. Troubleshooting singkat

| Gejala | Kemungkinan penyebab |
|---|---|
| Notifikasi merah "Koneksi database gagal" | Modul MySQL di XAMPP belum di-Start, atau `DB_NAME` belum diimpor |
| Peta kosong / tidak ada poligon | Cek console browser (F12) → error dari `get_layer.php`; cek apakah tabel di database sudah terisi (`SELECT COUNT(*) FROM genangan_banjir;`) |
| Import `schema.sql` gagal di phpMyAdmin | Naikkan `upload_max_filesize` & `post_max_size` di `php.ini`, atau impor via terminal (lihat bagian 2c) |
| Basemap gelap tidak muncul | Perlu koneksi internet (tile OpenStreetMap diambil dari CDN, lalu digelapkan lewat filter CSS) |
