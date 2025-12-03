// ======================================================================
// parcel-loader.js - Parcel Loader（地番情報取得）
// ======================================================================
//
// [TODO (JP)]
// - Segment5: PMTiles から対象タイルを開き、クリック地点に対応する地番ポリゴンを抽出
// - Segment5: 住所/地名から siteId（地番ID）を生成するロジックの雛形を実装
// - Phase6 : 地番 → 行政区コード（都道府県コード/市区町村コード）への正規化
//
// [TODO (EN)]
// - Segment5: Fetch parcel polygon from PMTiles around clicked location
// - Segment5: Implement a basic rule to generate siteId (parcel ID) from address/label
// - Phase6 : Normalize parcel info to admin codes (pref/city etc.)
// ======================================================================

/**
 * Parcel のロード（ダミー実装）
 * Load parcel info for given siteId and location.
 *
 * @param {string} siteId
 * @param {{lng:number, lat:number}} location
 * @returns {Promise<object>} ParcelInfo-like object
 */
export async function loadParcel(siteId, location) {
  // TODO(JP): PMTiles もしくは GeoJSON から、クリック地点を含むポリゴンを検索
  // TODO(EN): Query PMTiles or GeoJSON for polygon containing the clicked point

  console.debug("[parcel-loader] loadParcel (stub)", siteId, location);

  return {
    label: `Site ${siteId}`, // TODO: 地番表記に置き換える（Segment5）
    landUse: "unknown",      // TODO: 農地/宅地 等の地目を反映
    geometry: null,
    attributes: {},
  };
}

// ⚠ 禁止事項 / DO NOT:
// - UnifiedLayer のロジック（Hazard/Capacity 結合）をここに書かない
// - UI/DOM を操作しない
// - IndexedDB の操作を追加しない
