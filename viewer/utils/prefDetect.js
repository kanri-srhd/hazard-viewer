// ======================================================
// prefDetect.js
// 座標 → 都道府県コード変換（逆ジオコーディング）
// GSI API + 都道府県名→JISコード変換
// ======================================================

// ------------------------------------------------------
// 都道府県名 → JIS X 0402 コード対応表
// ------------------------------------------------------
const PREF_NAME_TO_CODE = {
    "北海道": 1,
    "青森県": 2,
    "岩手県": 3,
    "宮城県": 4,
    "秋田県": 5,
    "山形県": 6,
    "福島県": 7,
    "茨城県": 8,
    "栃木県": 9,
    "群馬県": 10,
    "埼玉県": 11,
    "千葉県": 12,
    "東京都": 13,
    "神奈川県": 14,
    "新潟県": 15,
    "富山県": 16,
    "石川県": 17,
    "福井県": 18,
    "山梨県": 19,
    "長野県": 20,
    "岐阜県": 21,
    "静岡県": 22,
    "愛知県": 23,
    "三重県": 24,
    "滋賀県": 25,
    "京都府": 26,
    "大阪府": 27,
    "兵庫県": 28,
    "奈良県": 29,
    "和歌山県": 30,
    "鳥取県": 31,
    "島根県": 32,
    "岡山県": 33,
    "広島県": 34,
    "山口県": 35,
    "徳島県": 36,
    "香川県": 37,
    "愛媛県": 38,
    "高知県": 39,
    "福岡県": 40,
    "佐賀県": 41,
    "長崎県": 42,
    "熊本県": 43,
    "大分県": 44,
    "宮崎県": 45,
    "鹿児島県": 46,
    "沖縄県": 47
};

// ------------------------------------------------------
// 座標から都道府県コードを判定
// ------------------------------------------------------
export async function detectPrefCodeFromLonLat(lon, lat) {
    try {
        // GSI 住所検索API（逆ジオコーディング）
        const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?lon=${lon}&lat=${lat}`;
        
        console.log(`[prefDetect] Requesting: ${url}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            console.warn(`[prefDetect] API error: ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        
        // レスポンス構造確認
        if (!data || data.length === 0) {
            console.warn(`[prefDetect] No address found for [${lon}, ${lat}]`);
            return null;
        }
        
        // 都道府県名を取得（複数パターンに対応）
        const firstResult = data[0];
        const address = firstResult.properties?.title || 
                       firstResult.properties?.address || 
                       "";
        
        console.log(`[prefDetect] Address: ${address}`);
        
        // 都道府県名を抽出（最初にマッチした都道府県名を採用）
        for (const [prefName, code] of Object.entries(PREF_NAME_TO_CODE)) {
            if (address.includes(prefName)) {
                console.log(`[prefDetect] ✓ Found: ${prefName} (code: ${code})`);
                return code;
            }
        }
        
        console.warn(`[prefDetect] Prefecture not found in address: ${address}`);
        return null;
        
    } catch (error) {
        console.error(`[prefDetect] Error detecting prefecture:`, error);
        return null;
    }
}
