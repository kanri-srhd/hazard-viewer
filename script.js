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
