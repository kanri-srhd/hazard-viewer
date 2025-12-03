# Implementation Roadmap  
**SRHD Hazard Viewer（Phase5-D → Phase9）  
実装ロードマップ（関数単位の実装時期 & 責務ガイド）**

本ドキュメントは、  
**Unified Data Layer（UDL）構造のもと、Segment5〜Phase9 の “どの関数をいつ埋めるか” を明示する公式ロードマップ**  
です。

全ファイルの責務分離（UI → DataBus → UDL → Engines → Storage → External）を維持したまま、  
段階的に実装を埋めていくための **長期開発計画** でもあります。

---

# 🧭 フェーズ一覧（2025〜2026ロードマップ）

| フェーズ | 内容 | 対象ファイル |
|---------|------|--------------|
| **Segment5** | 地番 × 農地 × UDL 統合 | parcel-loader / unified-layer |
| **Phase6** | 全国空容量モデル統一 / Hazard & Capacity 拡張 | capacity-engine / hazard-engine / indexeddb |
| **Phase7** | 地番PMTiles高速化 / 地番ビューア強化 | parcel-loader / unified-layer |
| **Phase8** | PDF → JSON 自動変換パイプライン（GitHub Actions） | tools/ / data/capacity |
| **Phase9** | 農地ナビ（eMAFF）ポリゴン統合 | engines/parcel-loader / data/ |

---

# ============================================================
# 📌 Segment5（現在の最優先）  
# **地番 × 農地 × UDL 統合フェーズ**
# ============================================================

このフェーズでは **“siteId（地番ID）の正規化” と “parcel-loader の本実装”** が中心。

---

## 🎯 目的  
- クリック地点から **正式な地番ID（lot-number）を生成**  
- PMTiles から地番ポリゴンを抽出  
- ParcelInfo を UDL に正しく流せるようにする  
- 農地区分（1種/2種/3種）を ParcelInfo.attributes に統合

---

## 🛠 実装対象関数（Segment5）

### **1. parcel-loader.js**
#### 実装する項目
- `loadParcel(siteId, location)`  
  - PMTiles → tile → polygon → 地番抽出  
  - 地番ID生成（lotNumber）  
  - 地目・農地区分を attributes に追加  
  - geometry（Polygon）を返す

#### TODO コメント内容（already inserted）
- Parcel polygon lookup from PMTiles  
- Generate official parcel ID  
- Add farmland classification  

---

### **2. unified-layer.js**
#### 実装する項目
- `parcel/select` → `loadParcel()` の呼び出し  
- siteId / parcel.label の整合性  
- snapshot.meta に行政区コード（pref/city）の追加（任意）

#### 反映ポイント
- ParcelInfo が揃うため snapshot の parcel 部分を本実装に置換  

---

### **3. ui-init.js**
#### 実装ではなく UI 追加
- 「地番」「農地」のタブ or セクション追加  
（ロジックは一切 UI に持たせない）

---

# ============================================================
# 📌 Phase6  
# **全国空容量モデル統一 / Hazard & Capacity 拡張**
# ============================================================

このフェーズでは空容量ロジックの本体が動き始める。

---

## 🎯 目的  
- TEPCOモデル → 全国電力会社にハンドリング可能な統一構造へ  
- 新しい fields：  
  - N-1 容量  
  - 上位系統考慮（upstream constrained）  
  - 配電区間判定  
- HazardEngine に追加のレイヤー対応  
  - 内水  
  - 高潮  
  - 雪崩  
  - 新土砂フォーマット

---

## 🛠 実装対象関数（Phase6）

### **1. capacity-engine.js**
#### 実装する項目
- `evaluateCapacity(location)`
  - 全国PDF/CSVを統合した capacity.json を読み込む
  - 最寄り変電所（OSM）との JOIN
  - reverseCapacity / nMinus1 / upstreamConstrainedKw を返す  
  - 配電区（EHV / HV / LV）を解析

---

### **2. hazard-engine.js**
#### 実装する項目
- `evaluateHazard(location)`
  - metadata_light.xml の全部のレイヤーをマッピング  
  - depth / duration を HazardSummary に変換  
  - Landslide / Flood / Tsunami / Liquefaction を完全実装  
  - HazardTileRef 生成

---

### **3. indexeddb.js**
#### 実装する項目
- DB version up → `hazardCache` `capacityCache` ストア追加  
- snapshot 更新形式を厳密化（meta.dataDate追加）

---

### **4. unified-layer.js**
#### 拡張
- meta に dataDate（hazard/capacityの元データ日付）を付与

---

# ============================================================
# 📌 Phase7  
# **PMTiles高速化 / 地番ビューア強化フェーズ**
# ============================================================

PMTiles を本格活用するフェーズ。

---

## 🎯 目的  
- PMTiles の tile-level cache  
- 大規模地番検索の高速化  
- 地番ビューア連携強化（Polygon 描画など）

---

## 🛠 実装対象関数（Phase7）

### **1. parcel-loader.js**
- PMTiles の range-query を導入  
- tile 内検索を spatial-index 化  
- geometry の簡略化（DouglasPeucker）

---

### **2. map-init.js / ui-init.js**
- 地番の強調表示（hover / click outline）  
- 建物/地番/PMTiles 本体の切替UI

---

# ============================================================
# 📌 Phase8  
# **PDF → JSON 自動変換パイプライン（GitHub Actions）**
# ============================================================

## 🎯 目的  
- 毎日 5:00 に GitHub Actions で空容量 PDF を取り込み → JSON 自動生成  
- 手動作業ゼロ化  
- 全国版 capacity.json を自動更新

---

## 🛠 実装対象（Phase8）

### **tools/**  
- `capacity-pdf-parser.js`  
- `capacity-json-merger.js`  

### **.github/workflows/**  
- `capacity-update.yml`（PDF → JSON 自動化）

---

# ============================================================
# 📌 Phase9  
# **農地ナビ（eMAFF）ポリゴン統合フェーズ**
# ============================================================

## 🎯 目的  
- eMAFF農地ナビの農地多角形データを ParcelLoader に統合  
- 既存の地番 Polygon と農地 Polygon の overlay  
- UDL Snapshot に farmland 属性を正式に組み込む

---

## 🛠 実装対象関数（Phase9）

### **parcel-loader.js**
- eMAFF API（または shapefile / GeoJSON）読み込み  
- 地番 polygon と農地 polygon の AND 判定  
- farmland タグを attributes に反映

---

# ============================================================
# 🎯 補足：実装の優先度（全体版）
# ============================================================

| 優先度 | 項目 |
|-------|------|
| ★★★★★ | parcel-loader（地番ID・PMTiles統合） |
| ★★★★☆ | capacity-engine（全国空容量統一モデル） |
| ★★★☆☆ | hazard-engine（L1/L2判定 / 土砂 / 津波） |
| ★★★☆☆ | indexeddb（cache追加） |
| ★★☆☆☆ | map-ui統合（地番切替 / PMTiles UI） |
| ★☆☆☆☆ | 未来タスク（PDF→JSON / eMAFF） |

---

# ============================================================
# ✔ このロードマップの使い方
# ============================================================

### 1. 各フェーズ開始時  
対象ファイルの TODO を埋めていく。

### 2. AI に作業させるとき  
「Phase6 の X 部分を埋めて」と指定すれば  
正しい関数だけが実装され、依存関係が壊れない。

### 3. README / AIガイド と整合  
このロードマップは両者の“動く版”として機能する。

