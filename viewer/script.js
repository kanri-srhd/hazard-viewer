const map = L.map('map').setView([35.54427650212612, 134.8203470457028], 15); // 豊岡市中心＋ズーム調整

// ベースマップ：Google地図
const googleMap = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
  attribution: '© Google',
  maxZoom: 20
}).addTo(map);

// 航空写真（GSI）
const gsiPhoto = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/ort/{z}/{x}/{y}.jpg', {
  attribution: '国土地理院',
  maxZoom: 18
});

// ハザードマップレイヤー（opacity調整済み）
const hazardLayers = {
  洪水: L.tileLayer('https://disaportal.gsi.go.jp/raster/flood/{z}/{x}/{y}.png', { opacity: 0.8 }),
  土砂災害: L.tileLayer('https://disaportal.gsi.go.jp/raster/landslide/{z}/{x}/{y}.png', { opacity: 0.8 }),
  津波: L.tileLayer('https://disaportal.gsi.go.jp/raster/tsunami/{z}/{x}/{y}.png', { opacity: 0.8 }),
  液状化: L.tileLayer('https://disaportal.gsi.go.jp/raster/liquefaction/{z}/{x}/{y}.png', { opacity: 0.8 })
};

// 地番ポリゴンレイヤー（GeoJSONから読み込み）
const parcelIndex = {};
const parcelLayer = L.geoJSON(null, {
  onEachFeature: (feature, layer) => {
    const props = feature.properties;
    const key = `${props["市町村名"]} ${props["大字名"] || ''} ${props["地番"] || ''}`.trim();
    parcelIndex[key] = layer;

    layer.bindPopup(`<b>${props["市町村名"]}</b><br>${props["大字名"] || ''} ${props["地番"] || ''}`);
  },
  style: { color: '#ff6600', weight: 0.5, fillOpacity: 0.1 }
});

fetch('geojson/28209__5_r.geojson')
  .then(res => res.json())
  .then(data => {
    parcelLayer.addData(data);
    parcelLayer.addTo(map);
    map.fitBounds(parcelLayer.getBounds());
  });

window.searchParcel = function() {
  const query = document.getElementById('searchBox').value.trim();
  const layer = parcelIndex[query];
  if (layer) {
    map.fitBounds(layer.getBounds());
    layer.openPopup();
  } else {
    alert("該当する地番が見つかりませんでした。");
  }
};

// レイヤー切り替えUI
const baseMaps = {
  "Google地図": googleMap,
  "航空写真（GSI）": gsiPhoto
};

const overlayMaps = {
  "地番ポリゴン": parcelLayer,
  ...hazardLayers
};

L.control.layers(baseMaps, overlayMaps).addTo(map);

// 初期表示で洪水レイヤーを追加
hazardLayers.洪水.addTo(map);

// 電力インフラ（容量ポイント + OSMポリゴン）
let powerPointsLayer = L.layerGroup();
let powerPolygonsLayer = L.layerGroup();

function loadPowerInfra() {
  // Capacity points
  fetch('../data/power/capacity/tepco_substations_all_matched.json')
    .then(r => r.json())
    .then(arr => {
      const pts = arr
        .filter(e => e.lat != null && e.lon != null)
        .filter(e => e.is_foreign !== true)
        .map(e => L.circleMarker([e.lat, e.lon], {
          radius: 5,
          color: '#ffffff',
          weight: 1,
          fillColor: '#ff4500',
          fillOpacity: 0.8
        }).bindPopup(`<b>${e.name}変電所</b><br>電圧: ${e.voltage_kv || '-'} kV<br>事業者: ${e.utility || '-'}`));
      pts.forEach(m => powerPointsLayer.addLayer(m));
    });

  // OSM polygons (combined preferred)
  const tryCombined = '../data/power/osm/substation_polygons_with_generated.geojson';
  const fallbackBase = '../data/power/osm/substation_polygons.geojson';
  fetch(tryCombined, { method: 'HEAD' })
    .then(r => (r.ok ? tryCombined : fallbackBase))
    .then(path => fetch(path).then(r => r.json()))
    .then(geo => {
      const filtered = {
        type: 'FeatureCollection',
        features: (geo.features || []).filter(f => f.properties?.is_foreign !== true)
      };
      const poly = L.geoJSON(filtered, {
        style: {
          color: '#8a2be2',
          weight: 1,
          fillColor: '#d5a6f5',
          fillOpacity: 0.35
        },
        onEachFeature: (feat, layer) => {
          const p = feat.properties || {};
          const title = p['name'] || p['name:ja'] || p['operator'] || '変電所';
          layer.bindPopup(`<b>${title}</b>`);
        }
      });
      powerPolygonsLayer.addLayer(poly);
    });
}

// コントロールへ追加
overlayMaps['電力インフラ（ポイント）'] = powerPointsLayer;
overlayMaps['電力インフラ（ポリゴン）'] = powerPolygonsLayer;
// 再描画のため、コントロールを付け直す
L.control.layers(baseMaps, overlayMaps).addTo(map);
// 初回ロード
loadPowerInfra();
