// ======================================================
// hazard.js
// ハザードレイヤー（洪水・土砂・津波・液状化）
// 各レイヤーを独立して管理
// ======================================================

export const hazardLayers = {
    flood: {
        id: "hazard-flood",
        url: "https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin/{z}/{x}/{y}.png"
    },
    landslide: {
        id: "hazard-landslide",
        url: "https://disaportaldata.gsi.go.jp/raster/03_doseki_keikaikuiki/{z}/{x}/{y}.png"
    },
    tsunami: {
        id: "hazard-tsunami",
        url: "https://disaportaldata.gsi.go.jp/raster/05_tsunami_shinsui/{z}/{x}/{y}.png"
    },
    liquefaction: {
        id: "hazard-liquefaction",
        url: "https://disaportaldata.gsi.go.jp/raster/06_ekijoka/{z}/{x}/{y}.png"
    }
};

export function addHazardLayers(map) {
    Object.keys(hazardLayers).forEach(type => {
        const spec = hazardLayers[type];

        if (!map.getSource(spec.id)) {
            map.addSource(spec.id, {
                type: "raster",
                tiles: [spec.url],
                tileSize: 256,
                attribution: "© GSI ハザード"
            });
        }

        if (!map.getLayer(spec.id)) {
            map.addLayer({
                id: spec.id,
                type: "raster",
                source: spec.id,
                layout: { visibility: "none" },
                paint: { "raster-opacity": 0.75 }
            }, "gsi-bldg-outline");
        }
    });
}

export function toggleHazard(type, show) {
    const id = hazardLayers[type].id;
    if (!window.map.getLayer(id)) return;
    window.map.setLayoutProperty(id, "visibility", show ? "visible" : "none");
}
