# Capacity Data Fetchers

電力各社の空き容量データを取得・標準化するための抽象クラスとfetcher実装群。

## アーキテクチャ

```
tools/
├── fetchers/
│   ├── base.js          # CapacityFetcher抽象基底クラス
│   ├── tepco.js         # TEPCO実装（完成）
│   ├── chuden.js        # 中部電力実装（スタブ）
│   ├── kepco.js         # 関西電力実装（スタブ）
│   └── kyuden.js        # 九州電力実装（スタブ）
└── schemas/
    └── capacity_schema.json  # JSON Schema定義
```

## 機能

### CapacityFetcher基底クラス

- **スキーマ検証**: ajvライブラリによるJSON Schema検証
- **エラーハンドリング**: リトライ・タイムアウト・指数バックオフ
- **レート制限**: 礼儀正しいAPI利用（デフォルト1req/sec）
- **ログ出力**: 標準化されたログフォーマット

### 実装必須メソッド

サブクラスで実装が必要：

```javascript
async fetchRawData()  // データソースから生データ取得
async parseData(raw)  // 生データを標準形式に変換
```

## 使用方法

### TEPCO Fetcher（完成）

```bash
# CSVファイルから読み込み
node tools/fetchers/tepco.js data/power/capacity/sample_capacity.csv output.json

# プログラムから使用
import { TEPCOCapacityFetcher } from './tools/fetchers/tepco.js';

const fetcher = new TEPCOCapacityFetcher({
  csvPath: './data/power/capacity/tepco_latest.csv'
});

const entries = await fetcher.fetch(false); // strict=false
// または
await fetcher.fetchAndSave('./output.json', false);
```

### 新しいUtility実装の追加

```javascript
import { CapacityFetcher } from './base.js';
import { parse } from 'csv-parse/sync';

export class MyUtilityFetcher extends CapacityFetcher {
  constructor(config = {}) {
    super({
      utility: 'MYUTIL',
      sourceUrl: config.sourceUrl || 'https://...',
      options: config.options || {}
    });
  }

  async fetchRawData() {
    // 1. HTTPリクエスト、ファイル読み込み、APIコールなど
    const response = await fetch(this.sourceUrl);
    return await response.text();
  }

  async parseData(csvText) {
    // 2. 標準形式に変換
    const records = parse(csvText, { columns: true });
    
    return records.map((row, i) => ({
      id: `myutil_${i + 1}`,
      name: row.facility_name,
      utility: 'MYUTIL',
      voltage_kv: parseFloat(row.voltage),
      available_kw: parseFloat(row.capacity),
      updated_at: row.date,
      lat: null,
      lon: null,
      matched_source: 'unmatched',
      confidence: 0,
      notes: ''
    }));
  }
}
```

## JSON Schema検証

### スキーマ定義

`tools/schemas/capacity_schema.json` で定義：

- **必須フィールド**: id, name, utility, voltage_kv, available_kw, updated_at
- **オプション**: lat, lon, matched_source, confidence, notes
- **バリデーション**: 
  - utility: 列挙型（TEPCO, CHUDEN, KEPCO, etc.）
  - voltage_kv: 0-1000の数値
  - lat: -90〜90
  - lon: -180〜180
  - updated_at: YYYY-MM-DD形式

### 検証モード

```javascript
// 厳格モード（エラーで停止）
const entries = await fetcher.fetch(true);

// 緩和モード（警告のみ、無効データはスキップ）
const entries = await fetcher.fetch(false);
```

## geo_locatorとの統合

`geo_locator.js`は自動的にスキーマをロードして検証：

```bash
node tools/geo_locator.js --input sample.csv --out output.json
```

出力例：
```
[geo-locator] Schema loaded and compiled
[geo-locator] Validation: 5 valid, 0 invalid
```

無効なエントリがある場合：
```
[geo-locator] Validation failed for entry tepco_3: data/voltage_kv must be number
[geo-locator] Validation: 4 valid, 1 invalid
```

## テスト

```bash
# TEPCO fetcherテスト
node -e "import('./tools/fetchers/tepco.js').then(m => { 
  const f = new m.TEPCOCapacityFetcher({csvPath: './data/power/capacity/sample_capacity.csv'}); 
  return f.fetchAndSave('./test_output.json'); 
})"

# 出力確認
cat test_output.json | jq '.[0]'
```

期待される出力：
```
[TEPCO] Starting fetch from https://www.tepco.co.jp/...
[TEPCO] Schema loaded from C:\dev\hazard-viewer\tools\schemas\capacity_schema.json
[TEPCO] Reading from local file: ./data/power/capacity/sample_capacity.csv
[TEPCO] Fetched raw data
[TEPCO] Parsed 5 entries
[TEPCO] Validation complete: 5 valid, 0 invalid
[TEPCO] Saved 5 entries to ./test_output.json
```

## 今後の実装

### Phase 2: 各社Fetcher実装

- [ ] CHUDEN (中部電力)
- [ ] KEPCO (関西電力)
- [ ] KYUDEN (九州電力)
- [ ] HOKUDEN (北海道電力)
- [ ] TOHOKU (東北電力)
- [ ] その他

### Phase 3: 自動化

- [ ] GitHub Actions定期実行
- [ ] スケジューラー統合
- [ ] エラー通知（GitHub Issues / Slack）
- [ ] 差分検出・履歴管理

## 関連ファイル

- `tools/geo_locator.js` - 座標付与パイプライン
- `data/powerMatrix.json` - レイヤー定義
- `viewer/layers/power.js` - UI統合
- `docs/POWER_DATA_PIPELINE.md` - 運用戦略ドキュメント
