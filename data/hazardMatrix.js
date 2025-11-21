// Auto-generated from metadata_light.xml
// GSI公式サブフォルダ構造準拠版

export const hazardMatrix = {
  "flood_l2_shinsuishin": {
    title: "洪水浸水想定区域（想定最大規模）",
    id: "flood_l2_shinsuishin",
    directory: "01/flood_l2_shinsuishin",
    template: "https://disaportaldata.gsi.go.jp/raster/01/flood_l2_shinsuishin/{z}/{x}/{y}.png",
    prefOrData: "pref-or-data",
    isPrefBased: true,
    fallbackToNational: true,
    minzoom: 2,
    maxzoom: 17
  },
  "flood_keikaku": {
    title: "洪水浸水想定区域（計画規模）",
    id: "flood_keikaku",
    directory: "02/flood_l2_keikakukibo",
    template: "https://disaportaldata.gsi.go.jp/raster/02/flood_l2_keikakukibo/{z}/{x}/{y}.png",
    prefOrData: "pref-or-data",
    isPrefBased: true,
    fallbackToNational: true,
    minzoom: 2,
    maxzoom: 17
  },
  "sediment_keikai": {
    title: "土砂災害警戒区域（急傾斜地の崩壊）",
    id: "sediment_keikai",
    directory: "03/sediment_keikai",
    template: "https://disaportaldata.gsi.go.jp/raster/03/sediment_keikai/{z}/{x}/{y}.png",
    prefOrData: "pref-or-data",
    isPrefBased: false,
    fallbackToNational: false,
    minzoom: 2,
    maxzoom: 17
  },
  "tsunami_newlegend": {
    title: "津波浸水想定",
    id: "tsunami_newlegend",
    directory: "05/tsunami_newlegend",
    template: "https://disaportaldata.gsi.go.jp/raster/05/tsunami_newlegend/{z}/{x}/{y}.png",
    prefOrData: "pref-or-data",
    isPrefBased: false,
    fallbackToNational: false,
    minzoom: 2,
    maxzoom: 17
  },
  "takashio_soutei": {
    title: "高潮浸水想定区域",
    id: "takashio_soutei",
    directory: "06/takashio_soutei",
    template: "https://disaportaldata.gsi.go.jp/raster/06/takashio_soutei/{z}/{x}/{y}.png",
    prefOrData: "pref-or-data",
    isPrefBased: false,
    fallbackToNational: false,
    minzoom: 2,
    maxzoom: 17
  },
  "jishin_kyouka": {
    title: "地震防災対策強化地域",
    id: "jishin_kyouka",
    directory: "07/jishin_kyouka",
    template: "https://disaportaldata.gsi.go.jp/raster/07/jishin_kyouka/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 2,
    maxzoom: 17
  },
  "road_kansui": {
    title: "道路冠水想定箇所",
    id: "road_kansui",
    directory: "08/road_kansui",
    template: "https://disaportaldata.gsi.go.jp/raster/08/road_kansui/{z}/{x}/{y}.png",
    prefOrData: "pref-or-data",
    isPrefBased: false,
    fallbackToNational: false,
    minzoom: 2,
    maxzoom: 17
  },
  "mlit_liquefaction": {
    title: "液状化（MLIT全国）",
    id: "mlit_liquefaction",
    directory: "liquefaction",
    template: "https://disaportal.mlit.go.jp/raster/liquefaction/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 2,
    maxzoom: 17
  }
};
