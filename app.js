// 初期中心は旭川市周辺
const INITIAL_VIEW = { lat: 34.686, lng: 135.499, zoom: 12 };

// GSI ベースマップ
const BASE_LAYERS = {
  'GSI 標準': L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution:
      '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院タイル</a>'
  }),
  'GSI 淡色': L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution:
      '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院タイル</a>'
  }),
  'GSI シームレス写真': L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg', {
    maxZoom: 18,
    attribution:
      '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院タイル</a>'
  })
};

// 公式ハザード XYZ タイル
// 注: disaportaldata/disaportal.gsi.go.jp の XYZ タイルエンドポイントは動的に変更される場合があります。
// 現在の実装は GeoJSON ベースの表示に焦点を当てています。
// 将来的にはここに確認済みのタイル URL を挿入してください。
const HAZARD_LAYERS = {};

// 状態UI
const statusListEl = document.getElementById('statusList');
function addStatus(message, type = 'ok') {
  const li = document.createElement('li');
  li.className = 'status-item';
  li.innerHTML = `<span class="badge ${type}">${type.toUpperCase()}</span><span>${message}</span>`;
  statusListEl.prepend(li);
}

// Map 初期化
const map = L.map('map', {
  zoomControl: true,
  attributionControl: true,
  preferCanvas: true
}).setView([INITIAL_VIEW.lat, INITIAL_VIEW.lng], INITIAL_VIEW.zoom);

// ベースレイヤ追加（淡色をデフォルト）
BASE_LAYERS['GSI 淡色'].addTo(map);

// レイヤコントロール準備
const baseControl = {};
const overlayControl = {};

// ベース登録
Object.entries(BASE_LAYERS).forEach(([name, layer]) => {
  baseControl[name] = layer;
});

// ハザードレイヤ生成 + tileerror 自動ハイド
const hazardLeafletLayers = {};
Object.entries(HAZARD_LAYERS).forEach(([key, meta]) => {
  const layer = L.tileLayer(meta.url, {
    maxZoom: meta.maxZoom,
    opacity: meta.opacity,
    crossOrigin: true
  });

  // tileerror を検出して自動的にハイド + ステータス表示
  layer.on('tileerror', (e) => {
    // 初回 tileerror でレイヤを外す（未配信エリアとして明示）
    if (map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
    addStatus(`「${meta.name}」は現在位置・ズームでは未配信（または未提供）です。`, 'warn');
  });

  // 読み込み成功時（少なくとも1枚タイル取得）ステータス更新
  let firstTileLoaded = false;
  layer.on('tileload', () => {
    if (!firstTileLoaded) {
      firstTileLoaded = true;
      addStatus(`「${meta.name}」を表示しました。`, 'ok');
    }
  });

  hazardLeafletLayers[key] = layer;
  overlayControl[meta.name] = layer;
});

// レイヤコントロールを追加
L.control.layers(baseControl, overlayControl, { collapsed: false }).addTo(map);

// 出典表記（Leaflet attributionはベースレイヤが設定済み。ハザードの出典も追記）
map.attributionControl.addAttribution(
  '<a href="https://disaportal.gsi.go.jp" target="_blank">Disaster Map Portal</a> / MLITT / GeoInfo Japan'
);

// 凡例パネル連携
const legendPanel = document.getElementById('legendPanel');
const legendContent = document.getElementById('legendContent');
const toggleLegendBtn = document.getElementById('toggleLegend');

toggleLegendBtn.addEventListener('click', () => {
  legendPanel.classList.toggle('hidden');
});

// 凡例の自動表示：レイヤの onAdd / onRemove に合わせて更新
function setLegendForLayer(meta) {
  legendContent.innerHTML = '';
  if (meta.legendImg) {
    const img = document.createElement('img');
    img.src = meta.legendImg;
    img.alt = `${meta.name} 凡例`;
    legendContent.appendChild(img);
  } else {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = '凡例情報が未設定です。';
    legendContent.appendChild(p);
  }
}

function clearLegendIfLayerRemoved(meta) {
  // 現在表示中の凡例がこのレイヤ由来ならクリア
  const img = legendContent.querySelector('img');
  if (img && img.alt === `${meta.name} 凡例`) {
    legendContent.innerHTML = '<p class="muted">レイヤを選択すると凡例が表示されます。</p>';
  }
}

// レイヤ切替監視（Leafletのレイヤイベントを利用）
map.on('overlayadd', (e) => {
  const found = Object.entries(HAZARD_LAYERS).find(([, m]) => m.name === e.name);
  if (found) {
    const meta = found[1];
    setLegendForLayer(meta);
    legendPanel.classList.remove('hidden');
  }
});

map.on('overlayremove', (e) => {
  const found = Object.entries(HAZARD_LAYERS).find(([, m]) => m.name === e.name);
  if (found) {
    const meta = found[1];
    clearLegendIfLayerRemoved(meta);
  }
});

// 初期メッセージ
addStatus('GSI 淡色ベースで初期化しました。', 'ok');
addStatus('レイヤを追加すると、未提供エリアは自動的にハイドされます（tileerror検知）。', 'ok');

// 操作：初期位置へ
document.getElementById('resetView').addEventListener('click', () => {
  map.setView([INITIAL_VIEW.lat, INITIAL_VIEW.lng], INITIAL_VIEW.zoom);
});

// 旭川市で有用そうなレイヤをデフォルトでオンにする（任意）
hazardLeafletLayers.Flood_L2_Shinsuishin.addTo(map);
setLegendForLayer(HAZARD_LAYERS.Flood_L2_Shinsuishin);
legendPanel.classList.remove('hidden');
