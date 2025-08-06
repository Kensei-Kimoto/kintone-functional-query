# kintone-functional-query

[![CI](https://github.com/kimotokensei/kintone-functional-query/actions/workflows/ci.yml/badge.svg)](https://github.com/kimotokensei/kintone-functional-query/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/kintone-functional-query.svg)](https://badge.fury.io/js/kintone-functional-query)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Type-safe functional query builder for kintone

[English README is here](README.md)

## 概要

kintone-functional-queryは、kintoneのクエリをラムダ式で型安全に記述できるTypeScriptライブラリです。IDEの補完機能を活用して、直感的にクエリを構築できます。

## 特徴

- 🔒 **型安全**: TypeScriptの型システムを活用した型安全なクエリ構築
- ✨ **直感的**: ラムダ式による自然な記述
- 🚀 **補完対応**: IDEの自動補完で快適な開発体験
- 🔧 **柔軟**: 演算子、関数、複数ソート、ページネーションをサポート
- 🛡️ **実行時検証**: Effect-TS駆動のスキーマ検証で安全性を向上
- 📊 **高度なログ**: デバッグ用の構造化ログとコンテキスト情報
- 🏭 **バッチ生成**: 設定ファイルによる複数アプリの一括スキーマ生成
- ⚡ **API検証**: kintone API制限の組み込みバリデーション（500件、10k オフセット）
- 🌐 **kintone-as-code 統合**: 既存のkintone-as-codeワークフローと互換

## インストール

```bash
npm install kintone-functional-query
```

## 使用例

### 1. CLIでスキーマを生成

#### 単一アプリの生成

```bash
npx kintone-query-gen generate \
  --domain example.cybozu.com \
  --app-id 123 \
  --api-token YOUR_API_TOKEN \
  --output ./src/generated
```

#### 設定ファイルによるバッチ生成

```bash
# 複数アプリのスキーマを一括生成
npx kintone-query-gen batch --config ./kintone.config.js

# 異なる環境を使用
npx kintone-query-gen batch --env development

# 何が生成されるかプレビュー
npx kintone-query-gen batch --dry-run

# 並列処理数を制御
npx kintone-query-gen batch --parallel 5
```

#### 設定ファイル（kintone-functional-query.config.js）

```javascript
export default {
  default: 'production',
  environments: {
    production: {
      auth: {
        baseUrl: 'https://your-domain.cybozu.com',
        apiToken: process.env.KINTONE_API_TOKEN,
      }
    },
    development: {
      auth: {
        baseUrl: 'https://dev-domain.cybozu.com',
        apiToken: process.env.KINTONE_DEV_TOKEN,
      }
    }
  },
  apps: [
    {
      appId: '123',
      name: '営業管理',
      outputPath: './schemas/sales',
      schemaName: 'SalesSchema'
    },
    {
      appId: '456', 
      name: '顧客データベース',
      outputPath: './schemas/customer'
    }
  ],
  output: {
    baseDir: 'generated',
    indexFile: true
  }
};
```

#### 生成されるファイルの例

```typescript
// ./src/generated/schema.ts
import { Schema as S } from 'effect';
import {
  SingleLineTextFieldSchema,
  NumberFieldSchema,
  DateFieldSchema,
  DropDownFieldSchema,
  UserSelectFieldSchema,
  SubtableFieldSchema,
} from 'kintone-effect-schema';

export const AppSchema = S.Struct({
  顧客名: SingleLineTextFieldSchema,
  担当者: UserSelectFieldSchema,
  金額: NumberFieldSchema,
  契約日: DateFieldSchema,
  ステータス: DropDownFieldSchema,
  注文明細: SubtableFieldSchema(
    S.Struct({
      商品コード: SingleLineTextFieldSchema,
      商品名: SingleLineTextFieldSchema,
      数量: NumberFieldSchema,
      単価: NumberFieldSchema,
    })
  ),
});

// 型も自動的にエクスポートされる！
export type App = S.Schema.Type<typeof AppSchema>;
```

### 2. 生成された型を使ってクエリ構築

```typescript
import { kintoneQuery, TODAY, FROM_TODAY, subTable } from 'kintone-functional-query';
import { App } from './generated/schema';

// シンプルなクエリ
const query1 = kintoneQuery<App>(r =>
  r.顧客名.equals("サイボウズ株式会社")
).build();
// => '顧客名 = "サイボウズ株式会社"'

// 複数条件の組み合わせ
const query2 = kintoneQuery<App>(r =>
  r.顧客名.equals("サイボウズ株式会社") &&
  r.契約日.lessThan(TODAY()) &&
  r.ステータス.notIn(["完了", "キャンセル"])
).build();
// => '((顧客名 = "サイボウズ株式会社" and 契約日 < TODAY()) and ステータス not in ("完了", "キャンセル"))'

// 複数ソートとAPIバリデーション
const query3 = kintoneQuery<App>(r =>
  r.金額.greaterThan(1000000) &&
  r.契約日.greaterThanOrEqual(FROM_TODAY(-30, 'DAYS')) &&
  r.ステータス.in(["商談中", "受注"])
)
  .orderBy('優先度', 'desc')     // 主ソート
  .orderBy('金額', 'desc')       // 副ソート
  .orderBy('契約日', 'asc')     // 第3ソート
  .limit(100)                       // ✅ バリデーション: 1-500のみ
  .offset(50)                       // ✅ バリデーション: 0-10000のみ
  .build();
// => '((金額 > 1000000 and 契約日 >= FROM_TODAY(-30, "DAYS")) and ステータス in ("商談中", "受注")) order by 優先度 desc, 金額 desc, 契約日 asc limit 100 offset 50'

// orderByManyで一括ソート
const query3b = kintoneQuery<App>(r =>
  r.ステータス.equals("アクティブ")
)
  .orderByMany([
    { field: '優先度', direction: 'desc' },
    { field: '期限日', direction: 'asc' },
    { field: '金額', direction: 'desc' }
  ])
  .limit(500)  // kintone APIの最大値
  .build();
// => 'ステータス = "アクティブ" order by 優先度 desc, 期限日 asc, 金額 desc limit 500'

// サブテーブルとAPIバリデーション
const 注文明細 = subTable('注文明細');
const query4 = kintoneQuery<App>(r =>
  r.顧客名.like("株式会社%") &&
  注文明細.商品コード.in(['P001', 'P002', 'P003']) &&
  注文明細.数量.greaterThan(100)
)
  .orderBy('契約日', 'desc')
  .limit(50)   // ✅ API制限内
  .build();
// => '((顧客名 like "株式会社%" and 注文明細.商品コード in ("P001", "P002", "P003")) and 注文明細.数量 > 100) order by 契約日 desc limit 50'

// ❌ これらはバリデーションエラーで弾かれます：
// .limit(501)    // エラー: limit()は1から500の間である必要があります
// .offset(10001) // エラー: offset()は0から10000の間である必要があります
```

### 3. カスタマイズでの使用

CLIで生成した型を使うことで、カスタマイズでも型安全に開発できます：

```typescript
// customize.ts
import { kintoneQuery, TODAY, FROM_TODAY } from 'kintone-functional-query';
import { App } from './generated/schema';

kintone.events.on('app.record.index.show', (event) => {
  const button = document.createElement('button');
  button.textContent = '重要な案件を検索';
  button.onclick = async () => {
    // 型安全！フィールド名の補完も効く
    const query = kintoneQuery<App>(r =>
      r.優先度.equals("高") &&
      r.期限日.lessThanOrEqual(FROM_TODAY(7, 'DAYS')) &&
      r.ステータス.notIn(["完了", "キャンセル"])
    )
      .orderBy('期限日', 'asc')
      .limit(50)
      .build();
    
    const resp = await kintone.app.getRecords({
      app: kintone.app.getId(),
      query: query
    });
    
    console.log(`${resp.records.length}件の重要案件があります`);
  };
  
  kintone.app.getHeaderMenuSpaceElement().appendChild(button);
  return event;
});
```

webpack等でバンドルして使用してください。

## バッチ生成機能

設定ファイルを使用して、複数のkintoneアプリのスキーマを効率的に生成できます。

### 設定ファイルの互換性

このライブラリは`kintone-as-code`の設定形式と互換性があり、シームレスな統合が可能です：

```javascript
// kintone-functional-query.config.js（またはkintone-as-code.config.js）
export default {
  default: 'production',
  environments: {
    production: {
      auth: {
        baseUrl: 'https://your-company.cybozu.com',
        apiToken: process.env.KINTONE_API_TOKEN,
      }
    },
    development: {
      auth: {
        baseUrl: 'https://dev.cybozu.com', 
        username: process.env.KINTONE_USERNAME,
        password: process.env.KINTONE_PASSWORD,
      }
    }
  },
  apps: [
    {
      appId: process.env.SALES_APP_ID || '123',
      name: '営業管理',
      outputPath: './schemas/sales',
      schemaName: 'SalesAppSchema'
    },
    {
      appId: process.env.CUSTOMER_APP_ID || '456',
      name: '顧客データベース', 
      outputPath: './schemas/customer'
    }
  ],
  output: {
    baseDir: 'generated',
    indexFile: true,
    format: 'typescript'
  }
};
```

### バッチコマンド

```bash
# 設定されたすべてのアプリを生成
kintone-query-gen batch

# 特定の設定ファイルを使用
kintone-query-gen batch --config ./custom-config.js

# 異なる環境を使用
kintone-query-gen batch --env development

# 何が生成されるかプレビュー
kintone-query-gen batch --dry-run

# 並列処理数を制御（デフォルト: 3）
kintone-query-gen batch --parallel 5

# 特定環境でカスタム並列数
kintone-query-gen batch --env production --parallel 8
```

### ワークフロー統合

```bash
# 典型的な開発ワークフロー
kintone-as-code export --app-id 123 --name sales-app
kintone-query-gen batch --config kintone-as-code.config.js

# CI/CDパイプライン
kintone-query-gen batch --env production --dry-run  # 検証
kintone-query-gen batch --env production            # 実行
```

## 複数ソート & API制限バリデーション

### 複数フィールドでのソート

`.orderBy()`の連鎖または`.orderByMany()`で複雑なソートが可能：

```typescript
// メソッドチェーンアプローチ
const query1 = kintoneQuery<App>(r => r.ステータス.equals('アクティブ'))
  .orderBy('優先度', 'desc')      // 主ソート
  .orderBy('期限日', 'asc')        // 副ソート  
  .orderBy('金額', 'desc')        // 第3ソート
  .build();

// 一括アプローチ
const query2 = kintoneQuery<App>(r => r.ステータス.equals('アクティブ'))
  .orderByMany([
    { field: '優先度', direction: 'desc' },
    { field: '期限日', direction: 'asc' },
    { field: '金額', direction: 'desc' }
  ])
  .build();

// どちらも生成される: 'ステータス = "アクティブ" order by 優先度 desc, 期限日 asc, 金額 desc'
```

### API制限バリデーション

kintone API制限違反を防ぐ組み込みバリデーション：

```typescript
// ✅ 有効 - kintone API制限内
const validQuery = kintoneQuery<App>(r => r.ステータス.equals('アクティブ'))
  .limit(500)    // kintoneで許可される最大値
  .offset(10000) // kintoneで許可される最大値
  .build();

// ❌ これらは即座にバリデーションエラーをスロー：
try {
  kintoneQuery<App>(r => r.ステータス.equals('アクティブ'))
    .limit(501)    // エラー: limit()は1から500の間である必要があります、受け取った値: 501
    .build();
} catch (error) {
  console.error(error.message);
}

try {
  kintoneQuery<App>(r => r.ステータス.equals('アクティブ'))
    .offset(10001) // エラー: offset()は0から10000の間である必要があります、受け取った値: 10001
    .build();
} catch (error) {
  console.error(error.message);
}

// ❌ 非整数値もエラーをトリガー
builder.limit(50.5);  // エラー: limit()は整数である必要があります、受け取った値: 50.5
```

### APIバリデーションの利点

- **早期発見**: 制限違反をビルド時に検出、実行時ではない
- **明確なエラーメッセージ**: 何が間違って、なぜなのかを正確に理解
- **開発効率性**: kintone APIの制約を覚える必要がない
- **本番安全性**: 本番環境での失敗したAPIコールを防止

## サポートするメソッド

### 比較メソッド
- `equals(value)`: 等価比較（`=`）
- `notEquals(value)`: 不等価比較（`!=`）
- `greaterThan(value)`: より大きい（`>`）
- `lessThan(value)`: より小さい（`<`）
- `greaterThanOrEqual(value)`: 以上（`>=`）
- `lessThanOrEqual(value)`: 以下（`<=`）

### 配列メソッド
- `in(values)`: 含まれる（`in`）
- `notIn(values)`: 含まれない（`not in`）

### 文字列メソッド
- `like(pattern)`: パターンマッチ（`like`）
- `notLike(pattern)`: パターン不一致（`not like`）

### 空チェックメソッド
- `isEmpty()`: 空である（`is empty`）
- `isNotEmpty()`: 空でない（`is not empty`）

### 論理演算子
- `&&`: AND条件
- `||`: OR条件

## サポートする関数

### 日付・時刻関数
- `TODAY()`: 今日の日付
- `NOW()`: 現在の日時
- `YESTERDAY()`: 昨日
- `TOMORROW()`: 明日
- `FROM_TODAY(days, unit?)`: 今日からの相対日付
- `THIS_WEEK()`: 今週
- `LAST_WEEK()`: 先週
- `NEXT_WEEK()`: 来週
- `THIS_MONTH()`: 今月
- `LAST_MONTH()`: 先月
- `NEXT_MONTH()`: 来月
- `THIS_YEAR()`: 今年

### ユーザー・組織関数
- `LOGINUSER()`: ログインユーザー
- `PRIMARY_ORGANIZATION()`: プライマリー組織

## サブテーブルのサポート

```typescript
import { kintoneQuery, subTable } from 'kintone-functional-query';

// サブテーブルを定義
const 注文明細 = subTable('注文明細');

// サブテーブルでのクエリ
const query = kintoneQuery(() => 
  注文明細.商品コード.in(['P001', 'P002'])
).build();
// => '注文明細.商品コード in ("P001", "P002")'

// メインテーブルとの組み合わせ
const query = kintoneQuery(r =>
  r.顧客名.like("株式会社%") &&
  注文明細.数量.greaterThan(100)
).build();
// => '(顧客名 like "株式会社%" and 注文明細.数量 > 100)'
```

**注意**: kintoneの仕様により、サブテーブルでは`equals`と`notEquals`は使用できません。

## 複雑な条件の組み合わせ

### 基本的な優先順位
```typescript
// (A && B) || C のパターン
const query1 = kintoneQuery<App>(r =>
  (r.ステータス.equals("商談中") && r.確度.greaterThan(70)) ||
  r.担当者.in([LOGINUSER()])
).build();
// => '((ステータス = "商談中" and 確度 > 70) or 担当者 in (LOGINUSER()))'

// A && (B || C) のパターン
const query2 = kintoneQuery<App>(r =>
  r.金額.greaterThan(1000000) &&
  (r.優先度.equals("高") || r.期限日.lessThan(TODAY()))
).build();
// => '(金額 > 1000000 and (優先度 = "高" or 期限日 < TODAY()))'
```

### ネストした条件
```typescript
// ((A || B) && C) || (D && E) のパターン
const query3 = kintoneQuery<App>(r =>
  ((r.ステータス.equals("商談中") || r.ステータス.equals("見積提出")) &&
   r.金額.greaterThan(1000000)) ||
  (r.優先度.equals("高") && r.期限日.lessThan(TODAY()))
).build();
// => '(((ステータス = "商談中" or ステータス = "見積提出") and 金額 > 1000000) or (優先度 = "高" and 期限日 < TODAY()))'
```

### 実践的な複雑なクエリ
```typescript
// 営業案件の優先度判定
const complexQuery = kintoneQuery<App>(r =>
  // 高優先度の条件
  (
    (r.確度.greaterThanOrEqual(80) && r.金額.greaterThan(5000000)) ||
    (r.期限日.lessThanOrEqual(FROM_TODAY(7, 'DAYS')) && r.ステータス.notEquals("失注"))
  ) &&
  // 共通条件
  r.担当者.in([LOGINUSER()]) &&
  // 除外条件
  r.顧客区分.notIn(["休眠顧客", "ブラックリスト"])
)
  .orderBy('金額', 'desc')
  .limit(20)
  .build();
// => '((((確度 >= 80 and 金額 > 5000000) or (期限日 <= FROM_TODAY(7, "DAYS") and ステータス != "失注")) and 担当者 in (LOGINUSER())) and 顧客区分 not in ("休眠顧客", "ブラックリスト")) order by 金額 desc limit 20'
```

### サブテーブルを含む複雑な条件
```typescript
const 商品明細 = subTable('商品明細');

const advancedQuery = kintoneQuery<App>(r =>
  (
    // 顧客条件
    (r.顧客名.like("%株式会社%") || r.顧客名.like("%有限会社%")) &&
    r.契約日.greaterThanOrEqual(THIS_MONTH())
  ) &&
  (
    // サブテーブル条件（高額商品または大量購入）
    商品明細.商品カテゴリ.in(["A", "B"]) ||
    (商品明細.単価.greaterThan(10000) && 商品明細.数量.greaterThan(10))
  ) &&
  // ステータス条件
  (
    r.ステータス.equals("受注") ||
    (r.ステータス.equals("商談中") && r.確度.greaterThanOrEqual(70))
  )
).build();
// => '((((顧客名 like "%株式会社%" or 顧客名 like "%有限会社%") and 契約日 >= THIS_MONTH()) and (商品明細.商品カテゴリ in ("A", "B") or (商品明細.単価 > 10000 and 商品明細.数量 > 10))) and (ステータス = "受注" or (ステータス = "商談中" and 確度 >= 70)))'
```

### 論理演算の優先順位について
- JavaScriptの演算子優先順位に従います（`&&` が `||` より優先）
- 明示的に括弧を使用することで、意図した優先順位を確実に指定できます
- 生成されるクエリでは、すべての論理演算が適切に括弧で囲まれます

## クエリパーサー

既存のkintoneクエリ文字列をAST（抽象構文木）にパースして、解析や操作を可能にします。

### 基本的な使い方

```typescript
import { parseKintoneQuery } from 'kintone-functional-query';

// クエリ文字列をパース
const query = 'Status = "Open" and Priority > 5';
const ast = parseKintoneQuery(query);

console.log(ast);
// {
//   type: "and",
//   left: { field: "Status", operator: "=", value: "Open" },
//   right: { field: "Priority", operator: ">", value: 5 }
// }
```

### 高度な使用例

```typescript
// 関数を含む複雑なクエリをパース
const complexQuery = '(Status = "Open" or Status = "Pending") and DueDate <= FROM_TODAY(7, "DAYS")';
const ast = parseKintoneQuery(complexQuery);

// ASTからフィールド名を抽出
function extractFields(expr) {
  const fields = [];
  function traverse(node) {
    if ('field' in node) {
      fields.push(node.field);
    } else if (node.type === 'and' || node.type === 'or') {
      traverse(node.left);
      traverse(node.right);
    }
  }
  traverse(expr);
  return [...new Set(fields)];
}

console.log(extractFields(ast)); // ["Status", "DueDate"]

// AST内の条件を変更
function modifyFieldValue(expr, targetField, newValue) {
  if ('field' in expr && expr.field === targetField) {
    return { ...expr, value: newValue };
  } else if (expr.type === 'and' || expr.type === 'or') {
    return {
      ...expr,
      left: modifyFieldValue(expr.left, targetField, newValue),
      right: modifyFieldValue(expr.right, targetField, newValue)
    };
  }
  return expr;
}

const modifiedAst = modifyFieldValue(ast, 'Status', 'Closed');
```

### サポートされているクエリ構文

パーサーは以下を含むすべてのkintoneクエリ構文をサポートしています：
- すべての比較演算子（`=`, `!=`, `>`, `<`, `>=`, `<=`）
- 配列演算子（`in`, `not in`）
- 文字列演算子（`like`, `not like`）
- 空チェック（`is empty`, `is not empty`）
- 論理演算子（`and`, `or`）
- 関数（例：`TODAY()`, `LOGINUSER()`, `FROM_TODAY()`）
- サブテーブルフィールド（例：`Table.Field`）

## 完全クエリAST & 高度な操作 (Phase 3)

**v0.3.0新機能**: ORDER BY、LIMIT、OFFSET句を含む完全なkintoneクエリのAST操作に対応しました。

### 完全クエリのパース

WHERE句だけでなく、完全なkintoneクエリを構造化されたASTにパースできます：

```typescript
import { parseKintoneQueryComplete } from 'kintone-functional-query';

// ORDER BY、LIMIT、OFFSETを含む完全なクエリをパース
const complexQuery = 'Status = "Open" and Priority >= 3 order by Priority desc, DueDate asc limit 50 offset 10';
const ast = parseKintoneQueryComplete(complexQuery);

console.log(ast);
// {
//   where: {
//     type: "and",
//     left: { field: "Status", operator: "=", value: "Open" },
//     right: { field: "Priority", operator: ">=", value: 3 }
//   },
//   orderBy: [
//     { field: "Priority", direction: "desc" },
//     { field: "DueDate", direction: "asc" }
//   ],
//   limit: 50,
//   offset: 10
// }
```

### 双方向クエリ変換

クエリ文字列とASTをシームレスに相互変換できます：

```typescript
import { queryConverter, astToQuery } from 'kintone-functional-query';

// クエリ文字列からコンバーターを作成
const converter = queryConverter('Status = "Open" limit 25');

// ASTにアクセスして変更
console.log(converter.ast.limit); // 25

// プログラム的にクエリを変更
const modified = converter
  .setLimit(100)
  .setOrderBy([{ field: 'Priority', direction: 'desc' }])
  .setOffset(20);

console.log(modified.toQuery()); 
// "Status = "Open" order by Priority desc limit 100 offset 20"
```

### 高度なクエリ変換

コールバック関数を使用してクエリを変換できます：

```typescript
import { transformQuery, combineQueries } from 'kintone-functional-query';

// 任意のクエリにページネーションを追加
const addPagination = (query: string, page: number, pageSize: number) =>
  transformQuery(query, ast => {
    ast.limit = pageSize;
    ast.offset = (page - 1) * pageSize;
  });

const paginatedQuery = addPagination('Status = "Open"', 2, 25);
// "Status = "Open" limit 25 offset 25"

// 複数のフィルターをANDロジックで結合
const combinedFilters = combineQueries([
  'Status = "Open"',
  'Priority >= 3',
  'AssignedTo = LOGINUSER()'
]);
// "((Status = "Open" and Priority >= 3) and AssignedTo = LOGINUSER())"
```

### クエリコンポーネントの抽出

クエリの特定の部分を抽出・分析できます：

```typescript
import { extractQueryComponents } from 'kintone-functional-query';

const components = extractQueryComponents(
  'Status = "Open" and Priority > 3 order by Priority desc limit 50 offset 10'
);

console.log({
  whereQuery: components.whereQuery,     // "(Status = "Open" and Priority > 3)"
  orderBy: components.orderBy,           // [{ field: "Priority", direction: "desc" }]
  limit: components.limit,               // 50
  offset: components.offset,             // 10
  hasWhere: components.hasWhere,         // true
  hasOrderBy: components.hasOrderBy,     // true
  sortFieldCount: components.sortFieldCount // 1
});
```

### GUIクエリビルダーの基盤

完全AST対応により、視覚的なクエリビルダーの構築が可能になります：

```typescript
// GUIアプリケーションで必要な機能：
// 1. 既存クエリを編集可能なコンポーネントにパース
// 2. クエリ構造とAPI制限の検証
// 3. 視覚的コンポーネントからクエリ生成
// 4. 元に戻す/やり直し操作のサポート
// 5. テンプレートとスニペット管理

const queryEditor = {
  load: (queryString: string) => queryConverter(queryString),
  
  save: (converter: any) => converter.toQuery(),
  
  addFilter: (converter: any, field: string, op: string, value: any) =>
    converter.modify(ast => {
      const newCondition = { field, operator: op, value };
      ast.where = ast.where ? {
        type: 'and',
        left: ast.where,
        right: newCondition
      } : newCondition;
    }),
    
  setSort: (converter: any, sorts: Array<{field: string, direction: 'asc'|'desc'}>) =>
    converter.setOrderBy(sorts)
};
```

### API検証と安全性

すべてのAST操作には組み込みのkintone API検証が含まれます：

```typescript
// ✅ 有効な操作
queryConverter('Status = "Open"').setLimit(500);    // 許可される最大値
queryConverter('Status = "Open"').setOffset(10000); // 許可される最大値

// ❌ これらは検証エラーを投げます
queryConverter('Status = "Open"').setLimit(501);    // API制限を超過
queryConverter('Status = "Open"').setOffset(10001); // API制限を超過
queryConverter('Status = "Open"').setLimit(50.5);   // 非整数値
```

## フロントエンドでの使用

フロントエンド（kintoneカスタマイズ・プラグイン）での使用方法は、開発するものによって2つのアプローチがあります。

### A. 特定アプリのカスタマイズ開発（推奨）

**対象**: 特定のkintoneアプリ専用のカスタマイズを開発する場合
**特徴**: 事前にフィールド構成がわかっているため、型安全に開発できる

📖 **詳細なガイドは [CUSTOMIZATION_GUIDE.md](CUSTOMIZATION_GUIDE.md) を参照してください**

#### 1. 事前準備（CLIでスキーマ生成）

```bash
# 営業管理アプリ（ID: 123）のスキーマを生成
npx kintone-query-gen generate \
  --domain your-domain.cybozu.com \
  --app-id 123 \
  --api-token YOUR_API_TOKEN \
  --output ./src/schemas
```

#### 2. 型安全なカスタマイズ開発

```typescript
// sales-customize.ts
import { kintoneQuery, TODAY, LOGINUSER } from 'kintone-functional-query';
import { SalesApp } from './schemas/sales-app-schema';  // CLIで生成された型

kintone.events.on('app.record.index.show', (event) => {
  // 型安全！IDEでフィールド名が補完される
  const myUrgentDeals = kintoneQuery<SalesApp>(r =>
    r.担当者.in([LOGINUSER()]) &&
    r.確度.greaterThanOrEqual(70) &&
    r.次回アクション日.lessThanOrEqual(TODAY()) &&
    r.ステータス.notEquals("失注")
  )
    .orderBy('見込み金額', 'desc')
    .limit(10)
    .build();
  
  // ボタンを追加
  const button = createButton('要対応案件', async () => {
    const records = await kintone.app.getRecords({
      app: kintone.app.getId(),
      query: myUrgentDeals
    });
    showModal(`${records.length}件の要対応案件があります`);
  });
  
  kintone.app.getHeaderSpaceElement().appendChild(button);
  return event;
});
```

**メリット**:
- 🔒 コンパイル時にエラーを検出（フィールド名のtypoなど）
- 📝 IDEの補完機能でフィールド名や型が自動表示
- 🚀 リファクタリングが安全（フィールド名変更時も追跡可能）
- 📖 コードが読みやすく、メンテナンスしやすい

### B. 汎用プラグイン開発

**対象**: 複数のアプリで動作する汎用的なプラグインを開発する場合
**特徴**: 実行時にフィールド情報を取得して動的に処理する必要がある

#### 1. フィールド情報の動的取得と検証

```typescript
import { kintoneQuery, FormFieldsResponse, S, FieldTypes } from 'kintone-functional-query';

// 汎用検索プラグインの実装例
class UniversalSearchPlugin {
  private formFields: FormFieldsResponse;
  
  async initialize() {
    try {
      // どのアプリでも動作するよう、実行時にフィールド情報を取得
      const fieldsData = await kintone.app.getFormFields();
      this.formFields = S.decodeUnknownSync(FormFieldsResponse)(fieldsData);
      
      // アプリに応じた検索UIを動的に生成
      this.renderSearchInterface();
    } catch (error) {
      console.error('プラグイン初期化エラー:', error);
      this.showError('このアプリではプラグインを使用できません');
    }
  }
  
  // フィールドタイプを判定して適切な検索UIを生成
  private renderSearchInterface() {
    const searchableFields = this.getSearchableFields();
    const container = this.createSearchContainer();
    
    searchableFields.forEach(([fieldCode, fieldInfo]) => {
      // フィールドタイプに応じた入力UI生成
      const inputElement = this.createSearchInput(fieldCode, fieldInfo);
      container.appendChild(inputElement);
    });
  }
  
  // 動的にクエリを構築（フィールド名は実行時に決定）
  buildDynamicQuery(searchParams: Record<string, any>): string {
    return kintoneQuery(r => {
      const conditions = [];
      
      Object.entries(searchParams).forEach(([fieldCode, value]) => {
        const fieldInfo = this.formFields.properties[fieldCode];
        if (!fieldInfo || !value) return;
        
        // フィールドタイプに応じた条件生成
        switch (fieldInfo.type) {
          case FieldTypes.SINGLE_LINE_TEXT:
          case FieldTypes.MULTI_LINE_TEXT:
            conditions.push(r[fieldCode].like(`%${value}%`));
            break;
            
          case FieldTypes.NUMBER:
          case FieldTypes.CALC:
            if (value.min !== undefined) {
              conditions.push(r[fieldCode].greaterThanOrEqual(value.min));
            }
            if (value.max !== undefined) {
              conditions.push(r[fieldCode].lessThanOrEqual(value.max));
            }
            break;
            
          case FieldTypes.DROP_DOWN:
          case FieldTypes.RADIO_BUTTON:
            conditions.push(r[fieldCode].equals(value));
            break;
            
          case FieldTypes.CHECK_BOX:
          case FieldTypes.MULTI_SELECT:
            if (Array.isArray(value) && value.length > 0) {
              conditions.push(r[fieldCode].in(value));
            }
            break;
        }
      });
      
      return conditions.length > 0 
        ? conditions.reduce((a, b) => a && b)
        : true;  // 条件なし = 全件
    }).build();
  }
}

// プラグインの使用例
kintone.events.on(['app.record.index.show'], async (event) => {
  const plugin = new UniversalSearchPlugin();
  await plugin.initialize();
  
  // 検索実行ボタン
  document.getElementById('plugin-search-btn').onclick = async () => {
    const searchParams = plugin.collectSearchParams();
    const query = plugin.buildDynamicQuery(searchParams);
    
    const records = await kintone.app.getRecords({
      app: kintone.app.getId(),
      query: query
    });
    
    plugin.displayResults(records);
  };
  
  return event;
});
```

#### 2. エラーハンドリングとフォールバック

```typescript
import { Effect as E, pipe } from 'kintone-functional-query';

// 汎用プラグインでの安全なフィールド情報取得
class SafeFieldManager {
  static async getFields() {
    return pipe(
      E.tryPromise(() => kintone.app.getFormFields()),
      E.flatMap(S.decodeUnknown(FormFieldsResponse)),
      E.tap(fields => 
        E.sync(() => console.log(`${Object.keys(fields.properties).length}個のフィールドを検出`))
      ),
      E.catchAll(error => {
        console.error('フィールド情報の取得に失敗:', error);
        // 最小限の機能で動作を継続
        return E.succeed({
          properties: {},
          revision: '0'
        });
      })
    );
  }
  
  // フィールドタイプの安全な判定
  static isSearchable(field: any): boolean {
    const searchableTypes = [
      FieldTypes.SINGLE_LINE_TEXT,
      FieldTypes.NUMBER,
      FieldTypes.DATE,
      FieldTypes.DROP_DOWN
    ];
    
    return field?.type && searchableTypes.includes(field.type);
  }
}
```

**メリット**:
- 🌍 どのアプリでも動作する汎用性
- 🔧 実行時の柔軟な対応
- 🛡️ 未知のフィールドタイプにも対処可能
- 📦 一度作れば複数のアプリで再利用可能

**デメリット**:
- ⚠️ 実行時までエラーがわからない
- 🔍 IDEの補完が効かない
- 🐛 デバッグが難しい
- 📚 コードが複雑になりがち

### 使い分けの指針

| ケース | 推奨アプローチ | 理由 |
|--------|--------------|------|
| 自社の特定アプリ用カスタマイズ | A. 型安全な開発 | フィールドが事前にわかるため |
| 顧客納品用のカスタマイズ | A. 型安全な開発 | 品質保証が重要なため |
| kintoneアプリストアのプラグイン | B. 汎用開発 | 不特定多数のアプリで動作する必要があるため |
| 複数部署で使う社内ツール | B. 汎用開発 | 各部署のアプリ構成が異なるため |

詳細な実装例は [動的クエリビルダーガイド](FRONTEND_GUIDE.md) を参照してください。

## 高度な機能

### Effect-TSによる実行時バリデーション

ライブラリはクエリ式の実行時バリデーション機能を提供します：

```typescript
import { kintoneQuery, Logger } from 'kintone-functional-query';

// デバッグログを有効化
process.env.DEBUG = 'true';

const query = kintoneQuery<App>(r => 
  r.ステータス.equals('Active') &&
  r.優先度.greaterThan('invalid-number') // これは検証警告をログ出力
).build();

// 検証警告は構造化されたコンテキストと共にログ出力される：
// [kintone-query:WARN] Expression validation failed: Expected number, actual "invalid-number" 
// (module=proxy function=createValidatedExpression field=優先度 operator=>)
```

### 高度なログ機能

```typescript
import { Logger } from 'kintone-functional-query';

// コンテキスト付きのカスタムログ
Logger.warn('カスタム検証が失敗しました', {
  module: 'my-module',
  function: 'validateInput',
  field: '顧客名',
  value: userInput
});

// 構造化ログは自動的にモジュール、関数、フィールド情報を含みます
```

### 関数引数の検証

日付関数は厳密な引数検証を持つようになりました：

```typescript
import { FROM_TODAY } from 'kintone-functional-query';

// 有効な使用例
FROM_TODAY(7, 'DAYS');    // ✅ 有効
FROM_TODAY(-30);          // ✅ 有効

// 無効な使用例（検証エラーをスロー）
FROM_TODAY(500);          // ❌ 範囲外 (-365 から 365)
FROM_TODAY(5, 'HOURS');   // ❌ 無効な単位 (DAYS/WEEKS/MONTHS/YEARS が必要)
FROM_TODAY('not-number'); // ❌ 無効な型 (数値が必要)
```

## 開発

```bash
# 依存関係のインストール
npm install

# テスト
npm test

# ビルド
npm run build

# 型チェック
npm run typecheck

# Lint
npm run lint
```

## ライセンス

MIT