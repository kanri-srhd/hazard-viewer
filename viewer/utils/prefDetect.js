// ======================================================
// prefDetect.js
// 都道府県ポリゴン判定モジュール
// Ray-casting法による高精度Point-in-Polygon判定
// ======================================================

import { PREF_POLYGONS } from "./pref_polygons.js";

/**
 * Ray-casting法によるPoint-in-Polygon判定
 * @param {number} lat - 緯度
 * @param {number} lon - 経度
 * @param {Array<Array<number>>} polygon - [[lat,lon], ...] 形式のポリゴン
 * @returns {boolean} - ポリゴン内ならtrue
 */
function pointInPolygon(lat, lon, polygon) {
    let inside = false;
    const n = polygon.length;
    
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const latI = polygon[i][0];
        const lonI = polygon[i][1];
        const latJ = polygon[j][0];
        const lonJ = polygon[j][1];
        
        const intersect = ((lonI > lon) !== (lonJ > lon)) &&
            (lat < (latJ - latI) * (lon - lonI) / (lonJ - lonI) + latI);
        
        if (intersect) inside = !inside;
    }
    
    return inside;
}

/**
 * 座標から都道府県を判定
 * @param {number} lat - 緯度
 * @param {number} lon - 経度
 * @returns {string|null} - 都道府県コード "01"〜"47" または null
 */
export function detectPrefecture(lat, lon) {
    // 日本の範囲外は即座に除外
    if (lat < 24 || lat > 46 || lon < 122 || lon > 154) {
        return null;
    }
    
    for (const pref of PREF_POLYGONS) {
        // 1. BBox による高速フィルタリング
        if (lat < pref.bbox.minLat || lat > pref.bbox.maxLat ||
            lon < pref.bbox.minLon || lon > pref.bbox.maxLon) {
            continue;
        }
        
        // 2. 各ポリゴンで判定（離島対応）
        for (const polygon of pref.polygons) {
            if (pointInPolygon(lat, lon, polygon)) {
                return pref.code;
            }
        }
    }
    
    return null;
}

/**
 * 都道府県名を取得
 * @param {string} code - 都道府県コード
 * @returns {string|null} - 都道府県名
 */
export function getPrefectureName(code) {
    const pref = PREF_POLYGONS.find(p => p.code === code);
    return pref ? pref.name : null;
}
