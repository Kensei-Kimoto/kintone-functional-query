# 特定アプリ向けカスタマイズ開発ガイド

## はじめに

このガイドは、特定のkintoneアプリ専用のカスタマイズを型安全に開発する方法を説明します。

### 📌 このガイドが対象とするケース

- ✅ 自社の特定業務アプリ用のカスタマイズ
- ✅ 顧客企業の要件に合わせたカスタム開発
- ✅ フィールド構成が確定しているアプリの機能拡張

### 🎯 このアプローチのメリット

1. **開発時の安全性**
   - コンパイル時にフィールド名のtypoを検出
   - 型の不整合を事前に発見
   - リファクタリング時の影響範囲を把握

2. **開発効率の向上**
   - IDEでフィールド名が自動補完
   - 型情報によるドキュメント不要
   - コードレビューが容易

3. **保守性の向上**
   - コードの意図が明確
   - 変更時の影響を追跡可能
   - テストが書きやすい

## ステップバイステップ実装

### 1. プロジェクトのセットアップ

```bash
# プロジェクトディレクトリを作成
mkdir my-kintone-customize
cd my-kintone-customize

# package.jsonを初期化
npm init -y

# 必要なパッケージをインストール
npm install kintone-functional-query
npm install -D kintone-functional-query-cli typescript webpack webpack-cli ts-loader

# TypeScript設定
npx tsc --init
```

### 2. アプリのスキーマを生成

```bash
# 例：営業管理アプリ（アプリID: 123）
npx kintone-query-gen generate \
  --domain your-domain.cybozu.com \
  --app-id 123 \
  --api-token YOUR_API_TOKEN \
  --output ./src/schemas \
  --schema-name SalesApp
```

生成されるファイル：
```typescript
// ./src/schemas/sales-app.ts
import { Schema as S } from 'effect';
import {
  SingleLineTextFieldSchema,
  NumberFieldSchema,
  DateFieldSchema,
  DropDownFieldSchema,
  UserSelectFieldSchema,
  SubtableFieldSchema,
} from 'kintone-effect-schema';

export const SalesAppSchema = S.Struct({
  顧客名: SingleLineTextFieldSchema,
  担当者: UserSelectFieldSchema,
  商談ステータス: DropDownFieldSchema,
  確度: NumberFieldSchema,
  見込み金額: NumberFieldSchema,
  受注予定日: DateFieldSchema,
  次回アクション日: DateFieldSchema,
  商談メモ: S.optional(SingleLineTextFieldSchema),
  
  // サブテーブル
  商品情報: SubtableFieldSchema(
    S.Struct({
      商品名: SingleLineTextFieldSchema,
      単価: NumberFieldSchema,
      数量: NumberFieldSchema,
      小計: NumberFieldSchema,
    })
  ),
});

export type SalesApp = S.Schema.Type<typeof SalesAppSchema>;
```

### 3. カスタマイズの実装

```typescript
// ./src/customize.ts
import { kintoneQuery, TODAY, LOGINUSER, FROM_TODAY, subTable } from 'kintone-functional-query';
import { SalesApp } from './schemas/sales-app';

// サブテーブルの定義
const 商品情報 = subTable('商品情報');

// 便利なクエリビルダー関数を定義
const queries = {
  // 自分の要対応案件
  myUrgentDeals: () => 
    kintoneQuery<SalesApp>(r =>
      r.担当者.in([LOGINUSER()]) &&
      r.次回アクション日.lessThanOrEqual(TODAY()) &&
      r.商談ステータス.notIn(["失注", "受注"])
    ).orderBy('次回アクション日', 'asc'),

  // 高確度案件
  highProbabilityDeals: (minProbability: number = 70) =>
    kintoneQuery<SalesApp>(r =>
      r.確度.greaterThanOrEqual(minProbability) &&
      r.商談ステータス.equals("商談中")
    ).orderBy('見込み金額', 'desc'),

  // 今月受注予定
  thisMonthExpected: () =>
    kintoneQuery<SalesApp>(r =>
      r.受注予定日.greaterThanOrEqual(FROM_TODAY(0, 'DAYS')) &&
      r.受注予定日.lessThan(FROM_TODAY(30, 'DAYS')) &&
      r.商談ステータス.in(["商談中", "見積提出済"])
    ),

  // 特定商品を含む案件
  dealsWithProduct: (productName: string) =>
    kintoneQuery<SalesApp>(() =>
      商品情報.商品名.like(`%${productName}%`)
    ),
};

// カスタマイズの実装
(() => {
  'use strict';
  
  // 一覧画面のカスタマイズ
  kintone.events.on('app.record.index.show', (event) => {
    // ヘッダーにボタンを追加
    const headerSpace = kintone.app.getHeaderSpaceElement();
    
    // 要対応案件ボタン
    const urgentButton = createButton('要対応案件', 'urgent');
    urgentButton.onclick = async () => {
      const query = queries.myUrgentDeals().build();
      await showFilteredRecords(query, '要対応案件');
    };
    
    // 高確度案件ボタン
    const highProbButton = createButton('高確度案件（70%以上）', 'high-prob');
    highProbButton.onclick = async () => {
      const query = queries.highProbabilityDeals(70).limit(20).build();
      await showFilteredRecords(query, '高確度案件');
    };
    
    // 今月受注予定ボタン
    const thisMonthButton = createButton('今月受注予定', 'this-month');
    thisMonthButton.onclick = async () => {
      const query = queries.thisMonthExpected().build();
      const records = await kintone.app.getRecords({
        app: kintone.app.getId(),
        query: query,
        fields: ['顧客名', '見込み金額', '受注予定日']
      });
      
      // 合計金額を計算
      const total = records.records.reduce((sum, record) => 
        sum + Number(record.見込み金額.value), 0
      );
      
      showModal(
        `今月の受注予定: ${records.records.length}件`,
        `合計見込み金額: ${total.toLocaleString()}円`
      );
    };
    
    headerSpace.appendChild(urgentButton);
    headerSpace.appendChild(highProbButton);
    headerSpace.appendChild(thisMonthButton);
    
    return event;
  });
  
  // 詳細画面のカスタマイズ
  kintone.events.on('app.record.detail.show', (event) => {
    const record = event.record;
    
    // 関連商談を検索するボタン
    if (record.顧客名.value) {
      const button = createButton('同じ顧客の商談を表示', 'related');
      button.onclick = async () => {
        const query = kintoneQuery<SalesApp>(r =>
          r.顧客名.equals(record.顧客名.value as string)
        ).orderBy('作成日時', 'desc').build();
        
        await showFilteredRecords(query, `${record.顧客名.value}の商談一覧`);
      };
      
      kintone.app.record.getSpaceElement('relatedDealsButton').appendChild(button);
    }
    
    return event;
  });
  
  // ユーティリティ関数
  function createButton(text: string, className: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = `custom-button ${className}`;
    return button;
  }
  
  async function showFilteredRecords(query: string, title: string) {
    try {
      const resp = await kintone.app.getRecords({
        app: kintone.app.getId(),
        query: query
      });
      
      // カスタムビューで表示（実装は省略）
      showCustomView(resp.records, title);
    } catch (error) {
      console.error('レコード取得エラー:', error);
      alert('データの取得に失敗しました');
    }
  }
  
  function showModal(title: string, message: string) {
    // モーダル表示の実装（省略）
  }
  
  function showCustomView(records: any[], title: string) {
    // カスタムビューの実装（省略）
  }
})();
```

### 4. webpackの設定

```javascript
// webpack.config.js
const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/customize.ts',
  output: {
    filename: 'customize.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
};
```

### 5. ビルドとデプロイ

```bash
# ビルド
npx webpack

# dist/customize.js が生成される
# これをkintoneアプリの設定画面からアップロード
```

## ベストプラクティス

### 1. クエリビルダーの再利用

```typescript
// queries.ts - クエリを別ファイルに分離
export const salesQueries = {
  // 期限切れ案件
  overdue: () => 
    kintoneQuery<SalesApp>(r =>
      r.次回アクション日.lessThan(TODAY()) &&
      r.商談ステータス.notEquals("受注")
    ),
    
  // 大型案件
  bigDeals: (threshold: number = 10000000) =>
    kintoneQuery<SalesApp>(r =>
      r.見込み金額.greaterThan(threshold)
    ),
    
  // 複合条件の例
  complexQuery: (params: {
    status?: string[];
    minAmount?: number;
    assignee?: string;
  }) => {
    return kintoneQuery<SalesApp>(r => {
      const conditions = [];
      
      if (params.status) {
        conditions.push(r.商談ステータス.in(params.status));
      }
      if (params.minAmount) {
        conditions.push(r.見込み金額.greaterThanOrEqual(params.minAmount));
      }
      if (params.assignee) {
        conditions.push(r.担当者.in([{ code: params.assignee }]));
      }
      
      return conditions.length > 0
        ? conditions.reduce((a, b) => a && b)
        : true;
    });
  }
};
```

### 2. 型定義の活用

```typescript
// types.ts - カスタム型定義
import { SalesApp } from './schemas/sales-app';

// レコードの部分型
type SalesSummary = Pick<SalesApp, '顧客名' | '見込み金額' | '商談ステータス'>;

// ビジネスロジックの型
interface DealMetrics {
  totalAmount: number;
  averageProbability: number;
  dealCount: number;
  byStatus: Record<string, number>;
}

// 関数の型安全性を保証
function calculateMetrics(records: SalesApp[]): DealMetrics {
  // 実装...
}
```

### 3. エラーハンドリング

```typescript
import { Effect as E, pipe } from 'kintone-functional-query';

// Effectを使った安全な処理
const safeGetRecords = (query: string) =>
  pipe(
    E.tryPromise({
      try: () => kintone.app.getRecords({ 
        app: kintone.app.getId(), 
        query 
      }),
      catch: (error) => ({
        _tag: 'KintoneError' as const,
        message: String(error)
      })
    }),
    E.map(resp => resp.records),
    E.tap(records => 
      E.sync(() => console.log(`${records.length}件取得`))
    )
  );

// 使用例
const program = pipe(
  E.succeed(queries.myUrgentDeals().build()),
  E.flatMap(safeGetRecords),
  E.catchTag('KintoneError', (error) => {
    console.error('エラー:', error.message);
    return E.succeed([]);
  })
);

const records = await E.runPromise(program);
```

## トラブルシューティング

### スキーマ生成時の注意点

1. **APIトークンの権限**
   - アプリ管理権限が必要
   - レコード閲覧権限も推奨

2. **フィールドコードの命名**
   - 日本語フィールドコードも問題なく動作
   - 特殊文字は自動的にエスケープ

3. **型定義の更新**
   - アプリのフィールド変更後は再生成が必要
   - CI/CDで自動化することを推奨

### よくある質問

**Q: フィールドを追加したら？**
A: CLIでスキーマを再生成してください。TypeScriptのコンパイルエラーで変更箇所がわかります。

**Q: 本番環境とテスト環境でアプリIDが違う場合は？**
A: 環境変数でアプリIDを管理し、ビルド時に切り替えることを推奨します。

**Q: 複数のアプリを扱う場合は？**
A: アプリごとにスキーマを生成し、別々の型として管理してください。

## まとめ

特定アプリ向けのカスタマイズ開発では、CLIでスキーマを生成することで：

- ✅ 型安全な開発が可能
- ✅ IDEの補完機能をフル活用
- ✅ バグの早期発見
- ✅ メンテナンスが容易

これらのメリットを活かして、品質の高いカスタマイズを効率的に開発できます。