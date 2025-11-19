// ======================================================
//  main.js
//  全国ハザード × 地番 × 送電網 × 空き容量 統合ビューア
//  初期化コード（地理院タイル + レイヤーローダー）
// ======================================================

// ------------------------------
// MapLibre の初期設定
// ------------------------------
const map = new maplibregl.Map({
    container: 'map',
    style: {
        "version": 8,
        "sources": {
            "gsi": {
                "type": "raster",
                "tiles": [
                    "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"
                ],
                "tileSize": 256,
                "attribution": "© 国土地理院"
            }
        },
        "layers": [
            {
                "id": "gsi-layer",
                "type": "raster",
                "source": "gsi",
                "minzoom": 0,
                "maxzoom": 18
            }
        ]
    },
    center: [135.30, 34.40],  // lng, lat
    zoom: 10,
    maxZoom: 18,
    minZoom: 5
});

window.map = map;  // グローバルアクセス用

// 縮尺コントロール追加
map.addControl(new maplibregl.ScaleControl({
    maxWidth: 200,
    unit: "metric"
}), 'bottom-left');

// ======================================================
//  レイヤーローダー
// ======================================================

// viewer/layers/*.js を読み込む（各ファイル側で登録処理を行う）
async function loadViewerLayers() {

    // utils
    await import('./utils/fetchJSON.js');
    await import('./utils/styleLoader.js');
    await import('./utils/maplibreHelpers.js');

    // base map (地理院タイルなど)
    await import('./layers/base.js');

    // 各レイヤー（初期状態はOFF）
    const hazardLayer = await import('./layers/hazard.js');
    const jibanLayer = await import('./layers/jiban.js');
    const gridLayer = await import('./layers/grid.js');
    const capacityLayer = await import('./layers/capacity.js');

    // レイヤーマネージャ（UI）
    const uiController = await import('./layers/ui.js');

    // UI パネルを生成
    uiController.createLayerToggleUI({
        hazard: { 
            label: "ハザード",
            toggle: (checked) => hazardLayer.toggleLayer(checked)
        },
        jiban: { 
            label: "地番",
            toggle: (checked) => jibanLayer.toggleLayer(checked)
        },
        grid: { 
            label: "送電網",
            toggle: (checked) => gridLayer.toggleLayer(checked)
        },
        capacity: { 
            label: "空き容量",
            toggle: (checked) => capacityLayer.toggleLayer(checked)
        }
    });
}

// ======================================================
//  マップ初期化後の処理
// ======================================================
map.on('load', () => {
    console.log("Map Loaded: Initializing Viewer Layers...");
    loadViewerLayers();
});