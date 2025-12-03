// ======================================================================
// map-init.js - 地図の初期化（GSI標準地図・航空写真 + parcel/select 発火）
// ======================================================================

import { emit } from "./bus.js";

export function initMap() {

    const map = new maplibregl.Map({
        container: "map",
        localIdeographFontFamily: "Meiryo, Yu Gothic UI, MS PGothic, Segoe UI Symbol",
        style: {
            version: 8,
            glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
            sources: {
                "gsi-std": {
                    type: "raster",
                    tiles: [
                        "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"
                    ],
                    tileSize: 256,
                    attribution: "© GSI"
                }
            },
            layers: [
                { id: "gsi-base", type: "raster", source: "gsi-std" }
            ]
        },
        center: [139.7528, 35.6850],
        zoom: 9
    });

    // 航空写真レイヤー
    map.on("load", () => {
        map.addSource("gsi-photo", {
            type: "raster",
            tiles: [
                "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"
            ],
            tileSize: 256
        });
        map.addLayer({
            id: "gsi-photo-layer",
            type: "raster",
            source: "gsi-photo",
            layout: { visibility: "visible" },
            paint: { "raster-opacity": 0.8 }
        });
    });

    // ★ DataBus 統合：地図クリック → parcel/select 発火
    map.on("click", (e) => {
        const siteId = `site-${Date.now()}`;   // TODO: 実際は地番IDに置換
        emit("parcel/select", {
            siteId,
            location: e.lngLat
        });
    });

    return map;
}

// 注意:
// このモジュールは「地図初期化 + parcel/select 発火」のみ担当。
// ビジネスロジック・判定ロジック・状態管理はすべて他レイヤーへ委譲する。
// 例えば、parcel/select を受けて parcel loader を呼び出すのは unified layer の責務。