/* =====================================================================
   WebGIS Genangan Banjir — Kota Singkawang
   Logika peta, kontrol layer, simulasi, pencarian, dan notifikasi
   ===================================================================== */

// ---- Konfigurasi umum ----
const API_BASE = 'api/get_layer.php';
const SINGKAWANG_CENTER = [0.905, 108.985];
const DEFAULT_ZOOM = 12;
// Kotak pembatas kasar Kota Singkawang & sekitarnya, dipakai untuk membatasi hasil pencarian lokasi
const SEARCH_VIEWBOX = '108.55,1.15,109.15,0.65'; // left,top,right,bottom

const LEVELS = [
  { level: 1.0, color: '#22c55e', label: '1,0 m' },
  { level: 1.5, color: '#84cc16', label: '1,5 m' },
  { level: 2.0, color: '#eab308', label: '2,0 m' },
  { level: 2.5, color: '#f59e0b', label: '2,5 m' },
  { level: 3.0, color: '#f97316', label: '3,0 m' },
  { level: 3.5, color: '#ef4444', label: '3,5 m' },
  { level: 4.0, color: '#dc2626', label: '4,0 m' },
];

// ---- Peta ----
const map = L.map('map', {
  center: SINGKAWANG_CENTER,
  zoom: DEFAULT_ZOOM,
  zoomControl: false,
  attributionControl: true,
  minZoom: 9,
  maxZoom: 18,
});

L.control.zoom({ position: 'bottomright' }).addTo(map);
L.control.scale({ position: 'bottomright', imperial: false, maxWidth: 120 }).addTo(map);

// ---- Basemap (dua gaya: gelap & satelit) ----
const basemaps = {
  dark: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    subdomains: 'abc',
    maxZoom: 19,
    className: 'dark-basemap-tiles',
  }),
  satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  }),
};
let activeBasemapKey = 'dark';
basemaps[activeBasemapKey].addTo(map);

function switchBasemap(key) {
  if (key === activeBasemapKey || !basemaps[key]) return;
  map.removeLayer(basemaps[activeBasemapKey]);
  basemaps[key].addTo(map);
  activeBasemapKey = key;
  document.querySelectorAll('.basemap-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.basemap === key);
  });
}

// ---- State ----
const floodLayers = {};   // level -> L.geoJSON
const supportLayers = {}; // key -> L.geoJSON
let simRunning = false;
let simTimer = null;
let currentFillOpacity = 0.42;

// ======================================================================
// Notifikasi
// ======================================================================
function notify(text, type = 'info', ttl = 3200) {
  const stack = document.getElementById('notif-stack');
  const el = document.createElement('div');
  el.className = `toast ${type === 'info' ? '' : type}`;
  el.innerHTML = `<span class="dot"></span><span>${text}</span>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 320);
  }, ttl);
}

// ======================================================================
// Fetch helper
// ======================================================================
async function fetchLayer(layer, extraParams = '') {
  const res = await fetch(`${API_BASE}?layer=${layer}${extraParams}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ======================================================================
// Panel kontrol & legenda: ciut/luaskan
// ======================================================================
function wireCollapse(btnId, panelId) {
  document.getElementById(btnId).addEventListener('click', () => {
    document.getElementById(panelId).classList.toggle('collapsed');
  });
}

// ======================================================================
// Layer genangan per level
// ======================================================================
function fadeInLayer(geoLayer) {
  geoLayer.eachLayer((l) => {
    if (l._path) l._path.classList.add('fade-layer');
  });
}

function formatArea(km2) {
  if (km2 === null || km2 === undefined) return '—';
  return km2.toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' km²';
}

function buildFloodPopup(props) {
  const cfg = LEVELS.find((l) => l.level === props.level_m) || {};
  return `
    <div class="popup-title"><span class="popup-dot" style="background:${cfg.color || '#3ea6ff'};color:${cfg.color || '#3ea6ff'}"></span>${props.nama || 'Genangan'}</div>
    <div class="popup-row">Ketinggian: <b>${props.level_m?.toFixed(1)} m</b></div>
    <div class="popup-row">Estimasi luas: <b>${formatArea(props.luas_km2)}</b></div>
    <div class="popup-row" style="margin-top:4px;color:var(--text-dim);font-size:10px;">${props.keterangan || ''}</div>
  `;
}

async function ensureFloodLevel(level) {
  if (floodLayers[level]) return floodLayers[level];
  const cfg = LEVELS.find((l) => l.level === level);
  try {
    const gj = await fetchLayer('genangan', `&level=${level}`);
    const layer = L.geoJSON(gj, {
      style: () => ({
        color: cfg.color,
        weight: 1.2,
        fillColor: cfg.color,
        fillOpacity: currentFillOpacity,
        opacity: 0.9,
      }),
      onEachFeature: (feature, lyr) => {
        lyr.bindPopup(buildFloodPopup(feature.properties));
        lyr.on('mouseover', () => lyr.setStyle({ weight: 2.4, fillOpacity: Math.min(currentFillOpacity + 0.22, 0.9) }));
        lyr.on('mouseout', () => lyr.setStyle({ weight: 1.2, fillOpacity: currentFillOpacity }));
      },
    });
    floodLayers[level] = layer;
    return layer;
  } catch (err) {
    notify(`Gagal memuat layer ${cfg.label}: cek koneksi database.`, 'danger', 5000);
    throw err;
  }
}

function syncLevelUI(level, active) {
  const row = document.querySelector(`.gauge-row[data-level="${level}"]`);
  const item = document.querySelector(`.legend-item[data-level="${level}"]`);
  row?.classList.toggle('active', active);
  item?.classList.toggle('active', active);
}

async function setFloodLevelVisible(level, visible) {
  const cfg = LEVELS.find((l) => l.level === level);
  if (visible) {
    const layer = await ensureFloodLevel(level);
    if (!map.hasLayer(layer)) {
      layer.addTo(map);
      fadeInLayer(layer);
      notify(`Layer genangan ${cfg.label} dimuat.`);
    }
  } else {
    const layer = floodLayers[level];
    if (layer && map.hasLayer(layer)) map.removeLayer(layer);
  }
  syncLevelUI(level, visible);
}

// ======================================================================
// Bangun panel gauge (satu baris toggle per level)
// ======================================================================
function buildGauge() {
  const gauge = document.getElementById('gauge');
  LEVELS.forEach((cfg) => {
    const row = document.createElement('div');
    row.className = 'gauge-row';
    row.dataset.level = cfg.level;
    row.dataset.labelText = cfg.label;
    row.style.setProperty('--lvl-color', cfg.color);
    row.innerHTML = `
      <span class="gauge-bulb"></span>
      <span class="gauge-track"><span class="gauge-fill"></span></span>
      <span class="gauge-label">${cfg.label}</span>
    `;
    row.addEventListener('click', async () => {
      const isActive = row.classList.contains('active');
      await setFloodLevelVisible(cfg.level, !isActive);
    });
    gauge.appendChild(row);
  });

  // Legenda juga bisa dipakai untuk toggle level yang sama
  document.querySelectorAll('.legend-item[data-level]').forEach((item) => {
    item.addEventListener('click', async () => {
      const level = parseFloat(item.dataset.level);
      const isActive = item.classList.contains('active');
      await setFloodLevelVisible(level, !isActive);
    });
  });
}

async function setAll(visible) {
  for (const cfg of LEVELS) {
    await setFloodLevelVisible(cfg.level, visible);
  }
  if (!visible) notify('Semua layer genangan disembunyikan.');
}

// ======================================================================
// Slider transparansi
// ======================================================================
function wireOpacitySlider() {
  const slider = document.getElementById('opacity-slider');
  slider.addEventListener('input', () => {
    currentFillOpacity = Number(slider.value) / 100;
    Object.values(floodLayers).forEach((layer) => {
      layer.setStyle({ fillOpacity: currentFillOpacity });
    });
  });
}

// ======================================================================
// Statistik luas genangan (panel legenda)
// ======================================================================
async function loadStats() {
  const list = document.getElementById('stats-list');
  try {
    const gj = await fetchLayer('genangan');
    const rows = gj.features
      .map((f) => f.properties)
      .sort((a, b) => a.level_m - b.level_m);
    const maxArea = Math.max(...rows.map((r) => r.luas_km2 || 0), 1);

    list.innerHTML = rows.map((r) => {
      const cfg = LEVELS.find((l) => l.level === r.level_m) || {};
      const pct = Math.max(4, Math.round(((r.luas_km2 || 0) / maxArea) * 100));
      return `
        <div class="stats-row" title="Genangan ${cfg.label}">
          <span class="stats-dot" style="background:${cfg.color};color:${cfg.color}"></span>
          <span class="stats-label">${cfg.label}</span>
          <span class="stats-bar-track"><span class="stats-bar-fill" style="width:${pct}%;background:${cfg.color}"></span></span>
          <span class="stats-value">${formatArea(r.luas_km2)}</span>
        </div>
      `;
    }).join('');
  } catch (err) {
    list.innerHTML = '<div class="stats-loading">Statistik tidak tersedia.</div>';
  }
}

// ======================================================================
// Layer pendukung (batas kota, kecamatan, garis admin, danau)
// ======================================================================
async function loadSupportLayer(key, layerName, style, defaultOn) {
  try {
    const gj = await fetchLayer(layerName);
    const layer = L.geoJSON(gj, {
      style: () => style,
      onEachFeature: (feature, lyr) => {
        if (feature.properties?.nama) {
          lyr.bindPopup(`<div class="popup-title">${feature.properties.nama}</div>`);
        }
      },
    });
    supportLayers[key] = layer;
    if (defaultOn) {
      layer.addTo(map);
      fadeInLayer(layer);
    }
  } catch (err) {
    notify(`Layer pendukung "${layerName}" gagal dimuat.`, 'warn', 4500);
  }
}

function wireSupportToggle(checkboxId, key) {
  document.getElementById(checkboxId).addEventListener('change', (e) => {
    const layer = supportLayers[key];
    if (!layer) return;
    if (e.target.checked) {
      layer.addTo(map);
      fadeInLayer(layer);
    } else {
      map.removeLayer(layer);
    }
  });
}

// ======================================================================
// Simulasi kenaikan air (autoplay, kumulatif dari level terendah)
// ======================================================================
async function runSimulation() {
  const btn = document.getElementById('btn-simulate');
  const label = document.getElementById('btn-simulate-label');
  const status = document.getElementById('sim-status');
  const statusText = document.getElementById('sim-status-text');

  if (simRunning) {
    stopSimulation();
    return;
  }

  simRunning = true;
  btn.classList.add('is-running');
  label.textContent = 'Hentikan Simulasi';
  status.classList.add('show');
  await setAll(false);
  notify('Simulasi kenaikan air dimulai.', 'info');

  let i = 0;
  const step = async () => {
    if (!simRunning) return;
    if (i >= LEVELS.length) {
      statusText.textContent = 'Simulasi selesai — puncak genangan 4,0 m tercapai.';
      notify('Simulasi selesai. Puncak genangan 4,0 m tercapai.', 'warn', 4000);
      simTimer = setTimeout(stopSimulation, 2200);
      return;
    }
    const cfg = LEVELS[i];
    statusText.textContent = `Mensimulasikan kenaikan air — level ${cfg.label}`;
    await setFloodLevelVisible(cfg.level, true);
    const row = document.querySelector(`.gauge-row[data-level="${cfg.level}"]`);
    row?.classList.add('pulsing');
    setTimeout(() => row?.classList.remove('pulsing'), 1000);
    i += 1;
    simTimer = setTimeout(step, 1300);
  };
  step();
}

function stopSimulation() {
  simRunning = false;
  clearTimeout(simTimer);
  const btn = document.getElementById('btn-simulate');
  const label = document.getElementById('btn-simulate-label');
  const status = document.getElementById('sim-status');
  btn.classList.remove('is-running');
  label.textContent = 'Simulasi Kenaikan Air';
  status.classList.remove('show');
  document.querySelectorAll('.gauge-row').forEach((r) => r.classList.remove('pulsing'));
}

// ======================================================================
// Pencarian lokasi (Nominatim OpenStreetMap, dibatasi area Singkawang)
// ======================================================================
let searchMarker = null;
let searchDebounce = null;

function wireSearch() {
  const box = document.querySelector('.search-box');
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  const results = document.getElementById('search-results');

  input.addEventListener('input', () => {
    box.classList.toggle('has-value', input.value.length > 0);
    clearTimeout(searchDebounce);
    const q = input.value.trim();
    if (q.length < 3) {
      results.classList.remove('show');
      results.innerHTML = '';
      return;
    }
    searchDebounce = setTimeout(() => doSearch(q), 450);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    box.classList.remove('has-value');
    results.classList.remove('show');
    results.innerHTML = '';
    input.focus();
  });
}

async function doSearch(query) {
  const results = document.getElementById('search-results');
  results.innerHTML = '<div class="search-result-empty">Mencari…</div>';
  results.classList.add('show');
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=${SEARCH_VIEWBOX}&bounded=0&limit=6`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (!data.length) {
      results.innerHTML = '<div class="search-result-empty">Lokasi tidak ditemukan.</div>';
      return;
    }
    results.innerHTML = data.map((d, i) => `<div class="search-result-item" data-i="${i}">${d.display_name}</div>`).join('');
    results.querySelectorAll('.search-result-item').forEach((el) => {
      el.addEventListener('click', () => {
        const d = data[Number(el.dataset.i)];
        flyToSearchResult(d);
        results.classList.remove('show');
      });
    });
  } catch (err) {
    results.innerHTML = '<div class="search-result-empty">Pencarian gagal — cek koneksi internet.</div>';
  }
}

function flyToSearchResult(d) {
  const lat = parseFloat(d.lat);
  const lon = parseFloat(d.lon);
  map.flyTo([lat, lon], 15, { duration: 1.2 });
  if (searchMarker) map.removeLayer(searchMarker);
  searchMarker = L.marker([lat, lon]).addTo(map).bindPopup(`<div class="popup-title">${d.display_name.split(',')[0]}</div>`).openPopup();
  notify(`Berpindah ke: ${d.display_name.split(',')[0]}`);
}

// ======================================================================
// Tombol utilitas peta: lokasi saya, kembali ke awal, layar penuh
// ======================================================================
function wireMapTools() {
  document.getElementById('btn-home').addEventListener('click', () => {
    map.flyTo(SINGKAWANG_CENTER, DEFAULT_ZOOM, { duration: 1 });
    notify('Kembali ke tampilan awal.');
  });

  document.getElementById('btn-locate').addEventListener('click', () => {
    if (!navigator.geolocation) {
      notify('Geolocation tidak didukung browser ini.', 'warn');
      return;
    }
    notify('Mencari lokasi Anda…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.flyTo([latitude, longitude], 15, { duration: 1.2 });
        L.marker([latitude, longitude]).addTo(map).bindPopup('<div class="popup-title">Lokasi Anda</div>').openPopup();
      },
      () => notify('Gagal mengambil lokasi. Periksa izin lokasi browser.', 'danger'),
    );
  });

  const fsBtn = document.getElementById('btn-fullscreen');
  fsBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      fsBtn.classList.add('is-active');
    } else {
      document.exitFullscreen?.();
      fsBtn.classList.remove('is-active');
    }
  });
  document.addEventListener('fullscreenchange', () => {
    fsBtn.classList.toggle('is-active', !!document.fullscreenElement);
    setTimeout(() => map.invalidateSize(), 200);
  });
}

// ======================================================================
// Pemilih gaya basemap
// ======================================================================
function wireBasemapSwitch() {
  document.querySelectorAll('.basemap-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchBasemap(btn.dataset.basemap));
  });
}

// ======================================================================
// Pembaca koordinat
// ======================================================================
map.on('mousemove', (e) => {
  document.getElementById('coord-lat').textContent = e.latlng.lat.toFixed(6);
  document.getElementById('coord-lng').textContent = e.latlng.lng.toFixed(6);
});
map.on('zoomend', () => {
  document.getElementById('coord-zoom').textContent = map.getZoom();
});

// ======================================================================
// Inisialisasi
// ======================================================================
async function init() {
  buildGauge();
  wireOpacitySlider();
  wireSearch();
  wireMapTools();
  wireBasemapSwitch();
  wireCollapse('collapse-control', 'control-panel');
  wireCollapse('collapse-legend', 'legend-panel');

  document.getElementById('btn-simulate').addEventListener('click', runSimulation);
  document.getElementById('btn-all-on').addEventListener('click', () => setAll(true));
  document.getElementById('btn-all-off').addEventListener('click', () => setAll(false));

  wireSupportToggle('toggle-batas-kota', 'batas_kota');
  wireSupportToggle('toggle-kecamatan', 'kecamatan');
  wireSupportToggle('toggle-admin-line', 'admin_line');
  wireSupportToggle('toggle-danau', 'danau');

  await Promise.all([
    loadSupportLayer('batas_kota', 'batas_kota', { color: '#3ea6ff', weight: 2, fill: false, dashArray: '6 4' }, true),
    loadSupportLayer('kecamatan', 'kecamatan', { color: '#5c729a', weight: 1, fill: false }, true),
    loadSupportLayer('admin_line', 'batas_administrasi', { color: '#7fd4ff', weight: 1, dashArray: '2 4' }, false),
    loadSupportLayer('danau', 'danau', { color: '#22d3ee', weight: 1, fillColor: '#22d3ee', fillOpacity: 0.5 }, true),
    loadStats(),
  ]);

  // Tampilkan genangan 1,0 m secara default agar peta tidak kosong saat dibuka
  await setFloodLevelVisible(1.0, true);

  document.getElementById('boot-overlay').classList.add('hide');
  notify('Peta siap. Data dimuat dari MySQL melalui API PHP.');
}

init().catch((err) => {
  console.error(err);
  document.getElementById('boot-overlay').classList.add('hide');
  notify('Terjadi kesalahan saat memuat peta. Periksa konfigurasi database di api/db.php.', 'danger', 8000);
});
