# kintone-functional-query クイックスタート

## セットアップ

### 1. インストール

```bash
# ライブラリ本体
npm install kintone-functional-query

# CLIツール（開発時のみ）
npm install -D @kintone-functional-query/cli
```

### 2. スキーマ生成（推奨）

まずCLIでアプリのスキーマを生成します：

```bash
npx kintone-query-gen generate \
  --domain your-domain.cybozu.com \
  --app-id 123 \
  --api-token YOUR_API_TOKEN \
  --output ./src/schemas
```

生成されるファイル：
```typescript
// ./src/schemas/schema.ts
import { Schema as S } from 'effect';
import { SingleLineTextFieldSchema, NumberFieldSchema, ... } from 'kintone-effect-schema';

export const AppSchema = S.Struct({
  顧客名: SingleLineTextFieldSchema,
  金額: NumberFieldSchema,
  契約日: DateFieldSchema,
  ステータス: DropDownFieldSchema,
  // ... 他のフィールド
});

export type App = S.Schema.Type<typeof AppSchema>;
```

### 3. 型安全なクエリ構築

```typescript
import { kintoneQuery, TODAY, subTable } from 'kintone-functional-query';
import { App } from './schemas/schema';

// シンプルなクエリ
const query1 = kintoneQuery<App>(r => 
  r.顧客名.equals("サイボウズ株式会社")
).build();
// => '顧客名 = "サイボウズ株式会社"'

// 複数条件
const query2 = kintoneQuery<App>(r => 
  r.ステータス.notEquals("完了") && 
  r.金額.greaterThan(1000000)
).build();
// => '(ステータス != "完了" and 金額 > 1000000)'

// 全部盛り
const query3 = kintoneQuery<App>(r =>
  r.契約日.greaterThanOrEqual(TODAY()) &&
  r.ステータス.in(["商談中", "受注"])
)
  .orderBy('金額', 'desc')
  .limit(100)
  .offset(20)
  .build();
// => '(契約日 >= TODAY() and ステータス in ("商談中", "受注")) order by 金額 desc limit 100 offset 20'
```

## サブテーブルの使用

```typescript
const 注文明細 = subTable('注文明細');

// サブテーブルのクエリ
const query = kintoneQuery<App>(r =>
  r.顧客名.like("株式会社%") &&
  注文明細.商品コード.in(['P001', 'P002', 'P003']) &&
  注文明細.数量.greaterThan(10)
).build();
// => '((顧客名 like "株式会社%" and 注文明細.商品コード in ("P001", "P002", "P003")) and 注文明細.数量 > 10)'
```

## 日付関数

```typescript
import { 
  TODAY, 
  NOW, 
  YESTERDAY, 
  TOMORROW, 
  FROM_TODAY,
  THIS_WEEK,
  THIS_MONTH,
  THIS_YEAR,
  LOGINUSER
} from 'kintone-functional-query';

// 今日以降の案件
const query1 = kintoneQuery<App>(r =>
  r.期限日.greaterThanOrEqual(TODAY())
).build();

// 過去30日間の案件
const query2 = kintoneQuery<App>(r =>
  r.作成日時.greaterThanOrEqual(FROM_TODAY(-30, 'DAYS'))
).build();

// 今月の自分の案件
const query3 = kintoneQuery<App>(r =>
  r.作成日.in([THIS_MONTH()]) &&
  r.担当者.in([LOGINUSER()])
).build();
```

## カスタマイズでの使用

```javascript
(function() {
  'use strict';
  
  // スキーマをインポート（webpack等でバンドル）
  const { kintoneQuery, TODAY } = require('kintone-functional-query');
  const { App } = require('./schemas/schema');
  
  kintone.events.on('app.record.index.show', function(event) {
    // ボタンを追加
    const button = document.createElement('button');
    button.textContent = '期限切れ案件を表示';
    button.onclick = async () => {
      // 型安全なクエリ構築
      const query = kintoneQuery(r =>
        r.期限日.lessThan(TODAY()) &&
        r.ステータス.notEquals("完了")
      ).orderBy('期限日', 'asc').build();
      
      // レコード取得
      const result = await kintone.app.getRecords({
        app: kintone.app.getId(),
        query: query
      });
      
      alert(`${result.records.length}件の期限切れ案件があります`);
    };
    
    kintone.app.getHeaderMenuSpaceElement().appendChild(button);
    return event;
  });
})();
```

## トラブルシューティング

### TypeScriptの型が効かない

1. tsconfig.json の paths を設定：
```json
{
  "compilerOptions": {
    "paths": {
      "@/schemas/*": ["./src/schemas/*"]
    }
  }
}
```

2. IDE を再起動

### CLIでスキーマ生成時のエラー

1. APIトークンの権限を確認（アプリ管理権限が必要）
2. ドメイン名に `https://` を含めない
3. プロキシ環境の場合は環境変数を設定

### サブテーブルでequalsが使えない

kintone の仕様により、サブテーブルでは `in`、`not in`、`like`、`not like` のみ使用可能です。

## 次のステップ

- [README.md](README.md) で詳細な機能を確認
- [動的クエリビルダーガイド](FRONTEND_GUIDE.md) でGUIでの検索UIを実装
- [CONTRIBUTING.md](CONTRIBUTING.md) で開発に参加