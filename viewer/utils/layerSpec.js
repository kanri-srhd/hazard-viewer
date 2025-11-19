// ========================================================
// layerSpec.js
// レイヤー仕様の統一インターフェイス
// API・PMTiles・GeoJSON を共通の形式で扱うための仕組み
// ========================================================

export function createLayerSpec({
    id,              // レイヤーID
    source,          // { type, url, endpoint, params ... }
    type = "circle", // circle / fill / line / symbol / heatmap
    paint = {},      // MapLibre paint設定
    layout = {},     // layout設定
    popup = null     // (props) => string
}) {
    if (!id) throw new Error("createLayerSpec: id is required");
    if (!source) throw new Error("createLayerSpec: source is required");

    return {
        id,
        source,
        type,
        paint,
        layout,
        popup
    };
}
