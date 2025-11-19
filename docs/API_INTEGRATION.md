# API Integration Overview  
日本全国ハザード × 地番 × 送電網 × 空き容量 統合ビューア  
**Zenrin DataCom（11/19）・NTT Infranet（11/21） API連携の要件整理**

---

## 1. 目的
本ドキュメントは、以下データ/APIを統合ビューアへ統合するための  
**事前設計・商談メモ・導入設計テンプレート**である。

- 地番（parcel polygon）
- 建物輪郭（building polygon）
- 道路中心線（road centerline）
- 逆ジオコーディング
- 光ファイバー経路（fiber route）
- 電柱・支柱（poles）
- 地中インフラ（underground infra）
- 送電網情報（transmission lines）
- 空き容量（capacity）
- ハザード（hazard layers）

---

## 2. 各社 API 情報（ヒアリング項目）

### Zenrin DataCom（11/19）

#### ■ 提供データ
- 建物輪郭（building polygons）
- 地番面（parcel polygons）
- 道路形状（road network）
- 住所→地番 逆ジオコーディング
- ベクトルタイル (MVT) 提供有無

#### ■ ヒアリング事項
| 項目 | 確認内容 |
|------|----------|
| 提供形式 | GeoJSON / MVT / PMTiles 対応可否 |
| 地番精度 | 登記座標系 / メッシュ推定 / 既存地番図 |
| 更新頻度 | 日次 / 週次 / 月次 |
| 課金体系 | API課金 / タイル課金 / 月額固定 |
| レート制限 | RPM/TPS、Burst有無 |
| 認証方式 | API Key / OAuth2 / IP制限 |
| 商用利用 | システム内利用 / 外部公開可否 |
| オフライン利用 | PMTiles提供の有無 |

---

### NTT Infranet（11/21）

#### ■ 提供データ
- 光ファイバー経路（Fiber）
- 電柱位置（Poles）
- 地中化インフラ（Underground Facilities）
- 通信系統マップ（MVT可能性高い）

#### ■ ヒアリング事項
| 項目 | 確認内容 |
|------|----------|
| データ種類 | Fiber / Poles / Underground / MVT |
| 提供形式 | GeoJSON / MVT / Tile API |
| 課金方式 | API課金 / タイル課金 / 月額 |
| レート制限 | RPM/TPS |
| 認証 | API Key / Token |
| 逆引き | 座標→管路検索の可否 |
| 利用制約 | 公開地図での利用可否 |
| 更新頻度 | 日次 / 月次 / 四半期 |

---

## 3. viewer への統合方式（設計）

### 3-1. dataLoader.js によるデータ統合
API / GeoJSON / MVT / PMTiles の全形式を  
**sourceSpec.type** の切り替えだけで扱う。

```javascript
loadData({ type:"api", endpoint:"...", params:{...} })
loadData({ type:"mvt", url:"..." })
loadData({ type:"pmtiles", url:"..." })
```

### 3-2. layerSpec.js によるレイヤー仕様統一
API提供データは layerSpec で抽象化し、  
`source.type = "api"` に切り替えるだけで実装可能。

例：

```javascript
source: { 
    type: "api", 
    endpoint: "https://api.zenrin.co.jp/parcel",
    params: { lat, lng }
}
```

### 3-3. base.js による複数ベースレイヤー対応
- GSI 標準地図（デフォルト）
- Zenrin vector tiles（道路/建物）
- NTT MVT（通信インフラ）
- PMTiles 全国地番（キャッシュ/オフライン）

### 3-4. apiLogger.js によるロギング＆レート制限
API利用の証跡管理：
- タイムスタンプ
- エンドポイント
- パラメータ
- HTTPステータス

軽量レート制限：

```javascript
throttleApiCall(150) // ミリ秒
```

---

## 4. 実装後のテスト項目
- [ ] 座標クリック → API地番検索 → 地番ポリゴン描画
- [ ] 線形データ（Fiber, Road centerline）のスタイル確認
- [ ] PMTilesのZ/X/Yアクセス速度
- [ ] 商用APIのレート制限挙動テスト

---

## 5. TODO（商談後に埋める）
- [ ] API Key 管理方式
- [ ] 課金モデルとコスト試算
- [ ] APIレスポンスのサンプル保存
- [ ] viewer への実装スケジュール
- [ ] ダウンタイム考慮（フォールバックデータの要否）
