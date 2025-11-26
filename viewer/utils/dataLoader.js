// ===============================================
// dataLoader.js
// データロード抽象化レイヤー
// JSON / GeoJSON / PMTiles / API / MVT を統一的に扱う
// ===============================================

import { resolveDataPath } from './pathResolver.js';

// PMTiles の読み込みサポート（将来用）
let PMTilesLib = null;
try {
    PMTilesLib = await import("pmtiles").then(m => m.PMTiles);
} catch (e) {
    console.warn("PMTiles module not found (これは正常です)");
}

// -----------------------------------------------
// loadData(sourceSpec)
// -----------------------------------------------
// sourceSpec 例：
// { type: "json", url: "/data/hazard/osaka_flood.json" }
// { type: "pmtiles", url: "/data/jiban/pmtiles/japan.pmtiles" }
// { type: "api", endpoint: "...", params: {...} }
// { type: "mvt", url: "https://example/tiles/{z}/{x}/{y}.mvt" }
export async function loadData(sourceSpec) {
    if (!sourceSpec || !sourceSpec.type)
        throw new Error("loadData(): sourceSpec.type が指定されていません");

    switch (sourceSpec.type) {

        // -------------------------------
        // 静的JSON or GeoJSON
        // -------------------------------
        case "json":
        case "geojson":
            // 相対パス(../data/...)の場合は pathResolver で解決
            // 絶対パスまたはhttpで始まる場合はそのまま使用
            let fetchUrl = sourceSpec.url;
            if (fetchUrl.startsWith('../data/')) {
                fetchUrl = resolveDataPath(fetchUrl.replace('../data/', ''));
            } else if (fetchUrl.startsWith('./data/') || (!fetchUrl.startsWith('/') && !fetchUrl.startsWith('http'))) {
                // './data/xxx' または相対パス（http/httpsでない）はそのまま使用
                // ※ powerline.js等が resolveDataPath() を既に適用済みの場合はここに来る
            }
            
            const res = await fetch(fetchUrl);
            if (!res.ok) {
                console.warn("[loadData] JSON取得失敗:", fetchUrl, res.status);
                return null;
            }
            const contentType = res.headers.get("content-type") || "";
            if (contentType.includes("text/html")) {
                console.warn("[loadData] HTMLが返ってきたためJSONとみなせません:", fetchUrl);
                return null;
            }
            return await res.json();

        // -------------------------------
        // PMTiles（VectorTileデータ）
        // -------------------------------
        case "pmtiles":
            if (!PMTilesLib) {
                throw new Error("PMTiles library not loaded");
            }
            const pm = new PMTilesLib(sourceSpec.url);
            return pm;  // 呼び出し側で addProtocol して使う

        // -------------------------------
        // API 呼び出し（Zenrin / NTT 用）
        // -------------------------------
        case "api":
            const qs = sourceSpec.params
                ? "?" + new URLSearchParams(sourceSpec.params).toString()
                : "";

            const endpoint = sourceSpec.endpoint + qs;
            console.log("[API] Request:", endpoint);

            const apiRes = await fetch(endpoint);

            if (!apiRes.ok) {
                throw new Error(`API error ${apiRes.status}: ${endpoint}`);
            }

            return await apiRes.json();

        // -------------------------------
        // VectorTile (MVT) サーバ
        // -------------------------------
        case "mvt":
            return {
                type: "vector",
                tiles: [sourceSpec.url],
                minzoom: sourceSpec.minzoom ?? 0,
                maxzoom: sourceSpec.maxzoom ?? 14
            };

        default:
            throw new Error("loadData(): Unknown type " + sourceSpec.type);
    }
}
