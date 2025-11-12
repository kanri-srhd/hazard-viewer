const map = L.map('map').setView([35.5, 134.8], 13);

L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
  attribution: '地理院タイル'
}).addTo(map);

const parcelLayer = L.geoJSON().addTo(map);

// 地番ファイルの読み込み（例：豊岡市）
fetch('geojson/28209__5_r.geojson')
  .then(res => res.json())
  .then(data => {
    parcelLayer.addData(data);
  });

// 住所検索機能
function searchAddress() {
  const query = document.getElementById('addressInput').value;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;

  fetch(url)
    .then(res => res.json())
    .then(results => {
      if (results.length > 0) {
        const lat = parseFloat(results[0].lat);
        const lon = parseFloat(results[0].lon);
        map.setView([lat, lon], 15);
      } else {
        alert("住所が見つかりませんでした");
      }
    });
}
