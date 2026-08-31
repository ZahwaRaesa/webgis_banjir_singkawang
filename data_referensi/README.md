Folder ini berisi arsip proses konversi shapefile -> GeoJSON (yang kemudian
dimasukkan ke MySQL lewat sql/schema.sql). Tidak dipakai langsung oleh
aplikasi web saat runtime — murni untuk dokumentasi/reproduksi bila Anda ingin
mengulang proses dengan data atau toleransi simplifikasi yang berbeda.

- *.geojson       : hasil akhir per layer (setelah dissolve + simplify)
- konversi_shapefile_ke_geojson.py : skrip Python (pyshp + shapely) yang dipakai
