# 電力インフラ座標エディタ

## 概要

座標未登録の電力施設（変電所）に手動で座標を追加するためのWebインターフェースです。

## 機能

### 1. 施設リスト表示
- **座標未登録施設のみ表示**: 送電線を除外し、変電所のみフィルタ
- **電圧階級別バッジ**: 500kV（紫）→ 6.6kV（金色）
- **ソート**: 電圧階級（高→低）→ 空き容量（大→小）

### 2. フィルター機能
- **施設名検索**: リアルタイム部分一致検索
- **電圧階級**: 500kV / 275kV / 154kV / 66kV / 22kV / 6.6kV
- **地域**: 基幹系統 / 東京23区 / 神奈川 / 埼玉 / 千葉（今後実装）

### 3. 座標登録ワークフロー

#### Step 1: 施設を選択
1. 左パネルのリストから施設をクリック
2. 青いバナー「🎯 地図をクリックして座標を設定してください」が表示

#### Step 2: 地図上で位置を指定
1. 地図上の任意の地点をクリック
2. 青いマーカーが表示される
3. **マーカーはドラッグ可能** - 微調整が可能

#### Step 3: 座標を確定
1. 「✓ 座標を確定」ボタンをクリック
2. `coordinate_cache` にデータが追加される
3. 確認ダイアログが表示される

### 4. エクスポート
1. 「💾 エクスポート」ボタンをクリック
2. `coordinate_cache_YYYY-MM-DD.json` がダウンロードされる
3. このファイルを `data/power/coordinate_cache.json` に上書き

## 使い方

### 起動

```bash
# HTTPサーバー起動
cd C:\dev\hazard-viewer
python -m http.server 8000
```

ブラウザで開く: http://localhost:8000/viewer/coord_editor.html

### 作業フロー

1. **優先順位の高い施設から処理**:
   - 154kV以上の基幹変電所
   - 空き容量が大きい施設
   - 主要都市の施設

2. **地図ソース**:
   - OpenStreetMap標準タイル
   - Google Mapsと併用してクロスチェック推奨

3. **座標の精度**:
   - 変電所の敷地中心を目安に設定
   - 緯度経度6桁（メートル単位の精度）で記録

4. **定期エクスポート**:
   - 10-20件追加するごとにエクスポート
   - Git経由でバックアップ

## データ形式

### 入力: `tepco_all_regions_entries_only.json`
```json
{
  "id": "tepco_tokyo23_1",
  "name": "新宿",
  "voltage_kv": 154,
  "available_kw": 120000,
  "lat": null,
  "lon": null,
  "matched_source": "unmatched"
}
```

### 出力: `coordinate_cache.json`
```json
{
  "新宿変電所": {
    "lat": 35.6947037,
    "lon": 139.6865963,
    "source": "manual",
    "confidence": 1.0,
    "display_name": "新宿",
    "last_verified": "2025-11-26"
  }
}
```

## 統合フロー

```
coord_editor.html (手動追加)
  ↓
coordinate_cache.json (エクスポート)
  ↓
git add & commit
  ↓
geo_locator.js --input tepco_all_regions_entries_only.json
  ↓
tepco_all_regions_located.json (座標マージ済み)
  ↓
power_infrastructure.js (地図表示)
```

## トラブルシューティング

### 施設が表示されない
- フィルター条件を確認
- 既に座標が登録されている可能性（`coordinate_cache.json`確認）

### マーカーがドラッグできない
- 一度キャンセルして再度選択
- ブラウザのコンソールでエラー確認

### エクスポートしたJSONが読み込まれない
- JSONフォーマットが正しいか確認（`,`の有無など）
- `data/power/coordinate_cache.json`に正しく配置されているか確認

## 今後の拡張

- [ ] OSMデータとの自動マッチング提案機能
- [ ] 複数施設の一括処理モード
- [ ] 座標の精度評価（信頼度スコア）
- [ ] 地域フィルターの実装（メタデータ追加が必要）
- [ ] Undo/Redo機能
- [ ] クラウド同期（複数人での並行作業）

## ライセンス

地図データ: © OpenStreetMap contributors
