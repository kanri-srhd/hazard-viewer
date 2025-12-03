// ======================================================================
// map-init.js - 地図の初期化（GSI標準地図・航空写真 + parcel/select 発火）
// ======================================================================
//
// [TODO (JP)]
// - Segment5: siteId を「地番ID」に置き換える（住所/地名ベースではなく正式地番）
// - Phase7 : ベースマップの切替（標準地図 / 航空写真 / 混合）のUI追加
//
// [TODO (EN)]
// - Segment5: Replace siteId with parcel ID (official lot number)
// - Phase7 : Add base-map toggles (standard/photo/mix)
// ======================================================================

import { emit } from "./bus.js";

/**
 * MapLibre の初期化
 * Initialize MapLibre with GSI standard map & aerial photo, and emit parcel/select on click.
 */
export function initMap() {
  const map = new maplibregl.Map({
    container: "map",
    localIdeographFontFamily:
      "Meiryo, Yu Gothic UI, MS PGothic, Segoe UI Symbol",
    style: {
      version: 8,
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      sources: {
        "gsi-std": {
          type: "raster",
          tiles: [
            "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: "© GSI",
        },
      },
      layers: [{ id: "gsi-base", type: "raster", source: "gsi-std" }],
    },
    center: [139.7528, 35.685],
    zoom: 9,
  });

  // 航空写真レイヤー追加
  map.on("load", () => {
    map.addSource("gsi-photo", {
      type: "raster",
      tiles: [
        "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
      ],
      tileSize: 256,
    });
    map.addLayer({
      id: "gsi-photo-layer",
      type: "raster",
      source: "gsi-photo",
      layout: { visibility: "visible" },
      paint: { "raster-opacity": 0.8 },
    });
  });

  // クリックイベント → parcel/select を発火
  map.on("click", (e) => {
    // TODO(JP): siteId を「地番ID」に置換（Segment5）
    // TODO(EN): Replace siteId with official parcel ID in Segment5
    const siteId = `site-${Date.now()}`;

    emit("parcel/select", {
      siteId,
      location: e.lngLat,
    });
  });

  return map;
}

// ⚠ 禁止事項 / DO NOT:
// - このファイルでハザード/空容量の判定ロジックを書かない
// - IndexedDB や外部APIにアクセスしない
//   （Storage / Engines レイヤー経由で処理すること）
// - UI（DOM）操作をここに書かないこと
//   （UI操作は viewer/ui/ 以下に限定すること）