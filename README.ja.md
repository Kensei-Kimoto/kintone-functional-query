# kintone-functional-query

[![CI](https://github.com/kimotokensei/kintone-functional-query/actions/workflows/ci.yml/badge.svg)](https://github.com/kimotokensei/kintone-functional-query/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/kintone-functional-query.svg)](https://badge.fury.io/js/kintone-functional-query)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Type-safe functional query builder for kintone

## 機能

- **クエリビルダー**: ラムダ式で型安全なkintoneクエリを構築
- **CLIツール**: kintone APIからEffect Schemaを自動生成
- **完全な型サポート**: TypeScriptの型システムを最大限活用
- **全演算子対応**: kintoneのすべてのクエリ演算子をサポート

## 概要

kintone-functional-queryは、kintoneのクエリをラムダ式で型安全に記述できるTypeScriptライブラリです。IDEの補完機能を活用して、直感的にクエリを構築できます。

## 特徴

- 🔒 **型安全**: TypeScriptの型システムを活用した型安全なクエリ構築
- ✨ **直感的**: ラムダ式による自然な記述
- 🚀 **補完対応**: IDEの自動補完で快適な開発体験
- 🔧 **柔軟**: 演算子、関数、order by、limit、offsetをサポート

## インストール

```bash
npm install kintone-functional-query
```

## 使用例

### 1. CLIでスキーマを生成

```bash
npx kintone-query-gen generate \
  --domain example.cybozu.com \
  --app-id 123 \
  --api-token YOUR_API_TOKEN \
  --output ./src/generated
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

// 全部盛りの例（orderBy、limit、offset）
const query3 = kintoneQuery<App>(r =>
  r.金額.greaterThan(1000000) &&
  r.契約日.greaterThanOrEqual(FROM_TODAY(-30, 'DAYS')) &&
  r.ステータス.in(["商談中", "受注"])
)
  .orderBy('金額', 'desc')
  .limit(100)
  .offset(20)
  .build();
// => '((金額 > 1000000 and 契約日 >= FROM_TODAY(-30, "DAYS")) and ステータス in ("商談中", "受注")) order by 金額 desc limit 100 offset 20'

// サブテーブルを含むクエリ
const 注文明細 = subTable('注文明細');
const query4 = kintoneQuery<App>(r =>
  r.顧客名.like("株式会社%") &&
  注文明細.商品コード.in(['P001', 'P002', 'P003']) &&
  注文明細.数量.greaterThan(100)
)
  .orderBy('契約日', 'desc')
  .limit(50)
  .build();
// => '((顧客名 like "株式会社%" and 注文明細.商品コード in ("P001", "P002", "P003")) and 注文明細.数量 > 100) order by 契約日 desc limit 50'
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