# hazardMatrix 自動生成ツール

## 概要

`generate_hazard_matrix.py` は、国土地理院のハザードマップ WMTSメタデータ（`metadata_light.xml`）を解析し、`hazardMatrix.json` と `hazardMatrix.js` を自動生成するPythonスクリプトです。

## 機能

1. **XML解析**: metadata_light.xml から Layer 要素を抽出
2. **自動ID生成**: ディレクトリ名から id を自動生成（例: `01_flood_l2_shinsuishin_data` → `flood_l2_shinsuishin`）
3. **pref-or-data判定**: `*_data` で終わるディレクトリは `pref-or-data` として分類
4. **ズームレベル抽出**: TileMatrixSetLink から minzoom/maxzoom を自動取得
5. **URL変換**: `{TileMatrix}/{TileCol}/{TileRow}` → `{z}/{x}/{y}` に自動変換
6. **液状化API追加**: MLIT液状化APIエントリを自動挿入
7. **JSON/JS出力**: 両形式で出力（ES6 export 形式）

## 前提条件

### 1. metadata_light.xml の準備

国土地理院のWMTS Capabilitiesから`metadata_light.xml`を取得してください。

**取得方法:**

```bash
# 国土地理院 重ねるハザードマップ WMTS GetCapabilities
curl -o data/metadata_light.xml "https://disaportaldata.gsi.go.jp/wmts/service?REQUEST=GetCapabilities&SERVICE=WMTS"
```

または、ブラウザで以下のURLにアクセスして保存:
```
https://disaportaldata.gsi.go.jp/wmts/service?REQUEST=GetCapabilities&SERVICE=WMTS
```

### 2. ファイル配置

```
hazard-viewer/
├── tools/
│   └── generate_hazard_matrix.py  ← このスクリプト
└── data/
    └── metadata_light.xml          ← ここに配置
```

## 使用方法

### 基本的な使い方（デフォルトパス）

```bash
cd hazard-viewer
python tools/generate_hazard_matrix.py
```

これで以下が生成されます:
- `data/hazardMatrix.json`
- `data/hazardMatrix.js`

### カスタムパスを指定する場合

```bash
python tools/generate_hazard_matrix.py [入力XMLパス] [出力ディレクトリ]
```

**例:**
```bash
# /mnt/data/metadata_light.xml を読み込み、/mnt/data/ に出力
python tools/generate_hazard_matrix.py /mnt/data/metadata_light.xml /mnt/data

# カレントディレクトリのXMLを読み込み、viewer/utils/ に出力
python tools/generate_hazard_matrix.py ./metadata_light.xml ./viewer/utils
```

## 出力形式

### hazardMatrix.json

```json
{
  "flood_l2_shinsuishin": {
    "title": "洪水浸水想定区域（想定最大規模）",
    "id": "flood_l2_shinsuishin",
    "directory": "01_flood_l2_shinsuishin_data",
    "template": "https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png",
    "prefOrData": "pref-or-data",
    "minzoom": 2,
    "maxzoom": 17
  },
  "mlit_liquefaction": {
    "title": "液状化（MLIT全国）",
    "id": "mlit_liquefaction",
    "directory": "liquefaction",
    "template": "https://disaportal.mlit.go.jp/raster/liquefaction/{z}/{x}/{y}.png",
    "prefOrData": "data",
    "minzoom": 2,
    "maxzoom": 17
  }
}
```

### hazardMatrix.js

```javascript
// Auto-generated from metadata_light.xml

export const hazardMatrix = {
  "flood_l2_shinsuishin": {
    title: "洪水浸水想定区域（想定最大規模）",
    id: "flood_l2_shinsuishin",
    directory: "01_flood_l2_shinsuishin_data",
    template: "https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png",
    prefOrData: "pref-or-data",
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
```

## データ仕様

### prefOrData の判定ルール

| ディレクトリ名のパターン | prefOrData | 説明 |
|-------------------------|------------|------|
| `*_data` で終わる | `pref-or-data` | 都道府県別にデータが分かれている |
| それ以外 | `data` | 全国統一データ |

### ID生成ルール

1. ディレクトリ名から先頭の数字とアンダースコアを削除
2. 末尾の `_data` を削除

**例:**
- `01_flood_l2_shinsuishin_data` → `flood_l2_shinsuishin`
- `05_tsunami_newlegend_data` → `tsunami_newlegend`
- `liquefaction` → `liquefaction`

## エラーハンドリング

### 入力ファイルが見つからない場合

```
[ERROR] 入力ファイルが見つかりません: ./data/metadata_light.xml
[INFO] 使用方法: python tools/generate_hazard_matrix.py [input_xml_path] [output_dir]
```

→ metadata_light.xml を正しいパスに配置してください

### XML解析エラーの場合

```
[ERROR] XML解析エラー: ...
```

→ XMLファイルが破損していないか確認してください

## トラブルシューティング

### Q1. スクリプトを実行しても何も出力されない

A. Python 3.6以上がインストールされているか確認してください:
```bash
python --version
```

### Q2. 生成されたファイルの文字化けが発生する

A. スクリプトはUTF-8で出力します。エディタの文字コード設定を確認してください。

### Q3. 一部のレイヤーがスキップされる

A. 以下のログで原因を確認できます:
```
[WARN] ID が見つからないレイヤーをスキップ: ...
[WARN] ResourceURL が見つからないレイヤーをスキップ: ...
[WARN] ディレクトリ名を抽出できないレイヤーをスキップ: ...
```

## 更新手順

国土地理院のハザードマップが更新された場合:

1. 最新の metadata_light.xml を取得
2. スクリプトを再実行
3. 生成されたファイルをコミット

```bash
# 最新メタデータ取得
curl -o data/metadata_light.xml "https://disaportaldata.gsi.go.jp/wmts/service?REQUEST=GetCapabilities&SERVICE=WMTS"

# 再生成
python tools/generate_hazard_matrix.py

# 確認
git diff data/hazardMatrix.json
git diff data/hazardMatrix.js
```

## ライセンス

このスクリプトはMITライセンスで提供されます。

## 関連ドキュメント

- [NATIONAL_SCALE_IMPLEMENTATION_REPORT.md](../NATIONAL_SCALE_IMPLEMENTATION_REPORT.md)
- [INSTALL_NATIONAL_DATA.md](../INSTALL_NATIONAL_DATA.md)
