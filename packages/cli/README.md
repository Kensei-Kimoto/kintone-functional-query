# @kintone-functional-query/cli

kintone アプリのフォーム情報から型安全なスキーマを生成するCLIツール

## インストール

```bash
npm install -D @kintone-functional-query/cli
# または
pnpm add -D @kintone-functional-query/cli
```

## 使い方

### 基本的な使用方法

```bash
npx kintone-query-gen generate \
  --domain example.cybozu.com \
  --app-id 123 \
  --api-token YOUR_API_TOKEN \
  --output ./src/generated
```

### オプション

- `--domain, -d`: kintoneのドメイン（必須）
- `--app-id, -a`: アプリID（必須）
- `--api-token, -t`: APIトークン（認証に使用）
- `--output, -o`: 出力ディレクトリ（デフォルト: `./generated`）
- `--schema-name, -n`: スキーマ名（デフォルト: `AppSchema`）

### 生成されるファイル

```
generated/
├── appschema.schema.ts  # Effect Schema定義
├── appschema.types.ts   # TypeScript型定義
└── index.ts             # エクスポート用
```

### 使用例

生成されたスキーマを使用：

```typescript
import { AppSchema } from './generated';
import { kintoneQuery } from '@kintone-functional-query/core';

const query = kintoneQuery<AppSchema>(r => 
  r.Customer.equals("サイボウズ株式会社") &&
  r.Status.notIn(["完了", "キャンセル"])
);
```

## 認証

### APIトークンを使用（推奨）

```bash
npx kintone-query-gen generate \
  --domain example.cybozu.com \
  --app-id 123 \
  --api-token YOUR_API_TOKEN
```

### ユーザー認証を使用

環境変数で設定：

```bash
export KINTONE_USERNAME=your-username
export KINTONE_PASSWORD=your-password

npx kintone-query-gen generate \
  --domain example.cybozu.com \
  --app-id 123
```

## トラブルシューティング

### APIトークンの権限

APIトークンには「アプリ管理」の権限が必要です。

### CORS エラー

このツールはNode.js環境で実行されるため、CORSの制限はありません。