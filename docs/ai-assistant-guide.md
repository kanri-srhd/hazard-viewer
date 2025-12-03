# AI Assistant Guide  
**（AIアシスタント向け補助ドキュメント / Version 1.0 / 2025-12 Segment4 完成版）**

このドキュメントは、このリポジトリを操作・改修する  
**AI アシスタント（ChatGPT / Claude / Gemini / Copilot など）**  
のための「追加前提」「禁止事項」「UDLアーキテクチャ」「作業テンプレート」をまとめたものです。

README は“人間開発者向け”のため、AI は **本ファイルを最優先**で参照してください。

---

# 1. プロジェクト概要（AI向け）

本プロジェクトは、  
**系統用蓄電池（BESS）用地の評価に必要な「ハザード × 地番 × 空容量 × 農地」情報を、ブラウザ上で高速可視化する GIS Viewer（MapLibre ベース）** を構築するものです。

### 主なデータソース

- **GSI**：重ねるハザードマップ WMTS  
- **電力会社（例：TEPCO）**：空容量マップ PDF/CSV（日次更新）  
- **OSM（OpenStreetMap）**：送電線・変電所  
- **PMTiles**：地番ポリゴン  
- **IndexedDB**：農地パネル入力データ

---

# 2. データソースの前提と制限（AI必読）

## 2.1 GSI ハザード（WMTS）

- **正しいレイヤー識別子を使用：**  
  metadata_light.xml の `<ows:Identifier>` のみ使用。省略形や他サイトの ID を引用しない。
- **凡例や色分けの改変禁止：**  
  GSI 公式凡例に完全準拠。
- **ズーム制限を守る：**  
  例：z4〜 のみ表示可能なレイヤーは hazardMatrix.js に反映。

## 2.2 電力会社「空容量マップ」

（TEPCO「空容量マッピング利用上の留意点」に準拠）

- **逆潮流側（売電方向）のみ：**  
  順潮流（充電方向）の容量は含まない。
- **色の意味は“出力制御可能性”：**  
  緑・赤・青・ピンク・紫はいずれも安全度ではない。意味づけの創作禁止。
- **「増強予定」の扱い：**  
  3年以内の増強系統は負担金遡りの可能性あり。UI 凡例に反映する場合は備考も必ず表示。
- **過去空容量マップは取得不可：**  
  電力会社の非公開方針。履歴保持が必要なら自前のみ。
- **最新データ確認の強制：**  
  README 記載の「各電力会社の最新データをご確認ください」に従う。

---

# 3. ディレクトリ構成（AI向け注意点）

- **viewer/**  
  UI、レイヤー追加、UDL、Engines、Storage のメイン領域
- **data/**  
  hazardMatrix / powerMatrix / geojson / capacity JSON ファイル
- **tools/**  
  生成スクリプト（hazardMatrix-generator.js 等）

- **原則：** viewer/main.js を肥大化させない  
- **分割：** 責務別ファイル分割（Phase4.3 Cプラン）を遵守

具体的な責務配置：

- **map-init.js：** 地図初期化  
- **ui-init.js：** UI コントロール  
- **unified-layer.js：** 統合レイヤー（UDL）  
- **engines/**：外部データ取得と計算  
- **storage/**：IndexedDB アクセス  
- **bus.js：** EventEmitter

---

# 4. AIアシスタントが絶対に守るべきルール（UDL最新版）

## UDL アーキテクチャ（2025-12）

**依存方向は必ず以下に従う：**

```txt
UI -> DataBus -> UnifiedLayer -> Engines -> External
UnifiedLayer -> Storage
```

つまり **単方向のみ許可**。逆方向はすべて禁止。

## 4.1 UI Layer（viewer/map-init.js / viewer/ui-init.js）

- **Allowed（許可）：**  
  - GSI 標準地図の表示  
  - 航空写真レイヤーの組み込み  
  - Google Maps 風 UI コントロール生成  
  - 地図クリック → `parcel/select` を emit  
  - `unified/snapshot-updated` を購読して情報パネルに表示
- **Forbidden（禁止）：**  
  - hazard-engine, capacity-engine を import  
  - unified-layer を import  
  - IndexedDB を import  
  - GSI WMTS を直接 fetch  
  - 空容量 JSON を直接参照  
  - UI 内にビジネスロジックを実装

UI レイヤーは見た目とユーザー操作のみ担当。

## 4.2 DataBus（viewer/bus.js）

- **Allowed：** イベント発火・購読のみ  
- **Forbidden：** ロジック、状態保持、IndexedDB や外部 API へのアクセス

DataBus は純粋な EventEmitter。

## 4.3 UnifiedLayer（viewer/unified/unified-layer.js）

- **Allowed：**  
  - Parcel / Hazard / Capacity の統合  
  - Engines への処理依頼  
  - `snapshot-updated` を emit  
  - IndexedDB への save/load  
  - dataDate の鮮度チェック
- **Forbidden：**  
  - UI を操作  
  - 地図を触る  
  - 外部 API を直接叩く  
  - hazard-engine / capacity-engine の処理を持つ

UnifiedLayer は Viewer の「頭脳」。UI と Engines の橋渡し役に徹する。

## 4.4 Engines（viewer/engines/*.js）

- **Allowed：**  
  - hazard-engine → GSI WMTS を読み取りハザード判定  
  - capacity-engine → 空容量 JSON + OSM の JOIN  
  - parcel-loader → PMTiles / GeoJSON のロード
- **Forbidden：**  
  - UI を操作  
  - DOM を触る  
  - IndexedDB を直接触る  
  - 他エンジンの責務を奪う

Engines は「外部データの取得と計算処理」のみ。

## 4.5 Storage Layer（viewer/storage/indexeddb.js）

- **Allowed：** UDL による save/get のみ  
- **Forbidden：** UI から直接呼び出し、Engines から直接呼び出し

Storage は受動的キャッシュレイヤー。

---

# 🔒 グローバル禁止事項（AI向け絶対ルール）

```txt
UI        -> Engines        禁止
Engines   -> UI             禁止
Engines   -> Storage        禁止
Storage   -> Engines        禁止
UI        -> External       禁止
UnifiedLayer -> UI          禁止

Allowed:
UI -> DataBus -> UnifiedLayer -> Engines -> External
UnifiedLayer -> Storage
```

---

# 5. テンプレート（AIが回答生成時に使用）

## 5.1 hazardMatrix.js 再生成テンプレ

```
以下を前提に hazardMatrix.js を再生成してください：

- docs/ai-assistant-guide.md のハザード仕様をすべて遵守
- metadata_light.xml の正式識別子・URLを使用
- レイヤーは洪水/内水/高潮/津波/土砂/雪崩をカテゴリ構造で整理
- zoom レベル制限を反映（z4〜 など）
```

## 5.2 UI 改善テンプレ

```
Google Maps 風 UI に準拠しながら viewer/ui-init.js を改修。
以下を必ず守ること：

- スケールは左下配置（GSI風）
- ゴミ箱 > ズーム > 現在地ボタン の縦並び
- hazardパネルはカテゴリごとに反転スイッチ
- UIにロジックを持たせない
- ファイルは ui-init.js のみを触る。他に影響させない
```

## 5.3 コード生成時の注意

- **ES Modules を正しく使用**  
- **import は相対パスで正しく**  
- **省略せず実際に動くコードを書く**  
- **コメントで責務を明記**  
- **再生成しても壊れない idempotent 構造にする**

---

# 6. フェーズ管理（Phase5-D）

| Segment  | 内容 |
|----------|------|
| Segment1 | 仕様整理 |
| Segment2 | hazardMatrix 再生成 |
| Segment3 | UI刷新 |
| Segment4 | UDL（農地×地番×ハザード×空容量）統合 ← 今ここ |
| Segment5 | 地番/農地の UDL 統合強化 |
| Phase6〜9 | 全国空容量モデル / 農地ナビ / PMTiles 高速化 / 自動パイプライン |

AI は必ず「いまどのフェーズなのか？」を意識して回答すること。

---

# 7. ライセンス・利用データの注意

- **GSI：** 使用条件あり（必ず原典に従う）  
- **電力会社：** 引用の範囲内で使用（再配布不可）  
- **データ扱い：** 機微情報を含む可能性に留意し、慎重に扱うこと
