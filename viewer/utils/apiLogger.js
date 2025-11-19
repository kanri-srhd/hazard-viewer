// =======================================
// apiLogger.js
// API呼び出しのログ & レート制限
// Zenrin / NTT 商用API対応
// =======================================

// ---------------------------------------
// API呼び出しログ
// ---------------------------------------
export function logApiCall(endpoint, params, status) {
    const ts = new Date().toISOString();
    console.log(`[API][${ts}] ${endpoint}`, params, "STATUS:", status);

    // 将来：
    // - S3にPUT
    // - BigQueryにINSERT
    // - ログサーバーにPOST など拡張可能
}

// ---------------------------------------
// 簡易レート制限（ms単位）
// ---------------------------------------
let lastCall = 0;

export function throttleApiCall(waitMs = 150) {
    const now = Date.now();
    if (now - lastCall < waitMs) {
        return false;  // 呼び出し不可
    }
    lastCall = now;
    return true;       // 呼び出しOK
}

// ---------------------------------------
// APIコールラッパ（推奨使用）
// ---------------------------------------
export async function callApi(endpoint, params = {}, waitMs = 150) {
    if (!throttleApiCall(waitMs)) {
        console.warn("[API] Throttled:", endpoint);
        return null;
    }

    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${endpoint}?${qs}` : endpoint;

    const res = await fetch(url);
    logApiCall(endpoint, params, res.status);

    if (!res.ok) {
        throw new Error(`API error ${res.status}: ${url}`);
    }

    return res.json();
}
