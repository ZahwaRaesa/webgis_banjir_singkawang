<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>WebGIS Genangan Banjir — Kota Singkawang</title>

<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/style.css">
</head>
<body>

<!-- ===== Boot overlay ===== -->
<div id="boot-overlay">
  <div class="boot-ring"></div>
  <p>Memuat data spasial…</p>
</div>

<!-- ===== Map ===== -->
<div id="map"></div>

<!-- ===== Control panel (left) ===== -->
<aside id="control-panel" class="panel">
  <div class="panel-header">
    <div class="brand">
      <svg class="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M12 2 3 7v6c0 5 4 8.5 9 9 5-.5 9-4 9-9V7l-9-5Z"/>
        <path d="M8.5 12.5 11 15l4.5-5.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div class="brand-title">
        <span>Smart City · Mitigasi Bencana</span>
        WebGIS Genangan Banjir Kota Singkawang
      </div>
    </div>
    <button class="panel-collapse-btn" id="collapse-control" title="Ciutkan panel" aria-label="Ciutkan panel">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  </div>

  <div class="panel-body" id="control-body">
    <p class="panel-desc">
      Simulasi sebaran genangan banjir Kota Singkawang berdasarkan tujuh level ketinggian muka air
      (1,0–4,0&nbsp;m), hasil pemodelan raster‑ke‑poligon. Aktifkan level pada panel di bawah, klik area
      genangan di peta untuk detail, atau jalankan simulasi kenaikan air secara otomatis.
    </p>

    <!-- Pencarian lokasi -->
    <div class="search-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3" stroke-linecap="round"/></svg>
      <input type="text" id="search-input" placeholder="Cari lokasi / kecamatan…" autocomplete="off">
      <button id="search-clear" class="search-clear" title="Bersihkan" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div id="search-results" class="search-results"></div>

    <div class="section-label">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v20M6 8l6-6 6 6M6 16l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Skala Ketinggian Genangan
    </div>
    <div id="gauge"><!-- diisi oleh app.js --></div>

    <div class="opacity-row">
      <span class="opacity-label">Transparansi Layer</span>
      <input type="range" id="opacity-slider" min="10" max="90" value="42">
    </div>

    <div class="btn-row">
      <button id="btn-simulate" class="btn btn-primary">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        <span id="btn-simulate-label">Simulasi Kenaikan Air</span>
      </button>
    </div>
    <div class="btn-row">
      <button id="btn-all-on" class="btn btn-ghost">Tampilkan Semua</button>
      <button id="btn-all-off" class="btn btn-ghost">Sembunyikan Semua</button>
    </div>

    <div class="section-label">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12h18M3 6h18M3 18h18" stroke-linecap="round"/></svg>
      Layer Pendukung
    </div>
    <div class="layer-toggle">
      <span>Batas Kota</span>
      <label class="switch"><input type="checkbox" id="toggle-batas-kota" checked><span class="slider"></span></label>
    </div>
    <div class="layer-toggle">
      <span>Batas Kecamatan</span>
      <label class="switch"><input type="checkbox" id="toggle-kecamatan" checked><span class="slider"></span></label>
    </div>
    <div class="layer-toggle">
      <span>Garis Administrasi</span>
      <label class="switch"><input type="checkbox" id="toggle-admin-line"><span class="slider"></span></label>
    </div>
    <div class="layer-toggle">
      <span>Danau / Badan Air</span>
      <label class="switch"><input type="checkbox" id="toggle-danau" checked><span class="slider"></span></label>
    </div>

    <div class="section-label">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3v18h18M7 15l4-5 3 3 5-7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Gaya Peta Dasar
    </div>
    <div class="basemap-switch" id="basemap-switch">
      <button class="basemap-btn active" data-basemap="dark" type="button">Gelap</button>
      <button class="basemap-btn" data-basemap="satellite" type="button">Satelit</button>
    </div>
  </div>
</aside>

<!-- ===== Legend panel (right) ===== -->
<aside id="legend-panel" class="panel">
  <div class="panel-header">
    <div class="legend-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 21V9M12 21V3M20 21v-7" stroke-linecap="round"/></svg>
      Legenda
    </div>
    <button class="panel-collapse-btn" id="collapse-legend" title="Ciutkan panel" aria-label="Ciutkan panel">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  </div>

  <div class="panel-body" id="legend-body">
    <div class="legend-gradient"></div>
    <div class="legend-scale"><span>1,0 m</span><span>4,0 m</span></div>

    <div class="legend-item" data-level="1.0" title="Klik untuk tampilkan/sembunyikan"><span class="legend-swatch" style="background:#22c55e;color:#22c55e"></span>1,0 m — Dangkal</div>
    <div class="legend-item" data-level="1.5" title="Klik untuk tampilkan/sembunyikan"><span class="legend-swatch" style="background:#84cc16;color:#84cc16"></span>1,5 m</div>
    <div class="legend-item" data-level="2.0" title="Klik untuk tampilkan/sembunyikan"><span class="legend-swatch" style="background:#eab308;color:#eab308"></span>2,0 m</div>
    <div class="legend-item" data-level="2.5" title="Klik untuk tampilkan/sembunyikan"><span class="legend-swatch" style="background:#f59e0b;color:#f59e0b"></span>2,5 m</div>
    <div class="legend-item" data-level="3.0" title="Klik untuk tampilkan/sembunyikan"><span class="legend-swatch" style="background:#f97316;color:#f97316"></span>3,0 m</div>
    <div class="legend-item" data-level="3.5" title="Klik untuk tampilkan/sembunyikan"><span class="legend-swatch" style="background:#ef4444;color:#ef4444"></span>3,5 m</div>
    <div class="legend-item" data-level="4.0" title="Klik untuk tampilkan/sembunyikan"><span class="legend-swatch" style="background:#dc2626;color:#dc2626"></span>4,0 m — Terdalam</div>

    <div class="legend-divider"></div>

    <div class="legend-item"><span class="legend-swatch" style="background:#22d3ee;color:#22d3ee"></span>Danau / Badan Air</div>
    <div class="legend-item"><span class="legend-swatch line" style="background:#3ea6ff;color:#3ea6ff"></span>Batas Kota</div>
    <div class="legend-item"><span class="legend-swatch line" style="background:#5c729a;color:#5c729a"></span>Batas Kecamatan</div>

    <div class="legend-divider"></div>

    <div class="legend-title" style="margin-bottom:8px;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3v18h18M7 16l3-4 3 2 4-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Statistik Luas Genangan
    </div>
    <div id="stats-list" class="stats-list">
      <div class="stats-loading">Memuat statistik…</div>
    </div>

    <p class="legend-note">Sumber: Raster to Polygon ArcMap, diproses ke MySQL Spatial &amp; disajikan via PHP GeoJSON API. Luas area adalah estimasi otomatis dari geometri.</p>
  </div>
</aside>

<!-- ===== Map utility buttons (bottom-right, above zoom) ===== -->
<div id="map-tools" class="panel">
  <button id="btn-locate" class="map-tool-btn" title="Lokasi saya" aria-label="Lokasi saya">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke-linecap="round"/></svg>
  </button>
  <button id="btn-home" class="map-tool-btn" title="Kembali ke tampilan awal" aria-label="Kembali ke tampilan awal">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11l9-8 9 8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 10v10h14V10" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
  <button id="btn-fullscreen" class="map-tool-btn" title="Layar penuh" aria-label="Layar penuh">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
</div>

<!-- ===== Coordinate reader ===== -->
<div id="coord-reader" class="panel">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s7-7.58 7-13A7 7 0 0 0 5 9c0 5.42 7 13 7 13Z"/><circle cx="12" cy="9" r="2.3"/></svg>
  <span>LAT <b id="coord-lat">-0.000000</b></span>
  <span class="sep">/</span>
  <span>LNG <b id="coord-lng">000.000000</b></span>
  <span id="zoom-badge">Z<span id="coord-zoom">12</span></span>
</div>

<!-- ===== Simulation status pill ===== -->
<div id="sim-status" class="panel"><span class="live-dot"></span><span id="sim-status-text">Mensimulasikan kenaikan air…</span></div>

<!-- ===== Notification stack ===== -->
<div id="notif-stack"></div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="assets/js/app.js"></script>
</body>
</html>
