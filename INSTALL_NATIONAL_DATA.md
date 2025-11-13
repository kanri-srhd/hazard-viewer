# 全国規模 PMTiles 生成ガイド

このガイドは、全国の地籍・ハザードデータを Tippecanoe で PMTiles に変換するための手順を説明します。

## 前提条件

- WSL 2 (Windows Subsystem for Linux)
- Tippecanoe v1.36.0 以上
- GeoJSON 形式のデータファイル

```bash
# WSL で Tippecanoe をインストール（未インストールの場合）
sudo apt-get update
sudo apt-get install -y build-essential git
git clone https://github.com/mapbox/tippecanoe.git
cd tippecanoe
make
sudo make install
```

## 1. 単一レイヤの PMTiles 生成（地籍データ例）

### 最小ズームレベル対応例

```bash
# 小規模データ（1県〜数県レベル）
tippecanoe \
  -o cadastral_prefecture.pmtiles \
  -z 12 \
  --drop-densest-as-needed \
  --detect-shared-borders \
  -r 1 \
  cadastral_data.geojson

# パラメータ説明:
# -o: 出力ファイル名
# -z: 最大ズームレベル（12 = 市町村レベル）
# --drop-densest-as-needed: 密集ポリゴンを自動削除
# --detect-shared-borders: 隣接ポリゴンの境界を統合
# -r 1: 単一トレース
```

### 全国規模対応例（高精度）

```bash
# 全国データ（大規模）
tippecanoe \
  -o cadastral_national_hires.pmtiles \
  -z 14 \
  -Z 6 \
  --drop-densest-as-needed \
  --detect-shared-borders \
  --drop-rate=2 \
  --base-zoom=10 \
  --maximum-zoom=14 \
  --no-feature-limit \
  --no-tile-size-limit \
  cadastral_all_japan.geojson

# パラメータ説明:
# -Z 6: 最小ズームレベル（6 = 都道府県レベル）
# --drop-rate=2: 低ズームでは 50% ポリゴンを削除
# --base-zoom=10: 基準ズームレベル
# --maximum-zoom=14: 最大ズーム（14 = 街路ブロックレベル）
# --no-feature-limit: フィーチャ上限を無視
# --no-tile-size-limit: タイル容量上限を無視
```

## 2. マルチレイヤ PMTiles 生成（複数データ統合）

### 複数 GeoJSON を一つの PMTiles に統合

```bash
# 地籍 + ハザード統合版
tippecanoe \
  -o hazard_integrated_national.pmtiles \
  -z 14 \
  -Z 5 \
  -l cadastral \
  -l flood \
  -l landslide \
  -l tsunami \
  --drop-densest-as-needed \
  --detect-shared-borders \
  --maximum-zoom=14 \
  --base-zoom=8 \
  cadastral_all_japan.geojson \
  hazard_flood_national.geojson \
  hazard_landslide_national.geojson \
  hazard_tsunami_national.geojson

# -l: レイヤ名（複数指定可能）
# 各 GeoJSON ファイルがそのレイヤ名で登録される
```

## 3. ズームレベル別の最適化戦略

| ズームレベル | 地名 | ポリゴン粒度 | 推奨設定 |
|---|---|---|---|
| 5 | 都道府県全体 | 都道府県単位 | `--drop-rate=20` |
| 6-7 | 広域市町村 | 市町村単位 | `--drop-rate=10` |
| 8-9 | 市町村 | 字単位 | `--drop-rate=3` |
| 10-12 | 街区 | 街区・地番 | `--drop-rate=1` |
| 13-14 | 詳細地番 | 地番（最詳細） | `--drop-rate=0`（削除なし） |

### 複数ズームレベルに最適化

```bash
# ズームレベル別の削減率を自動適用
tippecanoe \
  -o cadastral_multiresolution.pmtiles \
  -z 14 \
  -Z 5 \
  --drop-densest-as-needed \
  --accumulate-attribute=area:sum \
  --base-zoom=10 \
  cadastral_all_japan.geojson
```

## 4. ハザード固有のパラメータ

### 洪水リスク（多くの細かい複雑形状）

```bash
tippecanoe \
  -o hazard_flood_national.pmtiles \
  -z 12 \
  -Z 6 \
  --drop-densest-as-needed \
  --simplify-only-low-zooms \
  hazard_flood_japan.geojson
```

### 土砂災害（ポイント・ライン混在）

```bash
tippecanoe \
  -o hazard_landslide_national.pmtiles \
  -z 14 \
  -Z 7 \
  --detect-shared-borders \
  hazard_landslide_japan.geojson
```

### 津波リスク（沿岸線沿い）

```bash
tippecanoe \
  -o hazard_tsunami_national.pmtiles \
  -z 12 \
  -Z 6 \
  hazard_tsunami_japan.geojson
```

## 5. パフォーマンス計測

```bash
# ファイルサイズを確認
ls -lh *.pmtiles

# 例出力:
# -rw-r--r-- 1 user user  850M cadastral_national_hires.pmtiles
# -rw-r--r-- 1 user user  120M hazard_flood_national.pmtiles
# -rw-r--r-- 1 user user   45M hazard_landslide_national.pmtiles
# -rw-r--r-- 1 user user   60M hazard_tsunami_national.pmtiles
```

## 6. GitHub Pages へのアップロード

```bash
# docs/data/ に配置
cp *.pmtiles /path/to/hazard-viewer/docs/data/

# Git に追加
cd /path/to/hazard-viewer
git add docs/data/*.pmtiles
git commit -m "feat: add national-scale PMTiles data (cadastral, flood, landslide, tsunami)"
git push origin main
```

## 注意事項

- **ファイルサイズ**: 全国地籍データは 800MB～数GB になる可能性
- **GitHub のファイル容量制限**: 単一ファイル 100MB 以上は LFS (Large File Storage) を使用
- **タイルキャッシュ**: PMTiles はメモリ効率が高いため、大規模データでもブラウザ負荷は低い

## データソース例

1. **地籍データ**:
   - 法務省 | 不動産登記情報提供システム
   - MLIT | 地理空間情報ライブラリー

2. **ハザードデータ**:
   - 国土交通省 | ハザードマップポータルサイト
   - 都道府県別防災ウェブサイト

