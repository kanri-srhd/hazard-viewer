# AI Assistant Guide (SRHD Hazard Viewer)
**Version 2.0 / 2025-12-04*

このドキュメントは、  
**SRHD Hazard Viewer プロジェクトで作業する AI アシスタント（ChatGPT等）専用の行動規範・事実集約ドキュメント** です。

> 🔴 最重要原則：  
> **「存在している事実を無視して、勝手な前提で走り出さない。」**

README / Implementation Roadmap / metadata_light.xml / akiyouryou_points_to_note.pdf / JS ファイル群 / ディレクトリ構造など、  
すでに存在しているソースを **必ず最優先** してください。

---

## 0. このガイドの位置づけと優先順位

- **README.md** … 人間開発者・社内メンバー向けの公式ドキュメント  
- **implementation-roadmap.md** … フェーズごとの実装計画  
- **metadata_light.xml** … GSI ハザード WMTS の公式仕様  
- **akiyouryou_points_to_note.pdf** … 空容量マップの利用上の留意点（電力会社の公式）  
- **本ファイル（ai-assistant-guide.md）** …  
  AI にとっての **「行動ルール＋事実の要約＋参照の優先順位」** を定めるドキュメント

AI は、**作業前に必ずこのガイドを前提に行動**しなければならない。

---

## 1. ゴールとプロジェクト概要（AI視点）

### 1.1 ゴール

- **系統用蓄電池（BESS）候補地の立地判断を、1つのビューア上で完結させる**
- 全国の候補地について：

  - ハザード（洪水 / 土砂 / 津波 / 液状化 など）
  - 地番（PMTiles）
  - 電力系統（送電線 / 変電所）
  - 空容量（逆潮流側）

  を **一括可視化・評価** できる GIS Viewer を構築する。

---

### 1.2 データソース（事実）

- **GSI（metadata_light.xml）**  
  - 公式 WMTS サービス  
  - 洪水 L1/L2 / 内水 / 高潮 / 津波 / 土砂 / 雪崩 など  
  - `<ows:Identifier>` がレイヤーIDの唯一の真実  
  - `ResourceURL` の template / TileMatrixSet / minzoom/maxzoom を持つ

- **電力会社（TEPCO 等）**  
  - 空容量マップ（PDF/CSV）  
  - 利用上の留意点は **akiyouryou_points_to_note.pdf** に記載  

- **OSM（OpenStreetMap / OpenInfraMap）**  
  - `powerlines_osm.geojson`：全国送電線（ref, voltage 等）  
  - `substations_points.geojson`：全国変電所（point）

- **PMTiles（将来）**  
  - 全国地番ポリゴン（parcel）  
  - Phase6〜7 で本格利用予定

---

## 2. ディレクトリ構造（事実）

※ Phase5-D 時点の基本構造。AI はこの構造を前提にパスを扱うこと。

```txt
hazard-viewer/
├── backup/
│   ├── index.html
│   ├── script.js
│   └── style.css
│
├── data/
│   ├── deprecated/
│   ├── hazardMatrix.js
│   ├── hazardMatrix.json
│   ├── metadata_light.xml
│   ├── powerMatrix.js
│   └── powerMatrix.json
│
├── docs/
│   ├── ai-assistant-guide.md
│   ├── API_INTEGRATION.md
│   ├── ARCHITECTURE.md
│   ├── implementation-roadmap.md
│   └── sandbox/
│       ├── maplibre-geojson-viewer.html
│       ├── maplibre-pmtiles-viewer.html
│       ├── pmtiles-viewer-national.html
│       └── pmtiles-viewer.html
│
├── tools/
│   ├── analyze_osm_substations.js
│   ├── build_capacity_json.py
│   ├── fetch_all_tepco_regions.js
│   ├── fetch_japan_boundary.js
│   ├── fetch_substation_points.js
│   ├── fetch_substation_polygons.js
│   ├── filter_capacity_japan_only.js
│   ├── filter_polygons_bbox.js
│   ├── generate_base_polygons_from_points.js
│   ├── generate_hazard_matrix.py
│   ├── generate_missing_substation_polygons.js
│   ├── generate_national_substation_points.js
│   ├── geocode_capacity_from_polygons.js
│   ├── geocode_regional_priority.js
│   ├── geo_locator.js
│   ├── grid_prepare.py
│   ├── hazardMatrix-generator.js
│   ├── HAZARD_MATRIX_GENERATOR_README.md
│   ├── hazard_merge.py
│   ├── jiban_convert_pmtiles.py
│   ├── merge_polygon_substations_to_capacity.js
│   ├── occto_parser.py
│   ├── osm_kanto_export.js
│   ├── osm_powerline_export.js
│   ├── osm_power_export.js
│   ├── osm_substation_polygons_export.js
│   ├── tepco_capacity_pdf_to_json.py
│   ├── fetchers/
│   │   ├── base.js
│   │   ├── chuden.js
│   │   ├── kepco.js
│   │   ├── kyuden.js
│   │   ├── README.md
│   │   └── tepco.js
│   └── schemas/
│       └── capacity_schema.json
│
├── viewer/
│   ├── index.html
│   ├── main.js
│   ├── map-init.js
│   ├── ui-init.js
│   ├── hazard-init.js
│   ├── power-init.js
│   ├── script.js
│   ├── style.css
│   ├── layer-ui.css
│   ├── style.json
│   │
│   ├── data/
│   │   ├── coordinate_cache.json
│   │   ├── name_aliases.json
│   │   ├── powerLineCapacity.json
│   │   ├── osm/
│   │   │   ├── powerlines_osm.geojson
│   │   │   ├── substations_osm.geojson
│   │   │   ├── substations_points.geojson
│   │   │   ├── substation_polygons_base.geojson
│   │   │   └── substation_polygons_filtered_backup.geojson
│   │   ├── tepco/
│   │   │   └── akiyouryou_kikan.pdf
│   │   └── capacity/
│   │       ├── national_substations_all.geojson
│   │       ├── sample_capacity.csv
│   │       ├── tepco_all_regions.json
│   │       ├── tepco_substations_all_matched.json
│   │       ├── tepco_substations_only.json
│   │       └── temp/
│   │           ├── csv_akiyouryou_chiba_hendensyo.csv
│   │           ├── csv_akiyouryou_chiba_soudensen.csv
│   │           ├── ...（略：全TEPCO地域CSV）
│   │           ├── tepco_chiba.zip
│   │           ├── tepco_fukushima.zip
│   │           ├── ...（略：全TEPCO地域ZIP）
│   │           └── tepco_yamanashi.zip
│   │
│   ├── engines/
│   │   ├── capacity-engine.js
│   │   ├── hazard-engine.js
│   │   └── parcel-loader.js
│   │
│   ├── icons/
│   │   ├── locate.svg
│   │   ├── menu.svg
│   │   ├── search.svg
│   │   ├── trash.svg
│   │   ├── zoom_in.svg
│   │   └── zoom_out.svg
│   │
│   ├── layers/
│   │   ├── base.js
│   │   ├── capacity.js
│   │   ├── grid.js
│   │   ├── hazard.js
│   │   ├── jiban.js
│   │   ├── power.js
│   │   ├── power_infrastructure.js
│   │   └── powerline.js
│   │
│   ├── storage/
│   │   └── indexeddb.js
│   │
│   ├── unified/
│   │   └── unified-layer.js
│   │
│   └── utils/
│       ├── apiLogger.js
│       ├── buildingLoader.js
│       ├── dataLoader.js
│       ├── fetchJSON.js
│       ├── geocode.js
│       ├── layerSpec.js
│       ├── maplibreHelpers.js
│       ├── pathResolver.js
│       ├── prefDetect.js
│       ├── pref_polygons.js
│       └── styleLoader.js
│
├── INSTALL_NATIONAL_DATA.md
├── NATIONAL_SCALE_IMPLEMENTATION_REPORT.md
├── OSM_MATCHING_REPORT.md
├── tile_proxy.py
├── package.json
├── package-lock.json
├── .gitignore
└── .gitattributes
```

**AI はこの構造を「事実」として扱う。推測で構造を変えないこと。**

---

## 3. コアJSファイルの責務（事実）

### 3.1 viewer/map-init.js

* MapLibre の初期化のみ担当
* GSI 標準地図 / 航空写真をレイヤーとして追加
* `parcel/select` を発火するクリック処理を持つ

**禁止：**
ハザード判定・空容量・送電線ロジックを書くこと。

---

### 3.2 viewer/ui-init.js

* 検索バー
* レイヤーパネル（ハザード / 電力インフラ / 農地 etc.）
* Google Maps風 UI コントロール（ズーム・現在地・ゴミ箱）

**禁止：**
ビジネスロジック（判定・計算・外部API）は UI に書かない。

---

### 3.3 viewer/hazard-init.js ＆ layers/hazard.js

* metadata_light.xml を前提に、
  hazardMatrix.js から GSI タイルを読み出してレイヤー追加
* 洪水 / 土砂 / 津波 / 雪崩 / 液状化 の WMTS URL は
  **metadata_light.xml に完全準拠** すること。手書きで URL を推測しない。

---

### 3.4 viewer/power-init.js

* `viewer/data/power/osm/*.geojson` を MapLibre ソースとして追加
* `power-line-500kv` / `power-line-275kv` / `power-line-154kv` / `power-line-other`
  `power-substations` レイヤーを定義
* `voltage` / `voltage_numeric` プロパティに基づきフィルタする

**禁止：**
OCCTO データを前提にしたレイヤーを勝手に追加しない。

---

### 3.5 main.js

* **唯一の責務：起動シーケンスを組み立てるだけ**

```js
document.addEventListener("DOMContentLoaded", () => {
  const map = initMap();
  initUI(map);
  map.on("load", () => {
    const hazardController = initHazard(map, detectPrefecture);
    const powerController = initPowerLayers(map);
    initPowerLayerToggles(powerController);
  });
});
```

**禁止：**
main.js にロジックを肥大化させない。
（Phase4.3 Cプランの「起動シーケンスのみ」方針を維持）

---

## 4. metadata_light.xml と hazardMatrix の扱い（事実）

### 4.1 絶対原則

* **WMTS レイヤーに関する事実はすべて metadata_light.xml が正**
* AI は URL / directory / tileMatrixSet / minzoom / maxzoom を
  **推測で書かず、metadata_light.xml → hazardMatrix.js という変換パターンに従う**

### 4.2 禁止事項

* 手書きで `https://disaportaldata.gsi.go.jp/raster/...` のパスを「推測」しない
* `<ows:Identifier>` と違う ID をでっち上げない
* metadata_light.xml に無いレイヤーを hazardMatrix に追加しない（MLIT 液状化など特殊ケースは別途明示）

---

## 5. akiyouryou_points_to_note.pdf（空容量）の扱い（事実）

この PDF は **空容量マップの公式な注意事項** をまとめたものであり、
社内ルールはこれに準拠する必要がある。主なポイント：

* 扱うのは **逆潮流側（発電→系統）の空容量のみ**

* 色（緑・赤・青・ピンク・紫）は安全度ではなく
  **出力制御可能性や制約状態を示す**。勝手な意味づけをしない

* 「3年以内の増強系統」は負担金が遡りうるため、UIやドキュメントで明示

* 「各電力会社の最新データをご確認ください」という文言は
  README に記載済みであり、**改変禁止**

AI は空容量の記事・説明・UI を書くとき、
**必ずこの PDF の方針と README の文言に整合させること。**

---

## 6. Implementation Roadmap（Phase5〜9の事実）

AI が実装提案やコードを書くときは、  
**Implementation Roadmap（docs/implementation-roadmap.md）に従う。**

### 6.1 Segment5（今ここ）

* 地番 × 農地 × UDL 統合  
* parcel-loader.js / unified-layer.js の実装

### 6.2 Phase6

* 全国空容量モデルの統一  
* capacity-engine.js / hazard-engine.js の実装

### 6.3 Phase7

* PMTiles 高速化  
* parcel-loader.js のチューニング

### 6.4 Phase8〜9

* UDL → Engines → External API の安定化  
* UI と DataBus の責務分離強化

**AI は「今どのフェーズで何を実装すべきか」を Roadmap に従って判断し、  
未指定の機能を勝手に先行実装しない。**

---

## 7. AI アシスタントの行動規範（絶対ルール）

### 7.1 事実優先

> **“存在している事実を無視して、勝手な前提で走り出さない。”**

AI は以下の順番で判断する：

1. 既存ソース（README / AI Guide / Roadmap / XML / PDF / JS / ディレクトリ構造）を確認
2. その範囲で論理的に解釈・整合させる
3. それでも情報が無い部分だけ、推論や選択肢提示を行う

**既存ソースより推論を優先することは禁止。**

---

### 7.2 禁止パターン

AI は次のような振る舞いをしてはならない：

* metadata_light.xml があるのに、WMTS URL を “推測” で組み立てる

* ディレクトリ構造が提示されているのに、`viewer/data/...` など別構造を勝手に前提にする

* akiyouryou_points_to_note.pdf があるのに、空容量のルールを想像で補う

* README / Roadmap に書かれていないフェーズや機能を勝手に作り出す

* main.js を肥大化させ、責務分離を壊す

* UDL 依存方向（UI -> DataBus -> UDL -> Engines -> External）を逆流させる

---

### 7.3 推論が許される範囲

* ドキュメント中で **明示されていない UI デザインの細部**（ボタンの位置微調整など）
* まだ決まっていない将来フェーズの「案」を出すとき
* ユーザーが「方針アイデアがほしい」と明示したとき

この場合でも、
**必ず「これは推論・提案であって事実ではない」と分かるように書くこと。**

---


## 8. タスク別の対応テンプレ（AIの思考フロー）

### 8.1 コード修正依頼が来たとき

1. 対象ファイルがどこにあるかを **ディレクトリ構造から確認**
2. README / Roadmap / このガイドと矛盾しないかチェック
3. 既存コードを壊さず差分で考える
4. 変更箇所を明示し、責務の境界を越えないようにする

---

### 8.2 ハザード関連の質問・実装依頼が来たとき

1. 必ず metadata_light.xml を前提に考える
2. hazardMatrix.js を手で改造する場合も
   → XML に整合しているかを意識
3. URL や TileMatrixSet を「推測で」変えない

---

### 8.3 空容量・容量市場の説明依頼が来たとき

1. akiyouryou_points_to_note.pdf の方針を前提にする
2. 「逆潮流側のみ」「色の意味」「最新データ確認」を守る
3. README にある文言（社内ルール）は改変しない

---


## 9. 最後に（AIへのメッセージ）

このプロジェクトは、  
**BESSという巨大な投資判断を支える “社内中枢システム”** です。

その前提として、ユーザー（= SRHD側）はこう言っています：

> **「存在している事実を無視して、勝手な前提で走り出すな。」**

> **「推論の前に、現時点でリポジトリ内に存在しているファイルの中身をまず確認すること。」**

AI はこの言葉を **最上位の原則** として守ってください。

* 事実を見てから考える  
* 構造を理解してから提案する  
* README / AI Guide / Roadmap / XML / PDF / JS / ディレクトリ構造を  
  “生きた仕様書” として扱う  

それが、このガイドのすべてです。
