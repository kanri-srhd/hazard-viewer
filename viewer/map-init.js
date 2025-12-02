// ======================================================================
// map-init.js - 地図の初期化（GSI標準地図・航空写真含む）
// ======================================================================

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
                    tiles: ["https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"],
                    tileSize: 256,
                    attribution: "© GSI"
                }
            },
            layers: [
                { id: "gsi-layer", type: "raster", source: "gsi-std" }
            ]
        },
        center: [139.7528, 35.6850],
        zoom: 9
    });

    map.on("load", () => {
        map.addSource("gsi-photo", {
            type: "raster",
            tiles: ["https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"],
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

    return map;
}
