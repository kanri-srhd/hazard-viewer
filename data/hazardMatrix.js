// ======================================================
// hazardMatrix.js
// Auto-generated from metadata_light.xml (GSI WMTS)
// NOTE:
//  - All GSI hazard layer IDs == ows:Identifier in metadata_light.xml
//  - directory / template / zoom range are taken directly from ResourceURL
//  - DO NOT hand-edit URLs or zoom values; update metadata_light.xml instead.
// ======================================================

export const hazardMatrix = {
  // --------------------------------------------------
  // 洪水浸水想定区域（想定最大規模：L2）
  // --------------------------------------------------
  "flood_l2_shinsuishin": {
    id: "flood_l2_shinsuishin",
    title: "洪水浸水想定区域（想定最大規模）",
    directory: "01_flood_l2_shinsuishin_data",
    template:
      "https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 2,
    maxzoom: 17,
    metadata: {
      title: "洪水浸水想定区域（想定最大規模）",
      hazardGroup: "flood",
      hazardSubGroup: "L2",
      coverage: "unknown",
      prefCode: null,
      matrixSet: "z2to17"
    }
  },

  "flood_l2_shinsuishin_kuni": {
    id: "flood_l2_shinsuishin_kuni",
    title: "洪水浸水想定区域（想定最大規模）_国管理河川",
    directory: "01_flood_l2_shinsuishin_kuni_data",
    template:
      "https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_kuni_data/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 2,
    maxzoom: 17,
    metadata: {
      title: "洪水浸水想定区域（想定最大規模）_国管理河川",
      hazardGroup: "flood",
      hazardSubGroup: "L2",
      coverage: "kuni",
      prefCode: null,
      matrixSet: "z2to17"
    }
  },

  // --------------------------------------------------
  // 洪水浸水想定区域（計画規模：L1・現在の凡例）
  // --------------------------------------------------
  "flood_l1_shinsuishin_newlegend": {
    id: "flood_l1_shinsuishin_newlegend",
    title: "洪水浸水想定区域（計画規模（現在の凡例））",
    directory: "01_flood_l1_shinsuishin_newlegend_data",
    template:
      "https://disaportaldata.gsi.go.jp/raster/01_flood_l1_shinsuishin_newlegend_data/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 2,
    maxzoom: 17,
    metadata: {
      title: "洪水浸水想定区域（計画規模（現在の凡例））",
      hazardGroup: "flood",
      hazardSubGroup: "L1",
      coverage: "unknown",
      prefCode: null,
      matrixSet: "z2to17"
    }
  },

  "flood_l1_shinsuishin_newlegend_kuni": {
    id: "flood_l1_shinsuishin_newlegend_kuni",
    title: "洪水浸水想定区域（計画規模（現在の凡例））_国管理河川",
    directory: "01_flood_l1_shinsuishin_newlegend_kuni_data",
    template:
      "https://disaportaldata.gsi.go.jp/raster/01_flood_l1_shinsuishin_newlegend_kuni_data/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 2,
    maxzoom: 17,
    metadata: {
      title:
        "洪水浸水想定区域（計画規模（現在の凡例））_国管理河川",
      hazardGroup: "flood",
      hazardSubGroup: "L1",
      coverage: "kuni",
      prefCode: null,
      matrixSet: "z2to17"
    }
  },

  // --------------------------------------------------
  // 浸水継続時間（想定最大規模：L2）
  // --------------------------------------------------
  "flood_l2_keizoku": {
    id: "flood_l2_keizoku",
    title: "浸水継続時間（想定最大規模）",
    directory: "01_flood_l2_keizoku_data",
    template:
      "https://disaportaldata.gsi.go.jp/raster/01_flood_l2_keizoku_data/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 2,
    maxzoom: 17,
    metadata: {
      title: "浸水継続時間（想定最大規模）",
      hazardGroup: "flood",
      hazardSubGroup: "duration",
      coverage: "unknown",
      prefCode: null,
      matrixSet: "z2to17"
    }
  },

  "flood_l2_keizoku_kuni": {
    id: "flood_l2_keizoku_kuni",
    title: "浸水継続時間（想定最大規模）_国管理河川",
    directory: "01_flood_l2_keizoku_kuni_data",
    template:
      "https://disaportaldata.gsi.go.jp/raster/01_flood_l2_keizoku_kuni_data/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 2,
    maxzoom: 17,
    metadata: {
      title: "浸水継続時間（想定最大規模）_国管理河川",
      hazardGroup: "flood",
      hazardSubGroup: "duration",
      coverage: "kuni",
      prefCode: null,
      matrixSet: "z2to17"
    }
  },

  // --------------------------------------------------
  // 家屋倒壊等氾濫想定区域（氾濫流・河岸侵食）L2
  //   ※ TileMatrixSet = z4to17 → minzoom = 4
  // --------------------------------------------------
  "flood_l2_kaokutoukai_hanran": {
    id: "flood_l2_kaokutoukai_hanran",
    title: "家屋倒壊等氾濫想定区域（氾濫流）",
    directory: "01_flood_l2_kaokutoukai_hanran_data",
    template:
      "https://disaportaldata.gsi.go.jp/raster/01_flood_l2_kaokutoukai_hanran_data/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 4,
    maxzoom: 17,
    metadata: {
      title: "家屋倒壊等氾濫想定区域（氾濫流）",
      hazardGroup: "flood",
      hazardSubGroup: "kaokutoukai_hanran",
      coverage: "unknown",
      prefCode: null,
      matrixSet: "z4to17"
    }
  },

  "flood_l2_kaokutoukai_hanran_kuni": {
    id: "flood_l2_kaokutoukai_hanran_kuni",
    title: "家屋倒壊等氾濫想定区域（氾濫流）_国管理河川",
    directory: "01_flood_l2_kaokutoukai_hanran_kuni_data",
    template:
      "https://disaportaldata.gsi.go.jp/raster/01_flood_l2_kaokutoukai_hanran_kuni_data/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 4,
    maxzoom: 17,
    metadata: {
      title: "家屋倒壊等氾濫想定区域（氾濫流）_国管理河川",
      hazardGroup: "flood",
      hazardSubGroup: "kaokutoukai_hanran",
      coverage: "kuni",
      prefCode: null,
      matrixSet: "z4to17"
    }
  },

  "flood_l2_kaokutoukai_kagan": {
    id: "flood_l2_kaokutoukai_kagan",
    title: "家屋倒壊等氾濫想定区域（河岸侵食）",
    directory: "01_flood_l2_kaokutoukai_kagan_data",
    template:
      "https://disaportaldata.gsi.go.jp/raster/01_flood_l2_kaokutoukai_kagan_data/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 4,
    maxzoom: 17,
    metadata: {
      title: "家屋倒壊等氾濫想定区域（河岸侵食）",
      hazardGroup: "flood",
      hazardSubGroup: "kaokutoukai_kagan",
      coverage: "unknown",
      prefCode: null,
      matrixSet: "z4to17"
    }
  },

  "flood_l2_kaokutoukai_kagan_kuni": {
    id: "flood_l2_kaokutoukai_kagan_kuni",
    title: "家屋倒壊等氾濫想定区域（河岸侵食）_国管理河川",
    directory: "01_flood_l2_kaokutoukai_kagan_kuni_data",
    template:
      "https://disaportaldata.gsi.go.jp/raster/01_flood_l2_kaokutoukai_kagan_kuni_data/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 4,
    maxzoom: 17,
    metadata: {
      title: "家屋倒壊等氾濫想定区域（河岸侵食）_国管理河川",
      hazardGroup: "flood",
      hazardSubGroup: "kaokutoukai_kagan",
      coverage: "kuni",
      prefCode: null,
      matrixSet: "z4to17"
    }
  },

  // --------------------------------------------------
  // 内水（雨水出水）浸水想定区域_統合版
  // --------------------------------------------------
  "naisui": {
    id: "naisui",
    title: "内水（雨水出水）浸水想定区域_統合版",
    directory: "02_naisui_data",
    template:
      "https://disaportaldata.gsi.go.jp/raster/02_naisui_data/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 2,
    maxzoom: 17,
    metadata: {
      title: "内水（雨水出水）浸水想定区域_統合版",
      hazardGroup: "flood",
      hazardSubGroup: "internal",
      coverage: "unknown",
      prefCode: null,
      matrixSet: "z2to17"
    }
  },

  // --------------------------------------------------
  // 高潮浸水想定区域（L2）_統合版
  // --------------------------------------------------
  "hightide_l2_shinsuishin": {
    id: "hightide_l2_shinsuishin",
    title: "高潮浸水想定区域_統合版",
    directory: "03_hightide_l2_shinsuishin_data",
    template:
      "https://disaportaldata.gsi.go.jp/raster/03_hightide_l2_shinsuishin_data/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 2,
    maxzoom: 17,
    metadata: {
      title: "高潮浸水想定区域_統合版",
      hazardGroup: "storm_surge",
      hazardSubGroup: "L2",
      coverage: "unknown",
      prefCode: null,
      matrixSet: "z2to17"
    }
  },

  // --------------------------------------------------
  // 津波浸水想定_統合版
  // --------------------------------------------------
  "tsunami_newlegend": {
    id: "tsunami_newlegend",
    title: "津波浸水想定_統合版",
    directory: "04_tsunami_newlegend_data",
    template:
      "https://disaportaldata.gsi.go.jp/raster/04_tsunami_newlegend_data/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 2,
    maxzoom: 17,
    metadata: {
      title: "津波浸水想定_統合版",
      hazardGroup: "tsunami",
      hazardSubGroup: null,
      coverage: "unknown",
      prefCode: null,
      matrixSet: "z2to17"
    }
  },

  // --------------------------------------------------
  // 土砂災害警戒区域_全国（3種）＋ 雪崩危険箇所_全国
  // --------------------------------------------------
  "dosekiryukeikaikuiki_all": {
    id: "dosekiryukeikaikuiki_all",
    title: "土砂災害警戒区域（土石流）_全国",
    directory: "05_dosekiryukeikaikuiki",
    template:
      "https://disaportaldata.gsi.go.jp/raster/05_dosekiryukeikaikuiki/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 2,
    maxzoom: 17,
    metadata: {
      title: "土砂災害警戒区域（土石流）_全国",
      hazardGroup: "landslide",
      hazardSubGroup: "debris_flow",
      coverage: "national",
      prefCode: null,
      matrixSet: "z2to17"
    }
  },

  "kyukeishakeikaikuiki_all": {
    id: "kyukeishakeikaikuiki_all",
    title: "土砂災害警戒区域（急傾斜地の崩壊）_全国",
    directory: "05_kyukeishakeikaikuiki",
    template:
      "https://disaportaldata.gsi.go.jp/raster/05_kyukeishakeikaikuiki/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 2,
    maxzoom: 17,
    metadata: {
      title: "土砂災害警戒区域（急傾斜地の崩壊）_全国",
      hazardGroup: "landslide",
      hazardSubGroup: "steepSlope",
      coverage: "national",
      prefCode: null,
      matrixSet: "z2to17"
    }
  },

  "jisuberikeikaikuiki_all": {
    id: "jisuberikeikaikuiki_all",
    title: "土砂災害警戒区域（地すべり）_全国",
    directory: "05_jisuberikeikaikuiki",
    template:
      "https://disaportaldata.gsi.go.jp/raster/05_jisuberikeikaikuiki/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 2,
    maxzoom: 17,
    metadata: {
      title: "土砂災害警戒区域（地すべり）_全国",
      hazardGroup: "landslide",
      hazardSubGroup: "jisuberi",
      coverage: "national",
      prefCode: null,
      matrixSet: "z2to17"
    }
  },

  "nadarekikenkasyo_all": {
    id: "nadarekikenkasyo_all",
    title: "雪崩危険箇所_全国",
    directory: "05_nadarekikenkasyo",
    template:
      "https://disaportaldata.gsi.go.jp/raster/05_nadarekikenkasyo/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 2,
    maxzoom: 17,
    metadata: {
      title: "雪崩危険箇所_全国",
      hazardGroup: "landslide",
      hazardSubGroup: "avalanche",
      coverage: "national",
      prefCode: null,
      matrixSet: "z2to17"
    }
  },

  // --------------------------------------------------
  // MLIT 液状化（外部 API）
  // --------------------------------------------------
  "mlit_liquefaction": {
    id: "mlit_liquefaction",
    title: "液状化（MLIT全国）",
    // MLIT API なので directory は不要
    directory: null,
    // ★ API キー入りの正式タイル URL（修正済）
    template:
      "https://disaportaldata.mlit.go.jp/raster/liquefaction/d309a51d157041eb93c01c75e809126b/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 2,
    maxzoom: 17,
    // 必要であれば opacity を直接定義
    opacity: 1.0,
    metadata: {
      title: "液状化（MLIT全国）",
      hazardGroup: "external",
      hazardSubGroup: "liquefaction_mlit",
      coverage: "national",
      prefCode: null,
      matrixSet: "z2to17"
    }
  }

}; // END of hazardMatrix

export default hazardMatrix;